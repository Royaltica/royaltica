import { ForbiddenException, Injectable } from '@nestjs/common';
import {
  FactorajeStatus,
  ForensicStatus,
  InvoiceStatus,
  type Prisma,
} from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

const num = (v: Prisma.Decimal | null): number => (v ? Number(v) : 0);

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  async getOverview(user: AuthenticatedUser) {
    const organizationId = user.organizationId;
    if (!organizationId) {
      throw new ForbiddenException('Tu cuenta no pertenece a una organización.');
    }

    const { documentAlertDays } = await this.settings.get(organizationId);
    const now = new Date();
    const expiryLimit = new Date(
      now.getTime() + documentAlertDays * 86_400_000,
    );

    const [
      invoiceGroups,
      invoiced,
      paid,
      pending,
      suppliersTotal,
      suppliersApproved,
      capital,
      expiringDocs,
      factorajeActive,
      factorajePending,
    ] = await Promise.all([
      this.prisma.invoice.groupBy({
        by: ['status'],
        where: { organizationId },
        _count: { _all: true },
        orderBy: { status: 'asc' },
      }),
      this.prisma.invoice.aggregate({
        where: { organizationId },
        _sum: { total: true },
      }),
      this.prisma.invoice.aggregate({
        where: { organizationId, status: InvoiceStatus.PAID },
        _sum: { total: true },
      }),
      this.prisma.invoice.aggregate({
        where: {
          organizationId,
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
      this.prisma.supplier.count({
        where: { organizationId, deletedAt: null },
      }),
      this.prisma.supplier.count({
        where: { organizationId, deletedAt: null, isApproved: true },
      }),
      this.prisma.supplier.aggregate({
        where: { organizationId, deletedAt: null },
        _sum: { capitalAmount: true },
      }),
      this.prisma.supplierDocument.findMany({
        where: {
          deletedAt: null,
          supplier: { organizationId, deletedAt: null },
          expiresAt: { gte: now, lte: expiryLimit },
        },
        select: {
          id: true,
          type: true,
          fileName: true,
          expiresAt: true,
          supplier: { select: { id: true, name: true } },
        },
        orderBy: { expiresAt: 'asc' },
      }),
      this.prisma.factorajeRequest.aggregate({
        where: {
          status: FactorajeStatus.DISBURSED,
          supplier: { organizationId },
        },
        _sum: { netAmount: true },
      }),
      this.prisma.factorajeRequest.count({
        where: {
          status: FactorajeStatus.PENDING,
          supplier: { organizationId },
        },
      }),
    ]);

    // Normaliza los conteos de facturas a todos los estados posibles.
    const byStatus = Object.fromEntries(
      Object.values(InvoiceStatus).map((s) => [s, 0]),
    ) as Record<InvoiceStatus, number>;
    let invoicesTotal = 0;
    for (const g of invoiceGroups) {
      byStatus[g.status] = g._count._all;
      invoicesTotal += g._count._all;
    }

    const documentsExpiring = expiringDocs.map((d) => ({
      id: d.id,
      type: d.type,
      fileName: d.fileName,
      supplierId: d.supplier.id,
      supplierName: d.supplier.name,
      expiresAt: d.expiresAt,
      daysLeft: d.expiresAt
        ? Math.ceil((d.expiresAt.getTime() - now.getTime()) / 86_400_000)
        : null,
    }));

    return {
      invoices: { byStatus, total: invoicesTotal },
      amounts: {
        totalInvoiced: num(invoiced._sum.total),
        totalPaid: num(paid._sum.total),
        totalPending: num(pending._sum.total),
      },
      suppliers: {
        total: suppliersTotal,
        approved: suppliersApproved,
        pending: suppliersTotal - suppliersApproved,
      },
      capital: { total: num(capital._sum.capitalAmount) },
      documentsExpiring,
      factoraje: {
        activeAmount: num(factorajeActive._sum.netAmount),
        pendingRequests: factorajePending,
      },
      generatedAt: now.toISOString(),
    };
  }

  /**
   * Reporte de antigüedad de saldos (CxP). Clasifica las facturas no
   * pagadas por días vencidos según su fecha de vencimiento (o de emisión
   * si no tiene dueDate) en cubetas estándar: vigente, 1-30, 31-60, 61-90 y 90+.
   */
  async getAging(user: AuthenticatedUser) {
    const organizationId = user.organizationId;
    if (!organizationId) {
      throw new ForbiddenException('Tu cuenta no pertenece a una organización.');
    }

    const now = Date.now();
    const invoices = await this.prisma.invoice.findMany({
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
    const bySupplier = new Map<
      string,
      { supplierId: string; name: string; amount: number; overdue: number }
    >();

    let totalAmount = 0;
    let totalOverdue = 0;

    for (const inv of invoices) {
      const amount = num(inv.total);
      totalAmount += amount;
      const reference = (inv.dueDate ?? inv.date).getTime();
      const daysOverdue = Math.floor((now - reference) / 86_400_000);

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
        supplierId: inv.supplierId,
        name: inv.supplier.name,
        amount: 0,
        overdue: 0,
      };
      agg.amount += amount;
      if (daysOverdue > 0) agg.overdue += amount;
      bySupplier.set(inv.supplierId, agg);
    }

    return {
      totals: {
        amount: totalAmount,
        overdue: totalOverdue,
        invoices: invoices.length,
      },
      buckets,
      bySupplier: [...bySupplier.values()].sort((a, b) => b.amount - a.amount),
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Razones financieras de Cuentas por Pagar (CxP). Métricas operativas y de
   * riesgo que un director financiero usa para decidir, calculadas con los
   * datos reales de Royáltica (facturas, pagos, factoraje, auditoría):
   *  1. DPO — días promedio que tarda la empresa en pagar a sus proveedores.
   *  2. Puntualidad — % de facturas pagadas a tiempo vs tarde.
   *  3. Rotación de CxP — cuántas veces se "da vuelta" a la deuda con proveedores.
   *  4. Concentración — % de la deuda en los 5 proveedores más grandes (riesgo).
   *  5. Costo de factoraje — comisiones pagadas vs monto financiado.
   *  6. Ahorro por auditoría — monto bloqueado por la auditoría forense (fraude/dupes).
   */
  async getFinancialRatios(user: AuthenticatedUser) {
    const organizationId = user.organizationId;
    if (!organizationId) {
      throw new ForbiddenException('Tu cuenta no pertenece a una organización.');
    }

    const DAY = 86_400_000;
    const UNPAID = [
      InvoiceStatus.PENDING,
      InvoiceStatus.AUDITED,
      InvoiceStatus.APPROVED,
    ];

    const [
      paidInvoices,
      comprasAgg,
      outstandingAgg,
      outstandingBySupplier,
      factoraje,
      blocked,
      discrepancy,
    ] = await Promise.all([
      this.prisma.invoice.findMany({
        where: {
          organizationId,
          deletedAt: null,
          status: InvoiceStatus.PAID,
          paidDate: { not: null },
        },
        select: { date: true, dueDate: true, paidDate: true, total: true },
      }),
      this.prisma.invoice.aggregate({
        where: { organizationId, deletedAt: null },
        _sum: { total: true },
        _count: { _all: true },
      }),
      this.prisma.invoice.aggregate({
        where: { organizationId, deletedAt: null, status: { in: UNPAID } },
        _sum: { total: true },
      }),
      this.prisma.invoice.groupBy({
        by: ['supplierId'],
        where: { organizationId, deletedAt: null, status: { in: UNPAID } },
        _sum: { total: true },
      }),
      this.prisma.factorajeRequest.aggregate({
        where: {
          supplier: { organizationId },
          status: { in: [FactorajeStatus.APPROVED, FactorajeStatus.DISBURSED] },
        },
        _sum: { fee: true, requestedAmount: true, netAmount: true },
        _count: { _all: true },
      }),
      this.prisma.invoice.aggregate({
        where: {
          organizationId,
          deletedAt: null,
          forensicStatus: ForensicStatus.BLOCKED,
        },
        _sum: { total: true },
        _count: { _all: true },
      }),
      this.prisma.invoice.aggregate({
        where: {
          organizationId,
          deletedAt: null,
          forensicStatus: ForensicStatus.DISCREPANCY,
        },
        _sum: { total: true },
        _count: { _all: true },
      }),
    ]);

    // ── 1. DPO + 2. Puntualidad (recorre las facturas pagadas una vez) ──
    let totalDays = 0;
    let dpoCount = 0;
    let onTime = 0;
    let late = 0;
    for (const inv of paidInvoices) {
      if (!inv.paidDate) continue;
      const days = Math.max(
        0,
        Math.round((inv.paidDate.getTime() - inv.date.getTime()) / DAY),
      );
      totalDays += days;
      dpoCount += 1;
      if (inv.dueDate) {
        if (inv.paidDate.getTime() <= inv.dueDate.getTime()) onTime += 1;
        else late += 1;
      }
    }
    const dpo = dpoCount > 0 ? Math.round(totalDays / dpoCount) : 0;
    const settled = onTime + late;
    const onTimePct = settled > 0 ? Math.round((onTime / settled) * 100) : 0;

    // ── 3. Rotación de CxP (compras / saldo de CxP) ──
    const compras = num(comprasAgg._sum.total);
    const cxpActual = num(outstandingAgg._sum.total);
    const rotacion =
      cxpActual > 0 ? Math.round((compras / cxpActual) * 10) / 10 : 0;

    // ── 4. Concentración de proveedores (top 5 sobre el total de CxP) ──
    const ordered = outstandingBySupplier
      .map((g) => ({ supplierId: g.supplierId, amount: num(g._sum.total) }))
      .sort((a, b) => b.amount - a.amount);
    const top5 = ordered.slice(0, 5);
    const supplierNames = await this.prisma.supplier.findMany({
      where: { id: { in: top5.map((s) => s.supplierId) } },
      select: { id: true, name: true },
    });
    const nameById = new Map(supplierNames.map((s) => [s.id, s.name]));
    const top5Amount = top5.reduce((acc, s) => acc + s.amount, 0);
    const concentrationPct =
      cxpActual > 0 ? Math.round((top5Amount / cxpActual) * 100) : 0;

    // ── 5. Costo de financiamiento por factoraje ──
    const facFee = num(factoraje._sum.fee);
    const facReq = num(factoraje._sum.requestedAmount);
    const facCostPct =
      facReq > 0 ? Math.round((facFee / facReq) * 1000) / 10 : 0;

    // ── 6. Ahorro por auditoría forense (lo que se bloqueó) ──
    const blockedAmount = num(blocked._sum.total);
    const discrepancyAmount = num(discrepancy._sum.total);

    return {
      dpo: {
        label: 'Días promedio de pago (DPO)',
        value: dpo,
        unit: 'días',
        basis: dpoCount,
      },
      punctuality: {
        label: 'Facturas pagadas a tiempo',
        onTimePct,
        onTime,
        late,
        settled,
      },
      turnover: {
        label: 'Rotación de cuentas por pagar',
        value: rotacion,
        unit: 'veces',
        compras,
        cxpActual,
      },
      supplierConcentration: {
        label: 'Concentración en top 5 proveedores',
        concentrationPct,
        totalCxp: cxpActual,
        top: top5.map((s) => ({
          supplierId: s.supplierId,
          name: nameById.get(s.supplierId) ?? '—',
          amount: s.amount,
          sharePct: cxpActual > 0 ? Math.round((s.amount / cxpActual) * 100) : 0,
        })),
      },
      factorajeCost: {
        label: 'Costo de financiamiento (factoraje)',
        costPct: facCostPct,
        totalFee: facFee,
        totalFinanced: facReq,
        operations: factoraje._count._all,
      },
      forensicSavings: {
        label: 'Protegido por auditoría forense',
        blockedAmount,
        blockedCount: blocked._count._all,
        discrepancyAmount,
        discrepancyCount: discrepancy._count._all,
      },
      generatedAt: new Date().toISOString(),
    };
  }
}
