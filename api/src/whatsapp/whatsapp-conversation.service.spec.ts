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
    customer: { findFirst: jest.Mock };
    invoice: { findMany: jest.Mock };
    withOrg: jest.Mock;
  };
  let whatsapp: { sendTemplate: jest.Mock; sendMessage: jest.Mock };
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
      customer: { findFirst: jest.fn().mockResolvedValue(customer) },
      invoice: { findMany: jest.fn().mockResolvedValue([invoice]) },
      withOrg: jest.fn(),
    };
    prisma.withOrg.mockImplementation((_o: string, fn: (tx: unknown) => unknown) => fn(prisma));
    whatsapp = {
      sendTemplate: jest.fn().mockResolvedValue({ sent: true, mode: 'meta', id: 'wamid.T' }),
      sendMessage: jest.fn().mockResolvedValue({ sent: true, mode: 'meta', id: 'wamid.X' }),
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
      prisma.whatsappMessage.findFirst.mockResolvedValue({ createdAt: hoursAgo(3), phoneNumberId: 'PN-1' });
      const w = await service.windowState('c-1');
      expect(w.open).toBe(true);
      expect(w.phoneNumberId).toBe('PN-1');
    });

    it('cerrada si pasaron más de 24h o nunca escribió', async () => {
      prisma.whatsappMessage.findFirst.mockResolvedValue({ createdAt: hoursAgo(25), phoneNumberId: null });
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
      prisma.whatsappMessage.findFirst.mockResolvedValue({ createdAt: hoursAgo(2), phoneNumberId: 'PN-9' });
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
      prisma.whatsappMessage.findFirst.mockResolvedValue({ createdAt: hoursAgo(1), phoneNumberId: null });
      await expect(service.sendFreeText(user, 'c-1', 'Su deuda sigue pendiente')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('envía dentro de la ventana y lo registra con quién lo mandó', async () => {
      prisma.whatsappMessage.findFirst.mockResolvedValue({ createdAt: hoursAgo(1), phoneNumberId: 'PN-1' });
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
      prisma.whatsappMessage.findFirst.mockResolvedValue({ createdAt: hoursAgo(1), phoneNumberId: null });
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
});
