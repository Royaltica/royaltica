import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  CollectionContactChannel,
  CollectionSequenceTone,
} from '@prisma/client';

/**
 * Un paso de la cadena de escalamiento de cobranza (CollectionSequenceStep),
 * anidado bajo una CollectionPolicy. Ej.: día 1 recordatorio suave por
 * correo → día 5 WhatsApp → día 10 correo firme → día 15+ escala a un
 * humano (escalatesToHuman=true).
 */
export class CreateSequenceStepDto {
  /** Orden del paso dentro de la secuencia (1, 2, 3...). */
  @IsInt()
  @Min(1)
  @Max(50)
  stepOrder!: number;

  /** Días de atraso a partir de los cuales este paso puede dispararse. */
  @IsInt()
  @Min(0)
  @Max(365)
  daysAfterDue!: number;

  @IsEnum(CollectionContactChannel)
  channel!: CollectionContactChannel;

  @IsOptional()
  @IsEnum(CollectionSequenceTone)
  tone?: CollectionSequenceTone;

  /**
   * Plantilla del mensaje. Placeholders soportados: {{customerName}},
   * {{amount}}, {{dueDate}}, {{daysOverdue}}.
   */
  @IsString()
  @MaxLength(2000)
  messageTemplate!: string;

  /**
   * Si es true, este paso no envía un mensaje automático: crea un handoff
   * (notificación) para los admins de la organización.
   */
  @IsOptional()
  @IsBoolean()
  escalatesToHuman?: boolean;
}
