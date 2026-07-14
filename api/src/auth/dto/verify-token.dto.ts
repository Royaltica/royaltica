import { IsJWT, IsNotEmpty, IsString } from 'class-validator';

/**
 * Cuerpo de POST /auth/verify-token.
 * El cliente envía el ID token que obtuvo de Firebase en el login.
 */
export class VerifyTokenDto {
  @IsString()
  @IsNotEmpty({ message: 'El idToken es obligatorio.' })
  @IsJWT({ message: 'El idToken no tiene formato JWT válido.' })
  idToken!: string;
}
