import { IsEnum, IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator';
import { InvoiceStatus } from '@prisma/client';

export class UpdateReceivableStatusDto {
  @IsEnum(InvoiceStatus)
  status!: InvoiceStatus;

  /** Motivo del cambio (queda registrado en el audit log). */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  /** Fecha en que el cliente pagó (al registrar un cobro a mano). Default: ahora. */
  @IsOptional()
  @IsISO8601()
  paidDate?: string;
}
