-- 2FA TOTP por usuario. El secreto se guarda cifrado (AES-256-GCM) por la app.
ALTER TABLE "User" ADD COLUMN "totpSecret" TEXT;
ALTER TABLE "User" ADD COLUMN "totpEnabled" BOOLEAN NOT NULL DEFAULT false;
