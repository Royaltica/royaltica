import type { CustomerRiskTier } from '@prisma/client';
import { classifyRiskTier, TIER_SEVERITY } from '../customers/scoring/customer-risk.classify';
import {
  RISK_TIER_INCOBRABLE_DAYS,
} from '../customers/scoring/customer-risk.constants';
import { COLLECTION_TEMPLATES, findTemplate } from '../whatsapp/collection-templates';
import type { Period, ReportFrequency } from './portfolio-period.util';

/**
 * Cálculo del análisis de cartera (pasos 1-3). TODO es determinista: mismos
 * datos → mismo reporte. Funciones puras (sin base de datos) para poder
 * probarlas y para que la IA (paso 4) reciba números ya verificados en vez
 * de calcularlos ella.
 *
 * "Al cierre" de un periodo = estado de la cartera en `period.to` (fin
 * exclusivo): qué facturas seguían abiertas, cuántos días de atraso tenían y
 * en qué categoría de riesgo caía el cliente con la MISMA regla del cron
 * diario (classifyRiskTier). Así el reporte puede comparar contra el periodo
 * anterior aunque sea el primero que se genera.
 */

const DAY = 86_400_000;
const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;
const pct = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : null);

// ── Entradas (lo que el servicio jala de la base) ───────────────────────

export interface CustomerInput {
  id: string;
  name: string;
  category: string | null;
  creditLimitDays: number | null;
  phone: string | null;
  email: string | null;
  financeContactPhone: string | null;
  financeContactEmail: string | null;
  doNotContact: boolean;
  isActive: boolean;
}

export interface InvoiceInput {
  id: string;
  customerId: string | null;
  folio: string | null;
  total: number;
  date: Date;
  dueDate: Date | null;
  status: 'PENDING' | 'AUDITED' | 'APPROVED' | 'PAID' | 'REJECTED';
  paidDate: Date | null;
}

export interface MessageInput {
  customerId: string;
  invoiceId: string | null;
  direction: 'INBOUND' | 'OUTBOUND';
  kind: 'TEXT' | 'TEMPLATE' | 'BUTTON' | 'MEDIA';
  templateName: string | null;
  sent: boolean;
  createdAt: Date;
}

// ── Salidas ─────────────────────────────────────────────────────────────

/** Tipo de cliente por comportamiento de pago (histórico hasta el cierre). */
export type CustomerSegment = 'PUNTUAL' | 'TARDIO' | 'MOROSO' | 'NUEVO';
export type CustomerTrend = 'MEJORO' | 'EMPEORO' | 'ESTABLE' | 'NUEVO' | 'SIN_ACTIVIDAD';

export interface CustomerPeriodMetrics {
  // Estado al cierre
  openCount: number;
  openAmount: number;
  overdueCount: number;
  overdueAmount: number;
  maxDaysOverdue: number;
  /** % de facturas pagadas a tiempo, histórico hasta el cierre. Null = sin historial. */
  punctualityPct: number | null;
  settledCount: number;
  /** Días promedio de atraso de las facturas que se pagaron tarde (histórico). */
  avgLateDays: number | null;
  tier: CustomerRiskTier;
  tierReason: string;
  segment: CustomerSegment;
  // Actividad dentro del periodo
  invoicedCount: number;
  invoicedAmount: number;
  paidCount: number;
  paidAmount: number;
  paidOnTime: number;
  paidLate: number;
  /** Días promedio de atraso de lo pagado en el periodo (a tiempo cuenta como 0). */
  avgPaymentDelayDays: number | null;
  messagesSent: number;
  repliesReceived: number;
  buttonsTapped: number;
  responded: boolean;
  /** Nivel del plan (N0…B) tras el cual se pagó cada factura del periodo. */
  paidAfterLevels: string[];
}

export interface CustomerReportRow {
  customerId: string;
  name: string;
  category: string | null;
  creditDays: number | null;
  segment: CustomerSegment;
  tier: CustomerRiskTier;
  previousTier: CustomerRiskTier | null;
  trend: CustomerTrend;
  /** Por qué se marcó la tendencia, en frases cortas y verificables. */
  trendReasons: string[];
  current: CustomerPeriodMetrics;
  previous: CustomerPeriodMetrics | null;
}

export interface PortfolioTotals {
  customersWithBalance: number;
  openAmount: number;
  overdueAmount: number;
  overduePct: number | null;
  collectedAmount: number;
  collectedCount: number;
  paidOnTimePct: number | null;
  avgPaymentDelayDays: number | null;
  customersMessaged: number;
  customersResponded: number;
  responseRatePct: number | null;
  distribution: Record<CustomerRiskTier, number>;
}

