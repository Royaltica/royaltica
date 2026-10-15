/**
 * Health score REAL de un cliente para el panel SUPERADMIN — antes era una
 * heurística fija en el frontend (`o.counts.invoices > 0 ? 95 : 75`) que no
 * reflejaba ningún problema real del cliente. Esta versión se basa en
 * señales reales disponibles en el backend:
 *  - % de pagos fallidos (PaymentStatus.FAILED) sobre el total de pagos.
 *  - % de facturas vencidas (dueDate pasado y no PAID) sobre el total.
 *  - inactividad: hace cuánto fue el último login real de algún usuario.
 * Un cliente eliminado (soft-delete) o desactivado siempre es 0.
 */
export interface HealthScoreInput {
  deleted: boolean;
  isActive: boolean;
  totalPayments: number;
  failedPayments: number;
  totalInvoices: number;
  overdueInvoices: number;
  lastLoginAt: Date | null;
  /** Inyectable en tests; por defecto `new Date()`. */
  now?: Date;
}

const MAX_FAILED_PAYMENTS_PENALTY = 40;
const MAX_OVERDUE_INVOICES_PENALTY = 30;
const NO_LOGIN_EVER_PENALTY = 25;
const STALE_LOGIN_30D_PENALTY = 15;
const STALE_LOGIN_14D_PENALTY = 5;

export function computeHealthScore(input: HealthScoreInput): number {
  if (input.deleted || !input.isActive) return 0;

  let score = 100;

  if (input.totalPayments > 0) {
    const failedRatio = input.failedPayments / input.totalPayments;
    score -= failedRatio * MAX_FAILED_PAYMENTS_PENALTY;
  }

  if (input.totalInvoices > 0) {
    const overdueRatio = input.overdueInvoices / input.totalInvoices;
    score -= overdueRatio * MAX_OVERDUE_INVOICES_PENALTY;
  }

  const now = input.now ?? new Date();
  if (!input.lastLoginAt) {
    score -= NO_LOGIN_EVER_PENALTY;
  } else {
    const daysSinceLogin =
      (now.getTime() - input.lastLoginAt.getTime()) / 86_400_000;
    if (daysSinceLogin > 30) score -= STALE_LOGIN_30D_PENALTY;
    else if (daysSinceLogin > 14) score -= STALE_LOGIN_14D_PENALTY;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}
