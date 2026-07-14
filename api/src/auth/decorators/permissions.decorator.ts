import { SetMetadata } from '@nestjs/common';
import type { Area } from '../constants/permissions';

export const PERMISSIONS_KEY = 'permissions';

/**
 * Exige que el usuario tenga acceso a un área específica.
 * Los admins (FULL_ACCESS_ROLES) la pasan siempre.
 * Ej: `@RequirePermissions('factoraje')`
 */
export const RequirePermissions = (
  ...areas: Area[]
): MethodDecorator & ClassDecorator => SetMetadata(PERMISSIONS_KEY, areas);