export interface SegmentStats {
  key: string;
  label: string;
  customers: number;
  openAmount: number;
  overdueAmount: number;
  paidOnTimePct: number | null;
  avgPaymentDelayDays: number | null;
  /** Mediana de días de crédito (dueDate − fecha) de sus facturas. */
  medianCreditDays: number | null;
  responseRatePct: number | null;
  /** En qué nivel del plan terminan pagando (conteo por nivel). */
  paidAfterLevel: Record<string, number>;
  improved: number;
  worsened: number;
}

export interface DataQualityIssue {
  code: string;
  severity: 'ALTA' | 'MEDIA' | 'BAJA';
  title: string;
  /** Qué hacer para corregirlo, en una frase. */
  fix: string;
  count: number;
  samples: { id: string; label: string }[];
}

export interface StrategyStat {
  /** Nivel del plan (N0…B) o TEXTO_LIBRE (respuesta redactada con IA). */
  key: string;
  label: string;
  sends: number;
  responded: number;
  paid: number;
  responseRatePct: number | null;
  /** % de envíos tras los que se pagó la factura en los días siguientes. */
  paidRatePct: number | null;
  avgDaysToPay: number | null;
}

export interface StrategiesSummary {
  /** Ventanas usadas para atribuir (se muestran en pantalla). */
  replyWindowHours: number;
  payWindowDays: number;
  minSample: number;
  totalSends: number;
  working: StrategyStat[];
  notWorking: StrategyStat[];
  /** Con menos de `minSample` envíos: todavía no se puede concluir. */
  lowSample: StrategyStat[];
}

export interface PortfolioReportData {
  version: 1;
  frequency: ReportFrequency;
  period: { from: string; to: string; label: string };
  previousPeriod: { from: string; to: string; label: string };
  totals: { current: PortfolioTotals; previous: PortfolioTotals };
  trendCounts: Record<CustomerTrend, number>;
  improved: CustomerReportRow[];
  worsened: CustomerReportRow[];
  /** Les escribimos en el periodo, deben dinero y no contestaron. */
  nonResponders: CustomerReportRow[];
  /** "Se está volviendo incobrable": cerca del umbral o empeorando con atraso. */
  becomingUncollectible: (CustomerReportRow & { daysToUncollectible: number })[];
  segments: SegmentStats[];
  categories: SegmentStats[];
  customers: CustomerReportRow[];
  dataQuality: DataQualityIssue[];
  /** Qué estrategias (niveles del plan / respuestas con IA) están cobrando y cuáles no. */
  strategies: StrategiesSummary;
  generatedAt: string;
}

export const SEGMENT_LABELS: Record<CustomerSegment, string> = {
  PUNTUAL: 'Puntuales',
  TARDIO: 'Pagan tarde',
  MOROSO: 'Morosos',
  NUEVO: 'Nuevos (poco historial)',
};

// ── Helpers ─────────────────────────────────────────────────────────────

/** ¿Seguía abierta la factura en el instante T? (REJECTED = cancelada). */
function isOpenAt(inv: InvoiceInput, t: number): boolean {
  if (inv.status === 'REJECTED') return false;
  if (inv.date.getTime() >= t) return false;
  if (inv.status === 'PAID') {
    // Pagada sin fecha de pago: no sabemos cuándo, se trata como pagada (se
    // reporta en "datos a corregir").
    if (!inv.paidDate) return false;
    return inv.paidDate.getTime() >= t;
  }
  return true;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : round1((s[mid - 1] + s[mid]) / 2);
}

function levelOfTemplate(name: string | null): string | null {
  if (!name) return null;
  return findTemplate(name)?.level ?? name;
}

function emptyDistribution(): Record<CustomerRiskTier, number> {
  return { SANO: 0, ATENCION: 0, RIESGO: 0, INCOBRABLE: 0 };
}

// ── Métricas de un cliente en un periodo ────────────────────────────────

