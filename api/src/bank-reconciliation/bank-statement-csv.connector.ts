import { randomUUID } from 'node:crypto';
import { PrismaService } from '../common/prisma/prisma.service';
import { parseCsv } from '../external-data-sync/csv-parser.util';
import {
  applyMapping,
  validateMappedRow,
  type FieldMapping,
} from '../external-data-sync/field-mapping.types';

export interface BankStatementImportResult {
  importId: string;
  imported: number;
  skipped: number;
  errors: string[];
}

/**
 * Conector CSV genérico para estados de cuenta bancarios: funciona con
 * CUALQUIER banco (RBC/TD/Scotiabank/lo que confirme Tradespace) porque no
 * asume nombres de columna fijos — usa el mapeo configurable resuelto por
 * FieldMappingService (entityType=BANK_STATEMENT). REUSA el mismo parser
 * RFC-4180 de external-data-sync/csv-parser.util.ts (no se duplica).
 *
 * Solo crea BankStatementImport + BankTransaction; NO corre el matching
 * (eso lo dispara el orquestador, bank-reconciliation.service.ts, después
 * de insertar las filas, vía BankReconciliationMatchingService.runAutoMatch).
 */
export class BankStatementCsvConnector {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fileBuffer: Buffer,
    private readonly mapping: FieldMapping,
  ) {}

  async import(
    organizationId: string,
    bankName: string,
  ): Promise<BankStatementImportResult> {
    const { rows } = parseCsv(this.fileBuffer);
    const importId = randomUUID();
    const errors: string[] = [];
    let periodFrom: Date | null = null;
    let periodTo: Date | null = null;

    const parsedRows: {
      id: string;
      transactionDate: Date;
      amount: number;
      description: string;
      referenceNumber: string | null;
      raw: Record<string, string>;
    }[] = [];

    for (let i = 0; i < rows.length; i += 1) {
      const rowNumber = i + 2; // +1 header, +1 filas humanas empiezan en 1
      const mapped = applyMapping(this.mapping, rows[i]);
      const rowErrors = validateMappedRow('BANK_STATEMENT', mapped);
      if (rowErrors.length > 0) {
        errors.push(`Fila ${rowNumber}: ${rowErrors.join(' ')}`);
        continue;
      }

      try {
        const transactionDate = this.assertDate(mapped.transactionDate!, 'transactionDate');
        const amount = this.assertMoney(mapped.amount!, 'amount');
        parsedRows.push({
          id: randomUUID(),
          transactionDate,
          amount,
          description: mapped.description ?? '',
          referenceNumber: mapped.referenceNumber || null,
          raw: rows[i],
        });
        if (!periodFrom || transactionDate < periodFrom) periodFrom = transactionDate;
        if (!periodTo || transactionDate > periodTo) periodTo = transactionDate;
      } catch (err) {
        errors.push(
          `Fila ${rowNumber}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    await this.prisma.withOrg(organizationId, async (tx) => {
      await tx.$executeRaw`
        INSERT INTO "BankStatementImport"
          ("id", "organizationId", "bankName", "importedAt", "periodFrom", "periodTo",
           "totalTransactions", "matchedCount", "unmatchedCount", "createdAt")
        VALUES
          (${importId}, ${organizationId}, ${bankName}, now(), ${periodFrom}, ${periodTo},
           ${parsedRows.length}, 0, ${parsedRows.length}, now())
      `;

      for (const r of parsedRows) {
        await tx.$executeRaw`
          INSERT INTO "BankTransaction"
            ("id", "bankStatementImportId", "organizationId", "transactionDate", "amount",
             "description", "referenceNumber", "rawRowData", "matchStatus", "createdAt")
          VALUES
            (${r.id}, ${importId}, ${organizationId}, ${r.transactionDate}, ${r.amount},
             ${r.description}, ${r.referenceNumber}, ${JSON.stringify(r.raw)}::jsonb,
             'UNMATCHED'::"BankTransactionMatchStatus", now())
        `;
      }
    });

    return { importId, imported: parsedRows.length, skipped: errors.length, errors };
  }

  // ── helpers ───────────────────────────────────────────────

  private assertMoney(raw: string, field: string): number {
    // Algunos bancos exportan montos con signo/paréntesis para retiros
    // (ej. "(100.00)"); un depósito siempre debería venir positivo, pero
    // se normaliza el signo para no descartar filas válidas por formato.
    const cleaned = raw.replace(/[,$]/g, '').trim();
    const isParenNegative = /^\(.*\)$/.test(cleaned);
    const n = Number(isParenNegative ? `-${cleaned.slice(1, -1)}` : cleaned);
    if (!Number.isFinite(n)) {
      throw new Error(`El campo "${field}" no es un monto válido ("${raw}").`);
    }
    return Math.abs(n);
  }

  private assertDate(raw: string, field: string): Date {
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) {
      throw new Error(`El campo "${field}" no es una fecha válida ("${raw}").`);
    }
    return d;
  }
}
