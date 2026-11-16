import { Prisma } from '@prisma/client';

/** Origen de un pago en el libro. */
export type PaymentSource = 'BANK' | 'MANUAL' | 'PORTAL' | 'ERP';

/** Diferencia (en la moneda de la factura) que se considera "cuadra". */
export const SETTLEMENT_EPSILON = 0.005;

type Tx = Prisma.TransactionClient;

export interface ApplyPaymentInput {
  organizationId: string;
  invoiceId: string;
  amount: number;
  paidAt: Date;
  source: PaymentSource;
  bankTransactionId?: string | null;
  userId?: string | null;
  note?: string | null;
  /**
   * Da la factura por liquidada aunque el monto no cubra el total (p. ej. el
   * pago llegó neto de retenciones de ISR/IVA y una persona lo confirmó).
   */
  settle?: boolean;
}

export interface ApplyPaymentResult {
  paymentId: string;
  amountPaid: number;
  outstanding: number;
  /** true si con este pago la factura pasó a PAID. */
  settled: boolean;
}

/** Saldo pendiente de una factura (total menos pagos vigentes del libro). */
export function outstandingOf(invoice: {
  total: Prisma.Decimal | number;
  amountPaid?: Prisma.Decimal | number | null;
}): number {
  const total = Number(invoice.total);
  const paid = Number(invoice.amountPaid ?? 0);
  return Math.max(0, Math.round((total - paid) * 100) / 100);
}

/**
 * Registra un pago (total o parcial) en el libro y actualiza la factura.
 * Debe correr dentro de una transacción (`withOrg`). La factura pasa a PAID
 * solo cuando la suma de pagos vigentes cubre su total, o con `settle`.
 * Deja rastro en InvoiceAuditLog. No dispara webhooks: eso es del llamador.
 */
export async function applyPayment(tx: Tx, input: ApplyPaymentInput): Promise<ApplyPaymentResult> {
  if (!(input.amount > 0)) {
    throw new Error('El monto del pago debe ser mayor a cero.');
  }
  const invoice = await tx.invoice.findFirst({
    where: {
      id: input.invoiceId,
      organizationId: input.organizationId,
      direction: 'RECEIVABLE',
      deletedAt: null,
    },
    select: { id: true, status: true, total: true },
  });
  if (!invoice) throw new Error('Factura no encontrada.');
  if (invoice.status !== 'PENDING') {
    throw new Error('La factura ya no está pendiente de cobro.');
  }

  const payment = await tx.invoicePayment.create({
    data: {
      organizationId: input.organizationId,
      invoiceId: input.invoiceId,
      amount: new Prisma.Decimal(input.amount.toFixed(2)),
      paidAt: input.paidAt,
      source: input.source,
      bankTransactionId: input.bankTransactionId ?? null,
      createdByUserId: input.userId ?? null,
      note: input.note ?? null,
    },
  });

  const agg = await tx.invoicePayment.aggregate({
    where: { invoiceId: input.invoiceId, reversedAt: null },
    _sum: { amount: true },
  });
  const amountPaid = Number(agg._sum.amount ?? 0);
  const total = Number(invoice.total);
  const covers = amountPaid >= total - SETTLEMENT_EPSILON;
  const settled = covers || input.settle === true;

  await tx.invoice.update({
    where: { id: input.invoiceId },
    data: settled
      ? {
          amountPaid: new Prisma.Decimal(amountPaid.toFixed(2)),
          status: 'PAID',
          paidDate: input.paidAt,
        }
      : { amountPaid: new Prisma.Decimal(amountPaid.toFixed(2)) },
  });

  await tx.invoiceAuditLog.create({
    data: {
      invoiceId: input.invoiceId,
      userId: input.userId ?? null,
      action: settled ? 'STATUS_CHANGE' : 'PARTIAL_PAYMENT',
      ...(settled ? { previousStatus: 'PENDING' as const, newStatus: 'PAID' as const } : {}),
      metadata: {
        source: input.source,
        paymentId: payment.id,
        amount: input.amount,
        amountPaid,
        total,
        ...(input.bankTransactionId ? { bankTransactionId: input.bankTransactionId } : {}),
        ...(input.settle && !covers
          ? {
              settledWithDifference: Math.round((total - amountPaid) * 100) / 100,
            }
          : {}),
        ...(input.note ? { note: input.note } : {}),
      } as Prisma.InputJsonValue,
    },
  });

  return {
    paymentId: payment.id,
    amountPaid,
    outstanding: Math.max(0, Math.round((total - amountPaid) * 100) / 100),
    settled,
  };
}

/**
 * Marca como revertidos todos los pagos vigentes de una factura (cuando una
 * persona revierte un cobro PAID → PENDING) y deja `amountPaid` en 0. No
 * cambia el status: eso lo hace el llamador.
 */
export async function reverseInvoicePayments(
  tx: Tx,
  invoiceId: string,
  userId: string | null,
  reason: string,
): Promise<number> {
  const res = await tx.invoicePayment.updateMany({
    where: { invoiceId, reversedAt: null },
    data: {
      reversedAt: new Date(),
      reversedReason: reason,
      reversedByUserId: userId,
    },
  });
  await tx.invoice.update({
    where: { id: invoiceId },
    data: { amountPaid: new Prisma.Decimal(0) },
  });
  return res.count;
}
