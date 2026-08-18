import { BadRequestException, ConflictException } from '@nestjs/common';
import { InvoiceStatus, PaymentStatus, PaymentType } from '@prisma/client';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { ActivityLogService } from '../activity/activity-log.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { SpeiService } from '../spei/spei.service';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.validation';
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
      aggregate: jest.Mock;
    };
    $transaction: jest.Mock;
    withOrg: jest.Mock;
  };
  let notifications: { create: jest.Mock; notifyOrgAdmins: jest.Mock };
  let activity: { record: jest.Mock };
  let spei: { order: jest.Mock };

  const ENV_DEFAULTS: Record<string, number> = {
    SPEI_MAX_AMOUNT_PER_TRANSFER: 500_000,
    SPEI_MAX_DAILY_TOTAL_PER_ORG: 2_000_000,
  };

  beforeEach(() => {
    prisma = {
      invoice: { findMany: jest.fn(), updateMany: jest.fn() },
      payment: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
        aggregate: jest.fn().mockResolvedValue({ _sum: { totalAmount: 0 } }),
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
    spei = {
      order: jest.fn().mockResolvedValue({
        success: true,
        mode: 'live',
        claveRastreo: 'RYLABC12345',
      }),
    };
    const webhooks = { dispatch: jest.fn().mockResolvedValue(undefined) };
    const whatsapp = { notifyOrgAdmins: jest.fn().mockResolvedValue({ recipients: 0, sent: 0 }) };
    const config = {
      get: jest.fn((key: string) => ENV_DEFAULTS[key]),
    };
    service = new PaymentsService(
      prisma as unknown as PrismaService,
      notifications as unknown as NotificationsService,
      whatsapp as unknown as WhatsappService,
      activity as unknown as ActivityLogService,
      webhooks as unknown as WebhooksService,
      spei as unknown as SpeiService,
      config as unknown as ConfigService<Env, true>,
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

  it('rechaza crear un pago TRANSFER que mezcla facturas de proveedores distintos', async () => {
    prisma.invoice.findMany.mockResolvedValue([
      { id: 'inv-1', total: 1000, status: InvoiceStatus.APPROVED, supplierId: 's1', payments: [] },
      { id: 'inv-2', total: 1000, status: InvoiceStatus.APPROVED, supplierId: 's2', payments: [] },
    ]);
    await expect(
      service.create(user, { invoiceIds: ['inv-1', 'inv-2'], route: 'TRANSFER' as never }),
    ).rejects.toThrow(ConflictException);
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });

  describe('dispersión SPEI real (PROCESSING de un pago TRANSFER)', () => {
    const basePayment = {
      id: 'pay-1',
      status: PaymentStatus.SCHEDULED,
      route: 'TRANSFER',
      totalAmount: 10_000,
      createdByUserId: 'user-1',
      invoices: [
        {
          id: 'inv-1',
          paymentType: PaymentType.PUE,
          supplierId: 's1',
          supplier: {
            id: 's1',
            name: 'Logística Andrade',
            rfc: 'LAN180423QF1',
            clabeInterbancaria: '032180000118359719',
          },
        },
      ],
    };

    it('llama a SpeiService.order() con la CLABE del proveedor y guarda la claveRastreo en transactionRef', async () => {
      prisma.payment.findFirst
        .mockResolvedValueOnce(basePayment)
        .mockResolvedValueOnce({ ...basePayment, status: PaymentStatus.PROCESSING, invoices: [] });

      await service.updateStatus(user, 'pay-1', PaymentStatus.PROCESSING);

      expect(spei.order).toHaveBeenCalledWith(
        expect.objectContaining({
          clabeDestino: '032180000118359719',
          nombreBeneficiario: 'Logística Andrade',
          rfcBeneficiario: 'LAN180423QF1',
          monto: 10_000,
        }),
      );
      const updateCall = prisma.payment.update.mock.calls[0][0];
      expect(updateCall.data.transactionRef).toBe('RYLABC12345');
      expect(updateCall.data.status).toBe(PaymentStatus.PROCESSING);
    });

    it('bloquea la transición si el proveedor no tiene CLABE registrada', async () => {
      prisma.payment.findFirst.mockResolvedValueOnce({
        ...basePayment,
        invoices: [{ ...basePayment.invoices[0], supplier: { ...basePayment.invoices[0].supplier, clabeInterbancaria: null } }],
      });

      await expect(
        service.updateStatus(user, 'pay-1', PaymentStatus.PROCESSING),
      ).rejects.toThrow(BadRequestException);
      expect(spei.order).not.toHaveBeenCalled();
      expect(prisma.payment.update).not.toHaveBeenCalled();
    });

    it('bloquea la transición si el monto excede SPEI_MAX_AMOUNT_PER_TRANSFER', async () => {
      prisma.payment.findFirst.mockResolvedValueOnce({
        ...basePayment,
        totalAmount: 600_000, // > default de 500,000
      });

      await expect(
        service.updateStatus(user, 'pay-1', PaymentStatus.PROCESSING),
      ).rejects.toThrow(BadRequestException);
      expect(spei.order).not.toHaveBeenCalled();
    });

    it('bloquea la transición si se excede el límite diario de la organización', async () => {
      prisma.payment.aggregate.mockResolvedValueOnce({
        _sum: { totalAmount: 1_995_000 }, // ya dispersado hoy
      });
      prisma.payment.findFirst.mockResolvedValueOnce(basePayment); // +10,000 -> excede 2,000,000

      await expect(
        service.updateStatus(user, 'pay-1', PaymentStatus.PROCESSING),
      ).rejects.toThrow(BadRequestException);
      expect(spei.order).not.toHaveBeenCalled();
    });

    it('bloquea la transición si Conekta/STP rechaza la orden', async () => {
      spei.order.mockResolvedValueOnce({ success: false, mode: 'live', error: 'fondos insuficientes' });
      prisma.payment.findFirst.mockResolvedValueOnce(basePayment);

      await expect(
        service.updateStatus(user, 'pay-1', PaymentStatus.PROCESSING),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.payment.update).not.toHaveBeenCalled();
    });

    it('NO dispara SPEI para pagos por CHECK/CREDIT (solo TRANSFER)', async () => {
      prisma.payment.findFirst
        .mockResolvedValueOnce({ ...basePayment, route: 'CHECK' })
        .mockResolvedValueOnce({ ...basePayment, route: 'CHECK', status: PaymentStatus.PROCESSING, invoices: [] });

      await service.updateStatus(user, 'pay-1', PaymentStatus.PROCESSING);

      expect(spei.order).not.toHaveBeenCalled();
    });
  });
});
