import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { ConfigService } from '@nestjs/config';
import { WhatsappConversationService } from './whatsapp-conversation.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { WhatsappService } from './whatsapp.service';
import { GeminiService } from '../gemini/gemini.service';
import { CustomerPortalService } from '../customer-portal/customer-portal.service';
import type { Env } from '../config/env.validation';

const NOW = new Date('2026-10-15T17:00:00Z');
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000);

const customer = {
  id: 'c-1',
  organizationId: 'org-1',
  name: 'Distribuidora del Norte',
  contact: 'Patricia Salas',
  phone: '+5215512345678',
  financeContactName: null,
  financeContactPhone: null,
  doNotContact: false,
};
const invoice = {
  id: 'inv-1',
  folio: 'F-2841',
  cfdiUuid: 'aaaaaaaa-1111',
  total: new Prisma.Decimal(284500),
  currency: 'MXN',
  dueDate: new Date('2026-10-17T00:00:00Z'),
};
const user = { id: 'u-1', organizationId: 'org-1', operationalProfile: null } as never;

describe('WhatsappConversationService', () => {
  let prisma: {
    whatsappMessage: { findFirst: jest.Mock; create: jest.Mock; findMany: jest.Mock };
    customer: { findFirst: jest.Mock; findMany: jest.Mock };
    invoice: { findMany: jest.Mock };
    collectionPolicy: { findFirst: jest.Mock };
    collectionSequenceRun: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
    withOrg: jest.Mock;
  };
  let whatsapp: { sendTemplate: jest.Mock; sendMessage: jest.Mock; isConfigured: boolean };

  /** El cliente escribió hace `h` horas (solo responde a la consulta de la ventana). */
  const clienteEscribio = (h: number, phoneNumberId: string | null = null) =>
    prisma.whatsappMessage.findFirst.mockImplementation(({ where }: { where: { direction: string } }) =>
      where.direction === 'INBOUND' ? { createdAt: hoursAgo(h), phoneNumberId } : null,
    );
  let gemini: { generateJson: jest.Mock };
  let service: WhatsappConversationService;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(NOW);
    prisma = {
      whatsappMessage: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }) => ({ id: 'm-1', ...data })),
        findMany: jest.fn().mockResolvedValue([]),
      },
      customer: { findFirst: jest.fn().mockResolvedValue(customer), findMany: jest.fn().mockResolvedValue([customer]) },
      invoice: { findMany: jest.fn().mockResolvedValue([invoice]) },
      collectionPolicy: { findFirst: jest.fn().mockResolvedValue(null) },
      collectionSequenceRun: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn(), update: jest.fn() },
      withOrg: jest.fn(),
    };
    prisma.withOrg.mockImplementation((_o: string, fn: (tx: unknown) => unknown) => fn(prisma));
    whatsapp = {
      sendTemplate: jest.fn().mockResolvedValue({ sent: true, mode: 'meta', id: 'wamid.T' }),
      sendMessage: jest.fn().mockResolvedValue({ sent: true, mode: 'meta', id: 'wamid.X' }),
      isConfigured: true,
    };
    gemini = { generateJson: jest.fn() };
    service = new WhatsappConversationService(
      prisma as unknown as PrismaService,
      whatsapp as unknown as WhatsappService,
      gemini as unknown as GeminiService,
      { issuePortalLink: jest.fn().mockResolvedValue('https://app/portal-cliente/tok') } as unknown as CustomerPortalService,
      { get: () => 'https://app' } as unknown as ConfigService<Env, true>,
    );
  });

  afterEach(() => jest.useRealTimers());

  describe('ventana de 24h', () => {
    it('abierta si el cliente escribió hace menos de 24h', async () => {
      clienteEscribio(3, 'PN-1');
      const w = await service.windowState('c-1');
      expect(w.open).toBe(true);
      expect(w.phoneNumberId).toBe('PN-1');
    });

    it('cerrada si pasaron más de 24h o nunca escribió', async () => {
      clienteEscribio(25);
      expect((await service.windowState('c-1')).open).toBe(false);
      prisma.whatsappMessage.findFirst.mockResolvedValue(null);
      expect((await service.windowState('c-1')).open).toBe(false);
    });
  });

  describe('sendCollectionStep (motor de secuencias)', () => {
    const step = { customer, invoice, templateName: 'vence_3_dias', freeText: 'texto libre', locale: 'es-MX' };

    it('ventana cerrada → manda la PLANTILLA del nivel con sus variables en orden', async () => {
      const r = await service.sendCollectionStep(step);
      expect(r).toEqual({ sent: true, kind: 'TEMPLATE' });
      const [phone, name, lang, params] = whatsapp.sendTemplate.mock.calls[0];
      expect(phone).toBe('+5215512345678');
      expect(name).toBe('vence_3_dias');
      expect(lang).toBe('es_MX');
      expect(params).toEqual(['Patricia Salas', 'F-2841', '$284,500.00 MXN', '17 de octubre', 'https://app/portal-cliente/tok']);
      expect(whatsapp.sendMessage).not.toHaveBeenCalled();
      // queda en el hilo con el texto que verá el cliente
      expect(prisma.whatsappMessage.create.mock.calls[0][0].data.body).toContain('vence en 3 días, el 17 de octubre');
    });

    it('ventana abierta → texto libre por el mismo número al que escribió el cliente', async () => {
      clienteEscribio(2, 'PN-9');
      const r = await service.sendCollectionStep(step);
      expect(r.kind).toBe('TEXT');
      expect(whatsapp.sendMessage).toHaveBeenCalledWith('+5215512345678', 'texto libre', 'PN-9', expect.anything());
      expect(whatsapp.sendTemplate).not.toHaveBeenCalled();
    });

    it('prefiere el teléfono de Finanzas/Tesorería (FR-02)', async () => {
      await service.sendCollectionStep({ ...step, customer: { ...customer, financeContactPhone: '+5213311112222', financeContactName: 'Tesorería' } });
      const [phone, , , params] = whatsapp.sendTemplate.mock.calls[0];
      expect(phone).toBe('+5213311112222');
      expect(params[0]).toBe('Tesorería');
    });
  });

  describe('sendFreeText (respuesta revisada por una persona)', () => {
    it('rechaza si la ventana está cerrada', async () => {
      await expect(service.sendFreeText(user, 'c-1', 'Hola')).rejects.toBeInstanceOf(ConflictException);
      expect(whatsapp.sendMessage).not.toHaveBeenCalled();
    });

    it('rechaza palabras no permitidas aunque la ventana esté abierta', async () => {
      clienteEscribio(1);
      await expect(service.sendFreeText(user, 'c-1', 'Su deuda sigue pendiente')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('envía dentro de la ventana y lo registra con quién lo mandó', async () => {
      clienteEscribio(1, 'PN-1');
      const r = await service.sendFreeText(user, 'c-1', 'Con gusto, le compartimos el PDF.');
      expect(r.sent).toBe(true);
      expect(prisma.whatsappMessage.create.mock.calls[0][0].data).toEqual(
        expect.objectContaining({ direction: 'OUTBOUND', kind: 'TEXT', sentByUserId: 'u-1' }),
      );
    });
  });

  describe('draftReply', () => {
    it('no redacta con la ventana cerrada', async () => {
      await expect(service.draftReply(user, 'c-1')).rejects.toBeInstanceOf(ConflictException);
      expect(gemini.generateJson).not.toHaveBeenCalled();
    });

    it('sin IA disponible regresa un borrador seguro (nunca envía)', async () => {
      clienteEscribio(1);
      gemini.generateJson.mockResolvedValue(null);
      const r = await service.draftReply(user, 'c-1');
      expect(r.source).toBe('fallback');
      expect(r.draft).toContain('Patricia Salas');
      expect(whatsapp.sendMessage).not.toHaveBeenCalled();
    });
  });

  it('recordInbound es idempotente ante reintentos de Meta', async () => {
    prisma.whatsappMessage.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'x' }),
    );
    const r = await service.recordInbound({
      organizationId: 'org-1', customerId: 'c-1', invoiceId: null, kind: 'TEXT', body: 'hola', waMessageId: 'wamid.1', phoneNumberId: null,
    });
    expect(r).toBeNull();
  });

  describe('plan del cliente ↔ WhatsApp', () => {
    const politica = { id: 'pol-1', sequenceSteps: [{ stepOrder: 3, whatsappTemplateName: 'recordatorio_cortesia_pago' }] };

    it('mandar la plantilla de un nivel a mano adelanta al motor a ese nivel (no la repite)', async () => {
      prisma.collectionPolicy.findFirst.mockResolvedValue(politica);
      prisma.collectionSequenceRun.findUnique.mockResolvedValue({ id: 'run-1', currentStepOrder: 1 });
      await service.sendTemplateManual(user, 'c-1', 'inv-1', 'recordatorio_cortesia_pago');
      expect(prisma.collectionSequenceRun.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ currentStepOrder: 3 }) }),
      );
    });

    it('nunca hace retroceder al motor', async () => {
      prisma.collectionPolicy.findFirst.mockResolvedValue(politica);
      prisma.collectionSequenceRun.findUnique.mockResolvedValue({ id: 'run-1', currentStepOrder: 5 });
      await service.sendTemplateManual(user, 'c-1', 'inv-1', 'recordatorio_cortesia_pago');
      expect(prisma.collectionSequenceRun.update).not.toHaveBeenCalled();
    });

    it('el motor no reenvía un nivel que ya salió para esa factura', async () => {
      prisma.whatsappMessage.findFirst.mockImplementation(({ where }: { where: { direction: string } }) =>
        where.direction === 'OUTBOUND' ? { id: 'm-previo' } : null,
      );
      const r = await service.sendCollectionStep({ customer, invoice, templateName: 'vence_3_dias', freeText: 'x', locale: 'es-MX' });
      expect(r.sent).toBe(true);
      expect(whatsapp.sendTemplate).not.toHaveBeenCalled();
    });

    it('un mensaje libre a nombre de un nivel cuenta como el contacto de ese nivel', async () => {
      clienteEscribio(1, 'PN-1');
      await service.sendFreeText(user, 'c-1', 'Con gusto le compartimos la liga.', 'vence_hoy');
      expect(prisma.whatsappMessage.create.mock.calls[0][0].data.templateName).toBe('vence_hoy');
    });

    it('planActivity: cada nivel con su envío y la primera respuesta del cliente', async () => {
      prisma.whatsappMessage.findMany.mockResolvedValue([
        { customerId: 'c-1', direction: 'OUTBOUND', kind: 'TEMPLATE', templateName: 'aviso_preventivo_pago', body: 't1', sent: true, sentByUserId: null, createdAt: hoursAgo(300) },
        { customerId: 'c-1', direction: 'OUTBOUND', kind: 'TEMPLATE', templateName: 'recordatorio_cortesia_pago', body: 't2', sent: true, sentByUserId: 'u-1', createdAt: hoursAgo(50) },
        { customerId: 'c-1', direction: 'INBOUND', kind: 'BUTTON', templateName: null, body: 'Todo claro', sent: true, sentByUserId: null, createdAt: hoursAgo(49) },
        { customerId: 'c-1', direction: 'INBOUND', kind: 'TEXT', templateName: null, body: 'gracias', sent: true, sentByUserId: null, createdAt: hoursAgo(48) },
      ]);
      const r = await service.planActivity(user);
      const niveles = r.customers[0].levels;
      expect(niveles.aviso_preventivo_pago.reply).toBeNull();
      expect(niveles.aviso_preventivo_pago.by).toBe('automatico');
      expect(niveles.recordatorio_cortesia_pago.by).toBe('manual');
      expect(niveles.recordatorio_cortesia_pago.reply).toEqual(expect.objectContaining({ kind: 'BUTTON', body: 'Todo claro' }));
    });

    it('con Meta configurado, un envío rechazado NO avanza el plan; en modo prueba sí cuenta', async () => {
      const fallido = [{ customerId: 'c-1', direction: 'OUTBOUND', kind: 'TEMPLATE', templateName: 'vence_hoy', body: 't', sent: false, sentByUserId: 'u-1', createdAt: hoursAgo(1) }];
      prisma.whatsappMessage.findMany.mockResolvedValue(fallido);
      expect((await service.planActivity(user)).customers[0].levels.vence_hoy).toBeUndefined();
      whatsapp.isConfigured = false;
      const prueba = await service.planActivity(user);
      expect(prueba.testMode).toBe(true);
      expect(prueba.customers[0].levels.vence_hoy).toBeDefined();
    });
  });

  describe('templatesWithStatus (pestaña Plantillas)', () => {
    const conConfig = (vals: Record<string, string>) =>
      new WhatsappConversationService(
        prisma as unknown as PrismaService,
        whatsapp as unknown as WhatsappService,
        gemini as unknown as GeminiService,
        {} as unknown as CustomerPortalService,
        { get: (k: string) => vals[k] ?? '' } as unknown as ConfigService<Env, true>,
      );
    afterEach(() => jest.restoreAllMocks());

    it('sin token/WABA no inventa estados: las 7 plantillas sin estado', async () => {
      const r = await conConfig({}).templatesWithStatus();
      expect(r.metaConectado).toBe(false);
      expect(r.templates).toHaveLength(7);
      expect(r.templates.every((t) => t.metaStatus === null)).toBe(true);
    });

    it('con Meta: estado real por nombre (es_MX) y MISSING si no existe', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            { name: 'vence_hoy', status: 'APPROVED', language: 'es_MX' },
            { name: 'aviso_vencida', status: 'REJECTED', language: 'es_MX', rejected_reason: 'INVALID_FORMAT' },
            { name: 'vence_3_dias', status: 'APPROVED', language: 'en_US' },
          ],
        }),
      } as Response);
      const r = await conConfig({ WHATSAPP_TOKEN: 't', WHATSAPP_WABA_ID: 'w' }).templatesWithStatus();
      const por = Object.fromEntries(r.templates.map((t) => [t.name, t]));
      expect(r.metaConectado).toBe(true);
      expect(por.vence_hoy.metaStatus).toBe('APPROVED');
      expect(por.aviso_vencida.metaStatus).toBe('REJECTED');
      expect(por.aviso_vencida.rejectedReason).toBe('INVALID_FORMAT');
      expect(por.vence_3_dias.metaStatus).toBe('MISSING'); // existe, pero no en es_MX
    });
  });
});
