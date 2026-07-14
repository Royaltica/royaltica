import {
  ArrayMinSize,
  ArrayUnique,
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { PaymentRoute } from '@prisma/client';

/** Crea un pago que agrupa una o más facturas APROBADAS. */
export class CreatePaymentDto {
  @ArrayMinSize(1, { message: 'Debes incluir al menos una factura.' })
  @ArrayUnique()
  @IsUUID('all', { each: true })
  invoiceIds!: string[];

  @IsEnum(PaymentRoute)
  route!: PaymentRoute;

  /** Fecha programada de pago (ISO 8601). Si se omite, queda sin programar. */
  @IsOptional()
  @IsISO8601()
  scheduledDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
