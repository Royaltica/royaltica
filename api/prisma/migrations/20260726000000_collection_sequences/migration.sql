-- CollectionSequenceStep / CollectionSequenceRun: motor de escalamiento de
-- cobranza multi-paso (día 1 recordatorio suave → día 5 WhatsApp → día 10
-- correo firme → día 15+ escala a un humano). Requisito de Tradespace
-- (Canadá): la cadena es configurable por CollectionPolicy y cada ejecución
-- de paso se audita (ActivityLog desde CollectionSequencesService).

CREATE TYPE "CollectionSequenceTone" AS ENUM ('GENTLE', 'STANDARD', 'FIRM', 'URGENT');
CREATE TYPE "CollectionSequenceRunStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED', 'ESCALATED', 'CANCELLED');

CREATE TABLE "CollectionSequenceStep" (
  "id"                  TEXT NOT NULL,
  "collectionPolicyId"  TEXT NOT NULL,
  "stepOrder"           INTEGER NOT NULL,
  "daysAfterDue"        INTEGER NOT NULL,
  "channel"             "CollectionContactChannel" NOT NULL,
  "tone"                "CollectionSequenceTone" NOT NULL DEFAULT 'STANDARD',
  "messageTemplate"     TEXT NOT NULL,
  "escalatesToHuman"    BOOLEAN NOT NULL DEFAULT false,
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3) NOT NULL,
  "deletedAt"           TIMESTAMP(3),
  CONSTRAINT "CollectionSequenceStep_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CollectionSequenceStep_collectionPolicyId_idx" ON "CollectionSequenceStep" ("collectionPolicyId");
CREATE INDEX "CollectionSequenceStep_stepOrder_idx"          ON "CollectionSequenceStep" ("stepOrder");

ALTER TABLE "CollectionSequenceStep"
  ADD CONSTRAINT "CollectionSequenceStep_collectionPolicyId_fkey"
  FOREIGN KEY ("collectionPolicyId") REFERENCES "CollectionPolicy"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CollectionSequenceRun" (
  "id"                  TEXT NOT NULL,
  "organizationId"      TEXT NOT NULL,
  "invoiceId"           TEXT NOT NULL,
  "collectionPolicyId"  TEXT NOT NULL,
  "currentStepOrder"    INTEGER NOT NULL DEFAULT 0,
  "status"              "CollectionSequenceRunStatus" NOT NULL DEFAULT 'ACTIVE',
  "lastStepSentAt"      TIMESTAMP(3),
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CollectionSequenceRun_pkey" PRIMARY KEY ("id")
);

-- Una factura solo tiene una ejecución de secuencia activa a la vez.
CREATE UNIQUE INDEX "CollectionSequenceRun_invoiceId_key" ON "CollectionSequenceRun" ("invoiceId");
CREATE INDEX "CollectionSequenceRun_organizationId_idx"     ON "CollectionSequenceRun" ("organizationId");
CREATE INDEX "CollectionSequenceRun_collectionPolicyId_idx" ON "CollectionSequenceRun" ("collectionPolicyId");
CREATE INDEX "CollectionSequenceRun_status_idx"             ON "CollectionSequenceRun" ("status");

ALTER TABLE "CollectionSequenceRun"
  ADD CONSTRAINT "CollectionSequenceRun_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CollectionSequenceRun"
  ADD CONSTRAINT "CollectionSequenceRun_invoiceId_fkey"
  FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CollectionSequenceRun"
  ADD CONSTRAINT "CollectionSequenceRun_collectionPolicyId_fkey"
  FOREIGN KEY ("collectionPolicyId") REFERENCES "CollectionPolicy"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Row Level Security: mismo patrón que 20260701100000_row_level_security y
-- 20260724000000_collection_policy.
--
-- CollectionSequenceRun tiene organizationId denormalizado (en vez de
-- depender solo del join a Invoice/CollectionPolicy) para poder aplicar la
-- misma política simple de comparación directa de columna que el resto de
-- tablas por-organización.
--
-- CollectionSequenceStep NO tiene organizationId propio (es hijo de
-- CollectionPolicy, igual que InvoiceAuditLog es hijo de Invoice sin RLS
-- propia): el aislamiento se logra en la app filtrando siempre por
-- collectionPolicyId ya validado contra la organización del usuario
-- (CollectionSequencesService), más el RLS de CollectionPolicy si se hiciera
-- un join directo.
ALTER TABLE "CollectionSequenceRun" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CollectionSequenceRun" FORCE ROW LEVEL SECURITY;
CREATE POLICY org_isolation ON "CollectionSequenceRun"
  USING (
    COALESCE(current_setting('app.org_id', true), '') = ''
    OR "organizationId" = current_setting('app.org_id', true)
  );
