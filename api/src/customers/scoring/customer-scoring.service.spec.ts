import { InvoiceStatus } from '@prisma/client';
import { CustomerScoringService } from './customer-scoring.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { SCORE_DROP_ALERT_THRESHOLD } from './customer-scoring.constants';

describe('CustomerScoringService', () => {
  let service: CustomerScoringService;
  let prisma: {
    invoice: { findMany: jest.Mock };
    customer: { findFirst: jest.Mock; update: jest.Mock };
  };

  beforeEach(() => {
    prisma = {
      invoice: { findMany: jest.fn() },
      customer: { findFirst: jest.fn(), update: jest.fn() },
    };
    service = new CustomerScoringService(prisma as unknown as PrismaService);
  });

  it('100% de facturas pagadas a tiempo -> score 100', async () => {
    prisma.invoice.findMany.mockResolvedValue([
      {
        status: InvoiceStatus.PAID,
        dueDate: new Date('2026-05-10'),
        paidDate: new Date('2026-05-08'),
      },
      {
        status: InvoiceStatus.PAID,
        dueDate: new Date('2026-05-10'),
        paidDate: new Date('2026-05-10'),
      },
    ]);

    const r = await service.recomputeOne('cust-1', null);

    expect(r.score).toBe(100);
    expect(prisma.customer.update).toHaveBeenCalledWith({
      where: { id: 'cust-1' },
      data: { score: 100, scoreUpdatedAt: expect.any(Date) },
    });
  });

  it('sin facturas liquidables (con dueDate) el score es neutral (50)', async () => {
    prisma.invoice.findMany.mockResolvedValue([]);
    const r = await service.recomputeOne('cust-1', null);
    expect(r.score).toBe(50);
  });

  it('una factura pagada sin dueDate no cuenta ni a favor ni en contra', async () => {
    prisma.invoice.findMany.mockResolvedValue([
      {
        status: InvoiceStatus.PAID,
        dueDate: null,
        paidDate: new Date('2026-05-08'),
      },
    ]);
    const r = await service.recomputeOne('cust-1', null);
    expect(r.score).toBe(50); // ninguna factura "liquidable" cuenta
  });

  it('1 de 2 pagadas a tiempo -> score 50', async () => {
    prisma.invoice.findMany.mockResolvedValue([
      {
        status: InvoiceStatus.PAID,
        dueDate: new Date('2026-05-10'),
        paidDate: new Date('2026-05-20'), // tarde
      },
      {
        status: InvoiceStatus.PAID,
        dueDate: new Date('2026-05-10'),
        paidDate: new Date('2026-05-09'), // a tiempo
      },
    ]);
    const r = await service.recomputeOne('cust-1', null);
    expect(r.score).toBe(50);
  });

  it('detecta una caída significativa (ej. de 93 a 61, el ejemplo del spec)', async () => {
    // 6 de ~9.8 -> fuerzo un score de 61 con 11 pagos, 7 a tiempo.
    const invoices = Array.from({ length: 11 }, (_, i) => ({
      status: InvoiceStatus.PAID,
      dueDate: new Date('2026-05-10'),
      paidDate: new Date(i < 7 ? '2026-05-09' : '2026-05-20'),
    }));
    prisma.invoice.findMany.mockResolvedValue(invoices);

    const r = await service.recomputeOne('cust-1', 93);

    expect(r.score).toBe(64); // round(7/11*100)
    expect(r.previousScore).toBe(93);
    expect(93 - r.score).toBeGreaterThanOrEqual(SCORE_DROP_ALERT_THRESHOLD);
    expect(r.droppedSignificantly).toBe(true);
  });

  it('una caída pequeña NO dispara la alerta', async () => {
    prisma.invoice.findMany.mockResolvedValue([
      {
        status: InvoiceStatus.PAID,
        dueDate: new Date('2026-05-10'),
        paidDate: new Date('2026-05-09'),
      },
    ]);
    const r = await service.recomputeOne('cust-1', 100); // score nuevo: 100, sin caída
    expect(r.droppedSignificantly).toBe(false);
  });

  it('sin score previo (primer cálculo) nunca marca caída', async () => {
    prisma.invoice.findMany.mockResolvedValue([]);
    const r = await service.recomputeOne('cust-1', null);
    expect(r.droppedSignificantly).toBe(false);
  });
});
