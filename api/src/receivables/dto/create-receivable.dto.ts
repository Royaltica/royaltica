import {
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * Formato mexicano de UUID de CFDI y de RFC. Ambos se validan en
 * ReceivablesService, no aquí — SOLO para organizaciones mexicanas
 * (currency MXN). Canadá y otros países fuera de México no tienen
 * CFDI/SAT: `cfdiUuid` ahí es simplemente la llave única del documento
 * (el backend genera una sintética si el cliente no manda una), y
 * rfcEmisor/rfcReceptor llevan el identificador fiscal que corresponda
 * (ej. Business Number canadiense), sin el formato RFC.
 */
export const CFDI_UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Factura de venta (CxC): la organización la emite a un cliente. rfcEmisor y
 * rfcReceptor son opcionales: si no vienen, el backend los deriva del RFC de
 * la organización (emisor) y del cliente (receptor).
 */
export class CreateReceivableDto {
  @IsUUID()
  customerId!: string;

  /**
   * Llave única del documento. Para México: UUID de CFDI (formato validado
   * en el servicio). Para otros países: opcional — si se omite, el backend
   * genera una llave sintética única, igual que hace el seed de datos.
   */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  cfdiUuid?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  rfcEmisor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
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
