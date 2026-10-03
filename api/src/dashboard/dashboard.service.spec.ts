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
  operationalProfile: null,
};

describe('DashboardService — indicadores CxC', () => {
  let service: DashboardService;
  let prisma: {
    invoice: { findMany: jest.Mock };
    customer: { findMany: jest.Mock };
    activityLog: { findMany: jest.Mock };
    user: { findMany: jest.Mock };
  };

  beforeEach(() => {
    prisma = {
      invoice: { findMany: jest.fn() },
      customer: { findMany: jest.fn() },
      activityLog: { findMany: jest.fn().mockResolvedValue([]) },
      user: { findMany: jest.fn().mockResolvedValue([]) },
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

  describe('getChannelEffectiveness (BI, spec "Mejoras V1")', () => {
    it('calcula la tasa de pago entre clientes con liga de pago emitida', async () => {
      prisma.activityLog.findMany.mockImplementation(({ where }: { where: { action: string } }) =>
        Promise.resolve(
          where.action === 'CUSTOMER_PORTAL_LINK_ISSUED'
            ? [{ entityId: 'c-1' }, { entityId: 'c-2' }]
            : [{ entityId: 'inv-9' }],
        ),
      );
      prisma.invoice.findMany.mockImplementation(({ where }: { where: { customerId?: unknown } }) =>
        Promise.resolve(
          where.customerId
            ? [{ status: 'PAID' }, { status: 'PENDING' }]
            : [{ status: 'PAID' }],
        ),
      );

      const res = await service.getChannelEffectiveness(user);

      expect(res.paymentLink.sampleSize).toBe(2);
      expect(res.paymentLink.effectivenessRate).toBe(0.5);
      expect(res.paymentLink.referenceRate).toBe(0.81);
      expect(res.installmentPlan.sampleSize).toBe(1);
      expect(res.installmentPlan.effectivenessRate).toBe(1);
      expect(res.installmentPlan.referenceRate).toBe(0.74);
    });

    it('sin actividad registrada, devuelve effectivenessRate null (no 0 engañoso)', async () => {
      const res = await service.getChannelEffectiveness(user);
      expect(res.paymentLink.effectivenessRate).toBeNull();
      expect(res.installmentPlan.effectivenessRate).toBeNull();
    });
  });

  describe('getAgentProductivity (BI, spec "Mejoras V1")', () => {
    it('clasifica cuentas recuperadas vs. abandonadas por agente', async () => {
      prisma.user.findMany.mockResolvedValue([{ id: 'agent-1', name: 'Ana' }]);
      prisma.customer.findMany.mockResolvedValue([{ id: 'c-1' }, { id: 'c-2' }]);
      prisma.invoice.findMany.mockResolvedValue([
        { customerId: 'c-1', status: 'PAID', date: new Date(), dueDate: new Date(), lastReminderSentAt: null },
        {
          customerId: 'c-2',
          status: 'PENDING',
          date: new Date(Date.now() - 60 * 86_400_000),
          dueDate: new Date(Date.now() - 45 * 86_400_000),
          lastReminderSentAt: null,
        },
      ]);

      const res = await service.getAgentProductivity(user);

      expect(res.agents).toEqual([
        {
          agentId: 'agent-1',
          agentName: 'Ana',
          assignedCustomers: 2,
          recoveredCustomers: 1,
          abandonedCustomers: 1,
        },
      ]);
    });

    it('agente sin clientes asignados no cuenta como abandono', async () => {
      prisma.user.findMany.mockResolvedValue([{ id: 'agent-2', name: 'Beto' }]);
      prisma.customer.findMany.mockResolvedValue([]);

      const res = await service.getAgentProductivity(user);

      expect(res.agents).toEqual([
        {
          agentId: 'agent-2',
          agentName: 'Beto',
          assignedCustomers: 0,
          recoveredCustomers: 0,
          abandonedCustomers: 0,
        },
      ]);
    });
  });
});
