import { BadRequestException, ConflictException } from '@nestjs/common';
import { InvoiceStatus } from '@prisma/client';
import { ReceivablesService } from './receivables.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

const user: AuthenticatedUser = {
  id: 'u-1',
  firebaseUid: 'fb-1',
  email: 'user@royaltica.com',
  role: 'CORPORATE_ADMIN',
  organizationId: 'org-1',
  permissions: ['*'],
  supplierId: null,
};

describe('ReceivablesService', () => {
  let service: ReceivablesService;
  let prisma: {
    customer: { findFirst: jest.Mock };
    organization: { findUnique: jest.Mock };
    invoice: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    invoiceAuditLog: { create: jest.Mock };
    withOrg: jest.Mock;
  };
  let email: { sendCollectionReminder: jest.Mock };
  let whatsapp: { sendMessage: jest.Mock };
  let webhooks: { dispatch: jest.Mock };

  beforeEach(() => {
    prisma = {
      customer: { findFirst: jest.fn() },
      organization: {
        findUnique: jest.fn().mockResolvedValue({ rfc: 'RDE240101AA1' }),
      },
      invoice: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      invoiceAuditLog: { create: jest.fn() },
      withOrg: jest.fn(),
    };
    // withOrg simula la transacción con RLS: en el mock, simplemente corre
    // el callback pasándole el mismo objeto prisma mockeado como `tx`.
    prisma.withOrg.mockImplementation((_orgId: string, fn: (tx: unknown) => unknown) =>
      fn(prisma),
    );
    email = { sendCollectionReminder: jest.fn().mockResolvedValue({ sent: true }) };
    whatsapp = { sendMessage: jest.fn().mockResolvedValue({ sent: true }) };
    webhooks = { dispatch: jest.fn().mockResolvedValue(undefined) };
    service = new ReceivablesService(
      prisma as unknown as PrismaService,
      email as unknown as EmailService,
      whatsapp as unknown as WhatsappService,
      webhooks as unknown as WebhooksService,
    );
  });

  it('crea una factura de venta (direction RECEIVABLE) derivando los RFC', async () => {
    prisma.invoice.findUnique.mockResolvedValue(null);
    prisma.customer.findFirst.mockResolvedValue({ id: 'c-1', rfc: 'BBB020202BBB' });
    prisma.invoice.create.mockImplementation(({ data }) => ({
      id: 'inv-1',
      status: InvoiceStatus.PENDING,
      ...data,
    }));

    // Sin rfcEmisor/rfcReceptor: el backend los deriva de la org y el cliente.
    const result = await service.create(user, {
      customerId: 'c-1',
      cfdiUuid: '11111111-1111-1111-1111-111111111111',
      subtotal: 100,
      iva: 16,
      total: 116,
      date: '2026-07-01',
    });

    expect(prisma.invoice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          direction: 'RECEIVABLE',
          customerId: 'c-1',
          rfcEmisor: 'RDE240101AA1',
          rfcReceptor: 'BBB020202BBB',
        }),
      }),
    );
    expect(result.total).toBe(116);
  });

  it('rechaza una transición inválida de estado', async () => {
    prisma.invoice.findFirst.mockResolvedValue({
      id: 'inv-1',
      organizationId: 'org-1',
      status: InvoiceStatus.PAID,
    });
    await expect(
      service.updateStatus(user, 'inv-1', InvoiceStatus.PENDING),
    ).rejects.toThrow(BadRequestException);
  });

  it('marca como PAID y dispara webhook receivable.paid', async () => {
    prisma.invoice.findFirst.mockResolvedValue({
      id: 'inv-1',
      organizationId: 'org-1',
      status: InvoiceStatus.PENDING,
    });
    prisma.invoice.update.mockResolvedValue({
      id: 'inv-1',
      organizationId: 'org-1',
      cfdiUuid: 'u',
      customerId: 'c-1',
      status: InvoiceStatus.PAID,
      subtotal: 100,
      iva: 16,
      total: 116,
    });

    await service.updateStatus(user, 'inv-1', InvoiceStatus.PAID);
    expect(webhooks.dispatch).toHaveBeenCalledWith(
      'org-1',
      'receivable.paid',
      expect.objectContaining({ invoiceId: 'inv-1' }),
    );
  });

  it('sendReminder envía por WhatsApp y correo y marca lastReminderSentAt', async () => {
    prisma.invoice.findFirst.mockResolvedValue({
      id: 'inv-1',
      organizationId: 'org-1',
      status: InvoiceStatus.PENDING,
      total: 500,
      folio: 'F-1',
      cfdiUuid: 'abcd1234-0000-0000-0000-000000000000',
      date: new Date('2026-07-01'),
      dueDate: new Date('2026-07-15'),
      customer: { id: 'c-1', name: 'Cliente', email: 'a@b.mx', phone: '+5215512345678' },
    });
    prisma.invoice.update.mockResolvedValue({});

    const res = await service.sendReminder(user, 'inv-1');

    expect(whatsapp.sendMessage).toHaveBeenCalled();
    expect(email.sendCollectionReminder).toHaveBeenCalled();
    expect(prisma.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { lastReminderSentAt: expect.any(Date) } }),
    );
    expect(res.emailSent).toBe(true);
    expect(res.whatsappSent).toBe(true);
  });

  it('no permite recordatorio de una factura ya cobrada', async () => {
    prisma.invoice.findFirst.mockResolvedValue({
      id: 'inv-1',
      organizationId: 'org-1',
      status: InvoiceStatus.PAID,
      customer: { id: 'c-1', name: 'Cliente', email: null, phone: null },
    });
    await expect(service.sendReminder(user, 'inv-1')).rejects.toThrow(
      ConflictException,
    );
  });

  it('no permite recordatorio a un cliente sin teléfono ni correo', async () => {
    prisma.invoice.findFirst.mockResolvedValue({
      id: 'inv-1',
      organizationId: 'org-1',
      status: InvoiceStatus.PENDING,
      customer: { id: 'c-1', name: 'Cliente', email: null, phone: null },
    });
    await expect(service.sendReminder(user, 'inv-1')).rejects.toThrow(
      ConflictException,
    );
    expect(whatsapp.sendMessage).not.toHaveBeenCalled();
  });
});
