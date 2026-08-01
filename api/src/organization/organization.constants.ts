/**
 * Locales y monedas soportadas por tenant. Strings simples (no enum de
 * Prisma) para poder sumar locales nuevos sin otra migración; la validación
 * de valores permitidos vive aquí y se aplica a nivel de DTO/servicio.
 */
export const SUPPORTED_LOCALES = ['es-MX', 'en-CA', 'fr-CA'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const SUPPORTED_CURRENCIES = ['MXN', 'CAD'] as const;
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

export const DEFAULT_LOCALE: SupportedLocale = 'es-MX';
export const DEFAULT_CURRENCY: SupportedCurrency = 'MXN';

/**
 * White label (Tradespace): validación de colores de marca en hex.
 * Se valida a nivel de DTO; el valor se persiste tal cual (con "#").
 */
export const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;
