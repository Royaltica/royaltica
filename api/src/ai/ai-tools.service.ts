import { Injectable, Logger } from '@nestjs/common';
import {
  FactorajeStatus,
  ForensicStatus,
  InvoiceStatus,
  PaymentStatus,
  type Prisma,
} from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { DashboardService } from '../dashboard/dashboard.service';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

const num = (v: Prisma.Decimal | null): number => (v ? Number(v) : 0);

/** Acota un límite pedido por el modelo al rango seguro [1, 50]. */
const clampLimit = (raw: unknown, fallback = 20): number => {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(50, Math.max(1, Math.trunc(n)));
};

const isEnumValue = <T extends Record<string, string>>(
  e: T,
  v: unknown,
): v is T[keyof T] =>
  typeof v === 'string' && (Object.values(e) as string[]).includes(v);

type ToolArgs = Record<string, unknown>;

/**
 * Ejecuta las herramientas que Gemini solicita durante el chat.
 *
 * Regla de oro de aislamiento multi-tenant: `organizationId` SIEMPRE llega
 * como argumento explícito de `execute()` (lo pone AiService desde el JWT),
 * NUNCA desde los `args` que produce el modelo. Cada query Prisma filtra por
 * ese organizationId, así que el asistente jamás puede leer datos de otra
 * organización aunque el modelo invente ids o filtros.
 *
 * Todas las herramientas son de SOLO LECTURA. No hay ninguna que escriba.
 */
@Injectable()
export class AiToolsService {
  private readonly logger = new Logger(AiToolsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly dashboard: DashboardService,
  ) {}

  /** Despacha por nombre de herramienta. Devolver un objeto plano serializable. */
  async execute(
    name: string,
    args: ToolArgs,
    organizationId: string,
  ): Promise<Record<string, unknown>> {
    // Una sola transacción con RLS activa para toda la herramienta: `tx`
    // baja a cada método privado en vez de usar this.prisma directo, así
    // Postgres refuerza el aislamiento por organización aunque alguna
    // consulta abajo olvide el filtro manual.
    return this.prisma.withOrg(organizationId, async (tx) => {
      switch (name) {
        case 'get_dashboard_overview':
          return this.dashboardOverview(tx, organizationId);
        case 'get_aging_report':
          return this.agingReport(tx, organizationId);
        case 'get_invoices':
          return this.invoices(tx, organizationId, args);
        case 'get_suppliers':
          return this.suppliers(tx, organizationId, args);
        case 'get_supplier_detail':
          return this.supplierDetail(tx, organizationId, args);
        case 'get_payments':
          return this.payments(tx, organizationId, args);
        case 'get_factoraje_requests':
          return this.factorajeRequests(tx, organizationId, args);
        case 'get_financial_ratios':
          return this.financialRatios(organizationId);
        case 'get_audit_summary':
          return this.auditSummary(tx, organizationId);
        case 'get_financial_statements':
          return this.financialStatements(tx, organizationId, args);
        case 'get_activity_log':
          return this.activityLog(tx, organizationId, args);
        default:
          this.logger.warn(`Herramienta desconocida solicitada: ${name}`);
          return { error: `Herramienta no soportada: ${name}` };
      }
    });
  }

  /**
   * Razones financieras de CxP (la pestaña Contabilidad → Razones de CxP):
   * DPO, puntualidad de pago, rotación, concentración de proveedores, costo de
   * factoraje y ahorro por auditoría forense. Reusa el cálculo autoritativo de
   * DashboardService (el `user` solo aporta organizationId, ya validado aquí).
   */
  private async financialRatios(organizationId: string) {
    return this.dashboard.getFinancialRatios({
      organizationId,
    } as AuthenticatedUser);
  }

