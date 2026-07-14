import { Plan } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/**
 * Onboarding de un cliente nuevo: crea la organización y su primer
 * CORPORATE_ADMIN en un solo paso (sin necesidad de seed).
 */
export class CreateOrganizationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(13)
  rfc!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  legalName!: string;

  @IsOptional()
  @IsEnum(Plan)
  plan?: Plan;

  /** Correo del primer administrador de la organización. */
  @IsEmail()
  adminEmail!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  adminName!: string;
}
