import { IsEmail, IsUUID, ValidateIf } from 'class-validator';

/**
 * Cuerpo de POST /auth/dev-login (SOLO desarrollo).
 * Emite un JWT sin pasar por Firebase, en dos modos:
 *  - por `email`: inicia sesión como un usuario existente.
 *  - por `supplierId`: inicia sesión como el PROVEEDOR de ese supplier (si no
 *    existe su cuenta, se crea al vuelo) — para probar el Portal del Proveedor.
 * Útil cuando el reloj del entorno impide la verificación contra Google.
 */
export class DevLoginDto {
  @ValidateIf((o) => !o.supplierId)
  @IsEmail({}, { message: 'Email inválido.' })
  email?: string;

  @ValidateIf((o) => !o.email)
  @IsUUID('all', { message: 'supplierId inválido.' })
  supplierId?: string;
}
