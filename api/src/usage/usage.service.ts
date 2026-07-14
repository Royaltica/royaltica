import { Injectable, Logger } from '@nestjs/common';
import type { Prisma, UsageFeature } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { estimateCostMxn } from './usage.pricing';

const num = (v: Prisma.Decimal | null): number => (v ? Number(v) : 0);

export interface RecordUsageInput {
  organizationId: string;
  feature: UsageFeature;
  /** Tokens / bytes / conteo según el feature (default 1). */
  units?: number;
  /** Tokens de entrada (features Gemini) para costo preciso. */
  inputTokens?: number;
  /** Tokens de salida (features Gemini). */
  outputTokens?: number;
  metadata?: Record<string, unknown>;
}

/** Rango temporal opcional para consultas de costos. */
export interface UsagePeriod {
  from?: Date;
  to?: Date;
}

/**
 * Registro y consulta de eventos de costo operativo (cost tracking).
 *
 * `record()` es **fire-and-forget**: nunca lanza ni bloquea el request que lo
 * originó. Si la escritura falla, solo se registra en el log; jamás debe tumbar
 * una auditoría, un chat o un envío de correo por un problema de telemetría.
 *
 * Módulo global: cualquier servicio que genere costo puede inyectarlo.
 */
@Injectable()
export class UsageService {
  private readonly logger = new Logger(UsageService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Registra un evento de uso. No esperar (`void`) en rutas calientes:
   * el costo se calcula aquí y se persiste sin afectar la latencia.
   */
  async record(input: RecordUsageInput): Promise<void> {
    try {
      const units =
        input.units ?? (input.inputTokens ?? 0) + (input.outputTokens ?? 0);
      const estimatedCostMxn = estimateCostMxn(input.feature, {
        units,
        inputTokens: input.inputTokens,
        outputTokens: input.outputTokens,
      });

      await this.prisma.usageEvent.create({
        data: {
          organizationId: input.organizationId,
          feature: input.feature,
          units,
          estimatedCostMxn,
          metadata: (input.metadata ??
            undefined) as Prisma.InputJsonValue | undefined,
        },
      });
    } catch (err) {
      this.logger.warn(
        `No se pudo registrar UsageEvent (${input.feature}): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  /** Costo y volumen totales agrupados por organización en un período. */
  async costByOrganization(period: UsagePeriod = {}) {
    const where = this.periodWhere(period);
    const grouped = await this.prisma.usageEvent.groupBy({
      by: ['organizationId'],
      where,
      _sum: { estimatedCostMxn: true, units: true },
      _count: { _all: true },
    });

    const orgIds = grouped.map((g) => g.organizationId);
    const orgs = await this.prisma.organization.findMany({
      where: { id: { in: orgIds } },
      select: { id: true, name: true, plan: true },
    });
    const orgById = new Map(orgs.map((o) => [o.id, o]));

    return grouped
      .map((g) => ({
        organizationId: g.organizationId,
        organizationName: orgById.get(g.organizationId)?.name ?? '(desconocida)',
        plan: orgById.get(g.organizationId)?.plan ?? null,
        events: g._count._all,
        units: g._sum.units ?? 0,
        estimatedCostMxn: num(g._sum.estimatedCostMxn),
      }))
      .sort((a, b) => b.estimatedCostMxn - a.estimatedCostMxn);
  }

  /** Desglose por feature para una organización específica. */
  async breakdownByFeature(organizationId: string, period: UsagePeriod = {}) {
    const where = { organizationId, ...this.periodWhere(period) };
    const grouped = await this.prisma.usageEvent.groupBy({
      by: ['feature'],
      where,
      _sum: { estimatedCostMxn: true, units: true },
      _count: { _all: true },
    });

    const byFeature = grouped
      .map((g) => ({
        feature: g.feature,
        events: g._count._all,
        units: g._sum.units ?? 0,
        estimatedCostMxn: num(g._sum.estimatedCostMxn),
      }))
      .sort((a, b) => b.estimatedCostMxn - a.estimatedCostMxn);

    const totalCostMxn = byFeature.reduce(
      (acc, f) => acc + f.estimatedCostMxn,
      0,
    );

    return {
      organizationId,
      totalCostMxn: Math.round(totalCostMxn * 1e6) / 1e6,
      byFeature,
    };
  }

  /**
   * Desglose por feature de TODA la plataforma (todas las organizaciones).
   * Sirve para visualizar el gasto global por servicio (Gemini, correos, etc.).
   */
  async globalBreakdownByFeature(period: UsagePeriod = {}) {
    const where = this.periodWhere(period);
    const grouped = await this.prisma.usageEvent.groupBy({
      by: ['feature'],
      where,
      _sum: { estimatedCostMxn: true, units: true },
      _count: { _all: true },
    });

    const byFeature = grouped
      .map((g) => ({
        feature: g.feature,
        events: g._count._all,
        units: g._sum.units ?? 0,
        estimatedCostMxn: num(g._sum.estimatedCostMxn),
      }))
      .sort((a, b) => b.estimatedCostMxn - a.estimatedCostMxn);

    const totalCostMxn = byFeature.reduce((acc, f) => acc + f.estimatedCostMxn, 0);
    return {
      totalCostMxn: Math.round(totalCostMxn * 1e6) / 1e6,
      byFeature,
    };
  }

  /** Resumen de las últimas 24h (para el panel "en tiempo real"). */
  async realtime() {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [byFeature, totals, topOrgs] = await Promise.all([
      this.prisma.usageEvent.groupBy({
        by: ['feature'],
        where: { createdAt: { gte: since } },
        _sum: { estimatedCostMxn: true, units: true },
        _count: { _all: true },
      }),
      this.prisma.usageEvent.aggregate({
        where: { createdAt: { gte: since } },
        _sum: { estimatedCostMxn: true },
        _count: { _all: true },
      }),
      this.costByOrganization({ from: since }),
    ]);

    return {
      windowHours: 24,
      since: since.toISOString(),
      totalEvents: totals._count._all,
      totalCostMxn: num(totals._sum.estimatedCostMxn),
      byFeature: byFeature
        .map((g) => ({
          feature: g.feature,
          events: g._count._all,
          units: g._sum.units ?? 0,
          estimatedCostMxn: num(g._sum.estimatedCostMxn),
        }))
        .sort((a, b) => b.estimatedCostMxn - a.estimatedCostMxn),
      topOrganizations: topOrgs.slice(0, 5),
      generatedAt: new Date().toISOString(),
    };
  }

  private periodWhere(period: UsagePeriod): Prisma.UsageEventWhereInput {
    if (!period.from && !period.to) return {};
    const createdAt: Prisma.DateTimeFilter = {};
    if (period.from) createdAt.gte = period.from;
    if (period.to) createdAt.lte = period.to;
    return { createdAt };
  }
}
