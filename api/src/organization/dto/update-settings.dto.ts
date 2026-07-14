import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SUPPORTED_ERPS } from '../../settings/settings.service';

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
}
