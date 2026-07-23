/**
 * Inicializa Sentry en el frontend si VITE_SENTRY_DSN está definido.
 *
 * Se importa desde main.tsx. Import perezoso para no penalizar el bundle
 * cuando no está configurado (Vite hace tree-shaking del else).
 *
 * En dev sin DSN es no-op; en prod sin DSN también (fail-open).
 */
export async function initSentryClient(): Promise<void> {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn) return;

  try {
    const Sentry = await import('@sentry/react');
    Sentry.init({
      dsn,
      environment:
        (import.meta.env.VITE_SENTRY_ENVIRONMENT as string | undefined) ||
        (import.meta.env.MODE === 'production' ? 'production' : 'development'),
      release: import.meta.env.VITE_SENTRY_RELEASE as string | undefined,
      tracesSampleRate: parseFloat(
        (import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE as string | undefined) ??
          '0.1',
      ),
      // Replay: útil para reproducir bugs en UI. Desactivado por defecto para
      // no inflar el bundle; el usuario lo activa desde Railway/Vercel env.
      replaysSessionSampleRate: parseFloat(
        (import.meta.env.VITE_SENTRY_REPLAY_SAMPLE_RATE as
          | string
          | undefined) ?? '0',
      ),
      replaysOnErrorSampleRate: 1.0,
    });
  } catch (err) {
    // No-op silencioso: si @sentry/react no está instalado, la app funciona.
    // eslint-disable-next-line no-console
    console.warn('[sentry] SDK no disponible:', err);
  }
}
