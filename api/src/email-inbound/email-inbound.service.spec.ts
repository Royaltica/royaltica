import { createHmac } from 'node:crypto';
import type { ConfigService } from '@nestjs/config';
import { EmailInboundService } from './email-inbound.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import type { Env } from '../config/env.validation';

const makeConfig = (vals: Record<string, string>) =>
  ({ get: (k: string) => vals[k] ?? '' }) as unknown as ConfigService<Env, true>;

const CUSTOMER = {
  id: 'cus-1',
  name: 'Distribuidora Demo',
  organizationId: 'org-1',
};

const INVOICE = {
  id: 'inv-1',
  folio: 'F-123',
  cfdiUuid: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  total: 15000,
  status: 'PENDING',
};

const payload = (from: string, text: string, subject = 'Re: Recordatorio de pago · factura F-123') => ({
  data: { from, subject, text, message_id: 'msg-1' },
});

describe('EmailInboundService', () => {
  let prisma: {
    customer: { findFirst: jest.Mock };
    invoice: { findFirst: jest.Mock; update: jest.Mock };
    invoiceAuditLog: { create: jest.Mock };
    user: { findMany: jest.Mock };
  };
  let notifications: { createMany: jest.Mock };
  let whatsapp: { notifyOrgAdmins: jest.Mock };

  const build = (env: Record<string, string> = {}) => {
    prisma = {
      customer: { findFirst: jest.fn().mockResolvedValue(CUSTOMER) },
      invoice: {
        findFirst: jest.fn().mockResolvedValue(INVOICE),
        update: jest.fn().mockResolvedValue({}),
      },
      invoiceAuditLog: { create: jest.fn().mockResolvedValue({}) },
      user: {
        findMany: jest.fn().mockResolvedValue([{ id: 'u-1' }, { id: 'u-2' }]),
      },
    };
    notifications = { createMany: jest.fn().mockResolvedValue(2) };
    whatsapp = {
      notifyOrgAdmins: jest.fn().mockResolvedValue({ recipients: 1, sent: 0 }),
    };
    return new EmailInboundService(
      makeConfig(env),
      prisma as unknown as PrismaService,
      notifications as unknown as NotificationsService,
      whatsapp as unknown as WhatsappService,
    );
  };

  describe('verifySignature', () => {
    it('acepta con advertencia si no hay secreto configurado (desarrollo)', () => {
      const svc = build();
      expect(svc.verifySignature(Buffer.from('{}'), {})).toBe(true);
    });

    it('valida una firma HMAC correcta', () => {
      const svc = build({ EMAIL_INBOUND_SECRET: 's3cr3t' });
      const body = Buffer.from('{"a":1}');
      const sig = createHmac('sha256', 's3cr3t').update(body).digest('hex');
      expect(svc.verifySignature(body, { signature: sig })).toBe(true);
      expect(svc.verifySignature(body, { signature: `sha256=${sig}` })).toBe(true);
    });

    it('rechaza una firma incorrecta', () => {
      const svc = build({ EMAIL_INBOUND_SECRET: 's3cr3t' });
      const body = Buffer.from('{"a":1}');
      expect(svc.verifySignature(body, { signature: 'deadbeef' })).toBe(false);
    });

    it('rechaza cuando falta la firma pero hay secreto', () => {
      const svc = build({ EMAIL_INBOUND_SECRET: 's3cr3t' });
      expect(svc.verifySignature(Buffer.from('{}'), {})).toBe(false);
    });

    it('valida la firma estilo Svix (Resend)', () => {
      const secretB64 = Buffer.from('svix-secret').toString('base64');
      const svc = build({ EMAIL_INBOUND_SECRET: `whsec_${secretB64}` });
      const body = Buffer.from('{"hola":true}');
      const svixId = 'msg_123';
      const svixTimestamp = '1700000000';
      const signed = `${svixId}.${svixTimestamp}.${body.toString('utf8')}`;
      const expected = createHmac('sha256', Buffer.from(secretB64, 'base64'))
        .update(signed)
        .digest('base64');
      expect(
        svc.verifySignature(body, {
          svixId,
          svixTimestamp,
          svixSignature: `v1,${expected}`,
        }),
      ).toBe(true);
    });
  });

  describe('handleIncoming', () => {
    it('registra un reclamo de pago SIN marcar la factura como pagada', async () => {
      const svc = build();
      const res = await svc.handleIncoming(
        payload('cliente@demo.mx', 'Ya pagué la factura, ahí les va el comprobante'),
      );

      expect(res.processed).toBe(true);
      expect(prisma.invoiceAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            invoiceId: 'inv-1',
            action: 'PAYMENT_CLAIMED',
          }),
        }),
      );
      // La garantía central: jamás se toca el estado financiero.
      expect(prisma.invoice.update).not.toHaveBeenCalled();
      expect(notifications.createMany).toHaveBeenCalled();
    });

    it('clasifica como respuesta normal cuando el cliente niega el pago', async () => {
      const svc = build();
      await svc.handleIncoming(
        payload('cliente@demo.mx', 'Todavía no he pagado, me dan chance'),
      );
      expect(prisma.invoiceAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: 'CUSTOMER_REPLY' }),
        }),
      );
      expect(prisma.invoice.update).not.toHaveBeenCalled();
    });

    it('marca escalamiento cuando el cliente menciona a un abogado', async () => {
      const svc = build();
      await svc.handleIncoming(
        payload('cliente@demo.mx', 'Ya deja de escribirme o hablo con mi abogado'),
      );
      expect(prisma.invoiceAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: 'CUSTOMER_ESCALATION' }),
        }),
      );
    });

    it('ignora el correo de alguien que no es cliente', async () => {
      const svc = build();
      prisma.customer.findFirst.mockResolvedValue(null);
      const res = await svc.handleIncoming(payload('random@internet.com', 'hola'));
      expect(res.processed).toBe(false);
      expect(res.reason).toBe('cliente-no-encontrado');
      expect(prisma.invoiceAuditLog.create).not.toHaveBeenCalled();
    });

    it('NO se deja engañar por el texto citado del recordatorio original', async () => {
      const svc = build();
      // El cliente niega el pago, pero abajo viene citado NUESTRO correo,
      // que sí menciona el pago. Debe ganar lo que escribió el cliente.
      const body = [
        'Todavía no puedo, la próxima semana.',
        '',
        'El vie, 8 ago 2026, Royáltica escribió:',
        '> Si ya realizaste el pago, ignora este mensaje.',
        '> Ya pagué / pagado / transferencia',
      ].join('\n');
      await svc.handleIncoming(payload('cliente@demo.mx', body));
      expect(prisma.invoiceAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: 'CUSTOMER_REPLY' }),
        }),
      );
    });

    it('notifica también a SUPERADMIN, no solo a CORPORATE_ADMIN', async () => {
      const svc = build();
      await svc.handleIncoming(payload('cliente@demo.mx', 'ya pagué'));
      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            role: { in: ['CORPORATE_ADMIN', 'SUPERADMIN'] },
          }),
        }),
      );
    });

    it('no lanza ante un payload basura', async () => {
      const svc = build();
      await expect(svc.handleIncoming({ nada: true })).resolves.toEqual({
        processed: false,
        reason: 'payload-no-reconocido',
      });
    });
  });
});
