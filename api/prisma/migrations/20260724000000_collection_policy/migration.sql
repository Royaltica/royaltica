-- CollectionPolicy: "guard rails" de cobranza (AR) configurables por
-- organización. Requisito de Tradespace (Canadá): cómo y cuándo el agente
-- automático de cobranza puede contactar a un deudor, con auditoría completa
-- (cada alta/edición/baja se registra en ActivityLog desde el servicio).

CREATE TYPE "CollectionContactChannel" AS ENUM ('EMAIL', 'WHATSAPP', 'SMS', 'PHONE');

CREATE TABLE "CollectionPolicy" (
  "id"                      TEXT NOT NULL,
  "organizationId"          TEXT NOT NULL,
  "name"                    TEXT NOT NULL,
  "isActive"                BOOLEAN NOT NULL DEFAULT true,
  "maxContactsPerWeek"      INTEGER NOT NULL,
  "allowedContactStartHour" INTEGER NOT NULL,
  "allowedContactEndHour"   INTEGER NOT NULL,
  "timezone"                TEXT NOT NULL,
  "gracePeriodDays"         INTEGER NOT NULL,
  "escalationThresholdDays" INTEGER NOT NULL,
  "preferredChannel"        "CollectionContactChannel" NOT NULL,
  "pauseMessage"            TEXT,
  "blackoutDates"           TIMESTAMP(3)[] NOT NULL DEFAULT ARRAY[]::TIMESTAMP(3)[],
  "createdAt"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"               TIMESTAMP(3) NOT NULL,
  "deletedAt"               TIMESTAMP(3),
  CONSTRAINT "CollectionPolicy_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CollectionPolicy_organizationId_idx" ON "CollectionPolicy" ("organizationId");
CREATE INDEX "CollectionPolicy_isActive_idx"       ON "CollectionPolicy" ("isActive");

ALTER TABLE "CollectionPolicy"
  ADD CONSTRAINT "CollectionPolicy_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Row Level Security: mismo patrón que 20260701100000_row_level_security.
-- Aísla CollectionPolicy por organizationId a nivel de BD, segunda capa de
-- defensa además del filtro en la app (PrismaService.withOrg).
ALTER TABLE "CollectionPolicy" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CollectionPolicy" FORCE ROW LEVEL SECURITY;
CREATE POLICY org_isolation ON "CollectionPolicy"
  USING (
    COALESCE(current_setting('app.org_id', true), '') = ''
    OR "organizationId" = current_setting('app.org_id', true)
  );
