import {
  IsBoolean,
  IsEnum,
  IsIn,
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
import { TEMPLATE_NAMES } from '../../whatsapp/collection-templates';

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

  /**
   * Días respecto al vencimiento a partir de los cuales este paso puede
   * dispararse. Negativo = antes de vencer (niveles de cobranza temprana:
   * -14, -7, -3); 0 = el día del vencimiento.
   */
  @IsInt()
  @Min(-120)
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

  /**
   * Plantilla de WhatsApp aprobada por Meta para el primer contacto de este
   * paso (ver src/whatsapp/collection-templates.ts). Null = sin plantilla.
   */
  @IsOptional()
  @IsIn([...TEMPLATE_NAMES, null])
  whatsappTemplateName?: string | null;
}
