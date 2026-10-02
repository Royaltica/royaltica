import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { ActivityLogService } from '../activity/activity-log.service';
import { FieldMappingService } from '../external-data-sync/field-mapping.service';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { BankStatementCsvConnector } from './bank-statement-csv.connector';
import { BankReconciliationMatchingService } from './bank-reconciliation-matching.service';
import type {
  BankStatementImportRow,
  BankTransactionMatchStatus,
  BankTransactionRow,
} from './bank-reconciliation.types';

const VALID_STATUSES: BankTransactionMatchStatus[] = [
  'UNMATCHED',
  'AUTO_MATCHED',
  'MANUALLY_MATCHED',
  'REJECTED',
  'AMBIGUOUS',
];

/**
 * FR-07 (spec "Mejoras V1"): el banco reporta el movimiento con un desfase
 * de compensación — el dinero no está realmente disponible el mismo día que
 * aparece en el estado de cuenta. Se asume T+1 día natural como ventana de
 * liquidación (simplificación conservadora: no distingue fines de semana ni
 * días festivos bancarios, pero nunca subestima el desfase).
 */
const SETTLEMENT_DELAY_DAYS = 1;

const addDays = (date: Date, days: number): Date => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

/** BankTransaction serializado para la API (Decimal/bigint → number). */
const serializeTransaction = (t: BankTransactionRow) => {
  const settlementAvailableAt = addDays(t.transactionDate, SETTLEMENT_DELAY_DAYS);
  return {
    ...t,
    amount: Number(t.amount),
    // FR-07: el tablero de "dos botones" debe mostrar al usuario contable si
    // el banco ya liquidó los fondos (T+1) o si el reporte es todavía
    // provisional — confirmar un match ANTES de T+1 es válido pero el
    // frontend puede advertirlo con este flag.
    settlementAvailableAt,
    fundsSettled: Date.now() >= settlementAvailableAt.getTime(),
  };
};

/**
 * Orquesta la conciliación bancaria: resuelve el mapeo de columnas de la
 * organización (FieldMappingService, entityType=BANK_STATEMENT), importa el
 * archivo con BankStatementCsvConnector, dispara el matching automático
 * (BankReconciliationMatchingService.runAutoMatch) y expone confirm/reject
 * para la revisión humana. Toda acción queda en ActivityLogService.
 */
