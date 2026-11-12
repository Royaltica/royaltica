-- Análisis periódico de cartera (pasos 1-3: jalar, depurar, calcular y
-- comparar periodos). Solo agrega una tabla; no toca datos existentes.

CREATE TABLE "PortfolioReport" (
  "id"                TEXT NOT NULL,
  "organizationId"    TEXT NOT NULL,
  "frequency"         TEXT NOT NULL,
  "periodFrom"        TIMESTAMP(3) NOT NULL,
  "periodTo"          TIMESTAMP(3) NOT NULL,
  "data"              JSONB NOT NULL,
  "aiAnalysis"        JSONB,
  "generatedByUserId" TEXT,
  "generatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PortfolioReport_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PortfolioReport_organizationId_frequency_periodFrom_key"
  ON "PortfolioReport" ("organizationId", "frequency", "periodFrom");
CREATE INDEX "PortfolioReport_organizationId_periodTo_idx"
  ON "PortfolioReport" ("organizationId", "periodTo");

ALTER TABLE "PortfolioReport"
  ADD CONSTRAINT "PortfolioReport_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row Level Security: mismo patrón que WhatsappMessage. El cron (sin GUC
-- app.org_id) puede escribir; la app consulta con withOrg(organizationId).
ALTER TABLE "PortfolioReport" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PortfolioReport" FORCE ROW LEVEL SECURITY;
CREATE POLICY org_isolation ON "PortfolioReport"
  USING (
    COALESCE(current_setting('app.org_id', true), '') = ''
    OR "organizationId" = current_setting('app.org_id', true)
  );
