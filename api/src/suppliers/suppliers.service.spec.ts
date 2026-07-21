import { ConflictException, NotFoundException } from '@nestjs/common';
import { SuppliersService } from './suppliers.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { SatService } from '../sat/sat.service';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

const admin: AuthenticatedUser = {
  id: 'admin-1',
  firebaseUid: 'fb-1',
  email: 'admin@royaltica.com',
  role: 'CORPORATE_ADMIN',
  organizationId: 'org-1',
  permissions: ['*'],
  supplierId: null,
};

describe('SuppliersService', () => {
  let service: SuppliersService;
  let prisma: {
    supplier: {
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    withOrg: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      supplier: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      withOrg: jest.fn(),
    };
    // withOrg simula la transacción con RLS: en el mock, simplemente corre
    // el callback pasándole el mismo objeto prisma mockeado como `tx`.
    prisma.withOrg.mockImplementation((_orgId: string, fn: (tx: unknown) => unknown) =>
      fn(prisma),
    );
    const webhooks = { dispatch: jest.fn().mockResolvedValue(undefined) };
    const sat = { check69bBatch: jest.fn().mockResolvedValue(new Map()) };
    service = new SuppliersService(
      prisma as unknown as PrismaService,
      webhooks as unknown as WebhooksService,
      sat as unknown as SatService,
    );
  });

  it('crea un proveedor y normaliza RFC + Decimal', async () => {
    prisma.supplier.findFirst.mockResolvedValue(null);
    prisma.supplier.create.mockResolvedValue({
      id: 's1',
      rfc: 'LAN180423QF1',
      capitalAmount: { toString: () => '2016000', valueOf: () => 2016000 },
      name: 'Logística Andrade',
    });

    const result = await service.create(admin, {
      name: 'Logística Andrade',
      rfc: 'lan180423qf1',
      legalName: 'Logística Andrade S.A. de C.V.',
    });

    expect(prisma.supplier.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ rfc: 'LAN180423QF1', organizationId: 'org-1' }),
      }),
    );
    expect(typeof result.capitalAmount).toBe('number');
  });

  it('rechaza RFC duplicado en la misma organización', async () => {
    prisma.supplier.findFirst.mockResolvedValue({ id: 'existing' });
    await expect(
      service.create(admin, {
        name: 'Otro',
        rfc: 'LAN180423QF1',
        legalName: 'Otro S.A.',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('lanza NotFound al actualizar un proveedor de otra organización', async () => {
    prisma.supplier.findFirst.mockResolvedValue(null);
    await expect(
      service.update(admin, '00000000-0000-0000-0000-000000000000', {
        name: 'X',
      }),
    ).rejects.toThrow(NotFoundException);
  });
});
