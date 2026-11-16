import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { ActivityLogService } from '../activity/activity-log.service';
import { NotificationsService } from '../notifications/notifications.service';
import { tokenOverlap } from './token-overlap.util';
import { applyPayment, outstandingOf } from '../payment-ledger/payment-ledger';
import { proposeComposite, type MatchProposal } from './composite-match';
import {
  AUTO_MATCH_CONFIDENCE_THRESHOLD,
  MATCH_SCORE,
  type BankTransactionRow,
  type MatchCandidate,
} from './bank-reconciliation.types';

/** Diferencia mínima de confianza entre el 1° y 2° candidato para que el
 * mejor "gane" en vez de quedar AMBIGUOUS. Si dos facturas quedan muy cerca
 * en score, el motor NO adivina (ver evaluateCandidates). */
const DISAMBIGUATION_MARGIN = 0.2;

/** Resultado de evaluar la lista de candidatos de una transacción: qué hacer
 * (o no hacer) automáticamente. Exportado para poder probarlo aislado. */
export interface MatchEvaluation {
  outcome: 'NONE' | 'LOW_CONFIDENCE' | 'AMBIGUOUS' | 'AUTO';
  best: MatchCandidate | null;
}

/** Decide el desenlace de una lista de candidatos YA ordenada/generada por
 * matchTransaction. Pura (sin I/O) para facilitar pruebas unitarias. */
export function evaluateCandidates(candidates: MatchCandidate[]): MatchEvaluation {
  if (candidates.length === 0) return { outcome: 'NONE', best: null };

  const sorted = [...candidates].sort((a, b) => b.confidence - a.confidence);
  const [top, second] = sorted;

  if (sorted.length > 1) {
    const margin = top.confidence - second.confidence;
    if (margin < DISAMBIGUATION_MARGIN) {
      // Varias facturas son plausibles y ninguna se distingue con claridad:
      // el motor no adivina, se marca AMBIGUOUS y se surface todo (ver spec).
      return { outcome: 'AMBIGUOUS', best: null };
    }
  }

  if (top.confidence >= AUTO_MATCH_CONFIDENCE_THRESHOLD) {
    return { outcome: 'AUTO', best: top };
  }
  return { outcome: 'LOW_CONFIDENCE', best: top };
}

/**
 * Motor de conciliación bancaria: dado un depósito bancario (BankTransaction),
 * propone facturas CxC (Invoice PENDING) candidatas y, para los casos de alta
 * confianza, deja el match propuesto para confirmación humana de un clic
 * (NUNCA marca la factura PAID por sí solo — mismo nivel de cautela que
 * customer-portal.service.ts#markInvoicePaid). confirmMatch es la única
 * operación que sí cambia el status real de la factura.
 */
