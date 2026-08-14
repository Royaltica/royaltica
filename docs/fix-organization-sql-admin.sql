-- ============================================================================
-- Fix: vincular admin@royaltica.com (u otro admin) a su Organization
-- ============================================================================
-- Contexto (memory.md de sesiones previas):
-- "Organization table SQL linkage for the admin user is still pending
--  (SQL was accidentally run in the wrong context)"
--
-- User.organizationId es NULLABLE en el schema (api/prisma/schema.prisma,
-- modelo User). Si el admin quedó con organizationId = NULL, no puede ver
-- ni operar los datos de su organización aunque el login por Firebase
-- funcione.
--
-- CÓMO USAR ESTE ARCHIVO:
--   1. Corre primero el PASO 1 (diagnóstico, solo lectura) contra la base
--      de producción (Railway > Postgres > Query).
--   2. Revisa el resultado: confirma cuál es el email del admin afectado y
--      cuál es el id/nombre de la Organization correcta.
--   3. Sustituye los placeholders <ADMIN_EMAIL> y <ORGANIZATION_ID> en el
--      PASO 2 con los valores reales.
--   4. Corre el PASO 2 dentro de una transacción (ya incluida abajo). Si el
--      resultado del SELECT final se ve bien, confirma con COMMIT; si no,
--      ROLLBACK y no se aplica ningún cambio.
-- ============================================================================


-- ── PASO 1: Diagnóstico (solo lectura, seguro de correr en cualquier momento) ──

-- 1a. Usuarios sin organización asignada (el problema que buscamos):
SELECT id, email, name, role, "organizationId", "firebaseUid", "createdAt"
FROM "User"
WHERE "organizationId" IS NULL
ORDER BY "createdAt" ASC;

-- 1b. Organizaciones existentes (para identificar el id correcto):
SELECT id, name, "legalName", rfc, locale, currency, "isActive", "createdAt"
FROM "Organization"
ORDER BY "createdAt" ASC;


-- ── PASO 2: Corrección (transaccional — no se aplica hasta el COMMIT) ──
BEGIN;

UPDATE "User"
SET "organizationId" = '<ORGANIZATION_ID>'
WHERE email = '<ADMIN_EMAIL>'
  AND "organizationId" IS NULL; -- guarda: solo toca filas que de verdad están rotas

-- Verifica el resultado antes de confirmar:
SELECT id, email, role, "organizationId"
FROM "User"
WHERE email = '<ADMIN_EMAIL>';

-- Si el resultado de arriba muestra el organizationId correcto:
COMMIT;
-- Si algo se ve mal, en vez de COMMIT corre:
-- ROLLBACK;
