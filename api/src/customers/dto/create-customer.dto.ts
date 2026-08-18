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

/**
 * RFC de persona moral (12) o física (13) — formato mexicano.
 * Se exporta para que CustomersService la use SOLO cuando la organización
 * es mexicana (locale es-MX / currency MXN). El DTO ya no la impone a
 * nivel de request porque una organización de cobranza fuera de México
 * (ej. Canadá) identifica a sus clientes con su propio "tax ID" / Business
 * Number, que no sigue este formato — bloquear aquí impedía crear
 * clientes canadienses vía la API pública aunque el schema y el resto del
 * producto ya soportan locale/currency por organización.
 */
export const RFC_REGEX = /^[A-ZÑ&]{3,4}\d{6}[A-Z\d]{3}$/i;
/** Teléfono en E.164 (ej. +5215512345678) para recordatorios por WhatsApp. */
const E164_REGEX = /^\+[1-9]\d{7,14}$/;

export class CreateCustomerDto {
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name!: string;

  /**
   * Identificador fiscal del cliente: RFC (México) o el equivalente del
   * país de la organización (ej. Business Number en Canadá). El formato
   * estricto de RFC se valida en el servicio, no aquí, porque depende del
   * locale/currency de la organización — ver RFC_REGEX arriba.
   */
  @IsString()
  @MinLength(3)
  @MaxLength(30)
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
