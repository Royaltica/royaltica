import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Cuerpo de POST /auth/request-access (PÚBLICO).
 * Una persona interesada pide acceso; el SUPERADMIN (CEO) recibe el aviso y
 * decide darle de alta. NO crea cuenta: solo registra el interés.
 */
export class RequestAccessDto {
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

  @IsOptional()
  @IsString()
  @MaxLength(500)
  message?: string;
}
