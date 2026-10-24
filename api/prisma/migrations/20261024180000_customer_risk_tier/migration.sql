-- Clasificación de riesgo/incobrabilidad por cliente (Fase 1 del pedido de
-- Paolo: "cómo analiza Royáltica cuándo un cliente se está volviendo
-- incobrable"). Solo agrega columnas nullable: ningún cliente existente se
-- rompe, quedan sin clasificar (riskTier=null) hasta la primera corrida del
-- cron 'customer-score-recompute'.

-- CreateEnum
CREATE TYPE "CustomerRiskTier" AS ENUM ('SANO', 'ATENCION', 'RIESGO', 'INCOBRABLE');

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN "riskTier" "CustomerRiskTier";
ALTER TABLE "Customer" ADD COLUMN "maxDaysOverdue" INTEGER;
ALTER TABLE "Customer" ADD COLUMN "riskTierUpdatedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Customer_riskTier_idx" ON "Customer"("riskTier");
