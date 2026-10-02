import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * FR-08 (spec "Mejoras V1"): alta de un número virtual propio de Royáltica
 * para el pool de envío de WhatsApp de cobranza de una organización.
 * `phoneId` es opaco a propósito: Meta Cloud API usa un phone_number_id,
 * Twilio usa el número "From" — el formato depende de WHATSAPP_PROVIDER.
 */
export class CreateVirtualNumberDto {
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  phoneId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  label?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
