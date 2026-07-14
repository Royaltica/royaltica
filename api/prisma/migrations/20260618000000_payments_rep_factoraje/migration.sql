-- Prompt 7: REP tracking en Invoice, notes en Payment, dispersión en FactorajeRequest.

-- AlterTable: Invoice — seguimiento de REP (complemento de pago)
ALTER TABLE "Invoice" ADD COLUMN     "repStatus" TEXT NOT NULL DEFAULT 'NA',
ADD COLUMN     "repUuid" TEXT,
ADD COLUMN     "repReceivedAt" TIMESTAMP(3);

-- AlterTable: Payment — nota libre del pago
ALTER TABLE "Payment" ADD COLUMN     "notes" TEXT;

-- AlterTable: FactorajeRequest — referencia y fecha de dispersión del proveedor externo
ALTER TABLE "FactorajeRequest" ADD COLUMN     "providerRef" TEXT,
ADD COLUMN     "disbursedAt" TIMESTAMP(3);

-- Índice para consultar facturas con REP pendiente
CREATE INDEX "Invoice_repStatus_idx" ON "Invoice"("repStatus");
