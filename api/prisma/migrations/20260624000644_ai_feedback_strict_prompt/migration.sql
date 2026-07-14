-- CreateEnum
CREATE TYPE "AiFeedbackRating" AS ENUM ('UP', 'DOWN');

-- CreateTable
CREATE TABLE "AiFeedback" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" "AiFeedbackRating" NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "comment" TEXT,
    "toolsUsed" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiFeedback_organizationId_idx" ON "AiFeedback"("organizationId");

-- CreateIndex
CREATE INDEX "AiFeedback_rating_idx" ON "AiFeedback"("rating");

-- CreateIndex
CREATE INDEX "AiFeedback_createdAt_idx" ON "AiFeedback"("createdAt");

-- CreateIndex
CREATE INDEX "AiFeedback_organizationId_rating_idx" ON "AiFeedback"("organizationId", "rating");
