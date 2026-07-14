import { IsString, Matches } from 'class-validator';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Registra el UUID del REP (complemento de pago) que el cliente emitió
 * para una factura PPD ya pagada. Royáltica solo lo rastrea; no lo timbra.
 */
export class RegisterRepDto {
  @IsString()
  @Matches(UUID_RE, { message: 'repUuid debe ser un UUID de CFDI válido.' })
  repUuid!: string;
}
