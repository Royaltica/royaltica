import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CustomerRiskTier, InvoiceStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import {
  RISK_TIER_ATENCION_MIN_DAYS,
  RISK_TIER_ATENCION_MIN_OVERDUE_COUNT,
  RISK_TIER_BAD_HISTORY_SCORE_THRESHOLD,
  RISK_TIER_INCOBRABLE_DAYS,
  RISK_TIER_RIESGO_DAYS,
} from './customer-risk.constants';

/** Orden de severidad, de mejor a peor — usado solo para detectar si un
 * cambio de tier es un EMPEORAMIENTO (dispara alerta) o una mejora
 * (silenciosa: nadie necesita que le avisen que un cliente mejoró). */
const TIER_SEVERITY: Record<CustomerRiskTier, number> = {
  SANO: 0,
  ATENCION: 1,
  RIESGO: 2,
  INCOBRABLE: 3,
};

export interface CustomerRiskResult {
  tier: CustomerRiskTier;
  previousTier: CustomerRiskTier | null;
  /** true si el nuevo tier es más severo que el anterior (o el cliente no
   * tenía tier aún y el nuevo ya es ATENCION o peor) — dispara alerta. */
  worsened: boolean;
  maxDaysOverdue: number;
  overdueCount: number;
  overdueAmount: number;
  reason: string;
  computedAt: string;
}

/**
 * Clasificación de riesgo/incobrabilidad por cliente (pedido de Paolo:
 * "cómo analiza Royáltica cuándo un cliente se está volviendo incobrable").
 *
 * DETERMINISTA, igual que CustomerScoringService/SupplierScoringService:
 * se basa en días de atraso de las facturas RECEIVABLE abiertas de un
 * cliente (mismo criterio y mismo estado PENDING que
 * DashboardService.getAtRiskCustomers, para no inventar una segunda
 * definición de "factura abierta") combinado con su score de puntualidad
 * ya persistido (Customer.score, calculado por CustomerScoringService).
 *
 * No usa IA: el motivo de la clasificación tiene que poder explicarse en
 * una frase (ver `reason`) para que el equipo de cobranza confíe en ella.
 */
@Injectable()
export class CustomerRiskService {
  constructor(private readonly prisma: PrismaService) {}

