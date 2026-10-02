-- Spec "Mejoras V1" (PDF de Paolo) — gaps restantes del gap analysis.

-- FR-02: contacto de Finanzas/Tesorería, priorizado sobre el genérico.
ALTER TABLE "Customer" ADD COLUMN "financeContactName" TEXT;
ALTER TABLE "Customer" ADD COLUMN "financeContactEmail" TEXT;
ALTER TABLE "Customer" ADD COLUMN "financeContactPhone" TEXT;

-- FR-06: última vez que se mandó el mensaje de mantenimiento de datos
-- (buenos pagadores, cada ~6 meses, sin mencionar deuda).
ALTER TABLE "Customer" ADD COLUMN "lastServiceMessageAt" TIMESTAMP(3);

-- FR-08: pool de números virtuales propios por organización.
CREATE TABLE "VirtualNumber" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "phoneId" TEXT NOT NULL,
    "label" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VirtualNumber_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VirtualNumber_organizationId_phoneId_key" ON "VirtualNumber"("organizationId", "phoneId");
CREATE INDEX "VirtualNumber_organizationId_isActive_idx" ON "VirtualNumber"("organizationId", "isActive");

ALTER TABLE "VirtualNumber" ADD CONSTRAINT "VirtualNumber_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Candado de exclusividad CxP/CxC a nivel de base de datos (pregunta de
-- José sobre la organización de la BD): hoy la regla "PAYABLE usa
-- supplierId, RECEIVABLE usa customerId, nunca ambos ni ninguno" solo la
-- respeta el código de la aplicación. NOT VALID: no revalida filas
-- existentes (evita que el deploy falle si hay algún dato legado atípico),
-- pero SÍ se aplica a partir de ahora en todo INSERT/UPDATE. Se puede
-- VALIDATE CONSTRAINT más adelante una vez confirmado que no hay filas que
-- la violen.
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_direction_party_check" CHECK (
    (direction = 'PAYABLE' AND "supplierId" IS NOT NULL AND "customerId" IS NULL)
    OR
    (direction = 'RECEIVABLE' AND "customerId" IS NOT NULL AND "supplierId" IS NULL)
) NOT VALID;
