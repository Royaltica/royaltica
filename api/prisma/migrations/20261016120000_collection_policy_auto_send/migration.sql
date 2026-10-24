-- Envío automático vs. con aprobación del plan de cobranza. Solo agrega;
-- default true conserva el comportamiento de las políticas existentes.
ALTER TABLE "CollectionPolicy" ADD COLUMN "autoSend" BOOLEAN NOT NULL DEFAULT true;
