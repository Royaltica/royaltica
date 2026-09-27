-- Perfiles operativos (SoD, spec "Mejoras V1" de Paolo, sección 2):
-- Administrador/Data, Supervisor/Gerente, Agente/Ejecutivo.
--
-- Ortogonal a UserRole: solo etiqueta el perfil de negocio para el ruteo
-- de UI en el frontend y para prellenar `permissions[]` al invitar.
CREATE TYPE "OperationalProfile" AS ENUM ('ADMINISTRADOR_DATA', 'SUPERVISOR_GERENTE', 'AGENTE_EJECUTIVO');

ALTER TABLE "User" ADD COLUMN "operationalProfile" "OperationalProfile";
CREATE INDEX "User_operationalProfile_idx" ON "User"("operationalProfile");

-- Contacto (cliente CxC) asignado a un Agente/Ejecutivo. Null = sin asignar.
ALTER TABLE "Customer" ADD COLUMN "assignedAgentId" TEXT;
CREATE INDEX "Customer_assignedAgentId_idx" ON "Customer"("assignedAgentId");
ALTER TABLE "Customer"
  ADD CONSTRAINT "Customer_assignedAgentId_fkey"
  FOREIGN KEY ("assignedAgentId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
