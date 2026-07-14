import {
  ArrayUnique,
  IsArray,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ALL_AREAS } from '../../auth/constants/permissions';

/**
 * Roles que un admin puede asignar al invitar.
 * No se permite crear PROVIDER (se crea con el proveedor) ni SUPERADMIN.
 */
export const INVITABLE_ROLES = ['CORPORATE_USER', 'CORPORATE_ADMIN'] as const;
export type InvitableRole = (typeof INVITABLE_ROLES)[number];

export class InviteUserDto {
  @IsEmail({}, { message: 'Email inválido.' })
  email!: string;

  @IsString()
  @MinLength(2, { message: 'El nombre es muy corto.' })
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsIn(INVITABLE_ROLES, {
    message: `El rol debe ser uno de: ${INVITABLE_ROLES.join(', ')}.`,
  })
  role?: InvitableRole;

  /**
   * Áreas que verá el usuario. Se ignora para CORPORATE_ADMIN (ve todo).
   * Cada valor debe ser un área válida de la plataforma.
   */
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(ALL_AREAS, {
    each: true,
    message: `Área inválida. Válidas: ${ALL_AREAS.join(', ')}.`,
  })
  permissions?: string[];
}
