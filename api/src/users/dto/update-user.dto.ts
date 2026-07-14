import {
  ArrayUnique,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ALL_AREAS } from '../../auth/constants/permissions';
import { INVITABLE_ROLES, type InvitableRole } from './invite-user.dto';

/**
 * Edición de un usuario existente por el admin.
 * Permite cambiar nombre, rol y áreas sin recrear la cuenta.
 */
export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsIn(INVITABLE_ROLES)
  role?: InvitableRole;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(ALL_AREAS, { each: true })
  permissions?: string[];
}
