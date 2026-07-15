import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from 'node:crypto';
import { authenticator } from 'otplib';
import { PrismaService } from '../common/prisma/prisma.service';
import type { Env } from '../config/env.validation';
import { AuthService, type AuthResult } from './auth.service';

export interface TwoFactorSetup {
  /** Secreto base32 para captura manual en la app autenticadora. */
  secret: string;
  /** URI otpauth:// para generar el QR (Google Authenticator, Authy, 1Password…). */
  otpauthUrl: string;
}

interface TempTokenPayload {
  sub: string;
  twofa: true;
}

/**
 * Autenticación de dos factores TOTP (RFC 6238), compatible con cualquier
 * app autenticadora. El secreto se guarda CIFRADO en la base de datos con
 * AES-256-GCM; la llave se deriva de TOTP_ENCRYPTION_KEY (o JWT_SECRET como
 * respaldo) — nunca se almacena en claro ni sale en logs.
 */
@Injectable()
export class TwoFactorService {
  private readonly logger = new Logger(TwoFactorService.name);
  private readonly encKey: Buffer;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
    private readonly auth: AuthService,
  ) {
    const material: string =
      process.env.TOTP_ENCRYPTION_KEY ??
      this.config.get('JWT_SECRET', { infer: true }) ??
      '';
    if (!material) throw new Error('JWT_SECRET requerido para cifrar secretos TOTP.');
    this.encKey = scryptSync(material, 'royaltica-totp-v1', 32);
    // Tolerancia de ±2 ventanas (±60s) por deriva de reloj entre el teléfono
    // del usuario y el servidor (en la nube el reloj puede ir unos segundos
    // adelantado/atrasado). ±60s sigue siendo seguro y evita el falso
    // "código incorrecto" cuando el código en realidad es válido.
    authenticator.options = { window: 2 };
  }

  /** Genera (o regenera) el secreto y lo guarda cifrado, aún sin activar. */
  async setup(userId: string): Promise<TwoFactorSetup> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('Usuario no encontrado.');
    if (user.totpEnabled) {
      throw new BadRequestException(
        'El 2FA ya está activo. Desactívalo primero para regenerar el secreto.',
      );
    }

    const secret = authenticator.generateSecret();
    await this.prisma.user.update({
      where: { id: userId },
      data: { totpSecret: this.encrypt(secret) },
    });

    return {
      secret,
      otpauthUrl: authenticator.keyuri(user.email, 'Royáltica', secret),
    };
  }

  /** Activa el 2FA tras verificar el primer código correcto. */
  async enable(userId: string, code: string): Promise<{ enabled: true }> {
    const secret = await this.secretFor(userId);
    if (!secret) {
      throw new BadRequestException('Primero genera el secreto con /auth/2fa/setup.');
    }
    if (!authenticator.verify({ token: code, secret })) {
      throw new UnauthorizedException('Código incorrecto. Intenta de nuevo.');
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { totpEnabled: true },
    });
    this.logger.log(`2FA activado para el usuario ${userId}.`);
    return { enabled: true };
  }

  /** Desactiva el 2FA; exige un código vigente para evitar desactivación por robo de sesión. */
  async disable(userId: string, code: string): Promise<{ enabled: false }> {
    const secret = await this.secretFor(userId);
    if (!secret || !authenticator.verify({ token: code, secret })) {
      throw new UnauthorizedException('Código incorrecto.');
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { totpEnabled: false, totpSecret: null },
    });
    this.logger.warn(`2FA desactivado para el usuario ${userId}.`);
    return { enabled: false };
  }

  /**
   * Segundo paso del login: valida el token temporal (scope 2FA, 5 min)
   * y el código TOTP; si ambos son correctos emite la sesión completa.
   */
  async completeLogin(tempToken: string, code: string): Promise<AuthResult> {
    let payload: TempTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<TempTokenPayload>(tempToken);
    } catch {
      throw new UnauthorizedException('El paso de verificación expiró. Vuelve a iniciar sesión.');
    }
    if (payload.twofa !== true) {
      throw new UnauthorizedException('Token inválido para este paso.');
    }

    const secret = await this.secretFor(payload.sub);
    if (!secret || !authenticator.verify({ token: code, secret })) {
      throw new UnauthorizedException('Código incorrecto.');
    }

    return this.auth.issueSession(payload.sub);
  }

  /** Token temporal (5 min) que SOLO sirve para completar el 2FA. */
  issueTempToken(userId: string): string {
    return this.jwt.sign({ sub: userId, twofa: true }, { expiresIn: '5m' });
  }

  // ── helpers ───────────────────────────────────────────────

  private async secretFor(userId: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { totpSecret: true },
    });
    return user?.totpSecret ? this.decrypt(user.totpSecret) : null;
  }

  private encrypt(plain: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.encKey, iv);
    const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    return `${iv.toString('base64')}.${cipher.getAuthTag().toString('base64')}.${enc.toString('base64')}`;
  }

  private decrypt(stored: string): string {
    const [iv, tag, data] = stored.split('.');
    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.encKey,
      Buffer.from(iv, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(data, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  }
}
