import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InvoiceStatus } from '@prisma/client';
import { InvoicesService } from './invoices.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

const user: AuthenticatedUser = {
  id: 'user-1',
  firebaseUid: 'fb-1',
  email: 'admin@royaltica.com',
  role: 'CORPORATE_ADMIN',
  organizationId: 'org-1',
  permissions: ['*'],
  supplierId: null,
};

const baseInvoice = {
  id: 'inv-1',
  organizationId: 'org-1',
  supplierId: 'sup-1',
  cfdiUuid: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  rfcEmisor: 'LAN180423QF1',
  rfcReceptor: 'ROY200101AAA',
  subtotal: 1000,
  iva: 160,
  total: 1160,
  status: InvoiceStatus.PENDING,
  signatures: 0,
};

describe('InvoicesService', () => {
  let service: InvoicesService;
  let prisma: {
    supplier: { findFirst: jest.Mock };
    invoice: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    invoiceAuditLog: { create: jest.Mock; findFirst: jest.Mock };
    $transaction: jest.Mock;
    withOrg: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      supplier: { findFirst: jest.fn() },
      invoice: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      invoiceAuditLog: { create: jest.fn(), findFirst: jest.fn() },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
      withOrg: jest.fn(),
    };
    // withOrg simula la transacción con RLS corriendo el callback con el
    // mismo objeto prisma mockeado como `tx`.
    prisma.withOrg.mockImplementation((_orgId: string, fn: (tx: unknown) => unknown) =>
      fn(prisma),
    );
    const settings = {
      get: jest.fn().mockResolvedValue({ requiredSignatures: 2 }),
    };
    const webhooks = { dispatch: jest.fn().mockResolvedValue(undefined) };
    service = new InvoicesService(
      prisma as unknown as PrismaService,
      settings as unknown as SettingsService,
      webhooks as unknown as WebhooksService,
    );
  });

  const dto = {
    supplierId: 'sup-1',
    cfdiUuid: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    rfcEmisor: 'lan180423qf1',
    rfcReceptor: 'roy200101aaa',
    subtotal: 1000,
    iva: 160,
    total: 1160,
    date: '2026-06-01T00:00:00.000Z',
  };

  it('crea una factura normalizando RFC a mayúsculas y Decimal→number', async () => {
    prisma.supplier.findFirst.mockResolvedValue({ id: 'sup-1' });
    prisma.invoice.findUnique.mockResolvedValue(null);
    prisma.invoice.create.mockResolvedValue({ ...baseInvoice });
    prisma.invoiceAuditLog.create.mockResolvedValue({});

    const result = await service.create(user, dto);

    expect(prisma.invoice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          rfcEmisor: 'LAN180423QF1',
          rfcReceptor: 'ROY200101AAA',
          organizationId: 'org-1',
        }),
      }),
    );
    expect(typeof result.total).toBe('number');
  });

  it('rechaza CFDI UUID duplicado', async () => {
    prisma.supplier.findFirst.mockResolvedValue({ id: 'sup-1' });
    prisma.invoice.findUnique.mockResolvedValue({ id: 'other' });
    await expect(service.create(user, dto)).rejects.toThrow(ConflictException);
  });

  it('rechaza factura con proveedor inexistente', async () => {
    prisma.supplier.findFirst.mockResolvedValue(null);
    await expect(service.create(user, dto)).rejects.toThrow(NotFoundException);
  });

  it('primera firma deja la factura en AUDITED sin aprobar', async () => {
    prisma.invoice.findFirst.mockResolvedValue({
      ...baseInvoice,
      status: InvoiceStatus.AUDITED,
      signatures: 0,
    });
    prisma.invoiceAuditLog.findFirst.mockResolvedValue(null);
    prisma.invoice.update.mockResolvedValue({
      ...baseInvoice,
      status: InvoiceStatus.AUDITED,
      signatures: 1,
    });
    prisma.invoiceAuditLog.create.mockResolvedValue({});

    const result = await service.sign(user, 'inv-1');
    expect(result.approved).toBe(false);
    expect(result.status).toBe(InvoiceStatus.AUDITED);
  });

  it('segunda firma promueve a APPROVED', async () => {
    prisma.invoice.findFirst.mockResolvedValue({
      ...baseInvoice,
      status: InvoiceStatus.AUDITED,
      signatures: 1,
    });
    prisma.invoiceAuditLog.findFirst.mockResolvedValue(null);
    prisma.invoice.update.mockResolvedValue({
      ...baseInvoice,
      status: InvoiceStatus.APPROVED,
      signatures: 2,
    });
    prisma.invoiceAuditLog.create.mockResolvedValue({});

    const result = await service.sign(user, 'inv-1');
    expect(result.approved).toBe(true);
    expect(result.status).toBe(InvoiceStatus.APPROVED);
  });

  it('impide que el mismo usuario firme dos veces', async () => {
    prisma.invoice.findFirst.mockResolvedValue({
      ...baseInvoice,
      status: InvoiceStatus.AUDITED,
      signatures: 1,
    });
    prisma.invoiceAuditLog.findFirst.mockResolvedValue({ id: 'log-1' });
    await expect(service.sign(user, 'inv-1')).rejects.toThrow(
      ConflictException,
    );
  });

  it('rechaza transición de estado inválida (PENDING→PAID)', async () => {
    prisma.invoice.findFirst.mockResolvedValue({ ...baseInvoice });
    await expect(
      service.updateStatus(user, 'inv-1', InvoiceStatus.PAID),
    ).rejects.toThrow(BadRequestException);
  });

  it('rechaza aprobar sin las 2 firmas requeridas', async () => {
    prisma.invoice.findFirst.mockResolvedValue({
      ...baseInvoice,
      status: InvoiceStatus.AUDITED,
      signatures: 0,
    });
    await expect(
      service.updateStatus(user, 'inv-1', InvoiceStatus.APPROVED),
    ).rejects.toThrow(ConflictException);
  });

  it('solo permite eliminar facturas PENDING', async () => {
    prisma.invoice.findFirst.mockResolvedValue({
      ...baseInvoice,
      status: InvoiceStatus.AUDITED,
    });
    await expect(service.remove(user, 'inv-1')).rejects.toThrow(
      ConflictException,
    );
  });
});
