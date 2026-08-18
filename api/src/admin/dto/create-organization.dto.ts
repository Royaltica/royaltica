import { Plan } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  SUPPORTED_LOCALES,
  SUPPORTED_CURRENCIES,
  type SupportedLocale,
  type SupportedCurrency,
} from '../../organization/organization.constants';

/**
 * Onboarding de un cliente nuevo: crea la organización y su primer
 * CORPORATE_ADMIN en un solo paso (sin necesidad de seed).
 */
export class CreateOrganizationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name!: string;

  /**
   * Identificador fiscal: RFC (México, 12-13 caracteres) o el equivalente
   * del país de la organización — ej. Business Number canadiense con
   * cuenta de programa (hasta 15 caracteres, "123456789RT0001"). Por eso
   * el límite es 30, no 13: 13 solo alcanzaba para RFC mexicano.
   */
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  rfc!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  legalName!: string;

  /** Locale de la organización (idioma/formato regional). Default es-MX. */
  @IsOptional()
  @IsIn(SUPPORTED_LOCALES)
  locale?: SupportedLocale;

  /** Moneda de la organización. Default MXN. */
  @IsOptional()
  @IsIn(SUPPORTED_CURRENCIES)
  currency?: SupportedCurrency;

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
