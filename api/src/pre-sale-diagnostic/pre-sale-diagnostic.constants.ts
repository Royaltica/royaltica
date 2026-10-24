/**
 * Reglas del "primer análisis" del Diagnóstico pre-venta (Fase 4). A
 * propósito deterministas y basadas en reglas (NO IA): nada de costo de
 * Gemini en un formulario público sin autenticar, y el resultado tiene que
 * poder explicarse en una frase — mismo criterio que CustomerRiskService.
 *
 * Paolo fue explícito en que el primer análisis es "sin decir mucho": las
 * recomendaciones nombran el ÁREA de mejora, no la receta completa — eso se
 * reserva para cuando ya es cliente (Fase 5, onboarding).
 */

export const DIAGNOSTIC_BASE_SCORE = 100;

export const DIAGNOSTIC_DEDUCTIONS = {
  noPolicy: 20,
  noProcess: 25,
  manualProcess: 10,
  highAvgDays: 20,
  moderateAvgDays: 10,
  highOverduePct: 20,
  moderateOverduePct: 10,
  noSoftware: 10,
} as const;

export const DIAGNOSTIC_AVG_DAYS_HIGH = 45;
export const DIAGNOSTIC_AVG_DAYS_MODERATE = 20;
export const DIAGNOSTIC_OVERDUE_PCT_HIGH = 30;
export const DIAGNOSTIC_OVERDUE_PCT_MODERATE = 15;

/** Umbrales del tier (0-100). */
export const DIAGNOSTIC_TIER_SALUDABLE_MIN = 80;
export const DIAGNOSTIC_TIER_OPORTUNIDADES_MIN = 50;
