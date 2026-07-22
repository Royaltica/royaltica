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

  private requireOrg(user: AuthenticatedUser): string {
    if (!user.organizationId) {
      throw new ForbiddenException('Tu cuenta no pertenece a una organización.');
    }
    return user.organizationId;
  }

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
        where: { organizationId, direction: 'PAYABLE' },
        _count: { _all: true },
        orderBy: { status: 'asc' },
      }),
      this.prisma.invoice.aggregate({
        where: { organizationId, direction: 'PAYABLE' },
        _sum: { total: true },
      }),
      this.prisma.invoice.aggregate({
        where: { organizationId, direction: 'PAYABLE', status: InvoiceStatus.PAID },
        _sum: { total: true },
      }),
      this.prisma.invoice.aggregate({
        where: {
          organizationId,
          direction: 'PAYABLE',
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
        direction: 'PAYABLE',
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

      if (!inv.supplierId) continue;
      const agg = bySupplier.get(inv.supplierId) ?? {
        supplierId: inv.supplierId,
        name: inv.supplier?.name ?? '—',
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
          direction: 'PAYABLE',
          deletedAt: null,
          status: InvoiceStatus.PAID,
          paidDate: { not: null },
        },
        select: { date: true, dueDate: true, paidDate: true, total: true },
      }),
      this.prisma.invoice.aggregate({
        where: { organizationId, direction: 'PAYABLE', deletedAt: null },
        _sum: { total: true },
        _count: { _all: true },
      }),
      this.prisma.invoice.aggregate({
        where: {
          organizationId,
          direction: 'PAYABLE',
          deletedAt: null,
          status: { in: UNPAID },
        },
        _sum: { total: true },
      }),
      this.prisma.invoice.groupBy({
        by: ['supplierId'],
        where: {
          organizationId,
          direction: 'PAYABLE',
          deletedAt: null,
          status: { in: UNPAID },
        },
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
          direction: 'PAYABLE',
          deletedAt: null,
          forensicStatus: ForensicStatus.BLOCKED,
        },
        _sum: { total: true },
        _count: { _all: true },
      }),
      this.prisma.invoice.aggregate({
        where: {
          organizationId,
          direction: 'PAYABLE',
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
      .filter((g): g is typeof g & { supplierId: string } => !!g.supplierId)
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

  /**
   * Reporte de antigüedad de saldos por cobrar (CxC). Espejo de getAging pero
   * sobre las facturas de venta (direction=RECEIVABLE) pendientes de cobro,
   * clasificadas por días vencidos y agrupadas por cliente.
   */
  async getReceivablesAging(user: AuthenticatedUser) {
    const organizationId = user.organizationId;
    if (!organizationId) {
      throw new ForbiddenException('Tu cuenta no pertenece a una organización.');
    }

    const now = Date.now();
    const invoices = await this.prisma.invoice.findMany({
      where: {
        organizationId,
        direction: 'RECEIVABLE',
        deletedAt: null,
        status: InvoiceStatus.PENDING,
      },
      select: {
        total: true,
        date: true,
        dueDate: true,
        customerId: true,
        customer: { select: { name: true } },
      },
    });

    const buckets = {
      current: { label: 'Vigente', count: 0, amount: 0 },
      d1_30: { label: '1-30 días', count: 0, amount: 0 },
      d31_60: { label: '31-60 días', count: 0, amount: 0 },
      d61_90: { label: '61-90 días', count: 0, amount: 0 },
      d90_plus: { label: '90+ días', count: 0, amount: 0 },
    };
    const byCustomer = new Map<
      string,
      { customerId: string; name: string; amount: number; overdue: number }
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

      if (!inv.customerId) continue;
      const agg = byCustomer.get(inv.customerId) ?? {
        customerId: inv.customerId,
        name: inv.customer?.name ?? '—',
        amount: 0,
        overdue: 0,
      };
      agg.amount += amount;
      if (daysOverdue > 0) agg.overdue += amount;
      byCustomer.set(inv.customerId, agg);
    }

    return {
      totals: {
        amount: totalAmount,
        overdue: totalOverdue,
        invoices: invoices.length,
      },
      buckets,
      byCustomer: [...byCustomer.values()].sort((a, b) => b.amount - a.amount),
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Razones financieras de Cuentas por Cobrar (CxC), espejo de las de CxP:
   *  1. DSO — días promedio que tardan los clientes en pagar a la empresa.
   *  2. Puntualidad de cobro — % de facturas cobradas a tiempo.
   *  3. Rotación de CxC — ventas / saldo por cobrar.
   *  4. Concentración de cartera — % del saldo en los 5 clientes más grandes.
   */
  async getReceivablesRatios(user: AuthenticatedUser) {
    const organizationId = user.organizationId;
    if (!organizationId) {
      throw new ForbiddenException('Tu cuenta no pertenece a una organización.');
    }

    const DAY = 86_400_000;

    const [paidInvoices, ventasAgg, outstandingAgg, outstandingByCustomer] =
      await Promise.all([
        this.prisma.invoice.findMany({
          where: {
            organizationId,
            direction: 'RECEIVABLE',
            deletedAt: null,
            status: InvoiceStatus.PAID,
            paidDate: { not: null },
          },
          select: { date: true, dueDate: true, paidDate: true, total: true },
        }),
        this.prisma.invoice.aggregate({
          where: { organizationId, direction: 'RECEIVABLE', deletedAt: null },
          _sum: { total: true },
        }),
        this.prisma.invoice.aggregate({
          where: {
            organizationId,
            direction: 'RECEIVABLE',
            deletedAt: null,
            status: InvoiceStatus.PENDING,
          },
          _sum: { total: true },
        }),
        this.prisma.invoice.groupBy({
          by: ['customerId'],
          where: {
            organizationId,
            direction: 'RECEIVABLE',
            deletedAt: null,
            status: InvoiceStatus.PENDING,
          },
          _sum: { total: true },
        }),
      ]);

    // ── 1. DSO + 2. Puntualidad de cobro ──
    let totalDays = 0;
    let dsoCount = 0;
    let onTime = 0;
    let late = 0;
    for (const inv of paidInvoices) {
      if (!inv.paidDate) continue;
      const days = Math.max(
        0,
        Math.round((inv.paidDate.getTime() - inv.date.getTime()) / DAY),
      );
      totalDays += days;
      dsoCount += 1;
      if (inv.dueDate) {
        if (inv.paidDate.getTime() <= inv.dueDate.getTime()) onTime += 1;
        else late += 1;
      }
    }
    const dso = dsoCount > 0 ? Math.round(totalDays / dsoCount) : 0;
    const settled = onTime + late;
    const onTimePct = settled > 0 ? Math.round((onTime / settled) * 100) : 0;

    // ── 3. Rotación de CxC (ventas / saldo por cobrar) ──
    const ventas = num(ventasAgg._sum.total);
    const cxcActual = num(outstandingAgg._sum.total);
    const rotacion =
      cxcActual > 0 ? Math.round((ventas / cxcActual) * 10) / 10 : 0;

    // ── 4. Concentración de cartera (top 5 clientes) ──
    const ordered = outstandingByCustomer
      .filter((g): g is typeof g & { customerId: string } => !!g.customerId)
      .map((g) => ({ customerId: g.customerId, amount: num(g._sum.total) }))
      .sort((a, b) => b.amount - a.amount);
    const top5 = ordered.slice(0, 5);
    const customerNames = await this.prisma.customer.findMany({
      where: { id: { in: top5.map((c) => c.customerId) } },
      select: { id: true, name: true },
    });
    const nameById = new Map(customerNames.map((c) => [c.id, c.name]));
    const top5Amount = top5.reduce((acc, c) => acc + c.amount, 0);
    const concentrationPct =
      cxcActual > 0 ? Math.round((top5Amount / cxcActual) * 100) : 0;

    return {
      dso: {
        label: 'Días promedio de cobro (DSO)',
        value: dso,
        unit: 'días',
        basis: dsoCount,
      },
      punctuality: {
        label: 'Facturas cobradas a tiempo',
        onTimePct,
        onTime,
        late,
        settled,
      },
      turnover: {
        label: 'Rotación de cuentas por cobrar',
        value: rotacion,
        unit: 'veces',
        ventas,
        cxcActual,
      },
      customerConcentration: {
        label: 'Concentración en top 5 clientes',
        concentrationPct,
        totalCxc: cxcActual,
        top: top5.map((c) => ({
          customerId: c.customerId,
          name: nameById.get(c.customerId) ?? '—',
          amount: c.amount,
          sharePct: cxcActual > 0 ? Math.round((c.amount / cxcActual) * 100) : 0,
        })),
      },
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Resumen de cobranza de un período (determinista, sin IA). Base del reporte
   * semanal por WhatsApp y de la tarjeta de resumen en el dashboard.
   */
  async getReceivablesDigest(
    user: AuthenticatedUser,
    range?: { from?: string; to?: string },
  ) {
    const organizationId = this.requireOrg(user);
    const to = range?.to ? new Date(range.to) : new Date();
    const from = range?.from
      ? new Date(range.from)
      : new Date(to.getTime() - 7 * 86_400_000);

    const [collected, reminderLogs, outstanding] = await Promise.all([
      this.prisma.invoice.findMany({
        where: {
          organizationId,
          direction: 'RECEIVABLE',
          deletedAt: null,
          status: InvoiceStatus.PAID,
          paidDate: { gte: from, lte: to },
        },
        select: {
          total: true,
          paidDate: true,
          folio: true,
          customer: { select: { name: true } },
        },
        orderBy: { paidDate: 'desc' },
      }),
      this.prisma.invoiceAuditLog.findMany({
        where: {
          action: 'REMINDER_SENT',
          createdAt: { gte: from, lte: to },
          invoice: { organizationId, direction: 'RECEIVABLE' },
        },
        select: { metadata: true },
      }),
      this.prisma.invoice.aggregate({
        where: {
          organizationId,
          direction: 'RECEIVABLE',
          deletedAt: null,
          status: InvoiceStatus.PENDING,
        },
        _sum: { total: true },
        _count: { _all: true },
      }),
    ]);

    const collectedAmount = collected.reduce((a, i) => a + num(i.total), 0);
    let whatsappCount = 0;
    let emailCount = 0;
    for (const log of reminderLogs) {
      const ch = (log.metadata as { channels?: { whatsapp?: boolean; email?: boolean } })?.channels;
      if (ch?.whatsapp) whatsappCount += 1;
      if (ch?.email) emailCount += 1;
    }

    return {
      period: { from: from.toISOString(), to: to.toISOString() },
      collected: {
        amount: collectedAmount,
        count: collected.length,
        invoices: collected.map((i) => ({
          customerName: i.customer?.name ?? '—',
          folio: i.folio,
          amount: num(i.total),
          paidDate: i.paidDate?.toISOString() ?? null,
        })),
      },
      reminders: {
        total: reminderLogs.length,
        whatsapp: whatsappCount,
        email: emailCount,
      },
      outstanding: {
        amount: num(outstanding._sum.total),
        count: outstanding._count._all,
      },
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Efectividad del agente de cobranza: qué tanto ayudan los recordatorios a
   * cobrar. Determinista, cruza facturas cobradas con su último recordatorio.
   */
  async getReminderEffectiveness(user: AuthenticatedUser) {
    const organizationId = this.requireOrg(user);
    const DAY = 86_400_000;

    const paid = await this.prisma.invoice.findMany({
      where: {
        organizationId,
        direction: 'RECEIVABLE',
        deletedAt: null,
        status: InvoiceStatus.PAID,
        paidDate: { not: null },
      },
      select: {
        paidDate: true,
        auditLogs: {
          where: { action: 'REMINDER_SENT' },
          select: { createdAt: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    let withReminder = 0;
    let totalDaysToPay = 0;
    let daysCount = 0;
    for (const inv of paid) {
      if (!inv.paidDate) continue;
      const lastBeforePay = inv.auditLogs.find(
        (l) => l.createdAt.getTime() <= inv.paidDate!.getTime(),
      );
      if (lastBeforePay) {
        withReminder += 1;
        const days = Math.max(
          0,
          Math.round((inv.paidDate.getTime() - lastBeforePay.createdAt.getTime()) / DAY),
        );
        totalDaysToPay += days;
        daysCount += 1;
      }
    }

    const totalReminders = await this.prisma.invoiceAuditLog.count({
      where: {
        action: 'REMINDER_SENT',
        invoice: { organizationId, direction: 'RECEIVABLE' },
      },
    });

    return {
      paidInvoices: paid.length,
      paidAfterReminder: withReminder,
      reminderCoveragePct:
        paid.length > 0 ? Math.round((withReminder / paid.length) * 100) : 0,
      avgDaysReminderToPayment:
        daysCount > 0 ? Math.round(totalDaysToPay / daysCount) : 0,
      totalRemindersSent: totalReminders,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Ranking de clientes por comportamiento de pago (mejor → peor pagador).
   * Determinista: puntualidad histórica, atraso promedio y volumen.
   */
  async getCustomerRanking(user: AuthenticatedUser) {
    const organizationId = this.requireOrg(user);
    const stats = await this.computeCustomerStats(organizationId);
    return {
      customers: stats.sort((a, b) => b.onTimePct - a.onTimePct || a.avgDelayDays - b.avgDelayDays),
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Ciclo de Conversión de Efectivo (CCC) = DSO − DPO. Sin días de inventario:
   * Royáltica no rastrea inventario físico, así que se omite ese término y se
   * documenta la suposición para que la cifra sea honesta (no un dato inflado).
   */
  async getCashConversionCycle(user: AuthenticatedUser) {
    const [payable, receivable] = await Promise.all([
      this.getFinancialRatios(user),
      this.getReceivablesRatios(user),
    ]);
    const dpo = payable.dpo.value;
    const dso = receivable.dso.value;
    return {
      label: 'Ciclo de conversión de efectivo (CCC)',
      value: dso - dpo,
      unit: 'días',
      dso,
      dpo,
      // El CCC clásico suma días de inventario (DIO); Royáltica no rastrea
      // inventario, así que CCC = DSO − DPO (sin DIO). Se declara para no
      // presentar como completo un cálculo que omite un término por diseño.
      note: 'Calculado como DSO − DPO (sin días de inventario: no aplica a Royáltica).',
      interpretation:
        dso - dpo <= 0
          ? 'Cobras antes de pagar: tu operación se autofinancia.'
          : 'Financias la operación mientras cobras: revisa DSO y crédito a clientes.',
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Clientes en riesgo (alerta simple sí/no). Regla explícita: está en riesgo
   * si (≥2 facturas vencidas O alguna con ≥15 días de vencida) Y su puntualidad
   * histórica es <70%. Devuelve el motivo para que la UI lo explique.
   */
  async getAtRiskCustomers(user: AuthenticatedUser) {
    const organizationId = this.requireOrg(user);
    const now = Date.now();

    const [openInvoices, stats] = await Promise.all([
      this.prisma.invoice.findMany({
        where: {
          organizationId,
          direction: 'RECEIVABLE',
          deletedAt: null,
          status: InvoiceStatus.PENDING,
        },
        select: { total: true, date: true, dueDate: true, customerId: true },
      }),
      this.computeCustomerStats(organizationId),
    ]);

    const punctualityById = new Map(stats.map((s) => [s.customerId, s.onTimePct]));
    // Los nombres se leen de la tabla Customer (no de stats): un cliente en
    // riesgo puede no tener ninguna factura pagada y por tanto no estar en stats.
    const customerRows = await this.prisma.customer.findMany({
      where: { organizationId, deletedAt: null },
      select: { id: true, name: true },
    });
    const nameById = new Map(customerRows.map((c) => [c.id, c.name]));

    const byCustomer = new Map<
      string,
      { overdueCount: number; maxDaysOverdue: number; overdueAmount: number }
    >();
    for (const inv of openInvoices) {
      if (!inv.customerId) continue;
      const days = Math.floor((now - (inv.dueDate ?? inv.date).getTime()) / 86_400_000);
      if (days <= 0) continue;
      const agg = byCustomer.get(inv.customerId) ?? {
        overdueCount: 0,
        maxDaysOverdue: 0,
        overdueAmount: 0,
      };
      agg.overdueCount += 1;
      agg.maxDaysOverdue = Math.max(agg.maxDaysOverdue, days);
      agg.overdueAmount += num(inv.total);
      byCustomer.set(inv.customerId, agg);
    }

    const atRisk: {
      customerId: string;
      name: string;
      reason: string;
      overdueCount: number;
      maxDaysOverdue: number;
      overdueAmount: number;
      onTimePct: number;
    }[] = [];
    for (const [customerId, agg] of byCustomer) {
      const onTimePct = punctualityById.get(customerId) ?? 0;
      const settled = stats.find((s) => s.customerId === customerId)?.settled ?? 0;
      // Gatillo de morosidad actual: ≥2 vencidas O una con ≥15 días de atraso.
      const overdueTrigger = agg.overdueCount >= 2 || agg.maxDaysOverdue >= 15;
      if (!overdueTrigger) continue;
      // Historial malo: puntualidad <70%. Un cliente SIN historial (settled=0)
      // que ya acumula morosidad también se marca (no hay evidencia de que pague
      // bien y ya está atrasado).
      const badHistory = settled === 0 || onTimePct < 70;
      if (!badHistory) continue;

      const reasons: string[] = [];
      if (agg.overdueCount >= 2) reasons.push(`${agg.overdueCount} facturas vencidas`);
      if (agg.maxDaysOverdue >= 15) reasons.push(`hasta ${agg.maxDaysOverdue} días de atraso`);
      if (settled > 0 && onTimePct < 70) reasons.push(`solo ${onTimePct}% de pagos a tiempo`);
      else if (settled === 0) reasons.push('sin historial de pagos');
      atRisk.push({
        customerId,
        name: nameById.get(customerId) ?? '—',
        reason: reasons.join(' · '),
        overdueCount: agg.overdueCount,
        maxDaysOverdue: agg.maxDaysOverdue,
        overdueAmount: agg.overdueAmount,
        onTimePct,
      });
    }

    return {
      count: atRisk.length,
      customers: atRisk.sort((a, b) => b.overdueAmount - a.overdueAmount),
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Estadística de pago por cliente (compartida por ranking y riesgo).
   * Puntualidad, atraso promedio y volumen, calculados de facturas cobradas.
   */
  private async computeCustomerStats(organizationId: string) {
    const DAY = 86_400_000;
    const paid = await this.prisma.invoice.findMany({
      where: {
        organizationId,
        direction: 'RECEIVABLE',
        deletedAt: null,
        status: InvoiceStatus.PAID,
        paidDate: { not: null },
      },
      select: {
        total: true,
        date: true,
        dueDate: true,
        paidDate: true,
        customerId: true,
        customer: { select: { name: true } },
      },
    });

    const map = new Map<
      string,
      { name: string; onTime: number; late: number; settled: number; totalDelay: number; volume: number }
    >();
    for (const inv of paid) {
      if (!inv.customerId || !inv.paidDate) continue;
      const agg = map.get(inv.customerId) ?? {
        name: inv.customer?.name ?? '—',
        onTime: 0,
        late: 0,
        settled: 0,
        totalDelay: 0,
        volume: 0,
      };
      agg.volume += num(inv.total);
      if (inv.dueDate) {
        agg.settled += 1;
        const delay = Math.round((inv.paidDate.getTime() - inv.dueDate.getTime()) / DAY);
        if (delay <= 0) agg.onTime += 1;
        else { agg.late += 1; agg.totalDelay += delay; }
      }
      map.set(inv.customerId, agg);
    }

    return [...map.entries()].map(([customerId, a]) => ({
      customerId,
      name: a.name,
      onTimePct: a.settled > 0 ? Math.round((a.onTime / a.settled) * 100) : 0,
      onTime: a.onTime,
      late: a.late,
      settled: a.settled,
      avgDelayDays: a.late > 0 ? Math.round(a.totalDelay / a.late) : 0,
      volume: a.volume,
    }));
  }
}
