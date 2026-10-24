-- Diagnóstico pre-venta (Fase 4, "CONCEPTO" de Paolo): formulario guiado
-- público para prospectos, sin FK a Organization (igual que Lead).

-- CreateEnum
CREATE TYPE "CollectionMethod" AS ENUM ('NINGUNO', 'MANUAL_EXCEL', 'LLAMADAS', 'WHATSAPP_MANUAL', 'SOFTWARE');

-- CreateEnum
CREATE TYPE "DiagnosticHealthTier" AS ENUM ('SALUDABLE', 'OPORTUNIDADES', 'RIESGO_ALTO');

-- CreateTable
CREATE TABLE "PreSaleDiagnostic" (
    "id" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "company" TEXT,
    "phone" TEXT,
    "hasCollectionPolicy" BOOLEAN NOT NULL,
    "collectionMethod" "CollectionMethod" NOT NULL,
    "avgDaysToCollect" INTEGER NOT NULL,
    "overduePortfolioPct" INTEGER NOT NULL,
    "portfolioSize" INTEGER,
    "usesSoftware" BOOLEAN NOT NULL,
    "score" INTEGER NOT NULL,
    "tier" "DiagnosticHealthTier" NOT NULL,
    "recommendations" TEXT[],
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PreSaleDiagnostic_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PreSaleDiagnostic_contactEmail_idx" ON "PreSaleDiagnostic"("contactEmail");

-- CreateIndex
CREATE INDEX "PreSaleDiagnostic_createdAt_idx" ON "PreSaleDiagnostic"("createdAt");
