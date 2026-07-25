import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/**
 * Cuerpo de POST /marketing/contact (PÚBLICO).
 * Formulario genérico de contacto en royaltica.com. Guarda un Lead
 * tipo CONTACT y avisa al equipo por correo.
 */
export class ContactDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  company?: string;

  @IsEmail({}, { message: 'Correo inválido.' })
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  /** Asunto corto (opcional, ayuda a clasificar). */
  @IsOptional()
  @IsString()
  @MaxLength(140)
  subject?: string;

  @IsString()
  @MaxLength(2000)
  message!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  source?: string;

  /**
   * Campo honeypot — invisible en el HTML. Si viene con valor, es un bot
   * (los usuarios reales nunca lo llenan). El backend lo detecta y
   * responde 200 falso sin guardar nada, para no darle señal al bot.
   */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;
}
