-- Fase 5 (onboarding post-venta): marca cuándo una organización terminó de
-- cargar sus datos iniciales (clientes + facturas CxC). Solo agrega una
-- columna nullable: ninguna organización existente se rompe.

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN "onboardingDataCompletedAt" TIMESTAMP(3);
