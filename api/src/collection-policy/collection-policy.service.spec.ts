import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CollectionContactChannel } from '@prisma/client';
import { CollectionPolicyService } from './collection-policy.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { ActivityLogService } from '../activity/activity-log.service';
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

const userSinOrg: AuthenticatedUser = { ...user, organizationId: null };

const basePolicy = {
  id: 'pol-1',
  organizationId: 'org-1',
  name: 'Default Canadian AR Policy',
  isActive: true,
  maxContactsPerWeek: 3,
  allowedContactStartHour: 9,
  allowedContactEndHour: 17,
  timezone: 'America/Toronto',
  gracePeriodDays: 5,
  escalationThresholdDays: 30,
  preferredChannel: CollectionContactChannel.EMAIL,
  pauseMessage: null,
  blackoutDates: [] as Date[],
  createdAt: new Date('2026-08-01'),
  updatedAt: new Date('2026-08-01'),
  deletedAt: null,
};

describe('CollectionPolicyService', () => {
  let service: CollectionPolicyService;
  let prisma: {
    collectionPolicy: {
      create: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
    };
    withOrg: jest.Mock;
  };
  let activity: { record: jest.Mock };

  beforeEach(() => {
    prisma = {
      collectionPolicy: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      withOrg: jest.fn(),
    };
    // withOrg simula la transacción con RLS: en el mock, simplemente corre
    // el callback pasándole el mismo objeto prisma mockeado como `tx`.
    prisma.withOrg.mockImplementation((_orgId: string, fn: (tx: unknown) => unknown) =>
      fn(prisma),
    );
    activity = { record: jest.fn().mockResolvedValue(undefined) };
    service = new CollectionPolicyService(
      prisma as unknown as PrismaService,
      activity as unknown as ActivityLogService,
    );
  });

  it('crea una política de cobranza y registra actividad', async () => {
    prisma.collectionPolicy.create.mockResolvedValue(basePolicy);

    const result = await service.create(user, {
      name: 'Default Canadian AR Policy',
      maxContactsPerWeek: 3,
      allowedContactStartHour: 9,
      allowedContactEndHour: 17,
      timezone: 'America/Toronto',
      gracePeriodDays: 5,
      escalationThresholdDays: 30,
      preferredChannel: CollectionContactChannel.EMAIL,
    });

    expect(prisma.collectionPolicy.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: 'org-1',
          name: 'Default Canadian AR Policy',
          preferredChannel: CollectionContactChannel.EMAIL,
        }),
      }),
    );
    expect(activity.record).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-1',
        action: 'COLLECTION_POLICY_CREATED',
        entityId: 'pol-1',
      }),
    );
    expect(result.id).toBe('pol-1');
  });

  it('rechaza una ventana de contacto inválida (fin <= inicio)', async () => {
    await expect(
      service.create(user, {
        name: 'Bad window',
        maxContactsPerWeek: 3,
        allowedContactStartHour: 17,
        allowedContactEndHour: 9,
        timezone: 'America/Toronto',
        gracePeriodDays: 5,
        escalationThresholdDays: 30,
        preferredChannel: CollectionContactChannel.EMAIL,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.collectionPolicy.create).not.toHaveBeenCalled();
  });

  it('rechaza crear/consultar si el usuario no pertenece a una organización', async () => {
    await expect(
      service.create(userSinOrg, {
        name: 'x',
        maxContactsPerWeek: 1,
        allowedContactStartHour: 9,
        allowedContactEndHour: 10,
        timezone: 'UTC',
        gracePeriodDays: 1,
        escalationThresholdDays: 1,
        preferredChannel: CollectionContactChannel.EMAIL,
      }),
    ).rejects.toThrow(ForbiddenException);
    await expect(service.findAll(userSinOrg)).rejects.toThrow(ForbiddenException);
  });

  it('aísla las políticas por organización: findAll solo consulta la org del usuario', async () => {
    prisma.collectionPolicy.findMany.mockResolvedValue([basePolicy]);

    await service.findAll(user);

    expect(prisma.withOrg).toHaveBeenCalledWith('org-1', expect.any(Function));
    expect(prisma.collectionPolicy.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 'org-1', deletedAt: null },
      }),
    );
  });

  it('lanza NotFoundException si la política no existe en la organización', async () => {
    prisma.collectionPolicy.findFirst.mockResolvedValue(null);
    await expect(service.findOne(user, 'pol-x')).rejects.toThrow(NotFoundException);
  });

  it('remove hace soft-delete (deletedAt) y registra actividad', async () => {
    prisma.collectionPolicy.findFirst.mockResolvedValue(basePolicy);
    prisma.collectionPolicy.update.mockResolvedValue({
      ...basePolicy,
      deletedAt: new Date(),
    });

    const result = await service.remove(user, 'pol-1');

    expect(prisma.collectionPolicy.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'pol-1' },
        data: { deletedAt: expect.any(Date) },
      }),
    );
    expect(activity.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'COLLECTION_POLICY_DELETED' }),
    );
    expect(result).toEqual({ deleted: true, id: 'pol-1' });
  });
});
