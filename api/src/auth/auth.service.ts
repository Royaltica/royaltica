import {
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import type { User } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import type { Env } from '../config/env.validation';
import { FirebaseService } from './firebase/firebase.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ActivityLogService } from '../activity/activity-log.service';
import { EmailService } from '../email/email.service';
import type { JwtPayload } from './interfaces/jwt-payload.interface';
import { FULL_ACCESS_ROLES, WILDCARD_PERMISSION } from './constants/permissions';

export interface AuthResult {
  accessToken: string;
  expiresIn: string;
  /** Si el usuario tiene 2FA activo, el login queda pendiente de código TOTP. */
  twoFactorRequired?: true;
  /** Token temporal (5 min) para POST /auth/2fa/complete. */
  tempToken?: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: User['role'];
    organizationId: string | null;
    permissions: string[];
    supplierId: string | null;
    avatarUrl: string | null;
    totpEnabled: boolean;
  };
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly firebase: FirebaseService,
    private readonly config: ConfigService<Env, true>,
    private readonly notifications: NotificationsService,
    private readonly activity: ActivityLogService,
    private readonly email: EmailService,
  ) {}

  /**
   * Solicitud PÚBLICA de acceso: registra el interés de alguien que quiere
   * entrar a Royáltica y avisa a los SUPERADMIN (el CEO) por notificación.
   * NO crea cuenta: el CEO decide darle de alta. Nunca falla hacia el cliente.
   */
  async requestAccess(dto: {
    name: string;
    company: string;
    email: string;
    phone?: string;
    message?: string;
  }): Promise<{ ok: true }> {
    const admins = await this.prisma.user.findMany({
      where: { role: 'SUPERADMIN', isActive: true },
      select: { id: true },
    });
    const body =
      `${dto.name} (${dto.company}) solicita acceso. ` +
      `Correo: ${dto.email}` +
      (dto.phone ? ` · Tel: ${dto.phone}` : '') +
      (dto.message ? ` · "${dto.message}"` : '');
    await Promise.all(
      admins.map((a) =>
        this.notifications
          .create({
            userId: a.id,
            type: 'ACCESS_REQUEST',
            title: 'Nueva solicitud de acceso',
            body,
            metadata: { ...dto },
          })
          .catch(() => undefined),
      ),
    );

    // Correo al equipo (LEADS_EMAIL) — nunca bloquea el 200 al usuario.
    const leadsEmail =
      this.config.get('LEADS_EMAIL', { infer: true }) ||
      'hello@royaltica.com';
    await this.email
      .send({
        to: leadsEmail,
        replyTo: dto.email,
        subject: `🔐 Solicitud de acceso: ${dto.company}`,
        html: `<div style="font-family:system-ui;line-height:1.5;padding:16px">
          <h2 style="margin:0 0 8px">Nueva solicitud de acceso</h2>
          <p style="color:#555;margin:0 0 16px">Alguien pide acceso a Royáltica desde el portal.</p>
          <ul style="padding-left:20px">
            <li><strong>Nombre:</strong> ${escape(dto.name)}</li>
            <li><strong>Empresa:</strong> ${escape(dto.company)}</li>
            <li><strong>Correo:</strong> <a href="mailto:${escape(dto.email)}">${escape(dto.email)}</a></li>
            ${dto.phone ? `<li><strong>Teléfono:</strong> ${escape(dto.phone)}</li>` : ''}
            ${dto.message ? `<li><strong>Mensaje:</strong> ${escape(dto.message)}</li>` : ''}
          </ul>
        </div>`,
        text: body,
      })
      .catch((err) =>
        this.logger.warn(`Fallo email de solicitud de acceso: ${err}`),
      );

    // Confirmación al solicitante (si Resend está activo).
    await this.email
      .send({
        to: dto.email,
        subject: 'Recibimos tu solicitud de acceso · Royáltica',
        html: `<div style="font-family:system-ui;max-width:520px;margin:0 auto;padding:24px;line-height:1.6">
          <p>Hola ${escape(dto.name.split(' ')[0] ?? dto.name)},</p>
          <p>Gracias por tu interés en Royáltica. Recibimos tu solicitud de acceso y nuestro equipo la está revisando. Te contactaremos al correo <strong>${escape(dto.email)}</strong> para darte de alta.</p>
          <p>— El equipo de Royáltica</p>
        </div>`,
        text: `Hola ${dto.name}, recibimos tu solicitud de acceso. Te contactaremos pronto. — Royáltica`,
      })
      .catch(() => undefined);

    this.logger.warn(`[ACCESO] Solicitud de ${dto.email} (${dto.company}).`);
    return { ok: true };
  }

  /**
   * Flujo principal de login.
   * 1. Verifica el Firebase ID token.
   * 2. Resuelve el User: por firebaseUid (recurrente) o vincula una
   *    invitación pendiente por email (primer ingreso del invitado).
   * 3. Marca status ACTIVE + lastLoginAt y emite el JWT propio.
   *
   * El sistema es invitation-only: un email desconocido se rechaza.
   * El primer admin de cada organización se provisiona vía seed/SUPERADMIN.
   */
  async verifyToken(idToken: string): Promise<AuthResult> {
    const decoded = await this.firebase.verifyIdToken(idToken);
    const email = decoded.email?.toLowerCase();

    let user = await this.prisma.user.findUnique({
      where: { firebaseUid: decoded.uid },
    });

    // Primer ingreso de un invitado: existe el User por email pero
    // todavía sin firebaseUid vinculado.
    if (!user && email) {
      const invited = await this.prisma.user.findUnique({ where: { email } });
      if (invited) {
        user = await this.prisma.user.update({
          where: { id: invited.id },
          data: { firebaseUid: decoded.uid },
        });
      }
    }

    if (!user) {
      this.logger.warn(
        `Login rechazado: ${email ?? decoded.uid} no está registrado.`,
      );
      throw new UnauthorizedException(
        'Tu cuenta no está autorizada. Pide a tu administrador que te invite.',
      );
    }

    if (!user.isActive || user.status === 'DISABLED') {
      throw new UnauthorizedException(
        'Tu cuenta está desactivada. Contacta a tu administrador.',
      );
    }

    user = await this.prisma.user.update({
      where: { id: user.id },
      data: { status: 'ACTIVE', lastLoginAt: new Date() },
    });

    return this.gateTwoFactor(user);
  }

  /**
   * Renueva la sesión a partir de un JWT propio aún válido.
   * Útil para extender la sesión sin re-verificar contra Firebase.
   */
  async refresh(token: string): Promise<AuthResult> {
    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Token inválido o expirado.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user || !user.isActive || user.status === 'DISABLED') {
      throw new UnauthorizedException('Usuario inactivo o no encontrado.');
    }

    return this.buildAuthResult(user);
  }

  /**
   * Login de DESARROLLO: emite un JWT para un usuario existente por email,
   * sin pasar por Firebase. Deshabilitado en producción salvo que se
   * active explícitamente con ALLOW_DEV_LOGIN=true (ver env.validation.ts).
   * Pensado para probar el sistema cuando el reloj del entorno bloquea la
   * verificación de Firebase contra Google, o para desarrollo local sin
   * login real, o para un ambiente de demo temporal sin Firebase configurado.
   */
  async devLogin(dto: {
    email?: string;
    supplierId?: string;
  }): Promise<AuthResult> {
    const isProduction =
      this.config.get('NODE_ENV', { infer: true }) === 'production';
    const devLoginAllowed =
      this.config.get('ALLOW_DEV_LOGIN', { infer: true }) === 'true';
    if (isProduction && !devLoginAllowed) {
      throw new ForbiddenException(
        'El login de desarrollo está deshabilitado en producción.',
      );
    }
    if (isProduction && devLoginAllowed) {
      this.logger.warn(
        '[DEV] dev-login habilitado en producción vía ALLOW_DEV_LOGIN=true. ' +
          'Desactivar en cuanto Firebase esté configurado.',
      );
    }

    const user = dto.supplierId
      ? await this.findOrCreateProviderUser(dto.supplierId)
      : dto.email
        ? await this.prisma.user.findUnique({
            where: { email: dto.email.toLowerCase() },
          })
        : null;

    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado.');
    }
    if (!user.isActive || user.status === 'DISABLED') {
      throw new UnauthorizedException('Tu cuenta está desactivada.');
    }
    this.logger.warn(`[DEV] Login de desarrollo emitido para ${user.email}.`);
    return this.gateTwoFactor(user);
  }

  /**
   * Busca el usuario PROVIDER de un proveedor; si no existe, lo crea al vuelo
   * (solo para el portal de demo). Cada supplier tiene a lo sumo un PROVIDER
   * (supplierId es @unique en User).
   */
  private async findOrCreateProviderUser(supplierId: string): Promise<User> {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: supplierId, deletedAt: null },
      select: { id: true, organizationId: true, name: true, rfc: true },
    });
    if (!supplier) {
      throw new UnauthorizedException('Proveedor no encontrado.');
    }

    const existing = await this.prisma.user.findFirst({
      where: { supplierId, role: 'PROVIDER' },
    });
    if (existing) return existing;

    return this.prisma.user.create({
      data: {
        firebaseUid: `dev-provider-${supplier.id}`,
        organizationId: supplier.organizationId,
        role: 'PROVIDER',
        email: `proveedor.${supplier.rfc.toLowerCase()}@demo.royaltica.mx`,
        name: supplier.name,
        isActive: true,
        status: 'ACTIVE',
        permissions: [],
        supplierId: supplier.id,
      },
    });
  }

  /** Devuelve el perfil completo del usuario autenticado (GET /auth/me). */
  async getProfile(userId: string): Promise<AuthResult['user']> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('Usuario no encontrado.');
    return this.toPublicUser(user);
  }

  /**
   * Emite la sesión completa para un usuario ya verificado (la usa el
   * TwoFactorService al completar el segundo factor).
   */
  async issueSession(userId: string): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive || user.status === 'DISABLED') {
      throw new UnauthorizedException('Usuario inactivo o no encontrado.');
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    void this.activity.record({
      organizationId: user.organizationId,
      userId: user.id,
      action: 'LOGIN_2FA_COMPLETED',
      entityType: 'User',
      entityId: user.id,
    });
    return this.buildAuthResult(user);
  }

  /**
   * Si el usuario tiene 2FA activo, NO emite la sesión: devuelve un token
   * temporal (5 min) que solo sirve para POST /auth/2fa/complete.
   */
  private gateTwoFactor(user: User): AuthResult {
    void this.activity.record({
      organizationId: user.organizationId,
      userId: user.id,
      action: user.totpEnabled ? 'LOGIN_2FA_PENDING' : 'LOGIN_SUCCESS',
      entityType: 'User',
      entityId: user.id,
    });
    if (!user.totpEnabled) return this.buildAuthResult(user);
    return {
      accessToken: '',
      expiresIn: '5m',
      twoFactorRequired: true,
      tempToken: this.jwt.sign({ sub: user.id, twofa: true }, { expiresIn: '5m' }),
      user: this.toPublicUser(user),
    };
  }

  // ── helpers ───────────────────────────────────────────────

  private resolvePermissions(user: User): string[] {
    const isFullAccess = FULL_ACCESS_ROLES.includes(
      user.role as (typeof FULL_ACCESS_ROLES)[number],
    );
    return isFullAccess ? [WILDCARD_PERMISSION] : user.permissions;
  }

  private toPublicUser(user: User): AuthResult['user'] {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      organizationId: user.organizationId,
      permissions: this.resolvePermissions(user),
      supplierId: user.supplierId,
      avatarUrl: user.avatarUrl,
      totpEnabled: user.totpEnabled,
    };
  }

  private buildAuthResult(user: User): AuthResult {
    const payload: JwtPayload = {
      sub: user.id,
      firebaseUid: user.firebaseUid,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
      permissions: this.resolvePermissions(user),
      supplierId: user.supplierId,
    };

    const accessToken = this.jwt.sign(payload);
    const expiresIn = this.config.get('JWT_EXPIRES_IN', { infer: true });

    return { accessToken, expiresIn, user: this.toPublicUser(user) };
  }
}

/** Escape HTML mínimo para armar el correo de solicitud de acceso. */
function escape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
