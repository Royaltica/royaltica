import type { Prisma } from '@prisma/client';

/**
 * Espejo de BankTransactionMatchStatus (Prisma) — ver prisma/schema.prisma y
 * la migración 20260806000000_bank_reconciliation. Se declara acá también
 * porque este módulo consulta BankStatementImport/BankTransaction con SQL
 * tipada ($queryRaw/$executeRaw) en vez del delegate generado de Prisma
 * Client (mismo criterio que field-mapping.service.ts): el sandbox no tiene
 * acceso de red para correr `prisma generate` contra el schema nuevo.
 */
export type BankTransactionMatchStatus =
  | 'UNMATCHED'
  | 'AUTO_MATCHED'
  | 'MANUALLY_MATCHED'
  | 'REJECTED'
  | 'AMBIGUOUS';

/** Fila cruda de "BankStatementImport" tal como vive en Postgres. */
export interface BankStatementImportRow {
  id: string;
  organizationId: string;
  bankName: string;
  importedAt: Date;
  periodFrom: Date | null;
  periodTo: Date | null;
  totalTransactions: number;
  matchedCount: number;
  unmatchedCount: number;
  createdAt: Date;
}

/** Fila cruda de "BankTransaction" tal como vive en Postgres. */
export interface BankTransactionRow {
  id: string;
  bankStatementImportId: string;
  organizationId: string;
  transactionDate: Date;
  amount: Prisma.Decimal;
  description: string;
  referenceNumber: string | null;
  rawRowData: Prisma.JsonValue;
  matchStatus: BankTransactionMatchStatus;
  matchedInvoiceId: string | null;
  matchConfidence: number | null;
  matchedAt: Date | null;
  matchedBy: string | null;
  createdAt: Date;
}

/** Candidato de match producido por matchTransaction: una Invoice pendiente
 * que podría corresponder a una BankTransaction, con su nivel de confianza. */
export interface MatchCandidate {
  invoiceId: string;
  folio: string | null;
  total: number;
  confidence: number;
  /** Motivos legibles del score, para mostrar al humano que confirma/rechaza
   * (auditabilidad: por qué el motor propuso este match). */
  reasons: string[];
}

/**
 * Umbral de confianza a partir del cual runAutoMatch marca una transacción
 * como AUTO_MATCHED. Deliberadamente alto (0.9): AUTO_MATCHED NUNCA marca la
 * factura como PAID por sí solo (ver bank-reconciliation-matching.service.ts
 * / confirmMatch) — solo dispara notificación para confirmación humana de un
 * clic, mismo nivel de cautela que customer-portal.service.ts#markInvoicePaid.
 * Constante única (no números mágicos repetidos en el código).
 */
export const AUTO_MATCH_CONFIDENCE_THRESHOLD = 0.9;

/** Pesos de las señales de match, sumados para formar matchConfidence (0-1). */
export const MATCH_SCORE = {
  /**
   * Único candidato con el monto EXACTO entre las facturas pendientes. Alto
   * pero deliberadamente por debajo de AUTO_MATCH_CONFIDENCE_THRESHOLD: el
   * monto solo NO basta para auto-matchear, necesita corroborarse con
   * folio/referencia o nombre del cliente (ver matchTransaction).
   */
  EXACT_AMOUNT_SINGLE: 0.75,
  /** El folio de la factura aparece como substring en referencia/descripción. */
  FOLIO_IN_REFERENCE: 0.3,
  /** Solape de tokens normalizados entre la descripción y el nombre del cliente. */
  CUSTOMER_NAME_OVERLAP: 0.3,
} as const;
