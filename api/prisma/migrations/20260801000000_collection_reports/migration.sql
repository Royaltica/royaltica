-- CollectionReport: bitácora de reportes de cobranza en PDF generados por
-- organización (sin FK a Organization, mismo criterio que AiFeedback).
CREATE TABLE "CollectionReport" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "periodFrom" TIMESTAMP(3) NOT NULL,
    "periodTo" TIMESTAMP(3) NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "emailSent" BOOLEAN NOT NULL DEFAULT false,
    "recipientCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CollectionReport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CollectionReport_organizationId_idx" ON "CollectionReport"("organizationId");

CREATE INDEX "CollectionReport_generatedAt_idx" ON "CollectionReport"("generatedAt");
