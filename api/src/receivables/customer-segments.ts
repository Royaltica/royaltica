import type { Prisma } from '@prisma/client';

/**
 * Segmentos de cobranza (C3). Reglas deterministas y explicables, las mismas
 * que hoy calcula la pantalla (frontend/.../mockV1.ts › segmentoDe), ahora en
 * el servidor para que todos vean lo mismo. En este orden:
 *   nuevo → disputa → moroso → en deterioro → puntual → tardío → olvidadizo
 */

export type CustomerSegment = 'puntual' | 'tardio' | 'olvidadizo' | 'deterioro' | 'moroso' | 'disputa' | 'nuevo';

export const SEGMENT_NAMES: Record<CustomerSegment, string> = {
  puntual: 'Puntual',
  tardio: 'Tardío predecible',
  olvidadizo: 'Olvidadizo',
  deterioro: 'En deterioro',
  moroso: 'Moroso recurrente',
  disputa: 'En disputa',
  nuevo: 'Nuevo',
};

export const SEGMENT_ORDER: CustomerSegment[] = ['puntual', 'tardio', 'olvidadizo', 'nuevo', 'deterioro', 'moroso', 'disputa'];

export interface SegmentDiagnosis {
  segment: CustomerSegment;
  reason: string;
  /** Proporción de facturas pagadas a tiempo (0 a 1). */
  onTimeRate: number;
  /** Días promedio de atraso al pagar (sin contar pagos anticipados). */
  avgDaysLate: number;
  /** Corrimiento sugerido del plan para el tardío predecible (días). */
  offsetDays: number;
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const pct = (x: number) => `${Math.round(x * 100)}%`;

/**
 * @param history días de atraso al pagar (negativo = antes), del más viejo al
 *   más reciente; últimas 12 facturas pagadas.
 */
export function segmentOf(history: number[], brokenPromises: number, disputed: boolean): SegmentDiagnosis {
  const h = history;
  const late = h.map((d) => Math.max(0, d));
  const onTimeRate = h.length ? h.filter((d) => d <= 0).length / h.length : 0;
  const avgDaysLate = Math.round(avg(late));
  const base = { onTimeRate, avgDaysLate, offsetDays: 0 };
  if (!h.length) return { ...base, segment: 'nuevo', reason: 'Cliente nuevo: todavía no hay pagos para medir.' };
  if (disputed) return { ...base, segment: 'disputa', reason: 'Tiene una aclaración abierta sobre su factura.' };
  if (brokenPromises >= 2 || (onTimeRate < 0.4 && avgDaysLate > 20)) {
    const severe = h.filter((d) => d > 20).length;
    return {
      ...base,
      segment: 'moroso',
      reason: `${severe} de sus últimas ${h.length} facturas se pagaron con más de 20 días de atraso y rompió ${brokenPromises} ${brokenPromises === 1 ? 'promesa' : 'promesas'} de pago.`,
    };
  }
  const before = h.slice(0, -3);
  const beforeOnTime = before.length ? before.filter((d) => d <= 0).length / before.length : 0;
  const trend = avg(late.slice(-3)) - avg(late.slice(0, -3));
  if (trend >= 5 && beforeOnTime >= 0.6) {
    return {
      ...base,
      segment: 'deterioro',
      reason: `Pagaba a tiempo el ${pct(beforeOnTime)} de sus facturas; sus últimos 3 pagos promediaron ${Math.round(avg(late.slice(-3)))} días de atraso.`,
    };
  }
  if (onTimeRate >= 0.9) {
    return { ...base, segment: 'puntual', reason: `${pct(onTimeRate)} de sus facturas de los últimos 12 meses se pagaron a tiempo.` };
  }
  const deviation = Math.sqrt(avg(h.map((d) => (d - avg(h)) ** 2)));
  if (onTimeRate < 0.5 && deviation <= 3) {
    return {
      ...base,
      offsetDays: avgDaysLate,
      segment: 'tardio',
      reason: `Paga en promedio ${avgDaysLate} días tarde, siempre con el mismo patrón, y cumple sus promesas.`,
    };
  }
  return { ...base, segment: 'olvidadizo', reason: `Paga a tiempo el ${pct(onTimeRate)}; cuando se atrasa, suele pagar después del recordatorio.` };
}

const DAY = 86_400_000;
/** Días de tolerancia antes de dar por rota una promesa de pago. */
export const PROMISE_GRACE_DAYS = 1;
/** Una aclaración sobre una factura abierta cuenta como disputa durante este tiempo. */
export const DISPUTE_WINDOW_DAYS = 90;

export interface SegmentInput {
  id: string;
  name: string;
  category: string | null;
  riskTier: string | null;
  score: number | null;
  outstanding: number;
  /** Pagos con su fecha, del más viejo al más reciente (últimos 12). */
  payments: { paidAt: Date; daysLate: number }[];
  brokenPromises: number;
  disputed: boolean;
}

type Db = Pick<Prisma.TransactionClient, 'customer' | 'activityLog'>;

/**
 * Lee lo necesario para segmentar la cartera de una organización: facturas
 * pagadas (puntualidad), saldo abierto, promesas de pago rotas y aclaraciones
 * del portal (ActivityLog). Debe llamarse dentro de withOrg.
 */
export async function loadSegmentInputs(
  db: Db,
  organizationId: string,
  opts: { assignedAgentId?: string; now?: Date } = {},
): Promise<SegmentInput[]> {
  const now = opts.now ?? new Date();
  const customers = await db.customer.findMany({
    where: {
      organizationId,
      deletedAt: null,
      isActive: true,
      ...(opts.assignedAgentId ? { assignedAgentId: opts.assignedAgentId } : {}),
    },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      category: true,
      riskTier: true,
      score: true,
      invoices: {
        where: { direction: 'RECEIVABLE', deletedAt: null, status: { in: ['PENDING', 'PAID'] } },
        select: { id: true, status: true, total: true, amountPaid: true, dueDate: true, paidDate: true },
      },
    },
  });

