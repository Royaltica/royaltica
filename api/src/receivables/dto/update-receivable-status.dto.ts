import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { InvoiceStatus } from '@prisma/client';

export class UpdateReceivableStatusDto {
  @IsEnum(InvoiceStatus)
  status!: InvoiceStatus;

  /** Motivo del cambio (queda registrado en el audit log). */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
