import { ConflictException } from '@nestjs/common';
import { DiotService } from './diot.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { ActivityLogService } from '../activity/activity-log.service';
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

describe('DiotService', () => {
  let service: DiotService;
  let prisma: {
    diotDeclaration: {
      findUnique: jest.Mock;
      upsert: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
    };
    invoice: { findMany: jest.Mock };
    withOrg: jest.Mock;
  };
  let activity: { record: jest.Mock };

  beforeEach(() => {
    prisma = {
      diotDeclaration: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      invoice: { findMany: jest.fn() },
      withOrg: jest.fn(),
    };
    // withOrg simula la transacción con RLS corriendo el callback con el
    // mismo objeto prisma mockeado como `tx`.
    prisma.withOrg.mockImplementation((_orgId: string, fn: (tx: unknown) => unknown) =>
      fn(prisma),
    );
    activity = { record: jest.fn().mockResolvedValue(undefined) };
    service = new DiotService(
      prisma as unknown as PrismaService,
      activity as unknown as ActivityLogService,
    );
  });

  it('agrupa operaciones por RFC tercero y suma base/IVA', async () => {
    prisma.diotDeclaration.findUnique.mockResolvedValue(null);
    prisma.invoice.findMany.mockResolvedValue([
      { rfcEmisor: 'AAA010101AA1', subtotal: 100, iva: 16, supplier: { name: 'A' } },
      { rfcEmisor: 'AAA010101AA1', subtotal: 200, iva: 32, supplier: { name: 'A' } },
      { rfcEmisor: 'BBB020202BB2', subtotal: 50, iva: 8, supplier: { name: 'B' } },
    ]);
    prisma.diotDeclaration.upsert.mockImplementation(({ create }) => ({
      id: 'd1',
      ...create,
    }));

    await service.generate(user, '2026-05');

    const callArg = prisma.diotDeclaration.upsert.mock.calls[0][0];
    expect(callArg.create.totalOps).toBe(3);
    expect(callArg.create.totalIva).toBe(56);
    const entries = callArg.create.entries as Array<{
      rfcTercero: string;
      baseGravable: number;
      iva: number;
      numeroOperaciones: number;
    }>;
    expect(entries).toHaveLength(2);
    const aaa = entries.find((e) => e.rfcTercero === 'AAA010101AA1')!;
    expect(aaa.baseGravable).toBe(300);
    expect(aaa.iva).toBe(48);
    expect(aaa.numeroOperaciones).toBe(2);
    expect(activity.record).toHaveBeenCalled();
  });

  it('no permite regenerar una DIOT ya presentada', async () => {
    prisma.diotDeclaration.findUnique.mockResolvedValue({
      id: 'd1',
      submittedAt: new Date(),
    });
    await expect(service.generate(user, '2026-05')).rejects.toThrow(
      ConflictException,
    );
  });
});
