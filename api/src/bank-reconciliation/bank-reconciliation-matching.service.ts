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

    const amount = Number(transaction.amount);
    const sameAmount = pending.filter(
      (inv) => Math.abs(Number(inv.total) - amount) < 0.005,
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
        total: Number(inv.total),
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
        await this.prisma.withOrg(organizationId, (tx) =>
          tx.$executeRaw`
            UPDATE "BankTransaction"
            SET "matchStatus" = 'AMBIGUOUS'::"BankTransactionMatchStatus"
            WHERE "id" = ${row.id}
          `,
        );
        await this.activity.record({
          organizationId,
          action: 'BANK_TX_AMBIGUOUS',
          entityType: 'BankTransaction',
          entityId: row.id,
          metadata: { candidates },
        });
        ambiguous += 1;
      }
      // NONE / LOW_CONFIDENCE: se deja UNMATCHED para revisión manual.
    }

    await this.refreshImportCounts(bankStatementImportId, organizationId);
    return { processed: rows.length, autoMatched, ambiguous };
  }

  /**
   * Confirmación humana de un match propuesto (AUTO_MATCHED o AMBIGUOUS con
   * matchedInvoiceId ya elegido a mano vía el endpoint correspondiente). Es
   * la ÚNICA operación de este motor que cambia Invoice.status a PAID.
   */
  async confirmMatch(
    transactionId: string,
    organizationId: string,
    userId: string,
    invoiceIdOverride?: string,
  ): Promise<{ ok: true; invoiceId: string }> {
    const row = await this.getOwnedTransaction(transactionId, organizationId);
    const invoiceId = invoiceIdOverride ?? row.matchedInvoiceId;
    if (!invoiceId) {
      throw new BadRequestException(
        'Esta transacción no tiene un match propuesto para confirmar; indica invoiceId.',
      );
    }

    await this.prisma.withOrg(organizationId, async (tx) => {
      const invoice = await tx.invoice.findFirst({
        where: { id: invoiceId, organizationId, direction: 'RECEIVABLE', deletedAt: null },
      });
      if (!invoice) throw new NotFoundException('Factura vinculada no encontrada.');
      if (invoice.status !== 'PENDING') {
        throw new ConflictException('La factura ya no está pendiente de cobro.');
      }

      await tx.invoice.update({
        where: { id: invoice.id },
        data: { status: 'PAID', paidDate: new Date() },
      });
      await tx.invoiceAuditLog.create({
        data: {
          invoiceId: invoice.id,
          userId,
          action: 'STATUS_CHANGE',
          previousStatus: 'PENDING',
          newStatus: 'PAID',
          metadata: { source: 'bank-reconciliation', bankTransactionId: transactionId },
        },
      });
      await tx.$executeRaw`
        UPDATE "BankTransaction"
        SET "matchStatus" = 'MANUALLY_MATCHED'::"BankTransactionMatchStatus",
            "matchedInvoiceId" = ${invoiceId},
            "matchedAt" = now(),
            "matchedBy" = ${userId}
        WHERE "id" = ${transactionId}
      `;
    });

    await this.activity.record({
      organizationId,
      userId,
      action: 'BANK_TX_MATCH_CONFIRMED',
      entityType: 'BankTransaction',
      entityId: transactionId,
      metadata: { invoiceId },
    });
    await this.refreshImportCounts(row.bankStatementImportId, organizationId);
    return { ok: true, invoiceId };
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
            "matchedBy" = NULL
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