  /**
   * Resumen de la pestaña AUDITORÍA: resultado de la auditoría forense por
   * estado (validadas/discrepancia/bloqueadas/pendientes) con conteos y montos,
   * las facturas de mayor riesgo, y el cumplimiento de complementos de pago
   * (REP): cuántas facturas PPD están pendientes de complemento.
   */
  private async auditSummary(tx: Prisma.TransactionClient, organizationId: string) {
    const [forensic, repGroups, topRisk] = await Promise.all([
      tx.invoice.groupBy({
        by: ['forensicStatus'],
        where: { organizationId, deletedAt: null },
        _count: { _all: true },
        _sum: { total: true },
      }),
      tx.invoice.groupBy({
        by: ['repStatus'],
        where: { organizationId, deletedAt: null },
        _count: { _all: true },
      }),
      tx.invoice.findMany({
        where: {
          organizationId,
          deletedAt: null,
          forensicStatus: {
            in: [ForensicStatus.BLOCKED, ForensicStatus.DISCREPANCY],
          },
        },
        take: 10,
        orderBy: { total: 'desc' },
        select: {
          id: true,
          folio: true,
          cfdiUuid: true,
          total: true,
          forensicStatus: true,
          forensicScore: true,
          supplier: { select: { name: true } },
        },
      }),
    ]);

    const byForensicStatus = Object.fromEntries(
      Object.values(ForensicStatus).map((s) => [s, { count: 0, amount: 0 }]),
    ) as Record<string, { count: number; amount: number }>;
    for (const g of forensic) {
      byForensicStatus[g.forensicStatus] = {
        count: g._count._all,
        amount: num(g._sum.total),
      };
    }

    const byRepStatus: Record<string, number> = { NA: 0, PENDING: 0, RECEIVED: 0 };
    for (const g of repGroups) byRepStatus[g.repStatus] = g._count._all;

    return {
      currency: 'MXN',
      forensic: {
        byStatus: byForensicStatus,
        atRiskAmount:
          byForensicStatus.BLOCKED.amount + byForensicStatus.DISCREPANCY.amount,
      },
      rep: {
        // PENDING = facturas PPD pagadas a las que aún falta el complemento de pago.
        pendingComplement: byRepStatus.PENDING,
        received: byRepStatus.RECEIVED,
        notApplicable: byRepStatus.NA,
      },
      topRisk: topRisk.map((i) => ({
        id: i.id,
        folio: i.folio ?? i.cfdiUuid,
        total: num(i.total),
        forensicStatus: i.forensicStatus,
        forensicScore: i.forensicScore,
        supplierName: i.supplier.name,
      })),
    };
  }

  /**
   * Pestaña HISTORIAL → Estados Financieros: lista los estados de resultados
   * generados por período (ingresos, costos, opex, utilidad neta).
   */
  private async financialStatements(
    tx: Prisma.TransactionClient,
    organizationId: string,
    args: ToolArgs,
  ) {
    const rows = await tx.financialStatement.findMany({
      where: { organizationId },
      take: clampLimit(args.limit, 12),
      orderBy: { period: 'desc' },
      select: {
        period: true,
        type: true,
        revenue: true,
        costs: true,
        opex: true,
        netIncome: true,
        generatedAt: true,
      },
    });
    return {
      currency: 'MXN',
      count: rows.length,
      statements: rows.map((s) => ({
        period: s.period,
        type: s.type,
        revenue: num(s.revenue),
        costs: num(s.costs),
        opex: num(s.opex),
        netIncome: num(s.netIncome),
        generatedAt: s.generatedAt.toISOString(),
      })),
    };
  }

  /**
   * Pestaña HISTORIAL → bitácora de actividad: eventos recientes de la
   * organización (acción, entidad afectada, usuario, fecha).
   */
  private async activityLog(
    tx: Prisma.TransactionClient,
    organizationId: string,
    args: ToolArgs,
  ) {
    const rows = await tx.activityLog.findMany({
      where: { organizationId },
      take: clampLimit(args.limit, 20),
      orderBy: { createdAt: 'desc' },
      select: {
        action: true,
        entityType: true,
        createdAt: true,
        user: { select: { name: true } },
      },
    });
    return {
      count: rows.length,
      activity: rows.map((a) => ({
        action: a.action,
        entityType: a.entityType,
        user: a.user?.name ?? 'Sistema',
        createdAt: a.createdAt.toISOString(),
      })),
    };
  }

