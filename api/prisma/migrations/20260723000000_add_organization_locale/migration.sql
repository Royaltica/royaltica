-- Soporte multi-tenant para locale/moneda (Tradespace: en-CA/fr-CA + CAD).
-- Valores válidos se validan a nivel de DTO/servicio, no con un enum, para
-- poder agregar nuevos locales sin requerir otra migración.

ALTER TABLE "Organization" ADD COLUMN "locale"   TEXT NOT NULL DEFAULT 'es-MX';
ALTER TABLE "Organization" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'MXN';
