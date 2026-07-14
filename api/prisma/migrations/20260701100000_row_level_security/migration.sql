-- ============================================================
-- ROW LEVEL SECURITY: aislamiento multi-tenant a nivel de BD.
-- Segunda capa de defensa: aunque un bug en la app olvide el
-- filtro por organizationId, Postgres no entrega filas de otra
-- organización cuando la petición fija el GUC app.org_id
-- (PrismaService.withOrg). Si el GUC está vacío (procesos
-- internos, SUPERADMIN, migraciones) la política no restringe.
-- ============================================================
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'Supplier','Invoice','Payment','DiotDeclaration',
    'FinancialStatement','WebhookEndpoint','AiFeedback','UsageEvent'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      $f$CREATE POLICY org_isolation ON %I
         USING (
           COALESCE(current_setting('app.org_id', true), '') = ''
           OR "organizationId" = current_setting('app.org_id', true)
         )$f$, t);
  END LOOP;
END $$;

-- User y ActivityLog permiten organizationId NULL (SUPERADMIN / plataforma).
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "User" FORCE ROW LEVEL SECURITY;
CREATE POLICY org_isolation ON "User"
  USING (
    COALESCE(current_setting('app.org_id', true), '') = ''
    OR "organizationId" IS NULL
    OR "organizationId" = current_setting('app.org_id', true)
  );

ALTER TABLE "ActivityLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ActivityLog" FORCE ROW LEVEL SECURITY;
CREATE POLICY org_isolation ON "ActivityLog"
  USING (
    COALESCE(current_setting('app.org_id', true), '') = ''
    OR "organizationId" IS NULL
    OR "organizationId" = current_setting('app.org_id', true)
  );
