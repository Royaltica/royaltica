-- FR-04 (spec "Mejoras V1"): score de puntualidad por cliente (CxC).
ALTER TABLE "Customer" ADD COLUMN "score" INTEGER;
ALTER TABLE "Customer" ADD COLUMN "scoreUpdatedAt" TIMESTAMP(3);