  /** Recalcula y persiste el tier de riesgo de un cliente (scoped al org del
   * usuario). Pensado para forzar un recálculo a demanda (ej. tras cargar
   * facturas nuevas); el cron diario ya lo recalcula para todos. */
  async recompute(
    user: AuthenticatedUser,
    customerId: string,
  ): Promise<CustomerRiskResult> {
    const organizationId = this.requireOrg(user);
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, organizationId, deletedAt: null },
      select: { id: true, score: true, riskTier: true },
    });
    if (!customer) throw new NotFoundException('Cliente no encontrado.');
    return this.recomputeOne(customer.id, customer.score, customer.riskTier);
  }

  /**
   * Núcleo reutilizable por el cron diario (JobsService.customerScoreRecompute),
   * que ya recorre todos los clientes para recalcular `score` — este método
   * recibe el score recién calculado (y el tier anterior) en vez de volver a
   * leerlos, para no duplicar queries en el loop del cron.
   */
  async recomputeOne(
    customerId: string,
    score: number | null,
    previousTier: CustomerRiskTier | null,
  ): Promise<CustomerRiskResult> {
    // Mismo criterio de "factura abierta" que
    // DashboardService.getAtRiskCustomers: RECEIVABLE, no borrada, PENDING.
    const openInvoices = await this.prisma.invoice.findMany({
      where: {
        customerId,
        direction: 'RECEIVABLE',
        deletedAt: null,
        status: InvoiceStatus.PENDING,
      },
      select: { total: true, date: true, dueDate: true },
    });

    const now = Date.now();
    let maxDaysOverdue = 0;
    let overdueCount = 0;
    let overdueAmount = 0;
    for (const inv of openInvoices) {
      const reference = inv.dueDate ?? inv.date;
      const days = Math.floor((now - reference.getTime()) / 86_400_000);
      if (days <= 0) continue;
      overdueCount += 1;
      overdueAmount += Number(inv.total);
      if (days > maxDaysOverdue) maxDaysOverdue = days;
    }

    const { tier, reason } = this.classify(maxDaysOverdue, overdueCount, score);
    const computedAt = new Date();

    await this.prisma.customer.update({
      where: { id: customerId },
      data: {
        riskTier: tier,
        maxDaysOverdue,
        riskTierUpdatedAt: computedAt,
      },
    });

    const worsened =
      previousTier == null
        ? tier !== CustomerRiskTier.SANO
        : TIER_SEVERITY[tier] > TIER_SEVERITY[previousTier];

    return {
      tier,
      previousTier,
      worsened,
      maxDaysOverdue,
      overdueCount,
      overdueAmount,
      reason,
      computedAt: computedAt.toISOString(),
    };
  }

  /**
   * Regla de clasificación, en orden de severidad. Documentada en texto
   * para que el "por qué" de un tier nunca sea una caja negra:
   *  - INCOBRABLE: alguna factura abierta con RISK_TIER_INCOBRABLE_DAYS+ de
   *    atraso.
   *  - RIESGO: alguna factura abierta con RISK_TIER_RIESGO_DAYS+ de atraso
   *    (y aún no cruzó el umbral de incobrable).
   *  - ATENCION: mismo gatillo de morosidad que getAtRiskCustomers (≥2
   *    facturas vencidas o ≥15 días de atraso en alguna) Y mal historial
   *    (score < umbral, o sin historial de pagos todavía).
   *  - SANO: cualquier otro caso (sin atraso relevante, o atrasado pero con
   *    buen historial de pago).
   */
  private classify(
    maxDaysOverdue: number,
    overdueCount: number,
    score: number | null,
  ): { tier: CustomerRiskTier; reason: string } {
    if (maxDaysOverdue >= RISK_TIER_INCOBRABLE_DAYS) {
      return {
        tier: CustomerRiskTier.INCOBRABLE,
        reason: `Factura abierta con ${maxDaysOverdue} días de atraso (≥${RISK_TIER_INCOBRABLE_DAYS}).`,
      };
    }
    if (maxDaysOverdue >= RISK_TIER_RIESGO_DAYS) {
      return {
        tier: CustomerRiskTier.RIESGO,
        reason: `Factura abierta con ${maxDaysOverdue} días de atraso (≥${RISK_TIER_RIESGO_DAYS}).`,
      };
    }

    const overdueTrigger =
      overdueCount >= RISK_TIER_ATENCION_MIN_OVERDUE_COUNT ||
      maxDaysOverdue >= RISK_TIER_ATENCION_MIN_DAYS;
    const badHistory =
      score == null || score < RISK_TIER_BAD_HISTORY_SCORE_THRESHOLD;
    if (overdueTrigger && badHistory) {
      const reasons: string[] = [];
      if (overdueCount >= RISK_TIER_ATENCION_MIN_OVERDUE_COUNT) {
        reasons.push(`${overdueCount} facturas vencidas`);
      }
      if (maxDaysOverdue >= RISK_TIER_ATENCION_MIN_DAYS) {
        reasons.push(`hasta ${maxDaysOverdue} días de atraso`);
      }
      reasons.push(score == null ? 'sin historial de pagos' : `${score}% de puntualidad`);
      return { tier: CustomerRiskTier.ATENCION, reason: reasons.join(' · ') };
    }

    return { tier: CustomerRiskTier.SANO, reason: 'Sin señales de riesgo relevantes.' };
  }

  private requireOrg(user: AuthenticatedUser): string {
    if (!user.organizationId) {
      throw new ForbiddenException('Tu cuenta no pertenece a una organización.');
    }
    return user.organizationId;
  }
}
