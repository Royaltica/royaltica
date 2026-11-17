-- Aislamiento entre organizaciones: "VirtualNumber" era la única tabla con
-- "organizationId" sin Row Level Security (hallado en la prueba de
-- aislamiento del 17 nov 2026). Mismo patrón que el resto de las tablas:
-- con app.org_id fijado solo se ven las filas de esa organización; los
-- procesos de sistema (sin app.org_id) siguen viendo todo.
ALTER TABLE "VirtualNumber" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "VirtualNumber" FORCE ROW LEVEL SECURITY;
CREATE POLICY org_isolation ON "VirtualNumber"
  USING (
    COALESCE(current_setting('app.org_id', true), '') = ''
    OR "organizationId" = current_setting('app.org_id', true)
  );
