import { IsJWT, IsString, Length, Matches } from 'class-validator';

/** Código TOTP de 6 dígitos de la app autenticadora. */
export class TwoFactorCodeDto {
  @IsString()
  @Matches(/^\d{6}$/, { message: 'El código debe ser de 6 dígitos.' })
  code!: string;
}

/** Segundo paso del login: token temporal + código TOTP. */
export class TwoFactorCompleteDto {
  @IsJWT()
  tempToken!: string;

  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/, { message: 'El código debe ser de 6 dígitos.' })
  code!: string;
}
