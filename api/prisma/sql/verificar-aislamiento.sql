-- Verificación de aislamiento entre organizaciones (solo lectura).
-- Córrelo en Railway › Postgres › Data › Query (o con psql) después de cada
-- migración. Debe devolver CERO filas: cada tabla con "organizationId" debe
-- tener Row Level Security activado, forzado y al menos una política.
SELECT c.relname AS tabla,
       c.relrowsecurity AS rls_activo,
       c.relforcerowsecurity AS rls_forzado,
       (SELECT count(*) FROM pg_policy p WHERE p.polrelid = c.oid) AS politicas
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
JOIN pg_attribute a ON a.attrelid = c.oid AND a.attname = 'organizationId' AND NOT a.attisdropped
WHERE c.relkind = 'r'
  AND (NOT c.relrowsecurity OR NOT c.relforcerowsecurity
       OR NOT EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid = c.oid))
ORDER BY 1;

-- Además: ¿con qué rol se conecta la app? Si sale rolsuper o rolbypassrls en
-- true, RLS NO se aplica (el superusuario se lo salta). Hay que pasar la app
-- a royaltica_app (ver ../create-restricted-role.sql).
SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname IN ('postgres', 'royaltica_app');
