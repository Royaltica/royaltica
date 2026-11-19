-- Rol de solo lectura para los respaldos automáticos (pg_dump desde GitHub
-- Actions). Puede leer todo, incluidas las tablas con RLS, pero no puede
-- escribir ni cambiar el esquema. Así el secreto que vive en GitHub no es el
-- del owner. Pasos en docs/respaldos.md.
--
--   psql "<url pública del owner>" -v ON_ERROR_STOP=1 \
--     -v role_password="$(openssl rand -hex 24)" \
--     -f api/prisma/create-backup-role.sql

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'royaltica_respaldo') THEN
    CREATE ROLE royaltica_respaldo LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE BYPASSRLS;
  END IF;
END
$$;

-- pg_dump desactiva RLS al leer; sin BYPASSRLS fallaría en las tablas con RLS.
ALTER ROLE royaltica_respaldo WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE BYPASSRLS
  PASSWORD :'role_password';

DO $$
BEGIN
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO royaltica_respaldo', current_database());
END
$$;
GRANT pg_read_all_data TO royaltica_respaldo;
ALTER ROLE royaltica_respaldo SET default_transaction_read_only = on;
