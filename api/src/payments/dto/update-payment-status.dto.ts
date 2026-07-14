import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaymentStatus } from '@prisma/client';

/** Avanza el estado de un pago (SCHEDULED → PROCESSING → COMPLETED/FAILED). */
export class UpdatePaymentStatusDto {
  @IsEnum(PaymentStatus)
  status!: PaymentStatus;

  /** Referencia bancaria / SPEI cuando el pago se completa. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  transactionRef?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
