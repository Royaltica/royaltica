import { IsOptional, IsString } from 'class-validator';

/**
 * Cuerpo de POST /bank-reconciliation/imports (multipart, junto al archivo).
 * `bankName` es texto libre a propósito: no se conoce todavía qué banco(s)
 * canadiense(s) usa Tradespace, así que no hay catálogo cerrado (ver
 * BankStatementImport.bankName en prisma/schema.prisma). Vacío → "unknown".
 */
export class ImportBankStatementDto {
  @IsOptional()
  @IsString()
  bankName?: string;
}
