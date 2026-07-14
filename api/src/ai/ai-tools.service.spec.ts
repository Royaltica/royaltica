import { AiToolsService } from './ai-tools.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { DashboardService } from '../dashboard/dashboard.service';

describe('AiToolsService (aislamiento multi-tenant)', () => {
  let service: AiToolsService;
  let dashboard: { getFinancialRatios: jest.Mock };
  let prisma: {
    invoice: { findMany: jest.Mock; groupBy: jest.Mock; aggregate: jest.Mock };
    supplier: { findMany: jest.Mock; findFirst: jest.Mock; count: jest.Mock };
    supplierDocument: { count: jest.Mock };
    payment: { findMany: jest.Mock };
    factorajeRequest: { findMany: jest.Mock; groupBy: jest.Mock };
  };

  const ORG = 'org-1';

  beforeEach(() => {
    prisma = {
      invoice: {
        findMany: jest.fn().mockResolvedValue([]),
        groupBy: jest.fn().mockResolvedValue([]),
        aggregate: jest.fn().mockResolvedValue({ _sum: { total: null } }),
      },
      supplier: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(0),
      },
      supplierDocument: { count: jest.fn().mockResolvedValue(0) },
      payment: { findMany: jest.fn().mockResolvedValue([]) },
      factorajeRequest: {
        findMany: jest.fn().mockResolvedValue([]),
        groupBy: jest.fn().mockResolvedValue([]),
      },
    };
    dashboard = { getFinancialRatios: jest.fn().mockResolvedValue({}) };
    service = new AiToolsService(
      prisma as unknown as PrismaService,
      dashboard as unknown as DashboardService,
    );
  });

  it('get_financial_ratios delega en DashboardService con el organizationId del JWT', async () => {
    await service.execute('get_financial_ratios', {}, ORG);
    expect(dashboard.getFinancialRatios).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: ORG }),
    );
  });

  it('get_invoices SIEMPRE filtra por el organizationId recibido, ignorando args ajenos', async () => {
    await service.execute(
      'get_invoices',
      { status: 'PAID', organizationId: 'org-HACKEADA' },
      ORG,
    );
    const where = prisma.invoice.findMany.mock.calls[0][0].where;
    expect(where.organizationId).toBe(ORG);
    expect(where.status).toBe('PAID');
  });

  it('get_invoices descarta un status inválido (no lo pone en el where)', async () => {
    await service.execute('get_invoices', { status: 'NO_EXISTE' }, ORG);
    const where = prisma.invoice.findMany.mock.calls[0][0].where;
    expect(where.status).toBeUndefined();
  });

  it('get_invoices acota el límite pedido por el modelo a máximo 50', async () => {
    await service.execute('get_invoices', { limit: 9999 }, ORG);
    expect(prisma.invoice.findMany.mock.calls[0][0].take).toBe(50);
  });

  it('get_supplier_detail no encuentra un proveedor de otra organización', async () => {
    prisma.supplier.findFirst.mockResolvedValue(null);
    const r = await service.execute(
      'get_supplier_detail',
      { supplierId: 'sup-de-otra-org' },
      ORG,
    );
    const where = prisma.supplier.findFirst.mock.calls[0][0].where;
    expect(where.organizationId).toBe(ORG);
    expect(r).toEqual({ error: 'Proveedor no encontrado en esta organización.' });
  });

  it('get_factoraje_requests filtra por supplier.organizationId', async () => {
    await service.execute('get_factoraje_requests', {}, ORG);
    const where = prisma.factorajeRequest.findMany.mock.calls[0][0].where;
    expect(where.supplier).toEqual({ organizationId: ORG });
  });

  it('una herramienta desconocida devuelve un error controlado', async () => {
    const r = await service.execute('drop_table', {}, ORG);
    expect(r).toHaveProperty('error');
  });
});
