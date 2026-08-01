import { ReportsService } from './reports.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { DashboardService } from '../dashboard/dashboard.service';

describe('ReportsService — reporte de cobranza en PDF', () => {
  let service: ReportsService;
  let prisma: {
    organization: { findUnique: jest.Mock };
    collectionReport: { create: jest.Mock; findFirst: jest.Mock };
  };
  let dashboard: {
    getReceivablesDigest: jest.Mock;
    getReceivablesAging: jest.Mock;
    getAtRiskCustomers: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      organization: { findUnique: jest.fn() },
      collectionReport: { create: jest.fn(), findFirst: jest.fn() },
    };
    dashboard = {
      getReceivablesDigest: jest.fn(),
      getReceivablesAging: jest.fn(),
      getAtRiskCustomers: jest.fn(),
    };
    service = new ReportsService(
      prisma as unknown as PrismaService,
      dashboard as unknown as DashboardService,
    );
  });

  it('genera un Buffer con un PDF válido (encabezado %PDF) usando el locale/moneda del tenant', async () => {
    prisma.organization.findUnique.mockResolvedValue({
      name: 'Tradespace Inc.',
      locale: 'en-CA',
      currency: 'CAD',
    });
    dashboard.getReceivablesDigest.mockResolvedValue({
      period: { from: '2026-07-25T00:00:00.000Z', to: '2026-08-01T00:00:00.000Z' },
      collected: { amount: 12000, count: 4, invoices: [] },
      reminders: { total: 6, whatsapp: 2, email: 4 },
      outstanding: { amount: 8000, count: 3 },
      generatedAt: new Date().toISOString(),
    });
    dashboard.getReceivablesAging.mockResolvedValue({
      totals: { amount: 20000, overdue: 8000, invoices: 7 },
      buckets: {
        current: { label: 'Vigente', count: 2, amount: 5000 },
        d1_30: { label: '1-30 días', count: 1, amount: 3000 },
        d31_60: { label: '31-60 días', count: 1, amount: 2000 },
        d61_90: { label: '61-90 días', count: 1, amount: 1500 },
        d90_plus: { label: '90+ días', count: 1, amount: 1500 },
      },
      byCustomer: [],
      generatedAt: new Date().toISOString(),
    });
    dashboard.getAtRiskCustomers.mockResolvedValue({
      count: 1,
      customers: [
        {
          customerId: 'c-1',
          name: 'Acme Co.',
          reason: '2 facturas vencidas',
          overdueCount: 2,
          maxDaysOverdue: 20,
          overdueAmount: 3000,
          onTimePct: 40,
        },
      ],
      generatedAt: new Date().toISOString(),
    });

    const buffer = await service.generateCollectionReportPdf('org-1', {
      from: new Date('2026-07-25T00:00:00.000Z'),
      to: new Date('2026-08-01T00:00:00.000Z'),
    });

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
    // Todo PDF válido inicia con la firma "%PDF-".
    expect(buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');

    expect(dashboard.getReceivablesDigest).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 'org-1' }),
      expect.objectContaining({ from: expect.any(String), to: expect.any(String) }),
    );
  });

  it('usa valores por defecto (es-MX/MXN) si la organización no existe', async () => {
    prisma.organization.findUnique.mockResolvedValue(null);
    dashboard.getReceivablesDigest.mockResolvedValue({
      period: { from: '', to: '' },
      collected: { amount: 0, count: 0, invoices: [] },
      reminders: { total: 0, whatsapp: 0, email: 0 },
      outstanding: { amount: 0, count: 0 },
      generatedAt: new Date().toISOString(),
    });
    dashboard.getReceivablesAging.mockResolvedValue({
      totals: { amount: 0, overdue: 0, invoices: 0 },
      buckets: {
        current: { label: 'Vigente', count: 0, amount: 0 },
        d1_30: { label: '1-30 días', count: 0, amount: 0 },
        d31_60: { label: '31-60 días', count: 0, amount: 0 },
        d61_90: { label: '61-90 días', count: 0, amount: 0 },
        d90_plus: { label: '90+ días', count: 0, amount: 0 },
      },
      byCustomer: [],
      generatedAt: new Date().toISOString(),
    });
    dashboard.getAtRiskCustomers.mockResolvedValue({
      count: 0,
      customers: [],
      generatedAt: new Date().toISOString(),
    });

    const buffer = await service.generateCollectionReportPdf('org-2', {
      from: new Date('2026-07-25T00:00:00.000Z'),
      to: new Date('2026-08-01T00:00:00.000Z'),
    });

    expect(buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  });

  it('recordReportSent registra el reporte en la bitácora', async () => {
    prisma.collectionReport.create.mockResolvedValue({});
    await service.recordReportSent(
      'org-1',
      { from: new Date('2026-07-25'), to: new Date('2026-08-01') },
      3,
    );
    expect(prisma.collectionReport.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: 'org-1',
          emailSent: true,
          recipientCount: 3,
        }),
      }),
    );
  });

  it('rechaza periodos inválidos', async () => {
    await expect(
      service.generateCollectionReportPdf('org-1', {
        from: new Date('2026-08-01T00:00:00.000Z'),
        to: new Date('2026-07-25T00:00:00.000Z'),
      }),
    ).rejects.toThrow('período');
    expect(prisma.organization.findUnique).not.toHaveBeenCalled();
  });

  it('wasReportSent detecta reportes enviados para el mismo periodo y organización', async () => {
    prisma.collectionReport.findFirst.mockResolvedValue({ id: 'rep-1' });
    const range = {
      from: new Date('2026-07-25T00:00:00.000Z'),
      to: new Date('2026-08-01T00:00:00.000Z'),
    };

    await expect(service.wasReportSent('org-1', range)).resolves.toBe(true);

    expect(prisma.collectionReport.findFirst).toHaveBeenCalledWith({
      where: {
        organizationId: 'org-1',
        periodFrom: range.from,
        periodTo: range.to,
        emailSent: true,
      },
      select: { id: true },
    });
  });

  it('recordReportSent no lanza si falla la escritura en BD', async () => {
    prisma.collectionReport.create.mockRejectedValue(new Error('db down'));
    await expect(
      service.recordReportSent(
        'org-1',
        { from: new Date('2026-07-25'), to: new Date('2026-08-01') },
        0,
      ),
    ).resolves.toBeUndefined();
  });
});
