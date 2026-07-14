import { IsJWT, IsNotEmpty, IsString } from 'class-validator';

/**
 * Cuerpo de POST /auth/refresh.
 * Reemite un JWT propio a partir de uno aún válido (renovación de sesión).
 */
export class RefreshTokenDto {
  @IsString()
  @IsNotEmpty({ message: 'El token es obligatorio.' })
  @IsJWT({ message: 'El token no tiene formato JWT válido.' })
  token!: string;
}
