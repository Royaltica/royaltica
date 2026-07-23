import { Logger } from '@nestjs/common';

/**
 * Inicializa Sentry al ARRANQUE si SENTRY_DSN está configurada.
 *
 * Se llama desde main.ts antes de instanciar la app para que el SDK
 * pueda instrumentar HTTP + errores no capturados. Si el SDK no está
 * instalado o no hay DSN, es un no-op silencioso y la app arranca igual.
 *
 * Uso desde código de la app:
 *   import { captureException } from './common/sentry';
 *   captureException(err, { context: 'jobs.remind' });
 */

const logger = new Logger('Sentry');

// Import perezoso — así el arranque no falla si el paquete no está instalado.
type SentryNode = typeof import('@sentry/node');
let sentry: SentryNode | null = null;

export function initSentry(env: NodeJS.ProcessEnv): void {
  const dsn = env.SENTRY_DSN;
  if (!dsn) {
    logger.warn('Sentry NO configurado (falta SENTRY_DSN). Modo no-op.');
    return;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    sentry = require('@sentry/node') as SentryNode;
    sentry.init({
      dsn,
      environment:
        env.SENTRY_ENVIRONMENT ||
        env.NODE_ENV ||
        'development',
      release: env.SENTRY_RELEASE || undefined,
      tracesSampleRate: parseFloat(
        env.SENTRY_TRACES_SAMPLE_RATE ?? '0.1',
      ),
      // No enviamos body/headers para no filtrar PII.
      sendDefaultPii: false,
    });
    logger.log(
      `Sentry inicializado (env: ${sentry.getCurrentScope().getClient()?.getOptions().environment}).`,
    );
  } catch (err) {
    logger.warn(
      `No se pudo cargar @sentry/node — ejecuta "npm install @sentry/node" en /api. Detalle: ${(err as Error).message}`,
    );
    sentry = null;
  }
}

export function isSentryEnabled(): boolean {
  return sentry !== null;
}

export function captureException(
  err: unknown,
  context?: Record<string, unknown>,
): void {
  if (!sentry) return;
  try {
    sentry.captureException(err, context ? { extra: context } : undefined);
  } catch {
    /* ignorar: nunca romper el flujo por telemetría */
  }
}

export function setUser(
  user: { id: string; email?: string | null } | null,
): void {
  if (!sentry) return;
  try {
    sentry.setUser(user ? { id: user.id, email: user.email ?? undefined } : null);
  } catch {
    /* noop */
  }
}
