import {
  IsEnum,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { PaymentRoute, PaymentType } from '@prisma/client';

/** RFC de persona moral (12) o física (13). */
const RFC_REGEX = /^[A-ZÑ&]{3,4}\d{6}[A-Z\d]{3}$/i;
/** UUID de CFDI: 8-4-4-4-12 hexadecimal. */
const CFDI_UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class CreateInvoiceDto {
  @IsUUID()
  supplierId!: string;

  @IsString()
  @Matches(CFDI_UUID_REGEX, { message: 'UUID de CFDI con formato inválido.' })
  cfdiUuid!: string;

  @IsString()
  @Matches(RFC_REGEX, { message: 'RFC emisor con formato inválido.' })
  rfcEmisor!: string;

  @IsString()
  @Matches(RFC_REGEX, { message: 'RFC receptor con formato inválido.' })
  rfcReceptor!: string;

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
  @IsEnum(PaymentRoute)
  paymentRoute?: PaymentRoute;

  @IsOptional()
  @IsEnum(PaymentType)
  paymentType?: PaymentType;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  poNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  cfdiXmlUrl?: string;

  @IsOptional()
  @IsString()
  pdfUrl?: string;
}