  private async dashboardOverview(
    tx: Prisma.TransactionClient,
    organizationId: string,
  ) {
    const [groups, invoiced, paid, pending, suppliers, approved, factoraje] =
      await Promise.all([
        tx.invoice.groupBy({
          by: ['status'],
          where: { organizationId, deletedAt: null },
          _count: { _all: true },
        }),
        tx.invoice.aggregate({
          where: { organizationId, deletedAt: null },
          _sum: { total: true },
        }),
        tx.invoice.aggregate({
          where: { organizationId, deletedAt: null, status: InvoiceStatus.PAID },
          _sum: { total: true },
        }),
        tx.invoice.aggregate({
          where: {
            organizationId,
            deletedAt: null,
            status: {
              in: [
                InvoiceStatus.PENDING,
                InvoiceStatus.AUDITED,
                InvoiceStatus.APPROVED,
              ],
            },
          },
          _sum: { total: true },
        }),
        tx.supplier.count({
          where: { organizationId, deletedAt: null },
        }),
        tx.supplier.count({
          where: { organizationId, deletedAt: null, isApproved: true },
        }),
        tx.factorajeRequest.groupBy({
          by: ['status'],
          where: { supplier: { organizationId } },
          _count: { _all: true },
          _sum: { netAmount: true },
        }),
      ]);

    const invoicesByStatus = Object.fromEntries(
      Object.values(InvoiceStatus).map((s) => [s, 0]),
    ) as Record<string, number>;
    for (const g of groups) invoicesByStatus[g.status] = g._count._all;

    const factorajeActive = factoraje.find(
      (f) => f.status === FactorajeStatus.DISBURSED,
    );
    const factorajePending = factoraje.find(
      (f) => f.status === FactorajeStatus.PENDING,
    );

    return {
      currency: 'MXN',
      invoices: {
        byStatus: invoicesByStatus,
        total: Object.values(invoicesByStatus).reduce((a, b) => a + b, 0),
      },
      amounts: {
        totalInvoiced: num(invoiced._sum.total),
        totalPaid: num(paid._sum.total),
        totalPending: num(pending._sum.total),
      },
      suppliers: { total: suppliers, approved, pending: suppliers - approved },
      factoraje: {
        activeDisbursedAmount: num(factorajeActive?._sum.netAmount ?? null),
        pendingRequests: factorajePending?._count._all ?? 0,
      },
    };
  }

