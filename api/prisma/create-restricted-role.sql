-- Rol de base de datos de mínimo privilegio para el runtime del backend.
--
-- Pasos completos (crear, cambiar DATABASE_URL, verificar y revertir) en
-- docs/rol-restringido.md. La contraseña se pasa como variable de psql y
-- nunca se escribe en este archivo:
--
--   psql "<url pública del owner>" -v ON_ERROR_STOP=1 \
--     -v role_password="$(openssl rand -hex 24)" \
--     -f api/prisma/create-restricted-role.sql
--
-- (Las variables de psql no se expanden dentro de un bloque DO, por eso la
-- contraseña se fija con ALTER ROLE fuera del bloque.)
--
-- DATABASE_ADMIN_URL sigue apuntando al rol owner original: lo necesita
-- `prisma migrate deploy`.

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'royaltica_app') THEN
    CREATE ROLE royaltica_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
END
$$;

ALTER ROLE royaltica_app WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS
  PASSWORD :'role_password';

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
