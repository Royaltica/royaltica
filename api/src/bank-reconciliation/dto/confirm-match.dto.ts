import { IsOptional, IsUUID } from 'class-validator';

/**
 * Cuerpo de POST /bank-reconciliation/transactions/:id/confirm.
 * `invoiceId` es opcional: si la transacción ya tiene un matchedInvoiceId
 * propuesto (AUTO_MATCHED), el humano solo confirma con un clic sin mandar
 * nada. Si la transacción quedó AMBIGUOUS (varios candidatos) o el admin
 * quiere corregir la propuesta, manda el invoiceId elegido explícitamente.
 */
export class ConfirmMatchDto {
  @IsOptional()
  @IsUUID()
  invoiceId?: string;
}
