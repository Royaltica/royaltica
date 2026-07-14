import { IsNumber, IsOptional, IsString, Matches, Min } from 'class-validator';

/** Período mensual en formato YYYY-MM. */
const PERIOD_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

export class GenerateStatementDto {
  @IsString()
  @Matches(PERIOD_REGEX, { message: 'El período debe tener formato YYYY-MM.' })
  period!: string;

  /**
   * Ingresos del período (ventas). Royáltica gestiona cuentas por pagar,
   * por lo que el ingreso lo aporta el cliente. Si se omite, el estado es
   * un análisis de egresos (revenue = 0).
   */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  revenue?: number;
}
