import { tokenOverlap } from './token-overlap.util';

/**
 * Propuestas de conciliación para depósitos que NO coinciden al centavo con
 * el saldo de una sola factura. Nunca se aplican solas: el movimiento queda
 * en AMBIGUOUS con `matchProposal` y una persona confirma. Además, mientras
 * esté pendiente, la guardia de envío (CollectionSafetyService) no le cobra
 * a las facturas incluidas.
 *
 * Solo se proponen cuando hay evidencia del cliente en el concepto del
 * depósito (nombre o RFC): sin eso, un monto "parecido" no dice nada.
 */

export type ProposalKind =
  'MULTI' | 'MULTI_AMBIGUOUS' | 'RETENTION' | 'PARTIAL' | 'CANDIDATES' | 'SUGGESTED';

export interface MatchProposal {
  kind: ProposalKind;
  invoiceIds: string[];
  customerId?: string;
  explanation: string;
  /** Solo RETENTION: tasa de retención que explica la diferencia. */
  retentionRate?: number;
}

export interface PendingInvoiceForMatch {
  id: string;
  folio: string | null;
  total: number;
  subtotal: number;
  amountPaid: number;
  dueDate: Date | null;
  customerId: string | null;
  customer: { name: string; rfc?: string | null } | null;
}

/** Tolerancia al centavo para sumas de varias facturas. */
const SUM_EPSILON = 0.01;
/** Tolerancia para pagos netos de retención (redondeos del cliente). */
const RETENTION_EPSILON = 1;
/** Máximo de facturas en una combinación y de facturas a combinar. */
const MAX_INVOICES_PER_PAYMENT = 5;
const MAX_INVOICES_TO_COMBINE = 20;
/** Fracción mínima del nombre del cliente que debe aparecer en el concepto. */
const MIN_NAME_OVERLAP = 0.5;

/**
 * Retenciones comunes en México sobre el subtotal (confirmar con el contador
 * de cada cliente; la lista es una ayuda para proponer, no una regla fiscal):
 *  - 0.0125  ISR RESICO personas morales que pagan a personas físicas
 *  - 0.10    ISR por honorarios o arrendamiento
 *  - 0.106667 IVA retenido (dos terceras partes del 16 %)
 *  - 0.04    IVA retenido en autotransporte de carga
 *  - 0.06    IVA retenido en servicios de personal (subcontratación)
 *  - 0.206667 ISR 10 % + IVA 2/3 (honorarios a persona física)
 */
export const RETENTION_RATES = [0.0125, 0.1, 0.106667, 0.04, 0.06, 0.206667];

const round2 = (n: number) => Math.round(n * 100) / 100;
export const outstanding = (inv: PendingInvoiceForMatch) => round2(inv.total - inv.amountPaid);

function hasCustomerEvidence(haystack: string, inv: PendingInvoiceForMatch): boolean {
  if (!inv.customer) return false;
  const rfc = inv.customer.rfc?.trim().toUpperCase();
  if (rfc && rfc.length >= 12 && haystack.toUpperCase().includes(rfc)) return true;
  return tokenOverlap(haystack, inv.customer.name) >= MIN_NAME_OVERLAP;
}

/** Combinaciones de 2..max facturas cuya suma de saldos es `target` (al centavo). */
export function findSubsetsSummingTo(
  invoices: PendingInvoiceForMatch[],
  target: number,
  max = MAX_INVOICES_PER_PAYMENT,
  limit = 2,
): PendingInvoiceForMatch[][] {
  const found: PendingInvoiceForMatch[][] = [];
  const items = invoices.map((inv) => ({ inv, amt: outstanding(inv) })).filter((x) => x.amt > 0);
  const walk = (start: number, chosen: typeof items, sum: number) => {
    if (found.length >= limit) return;
    if (chosen.length >= 2 && Math.abs(sum - target) <= SUM_EPSILON) {
      found.push(chosen.map((c) => c.inv));
      return;
    }
    if (chosen.length >= max || sum > target + SUM_EPSILON) return;
    for (let i = start; i < items.length; i++) {
      walk(i + 1, [...chosen, items[i]], round2(sum + items[i].amt));
      if (found.length >= limit) return;
    }
  };
  walk(0, [], 0);
  return found;
}

