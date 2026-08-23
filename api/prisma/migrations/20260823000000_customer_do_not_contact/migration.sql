-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "doNotContact" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "doNotContactReason" TEXT,
ADD COLUMN     "doNotContactAt" TIMESTAMP(3);
