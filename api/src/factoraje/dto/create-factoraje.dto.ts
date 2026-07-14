import {
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

/** Solicitud de factoraje (adelanto) sobre una factura. */
export class CreateFactorajeDto {
  @IsUUID()
  invoiceId!: string;

  /**
   * Monto a adelantar. Si se omite, se toma el total de la factura.
   * No puede exceder el total de la factura.
   */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  requestedAmount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
