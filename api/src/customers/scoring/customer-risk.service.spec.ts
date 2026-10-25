import { CustomerRiskTier } from '@prisma/client';
import { CustomerRiskService } from './customer-risk.service';
import { PrismaService } from '../../common/prisma/prisma.service';

describe('CustomerRiskService', () => {
  let service: CustomerRiskService;
  let prisma: {
    invoice: { findMany: jest.Mock };
    customer: { findFirst: jest.Mock; update: jest.Mock };
  };

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-24T12:00:00.000Z'));
    prisma = {
      invoice: { findMany: jest.fn() },
      customer: { findFirst: jest.fn(), update: jest.fn() },
    };
    service = new CustomerRiskService(prisma as unknown as PrismaService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('sin facturas abiertas -> SANO', async () => {
    prisma.invoice.findMany.mockResolvedValue([]);
    const r = await service.recomputeOne('cust-1', 90, null);
    expect(r.tier).toBe(CustomerRiskTier.SANO);
    expect(r.maxDaysOverdue).toBe(0);
    expect(prisma.customer.update).toHaveBeenCalledWith({
      where: { id: 'cust-1' },
      data: {
        riskTier: CustomerRiskTier.SANO,
        maxDaysOverdue: 0,
        riskTierUpdatedAt: expect.any(Date),
      },
    });
  });

  it('210 días de atraso -> INCOBRABLE', async () => {
    prisma.invoice.findMany.mockResolvedValue([
      {
        total: 1000,
        date: new Date('2026-01-01'),
        dueDate: new Date('2026-03-28'), // ~210 días antes de 2026-10-24
      },
    ]);
    const r = await service.recomputeOne('cust-1', 40, null);
    expect(r.tier).toBe(CustomerRiskTier.INCOBRABLE);
    expect(r.maxDaysOverdue).toBeGreaterThanOrEqual(200);
  });

  it('160 días de atraso -> RIESGO (aún no incobrable)', async () => {
    prisma.invoice.findMany.mockResolvedValue([
      {
        total: 1000,
        date: new Date('2026-05-01'),
        dueDate: new Date('2026-05-17'), // ~160 días antes de 2026-10-24
      },
    ]);
    const r = await service.recomputeOne('cust-1', 60, null);
    expect(r.tier).toBe(CustomerRiskTier.RIESGO);
  });

  it('2 facturas vencidas + score bajo -> ATENCION', async () => {
    prisma.invoice.findMany.mockResolvedValue([
      { total: 500, date: new Date('2026-10-01'), dueDate: new Date('2026-10-10') },
      { total: 500, date: new Date('2026-10-01'), dueDate: new Date('2026-10-12') },
    ]);
    const r = await service.recomputeOne('cust-1', 50, null);
    expect(r.tier).toBe(CustomerRiskTier.ATENCION);
    expect(r.overdueCount).toBe(2);
  });

  it('atrasado pero con buen historial de pago -> SANO (no castiga a buenos pagadores)', async () => {
    prisma.invoice.findMany.mockResolvedValue([
      { total: 500, date: new Date('2026-10-01'), dueDate: new Date('2026-10-10') },
      { total: 500, date: new Date('2026-10-01'), dueDate: new Date('2026-10-12') },
    ]);
    const r = await service.recomputeOne('cust-1', 98, null);
    expect(r.tier).toBe(CustomerRiskTier.SANO);
  });

  it('sin historial de pagos (score null) + atraso -> ATENCION', async () => {
    prisma.invoice.findMany.mockResolvedValue([
      { total: 500, date: new Date('2026-09-01'), dueDate: new Date('2026-09-20') }, // >15 días
    ]);
    const r = await service.recomputeOne('cust-1', null, null);
    expect(r.tier).toBe(CustomerRiskTier.ATENCION);
  });

  it('marca worsened=true al pasar de SANO a RIESGO', async () => {
    prisma.invoice.findMany.mockResolvedValue([
      { total: 1000, date: new Date('2026-05-01'), dueDate: new Date('2026-05-17') },
    ]);
    const r = await service.recomputeOne('cust-1', 60, CustomerRiskTier.SANO);
    expect(r.tier).toBe(CustomerRiskTier.RIESGO);
    expect(r.worsened).toBe(true);
  });

  it('NO marca worsened cuando el tier mejora (RIESGO -> SANO)', async () => {
    prisma.invoice.findMany.mockResolvedValue([]);
    const r = await service.recomputeOne('cust-1', 95, CustomerRiskTier.RIESGO);
    expect(r.tier).toBe(CustomerRiskTier.SANO);
    expect(r.worsened).toBe(false);
  });

  it('NO marca worsened cuando el tier se mantiene igual', async () => {
    prisma.invoice.findMany.mockResolvedValue([]);
    const r = await service.recomputeOne('cust-1', 95, CustomerRiskTier.SANO);
    expect(r.tier).toBe(CustomerRiskTier.SANO);
    expect(r.worsened).toBe(false);
  });

  it('primer cálculo (previousTier null) SÍ alerta si ya nace en RIESGO', async () => {
    prisma.invoice.findMany.mockResolvedValue([
      { total: 1000, date: new Date('2026-05-01'), dueDate: new Date('2026-05-17') },
    ]);
    const r = await service.recomputeOne('cust-1', 60, null);
    expect(r.worsened).toBe(true);
  });

  it('primer cálculo (previousTier null) NO alerta si nace en SANO', async () => {
    prisma.invoice.findMany.mockResolvedValue([]);
    const r = await service.recomputeOne('cust-1', 90, null);
    expect(r.worsened).toBe(false);
  });
});
