import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  SUPPORTED_ERPS,
  SUPPORTED_EXTERNAL_SYNC_PROVIDERS,
} from '../../settings/settings.service';
import {
  SUPPORTED_LOCALES,
  SUPPORTED_CURRENCIES,
  HEX_COLOR_REGEX,
} from '../organization.constants';

/** Un autorizador operativo (su cantidad define las firmas requeridas). */
export class AuthorizerEntryDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  cargo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  email?: string;
}

/** Parche parcial de la configuración de la organización. */
export class UpdateSettingsDto {
  @IsOptional()
  @IsBoolean()
  multiUserEnabled?: boolean;

  /**
   * Autorizadores operativos. Su CANTIDAD define `requiredSignatures`
   * (0 = aprobación automática). `requiredSignatures` ya no se fija a mano.
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => AuthorizerEntryDto)
  authorizers?: AuthorizerEntryDto[];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(90)
  documentAlertDays?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  factorajeFeePercent?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1)
  costRatio?: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  fiscalRegimen?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  fiscalAddress?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  displayName?: string;

  /** ERP del corporativo para sincronización. null lo desactiva. */
  @IsOptional()
  @IsIn([...SUPPORTED_ERPS])
  erpProvider?: string;

  /** Conector CxC externo (CSV universal o REST configurable). */
  @IsOptional()
  @IsIn([...SUPPORTED_EXTERNAL_SYNC_PROVIDERS])
  externalSyncProvider?: string;

  /** URL base del conector REST externo. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  externalSyncRestBaseUrl?: string;

  /** Header completo de autenticación del conector REST externo. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  externalSyncRestAuthHeader?: string;

  /** Configuración regional del tenant (Tradespace: en-CA / fr-CA). */
  @IsOptional()
  @IsIn([...SUPPORTED_LOCALES])
  locale?: string;

  /** Moneda del tenant (Tradespace: CAD). */
  @IsOptional()
  @IsIn([...SUPPORTED_CURRENCIES])
  currency?: string;

  // ── White label (Tradespace: marca propia) ──────────────

  /** Nombre visible que reemplaza "Royáltica" en la UI. null lo desactiva. */
  @IsOptional()
  @IsString()
  @MaxLength(150)
  brandDisplayName?: string;

  /** URL del logo propio. Validación laxa (string) para tolerar CDNs internas. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  brandLogoUrl?: string;

  /** Color primario de marca en hex (#RRGGBB). */
  @IsOptional()
  @Matches(HEX_COLOR_REGEX, { message: 'brandPrimaryColor debe ser un hex #RRGGBB.' })
  brandPrimaryColor?: string;

  /** Color de acento de marca en hex (#RRGGBB); sobreescribe --color-brand-gold. */
  @IsOptional()
  @Matches(HEX_COLOR_REGEX, { message: 'brandAccentColor debe ser un hex #RRGGBB.' })
  brandAccentColor?: string;
}
