import { IsISO8601, IsOptional } from 'class-validator';

/** Rango temporal opcional para los reportes de costos. */
export class QueryCostsDto {
  /** Inicio del período (ISO 8601). Si se omite, no se acota el inicio. */
  @IsOptional()
  @IsISO8601()
  from?: string;

  /** Fin del período (ISO 8601). Si se omite, no se acota el fin. */
  @IsOptional()
  @IsISO8601()
  to?: string;
}
