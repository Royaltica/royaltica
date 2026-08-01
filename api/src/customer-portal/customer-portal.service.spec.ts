import { ConflictException, GoneException, NotFoundException } from '@nestjs/common';
import { CustomerPortalService } from './customer-portal.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { ActivityLogService } from '../activity/activity-log.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { ConfigService } from '@nestjs/config';

const ORG_ID = 'org-1';
const CUSTOMER_ID = 'cust-1';
const VALID_TOKEN = 'a'.repeat(64);

describe('CustomerPortalService', () => {
  let service: CustomerPortalService;
  let prisma: {
    customer: { findUnique: jest.Mock; findFirst: jest.Mock };
    organization: { findUnique: jest.Mock };
    invoice: { findMany: jest.Mock; findFirst: jest.Mock };
    activityLog: { findFirst: jest.Mock; findMany: jest.Mock };
    withOrg: jest.Mock;
    $queryRaw: jest.Mock;
    $executeRaw: jest.Mock;
  };
  let activity: { record: jest.Mock };
  let notifications: { notifyOrgAdmins: jest.Mock };
  let config: { get: jest.Mock };

  const accessRow = {
    id: 'access-1',
    organizationId: ORG_ID,
    customerId: CUSTOMER_ID,
    token: VALID_TOKEN,
    expiresAt: new Date(Date.now() + 30 * 86_400_000),
    createdAt: new Date(),
    lastAccessedAt: null,
  };

  beforeEach(() => {
    prisma = {
      customer: { findUnique: jest.fn(), findFirst: jest.fn() },
      organization: { findUnique: jest.fn() },
      invoice: { findMany: jest.fn(), findFirst: jest.fn() },
      activityLog: { findFirst: jest.fn(), findMany: jest.fn() },
      withOrg: jest.fn(),
      $queryRaw: jest.fn(),
      $executeRaw: jest.fn(),
    };
    prisma.withOrg.mockImplementation((_orgId: string, fn: (tx: unknown) => unknown) =>
      fn(prisma),
    );

    activity = { record: jest.fn().mockResolvedValue(undefined) };
    notifications = { notifyOrgAdmins: jest.fn().mockResolvedValue(1) };
    config = { get: jest.fn().mockReturnValue('http://localhost:5173') };

    service = new CustomerPortalService(
      prisma as unknown as PrismaService,
      activity as unknown as ActivityLogService,
      notifications as unknown as NotificationsService,
      config as unknown as ConfigService<any, true>,
    );
  });

  describe('getPortalData', () => {
    it('devuelve solo los datos del cliente dueño del token (escopado por organización)', async () => {
      prisma.$queryRaw.mockResolvedValue([accessRow]);
      prisma.customer.findFirst.mockResolvedValue({ name: 'Acme Co.' });
      prisma.organization.findUnique.mockResolvedValue({ currency: 'CAD' });
      prisma.invoice.findMany.mockResolvedValue([
        {
          id: 'inv-1',
          folio: 'F-001',
          total: 1000 as unknown as number,
          currency: 'CAD',
          dueDate: new Date(Date.now() - 10 * 86_400_000),
          status: 'PENDING',
        },
      ]);
      prisma.activityLog.findMany.mockResolvedValue([]);

      const result = await service.getPortalData(VALID_TOKEN);

      expect(result.customer.name).toBe('Acme Co.');
      expect(result.currency).toBe('CAD');
      expect(result.invoices).toHaveLength(1);
      expect(result.invoices[0].daysOverdue).toBeGreaterThanOrEqual(9);
      expect(result.aging.totalOverdue).toBe(1000);

      // Escopado siempre por la organización resuelta del token, nunca por
      // un parámetro del cliente.
      expect(prisma.withOrg).toHaveBeenCalledWith(ORG_ID, expect.any(Function));
      expect(prisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: ORG_ID,
            customerId: CUSTOMER_ID,
            direction: 'RECEIVABLE',
          }),
        }),
      );

      // Cada vista se audita y actualiza lastAccessedAt.
      expect(prisma.$executeRaw).toHaveBeenCalled();
      expect(activity.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CUSTOMER_PORTAL_VIEWED', organizationId: ORG_ID }),
      );
    });

    it('token inexistente devuelve NotFoundException (no 401/403)', async () => {
      prisma.$queryRaw.mockResolvedValue([]);
      await expect(service.getPortalData(VALID_TOKEN)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('token vencido devuelve GoneException (410), no 401/403', async () => {
      prisma.$queryRaw.mockResolvedValue([
        { ...accessRow, expiresAt: new Date(Date.now() - 1000) },
      ]);
      await expect(service.getPortalData(VALID_TOKEN)).rejects.toBeInstanceOf(
        GoneException,
      );
    });

    it('token demasiado corto (formato inválido) se rechaza sin consultar la BD', async () => {
      await expect(service.getPortalData('abc')).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });
  });

  describe('markInvoicePaid', () => {
    const invoice = {
      id: 'inv-1',
      folio: 'F-001',
      status: 'PENDING',
      total: 500,
      cfdiUuid: 'uuid-1234-5678',
      customer: { name: 'Acme Co.' },
    };

    beforeEach(() => {
      prisma.$queryRaw.mockResolvedValue([accessRow]);
      prisma.invoice.findFirst.mockResolvedValue(invoice);
    });

    it('crea el registro de auditoría y notifica a los admins, SIN mutar el status real', async () => {
      prisma.activityLog.findFirst.mockResolvedValue(null);

      const result = await service.markInvoicePaid(VALID_TOKEN, 'inv-1');

      expect(result).toEqual({ ok: true, alreadyFlagged: false });
      expect(activity.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CUSTOMER_CLAIMED_PAID',
          entityType: 'Invoice',
          entityId: 'inv-1',
          organizationId: ORG_ID,
        }),
      );
      expect(notifications.notifyOrgAdmins).toHaveBeenCalledWith(
        ORG_ID,
        expect.objectContaining({ type: 'CUSTOMER_PAID_CLAIM' }),
      );
      // El servicio nunca llama invoice.update: el status real no se toca.
      expect((prisma.invoice as any).update).toBeUndefined();
    });

    it('deduplica clicks repetidos: no vuelve a notificar a los admins', async () => {
      prisma.activityLog.findFirst.mockResolvedValue({ id: 'log-1' });

      const result = await service.markInvoicePaid(VALID_TOKEN, 'inv-1');

      expect(result).toEqual({ ok: true, alreadyFlagged: true });
      expect(notifications.notifyOrgAdmins).not.toHaveBeenCalled();
      // Igual se audita el reintento.
      expect(activity.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CUSTOMER_CLAIMED_PAID_REPEAT' }),
      );
    });

    it('factura de otro cliente/organización (no encontrada bajo el scope del token) → 404', async () => {
      prisma.invoice.findFirst.mockResolvedValue(null);
      await expect(service.markInvoicePaid(VALID_TOKEN, 'inv-ajena')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('factura ya no pendiente (ej. ya PAID) → ConflictException', async () => {
      prisma.invoice.findFirst.mockResolvedValue({ ...invoice, status: 'PAID' });
      await expect(service.markInvoicePaid(VALID_TOKEN, 'inv-1')).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('token vencido no permite marcar como pagada', async () => {
      prisma.$queryRaw.mockResolvedValue([
        { ...accessRow, expiresAt: new Date(Date.now() - 1000) },
      ]);
      await expect(service.markInvoicePaid(VALID_TOKEN, 'inv-1')).rejects.toBeInstanceOf(
        GoneException,
      );
    });
  });
});
