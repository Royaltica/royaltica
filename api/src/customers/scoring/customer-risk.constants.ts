/**
 * Umbrales de clasificación de riesgo/incobrabilidad (CustomerRiskTier).
 * Valores que dio Paolo explícitamente por WhatsApp (24-oct-2026), con su
 * propia advertencia de que son aproximados ("más o menos 150 días", "un
 * poco más de 200 días") — por eso viven como constantes ajustables y no
 * hardcodeados en el servicio.
 */

/** Días de atraso a partir de los cuales una factura abierta mete al
 * cliente en RIESGO (sigue sin pagar, pero aún no se da por perdido). */
export const RISK_TIER_RIESGO_DAYS = 150;

/** Días de atraso a partir de los cuales se considera INCOBRABLE. */
export const RISK_TIER_INCOBRABLE_DAYS = 200;

/**
 * Gatillo de ATENCION: mismo criterio que
 * DashboardService.getAtRiskCustomers (≥N facturas vencidas o ≥M días de
 * atraso en alguna), reutilizado aquí a propósito para que "cliente en
 * riesgo" signifique lo mismo en el dashboard y en la clasificación
 * persistida.
 */
export const RISK_TIER_ATENCION_MIN_OVERDUE_COUNT = 2;
export const RISK_TIER_ATENCION_MIN_DAYS = 15;

/** Puntualidad histórica (Customer.score) por debajo de la cual se considera
 * "mal historial" para efectos de ATENCION — mismo umbral que
 * getAtRiskCustomers. */
export const RISK_TIER_BAD_HISTORY_SCORE_THRESHOLD = 70;
