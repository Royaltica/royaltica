-- White label: branding propio por tenant (Tradespace).
-- Todas las columnas son nullables y sin default: una org sin branding
-- propio simplemente no tiene fila (NULL) y la UI cae al look de Royáltica.

ALTER TABLE "Organization" ADD COLUMN "brandDisplayName"  TEXT;
ALTER TABLE "Organization" ADD COLUMN "brandLogoUrl"       TEXT;
ALTER TABLE "Organization" ADD COLUMN "brandPrimaryColor"  TEXT;
ALTER TABLE "Organization" ADD COLUMN "brandAccentColor"   TEXT;