export function customerMetrics(
  invoices: InvoiceInput[],
  messages: MessageInput[],
  period: Period,
): CustomerPeriodMetrics {
  const from = period.from.getTime();
  const to = period.to.getTime();

  let openCount = 0;
  let openAmount = 0;
  let overdueCount = 0;
  let overdueAmount = 0;
  let maxDaysOverdue = 0;
  let settledCount = 0;
  let settledOnTime = 0;
  let lateDaysSum = 0;
  let lateCount = 0;

  let invoicedCount = 0;
  let invoicedAmount = 0;
  let paidCount = 0;
  let paidAmount = 0;
  let paidOnTime = 0;
  let paidLate = 0;
  let delaySum = 0;
  let delayN = 0;
  const paidInPeriod: InvoiceInput[] = [];

  for (const inv of invoices) {
    if (inv.status === 'REJECTED') continue;
    const t = inv.date.getTime();

    if (isOpenAt(inv, to)) {
      openCount += 1;
      openAmount += inv.total;
      const ref = (inv.dueDate ?? inv.date).getTime();
      const days = Math.floor((to - ref) / DAY);
      if (days > 0) {
        overdueCount += 1;
        overdueAmount += inv.total;
        if (days > maxDaysOverdue) maxDaysOverdue = days;
      }
    }

    if (t >= from && t < to) {
      invoicedCount += 1;
      invoicedAmount += inv.total;
    }

    if (inv.status === 'PAID' && inv.paidDate && inv.paidDate.getTime() < to) {
      const paid = inv.paidDate.getTime();
      if (inv.dueDate) {
        settledCount += 1;
        const delay = Math.round((paid - inv.dueDate.getTime()) / DAY);
        if (delay <= 0) settledOnTime += 1;
        else {
          lateDaysSum += delay;
          lateCount += 1;
        }
      }
      if (paid >= from) {
        paidInPeriod.push(inv);
        paidCount += 1;
        paidAmount += inv.total;
        if (inv.dueDate) {
          const delay = Math.round((paid - inv.dueDate.getTime()) / DAY);
          if (delay <= 0) paidOnTime += 1;
          else paidLate += 1;
          delaySum += Math.max(0, delay);
          delayN += 1;
        }
      }
    }
  }

  const punctualityPct = pct(settledOnTime, settledCount);
  const avgLateDays = lateCount > 0 ? round1(lateDaysSum / lateCount) : null;
  const { tier, reason } = classifyRiskTier(maxDaysOverdue, overdueCount, punctualityPct);

  let segment: CustomerSegment;
  if (tier === 'RIESGO' || tier === 'INCOBRABLE' || (avgLateDays ?? 0) > 30) segment = 'MOROSO';
  else if (settledCount < 3) segment = 'NUEVO';
  else if ((punctualityPct ?? 0) >= 90) segment = 'PUNTUAL';
  else segment = 'TARDIO';

  // Mensajes del periodo.
  let messagesSent = 0;
  let repliesReceived = 0;
  let buttonsTapped = 0;
  const outboundTemplates: MessageInput[] = [];
  for (const m of messages) {
    const ts = m.createdAt.getTime();
    if (m.direction === 'OUTBOUND' && m.sent && m.kind === 'TEMPLATE' && ts < to) {
      outboundTemplates.push(m);
    }
    if (ts < from || ts >= to) continue;
    if (m.direction === 'OUTBOUND' && m.sent) messagesSent += 1;
    if (m.direction === 'INBOUND') {
      repliesReceived += 1;
      if (m.kind === 'BUTTON') buttonsTapped += 1;
    }
  }

  // Nivel del plan tras el cual se pagó: última plantilla enviada antes del
  // pago (de esa factura si se sabe; si no, la última al cliente).
  const paidAfterLevels = paidInPeriod.map((inv) => {
    const paid = (inv.paidDate as Date).getTime();
    const before = outboundTemplates
      .filter((m) => m.createdAt.getTime() <= paid)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const own = before.find((m) => m.invoiceId === inv.id);
    return levelOfTemplate((own ?? before[0])?.templateName ?? null) ?? 'SIN_MENSAJE';
  });

  return {
    openCount,
    openAmount: round2(openAmount),
    overdueCount,
    overdueAmount: round2(overdueAmount),
    maxDaysOverdue,
    punctualityPct,
    settledCount,
    avgLateDays,
    tier,
    tierReason: reason,
    segment,
    invoicedCount,
    invoicedAmount: round2(invoicedAmount),
    paidCount,
    paidAmount: round2(paidAmount),
    paidOnTime,
    paidLate,
    avgPaymentDelayDays: delayN > 0 ? round1(delaySum / delayN) : null,
    messagesSent,
    repliesReceived,
    buttonsTapped,
    responded: repliesReceived > 0,
    paidAfterLevels,
  };
}

// ── Comparación contra el periodo anterior ──────────────────────────────

/** Diferencia en días de atraso que cuenta como cambio real (no ruido). */
const DELAY_CHANGE_DAYS = 7;
const MAX_DAYS_CHANGE = 15;

