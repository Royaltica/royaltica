-- CustomerPortalAccess: portal de autoservicio SIN CUENTA para clientes
-- deudores (Tradespace, Canadá). Un enlace con token opaco + expiración
-- (sin password ni login) para que el cliente vea sus facturas pendientes
-- de cobro y marque "ya pagué" (queda a reconciliación humana). Requisito
-- explícito de Tradespace: self-service para ~200 clientes canadienses.

CREATE TABLE "CustomerPortalAccess" (
  "id"             TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "customerId"     TEXT NOT NULL,
  "token"          TEXT NOT NULL,
  "expiresAt"      TIMESTAMP(3) NOT NULL,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastAccessedAt" TIMESTAMP(3),
  CONSTRAINT "CustomerPortalAccess_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CustomerPortalAccess_token_key" ON "CustomerPortalAccess" ("token");
CREATE INDEX "CustomerPortalAccess_organizationId_idx" ON "CustomerPortalAccess" ("organizationId");
CREATE INDEX "CustomerPortalAccess_customerId_idx"     ON "CustomerPortalAccess" ("customerId");
CREATE INDEX "CustomerPortalAccess_expiresAt_idx"       ON "CustomerPortalAccess" ("expiresAt");

ALTER TABLE "CustomerPortalAccess"
  ADD CONSTRAINT "CustomerPortalAccess_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CustomerPortalAccess"
  ADD CONSTRAINT "CustomerPortalAccess_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Row Level Security: mismo patrón que 20260701100000_row_level_security y
-- 20260726000000_collection_sequences. organizationId va denormalizado en
-- la tabla (en vez de depender de un join a Customer) para poder aplicar la
-- misma política simple de comparación directa de columna. El acceso público
-- (sin usuario autenticado, sin GUC app.org_id) resuelve el token PRIMERO vía
-- prisma.customerPortalAccess.findUnique (fuera de withOrg, política no
-- restringe con GUC vacío) y luego abre el resto de queries con
-- withOrg(organizationId) usando el organizationId ya validado del acceso.
ALTER TABLE "CustomerPortalAccess" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CustomerPortalAccess" FORCE ROW LEVEL SECURITY;
CREATE POLICY org_isolation ON "CustomerPortalAccess"
  USING (
    COALESCE(current_setting('app.org_id', true), '') = ''
    OR "organizationId" = current_setting('app.org_id', true)
  );
