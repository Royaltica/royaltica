import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../common/prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';

/** Horas que un "ya pagué" pausa los envíos automáticos a ese cliente/factura. */
export const PAYMENT_CLAIM_PAUSE_HOURS = 72;
/** Horas que se espera tras revertir un cobro (PAID → PENDING) antes de volver a cobrar. */
export const REVERT_COOLDOWN_HOURS = 24;
/** Antigüedad máxima de un depósito sin revisar que todavía frena el envío. */
export const PENDING_REVIEW_LOOKBACK_DAYS = 30;

export type SafetyBlockReason =
  | 'collection-paused'
  | 'customer-do-not-contact'
  | 'payment-pending-review'
  | 'payment-claimed'
  | 'recently-reverted'
  | 'stale-payment-data';

export type SafetyVerdict =
  { ok: true } | { ok: false; reason: SafetyBlockReason; detail?: Record<string, unknown> };

export interface SafetyCheckInput {
  organizationId: string;
  invoiceId: string;
  customer: {
    id: string;
    doNotContact: boolean;
    paymentClaimedAt: Date | null;
  };
  invoicePaymentClaimedAt: Date | null;
  /** CollectionPolicy.paymentDataMaxAgeHours; null/undefined = guardia apagada. */
  paymentDataMaxAgeHours?: number | null;
  now?: Date;
}

const HOUR = 3_600_000;

/**
 * Guardias que se aplican ANTES de cualquier envío automático a un deudor,
 * sin importar el camino (motor por niveles o recordatorio de un paso). El
 * objetivo es uno: no cobrarle a quien probablemente ya pagó. Si hay duda,
 * no se envía y queda el motivo registrado.
 *
 * Orden (se devuelve el primer bloqueo):
 *  1. Interruptor de emergencia de la organización.
 *  2. Baja del cliente (doNotContact).
 *  3. "Ya pagué" reciente (factura o cliente) — 72 h.
 *  4. Cobro revertido hace menos de 24 h.
 *  5. Depósito bancario sin revisar que podría ser de esta factura.
 *  6. Estado de cuenta viejo (solo si la política lo exige).
 */
@Injectable()
export class CollectionSafetyService {
  private readonly logger = new Logger(CollectionSafetyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /** true si la organización tiene encendido el interruptor de emergencia. */
  async isOrganizationPaused(organizationId: string): Promise<boolean> {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { collectionPausedAt: true },
    });
    return Boolean(org?.collectionPausedAt);
  }

  async checkBeforeSend(input: SafetyCheckInput): Promise<SafetyVerdict> {
    const now = input.now ?? new Date();

    if (await this.isOrganizationPaused(input.organizationId)) {
      return { ok: false, reason: 'collection-paused' };
    }
    if (input.customer.doNotContact) {
      return { ok: false, reason: 'customer-do-not-contact' };
    }

    const claimCutoff = new Date(now.getTime() - PAYMENT_CLAIM_PAUSE_HOURS * HOUR);
    const claimedAt = [input.invoicePaymentClaimedAt, input.customer.paymentClaimedAt]
      .filter((d): d is Date => d instanceof Date)
      .sort((a, b) => b.getTime() - a.getTime())[0];
    if (claimedAt && claimedAt > claimCutoff) {
      return {
        ok: false,
        reason: 'payment-claimed',
        detail: { claimedAt: claimedAt.toISOString() },
      };
    }

    const reverted = await this.prisma.invoiceAuditLog.findFirst({
      where: {
        invoiceId: input.invoiceId,
        action: 'STATUS_CHANGE',
        previousStatus: 'PAID',
        newStatus: 'PENDING',
        createdAt: {
          gt: new Date(now.getTime() - REVERT_COOLDOWN_HOURS * HOUR),
        },
      },
      select: { createdAt: true },
    });
    if (reverted) {
      return {
        ok: false,
        reason: 'recently-reverted',
        detail: { revertedAt: reverted.createdAt.toISOString() },
      };
    }

    const lookback = new Date(now.getTime() - PENDING_REVIEW_LOOKBACK_DAYS * 24 * HOUR);
    const pending = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "BankTransaction"
      WHERE "organizationId" = ${input.organizationId}
        AND "isDebit" = false
        AND "transactionDate" >= ${lookback}
        AND "matchStatus" IN (
          'UNMATCHED'::"BankTransactionMatchStatus",
          'AUTO_MATCHED'::"BankTransactionMatchStatus",
          'AMBIGUOUS'::"BankTransactionMatchStatus"
        )
        AND (
          "matchedInvoiceId" = ${input.invoiceId}
          OR COALESCE("matchProposal" -> 'invoiceIds', '[]'::jsonb) ? ${input.invoiceId}
        )
      LIMIT 1
    `;
    if (pending.length > 0) {
      return {
        ok: false,
        reason: 'payment-pending-review',
        detail: { bankTransactionId: pending[0].id },
      };
    }

    if (input.paymentDataMaxAgeHours != null && input.paymentDataMaxAgeHours > 0) {
      const last = await this.prisma.bankStatementImport.findFirst({
        where: { organizationId: input.organizationId },
        orderBy: { importedAt: 'desc' },
        select: { importedAt: true },
      });
      const limit = new Date(now.getTime() - input.paymentDataMaxAgeHours * HOUR);
      if (!last || last.importedAt < limit) {
        return {
          ok: false,
          reason: 'stale-payment-data',
          detail: { lastImportAt: last?.importedAt.toISOString() ?? null },
        };
      }
    }

    return { ok: true };
  }

  /**
   * Ejecuta `fn` solo si nadie más tiene el candado de cobranza de esta
   * organización (varias réplicas o una corrida manual encimada). Si Redis no
   * responde, NO se ejecuta (falla cerrada: es preferible no enviar a enviar
   * dos veces). Devuelve null si no se obtuvo el candado.
   */
  async withOrganizationLock<T>(
    organizationId: string,
    fn: () => Promise<T>,
    ttlMs = 15 * 60_000,
  ): Promise<T | null> {
    const key = `lock:collection:${organizationId}`;
    const token = randomUUID();
    let acquired = false;
    try {
      acquired = (await this.redis.set(key, token, 'PX', ttlMs, 'NX')) === 'OK';
    } catch (err) {
      this.logger.error(
        `No se pudo tomar el candado de cobranza de ${organizationId}: ${(err as Error).message}`,
      );
      return null;
    }
    if (!acquired) return null;
    try {
      return await fn();
    } finally {
      try {
        // Solo se libera si el candado sigue siendo nuestro.
        const current = await this.redis.get(key);
        if (current === token) await this.redis.del(key);
      } catch {
        /* expira solo por TTL */
      }
    }
  }
}
