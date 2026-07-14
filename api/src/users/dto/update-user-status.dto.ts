import { IsBoolean } from 'class-validator';

/** Activa o desactiva el acceso de un usuario (sin borrarlo). */
export class UpdateUserStatusDto {
  @IsBoolean()
  isActive!: boolean;
}
