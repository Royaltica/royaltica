import { CustomerRiskTier } from '@prisma/client';
import {
  RISK_TIER_ATENCION_MIN_DAYS,
  RISK_TIER_ATENCION_MIN_OVERDUE_COUNT,
  RISK_TIER_BAD_HISTORY_SCORE_THRESHOLD,
  RISK_TIER_INCOBRABLE_DAYS,
  RISK_TIER_RIESGO_DAYS,
} from './customer-risk.constants';

/** Orden de severidad, de mejor a peor. */
export const TIER_SEVERITY: Record<CustomerRiskTier, number> = {
  SANO: 0,
  ATENCION: 1,
  RIESGO: 2,
  INCOBRABLE: 3,
};

/**
 * Regla de clasificación de riesgo, en orden de severidad. Función pura para
 * que la usen igual el cron diario (CustomerRiskService, "hoy") y el análisis
 * de cartera (que la aplica "al cierre" de cada periodo para comparar):
 *  - INCOBRABLE: alguna factura abierta con RISK_TIER_INCOBRABLE_DAYS+ de atraso.
 *  - RIESGO: alguna factura abierta con RISK_TIER_RIESGO_DAYS+ de atraso.
 *  - ATENCION: ≥2 facturas vencidas o ≥15 días de atraso en alguna, Y mal
 *    historial (score < umbral, o sin historial de pagos todavía).
 *  - SANO: cualquier otro caso.
 */
export function classifyRiskTier(
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
  const badHistory = score == null || score < RISK_TIER_BAD_HISTORY_SCORE_THRESHOLD;
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
