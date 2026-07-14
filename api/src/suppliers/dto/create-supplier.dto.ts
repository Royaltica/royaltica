import {
  IsEmail,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/** RFC de persona moral (12) o física (13). */
const RFC_REGEX = /^[A-ZÑ&]{3,4}\d{6}[A-Z\d]{3}$/i;

export class CreateSupplierDto {
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
  @MaxLength(100)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  activity?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  seniorityYears?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  capitalAmount?: number;

  @IsOptional()
  @IsString()
  @Matches(/^\d{18}$/, { message: 'La CLABE debe tener 18 dígitos.' })
  clabeInterbancaria?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  bankName?: string;
}
