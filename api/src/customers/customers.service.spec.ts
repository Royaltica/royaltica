import { ConflictException, NotFoundException } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { PrismaService } from '../common/prisma/prisma.service';
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

describe('CustomersService', () => {
  let service: CustomersService;
  let prisma: {
    customer: {
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    invoice: { count: jest.Mock };
    withOrg: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      customer: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      invoice: { count: jest.fn().mockResolvedValue(0) },
      withOrg: jest.fn(),
    };
    // withOrg simula la transacción con RLS: en el mock, simplemente corre
    // el callback pasándole el mismo objeto prisma mockeado como `tx`.
    prisma.withOrg.mockImplementation((_orgId: string, fn: (tx: unknown) => unknown) =>
      fn(prisma),
    );
    const sat = { check69bBatch: jest.fn().mockResolvedValue(new Map()) };
    service = new CustomersService(
      prisma as unknown as PrismaService,
      sat as unknown as SatService,
    );
  });

  it('crea un cliente normalizando el RFC a mayúsculas', async () => {
    prisma.customer.findFirst.mockResolvedValue(null);
    prisma.customer.create.mockImplementation(({ data }) => ({
      id: 'c-1',
      ...data,
    }));

    const result = await service.create(admin, {
      name: 'Cliente Uno',
      rfc: 'xaxx010101000',
      legalName: 'Cliente Uno SA de CV',
    });

    expect(result.rfc).toBe('XAXX010101000');
    expect(prisma.customer.create).toHaveBeenCalled();
  });

  it('rechaza un RFC duplicado en la organización', async () => {
    prisma.customer.findFirst.mockResolvedValue({ id: 'existing' });
    await expect(
      service.create(admin, {
        name: 'Dup',
        rfc: 'XAXX010101000',
        legalName: 'Dup SA',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('lanza NotFound al actualizar un cliente inexistente', async () => {
    prisma.customer.findFirst.mockResolvedValue(null);
    await expect(
      service.update(admin, 'missing', { name: 'X' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('no permite borrar un cliente con facturas por cobrar abiertas', async () => {
    prisma.customer.findFirst.mockResolvedValue({ id: 'c-1' });
    prisma.invoice.count.mockResolvedValue(2);
    await expect(service.remove(admin, 'c-1')).rejects.toThrow(ConflictException);
    expect(prisma.customer.update).not.toHaveBeenCalled();
  });

  it('borra (soft-delete) un cliente sin facturas abiertas', async () => {
    prisma.customer.findFirst.mockResolvedValue({ id: 'c-1' });
    prisma.invoice.count.mockResolvedValue(0);
    prisma.customer.update.mockResolvedValue({});
    const res = await service.remove(admin, 'c-1');
    expect(res).toEqual({ deleted: true, id: 'c-1' });
    expect(prisma.customer.update).toHaveBeenCalled();
  });
});
