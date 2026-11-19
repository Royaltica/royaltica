import { createHash, randomUUID } from 'node:crypto';
import { PrismaService } from '../common/prisma/prisma.service';
import { parseCsv } from '../external-data-sync/csv-parser.util';
import {
  applyMapping,
  validateMappedRow,
  type FieldMapping,
} from '../external-data-sync/field-mapping.types';
import { parseFlexibleDate } from '../external-data-sync/date-parser.util';

export interface BankStatementImportResult {
  importId: string;
  /** Movimientos nuevos guardados (abonos y cargos). */
  imported: number;
  /** Filas con error (ver `errors`). */
  skipped: number;
  /** Movimientos que ya estaban importados (mismo estado de cuenta subido otra vez). */
  duplicates: number;
  /** Cargos (dinero que sale): se guardan pero nunca se concilian contra facturas. */
  debits: number;
  errors: string[];
}

/**
 * Huella de un movimiento para no importarlo dos veces. `occurrence` distingue
 * dos movimientos idénticos legítimos dentro del mismo archivo (mismo día,
 * monto y concepto): el 1.º y el 2.º tienen huellas distintas, y al volver a
 * subir el mismo archivo se generan exactamente las mismas.
 */
export function bankTransactionDedupeKey(input: {
  organizationId: string;
  transactionDate: Date;
  amount: number;
  isDebit: boolean;
  referenceNumber: string | null;
  description: string;
  occurrence: number;
}): string {
  const normalized = [
    input.organizationId,
    input.transactionDate.toISOString().slice(0, 10),
    input.amount.toFixed(2),
    input.isDebit ? 'D' : 'C',
    (input.referenceNumber ?? '').trim().toUpperCase(),
    input.description.replace(/\s+/g, ' ').trim().toUpperCase(),
    String(input.occurrence),
  ].join('|');
  return createHash('sha256').update(normalized).digest('hex');
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
      isDebit: boolean;
      description: string;
      referenceNumber: string | null;
      dedupeKey: string;
      raw: Record<string, string>;
    }[] = [];
    const occurrences = new Map<string, number>();

    for (let i = 0; i < rows.length; i += 1) {
      const rowNumber = i + 2; // +1 header, +1 filas humanas empiezan en 1
      // Renglones sin ningún valor (separadores que meten los bancos, ",,,,"):
      // no son movimientos ni errores.
      if (Object.values(rows[i]).every((v) => !String(v ?? '').trim())) continue;
      const mapped = applyMapping(this.mapping, rows[i]);
      const rowErrors = validateMappedRow('BANK_STATEMENT', mapped);
      if (rowErrors.length > 0) {
        errors.push(`Fila ${rowNumber}: ${rowErrors.join(' ')}`);
        continue;
      }

      try {
        const transactionDate = this.assertDate(mapped.transactionDate!, 'transactionDate');
        const { amount, isDebit } = this.resolveAmount(mapped);
        const description = mapped.description ?? '';
        const referenceNumber = mapped.referenceNumber || null;
        const base = bankTransactionDedupeKey({
          organizationId,
          transactionDate,
          amount,
          isDebit,
          referenceNumber,
          description,
          occurrence: 0,
        });
        const occurrence = occurrences.get(base) ?? 0;
        occurrences.set(base, occurrence + 1);
        parsedRows.push({
          id: randomUUID(),
          transactionDate,
          amount,
          isDebit,
          description,
          referenceNumber,
          dedupeKey: bankTransactionDedupeKey({
            organizationId,
            transactionDate,
            amount,
            isDebit,
            referenceNumber,
            description,
            occurrence,
          }),
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

    let imported = 0;
    let debits = 0;
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
        // ON CONFLICT: si el movimiento ya se había importado (misma huella),
        // no se duplica. $executeRaw devuelve cuántas filas insertó (0 o 1).
        const inserted = await tx.$executeRaw`
          INSERT INTO "BankTransaction"
            ("id", "bankStatementImportId", "organizationId", "transactionDate", "amount",
             "description", "referenceNumber", "rawRowData", "matchStatus", "createdAt",
             "isDebit", "dedupeKey")
          VALUES
            (${r.id}, ${importId}, ${organizationId}, ${r.transactionDate}, ${r.amount},
             ${r.description}, ${r.referenceNumber}, ${JSON.stringify(r.raw)}::jsonb,
             'UNMATCHED'::"BankTransactionMatchStatus", now(),
             ${r.isDebit}, ${r.dedupeKey})
          ON CONFLICT ("organizationId", "dedupeKey") DO NOTHING
        `;
        if (Number(inserted) > 0) {
          imported += 1;
          if (r.isDebit) debits += 1;
        }
      }

      // Totales reales del import (sin duplicados; los cargos no cuentan como
      // pendientes de conciliar).
      await tx.$executeRaw`
        UPDATE "BankStatementImport"
        SET "totalTransactions" = ${imported}, "unmatchedCount" = ${imported - debits}
        WHERE "id" = ${importId}
      `;
    });

    return {
      importId,
      imported,
      skipped: errors.length,
      duplicates: parsedRows.length - imported,
      debits,
      errors,
    };
  }

  // ── helpers ───────────────────────────────────────────────

  /**
   * Monto y sentido del movimiento. Antes se tomaba el valor absoluto, y un
   * retiro de $10,000 podía empatar con una factura de $10,000.
   *  - Columnas Abono/Cargo (creditAmount/debitAmount): la que traiga valor.
   *  - Una sola columna `amount`: negativo o entre paréntesis = cargo.
   */
  private resolveAmount(mapped: Record<string, string | undefined>): {
    amount: number;
    isDebit: boolean;
  } {
    const credit = mapped.creditAmount?.trim();
    const debit = mapped.debitAmount?.trim();
    if (credit || debit) {
      const c = credit ? this.parseMoney(credit, 'creditAmount') : 0;
      const d = debit ? this.parseMoney(debit, 'debitAmount') : 0;
      if (c !== 0 && d !== 0) {
        throw new Error('La fila trae abono y cargo a la vez; revisa el mapeo de columnas.');
      }
      if (c === 0 && d === 0) {
        throw new Error('La fila no trae ni abono ni cargo.');
      }
      return c !== 0 ? { amount: Math.abs(c), isDebit: false } : { amount: Math.abs(d), isDebit: true };
    }
    const n = this.parseMoney(mapped.amount ?? '', 'amount');
    if (n === 0) throw new Error('El monto es cero.');
    return { amount: Math.abs(n), isDebit: n < 0 };
  }

  private parseMoney(raw: string, field: string): number {
    // Acepta "$1,250.50", "1250.50", "-75.00" y "(75.00)" (negativo contable).
    const cleaned = raw.replace(/[,$\s]/g, '').replace(/MXN|USD/gi, '').trim();
    const isParenNegative = /^\(.*\)$/.test(cleaned);
    const n = Number(isParenNegative ? `-${cleaned.slice(1, -1)}` : cleaned);
    if (cleaned === '' || !Number.isFinite(n)) {
      throw new Error(`El campo "${field}" no es un monto válido ("${raw}").`);
    }
    return n;
  }

  private assertDate(raw: string, field: string): Date {
    // Día/mes/año (México) e ISO; nunca mes/día de EE. UU. Ver date-parser.util.
    const d = parseFlexibleDate(raw);
    if (!d) {
      throw new Error(`El campo "${field}" no es una fecha válida ("${raw}").`);
    }
    return d;
  }
}
