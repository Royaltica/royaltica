import type { Plan } from '@prisma/client';

/**
 * Precio mensual aproximado por plan, en MXN — usado SOLO para calcular
 * margen estimado en el panel SUPERADMIN (ingreso - costo operativo), no
 * para facturación real (eso lo maneja Stripe vía STRIPE_PRICE_PRO /
 * STRIPE_PRICE_ENTERPRISE). Organization no guarda el monto real que cobra
 * Stripe — solo el Plan y el priceId — así que esto es una aproximación
 * configurable, no la verdad de Stripe. Si cambian los precios reales,
 * actualiza esto a mano (no hay fuente automática sin llamar a la API de
 * Stripe por cada organización en cada carga del dashboard).
 */
export const PLAN_MONTHLY_PRICE_MXN: Record<Plan, number> = {
  FREE: 0,
  PRO: 1499,
  ENTERPRISE: 4999,
};

/** Estados de Stripe que cuentan como "cobrando actualmente" para efectos de
 * margen. `past_due` cuenta (sigue siendo ingreso esperado, con riesgo),
 * `canceled`/`unpaid`/null no cuentan. */
const BILLING_STATUS_COUNTS_AS_REVENUE = new Set([
  'active',
  'trialing',
  'past_due',
]);

export function isRevenueGenerating(subscriptionStatus: string | null): boolean {
  return subscriptionStatus !== null && BILLING_STATUS_COUNTS_AS_REVENUE.has(subscriptionStatus);
}
