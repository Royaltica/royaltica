-- Fase 1 Cobranza IA: plantillas de Meta por paso + hilo de WhatsApp con
-- el cliente deudor (fuente de verdad de la ventana de 24h). Solo agrega.

ALTER TABLE "CollectionSequenceStep" ADD COLUMN "whatsappTemplateName" TEXT;

CREATE TYPE "WhatsappMessageDirection" AS ENUM ('INBOUND', 'OUTBOUND');
CREATE TYPE "WhatsappMessageKind" AS ENUM ('TEXT', 'TEMPLATE', 'BUTTON', 'MEDIA');

CREATE TABLE "WhatsappMessage" (
  "id"             TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "customerId"     TEXT NOT NULL,
  "invoiceId"      TEXT,
  "direction"      "WhatsappMessageDirection" NOT NULL,
  "kind"           "WhatsappMessageKind" NOT NULL,
  "body"           TEXT NOT NULL,
  "templateName"   TEXT,
  "waMessageId"    TEXT,
  "phoneNumberId"  TEXT,
  "sent"           BOOLEAN NOT NULL DEFAULT true,
  "sentByUserId"   TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WhatsappMessage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WhatsappMessage_waMessageId_key" ON "WhatsappMessage" ("waMessageId");
CREATE INDEX "WhatsappMessage_organizationId_customerId_createdAt_idx" ON "WhatsappMessage" ("organizationId", "customerId", "createdAt");
CREATE INDEX "WhatsappMessage_customerId_direction_createdAt_idx" ON "WhatsappMessage" ("customerId", "direction", "createdAt");

ALTER TABLE "WhatsappMessage"
  ADD CONSTRAINT "WhatsappMessage_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WhatsappMessage"
  ADD CONSTRAINT "WhatsappMessage_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WhatsappMessage"
  ADD CONSTRAINT "WhatsappMessage_invoiceId_fkey"
  FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Row Level Security: mismo patrón que CustomerPortalAccess. El webhook
-- (sin GUC app.org_id) puede escribir; las consultas de la app van por
-- withOrg(organizationId) y solo ven su organización.
ALTER TABLE "WhatsappMessage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WhatsappMessage" FORCE ROW LEVEL SECURITY;
CREATE POLICY org_isolation ON "WhatsappMessage"
  USING (
    COALESCE(current_setting('app.org_id', true), '') = ''
    OR "organizationId" = current_setting('app.org_id', true)
  );
