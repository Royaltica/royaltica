import {
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/** RFC de persona moral (12) o física (13). */
const RFC_REGEX = /^[A-ZÑ&]{3,4}\d{6}[A-Z\d]{3}$/i;
/** Teléfono en E.164 (ej. +5215512345678) para recordatorios por WhatsApp. */
const E164_REGEX = /^\+[1-9]\d{7,14}$/;

export class CreateCustomerDto {
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name!: string;

  @IsString()
  @Matches(RFC_REGEX, { message: 'RFC con formato inválido.' })
  rfc!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  legalName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  contact?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Email inválido.' })
  email?: string;

  @IsOptional()
  @IsString()
  @Matches(E164_REGEX, {
    message: 'El teléfono debe estar en formato E.164 (ej. +5215512345678).',
  })
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  creditLimitDays?: number;
}
