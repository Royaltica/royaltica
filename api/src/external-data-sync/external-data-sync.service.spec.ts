import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ExternalDataSyncService } from './external-data-sync.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { ActivityLogService } from '../activity/activity-log.service';
import { FieldMappingService } from './field-mapping.service';
import { IDENTITY_MAPPING } from './field-mapping.types';
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

describe('ExternalDataSyncService', () => {
  let service: ExternalDataSyncService;
  let prisma: { withOrg: jest.Mock };
  let settings: { get: jest.Mock };
  let activity: { record: jest.Mock };
  let fieldMapping: {
    getEffective: jest.Mock;
    getStored: jest.Mock;
    upsert: jest.Mock;
  };

  beforeEach(() => {
    prisma = { withOrg: jest.fn() };
    settings = {
      get: jest.fn().mockResolvedValue({
        externalSyncProvider: null,
        externalSyncRestBaseUrl: null,
        externalSyncRestAuthHeader: null,
      }),
    };
    activity = { record: jest.fn().mockResolvedValue(undefined) };
    fieldMapping = {
      getEffective: jest.fn().mockImplementation((_org, entityType) =>
        Promise.resolve(IDENTITY_MAPPING[entityType as 'CUSTOMER' | 'RECEIVABLE']),
      ),
      getStored: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockImplementation((_org, _type, mapping) => Promise.resolve(mapping)),
    };

    service = new ExternalDataSyncService(
      prisma as unknown as PrismaService,
      settings as unknown as SettingsService,
      activity as unknown as ActivityLogService,
      fieldMapping as unknown as FieldMappingService,
    );
  });

  it('lanza ForbiddenException si el usuario no tiene organización', async () => {
    const noOrgUser = { ...user, organizationId: null };
    await expect(service.syncCustomers(noOrgUser, undefined)).rejects.toThrow(
      ForbiddenException,
    );
  });

  describe('syncCustomers / syncReceivables', () => {
    it('usa el conector CSV cuando viene un archivo y registra actividad', async () => {
      const csv = 'externalId,name,legalName,rfc,email,phone,category\nC-1,Acme,,,a@x.ca,,\n';
      prisma.withOrg.mockImplementation((_orgId: string, fn: (tx: unknown) => unknown) =>
        fn({
          customer: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn() },
        }),
      );

      const result = await service.syncCustomers(user, { buffer: Buffer.from(csv) });

      expect(result.provider).toBe('generic-csv');
      expect(result.mode).toBe('live');
      expect(activity.record).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: 'org-1',
          action: 'EXTERNAL_SYNC_CUSTOMERS',
        }),
      );
    });

    it('cae al conector REST en modo stub cuando no hay archivo ni configuración', async () => {
      const result = await service.syncReceivables(user, undefined);

      expect(result.provider).toBe('generic-rest');
      expect(result.mode).toBe('stub');
      expect(result.imported).toBe(0);
      expect(activity.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'EXTERNAL_SYNC_RECEIVABLES' }),
      );
    });
  });

  describe('field mapping', () => {
    it('rechaza un entityType inválido', async () => {
      await expect(service.getFieldMapping(user, 'SUPPLIER')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('devuelve el mapeo identidad marcado como default si no hay uno guardado', async () => {
      const result = await service.getFieldMapping(user, 'customer');
      expect(result.entityType).toBe('CUSTOMER');
      expect(result.isDefault).toBe(true);
      expect(result.mapping).toEqual(IDENTITY_MAPPING.CUSTOMER);
    });

    it('guarda un mapeo custom y lo registra en actividad', async () => {
      const mapping = { name: 'CustomerName', externalId: 'CustomerRef' };
      const result = await service.setFieldMapping(user, 'CUSTOMER', mapping);

      expect(result.mapping).toEqual(mapping);
      expect(fieldMapping.upsert).toHaveBeenCalledWith('org-1', 'CUSTOMER', mapping);
      expect(activity.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'EXTERNAL_SYNC_FIELD_MAPPING_UPDATED' }),
      );
    });

    it('rechaza un mapeo que no es un objeto', async () => {
      await expect(
        service.setFieldMapping(user, 'CUSTOMER', ['not', 'an', 'object'] as never),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
