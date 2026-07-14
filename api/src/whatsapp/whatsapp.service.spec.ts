import { WhatsappService } from './whatsapp.service';
import type { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma/prisma.service';
import type { Env } from '../config/env.validation';

const makeConfig = (vals: Record<string, string>) =>
  ({ get: (k: string) => vals[k] ?? '' }) as unknown as ConfigService<Env, true>;

describe('WhatsappService', () => {
  it('sin WHATSAPP_TOKEN corre en modo stub y no envía', async () => {
    const prisma = { user: { findMany: jest.fn() } };
    const service = new WhatsappService(
      makeConfig({ WHATSAPP_PROVIDER: 'meta' }),
      prisma as unknown as PrismaService,
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
});
