import { ConflictException } from '@nestjs/common';
import { FactorajeStatus, InvoiceStatus } from '@prisma/client';
import { FactorajeService } from './factoraje.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ActivityLogService } from '../activity/activity-log.service';
import { FactorajeProviderService } from './factoraje-provider.service';
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

describe('FactorajeService', () => {
  let service: FactorajeService;
  let prisma: {
    invoice: { findFirst: jest.Mock };
    factorajeRequest: {
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    supplier: { findUnique: jest.Mock };
    user: { findFirst: jest.Mock };
  };
  let settings: { get: jest.Mock };
  let notifications: { create: jest.Mock; notifyOrgAdmins: jest.Mock };
  let activity: { record: jest.Mock };
  let provider: { disburse: jest.Mock };

  beforeEach(() => {
    prisma = {
      invoice: { findFirst: jest.fn() },
      factorajeRequest: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      supplier: { findUnique: jest.fn() },
      user: { findFirst: jest.fn() },
    };
    settings = { get: jest.fn().mockResolvedValue({ factorajeFeePercent: 3 }) };
    notifications = {
      create: jest.fn().mockResolvedValue({}),
      notifyOrgAdmins: jest.fn().mockResolvedValue(0),
    };
    activity = { record: jest.fn().mockResolvedValue(undefined) };
    provider = {
      disburse: jest
        .fn()
        .mockResolvedValue({ providerRef: 'STUB-1', mode: 'stub' }),
    };
    const webhooks = { dispatch: jest.fn().mockResolvedValue(undefined) };
    service = new FactorajeService(
      prisma as unknown as PrismaService,
      settings as unknown as SettingsService,
      notifications as unknown as NotificationsService,
      activity as unknown as ActivityLogService,
      provider as unknown as FactorajeProviderService,
      webhooks as unknown as WebhooksService,
    );
  });

  it('calcula fee (3%) y neto sobre el total de la factura', async () => {
    prisma.invoice.findFirst.mockResolvedValue({
      id: 'inv-1',
      total: 1000,
      status: InvoiceStatus.APPROVED,
      supplierId: 'sup-1',
      folio: 'F-1',
      cfdiUuid: 'UUID-1',
      supplier: { name: 'Proveedor X' },
    });
    prisma.factorajeRequest.findFirst.mockResolvedValue(null);
    prisma.factorajeRequest.create.mockImplementation(({ data }) => ({
      id: 'fr-1',
      ...data,
    }));

    const result = await service.request(user, { invoiceId: 'inv-1' });

    expect(result.fee).toBe(30);
    expect(result.netAmount).toBe(970);
    expect(result.rate).toBe(3);
  });

  it('rechaza factoraje sobre factura no aprobada', async () => {
    prisma.invoice.findFirst.mockResolvedValue({
      id: 'inv-1',
      total: 1000,
      status: InvoiceStatus.PENDING,
      supplierId: 'sup-1',
    });
    await expect(
      service.request(user, { invoiceId: 'inv-1' }),
    ).rejects.toThrow(ConflictException);
  });

  it('dispersa vía el adaptador y pasa a DISBURSED', async () => {
    prisma.factorajeRequest.findFirst.mockResolvedValue({
      id: 'fr-1',
      supplierId: 'sup-1',
      status: FactorajeStatus.APPROVED,
      netAmount: 970,
    });
    prisma.supplier.findUnique.mockResolvedValue({
      name: 'Proveedor X',
      clabeInterbancaria: '0123',
    });
    prisma.user.findFirst.mockResolvedValue({ id: 'puser-1' });
    prisma.factorajeRequest.update.mockImplementation(({ data }) => ({
      id: 'fr-1',
      supplierId: 'sup-1',
      requestedAmount: 1000,
      fee: 30,
      netAmount: 970,
      rate: 3,
      ...data,
    }));

    const result = await service.disburse(user, 'fr-1');

    expect(provider.disburse).toHaveBeenCalled();
    expect(result.status).toBe(FactorajeStatus.DISBURSED);
    expect(result.providerRef).toBe('STUB-1');
    expect(notifications.create).toHaveBeenCalled();
  });
});
