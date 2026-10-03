import { DiscountSimulatorService } from './discount-simulator.service';
import { PrismaService } from '../common/prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

const user: AuthenticatedUser = {
  id: 'u-1',
  firebaseUid: 'fb-1',
  email: 'user@royaltica.com',
  role: 'CORPORATE_ADMIN',
  organizationId: 'org-1',
  permissions: ['*'],
  supplierId: null,
  operationalProfile: null,
};

describe('DiscountSimulatorService (FR-03)', () => {
  let service: DiscountSimulatorService;
  let prisma: { invoice: { findMany: jest.Mock } };

  beforeEach(() => {
    prisma = { invoice: { findMany: jest.fn() } };
    service = new DiscountSimulatorService(prisma as unknown as PrismaService);
  });

  const invoiceOverdueBy = (days: number, total: number, customerId = 'c-1') => ({
    id: `inv-${days}`,
    total,
    date: new Date(Date.now() - (days + 30) * 86_400_000),
    dueDate: new Date(Date.now() - days * 86_400_000),
    customerId,
  });

  it('ignora facturas que no están en cartera castigada (<=90 días)', async () => {
    prisma.invoice.findMany.mockResolvedValue([invoiceOverdueBy(30, 10000)]);
    const res = await service.simulate(user, { discountPercent: 20 });
    expect(res.portfolio.outstandingAmount).toBe(0);
    expect(res.portfolio.invoices).toBe(0);
  });

  it('clasifica por balde y pondera la tasa base por monto', async () => {
    prisma.invoice.findMany.mockResolvedValue([
      invoiceOverdueBy(100, 1000, 'c-1'), // d91_180, rate 0.25
      invoiceOverdueBy(400, 1000, 'c-2'), // d300_plus, rate 0.05
    ]);
    const res = await service.simulate(user, { discountPercent: 0 });

    expect(res.portfolio.outstandingAmount).toBe(2000);
    expect(res.portfolio.customers).toBe(2);
    // promedio ponderado 50/50 de 0.25 y 0.05 = 0.15
    expect(res.baseline.recoveryRate).toBeCloseTo(0.15, 4);
  });

  it('un descuento de 0% no cambia la tasa de recuperación vs. el baseline', async () => {
    prisma.invoice.findMany.mockResolvedValue([invoiceOverdueBy(400, 10000)]);
    const res = await service.simulate(user, { discountPercent: 0, bucket: 'd300_plus' });
    expect(res.withDiscount.recoveryRate).toBe(res.baseline.recoveryRate);
    expect(res.netImpact).toBeCloseTo(
      res.withDiscount.netRecoveredAmount - res.baseline.projectedRecoveredAmount,
      2,
    );
  });

  it('un descuento muy agresivo en una cartera con tasa base ya decente puede no convenir (netImpact negativo)', async () => {
    prisma.invoice.findMany.mockResolvedValue([invoiceOverdueBy(100, 10000)]);
    // d91_180 parte de 0.25 de tasa base: regalar 70% de descuento cuesta más
    // de lo que el uplift de cobro alcanza a compensar.
    const res = await service.simulate(user, { discountPercent: 70, bucket: 'd91_180' });
    expect(res.withDiscount.netRecoveredAmount).toBeLessThan(
      res.withDiscount.grossRecoveredAmount,
    );
    expect(res.netImpact).toBeLessThan(0);
    expect(res.recommendation).toContain('MENOS');
  });

  it('filtra solo el balde pedido cuando se especifica', async () => {
    prisma.invoice.findMany.mockResolvedValue([
      invoiceOverdueBy(100, 1000, 'c-1'),
      invoiceOverdueBy(400, 5000, 'c-2'),
    ]);
    const res = await service.simulate(user, { discountPercent: 10, bucket: 'd91_180' });
    expect(res.portfolio.outstandingAmount).toBe(1000);
  });
});
