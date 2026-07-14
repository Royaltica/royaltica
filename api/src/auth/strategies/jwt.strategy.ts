import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { Env } from '../../config/env.validation';
import type { JwtPayload } from '../interfaces/jwt-payload.interface';
import type { AuthenticatedUser } from '../interfaces/authenticated-user.interface';
import { FULL_ACCESS_ROLES, WILDCARD_PERMISSION } from '../constants/permissions';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService<Env, true>,
    private readonly prisma: PrismaService,
  ) {
    super({
      // El token llega normalmente en el header Authorization, pero el stream
      // SSE (EventSource) no puede mandar headers: ahí viaja como `?token=`.
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        ExtractJwt.fromUrlQueryParameter('token'),
      ]),
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_SECRET', { infer: true }),
    });
  }

  /**
   * Passport ya verificó la firma y expiración del JWT.
   * Aquí recargamos el usuario para garantizar que sigue activo
   * y que sus permisos son los más recientes (revocación inmediata).
   */
  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        firebaseUid: true,
        email: true,
        role: true,
        organizationId: true,
        permissions: true,
        supplierId: true,
        isActive: true,
        status: true,
      },
    });

    if (!user || !user.isActive || user.status === 'DISABLED') {
      throw new UnauthorizedException('Usuario inactivo o no encontrado.');
    }

    const isFullAccess = FULL_ACCESS_ROLES.includes(
      user.role as (typeof FULL_ACCESS_ROLES)[number],
    );

    return {
      id: user.id,
      firebaseUid: user.firebaseUid,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
      permissions: isFullAccess ? [WILDCARD_PERMISSION] : user.permissions,
      supplierId: user.supplierId,
    };
  }
}
