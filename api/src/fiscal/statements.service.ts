import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InvoiceStatus,
  type FinancialStatement,
  type Prisma,
} from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { ActivityLogService } from '../activity/activity-log.service';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { GenerateStatementDto } from './dto/generate-statement.dto';
import { periodRange } from './period.util';

const STATEMENT_TYPE = 'INCOME_STATEMENT';
const COUNTED_STATUSES = [InvoiceStatus.APPROVED, InvoiceStatus.PAID];

const serialize = (s: FinancialStatement) => ({
  ...s,
  revenue: Number(s.revenue),
  costs: Number(s.costs),
  opex: Number(s.opex),
  netIncome: Number(s.netIncome),
});

@Injectable()
export class StatementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly activity: ActivityLogService,
  ) {}

  /**
   * Genera el estado de resultados de un período. Los egresos se obtienen
   * de las facturas (base sin IVA) y se reparten en costo/OPEX según el
   * `costRatio` de la organización. El ingreso lo aporta el cliente.
   */
  async generate(user: AuthenticatedUser, dto: GenerateStatementDto) {
    const organizationId = this.requireOrg(user);
    const { start, end } = periodRange(dto.period);
    const { costRatio } = await this.settings.get(organizationId);

    const invoices = await this.prisma.invoice.findMany({
      where: {
        organizationId,
        deletedAt: null,
        status: { in: COUNTED_STATUSES },
        date: { gte: start, lt: end },
      },
      select: {
        subtotal: true,
        supplier: { select: { id: true, name: true } },
      },
    });

    const totalExpenses = round2(
      invoices.reduce((a, i) => a + Number(i.subtotal), 0),
    );
    const costs = round2(totalExpenses * costRatio);
    const opex = round2(totalExpenses - costs);
    const revenue = round2(dto.revenue ?? 0);
    const netIncome = round2(revenue - costs - opex);

    // Top proveedores por egreso (para el desglose).
    const bySupplier = new Map<string, { name: string; amount: number }>();
    for (const inv of invoices) {
      const cur = bySupplier.get(inv.supplier.id) ?? {
        name: inv.supplier.name,
        amount: 0,
      };
      cur.amount += Number(inv.subtotal);
      bySupplier.set(inv.supplier.id, cur);
    }
    const topSuppliers = [...bySupplier.values()]
      .map((s) => ({ ...s, amount: round2(s.amount) }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);

    const data = {
      assumptions: { costRatio },
      invoiceCount: invoices.length,
      totalExpenses,
      grossMargin: revenue > 0 ? round2((revenue - costs) / revenue) : null,
      netMargin: revenue > 0 ? round2(netIncome / revenue) : null,
      topSuppliers,
    };

    const statement = await this.prisma.financialStatement.upsert({
      where: {
        organizationId_period_type: {
          organizationId,
          period: dto.period,
          type: STATEMENT_TYPE,
        },
      },
      create: {
        organizationId,
        period: dto.period,
        type: STATEMENT_TYPE,
        revenue,
        costs,
        opex,
        netIncome,
        data: data as unknown as Prisma.InputJsonValue,
        createdByUserId: user.id,
      },
      update: {
        revenue,
        costs,
        opex,
        netIncome,
        data: data as unknown as Prisma.InputJsonValue,
        generatedAt: new Date(),
      },
    });

    await this.activity.record({
      organizationId,
      userId: user.id,
      action: 'STATEMENT_GENERATED',
      entityType: 'FinancialStatement',
      entityId: statement.id,
      metadata: { period: dto.period, netIncome },
    });

    return serialize(statement);
  }

  async list(user: AuthenticatedUser) {
    const organizationId = this.requireOrg(user);
    const rows = await this.prisma.financialStatement.findMany({
      where: { organizationId },
      orderBy: { period: 'desc' },
    });
    return rows.map(serialize);
  }

  async findOne(user: AuthenticatedUser, id: string) {
    const statement = await this.getOwned(user, id);
    return serialize(statement);
  }

  /** Devuelve los datos estructurados en filas para exportar (Excel/PDF). */
  async exportData(user: AuthenticatedUser, id: string) {
    const statement = serialize(await this.getOwned(user, id));
    const rows = [
      { concepto: 'Ingresos', monto: statement.revenue },
      { concepto: 'Costos', monto: -statement.costs },
      { concepto: 'Gastos de operación (OPEX)', monto: -statement.opex },
      { concepto: 'Utilidad neta', monto: statement.netIncome },
    ];
    return {
      period: statement.period,
      type: statement.type,
      generatedAt: statement.generatedAt,
      currency: 'MXN',
      rows,
      detail: statement.data,
    };
  }

  // ── helpers ───────────────────────────────────────────────

  private async getOwned(
    user: AuthenticatedUser,
    id: string,
  ): Promise<FinancialStatement> {
    const organizationId = this.requireOrg(user);
    const statement = await this.prisma.financialStatement.findFirst({
      where: { id, organizationId },
    });
    if (!statement) throw new NotFoundException('Estado financiero no encontrado.');
    return statement;
  }

  private requireOrg(user: AuthenticatedUser): string {
    if (!user.organizationId) {
      throw new ForbiddenException('Tu cuenta no pertenece a una organización.');
    }
    return user.organizationId;
  }
}

const round2 = (n: number): number => Math.round(n * 100) / 100;
