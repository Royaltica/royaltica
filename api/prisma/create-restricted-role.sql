-- Rol de base de datos de mínimo privilegio para el runtime del backend.
--
-- Uso (contra la URL PÚBLICA de Postgres, Settings → Networking del servicio
-- Postgres en Railway — no la interna *.railway.internal):
--
--   psql "<url pública>" -f api/prisma/create-restricted-role.sql \
--     -v role_password="'$(openssl rand -base64 24)'"
--
-- O reemplaza manualmente CAMBIA_ESTA_PASSWORD abajo antes de correrlo.
--
-- Después de crear el rol, actualiza en Railway (servicio backend):
--   railway variables --set "DATABASE_URL=postgresql://royaltica_app:<password>@<host>:<port>/<db>"
-- y deja DATABASE_ADMIN_URL apuntando al rol owner original (lo sigue
-- necesitando `prisma migrate deploy`).

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'royaltica_app') THEN
    CREATE ROLE royaltica_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS
      PASSWORD 'CAMBIA_ESTA_PASSWORD';
  END IF;
END
$$;

DO $$
BEGIN
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO royaltica_app', current_database());
END
$$;
GRANT USAGE ON SCHEMA public TO royaltica_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO royaltica_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO royaltica_app;

-- Tablas/secuencias que se creen después (nuevas migraciones) heredan los
-- mismos privilegios automáticamente, sin tener que volver a correr esto:
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO royaltica_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO royaltica_app;