@Injectable()
export class BankReconciliationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityLogService,
    private readonly fieldMapping: FieldMappingService,
    private readonly matching: BankReconciliationMatchingService,
  ) {}

  async importStatement(
    user: AuthenticatedUser,
    file: { buffer: Buffer } | undefined,
    bankName: string | undefined,
  ): Promise<{
    importId: string;
    imported: number;
    skipped: number;
    errors: string[];
    autoMatched: number;
    ambiguous: number;
  }> {
    const organizationId = this.requireOrg(user);
    if (!file?.buffer || file.buffer.length === 0) {
      throw new BadRequestException('Sube un archivo CSV del estado de cuenta.');
    }

    const mapping = await this.fieldMapping.getEffective(organizationId, 'BANK_STATEMENT');
    const connector = new BankStatementCsvConnector(this.prisma, file.buffer, mapping);
    const importResult = await connector.import(organizationId, bankName?.trim() || 'unknown');

    const matchResult = await this.matching.runAutoMatch(importResult.importId, organizationId);

    await this.activity.record({
      organizationId,
      userId: user.id,
      action: 'BANK_STATEMENT_IMPORTED',
      entityType: 'BankStatementImport',
      entityId: importResult.importId,
      metadata: { ...importResult, ...matchResult },
    });

    return { ...importResult, autoMatched: matchResult.autoMatched, ambiguous: matchResult.ambiguous };
  }

  async getImport(user: AuthenticatedUser, importId: string) {
    const organizationId = this.requireOrg(user);
    const rows = await this.prisma.withOrg(organizationId, (tx) =>
      tx.$queryRaw<BankStatementImportRow[]>`
        SELECT * FROM "BankStatementImport"
        WHERE "id" = ${importId} AND "organizationId" = ${organizationId}
        LIMIT 1
      `,
    );
    const row = rows[0];
    if (!row) throw new NotFoundException('Importación no encontrada.');
    return row;
  }

  async listImports(user: AuthenticatedUser) {
    const organizationId = this.requireOrg(user);
    const rows = await this.prisma.withOrg(organizationId, (tx) =>
      tx.$queryRaw<BankStatementImportRow[]>`
        SELECT * FROM "BankStatementImport"
        WHERE "organizationId" = ${organizationId}
        ORDER BY "importedAt" DESC
        LIMIT 50
      `,
    );
    return rows;
  }

  async reviewQueue(user: AuthenticatedUser) {
    const organizationId = this.requireOrg(user);
    const rows = await this.prisma.withOrg(organizationId, (tx) =>
      tx.$queryRaw<BankTransactionRow[]>`
        SELECT * FROM "BankTransaction"
        WHERE "organizationId" = ${organizationId}
          AND "matchStatus" IN (
            'AUTO_MATCHED'::"BankTransactionMatchStatus",
            'AMBIGUOUS'::"BankTransactionMatchStatus",
            'UNMATCHED'::"BankTransactionMatchStatus"
          )
        ORDER BY
          CASE "matchStatus"
            WHEN 'AUTO_MATCHED' THEN 1
            WHEN 'AMBIGUOUS' THEN 2
            ELSE 3
          END,
          "transactionDate" DESC
        LIMIT 100
      `,
    );
    return {
      total: rows.length,
      autoMatched: rows.filter((r) => r.matchStatus === 'AUTO_MATCHED').length,
      ambiguous: rows.filter((r) => r.matchStatus === 'AMBIGUOUS').length,
      unmatched: rows.filter((r) => r.matchStatus === 'UNMATCHED').length,
      items: rows.map(serializeTransaction),
    };
  }

  async listTransactions(
    user: AuthenticatedUser,
    importId: string,
    status?: string,
  ) {
    const organizationId = this.requireOrg(user);
    // Valida que el import exista y pertenezca a la org (404 en vez de una
    // lista vacía silenciosa si el id no es de esta organización).
    await this.getImport(user, importId);

    let statusFilter: BankTransactionMatchStatus | null = null;
    if (status) {
      const upper = status.toUpperCase() as BankTransactionMatchStatus;
      if (!VALID_STATUSES.includes(upper)) {
        throw new BadRequestException(`Estatus inválido: "${status}".`);
      }
      statusFilter = upper;
    }

    const rows = await this.prisma.withOrg(organizationId, (tx) =>
      statusFilter
        ? tx.$queryRaw<BankTransactionRow[]>`
            SELECT * FROM "BankTransaction"
            WHERE "bankStatementImportId" = ${importId}
              AND "organizationId" = ${organizationId}
              AND "matchStatus" = ${statusFilter}::"BankTransactionMatchStatus"
            ORDER BY "transactionDate" ASC
          `
        : tx.$queryRaw<BankTransactionRow[]>`
            SELECT * FROM "BankTransaction"
            WHERE "bankStatementImportId" = ${importId}
              AND "organizationId" = ${organizationId}
            ORDER BY "transactionDate" ASC
          `,
    );

    return rows.map(serializeTransaction);
  }

  async confirmMatch(user: AuthenticatedUser, transactionId: string, invoiceId?: string) {
    const organizationId = this.requireOrg(user);
    return this.matching.confirmMatch(transactionId, organizationId, user.id, invoiceId);
  }

  async rejectMatch(user: AuthenticatedUser, transactionId: string) {
    const organizationId = this.requireOrg(user);
    return this.matching.rejectMatch(transactionId, organizationId, user.id);
  }

  // ── helpers ───────────────────────────────────────────────

  private requireOrg(user: AuthenticatedUser): string {
    if (!user.organizationId) {
      throw new ForbiddenException('Tu cuenta no pertenece a una organización.');
    }
    return user.organizationId;
  }
}
