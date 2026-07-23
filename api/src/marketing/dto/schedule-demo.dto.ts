import {
  IsDateString,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * Cuerpo de POST /marketing/demo (PÚBLICO).
 * Registra una solicitud de demo desde royaltica.com. El backend guarda
 * el Lead, notifica al equipo por correo y responde 200 al usuario.
 */
export class ScheduleDemoDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsString()
  @MaxLength(160)
  company!: string;

  @IsEmail({}, { message: 'Correo inválido.' })
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  /** Rol/puesto del solicitante (opcional). */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  jobTitle?: string;

  /** Tamaño de empresa (# empleados). Opcional pero muy útil para calificar. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000000)
  companySize?: number;

  /** Fecha preferida ISO (YYYY-MM-DD o full ISO). Opcional. */
  @IsOptional()
  @IsDateString()
  preferredDate?: string;

  /** Franja horaria preferida (p. ej. "10:00-12:00" o "mañana"). */
  @IsOptional()
  @IsString()
  @MaxLength(60)
  preferredTime?: string;

  /** Contexto libre. */
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  message?: string;

  /** Origen (utm_source, referrer, etc.). Opcional. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  source?: string;
}
