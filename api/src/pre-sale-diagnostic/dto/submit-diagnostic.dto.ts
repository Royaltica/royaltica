import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { CollectionMethod } from '@prisma/client';

/**
 * Cuerpo de POST /diagnostico-cobranza (PÚBLICO). Formulario guiado del
 * "Diagnóstico" pre-venta (Fase 4, concepto de Paolo): analiza cómo hace
 * cobranza HOY un prospecto, antes de contratar Royáltica.
 */
export class SubmitDiagnosticDto {
  @IsString()
  @MaxLength(120)
  contactName!: string;

  @IsEmail({}, { message: 'Correo inválido.' })
  contactEmail!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  company?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  /** ¿Tiene una política de cobranza definida (días de gracia, escalamiento)? */
  @IsBoolean()
  hasCollectionPolicy!: boolean;

  /** Cómo le da seguimiento a la cartera vencida hoy. */
  @IsEnum(CollectionMethod)
  collectionMethod!: CollectionMethod;

  /** Días promedio que tarda en cobrar una factura después de vencida. */
  @IsInt()
  @Min(0)
  @Max(3650)
  avgDaysToCollect!: number;

  /** % de su cartera actualmente vencida (0-100). */
  @IsInt()
  @Min(0)
  @Max(100)
  overduePortfolioPct!: number;

  /** # de clientes activos a los que factura (opcional, ayuda a calificar). */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000000)
  portfolioSize?: number;

  /** ¿Usa algún software/CRM para cobranza hoy (aunque no sea Royáltica)? */
  @IsBoolean()
  usesSoftware!: boolean;

  /** Origen (utm_source, referrer, "Paolo en WhatsApp", etc.). */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  source?: string;

  /** Honeypot anti-spam (mismo criterio que ScheduleDemoDto/ContactDto). */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;
}
