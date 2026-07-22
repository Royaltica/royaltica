import { Type } from 'class-transformer';
import { IsNumber, IsString, Matches, Min } from 'class-validator';

const RFC_REGEX = /^[A-ZÑ&]{3,4}\d{6}[A-Z\d]{3}$/i;
const CFDI_UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Verifica el estatus de un CFDI ante el SAT (servicio SOAP público gratuito).
 * Los cuatro datos son los mismos de la "expresión impresa" del QR del CFDI.
 */
export class VerifyCfdiDto {
  @IsString()
  @Matches(CFDI_UUID_REGEX, { message: 'UUID de CFDI con formato inválido.' })
  cfdiUuid!: string;

  @IsString()
  @Matches(RFC_REGEX, { message: 'RFC emisor con formato inválido.' })
  rfcEmisor!: string;

  @IsString()
  @Matches(RFC_REGEX, { message: 'RFC receptor con formato inválido.' })
  rfcReceptor!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  total!: number;
}
