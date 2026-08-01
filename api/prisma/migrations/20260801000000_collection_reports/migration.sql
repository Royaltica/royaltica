-- CollectionReport: bitácora de reportes de cobranza en PDF generados por
-- organización (sin FK a Organization, mismo criterio que AiFeedback).
CREATE TABLE "CollectionReport" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "periodFrom" TIMESTAMP(3) NOT NULL,
    "periodTo" TIMESTAMP(3) NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "emailSent" BOOLEAN NOT NULL DEFAULT false,
    "recipientCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CollectionReport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CollectionReport_organizationId_idx" ON "CollectionReport"("organizationId");

CREATE INDEX "CollectionReport_generatedAt_idx" ON "CollectionReport"("generatedAt");

-- Row Level Security: CollectionReport es bitácora por organización. Aunque
-- no persiste el PDF, evita lecturas/escrituras cruzadas si en el futuro se
-- expone desde endpoints o consultas administrativas con contexto de tenant.
ALTER TABLE "CollectionReport" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CollectionReport" FORCE ROW LEVEL SECURITY;
CREATE POLICY org_isolation ON "CollectionReport"
  USING (
    COALESCE(current_setting('app.org_id', true), '') = ''
    OR "organizationId" = current_setting('app.org_id', true)
  );
