import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

/**
 * Datos que el PROVEEDOR puede actualizar de su propio perfil desde el portal.
 * Por ahora solo los datos bancarios (para recibir sus pagos). Los datos
 * fiscales (RFC, razón social) los administra el corporativo.
 */
export class UpdateProviderProfileDto {
  /** CLABE interbancaria (18 dígitos). */
  @IsOptional()
  @IsString()
  @Matches(/^\d{18}$/, { message: 'La CLABE debe tener exactamente 18 dígitos.' })
  clabeInterbancaria?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  bankName?: string;
}
