-- AlterTable
ALTER TABLE "User" ADD COLUMN "whatsappPhone" TEXT,
ADD COLUMN "whatsappOptIn" BOOLEAN NOT NULL DEFAULT false;
