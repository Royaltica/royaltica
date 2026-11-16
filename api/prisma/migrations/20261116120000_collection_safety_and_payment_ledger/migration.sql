-- Seguridad de cobranza y libro de pagos (plan del primer cliente, carril A).
-- TODO es aditivo: columnas nuevas con valor por defecto o nulas y dos
-- tablas nuevas. El código anterior sigue funcionando contra este esquema,
-- por eso se puede aplicar antes de desplegar el backend.

-- Interruptor de emergencia por organización.
ALTER TABLE "Organization" ADD COLUMN "collectionPausedAt" TIMESTAMP(3);
ALTER TABLE "Organization" ADD COLUMN "collectionPausedReason" TEXT;
ALTER TABLE "Organization" ADD COLUMN "collectionPausedByUserId" TEXT;

-- Modo sombra y guardia de frescura del estado de cuenta.
ALTER TABLE "CollectionPolicy" ADD COLUMN "shadowMode" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CollectionPolicy" ADD COLUMN "paymentDataMaxAgeHours" INTEGER;

-- "Ya pagué" y consentimiento por cliente.
ALTER TABLE "Customer" ADD COLUMN "paymentClaimedAt" TIMESTAMP(3);
ALTER TABLE "Customer" ADD COLUMN "consentSource" TEXT;
ALTER TABLE "Customer" ADD COLUMN "consentAt" TIMESTAMP(3);

-- "Ya pagué" por factura y caché del libro de pagos.
ALTER TABLE "Invoice" ADD COLUMN "paymentClaimedAt" TIMESTAMP(3);
ALTER TABLE "Invoice" ADD COLUMN "amountPaid" DECIMAL(15,2) NOT NULL DEFAULT 0;

-- Conciliación v2: cargos, huella anti-duplicados y propuesta compuesta.
ALTER TABLE "BankTransaction" ADD COLUMN "isDebit" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "BankTransaction" ADD COLUMN "dedupeKey" TEXT;
ALTER TABLE "BankTransaction" ADD COLUMN "matchProposal" JSONB;
-- NULL no choca consigo mismo en un índice único de Postgres: las filas ya
-- importadas (sin huella) no se ven afectadas.
CREATE UNIQUE INDEX "BankTransaction_organizationId_dedupeKey_key"
  ON "BankTransaction" ("organizationId", "dedupeKey");

-- Estado de entrega de WhatsApp.
ALTER TABLE "WhatsappMessage" ADD COLUMN "deliveryStatus" TEXT;
ALTER TABLE "WhatsappMessage" ADD COLUMN "deliveryStatusAt" TIMESTAMP(3);
ALTER TABLE "WhatsappMessage" ADD COLUMN "deliveryError" TEXT;

-- Libro de pagos.
CREATE TABLE "InvoicePayment" (
  "id"                TEXT NOT NULL,
  "organizationId"    TEXT NOT NULL,
  "invoiceId"         TEXT NOT NULL,
  "amount"            DECIMAL(15,2) NOT NULL,
  "paidAt"            TIMESTAMP(3) NOT NULL,
  "source"            TEXT NOT NULL,
  "bankTransactionId" TEXT,
  "createdByUserId"   TEXT,
  "note"              TEXT,
  "reversedAt"        TIMESTAMP(3),
  "reversedReason"    TEXT,
  "reversedByUserId"  TEXT,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InvoicePayment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "InvoicePayment_organizationId_idx" ON "InvoicePayment" ("organizationId");
CREATE INDEX "InvoicePayment_invoiceId_idx" ON "InvoicePayment" ("invoiceId");
CREATE INDEX "InvoicePayment_bankTransactionId_idx" ON "InvoicePayment" ("bankTransactionId");
ALTER TABLE "InvoicePayment"
  ADD CONSTRAINT "InvoicePayment_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InvoicePayment"
  ADD CONSTRAINT "InvoicePayment_invoiceId_fkey"
  FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InvoicePayment"
  ADD CONSTRAINT "InvoicePayment_bankTransactionId_fkey"
  FOREIGN KEY ("bankTransactionId") REFERENCES "BankTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InvoicePayment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InvoicePayment" FORCE ROW LEVEL SECURITY;
CREATE POLICY org_isolation ON "InvoicePayment"
  USING (
    COALESCE(current_setting('app.org_id', true), '') = ''
    OR "organizationId" = current_setting('app.org_id', true)
  );

-- Bandeja de mensajes entrantes sin dueño claro.
CREATE TABLE "WhatsappInboundUnmatched" (
  "id"                 TEXT NOT NULL,
  "organizationId"     TEXT,
  "fromPhone"          TEXT NOT NULL,
  "phoneNumberId"      TEXT,
  "waMessageId"        TEXT,
  "kind"               TEXT NOT NULL,
  "body"               TEXT NOT NULL,
  "candidates"         JSONB NOT NULL DEFAULT '[]',
  "resolvedAt"         TIMESTAMP(3),
  "resolvedByUserId"   TEXT,
  "resolvedCustomerId" TEXT,
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WhatsappInboundUnmatched_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WhatsappInboundUnmatched_waMessageId_key" ON "WhatsappInboundUnmatched" ("waMessageId");
CREATE INDEX "WhatsappInboundUnmatched_organizationId_idx" ON "WhatsappInboundUnmatched" ("organizationId");
CREATE INDEX "WhatsappInboundUnmatched_resolvedAt_idx" ON "WhatsappInboundUnmatched" ("resolvedAt");
ALTER TABLE "WhatsappInboundUnmatched"
  ADD CONSTRAINT "WhatsappInboundUnmatched_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS: con app.org_id fijado solo se ven las filas de esa organización; las
-- que no tienen organización (organizationId NULL) solo las ve el sistema
-- (consultas sin GUC, p. ej. el panel del superadministrador).
ALTER TABLE "WhatsappInboundUnmatched" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WhatsappInboundUnmatched" FORCE ROW LEVEL SECURITY;
CREATE POLICY org_isolation ON "WhatsappInboundUnmatched"
  USING (
    COALESCE(current_setting('app.org_id', true), '') = ''
    OR "organizationId" = current_setting('app.org_id', true)
  );

-- Llenar el caché amountPaid de las facturas ya pagadas (sin libro previo):
-- se considera pagado el total. Las pendientes quedan en 0.
UPDATE "Invoice" SET "amountPaid" = "total"
  WHERE "status" = 'PAID' AND "direction" = 'RECEIVABLE';
