import { IsEnum, IsISO8601, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ForensicStatus, InvoiceStatus } from '@prisma/client';
import { PaginationDto } from '../../common/dto/pagination.dto';

/** Filtros + paginación para GET /invoices. */
export class QueryInvoicesDto extends PaginationDto {
  @IsOptional()
  @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;

  @IsOptional()
  @IsEnum(ForensicStatus)
  forensicStatus?: ForensicStatus;

  @IsOptional()
  @IsUUID()
  supplierId?: string;

  /** Inicio del rango por fecha de la factura (ISO 8601). */
  @IsOptional()
  @IsISO8601()
  dateFrom?: string;

  /** Fin del rango por fecha de la factura (ISO 8601). */
  @IsOptional()
  @IsISO8601()
  dateTo?: string;

  /** Búsqueda por folio o UUID de CFDI. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}
