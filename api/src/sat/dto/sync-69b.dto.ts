import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';

const RFC_REGEX = /^[A-ZÑ&]{3,4}\d{6}[A-Z\d]{3}$/i;

export class Sat69bEntryDto {
  @IsString()
  @Matches(RFC_REGEX, { message: 'RFC con formato inválido.' })
  rfc!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  /** PRESUNTO | DEFINITIVO | DESVIRTUADO | SENTENCIA_FAVORABLE */
  @IsOptional()
  @IsString()
  @MaxLength(50)
  status?: string;

  @IsOptional()
  @IsISO8601()
  publishedAt?: string;
}

export class Sync69bDto {
  @IsArray()
  @ArrayMaxSize(10000)
  @ValidateNested({ each: true })
  @Type(() => Sat69bEntryDto)
  entries!: Sat69bEntryDto[];
}
