/**
 * Inicializa PostHog en el frontend si VITE_POSTHOG_KEY esta definido.
 *
 * Se importa desde main.tsx. Import perezoso para no penalizar el bundle
 * cuando no esta configurado (Vite hace tree-shaking del else).
 *
 * En dev sin key es no-op; en prod sin key tambien (fail-open).
 */
export async function initPostHog(): Promise<void> {
  const key = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
  if (!key) return;

  try {
    const posthog = (await import('posthog-js')).default;
    posthog.init(key, {
      api_host:
        (import.meta.env.VITE_POSTHOG_HOST as string | undefined) ||
        'https://us.i.posthog.com',
      person_profiles: 'identified_only',
      capture_pageview: true,
      capture_pageleave: true,
      autocapture: true,
    });
  } catch (err) {
    // No-op silencioso: si posthog-js no esta instalado, la app funciona.
    // eslint-disable-next-line no-console
    console.warn('[posthog] SDK no disponible:', err);
  }
}
