import {
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

/** RFC de persona moral (12) o física (13). */
const RFC_REGEX = /^[A-ZÑ&]{3,4}\d{6}[A-Z\d]{3}$/i;
/** UUID de CFDI: 8-4-4-4-12 hexadecimal. */
const CFDI_UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Factura de venta (CxC): la organización la emite a un cliente. rfcEmisor y
 * rfcReceptor son opcionales: si no vienen, el backend los deriva del RFC de
 * la organización (emisor) y del cliente (receptor).
 */
export class CreateReceivableDto {
  @IsUUID()
  customerId!: string;

  @IsString()
  @Matches(CFDI_UUID_REGEX, { message: 'UUID de CFDI con formato inválido.' })
  cfdiUuid!: string;

  @IsOptional()
  @IsString()
  @Matches(RFC_REGEX, { message: 'RFC emisor con formato inválido.' })
  rfcEmisor?: string;

  @IsOptional()
  @IsString()
  @Matches(RFC_REGEX, { message: 'RFC receptor con formato inválido.' })
  rfcReceptor?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  subtotal!: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  iva!: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  total!: number;

  @IsISO8601()
  date!: string;

  @IsOptional()
  @IsISO8601()
  dueDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  folio?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
