-- Bank Reconciliation: fundación genérica agnóstica del banco para conciliar
-- depósitos bancarios contra facturas CxC (Invoice, direction=RECEIVABLE).
-- Tradespace (Canadá) aún no confirma qué banco usa (EFT/Interac
-- e-Transfer son los rieles probables), así que este import + matching
-- engine trabaja con CUALQUIER CSV/OFX vía mapeo de columnas configurable
-- (reutiliza ExternalSyncFieldMapping con el nuevo entityType
-- BANK_STATEMENT). El adaptador específico del banco llega después.

-- ── ExternalSyncEntityType: nuevo valor BANK_STATEMENT ─────────
-- ALTER TYPE ... ADD VALUE no puede combinarse con otro DDL que USE el
-- valor nuevo dentro de la misma transacción; esta migración solo AGREGA
-- el valor, no lo usa, así que es seguro incluirlo aquí.
ALTER TYPE "ExternalSyncEntityType" ADD VALUE 'BANK_STATEMENT';

-- ── BankTransactionMatchStatus ──────────────────────────────────
CREATE TYPE "BankTransactionMatchStatus" AS ENUM (
  'UNMATCHED',
  'AUTO_MATCHED',
  'MANUALLY_MATCHED',
  'REJECTED',
  'AMBIGUOUS'
);

-- ── BankStatementImport ──────────────────────────────────────────
CREATE TABLE "BankStatementImport" (
  "id"                TEXT NOT NULL,
  "organizationId"    TEXT NOT NULL,
  "bankName"          TEXT NOT NULL DEFAULT 'unknown',
  "importedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "periodFrom"        TIMESTAMP(3),
  "periodTo"          TIMESTAMP(3),
  "totalTransactions" INTEGER NOT NULL DEFAULT 0,
  "matchedCount"      INTEGER NOT NULL DEFAULT 0,
  "unmatchedCount"    INTEGER NOT NULL DEFAULT 0,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BankStatementImport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BankStatementImport_organizationId_idx" ON "BankStatementImport" ("organizationId");
CREATE INDEX "BankStatementImport_importedAt_idx" ON "BankStatementImport" ("importedAt");

ALTER TABLE "BankStatementImport"
  ADD CONSTRAINT "BankStatementImport_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ── BankTransaction ───────────────────────────────────────────────
CREATE TABLE "BankTransaction" (
  "id"                     TEXT NOT NULL,
  "bankStatementImportId"  TEXT NOT NULL,
  "organizationId"         TEXT NOT NULL,
  "transactionDate"        TIMESTAMP(3) NOT NULL,
  "amount"                 DECIMAL(15,2) NOT NULL,
  "description"            TEXT NOT NULL,
  "referenceNumber"        TEXT,
  "rawRowData"             JSONB NOT NULL,
  "matchStatus"            "BankTransactionMatchStatus" NOT NULL DEFAULT 'UNMATCHED',
  "matchedInvoiceId"       TEXT,
  "matchConfidence"        DOUBLE PRECISION,
  "matchedAt"              TIMESTAMP(3),
  "matchedBy"              TEXT,
  "createdAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BankTransaction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BankTransaction_organizationId_idx" ON "BankTransaction" ("organizationId");
CREATE INDEX "BankTransaction_bankStatementImportId_idx" ON "BankTransaction" ("bankStatementImportId");
CREATE INDEX "BankTransaction_matchStatus_idx" ON "BankTransaction" ("matchStatus");
CREATE INDEX "BankTransaction_matchedInvoiceId_idx" ON "BankTransaction" ("matchedInvoiceId");

ALTER TABLE "BankTransaction"
  ADD CONSTRAINT "BankTransaction_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BankTransaction"
  ADD CONSTRAINT "BankTransaction_bankStatementImportId_fkey"
  FOREIGN KEY ("bankStatementImportId") REFERENCES "BankStatementImport"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BankTransaction"
  ADD CONSTRAINT "BankTransaction_matchedInvoiceId_fkey"
  FOREIGN KEY ("matchedInvoiceId") REFERENCES "Invoice"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Row Level Security: mismo patrón que 20260701100000_row_level_security,
-- 20260803000000_customer_portal_access y 20260805000000_external_data_sync.
ALTER TABLE "BankStatementImport" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BankStatementImport" FORCE ROW LEVEL SECURITY;
CREATE POLICY org_isolation ON "BankStatementImport"
  USING (
    COALESCE(current_setting('app.org_id', true), '') = ''
    OR "organizationId" = current_setting('app.org_id', true)
  );

ALTER TABLE "BankTransaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BankTransaction" FORCE ROW LEVEL SECURITY;
CREATE POLICY org_isolation ON "BankTransaction"
  USING (
    COALESCE(current_setting('app.org_id', true), '') = ''
    OR "organizationId" = current_setting('app.org_id', true)
  );