  private async agingReport(tx: Prisma.TransactionClient, organizationId: string) {
    const now = Date.now();
    const invoices = await tx.invoice.findMany({
      where: {
        organizationId,
        deletedAt: null,
        status: {
          in: [
            InvoiceStatus.PENDING,
            InvoiceStatus.AUDITED,
            InvoiceStatus.APPROVED,
          ],
        },
      },
      select: {
        total: true,
        date: true,
        dueDate: true,
        supplierId: true,
        supplier: { select: { name: true } },
      },
    });

    const buckets = {
      current: { label: 'Vigente', count: 0, amount: 0 },
      d1_30: { label: '1-30 días', count: 0, amount: 0 },
      d31_60: { label: '31-60 días', count: 0, amount: 0 },
      d61_90: { label: '61-90 días', count: 0, amount: 0 },
      d90_plus: { label: '90+ días', count: 0, amount: 0 },
    };
    const bySupplier = new Map<string, { name: string; amount: number }>();
    let totalAmount = 0;
    let totalOverdue = 0;

    for (const inv of invoices) {
      const amount = num(inv.total);
      totalAmount += amount;
      const daysOverdue = Math.floor(
        (now - (inv.dueDate ?? inv.date).getTime()) / 86_400_000,
      );
      const bucket =
        daysOverdue <= 0
          ? buckets.current
          : daysOverdue <= 30
            ? buckets.d1_30
            : daysOverdue <= 60
              ? buckets.d31_60
              : daysOverdue <= 90
                ? buckets.d61_90
                : buckets.d90_plus;
      bucket.count += 1;
      bucket.amount += amount;
      if (daysOverdue > 0) totalOverdue += amount;

      const agg = bySupplier.get(inv.supplierId) ?? {
        name: inv.supplier.name,
        amount: 0,
      };
      agg.amount += amount;
      bySupplier.set(inv.supplierId, agg);
    }

    return {
      currency: 'MXN',
      totals: {
        amount: totalAmount,
        overdue: totalOverdue,
        invoices: invoices.length,
      },
      buckets,
      topSuppliers: [...bySupplier.values()]
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 10),
    };
  }

  private async invoices(
    tx: Prisma.TransactionClient,
    organizationId: string,
    args: ToolArgs,
  ) {
    const where: Prisma.InvoiceWhereInput = {
      organizationId,
      deletedAt: null,
    };
    if (isEnumValue(InvoiceStatus, args.status)) where.status = args.status;
    if (isEnumValue(ForensicStatus, args.forensicStatus)) {
      where.forensicStatus = args.forensicStatus;
    }
    if (typeof args.supplierId === 'string') where.supplierId = args.supplierId;

    const rows = await tx.invoice.findMany({
      where,
      take: clampLimit(args.limit),
      orderBy: { date: 'desc' },
      select: {
        id: true,
        folio: true,
        cfdiUuid: true,
        total: true,
        currency: true,
        status: true,
        forensicStatus: true,
        forensicScore: true,
        paymentType: true,
        date: true,
        dueDate: true,
        repStatus: true,
        supplier: { select: { id: true, name: true } },
      },
    });

    return {
      count: rows.length,
      invoices: rows.map((i) => ({
        id: i.id,
        folio: i.folio,
        cfdiUuid: i.cfdiUuid,
        total: num(i.total),
        currency: i.currency,
        status: i.status,
        forensicStatus: i.forensicStatus,
        forensicScore: i.forensicScore,
        paymentType: i.paymentType,
        date: i.date.toISOString(),
        dueDate: i.dueDate?.toISOString() ?? null,
        repStatus: i.repStatus,
        supplierId: i.supplier.id,
        supplierName: i.supplier.name,
      })),
    };
  }

  private async suppliers(
    tx: Prisma.TransactionClient,
    organizationId: string,
    args: ToolArgs,
  ) {
    const where: Prisma.SupplierWhereInput = {
      organizationId,
      deletedAt: null,
    };
    if (typeof args.approved === 'boolean') where.isApproved = args.approved;
    if (typeof args.search === 'string' && args.search.trim()) {
      const q = args.search.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { legalName: { contains: q, mode: 'insensitive' } },
        { rfc: { contains: q, mode: 'insensitive' } },
      ];
    }

    const rows = await tx.supplier.findMany({
      where,
      take: clampLimit(args.limit),
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        rfc: true,
        category: true,
        isApproved: true,
        score: true,
        seniorityYears: true,
        capitalAmount: true,
      },
    });

    return {
      count: rows.length,
      suppliers: rows.map((s) => ({
        id: s.id,
        name: s.name,
        rfc: s.rfc,
        category: s.category,
        isApproved: s.isApproved,
        score: s.score,
        seniorityYears: s.seniorityYears,
        capitalAmount: num(s.capitalAmount),
      })),
    };
  }

  private async supplierDetail(
    tx: Prisma.TransactionClient,
    organizationId: string,
    args: ToolArgs,
  ) {
    if (typeof args.supplierId !== 'string') {
      return { error: 'Falta el parámetro supplierId.' };
    }
    // El filtro por organizationId garantiza que un id de otra organización
    // simplemente no se encuentre (no se filtra información cruzada).
    const supplier = await tx.supplier.findFirst({
      where: { id: args.supplierId, organizationId, deletedAt: null },
      select: {
        id: true,
        name: true,
        rfc: true,
        legalName: true,
        category: true,
        activity: true,
        isApproved: true,
        score: true,
        scoreUpdatedAt: true,
        seniorityYears: true,
        capitalAmount: true,
        email: true,
        contact: true,
      },
    });
    if (!supplier) {
      return { error: 'Proveedor no encontrado en esta organización.' };
    }

    const [invoiceGroups, docs, factoraje] = await Promise.all([
      tx.invoice.groupBy({
        by: ['status'],
        where: { supplierId: supplier.id, deletedAt: null },
        _count: { _all: true },
        _sum: { total: true },
      }),
      tx.supplierDocument.count({
        where: { supplierId: supplier.id, deletedAt: null },
      }),
      tx.factorajeRequest.groupBy({
        by: ['status'],
        where: { supplierId: supplier.id },
        _count: { _all: true },
        _sum: { netAmount: true },
      }),
    ]);

    return {
      supplier: {
        ...supplier,
        capitalAmount: num(supplier.capitalAmount),
        scoreUpdatedAt: supplier.scoreUpdatedAt?.toISOString() ?? null,
      },
      documentsCount: docs,
      invoices: invoiceGroups.map((g) => ({
        status: g.status,
        count: g._count._all,
        amount: num(g._sum.total),
      })),
      factoraje: factoraje.map((f) => ({
        status: f.status,
        count: f._count._all,
        netAmount: num(f._sum.netAmount),
      })),
    };
  }

  private async payments(
    tx: Prisma.TransactionClient,
    organizationId: string,
    args: ToolArgs,
  ) {
    const where: Prisma.PaymentWhereInput = { organizationId };
    if (isEnumValue(PaymentStatus, args.status)) where.status = args.status;

    const rows = await tx.payment.findMany({
      where,
      take: clampLimit(args.limit),
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        totalAmount: true,
        route: true,
        status: true,
        scheduledDate: true,
        processedAt: true,
        createdAt: true,
        _count: { select: { invoices: true } },
      },
    });

    return {
      count: rows.length,
      payments: rows.map((p) => ({
        id: p.id,
        totalAmount: num(p.totalAmount),
        route: p.route,
        status: p.status,
        invoiceCount: p._count.invoices,
        scheduledDate: p.scheduledDate?.toISOString() ?? null,
        processedAt: p.processedAt?.toISOString() ?? null,
        createdAt: p.createdAt.toISOString(),
      })),
    };
  }

  private async factorajeRequests(
    tx: Prisma.TransactionClient,
    organizationId: string,
    args: ToolArgs,
  ) {
    const where: Prisma.FactorajeRequestWhereInput = {
      supplier: { organizationId },
    };
    if (isEnumValue(FactorajeStatus, args.status)) where.status = args.status;

    const rows = await tx.factorajeRequest.findMany({
      where,
      take: clampLimit(args.limit),
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        requestedAmount: true,
        fee: true,
        netAmount: true,
        status: true,
        createdAt: true,
        resolvedAt: true,
        supplier: { select: { id: true, name: true } },
        invoice: { select: { id: true, folio: true, cfdiUuid: true } },
      },
    });

    return {
      count: rows.length,
      requests: rows.map((r) => ({
        id: r.id,
        requestedAmount: num(r.requestedAmount),
        fee: num(r.fee),
        netAmount: num(r.netAmount),
        status: r.status,
        supplierId: r.supplier.id,
        supplierName: r.supplier.name,
        invoiceFolio: r.invoice.folio ?? r.invoice.cfdiUuid,
        createdAt: r.createdAt.toISOString(),
        resolvedAt: r.resolvedAt?.toISOString() ?? null,
      })),
    };
  }
}
