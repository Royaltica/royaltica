import { IsIn, IsNumber, IsOptional, Max, Min } from 'class-validator';

export const CASTIGADA_BUCKETS = ['d91_180', 'd181_300', 'd300_plus', 'all'] as const;
export type CastigadaBucket = (typeof CASTIGADA_BUCKETS)[number];

/**
 * FR-03 (spec "Mejoras V1"): simulador de quitas para campañas especiales
 * (Black Friday / Buen Fin) sobre carteras castigadas (muy vencidas).
 */
export class SimulateDiscountDto {
  @IsNumber()
  @Min(0)
  @Max(90)
  discountPercent!: number;

  /** Balde objetivo de la campaña. 'all' = las 3 bandas castigadas juntas. */
  @IsOptional()
  @IsIn(CASTIGADA_BUCKETS)
  bucket?: CastigadaBucket;
}