export function compareTrend(
  curr: CustomerPeriodMetrics,
  prev: CustomerPeriodMetrics,
  hadInvoicesBefore: boolean,
): { trend: CustomerTrend; reasons: string[] } {
  if (!hadInvoicesBefore) return { trend: 'NUEVO', reasons: ['Primer periodo con facturas.'] };

  const better: string[] = [];
  const worse: string[] = [];
  let score = 0;

  const tierDiff = TIER_SEVERITY[curr.tier] - TIER_SEVERITY[prev.tier];
  if (tierDiff > 0) {
    worse.push(`Pasó de ${prev.tier} a ${curr.tier}.`);
    score -= 2 * tierDiff;
  } else if (tierDiff < 0) {
    better.push(`Pasó de ${prev.tier} a ${curr.tier}.`);
    score += 2 * -tierDiff;
  }

  if (prev.overdueAmount > 0 && curr.overdueAmount === 0) {
    better.push('Quedó sin saldo vencido.');
    score += 1;
  } else if (prev.overdueAmount === 0 && curr.overdueAmount > 0) {
    worse.push(`Ahora tiene $${curr.overdueAmount.toLocaleString('es-MX')} vencidos.`);
    score -= 1;
  }

  const maxDiff = curr.maxDaysOverdue - prev.maxDaysOverdue;
  if (curr.overdueAmount > 0 && maxDiff >= MAX_DAYS_CHANGE) {
    worse.push(`Su factura más atrasada pasó de ${prev.maxDaysOverdue} a ${curr.maxDaysOverdue} días.`);
    score -= 1;
  }

  if (curr.avgPaymentDelayDays != null && prev.avgPaymentDelayDays != null) {
    const d = curr.avgPaymentDelayDays - prev.avgPaymentDelayDays;
    if (d >= DELAY_CHANGE_DAYS) {
      worse.push(`Paga más tarde: de ${prev.avgPaymentDelayDays} a ${curr.avgPaymentDelayDays} días de atraso promedio.`);
      score -= 1;
    } else if (d <= -DELAY_CHANGE_DAYS) {
      better.push(`Paga más rápido: de ${prev.avgPaymentDelayDays} a ${curr.avgPaymentDelayDays} días de atraso promedio.`);
      score += 1;
    }
  }

  if (prev.responded && !curr.responded && curr.messagesSent > 0 && curr.overdueAmount > 0) {
    worse.push('Dejó de contestar los mensajes.');
    score -= 1;
  }

  const noActivity =
    curr.openCount === 0 && prev.openCount === 0 && curr.paidCount === 0 && curr.invoicedCount === 0;
  if (noActivity) return { trend: 'SIN_ACTIVIDAD', reasons: [] };
  if (score > 0) return { trend: 'MEJORO', reasons: better };
  if (score < 0) return { trend: 'EMPEORO', reasons: worse };
  return { trend: 'ESTABLE', reasons: [...better, ...worse] };
}

// ── Totales de cartera ──────────────────────────────────────────────────

function totalsOf(rows: CustomerPeriodMetrics[]): PortfolioTotals {
  const distribution = emptyDistribution();
  let customersWithBalance = 0;
  let openAmount = 0;
  let overdueAmount = 0;
  let collectedAmount = 0;
  let collectedCount = 0;
  let onTime = 0;
  let late = 0;
  let delaySum = 0;
  let delayN = 0;
  let messaged = 0;
  let responded = 0;
  for (const r of rows) {
    if (r.openCount > 0) {
      customersWithBalance += 1;
      distribution[r.tier] += 1;
    }
    openAmount += r.openAmount;
    overdueAmount += r.overdueAmount;
    collectedAmount += r.paidAmount;
    collectedCount += r.paidCount;
    onTime += r.paidOnTime;
    late += r.paidLate;
    if (r.avgPaymentDelayDays != null) {
      const n = r.paidOnTime + r.paidLate;
      delaySum += r.avgPaymentDelayDays * n;
      delayN += n;
    }
    if (r.messagesSent > 0) {
      messaged += 1;
      if (r.responded) responded += 1;
    }
  }
  return {
    customersWithBalance,
    openAmount: round2(openAmount),
    overdueAmount: round2(overdueAmount),
    overduePct: pct(overdueAmount, openAmount),
    collectedAmount: round2(collectedAmount),
    collectedCount,
    paidOnTimePct: pct(onTime, onTime + late),
    avgPaymentDelayDays: delayN > 0 ? round1(delaySum / delayN) : null,
    customersMessaged: messaged,
    customersResponded: responded,
    responseRatePct: pct(responded, messaged),
    distribution,
  };
}

// ── Estadística por grupo (tipo de cliente / categoría) ─────────────────

