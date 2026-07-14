import { BadRequestException, ConflictException } from '@nestjs/common';
import { InvoiceStatus, PaymentStatus, PaymentType } from '@prisma/client';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { ActivityLogService } from '../activity/activity-log.service';
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

describe('PaymentsService', () => {
  let service: PaymentsService;
  let prisma: {
    invoice: { findMany: jest.Mock; updateMany: jest.Mock };
    payment: {
      create: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      update: jest.Mock;
    };
    $transaction: jest.Mock;
    withOrg: jest.Mock;
  };
  let notifications: { create: jest.Mock; notifyOrgAdmins: jest.Mock };
  let activity: { record: jest.Mock };

  beforeEach(() => {
    prisma = {
      invoice: { findMany: jest.fn(), updateMany: jest.fn() },
      payment: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn((ops: unknown) =>
        Array.isArray(ops) ? Promise.all(ops) : ops,
      ),
      withOrg: jest.fn(),
    };
    // withOrg simula la transacción con RLS corriendo el callback con el
    // mismo objeto prisma mockeado como `tx`.
    prisma.withOrg.mockImplementation((_orgId: string, fn: (tx: unknown) => unknown) =>
      fn(prisma),
    );
    notifications = {
      create: jest.fn().mockResolvedValue({}),
      notifyOrgAdmins: jest.fn().mockResolvedValue(0),
    };
    activity = { record: jest.fn().mockResolvedValue(undefined) };
    const webhooks = { dispatch: jest.fn().mockResolvedValue(undefined) };
    const whatsapp = { notifyOrgAdmins: jest.fn().mockResolvedValue({ recipients: 0, sent: 0 }) };
    service = new PaymentsService(
      prisma as unknown as PrismaService,
      notifications as unknown as NotificationsService,
      whatsapp as unknown as WhatsappService,
      activity as unknown as ActivityLogService,
      webhooks as unknown as WebhooksService,
    );
  });

  it('crea un pago sumando los totales de facturas APROBADAS', async () => {
    prisma.invoice.findMany.mockResolvedValue([
      { id: 'inv-1', total: 1160, status: InvoiceStatus.APPROVED, supplierId: 's1', payments: [] },
      { id: 'inv-2', total: 2320, status: InvoiceStatus.APPROVED, supplierId: 's1', payments: [] },
    ]);
    prisma.payment.create.mockImplementation(({ data }) => ({
      id: 'pay-1',
      ...data,
      totalAmount: data.totalAmount,
    }));

    const result = await service.create(user, {
      invoiceIds: ['inv-1', 'inv-2'],
      route: 'TRANSFER' as never,
    });

    expect(result.totalAmount).toBe(3480);
    expect(prisma.payment.create).toHaveBeenCalled();
    expect(activity.record).toHaveBeenCalled();
  });

  it('rechaza pagar facturas que no están APROBADAS', async () => {
    prisma.invoice.findMany.mockResolvedValue([
      { id: 'inv-1', total: 1160, status: InvoiceStatus.PENDING, supplierId: 's1', payments: [] },
    ]);
    await expect(
      service.create(user, { invoiceIds: ['inv-1'], route: 'TRANSFER' as never }),
    ).rejects.toThrow(ConflictException);
  });

  it('rechaza facturas ya ligadas a otro pago activo', async () => {
    prisma.invoice.findMany.mockResolvedValue([
      { id: 'inv-1', total: 1160, status: InvoiceStatus.APPROVED, supplierId: 's1', payments: [{ id: 'pay-x' }] },
    ]);
    await expect(
      service.create(user, { invoiceIds: ['inv-1'], route: 'TRANSFER' as never }),
    ).rejects.toThrow(ConflictException);
  });

  it('rechaza transición de estado inválida (SCHEDULED→COMPLETED)', async () => {
    prisma.payment.findFirst.mockResolvedValue({
      id: 'pay-1',
      status: PaymentStatus.SCHEDULED,
      totalAmount: 1160,
      createdByUserId: 'user-1',
      invoices: [],
    });
    await expect(
      service.updateStatus(user, 'pay-1', PaymentStatus.COMPLETED),
    ).rejects.toThrow(BadRequestException);
  });

  it('al COMPLETAR marca facturas PPD como PAID con REP pendiente', async () => {
    prisma.payment.findFirst
      .mockResolvedValueOnce({
        id: 'pay-1',
        status: PaymentStatus.PROCESSING,
        totalAmount: 1160,
        createdByUserId: 'user-1',
        invoices: [{ id: 'inv-1', paymentType: PaymentType.PPD }],
      })
      // segunda llamada: findOne final
      .mockResolvedValueOnce({
        id: 'pay-1',
        status: PaymentStatus.COMPLETED,
        totalAmount: 1160,
        invoices: [],
      });

    await service.updateStatus(
      user,
      'pay-1',
      PaymentStatus.COMPLETED,
      'SPEI-123',
    );

    const updateManyCall = prisma.invoice.updateMany.mock.calls[0][0];
    expect(updateManyCall.data.status).toBe(InvoiceStatus.PAID);
    expect(updateManyCall.data.repStatus).toBe('PENDING');
    expect(notifications.create).toHaveBeenCalled();
  });
});
