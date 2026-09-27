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
import type { OperationalProfile } from '@prisma/client';
import { ALL_AREAS } from '../../auth/constants/permissions';

/**
 * Roles que un admin puede asignar al invitar.
 * No se permite crear PROVIDER (se crea con el proveedor) ni SUPERADMIN.
 */
export const INVITABLE_ROLES = ['CORPORATE_USER', 'CORPORATE_ADMIN'] as const;
export type InvitableRole = (typeof INVITABLE_ROLES)[number];

/**
 * Perfiles operativos asignables al invitar (spec "Mejoras V1", sección 2).
 * Ver comentario de `OperationalProfile` en schema.prisma.
 */
export const OPERATIONAL_PROFILES: OperationalProfile[] = [
  'ADMINISTRADOR_DATA',
  'SUPERVISOR_GERENTE',
  'AGENTE_EJECUTIVO',
];

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

  /**
   * Perfil operativo (Administrador/Data, Supervisor/Gerente,
   * Agente/Ejecutivo). Opcional: si no se manda, la cuenta queda sin perfil
   * (portal completo, comportamiento igual que antes de este campo). Si se
   * manda AGENTE_EJECUTIVO, el frontend lo manda directo a la pantalla
   * simplificada de agente en vez del portal completo.
   */
  @IsOptional()
  @IsIn(OPERATIONAL_PROFILES, {
    message: `Perfil inválido. Válidos: ${OPERATIONAL_PROFILES.join(', ')}.`,
  })
  operationalProfile?: OperationalProfile;
}