function groupStats(
  key: string,
  label: string,
  rows: CustomerReportRow[],
  creditDaysByCustomer: Map<string, number[]>,
): SegmentStats {
  let openAmount = 0;
  let overdueAmount = 0;
  let onTime = 0;
  let late = 0;
  let delaySum = 0;
  let delayN = 0;
  let messaged = 0;
  let responded = 0;
  let improved = 0;
  let worsened = 0;
  const credit: number[] = [];
  const paidAfterLevel: Record<string, number> = {};
  for (const r of rows) {
    const c = r.current;
    openAmount += c.openAmount;
    overdueAmount += c.overdueAmount;
    onTime += c.paidOnTime;
    late += c.paidLate;
    if (c.avgPaymentDelayDays != null) {
      const n = c.paidOnTime + c.paidLate;
      delaySum += c.avgPaymentDelayDays * n;
      delayN += n;
    }
    if (c.messagesSent > 0) {
      messaged += 1;
      if (c.responded) responded += 1;
    }
    if (r.trend === 'MEJORO') improved += 1;
    if (r.trend === 'EMPEORO') worsened += 1;
    for (const lvl of c.paidAfterLevels) paidAfterLevel[lvl] = (paidAfterLevel[lvl] ?? 0) + 1;
    credit.push(...(creditDaysByCustomer.get(r.customerId) ?? []));
  }
  return {
    key,
    label,
    customers: rows.length,
    openAmount: round2(openAmount),
    overdueAmount: round2(overdueAmount),
    paidOnTimePct: pct(onTime, onTime + late),
    avgPaymentDelayDays: delayN > 0 ? round1(delaySum / delayN) : null,
    medianCreditDays: median(credit),
    responseRatePct: pct(responded, messaged),
    paidAfterLevel,
    improved,
    worsened,
  };
}

// ── Datos a corregir (depuración) ───────────────────────────────────────

const SAMPLE_LIMIT = 10;
const OUTLIER_FACTOR = 10;

export function dataQualityIssues(
  customers: CustomerInput[],
  invoices: InvoiceInput[],
): DataQualityIssue[] {
  const issues: DataQualityIssue[] = [];
  const nameById = new Map(customers.map((c) => [c.id, c.name]));
  const invLabel = (i: InvoiceInput) =>
    `${i.folio ?? 'sin folio'} · ${i.customerId ? (nameById.get(i.customerId) ?? '—') : 'sin cliente'}`;
  const push = (
    code: string,
    severity: DataQualityIssue['severity'],
    title: string,
    fix: string,
    items: { id: string; label: string }[],
  ) => {
    if (items.length === 0) return;
    issues.push({ code, severity, title, fix, count: items.length, samples: items.slice(0, SAMPLE_LIMIT) });
  };
  const live = invoices.filter((i) => i.status !== 'REJECTED');

  push(
    'INVOICE_NO_CUSTOMER',
    'ALTA',
    'Facturas sin cliente asignado',
    'Asígnales cliente; sin eso no entran al plan de cobranza ni al análisis.',
    live.filter((i) => !i.customerId).map((i) => ({ id: i.id, label: invLabel(i) })),
  );
  push(
    'INVOICE_NO_DUE_DATE',
    'ALTA',
    'Facturas sin fecha de vencimiento',
    'Captura el vencimiento; sin él no se puede saber si va tarde ni mandar recordatorios a tiempo.',
    live.filter((i) => !i.dueDate).map((i) => ({ id: i.id, label: invLabel(i) })),
  );
  push(
    'PAID_NO_PAID_DATE',
    'MEDIA',
    'Facturas pagadas sin fecha de pago',
    'Registra la fecha de pago; sin ella no cuenta para la puntualidad del cliente.',
    live.filter((i) => i.status === 'PAID' && !i.paidDate).map((i) => ({ id: i.id, label: invLabel(i) })),
  );
  push(
    'DUE_BEFORE_ISSUE',
    'MEDIA',
    'Vencimiento anterior a la fecha de la factura',
    'Revisa las fechas; probablemente se capturaron al revés.',
    live
      .filter((i) => i.dueDate && i.dueDate.getTime() < i.date.getTime())
      .map((i) => ({ id: i.id, label: invLabel(i) })),
  );
  push(
    'NON_POSITIVE_AMOUNT',
    'MEDIA',
    'Facturas con monto en cero o negativo',
    'Corrige el monto o elimínala si es una nota de crédito.',
    live.filter((i) => i.total <= 0).map((i) => ({ id: i.id, label: invLabel(i) })),
  );

  // Folio repetido dentro del mismo cliente.
  const byKey = new Map<string, InvoiceInput[]>();
  for (const i of live) {
    if (!i.folio || !i.customerId) continue;
    const k = `${i.customerId}::${i.folio.trim().toUpperCase()}`;
    byKey.set(k, [...(byKey.get(k) ?? []), i]);
  }
  push(
    'DUPLICATE_FOLIO',
    'ALTA',
    'Folios repetidos en un mismo cliente',
    'Revisa si es la misma factura cargada dos veces; si sí, elimina la copia para no cobrar doble.',
    [...byKey.values()]
      .filter((g) => g.length > 1)
      .map((g) => ({ id: g[0].id, label: `${invLabel(g[0])} (×${g.length})` })),
  );

  // Monto fuera de lo normal para ese cliente.
  const byCustomer = new Map<string, InvoiceInput[]>();
  for (const i of live) {
    if (!i.customerId || i.total <= 0) continue;
    byCustomer.set(i.customerId, [...(byCustomer.get(i.customerId) ?? []), i]);
  }
  const outliers: { id: string; label: string }[] = [];
  for (const list of byCustomer.values()) {
    if (list.length < 4) continue;
    const med = median(list.map((i) => i.total)) ?? 0;
    for (const i of list) {
      if (med > 0 && i.total > med * OUTLIER_FACTOR) {
        outliers.push({ id: i.id, label: `${invLabel(i)} · $${i.total.toLocaleString('es-MX')}` });
      }
    }
  }
  push(
    'AMOUNT_OUTLIER',
    'BAJA',
    'Montos muy por encima de lo normal para ese cliente',
    'Confirma que el monto es correcto (más de 10 veces su factura típica).',
    outliers,
  );

  // Clientes con saldo abierto pero sin forma de contactarlos.
  const now = Date.now();
  const withOpen = new Set(live.filter((i) => isOpenAt(i, now) && i.customerId).map((i) => i.customerId as string));
  push(
    'CUSTOMER_NO_CONTACT',
    'ALTA',
    'Clientes con saldo pendiente y sin teléfono ni correo',
    'Captura el contacto de Finanzas; sin él no les llega ningún recordatorio.',
    customers
      .filter(
        (c) =>
          withOpen.has(c.id) &&
          !c.phone &&
          !c.email &&
          !c.financeContactPhone &&
          !c.financeContactEmail,
      )
      .map((c) => ({ id: c.id, label: c.name })),
  );
  push(
    'CUSTOMER_DO_NOT_CONTACT',
    'BAJA',
    'Clientes con saldo pendiente que pidieron no ser contactados',
    'No reciben mensajes automáticos: dales seguimiento por otra vía.',
    customers
      .filter((c) => withOpen.has(c.id) && c.doNotContact)
      .map((c) => ({ id: c.id, label: c.name })),
  );

  const order = { ALTA: 0, MEDIA: 1, BAJA: 2 };
  return issues.sort((a, b) => order[a.severity] - order[b.severity] || b.count - a.count);
}