@Injectable()
export class BankReconciliationMatchingService {
  private readonly logger = new Logger(BankReconciliationMatchingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityLogService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Candidatos de match para UNA transacción, entre las facturas RECEIVABLE
   * PENDING de la organización. El monto es condición necesaria (no hay
   * candidato sin coincidencia de monto): folio y nombre de cliente solo
   * SUMAN confianza, nunca sustituyen el monto.
   */
  async matchTransaction(
    transaction: Pick<BankTransactionRow, 'amount' | 'description' | 'referenceNumber'>,
    organizationId: string,
  ): Promise<MatchCandidate[]> {
    const pending = await this.prisma.withOrg(organizationId, (tx) =>
      tx.invoice.findMany({
        where: {
          organizationId,
          direction: 'RECEIVABLE',
          status: 'PENDING',
          deletedAt: null,
        },
        include: { customer: { select: { name: true } } },
      }),
    );

    // Se compara contra el SALDO (total menos pagos parciales del libro), no
    // contra el total: después de un abono parcial, el siguiente depósito
    // liquida lo que falta.
    const amount = Number(transaction.amount);
    const sameAmount = pending.filter(
      (inv) => Math.abs(outstandingOf(inv) - amount) < 0.005,
    );
    if (sameAmount.length === 0) return [];

    const haystack = `${transaction.description ?? ''} ${transaction.referenceNumber ?? ''}`.toLowerCase();
    const candidates: MatchCandidate[] = [];

    for (const inv of sameAmount) {
      const reasons: string[] = [];
      let confidence: number;

      if (sameAmount.length === 1) {
        confidence = MATCH_SCORE.EXACT_AMOUNT_SINGLE;
        reasons.push('Monto exacto: única factura pendiente con ese total.');
      } else {
        // El monto por sí solo no distingue entre varias facturas: aporta
        // una fracción de la señal, el resto tiene que venir de folio/nombre.
        confidence = MATCH_SCORE.EXACT_AMOUNT_SINGLE / sameAmount.length;
        reasons.push(
          `Monto exacto, pero ${sameAmount.length} facturas pendientes comparten ese total.`,
        );
      }

      if (inv.folio && haystack.includes(inv.folio.toLowerCase())) {
        confidence += MATCH_SCORE.FOLIO_IN_REFERENCE;
        reasons.push(
          `El folio "${inv.folio}" aparece en la referencia/descripción del depósito.`,
        );
      }

      const customerName = inv.customer?.name;
      if (customerName) {
        const overlap = tokenOverlap(transaction.description ?? '', customerName);
        if (overlap > 0) {
          confidence += MATCH_SCORE.CUSTOMER_NAME_OVERLAP * overlap;
          reasons.push(
            `La descripción menciona parte del nombre del cliente "${customerName}".`,
          );
        }
      }

      candidates.push({
        invoiceId: inv.id,
        folio: inv.folio,
        total: outstandingOf(inv),
        confidence: Math.min(1, confidence),
        reasons,
      });
    }

    return candidates.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Corre matchTransaction sobre todas las transacciones UNMATCHED de un
   * import y, según evaluateCandidates, marca AUTO_MATCHED (+ notifica a
   * admins para confirmar) o AMBIGUOUS. Nunca toca Invoice.status.
   */
  async runAutoMatch(
    bankStatementImportId: string,
    organizationId: string,
  ): Promise<{ processed: number; autoMatched: number; ambiguous: number }> {
    const rows = await this.prisma.withOrg(organizationId, (tx) =>
      tx.$queryRaw<BankTransactionRow[]>`
        SELECT * FROM "BankTransaction"
        WHERE "bankStatementImportId" = ${bankStatementImportId}
          AND "organizationId" = ${organizationId}
          AND "matchStatus" = 'UNMATCHED'::"BankTransactionMatchStatus"
          AND "isDebit" = false
      `,
    );

    let autoMatched = 0;
    let ambiguous = 0;

    for (const row of rows) {
      const candidates = await this.matchTransaction(row, organizationId);
      const { outcome, best } = evaluateCandidates(candidates);

      if (outcome === 'AUTO' && best) {
        await this.prisma.withOrg(organizationId, (tx) =>
          tx.$executeRaw`
            UPDATE "BankTransaction"
            SET "matchStatus" = 'AUTO_MATCHED'::"BankTransactionMatchStatus",
                "matchedInvoiceId" = ${best.invoiceId},
                "matchConfidence" = ${best.confidence}
            WHERE "id" = ${row.id}
          `,
        );
        await this.activity.record({
          organizationId,
          action: 'BANK_TX_AUTO_MATCHED',
          entityType: 'BankTransaction',
          entityId: row.id,
          metadata: { invoiceId: best.invoiceId, confidence: best.confidence, reasons: best.reasons },
        });
        await this.notifyAdmins(organizationId, row, best);
        autoMatched += 1;
      } else if (outcome === 'AMBIGUOUS') {
        // Se guardan los candidatos: la guardia de envío no le cobra a
        // ninguno de ellos mientras una persona decide.
        await this.setProposal(organizationId, row.id, 'AMBIGUOUS', {
          kind: 'CANDIDATES',
          invoiceIds: candidates.map((c) => c.invoiceId),
          explanation: 'Varias facturas pendientes tienen ese mismo saldo; elige cuál pagó.',
        });
        await this.activity.record({
          organizationId,
          action: 'BANK_TX_AMBIGUOUS',
          entityType: 'BankTransaction',
          entityId: row.id,
          metadata: { candidates },
        });
        ambiguous += 1;
      } else if (outcome === 'LOW_CONFIDENCE' && best) {
        // Un solo candidato pero sin evidencia suficiente para auto-empatar:
        // queda como sugerencia (sigue UNMATCHED) y frena los envíos a esa
        // factura hasta que alguien lo revise.
        await this.setProposal(organizationId, row.id, 'UNMATCHED', {
          kind: 'SUGGESTED',
          invoiceIds: [best.invoiceId],
          explanation: best.reasons.join(' '),
        });
      } else if (outcome === 'NONE') {
        // Sin coincidencia exacta: ¿varias facturas, retención o parcial?
        const proposal = await this.proposeFor(row, organizationId);
        if (proposal) {
          await this.setProposal(organizationId, row.id, 'AMBIGUOUS', proposal);
          await this.activity.record({
            organizationId,
            action: 'BANK_TX_PROPOSAL',
            entityType: 'BankTransaction',
            entityId: row.id,
            metadata: { ...proposal },
          });
          ambiguous += 1;
        }
      }
    }

    await this.refreshImportCounts(bankStatementImportId, organizationId);
    return { processed: rows.length, autoMatched, ambiguous };
  }

  /**
   * Confirmación humana de un match propuesto (AUTO_MATCHED o AMBIGUOUS con
   * matchedInvoiceId ya elegido a mano vía el endpoint correspondiente). Es
   * la ÚNICA operación de este motor que cambia Invoice.status a PAID.
   */
  /**
   * Confirmación humana de un depósito. Es la ÚNICA operación de este motor
   * que registra pagos y puede pasar facturas a PAID. Todo pasa por el libro
   * de pagos (InvoicePayment):
   *  - match propuesto o factura indicada a mano: el depósito se aplica a esa
   *    factura (si es menor al saldo queda como pago parcial);
   *  - propuesta MULTI: se liquida el saldo de cada factura de la combinación;
   *  - propuesta RETENTION: se da por liquidada aunque llegue neta.
   * Nunca se aplica más que el saldo de una factura ni más que el depósito.
   */
  async confirmMatch(
    transactionId: string,
    organizationId: string,
    userId: string,
    invoiceIdOverride?: string,
  ): Promise<{
    ok: true;
    invoiceId: string;
    invoiceIds: string[];
    settled: string[];
    partial: string[];
  }> {
    const row = await this.getOwnedTransaction(transactionId, organizationId);
    if (row.isDebit) {
      throw new BadRequestException(
        'Un cargo (retiro) no se puede conciliar contra una factura por cobrar.',
      );
    }
    if (row.matchStatus === 'MANUALLY_MATCHED') {
      throw new ConflictException('Este depósito ya se concilió.');
    }
    const proposal = (row.matchProposal ?? null) as MatchProposal | null;
    const deposit = Number(row.amount);

    // A qué facturas se aplica y cuánto a cada una.
    let plan: { invoiceId: string; amount: number | 'OUTSTANDING'; settle: boolean }[];
    if (invoiceIdOverride) {
      const isRetention =
        proposal?.kind === 'RETENTION' && proposal.invoiceIds.includes(invoiceIdOverride);
      plan = [{ invoiceId: invoiceIdOverride, amount: deposit, settle: isRetention }];
    } else if (row.matchedInvoiceId) {
      plan = [{ invoiceId: row.matchedInvoiceId, amount: deposit, settle: false }];
    } else if (proposal?.kind === 'MULTI') {
      plan = proposal.invoiceIds.map((id) => ({
        invoiceId: id,
        amount: 'OUTSTANDING' as const,
        settle: false,
      }));
    } else if (proposal?.kind === 'RETENTION' && proposal.invoiceIds.length === 1) {
      plan = [{ invoiceId: proposal.invoiceIds[0], amount: deposit, settle: true }];
    } else if (
      (proposal?.kind === 'PARTIAL' || proposal?.kind === 'SUGGESTED') &&
      proposal.invoiceIds.length === 1
    ) {
      plan = [{ invoiceId: proposal.invoiceIds[0], amount: deposit, settle: false }];
    } else {
      throw new BadRequestException(
        'Esta transacción no tiene un match propuesto para confirmar; indica invoiceId.',
      );
    }

    const settled: string[] = [];
    const partial: string[] = [];
    await this.prisma.withOrg(organizationId, async (tx) => {
      let remaining = deposit;
      for (const step of plan) {
        const invoice = await tx.invoice.findFirst({
          where: { id: step.invoiceId, organizationId, direction: 'RECEIVABLE', deletedAt: null },
        });
        if (!invoice) throw new NotFoundException('Factura vinculada no encontrada.');
        if (invoice.status !== 'PENDING') {
          throw new ConflictException('La factura ya no está pendiente de cobro.');
        }
        const saldo = outstandingOf(invoice);
        const wanted = step.amount === 'OUTSTANDING' ? saldo : step.amount;
        const amount = Math.round(Math.min(wanted, saldo, remaining) * 100) / 100;
        if (amount <= 0) {
          throw new BadRequestException('El depósito ya no alcanza para esta factura.');
        }
        const res = await applyPayment(tx, {
          organizationId,
          invoiceId: invoice.id,
          amount,
          paidAt: row.transactionDate,
          source: 'BANK',
          bankTransactionId: transactionId,
          userId,
          note: proposal && !invoiceIdOverride ? proposal.explanation : null,
          settle: step.settle,
        });
        remaining = Math.round((remaining - amount) * 100) / 100;
        (res.settled ? settled : partial).push(invoice.id);
      }
      await tx.$executeRaw`
        UPDATE "BankTransaction"
        SET "matchStatus" = 'MANUALLY_MATCHED'::"BankTransactionMatchStatus",
            "matchedInvoiceId" = ${plan[0].invoiceId},
            "matchedAt" = now(),
            "matchedBy" = ${userId}
        WHERE "id" = ${transactionId}
      `;
    });

    const invoiceIds = plan.map((p) => p.invoiceId);
    await this.activity.record({
      organizationId,
      userId,
      action: 'BANK_TX_MATCH_CONFIRMED',
      entityType: 'BankTransaction',
      entityId: transactionId,
      metadata: {
        invoiceId: invoiceIds[0],
        invoiceIds,
        settled,
        partial,
        kind: proposal?.kind ?? null,
      },
    });
    await this.refreshImportCounts(row.bankStatementImportId, organizationId);
    return { ok: true, invoiceId: invoiceIds[0], invoiceIds, settled, partial };
  }

  /** Rechaza el match propuesto/confirmado; vuelve a UNMATCHED para revisión
   * manual. No revierte el status de la factura si ya se había confirmado
   * antes (ver receivables.service.ts para corregir manualmente). */
  async rejectMatch(
    transactionId: string,
    organizationId: string,
    userId: string,
  ): Promise<{ ok: true }> {
    const row = await this.getOwnedTransaction(transactionId, organizationId);

    await this.prisma.withOrg(organizationId, (tx) =>
      tx.$executeRaw`
        UPDATE "BankTransaction"
        SET "matchStatus" = 'UNMATCHED'::"BankTransactionMatchStatus",
            "matchedInvoiceId" = NULL,
            "matchConfidence" = NULL,
            "matchedAt" = NULL,
            "matchedBy" = NULL,
            "matchProposal" = NULL
        WHERE "id" = ${transactionId}
      `,
    );

    await this.activity.record({
      organizationId,
      userId,
      action: 'BANK_TX_MATCH_REJECTED',
      entityType: 'BankTransaction',
      entityId: transactionId,
      metadata: { previousInvoiceId: row.matchedInvoiceId },
    });
    await this.refreshImportCounts(row.bankStatementImportId, organizationId);
    return { ok: true };
  }

  // ── helpers ───────────────────────────────────────────────

  /** Propuesta compuesta (varias facturas, retención o parcial) para un depósito. */
  private async proposeFor(
    row: BankTransactionRow,
    organizationId: string,
  ): Promise<MatchProposal | null> {
    const pending = await this.prisma.withOrg(organizationId, (tx) =>
      tx.invoice.findMany({
        where: { organizationId, direction: 'RECEIVABLE', status: 'PENDING', deletedAt: null },
        include: { customer: { select: { name: true, rfc: true } } },
      }),
    );
    return proposeComposite(
      {
        amount: Number(row.amount),
        description: row.description,
        referenceNumber: row.referenceNumber,
      },
      pending.map((inv) => ({
        id: inv.id,
        folio: inv.folio,
        total: Number(inv.total),
        subtotal: Number(inv.subtotal),
        amountPaid: Number(inv.amountPaid ?? 0),
        dueDate: inv.dueDate,
        customerId: inv.customerId,
        customer: inv.customer,
      })),
    );
  }

  private async setProposal(
    organizationId: string,
    transactionId: string,
    status: 'AMBIGUOUS' | 'UNMATCHED',
    proposal: MatchProposal,
  ): Promise<void> {
    await this.prisma.withOrg(organizationId, (tx) =>
      tx.$executeRaw`
        UPDATE "BankTransaction"
        SET "matchStatus" = ${status}::"BankTransactionMatchStatus",
            "matchProposal" = ${JSON.stringify(proposal)}::jsonb
        WHERE "id" = ${transactionId}
      `,
    );
  }

  private async getOwnedTransaction(
    transactionId: string,
    organizationId: string,
  ): Promise<BankTransactionRow> {
    const rows = await this.prisma.withOrg(organizationId, (tx) =>
      tx.$queryRaw<BankTransactionRow[]>`
        SELECT * FROM "BankTransaction"
        WHERE "id" = ${transactionId} AND "organizationId" = ${organizationId}
        LIMIT 1
      `,
    );
    const row = rows[0];
    if (!row) throw new NotFoundException('Transacción bancaria no encontrada.');
    return row;
  }

  private async notifyAdmins(
    organizationId: string,
    row: BankTransactionRow,
    best: MatchCandidate,
  ): Promise<void> {
    try {
      await this.notifications.notifyOrgAdmins(organizationId, {
        type: 'BANK_MATCH_PROPOSED',
        title: 'Depósito bancario conciliado automáticamente (pendiente de confirmar)',
        body: `Un depósito de ${Number(row.amount).toFixed(2)} coincide con la factura ${
          best.folio ?? best.invoiceId
        } (confianza ${Math.round(best.confidence * 100)}%). Confírmalo para marcarla como pagada.`,
        metadata: { bankTransactionId: row.id, invoiceId: best.invoiceId, confidence: best.confidence },
      });
    } catch (err) {
      this.logger.warn(
        `No se pudo notificar el match automático (${row.id}): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  private async refreshImportCounts(
    bankStatementImportId: string,
    organizationId: string,
  ): Promise<void> {
    await this.prisma.withOrg(organizationId, async (tx) => {
      const counts = await tx.$queryRaw<{ matched: bigint; unmatched: bigint }[]>`
        SELECT
          COUNT(*) FILTER (WHERE "matchStatus" IN ('AUTO_MATCHED','MANUALLY_MATCHED')) AS matched,
          COUNT(*) FILTER (WHERE "matchStatus" IN ('UNMATCHED','AMBIGUOUS','REJECTED')) AS unmatched
        FROM "BankTransaction"
        WHERE "bankStatementImportId" = ${bankStatementImportId}
          AND "isDebit" = false
      `;
      const c = counts[0];
      await tx.$executeRaw`
        UPDATE "BankStatementImport"
        SET "matchedCount" = ${Number(c?.matched ?? 0)}, "unmatchedCount" = ${Number(c?.unmatched ?? 0)}
        WHERE "id" = ${bankStatementImportId}
      `;
    });
  }
}
