-- Marketing leads (agendar demo + contacto) capturados desde royaltica.com.
-- Sin FK a Organization: es un prospecto, aún no cliente.

CREATE TYPE "LeadType" AS ENUM ('DEMO', 'CONTACT');

CREATE TYPE "LeadStatus" AS ENUM (
  'NEW',
  'CONTACTED',
  'QUALIFIED',
  'CONVERTED',
  'DISCARDED'
);

CREATE TABLE "Lead" (
  "id"              TEXT NOT NULL,
  "type"            "LeadType" NOT NULL,
  "status"          "LeadStatus" NOT NULL DEFAULT 'NEW',
  "name"            TEXT NOT NULL,
  "company"         TEXT,
  "email"           TEXT NOT NULL,
  "phone"           TEXT,
  "jobTitle"        TEXT,
  "companySize"     INTEGER,
  "subject"         TEXT,
  "message"         TEXT,
  "preferredDate"   TIMESTAMP(3),
  "preferredTime"   TEXT,
  "source"          TEXT,
  "handledByUserId" TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Lead_type_idx"      ON "Lead" ("type");
CREATE INDEX "Lead_status_idx"    ON "Lead" ("status");
CREATE INDEX "Lead_email_idx"     ON "Lead" ("email");
CREATE INDEX "Lead_createdAt_idx" ON "Lead" ("createdAt");