  const invoiceIds = customers.flatMap((c) => c.invoices.map((i) => i.id));
  const logs = invoiceIds.length
    ? await db.activityLog.findMany({
        where: {
          organizationId,
          entityType: 'Invoice',
          entityId: { in: invoiceIds },
          action: { in: ['CUSTOMER_PROMISED_PAYMENT', 'CUSTOMER_DISPUTED_INVOICE'] },
          createdAt: { gte: new Date(now.getTime() - 365 * DAY) },
        },
        select: { action: true, entityId: true, metadata: true, createdAt: true },
      })
    : [];

  return customers.map((c) => {
    const byId = new Map(c.invoices.map((i) => [i.id, i]));
    const paid = c.invoices
      .filter((i) => i.status === 'PAID' && i.paidDate && i.dueDate)
      .sort((a, b) => a.paidDate!.getTime() - b.paidDate!.getTime())
      .slice(-12);
    let brokenPromises = 0;
    let disputed = false;
    for (const log of logs) {
      const inv = log.entityId ? byId.get(log.entityId) : undefined;
      if (!inv) continue;
      if (log.action === 'CUSTOMER_DISPUTED_INVOICE') {
        if (inv.status === 'PENDING' && now.getTime() - log.createdAt.getTime() <= DISPUTE_WINDOW_DAYS * DAY) disputed = true;
        continue;
      }
      const raw = (log.metadata as { promisedDate?: unknown } | null)?.promisedDate;
      const promised = typeof raw === 'string' ? new Date(raw) : null;
      if (!promised || Number.isNaN(promised.getTime())) continue;
      const deadline = promised.getTime() + PROMISE_GRACE_DAYS * DAY;
      if (deadline > now.getTime()) continue; // aún no vence
      const keptIt = inv.status === 'PAID' && inv.paidDate && inv.paidDate.getTime() <= deadline;
      if (!keptIt) brokenPromises += 1;
    }
    const outstanding = c.invoices
      .filter((i) => i.status === 'PENDING')
      .reduce((sum, i) => sum + Math.max(0, Number(i.total) - Number(i.amountPaid ?? 0)), 0);
    return {
      id: c.id,
      name: c.name,
      category: c.category,
      riskTier: c.riskTier,
      score: c.score,
      outstanding: Math.round(outstanding * 100) / 100,
      payments: paid.map((i) => ({ paidAt: i.paidDate!, daysLate: Math.round((i.paidDate!.getTime() - i.dueDate!.getTime()) / DAY) })),
      brokenPromises,
      disputed,
    };
  });
}

export function diagnose(input: SegmentInput, paidBefore?: Date): SegmentDiagnosis {
  const payments = paidBefore ? input.payments.filter((p) => p.paidAt < paidBefore) : input.payments;
  return segmentOf(payments.map((p) => p.daysLate), input.brokenPromises, input.disputed);
}

/** Resumen de la cartera por segmento, tipo de deudor (category) y nivel de riesgo. */
export function summarizeSegments(inputs: SegmentInput[]) {
  const customers = inputs.map((c) => {
    const d = diagnose(c);
    return {
      id: c.id,
      name: c.name,
      category: c.category,
      riskTier: c.riskTier,
      score: c.score,
      outstanding: c.outstanding,
      brokenPromises: c.brokenPromises,
      disputed: c.disputed,
      segment: d.segment,
      segmentName: SEGMENT_NAMES[d.segment],
      reason: d.reason,
      onTimeRate: Math.round(d.onTimeRate * 100) / 100,
      avgDaysLate: d.avgDaysLate,
      offsetDays: d.offsetDays,
    };
  });
  const group = <K extends string>(key: (c: (typeof customers)[number]) => K) => {
    const map = new Map<K, { count: number; outstanding: number }>();
    for (const c of customers) {
      const k = key(c);
      const g = map.get(k) ?? { count: 0, outstanding: 0 };
      g.count += 1;
      g.outstanding = Math.round((g.outstanding + c.outstanding) * 100) / 100;
      map.set(k, g);
    }
    return map;
  };
  const bySegment = group((c) => c.segment);
  return {
    segments: SEGMENT_ORDER.map((s) => ({ segment: s, name: SEGMENT_NAMES[s], ...(bySegment.get(s) ?? { count: 0, outstanding: 0 }) })),
    byCategory: [...group((c) => c.category?.trim() || 'Sin tipo')].map(([category, g]) => ({ category, ...g })).sort((a, b) => b.count - a.count),
    byRiskTier: [...group((c) => c.riskTier ?? 'SIN_CALCULAR')].map(([riskTier, g]) => ({ riskTier, ...g })),
    customers,
  };
}

/**
 * Clientes que HOY entraron a "En deterioro" o "Moroso recurrente" por un pago
 * registrado desde `since`. No guarda estado: compara el segmento con y sin
 * esos pagos, así que una corrida repetida no duplica avisos del mismo pago.
 */
export function newlyWorsened(inputs: SegmentInput[], since: Date) {
  const alerting: CustomerSegment[] = ['deterioro', 'moroso'];
  return inputs
    .map((c) => ({ c, now: diagnose(c), before: diagnose(c, since) }))
    .filter(({ now, before }) => alerting.includes(now.segment) && before.segment !== now.segment)
    .map(({ c, now, before }) => ({ id: c.id, name: c.name, segment: now.segment, previous: before.segment, reason: now.reason, outstanding: c.outstanding }));
}
