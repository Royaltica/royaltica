import { IsBoolean } from 'class-validator';

/**
 * Configuración > Usuarios: alterna entre "un solo administrador"
 * (false) y "varios usuarios por área" (true). Se persiste en
 * Organization.settings.multiUserEnabled.
 */
export class MultiUserToggleDto {
  @IsBoolean()
  enabled!: boolean;
}
