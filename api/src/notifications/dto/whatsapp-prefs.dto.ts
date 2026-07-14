import { IsBoolean, IsOptional, IsString, Matches } from 'class-validator';

/** Preferencia de alertas críticas por WhatsApp del usuario. */
export class WhatsappPrefsDto {
  /** Activa o desactiva las alertas por WhatsApp. */
  @IsBoolean()
  optIn!: boolean;

  /**
   * Teléfono en formato E.164 (ej. +5215512345678). Requerido para activar
   * el opt-in si el usuario aún no tiene uno registrado.
   */
  @IsOptional()
  @IsString()
  @Matches(/^\+[1-9]\d{7,14}$/, {
    message: 'El teléfono debe estar en formato E.164, ej. +5215512345678.',
  })
  phone?: string;
}
