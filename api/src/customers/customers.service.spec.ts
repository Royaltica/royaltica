import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { SatService } from '../sat/sat.service';
import type { ActivityLogService } from '../activity/activity-log.service';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

const admin: AuthenticatedUser = {
  id: 'admin-1',
  firebaseUid: 'fb-1',
  email: 'admin@royaltica.com',
  role: 'CORPORATE_ADMIN',
  organizationId: 'org-1',
  permissions: ['*'],
  supplierId: null,
  operationalProfile: null,
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
    organization: { findUnique: jest.Mock };
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
      organization: {
        findUnique: jest.fn().mockResolvedValue({ currency: 'MXN' }),
      },
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

  it('rechaza un RFC con formato inválido para una organización mexicana (currency MXN)', async () => {
    prisma.customer.findFirst.mockResolvedValue(null);
    await expect(
      service.create(admin, {
        name: 'Cliente Malo',
        rfc: 'no-es-un-rfc',
        legalName: 'Cliente Malo SA',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.customer.create).not.toHaveBeenCalled();
  });

  it('acepta un Business Number canadiense (no-RFC) para una organización con currency CAD', async () => {
    prisma.organization.findUnique.mockResolvedValue({ currency: 'CAD' });
    prisma.customer.findFirst.mockResolvedValue(null);
    prisma.customer.create.mockImplementation(({ data }) => ({ id: 'c-2', ...data }));

    const result = await service.create(admin, {
      name: 'Northwind Traders',
      rfc: 'ca-bn-123456789',
      legalName: 'Northwind Traders Ltd.',
    });

    expect(result.rfc).toBe('CA-BN-123456789');
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

  it('al marcar "no contactar" guarda la fecha y al quitarlo limpia el motivo', async () => {
    prisma.customer.findFirst.mockResolvedValue({ id: 'c-1' });
    prisma.customer.update.mockResolvedValue({ id: 'c-1' });

    await service.update(admin, 'c-1', { doNotContact: true, doNotContactReason: 'Pidió no ser contactado' });
    expect(prisma.customer.update.mock.calls[0][0].data).toMatchObject({
      doNotContact: true,
      doNotContactReason: 'Pidió no ser contactado',
      doNotContactAt: expect.any(Date),
    });

    await service.update(admin, 'c-1', { doNotContact: false });
    expect(prisma.customer.update.mock.calls[1][0].data).toMatchObject({
      doNotContact: false,
      doNotContactReason: null,
      doNotContactAt: null,
    });
  });

  it('restaura un cliente eliminado (deshacer) y rechaza uno que no está eliminado', async () => {
    prisma.customer.findFirst.mockResolvedValueOnce({ id: 'c-1' });
    prisma.customer.update.mockResolvedValue({ id: 'c-1', deletedAt: null });
    await service.restore(admin, 'c-1');
    expect(prisma.customer.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ deletedAt: { not: null } }) }),
    );
    expect(prisma.customer.update).toHaveBeenCalledWith({ where: { id: 'c-1' }, data: { deletedAt: null } });

    prisma.customer.findFirst.mockResolvedValueOnce(null);
    await expect(service.restore(admin, 'c-2')).rejects.toThrow(NotFoundException);
  });
  describe('dataExport (derecho de acceso)', () => {
    const prismaCon = (customer: unknown) => {
      const tx = {
        customer: { findFirst: jest.fn().mockResolvedValue(customer) },
        invoice: { findMany: jest.fn().mockResolvedValue([{ folio: 'F-1', cfdiUuid: 'u', total: '100.50', currency: 'MXN', date: new Date(), dueDate: null, paidDate: null, status: 'PENDING' }]) },
        whatsappMessage: { findMany: jest.fn().mockResolvedValue([{ direction: 'INBOUND', kind: 'TEXT', body: 'hola', templateName: null, sent: true, createdAt: new Date() }]) },
        activityLog: { findMany: jest.fn().mockResolvedValue([]) },
      };
      return { tx, prisma: { withOrg: (_o: string, fn: (t: unknown) => unknown) => fn(tx) } as unknown as PrismaService };
    };
    const sat = {} as unknown as SatService;

    it('un usuario que no es administrador no puede exportar', async () => {
      const { prisma } = prismaCon({ id: 'c-1' });
      const svc = new CustomersService(prisma, sat);
      await expect(
        svc.dataExport({ ...admin, role: 'CORPORATE_USER' } as AuthenticatedUser, 'c-1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('junta contacto, facturas y mensajes, solo de su organización, y deja registro', async () => {
      const { prisma, tx } = prismaCon({ id: 'c-1', name: 'ACME', legalName: 'ACME SA', rfc: 'AAA010101AAA', doNotContact: false });
      const record = jest.fn().mockResolvedValue(undefined);
      const svc = new CustomersService(prisma, sat, { record } as unknown as ActivityLogService);
      const out = await svc.dataExport(admin, 'c-1');
      expect(tx.customer.findFirst).toHaveBeenCalledWith({ where: { id: 'c-1', organizationId: 'org-1' } });
      expect(out.contacto.rfc).toBe('AAA010101AAA');
      expect(out.facturas[0].total).toBe(100.5);
      expect(out.mensajesWhatsapp).toHaveLength(1);
      expect(record).toHaveBeenCalledWith(expect.objectContaining({ action: 'CUSTOMER_DATA_EXPORTED', entityId: 'c-1' }));
    });

    it('cliente de otra organización: no encontrado', async () => {
      const { prisma } = prismaCon(null);
      await expect(new CustomersService(prisma, sat).dataExport(admin, 'c-9')).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
