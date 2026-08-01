-- Opt-in por organización: capa de decisión IA (Gemini) sobre el motor
-- determinista de cobranza. Default false = sin cambio de comportamiento
-- para organizaciones existentes; los guard rails de CollectionPolicy se
-- siguen aplicando siempre server-side, sin importar la decisión de la IA.

ALTER TABLE "CollectionPolicy" ADD COLUMN "aiDecisionEnabled" BOOLEAN NOT NULL DEFAULT false;
