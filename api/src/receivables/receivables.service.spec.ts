import { BadRequestException, ConflictException } from '@nestjs/common';
import { InvoiceStatus } from '@prisma/client';
import { ReceivablesService } from './receivables.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { CustomerPortalService } from '../customer-portal/customer-portal.service';
import { SettingsService } from '../settings/settings.service';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

const user: AuthenticatedUser = {
  id: 'u-1',
  firebaseUid: 'fb-1',
  email: 'user@royaltica.com',
  role: 'CORPORATE_ADMIN',
  organizationId: 'org-1',
  permissions: ['*'],
  supplierId: null,
  operationalProfile: null,
};

describe('ReceivablesService', () => {
  let service: ReceivablesService;
  let prisma: {
    customer: { findFirst: jest.Mock; findMany: jest.Mock; update: jest.Mock };
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
  let email: { sendCollectionReminder: jest.Mock; sendServiceMessage: jest.Mock };
  let whatsapp: { sendMessage: jest.Mock; sendForOrg: jest.Mock };
  let webhooks: { dispatch: jest.Mock };
  let customerPortal: { issuePortalLink: jest.Mock };
  let settings: { get: jest.Mock };

  beforeEach(() => {
    prisma = {
      customer: { findFirst: jest.fn(), findMany: jest.fn(), update: jest.fn() },
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
    email = {
      sendCollectionReminder: jest.fn().mockResolvedValue({ sent: true }),
      sendServiceMessage: jest.fn().mockResolvedValue({ sent: true }),
    };
    whatsapp = {
      sendMessage: jest.fn().mockResolvedValue({ sent: true }),
      sendForOrg: jest.fn().mockResolvedValue({ sent: true }),
    };
    webhooks = { dispatch: jest.fn().mockResolvedValue(undefined) };
    customerPortal = {
      issuePortalLink: jest.fn().mockResolvedValue('https://app.royaltica.com/portal-cliente/tok123'),
    };
    settings = {
      get: jest.fn().mockResolvedValue({
        receivingBankName: null,
        receivingClabe: null,
      }),
    };
    service = new ReceivablesService(
      prisma as unknown as PrismaService,
      email as unknown as EmailService,
      whatsapp as unknown as WhatsappService,
      webhooks as unknown as WebhooksService,
      customerPortal as unknown as CustomerPortalService,
      settings as unknown as SettingsService,
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

  it('rechaza un cfdiUuid con formato inválido para una organización mexicana (currency MXN)', async () => {
    prisma.organization.findUnique.mockResolvedValue({ rfc: 'RDE240101AA1', currency: 'MXN' });

    await expect(
      service.create(user, {
        customerId: 'c-1',
        cfdiUuid: 'no-es-un-uuid-valido',
        subtotal: 100,
        iva: 16,
        total: 116,
        date: '2026-07-01',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.invoice.create).not.toHaveBeenCalled();
  });

  describe('organización no mexicana (ej. Canadá, currency CAD)', () => {
    beforeEach(() => {
      prisma.organization.findUnique.mockResolvedValue({
        rfc: 'CA-BN-000000001',
        currency: 'CAD',
      });
    });

    it('genera un cfdiUuid sintético si no viene en el DTO (Canadá no tiene CFDI)', async () => {
      prisma.invoice.findUnique.mockResolvedValue(null);
      prisma.customer.findFirst.mockResolvedValue({ id: 'c-1', rfc: 'CA-BN-123456789' });
      prisma.invoice.create.mockImplementation(({ data }) => ({
        id: 'inv-1',
        status: InvoiceStatus.PENDING,
        ...data,
      }));

      await service.create(user, {
        customerId: 'c-1',
        // sin cfdiUuid
        subtotal: 100,
        iva: 13,
        total: 113,
        date: '2026-07-01',
      });

      const createCall = prisma.invoice.create.mock.calls[0][0];
      expect(createCall.data.cfdiUuid).toMatch(/^EXT-org-1-/);
      expect(createCall.data.currency).toBe('CAD');
    });

    it('acepta un identificador fiscal no-RFC (Business Number) en rfcEmisor/rfcReceptor sin rechazarlo', async () => {
      prisma.invoice.findUnique.mockResolvedValue(null);
      prisma.customer.findFirst.mockResolvedValue({ id: 'c-1', rfc: 'CA-BN-123456789' });
      prisma.invoice.create.mockImplementation(({ data }) => ({
        id: 'inv-1',
        status: InvoiceStatus.PENDING,
        ...data,
      }));

      const result = await service.create(user, {
        customerId: 'c-1',
        cfdiUuid: 'factura-externa-001',
        rfcEmisor: 'CA-BN-000000001',
        rfcReceptor: 'CA-BN-123456789',
        subtotal: 100,
        iva: 13,
        total: 113,
        date: '2026-07-01',
      });

      expect(result).toBeDefined();
      expect(prisma.invoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            cfdiUuid: 'factura-externa-001',
            rfcEmisor: 'CA-BN-000000001',
            rfcReceptor: 'CA-BN-123456789',
            currency: 'CAD',
          }),
        }),
      );
    });
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

    expect(whatsapp.sendForOrg).toHaveBeenCalled();
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
    expect(whatsapp.sendForOrg).not.toHaveBeenCalled();
  });

  it('sendReminder (T-3) incluye la liga de pago y los datos bancarios en WhatsApp y correo', async () => {
    settings.get.mockResolvedValue({
      receivingBankName: 'BBVA',
      receivingClabe: '012345678901234567',
    });
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

    await service.sendReminder(user, 'inv-1');

    expect(customerPortal.issuePortalLink).toHaveBeenCalledWith('c-1');
    expect(whatsapp.sendForOrg).toHaveBeenCalledWith(
      'org-1',
      '+5215512345678',
      expect.stringContaining('tok123'),
    );
    expect(whatsapp.sendForOrg).toHaveBeenCalledWith(
      'org-1',
      '+5215512345678',
      expect.stringContaining('012345678901234567'),
    );
    expect(email.sendCollectionReminder).toHaveBeenCalledWith(
      'a@b.mx',
      'Cliente',
      'F-1',
      expect.any(String),
      expect.any(String),
      'org-1',
      'MXN',
      {
        paymentLink: 'https://app.royaltica.com/portal-cliente/tok123',
        bankName: 'BBVA',
        clabe: '012345678901234567',
      },
    );
  });

  it('runReminderScan("T14") consulta facturas que vencen en 13-15 días y manda un recordatorio sin liga de pago', async () => {
    prisma.invoice.findMany = jest.fn().mockResolvedValue([
      {
        id: 'inv-2',
        organizationId: 'org-1',
        total: 300,
        folio: 'F-2',
        cfdiUuid: 'abcd1234-0000-0000-0000-000000000001',
        date: new Date('2026-07-01'),
        dueDate: new Date('2026-07-15'),
        customer: { id: 'c-2', name: 'Cliente 2', email: 'c2@b.mx', phone: null },
      },
    ]);
    prisma.invoice.update.mockResolvedValue({});

    const res = await service.runReminderScan('T14');

    expect(prisma.invoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          dueDate: { gte: expect.any(Date), lte: expect.any(Date) },
        }),
      }),
    );
    expect(customerPortal.issuePortalLink).not.toHaveBeenCalled();
    expect(email.sendCollectionReminder).toHaveBeenCalledWith(
      'c2@b.mx',
      'Cliente 2',
      'F-2',
      expect.any(String),
      expect.any(String),
      'org-1',
      'MXN',
      {},
    );
    expect(res).toEqual({ sent: 1 });
  });

  it('runServiceMessageScan (FR-06) manda el mensaje de mantenimiento a buenos pagadores sin mencionar deuda', async () => {
    prisma.customer.findMany.mockResolvedValue([
      {
        id: 'c-3',
        organizationId: 'org-1',
        name: 'Buen Pagador SA',
        email: 'buen@pagador.mx',
        phone: '+5215599999999',
        score: 98,
        financeContactName: null,
        financeContactEmail: null,
        financeContactPhone: null,
      },
    ]);
    prisma.customer.update.mockResolvedValue({});

    const res = await service.runServiceMessageScan();

    expect(prisma.customer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ score: { gt: 95 } }),
      }),
    );
    expect(whatsapp.sendForOrg).toHaveBeenCalledWith(
      'org-1',
      '+5215599999999',
      expect.not.stringContaining('deuda'),
    );
    expect(email.sendServiceMessage).toHaveBeenCalledWith(
      'buen@pagador.mx',
      'Buen Pagador SA',
      'org-1',
    );
    expect(prisma.customer.update).toHaveBeenCalledWith({
      where: { id: 'c-3' },
      data: { lastServiceMessageAt: expect.any(Date) },
    });
    expect(res).toEqual({ sent: 1 });
  });
});
