import { ForbiddenException } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { WhatsappWebhookService } from './whatsapp-webhook.service';
import type { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma/prisma.service';
import { WhatsappService } from './whatsapp.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailService } from '../email/email.service';
import type { Env } from '../config/env.validation';

const makeConfig = (vals: Record<string, string>) =>
  ({ get: (k: string) => vals[k] ?? '' }) as unknown as ConfigService<Env, true>;

const metaPayload = (from: string, body: string) => ({
  entry: [
    {
      changes: [
        {
          value: {
            contacts: [{ profile: { name: 'Contacto' }, wa_id: from }],
            messages: [
              { from, id: 'wamid.X', type: 'text', text: { body } },
            ],
          },
        },
      ],
    },
  ],
});

describe('WhatsappWebhookService', () => {
  let prisma: {
    customer: { findMany: jest.Mock };
    invoice: { findFirst: jest.Mock };
    invoiceAuditLog: { create: jest.Mock };
  };
  let whatsapp: { notifyOrgAdmins: jest.Mock };
  let notifications: { notifyOrgAdmins: jest.Mock };
  let email: Record<string, jest.Mock>;

  const build = (env: Record<string, string> = {}) => {
    prisma = {
      customer: { findMany: jest.fn().mockResolvedValue([]) },
      invoice: { findFirst: jest.fn().mockResolvedValue(null) },
      invoiceAuditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    whatsapp = { notifyOrgAdmins: jest.fn().mockResolvedValue({ recipients: 1, sent: 0 }) };
    notifications = { notifyOrgAdmins: jest.fn().mockResolvedValue(1) };
    email = {};
    return new WhatsappWebhookService(
      makeConfig(env),
      prisma as unknown as PrismaService,
      whatsapp as unknown as WhatsappService,
      notifications as unknown as NotificationsService,
      email as unknown as EmailService,
    );
  };

  describe('verifyChallenge', () => {
    it('devuelve el challenge cuando el token coincide', () => {
      const svc = build({ WHATSAPP_VERIFY_TOKEN: 'secreto' });
      expect(svc.verifyChallenge('subscribe', 'secreto', '12345')).toBe('12345');
    });
    it('rechaza token inválido', () => {
      const svc = build({ WHATSAPP_VERIFY_TOKEN: 'secreto' });
      expect(() => svc.verifyChallenge('subscribe', 'malo', '12345')).toThrow(
        ForbiddenException,
      );
    });
    it('rechaza si no hay verify token configurado', () => {
      const svc = build({});
      expect(() => svc.verifyChallenge('subscribe', '', 'x')).toThrow(
        ForbiddenException,
      );
    });
  });

  describe('verifySignature', () => {
    it('sin app secret acepta (modo desarrollo)', () => {
      const svc = build({});
      expect(svc.verifySignature(Buffer.from('{}'), undefined)).toBe(true);
    });
    it('valida HMAC-SHA256 correctamente', () => {
      const svc = build({ WHATSAPP_APP_SECRET: 'shh' });
      const raw = Buffer.from('{"a":1}');
      const sig =
        'sha256=' + createHmac('sha256', 'shh').update(raw).digest('hex');
      expect(svc.verifySignature(raw, sig)).toBe(true);
      expect(svc.verifySignature(raw, 'sha256=deadbeef')).toBe(false);
    });
  });

  describe('classifyIntent', () => {
    it('detecta afirmación de pago (con acentos)', () => {
      const svc = build();
      expect(svc.classifyIntent('Hola, ya pagué la factura').intent).toBe(
        'PAYMENT_CLAIMED',
      );
      expect(svc.classifyIntent('Hice la transferencia hoy').intent).toBe(
        'PAYMENT_CLAIMED',
      );
    });
    it('una negación NO se clasifica como pago', () => {
      const svc = build();
      expect(svc.classifyIntent('Aún no he pagado, la próxima semana').intent).toBe(
        'CUSTOMER_REPLY',
      );
    });
    it('mensaje neutro es respuesta de cliente', () => {
      const svc = build();
      expect(svc.classifyIntent('¿Me pueden reenviar el PDF?').intent).toBe(
        'CUSTOMER_REPLY',
      );
    });
  });

  describe('handleIncoming', () => {
    it('empata cliente por últimos 10 dígitos, registra PAYMENT_CLAIMED y avisa al director', async () => {
      const svc = build();
      prisma.customer.findMany.mockResolvedValue([
        { id: 'c-1', name: 'ACME', organizationId: 'org-1', phone: '+52 155 1234 5678' },
      ]);
      prisma.invoice.findFirst.mockResolvedValue({
        id: 'inv-1',
        folio: 'VENTA-777',
        cfdiUuid: 'aaaaaaaa-1111-2222-3333-444444444444',
        total: { toString: () => '1000' },
      });

      const res = await svc.handleIncoming(
        metaPayload('5215512345678', 'Ya pagué la factura'),
      );

      expect(res.processed).toBe(1);
      // Se registró el aviso en el log inmutable con la acción correcta.
      const logArg = prisma.invoiceAuditLog.create.mock.calls[0][0].data;
      expect(logArg.invoiceId).toBe('inv-1');
      expect(logArg.action).toBe('PAYMENT_CLAIMED');
      // Se avisó al director (in-app) de la org del cliente.
      expect(notifications.notifyOrgAdmins).toHaveBeenCalledWith(
        'org-1',
        expect.objectContaining({ type: 'RECEIVABLE_PAYMENT_CLAIMED' }),
      );
      expect(whatsapp.notifyOrgAdmins).toHaveBeenCalled();
    });

    it('ignora mensajes de teléfonos sin cliente asociado', async () => {
      const svc = build();
      prisma.customer.findMany.mockResolvedValue([]);
      const res = await svc.handleIncoming(
        metaPayload('5219999999999', 'hola'),
      );
      expect(res.processed).toBe(1); // procesado (sin error), pero sin efectos
      expect(prisma.invoiceAuditLog.create).not.toHaveBeenCalled();
      expect(notifications.notifyOrgAdmins).not.toHaveBeenCalled();
    });
  });
});
