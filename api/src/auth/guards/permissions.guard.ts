import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import type { Area } from '../constants/permissions';
import { WILDCARD_PERMISSION } from '../constants/permissions';
import type { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

/**
 * Verifica que el usuario tenga acceso a las áreas exigidas por
 * `@RequirePermissions()`. Un usuario con `['*']` (admin) pasa siempre.
 * Un CORPORATE_USER debe tener TODAS las áreas requeridas en su lista.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Area[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as AuthenticatedUser | undefined;
    if (!user) {
      throw new ForbiddenException('No autenticado.');
    }

    // Admin: acceso total.
    if (user.permissions.includes(WILDCARD_PERMISSION)) return true;

    const hasAll = required.every((area) => user.permissions.includes(area));
    if (!hasAll) {
      throw new ForbiddenException(
        `No tienes acceso a esta área (${required.join(', ')}).`,
      );
    }
    return true;
  }
}
