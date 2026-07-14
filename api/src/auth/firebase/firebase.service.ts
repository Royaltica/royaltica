import {
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type App, cert, getApps, initializeApp } from 'firebase-admin/app';
import {
  type Auth,
  type DecodedIdToken,
  type UserRecord,
  getAuth,
} from 'firebase-admin/auth';
import type { Env } from '../../config/env.validation';

/**
 * Encapsula el Firebase Admin SDK (API modular v12).
 *
 * Si las credenciales (FIREBASE_*) no están configuradas, el servicio
 * arranca en modo "no configurado": la app no truena al boot, pero
 * cualquier operación de auth devuelve 503 con un mensaje claro.
 * Así se puede desarrollar el resto del backend antes de tener el
 * archivo de cuenta de servicio de Google Cloud.
 */
@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);
  private app: App | null = null;

  constructor(private readonly config: ConfigService<Env, true>) {}

  onModuleInit(): void {
    const projectId = this.config.get('FIREBASE_PROJECT_ID', { infer: true });
    const clientEmail = this.config.get('FIREBASE_CLIENT_EMAIL', {
      infer: true,
    });
    const rawKey = this.config.get('FIREBASE_PRIVATE_KEY', { infer: true });

    if (!projectId || !clientEmail || !rawKey) {
      this.logger.warn(
        'Firebase Admin NO configurado (faltan FIREBASE_*). Las rutas de auth devolverán 503 hasta que se agreguen las credenciales.',
      );
      return;
    }

    // La private key suele venir con \n escapados en el .env
    const privateKey = rawKey.replace(/\\n/g, '\n');
    const existing = getApps();

    this.app =
      existing.length > 0 && existing[0]
        ? existing[0]
        : initializeApp({
            credential: cert({ projectId, clientEmail, privateKey }),
          });

    this.logger.log(`Firebase Admin inicializado (project: ${projectId}).`);
  }

  get isConfigured(): boolean {
    return this.app !== null;
  }

  private auth(): Auth {
    if (!this.app) {
      throw new ServiceUnavailableException(
        'Autenticación no disponible: Firebase Admin no está configurado en el servidor.',
      );
    }
    return getAuth(this.app);
  }

  /** Verifica un ID token de Firebase enviado por el cliente. */
  async verifyIdToken(idToken: string): Promise<DecodedIdToken> {
    try {
      return await this.auth().verifyIdToken(idToken, true);
    } catch {
      throw new UnauthorizedException('Firebase ID token inválido o expirado.');
    }
  }

  /**
   * Crea un usuario en Firebase (sin contraseña) para el flujo de invitación.
   * Si ya existe, devuelve el existente.
   */
  async createOrGetUser(
    email: string,
    displayName: string,
  ): Promise<UserRecord> {
    const auth = this.auth();
    try {
      return await auth.getUserByEmail(email);
    } catch {
      return auth.createUser({ email, displayName, emailVerified: false });
    }
  }

  /**
   * Genera el link que recibe el invitado por correo para definir su
   * contraseña por primera vez (usa el flujo de password reset de Firebase).
   */
  async generateInviteLink(email: string): Promise<string> {
    return this.auth().generatePasswordResetLink(email);
  }

  /** Desactiva (o reactiva) el acceso de un usuario en Firebase. */
  async setUserDisabled(uid: string, disabled: boolean): Promise<void> {
    await this.auth().updateUser(uid, { disabled });
  }

  /** Elimina el usuario en Firebase (al borrar una invitación, p. ej.). */
  async deleteUser(uid: string): Promise<void> {
    try {
      await this.auth().deleteUser(uid);
    } catch {
      // Si ya no existe, no es un error fatal para nuestro flujo.
      this.logger.warn(`No se pudo eliminar el usuario Firebase ${uid}.`);
    }
  }
}
