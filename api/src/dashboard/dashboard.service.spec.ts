import { DashboardService } from './dashboard.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

const user: AuthenticatedUser = {
  id: 'u-1',
  firebaseUid: 'fb-1',
  email: 'director@royaltica.com',
  role: 'CORPORATE_ADMIN',
  organizationId: 'org-1',
  permissions: ['*'],
  supplierId: null,
};

describe('DashboardService — indicadores CxC', () => {
  let service: DashboardService;
  let prisma: {
    invoice: { findMany: jest.Mock };
    customer: { findMany: jest.Mock };
  };

  beforeEach(() => {
    prisma = {
      invoice: { findMany: jest.fn() },
      customer: { findMany: jest.fn() },
    };
    service = new DashboardService(
      prisma as unknown as PrismaService,
      {} as unknown as SettingsService,
    );
  });

  describe('getCashConversionCycle', () => {
    it('calcula CCC = DSO − DPO', async () => {
      jest
        .spyOn(service, 'getFinancialRatios')
        .mockResolvedValue({ dpo: { value: 30 } } as never);
      jest
        .spyOn(service, 'getReceivablesRatios')
        .mockResolvedValue({ dso: { value: 11 } } as never);

      const res = await service.getCashConversionCycle(user);
      expect(res.value).toBe(-19);
      expect(res.dso).toBe(11);
      expect(res.dpo).toBe(30);
      expect(res.interpretation).toMatch(/autofinancia/i);
    });
  });

  describe('getAtRiskCustomers', () => {
    const overdue = (customerId: string, daysAgo: number) => ({
      total: { toString: () => '1000', valueOf: () => 1000 } as never,
      date: new Date(Date.now() - daysAgo * 86_400_000),
      dueDate: new Date(Date.now() - daysAgo * 86_400_000),
      customerId,
    });

    it('marca en riesgo a un cliente con ≥2 vencidas y mal historial', async () => {
      prisma.invoice.findMany.mockResolvedValue([
        overdue('c-1', 5),
        overdue('c-1', 8),
      ]);
      prisma.customer.findMany.mockResolvedValue([{ id: 'c-1', name: 'Moroso SA' }]);
      jest.spyOn(service as never, 'computeCustomerStats').mockResolvedValue([
        { customerId: 'c-1', name: 'Moroso SA', onTimePct: 40, settled: 5, avgDelayDays: 10, volume: 5000 },
      ] as never);

      const res = await service.getAtRiskCustomers(user);
      expect(res.count).toBe(1);
      expect(res.customers[0].name).toBe('Moroso SA');
      expect(res.customers[0].reason).toMatch(/2 facturas vencidas/);
    });

    it('NO marca en riesgo a un buen pagador con una sola factura recién vencida', async () => {
      prisma.invoice.findMany.mockResolvedValue([overdue('c-2', 3)]);
      prisma.customer.findMany.mockResolvedValue([{ id: 'c-2', name: 'Buen Pagador' }]);
      jest.spyOn(service as never, 'computeCustomerStats').mockResolvedValue([
        { customerId: 'c-2', name: 'Buen Pagador', onTimePct: 95, settled: 10, avgDelayDays: 1, volume: 9000 },
      ] as never);

      const res = await service.getAtRiskCustomers(user);
      expect(res.count).toBe(0);
    });

    it('marca en riesgo por atraso ≥15 días aunque sea una sola factura, si el historial es malo', async () => {
      prisma.invoice.findMany.mockResolvedValue([overdue('c-3', 20)]);
      prisma.customer.findMany.mockResolvedValue([{ id: 'c-3', name: 'Atrasado' }]);
      jest.spyOn(service as never, 'computeCustomerStats').mockResolvedValue([
        { customerId: 'c-3', name: 'Atrasado', onTimePct: 50, settled: 4, avgDelayDays: 12, volume: 4000 },
      ] as never);

      const res = await service.getAtRiskCustomers(user);
      expect(res.count).toBe(1);
      expect(res.customers[0].reason).toMatch(/16|17|18|19|20 días|días de atraso/);
    });
  });
});
