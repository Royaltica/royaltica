/**
 * Utilidades de formateo regional (locale/moneda) por tenant. Royáltica es
 * multi-tenant: cada organización configura su `locale`/`currency` (ver
 * `OrgSettings` en apiClient.ts). Por defecto todo cae a es-MX/MXN, así que
 * las organizaciones mexicanas existentes no cambian de comportamiento
 * aunque aún no tengan estos campos cargados (ej. antes de que resuelva el
 * fetch de settings).
 */

export const DEFAULT_LOCALE = 'es-MX';
export const DEFAULT_CURRENCY = 'MXN';

/** Locales soportados hoy (Tradespace suma en-CA / fr-CA para Quebec). */
export const SUPPORTED_LOCALES = ['es-MX', 'en-CA', 'fr-CA'] as const;
export const SUPPORTED_CURRENCIES = ['MXN', 'CAD'] as const;

/**
 * Formateador de moneda para un locale/currency dado. Usar en vez de
 * instanciar `Intl.NumberFormat('es-MX', ...)` directamente en cada
 * componente, para que el valor real venga de la organización.
 */
export function getCurrencyFormatter(
  locale: string | null | undefined,
  currency: string | null | undefined,
): Intl.NumberFormat {
  return new Intl.NumberFormat(locale || DEFAULT_LOCALE, {
    style: 'currency',
    currency: currency || DEFAULT_CURRENCY,
  });
}

/** Formateador de fechas para un locale dado (fallback a es-MX). */
export function getDateFormatter(
  locale: string | null | undefined,
  options?: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(locale || DEFAULT_LOCALE, options);
}