/**
 * Propone cómo explicar un depósito sin coincidencia exacta. Orden: varias
 * facturas que suman exacto → pago neto de retención → pago parcial.
 */
export function proposeComposite(
  deposit: { amount: number; description: string; referenceNumber: string | null },
  pending: PendingInvoiceForMatch[],
): MatchProposal | null {
  const haystack = `${deposit.description ?? ''} ${deposit.referenceNumber ?? ''}`;
  const amount = round2(deposit.amount);

  const byCustomer = new Map<string, PendingInvoiceForMatch[]>();
  for (const inv of pending) {
    if (!inv.customerId || outstanding(inv) <= 0) continue;
    if (!hasCustomerEvidence(haystack, inv)) continue;
    const list = byCustomer.get(inv.customerId) ?? [];
    list.push(inv);
    byCustomer.set(inv.customerId, list);
  }
  // Si el concepto menciona a más de un cliente, no se propone nada.
  if (byCustomer.size !== 1) return null;
  const [customerId, invoices] = [...byCustomer.entries()][0];
  const name = invoices[0].customer?.name ?? 'el cliente';
  const folios = (list: PendingInvoiceForMatch[]) =>
    list.map((i) => i.folio ?? i.id.slice(0, 8)).join(', ');

  // 1) Varias facturas del mismo cliente que suman exacto.
  const oldestFirst = [...invoices]
    .sort((a, b) => (a.dueDate?.getTime() ?? 0) - (b.dueDate?.getTime() ?? 0))
    .slice(0, MAX_INVOICES_TO_COMBINE);
  const subsets = findSubsetsSummingTo(oldestFirst, amount);
  if (subsets.length === 1) {
    return {
      kind: 'MULTI',
      invoiceIds: subsets[0].map((i) => i.id),
      customerId,
      explanation: `El depósito suma exacto los saldos de ${subsets[0].length} facturas de ${name}: ${folios(subsets[0])}.`,
    };
  }
  if (subsets.length > 1) {
    const ids = [...new Set(subsets.flat().map((i) => i.id))];
    return {
      kind: 'MULTI_AMBIGUOUS',
      invoiceIds: ids,
      customerId,
      explanation: `Hay más de una combinación de facturas de ${name} que suma el depósito; elige cuáles pagó.`,
    };
  }

  // 2) Pago neto de una retención de ISR/IVA sobre una sola factura
  // (solo facturas sin pagos previos: la retención se calcula sobre el total).
  for (const inv of invoices) {
    if (inv.amountPaid > 0) continue;
    for (const rate of RETENTION_RATES) {
      const expected = round2(inv.total - inv.subtotal * rate);
      if (Math.abs(expected - amount) <= RETENTION_EPSILON) {
        return {
          kind: 'RETENTION',
          invoiceIds: [inv.id],
          customerId,
          retentionRate: rate,
          explanation: `El depósito coincide con la factura ${folios([inv])} de ${name} menos una retención de ${(rate * 100).toFixed(2)} % del subtotal. Confírmalo con el contador antes de darla por pagada.`,
        };
      }
    }
  }

  // 3) Pago parcial: menor que el saldo de alguna factura del cliente.
  const larger = invoices.filter((inv) => outstanding(inv) > amount + SUM_EPSILON);
  if (larger.length > 0) {
    return {
      kind: 'PARTIAL',
      invoiceIds: larger.map((i) => i.id),
      customerId,
      explanation:
        larger.length === 1
          ? `Parece un pago parcial de la factura ${folios(larger)} de ${name} (saldo ${outstanding(larger[0]).toFixed(2)}).`
          : `Parece un pago parcial de ${name}; elige a qué factura aplicarlo (${folios(larger)}).`,
    };
  }
  return null;
}