// ── Reporte completo ────────────────────────────────────────────────────

const LIST_LIMIT = 10;
/** Atraso a partir del cual se vigila que no cruce a incobrable. */
export const UNCOLLECTIBLE_WATCH_DAYS = 90;
/** Si además empeoró en el periodo, se vigila desde este atraso. */
export const UNCOLLECTIBLE_EARLY_DAYS = 60;

export function buildPortfolioReport(input: {
  frequency: ReportFrequency;
  period: Period;
  previous: Period;
  customers: CustomerInput[];
  invoices: InvoiceInput[];
  messages: MessageInput[];
  now?: Date;
}): PortfolioReportData {
  const { frequency, period, previous, customers, invoices, messages } = input;

  const invByCustomer = new Map<string, InvoiceInput[]>();
  const creditDays = new Map<string, number[]>();
  for (const inv of invoices) {
    if (!inv.customerId) continue;
    invByCustomer.set(inv.customerId, [...(invByCustomer.get(inv.customerId) ?? []), inv]);
    if (inv.dueDate && inv.status !== 'REJECTED') {
      const d = Math.round((inv.dueDate.getTime() - inv.date.getTime()) / DAY);
      if (d >= 0) creditDays.set(inv.customerId, [...(creditDays.get(inv.customerId) ?? []), d]);
    }
  }
  const msgByCustomer = new Map<string, MessageInput[]>();
  for (const m of messages) {
    msgByCustomer.set(m.customerId, [...(msgByCustomer.get(m.customerId) ?? []), m]);
  }

  const rows: CustomerReportRow[] = [];
  for (const c of customers) {
    const invs = invByCustomer.get(c.id) ?? [];
    // Solo clientes que ya tenían facturas al cierre del periodo.
    if (!invs.some((i) => i.status !== 'REJECTED' && i.date.getTime() < period.to.getTime())) continue;
    const msgs = msgByCustomer.get(c.id) ?? [];
    const current = customerMetrics(invs, msgs, period);
    const hadBefore = invs.some((i) => i.status !== 'REJECTED' && i.date.getTime() < period.from.getTime());
    const prev = hadBefore ? customerMetrics(invs, msgs, previous) : null;
    const { trend, reasons } = prev
      ? compareTrend(current, prev, true)
      : { trend: 'NUEVO' as const, reasons: ['Primer periodo con facturas.'] };
    const credit = median(creditDays.get(c.id) ?? []);
    rows.push({
      customerId: c.id,
      name: c.name,
      category: c.category,
      creditDays: credit ?? c.creditLimitDays,
      segment: current.segment,
      tier: current.tier,
      previousTier: prev?.tier ?? null,
      trend,
      trendReasons: reasons,
      current,
      previous: prev,
    });
  }

  const trendCounts: Record<CustomerTrend, number> = {
    MEJORO: 0,
    EMPEORO: 0,
    ESTABLE: 0,
    NUEVO: 0,
    SIN_ACTIVIDAD: 0,
  };
  for (const r of rows) trendCounts[r.trend] += 1;

  const tierDelta = (r: CustomerReportRow) =>
    r.previousTier ? TIER_SEVERITY[r.tier] - TIER_SEVERITY[r.previousTier] : 0;
  const overdueDelta = (r: CustomerReportRow) => r.current.overdueAmount - (r.previous?.overdueAmount ?? 0);

  const improved = rows
    .filter((r) => r.trend === 'MEJORO')
    .sort((a, b) => tierDelta(a) - tierDelta(b) || overdueDelta(a) - overdueDelta(b))
    .slice(0, LIST_LIMIT);
  const worsened = rows
    .filter((r) => r.trend === 'EMPEORO')
    .sort((a, b) => tierDelta(b) - tierDelta(a) || overdueDelta(b) - overdueDelta(a))
    .slice(0, LIST_LIMIT);
  const nonResponders = rows
    .filter((r) => r.current.messagesSent > 0 && !r.current.responded && r.current.overdueAmount > 0)
    .sort((a, b) => b.current.overdueAmount - a.current.overdueAmount)
    .slice(0, LIST_LIMIT);
  const becomingUncollectible = rows
    .filter(
      (r) =>
        r.tier !== 'INCOBRABLE' &&
        r.current.overdueAmount > 0 &&
        (r.current.maxDaysOverdue >= UNCOLLECTIBLE_WATCH_DAYS ||
          (r.trend === 'EMPEORO' && r.current.maxDaysOverdue >= UNCOLLECTIBLE_EARLY_DAYS)),
    )
    .map((r) => ({
      ...r,
      daysToUncollectible: Math.max(0, RISK_TIER_INCOBRABLE_DAYS - r.current.maxDaysOverdue),
    }))
    .sort((a, b) => a.daysToUncollectible - b.daysToUncollectible || b.current.overdueAmount - a.current.overdueAmount)
    .slice(0, LIST_LIMIT);

  const segments = (Object.keys(SEGMENT_LABELS) as CustomerSegment[])
    .map((s) => groupStats(s, SEGMENT_LABELS[s], rows.filter((r) => r.segment === s), creditDays))
    .filter((s) => s.customers > 0);

  const categoryKeys = [...new Set(rows.map((r) => r.category).filter((c): c is string => !!c))];
  const categories = categoryKeys.map((k) =>
    groupStats(k, k, rows.filter((r) => r.category === k), creditDays),
  );

  const iso = (p: Period) => ({ from: p.from.toISOString(), to: p.to.toISOString(), label: p.label });

  return {
    version: 1,
    frequency,
    period: iso(period),
    previousPeriod: iso(previous),
    totals: {
      current: totalsOf(rows.map((r) => r.current)),
      previous: totalsOf(rows.map((r) => r.previous).filter((p): p is CustomerPeriodMetrics => !!p)),
    },
    trendCounts,
    improved,
    worsened,
    nonResponders,
    becomingUncollectible,
    segments,
    categories,
    customers: rows.sort((a, b) => b.current.overdueAmount - a.current.overdueAmount),
    dataQuality: dataQualityIssues(customers, invoices),
    strategies: strategyStats(messages, invoices, period),
    generatedAt: (input.now ?? new Date()).toISOString(),
  };
}

