-- CreateEnum
CREATE TYPE "InvoiceDirection" AS ENUM ('PAYABLE', 'RECEIVABLE');

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "customerId" TEXT,
ADD COLUMN     "direction" "InvoiceDirection" NOT NULL DEFAULT 'PAYABLE',
ADD COLUMN     "lastReminderSentAt" TIMESTAMP(3),
ALTER COLUMN "supplierId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "direction" "InvoiceDirection" NOT NULL DEFAULT 'PAYABLE';

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rfc" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "contact" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "category" TEXT,
    "creditLimitDays" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Customer_organizationId_idx" ON "Customer"("organizationId");

-- CreateIndex
CREATE INDEX "Customer_isActive_idx" ON "Customer"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_organizationId_rfc_key" ON "Customer"("organizationId", "rfc");

-- CreateIndex
CREATE INDEX "Invoice_direction_idx" ON "Invoice"("direction");

-- CreateIndex
CREATE INDEX "Invoice_customerId_idx" ON "Invoice"("customerId");

-- CreateIndex
CREATE INDEX "Payment_direction_idx" ON "Payment"("direction");

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Row Level Security para la nueva tabla Customer (aislamiento multi-tenant,
-- mismo patrón que Supplier/Invoice/Payment). Ver migración row_level_security.
ALTER TABLE "Customer" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Customer" FORCE ROW LEVEL SECURITY;
CREATE POLICY org_isolation ON "Customer"
  USING (
    COALESCE(current_setting('app.org_id', true), '') = ''
    OR "organizationId" = current_setting('app.org_id', true)
  );
