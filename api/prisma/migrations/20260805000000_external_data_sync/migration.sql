-- External Data Sync: fundación genérica para importar clientes/facturas de
-- cobranza (CxC) desde el sistema externo de un cliente tipo Tradespace
-- ("Soga" en la llamada de requerimientos — producto real aún sin confirmar).
-- No se conoce todavía si expone REST, solo CSV/Excel, ni el shape exacto de
-- sus campos, así que esta migración solo agrega lo mínimo genérico:
--   1) externalId en Customer/Invoice: llave de idempotencia (upsert) para
--      cualquier conector (CSV hoy, REST cuando Tradespace confirme detalles).
--   2) ExternalSyncFieldMapping: mapeo de campos configurable por org/entidad,
--      para que un admin no técnico indique cómo se llaman sus columnas.

-- ── externalId (idempotencia) ──────────────────────────────────
ALTER TABLE "Customer" ADD COLUMN "externalId" TEXT;
ALTER TABLE "Invoice"  ADD COLUMN "externalId" TEXT;

CREATE UNIQUE INDEX "Customer_organizationId_externalId_key"
  ON "Customer" ("organizationId", "externalId");
CREATE UNIQUE INDEX "Invoice_organizationId_externalId_key"
  ON "Invoice" ("organizationId", "externalId");

-- ── ExternalSyncFieldMapping ────────────────────────────────────
CREATE TYPE "ExternalSyncEntityType" AS ENUM ('CUSTOMER', 'RECEIVABLE');

CREATE TABLE "ExternalSyncFieldMapping" (
  "id"             TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "entityType"     "ExternalSyncEntityType" NOT NULL,
  -- { "royalticaField": "externalField" }, ej. {"name":"CustomerName","rfc":"TaxId"}
  "mapping"        JSONB NOT NULL DEFAULT '{}',
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ExternalSyncFieldMapping_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ExternalSyncFieldMapping_organizationId_entityType_key"
  ON "ExternalSyncFieldMapping" ("organizationId", "entityType");
CREATE INDEX "ExternalSyncFieldMapping_organizationId_idx"
  ON "ExternalSyncFieldMapping" ("organizationId");

ALTER TABLE "ExternalSyncFieldMapping"
  ADD CONSTRAINT "ExternalSyncFieldMapping_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Row Level Security: mismo patrón que 20260701100000_row_level_security y
-- 20260803000000_customer_portal_access.
ALTER TABLE "ExternalSyncFieldMapping" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ExternalSyncFieldMapping" FORCE ROW LEVEL SECURITY;
CREATE POLICY org_isolation ON "ExternalSyncFieldMapping"
  USING (
    COALESCE(current_setting('app.org_id', true), '') = ''
    OR "organizationId" = current_setting('app.org_id', true)
  );