// ── Estrategias: qué está cobrando y qué no ─────────────────────────────

/** Una respuesta cuenta para el envío si llega en estas horas. */
export const STRATEGY_REPLY_WINDOW_HOURS = 72;
/** Un pago cuenta para el envío si ocurre en estos días. */
export const STRATEGY_PAY_WINDOW_DAYS = 14;
/** Envíos mínimos para opinar sobre una estrategia. */
export const STRATEGY_MIN_SAMPLE = 3;
/** Desde esta tasa de pago la estrategia "funciona". */
export const STRATEGY_WORKING_PAID_PCT = 50;

const LEVEL_LABEL = new Map(COLLECTION_TEMPLATES.map((t) => [t.level, t.label]));

/**
 * Efectividad real de cada estrategia en el periodo, a partir de los
 * WhatsApp enviados: cada nivel del plan (su plantilla) y las respuestas en
 * texto libre redactadas con IA. Por envío se mide si el cliente contestó en
 * las siguientes 72 h y si la factura se pagó en los siguientes 14 días.
 * Atribución simple y explicable (no es causalidad estricta).
 */
export function strategyStats(
  messages: MessageInput[],
  invoices: InvoiceInput[],
  period: Period,
): StrategiesSummary {
  const from = period.from.getTime();
  const to = period.to.getTime();
  const replyMs = STRATEGY_REPLY_WINDOW_HOURS * 3_600_000;
  const payMs = STRATEGY_PAY_WINDOW_DAYS * DAY;

  const inboundByCustomer = new Map<string, number[]>();
  for (const m of messages) {
    if (m.direction !== 'INBOUND') continue;
    inboundByCustomer.set(m.customerId, [...(inboundByCustomer.get(m.customerId) ?? []), m.createdAt.getTime()]);
  }
  const invById = new Map(invoices.map((i) => [i.id, i]));
  const invByCustomer = new Map<string, InvoiceInput[]>();
  for (const i of invoices) {
    if (!i.customerId) continue;
    invByCustomer.set(i.customerId, [...(invByCustomer.get(i.customerId) ?? []), i]);
  }

  const acc = new Map<string, { sends: number; responded: number; paid: number; daysSum: number }>();
  for (const m of messages) {
    if (m.direction !== 'OUTBOUND' || !m.sent) continue;
    if (m.kind !== 'TEMPLATE' && m.kind !== 'TEXT') continue;
    const t = m.createdAt.getTime();
    if (t < from || t >= to) continue;
    const key = m.kind === 'TEXT' ? 'TEXTO_LIBRE' : (levelOfTemplate(m.templateName) ?? 'OTRA');
    const a = acc.get(key) ?? { sends: 0, responded: 0, paid: 0, daysSum: 0 };
    a.sends += 1;
    if ((inboundByCustomer.get(m.customerId) ?? []).some((x) => x > t && x <= t + replyMs)) a.responded += 1;

    // Factura del mensaje; si no se sabe, cualquiera del cliente abierta al enviar.
    const candidates = m.invoiceId && invById.has(m.invoiceId)
      ? [invById.get(m.invoiceId) as InvoiceInput]
      : (invByCustomer.get(m.customerId) ?? []).filter((i) => isOpenAt(i, t));
    const paidAt = candidates
      .map((i) => (i.status === 'PAID' && i.paidDate ? i.paidDate.getTime() : null))
      .filter((p): p is number => p != null && p > t && p <= t + payMs)
      .sort((x, y) => x - y)[0];
    if (paidAt != null) {
      a.paid += 1;
      a.daysSum += (paidAt - t) / DAY;
    }
    acc.set(key, a);
  }

  const stats: StrategyStat[] = [...acc.entries()].map(([key, a]) => ({
    key,
    label:
      key === 'TEXTO_LIBRE'
        ? 'Respuesta redactada con IA (ventana de 24 h)'
        : (LEVEL_LABEL.get(key as never) ?? key),
    sends: a.sends,
    responded: a.responded,
    paid: a.paid,
    responseRatePct: pct(a.responded, a.sends),
    paidRatePct: pct(a.paid, a.sends),
    avgDaysToPay: a.paid > 0 ? round1(a.daysSum / a.paid) : null,
  }));
  const byPaid = (x: StrategyStat, y: StrategyStat) =>
    (y.paidRatePct ?? 0) - (x.paidRatePct ?? 0) || (y.responseRatePct ?? 0) - (x.responseRatePct ?? 0) || y.sends - x.sends;
  const enough = stats.filter((s) => s.sends >= STRATEGY_MIN_SAMPLE);

  return {
    replyWindowHours: STRATEGY_REPLY_WINDOW_HOURS,
    payWindowDays: STRATEGY_PAY_WINDOW_DAYS,
    minSample: STRATEGY_MIN_SAMPLE,
    totalSends: stats.reduce((n, s) => n + s.sends, 0),
    working: enough.filter((s) => (s.paidRatePct ?? 0) >= STRATEGY_WORKING_PAID_PCT).sort(byPaid),
    notWorking: enough
      .filter((s) => (s.paidRatePct ?? 0) < STRATEGY_WORKING_PAID_PCT)
      .sort((x, y) => byPaid(y, x)),
    lowSample: stats.filter((s) => s.sends < STRATEGY_MIN_SAMPLE).sort(byPaid),
  };
}
