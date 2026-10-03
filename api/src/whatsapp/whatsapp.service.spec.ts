import { WhatsappService } from './whatsapp.service';
import type { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma/prisma.service';
import type { GeminiService } from '../gemini/gemini.service';
import type { Env } from '../config/env.validation';

const makeConfig = (vals: Record<string, string>) =>
  ({ get: (k: string) => vals[k] ?? '' }) as unknown as ConfigService<Env, true>;

/** Gemini apagado (modo stub) por default — la mayoría de los tests no lo necesitan. */
const makeGemini = (overrides: Partial<GeminiService> = {}) =>
  ({
    isConfigured: false,
    generateJson: jest.fn(),
    ...overrides,
  }) as unknown as GeminiService;

describe('WhatsappService', () => {
  it('sin WHATSAPP_TOKEN corre en modo stub y no envía', async () => {
    const prisma = { user: { findMany: jest.fn() } };
    const service = new WhatsappService(
      makeConfig({ WHATSAPP_PROVIDER: 'meta' }),
      prisma as unknown as PrismaService,
      makeGemini(),
    );
    service.onModuleInit();
    expect(service.isConfigured).toBe(false);
    const r = await service.sendMessage('+5215512345678', 'hola');
    expect(r).toEqual({ sent: false, mode: 'stub' });
  });

  it('meta requiere WHATSAPP_PHONE_ID para estar configurado', () => {
    const prisma = { user: { findMany: jest.fn() } };
    const service = new WhatsappService(
      makeConfig({ WHATSAPP_PROVIDER: 'meta', WHATSAPP_TOKEN: 'tok' }),
      prisma as unknown as PrismaService,
      makeGemini(),
    );
    service.onModuleInit();
    expect(service.isConfigured).toBe(false); // falta phoneId
  });

  it('notifyOrgAdmins solo consulta admins con opt-in y teléfono', async () => {
    const prisma = {
      user: {
        findMany: jest.fn().mockResolvedValue([
          { whatsappPhone: '+5215511112222' },
        ]),
      },
    };
    const service = new WhatsappService(
      makeConfig({ WHATSAPP_PROVIDER: 'meta' }),
      prisma as unknown as PrismaService,
      makeGemini(),
    );
    service.onModuleInit(); // stub mode

    const res = await service.notifyOrgAdmins('org-1', 'alerta');
    const where = prisma.user.findMany.mock.calls[0][0].where;
    expect(where.organizationId).toBe('org-1');
    expect(where.role).toBe('CORPORATE_ADMIN');
    expect(where.whatsappOptIn).toBe(true);
    expect(where.whatsappPhone).toEqual({ not: null });
    // en stub no se envía pero sí se cuentan los destinatarios
    expect(res).toEqual({ recipients: 1, sent: 0 });
  });

  it('notifyOrgAdmins con Gemini sin configurar manda el texto original tal cual', async () => {
    const prisma = {
      user: {
        findMany: jest.fn().mockResolvedValue([
          { whatsappPhone: '+5215511112222' },
        ]),
      },
    };
    const gemini = makeGemini({ isConfigured: false });
    const service = new WhatsappService(
      makeConfig({ WHATSAPP_PROVIDER: 'meta' }),
      prisma as unknown as PrismaService,
      gemini,
    );
    service.onModuleInit();

    await service.notifyOrgAdmins('org-1', 'Factura FAC-1 bloqueada.');
    expect(gemini.generateJson).not.toHaveBeenCalled();
  });

  it('notifyOrgAdmins usa el texto redactado por Gemini cuando está disponible', async () => {
    const prisma = {
      user: {
        findMany: jest.fn().mockResolvedValue([
          { whatsappPhone: '+5215511112222' },
        ]),
      },
    };
    const gemini = makeGemini({
      isConfigured: true,
      generateJson: jest
        .fn()
        .mockResolvedValue({ mensaje: '🔔 Tu factura FAC-1 quedó bloqueada.' }),
    });
    const service = new WhatsappService(
      makeConfig({
        WHATSAPP_PROVIDER: 'meta',
        WHATSAPP_TOKEN: 'tok',
        WHATSAPP_PHONE_ID: 'pid',
      }),
      prisma as unknown as PrismaService,
      gemini,
    );
    service.onModuleInit();
    jest
      .spyOn(service as unknown as { sendMessage: WhatsappService['sendMessage'] }, 'sendMessage')
      .mockResolvedValue({ sent: true, mode: 'meta' });

    await service.notifyOrgAdmins('org-1', 'Factura FAC-1 bloqueada.');

    expect(gemini.generateJson).toHaveBeenCalledTimes(1);
    const [, ctx] = (gemini.generateJson as jest.Mock).mock.calls[0];
    expect(ctx).toEqual({ organizationId: 'org-1', feature: 'GEMINI_WHATSAPP' });
    expect(service.sendMessage).toHaveBeenCalledWith(
      '+5215511112222',
      '🔔 Tu factura FAC-1 quedó bloqueada.',
    );
  });

  it('si Gemini falla o no devuelve mensaje, notifyOrgAdmins cae al texto original', async () => {
    const prisma = {
      user: {
        findMany: jest.fn().mockResolvedValue([
          { whatsappPhone: '+5215511112222' },
        ]),
      },
    };
    const gemini = makeGemini({
      isConfigured: true,
      generateJson: jest.fn().mockRejectedValue(new Error('timeout')),
    });
    const service = new WhatsappService(
      makeConfig({
        WHATSAPP_PROVIDER: 'meta',
        WHATSAPP_TOKEN: 'tok',
        WHATSAPP_PHONE_ID: 'pid',
      }),
      prisma as unknown as PrismaService,
      gemini,
    );
    service.onModuleInit();
    jest
      .spyOn(service as unknown as { sendMessage: WhatsappService['sendMessage'] }, 'sendMessage')
      .mockResolvedValue({ sent: true, mode: 'meta' });

    await service.notifyOrgAdmins('org-1', 'Factura FAC-1 bloqueada.');

    expect(service.sendMessage).toHaveBeenCalledWith(
      '+5215511112222',
      'Factura FAC-1 bloqueada.',
    );
  });

  describe('sendForOrg (FR-08: pool de números virtuales)', () => {
    it('sin números configurados, cae a sendMessage (comportamiento previo)', async () => {
      const prisma = { virtualNumber: { findFirst: jest.fn().mockResolvedValue(null) } };
      const service = new WhatsappService(
        makeConfig({ WHATSAPP_PROVIDER: 'meta', WHATSAPP_TOKEN: 'tok', WHATSAPP_PHONE_ID: 'pid-global' }),
        prisma as unknown as PrismaService,
        makeGemini(),
      );
      service.onModuleInit();
      jest
        .spyOn(service, 'sendMessage')
        .mockResolvedValue({ sent: true, mode: 'meta' });

      await service.sendForOrg('org-1', '+5215511112222', 'hola');

      expect(prisma.virtualNumber.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { organizationId: 'org-1', isActive: true } }),
      );
      expect(service.sendMessage).toHaveBeenCalledWith('+5215511112222', 'hola');
    });

    it('con un número activo, envía con ese phoneId y actualiza lastUsedAt', async () => {
      const prisma = {
        virtualNumber: {
          findFirst: jest
            .fn()
            .mockResolvedValue({ id: 'vn-1', phoneId: 'pid-pool-1' }),
          update: jest.fn().mockResolvedValue({}),
        },
      };
      const service = new WhatsappService(
        makeConfig({ WHATSAPP_PROVIDER: 'meta', WHATSAPP_TOKEN: 'tok', WHATSAPP_PHONE_ID: 'pid-global' }),
        prisma as unknown as PrismaService,
        makeGemini(),
      );
      service.onModuleInit();
      jest
        .spyOn(service, 'sendMessage')
        .mockResolvedValue({ sent: true, mode: 'meta' });

      const res = await service.sendForOrg('org-1', '+5215511112222', 'hola');

      expect(service.sendMessage).toHaveBeenCalledWith(
        '+5215511112222',
        'hola',
        'pid-pool-1',
      );
      expect(prisma.virtualNumber.update).toHaveBeenCalledWith({
        where: { id: 'vn-1' },
        data: { lastUsedAt: expect.any(Date) },
      });
      expect(res).toEqual({ sent: true, mode: 'meta' });
    });
  });
});
