import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { CollectionContactChannel } from '@prisma/client';

/**
 * "Guard rail" de cobranza: cómo y cuándo el agente automático de cobranza
 * puede contactar a un deudor. Requisito de Tradespace (Canadá) para cumplir
 * con sus reglas de contacto y dejar un rastro auditable de cada decisión.
 */
export class CreateCollectionPolicyDto {
  @IsString()
  @MaxLength(150)
  name!: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsInt()
  @Min(0)
  @Max(100)
  maxContactsPerWeek!: number;

  @IsInt()
  @Min(0)
  @Max(23)
  allowedContactStartHour!: number;

  @IsInt()
  @Min(0)
  @Max(23)
  allowedContactEndHour!: number;

  /** Zona horaria IANA, ej. "America/Toronto". */
  @IsString()
  @MaxLength(100)
  timezone!: string;

  @IsInt()
  @Min(0)
  @Max(365)
  gracePeriodDays!: number;

  @IsInt()
  @Min(0)
  @Max(365)
  escalationThresholdDays!: number;

  @IsEnum(CollectionContactChannel)
  preferredChannel!: CollectionContactChannel;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  pauseMessage?: string;

  /** Fechas (ISO 8601) en las que no se debe contactar al deudor. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(366)
  @IsISO8601({}, { each: true })
  blackoutDates?: string[];

  /**
   * Opt-in: si es true, el motor de escalamiento consulta primero a Gemini
   * (CollectionSequencesAiDecisionService) para decidir acción/canal/tono
   * según el riesgo real del cliente, antes de seguir el paso fijo de la
   * secuencia. Default false = 100% determinista (sin cambio de comportamiento).
   */
  @IsOptional()
  @IsBoolean()
  aiDecisionEnabled?: boolean;
}
