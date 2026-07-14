import type { UsageFeature } from '@prisma/client';

/**
 * Estimación de costos operativos en pesos mexicanos.
 *
 * Las tarifas son aproximadas y sirven para el panel de cost tracking del
 * SUPERADMIN (visibilidad de rentabilidad por cliente), NO para contabilidad
 * formal. Ajusta los valores aquí si cambian los precios de los proveedores o
 * el tipo de cambio. Si en el futuro se quiere precisión contable, mover
 * `USD_TO_MXN` a una variable de entorno o a un servicio de tipo de cambio.
 */

/** Tipo de cambio aproximado USD→MXN para estimaciones. */
const USD_TO_MXN = 18.5;

// Gemini 2.0 Flash — USD por millón de tokens (entrada / salida).
const GEMINI_INPUT_USD_PER_M = 0.1;
const GEMINI_OUTPUT_USD_PER_M = 0.4;

// Resend — ~$20 USD por 50,000 correos ≈ $0.0004 USD por correo.
const EMAIL_USD_PER_UNIT = 0.0004;

// Google Cloud Storage (Standard) — ~$0.020 USD por GB-mes.
// La subida se cobra como el costo mensual de almacenar esos bytes.
const GCS_USD_PER_GB_MONTH = 0.02;

export interface UsageCostInput {
  /** Medida genérica del evento: tokens, bytes o conteo según el feature. */
  units?: number;
  /** Tokens de entrada (solo features Gemini, para costo preciso). */
  inputTokens?: number;
  /** Tokens de salida (solo features Gemini). */
  outputTokens?: number;
}

/** Redondea a 6 decimales (los costos por evento son fracciones de centavo). */
const round6 = (n: number): number => Math.round(n * 1e6) / 1e6;

/**
 * Estima el costo en MXN de un evento de uso según su feature.
 * Features sin costo directo por ahora (SAT_QUERY, JOB_RUN, FACTORAJE_API)
 * devuelven 0 pero se registran igual para tener el conteo de volumen.
 */
export function estimateCostMxn(
  feature: UsageFeature,
  input: UsageCostInput,
): number {
  const { units = 0, inputTokens = 0, outputTokens = 0 } = input;
  let usd = 0;

  switch (feature) {
    case 'GEMINI_AUDIT':
    case 'GEMINI_CHAT':
      usd =
        (inputTokens / 1_000_000) * GEMINI_INPUT_USD_PER_M +
        (outputTokens / 1_000_000) * GEMINI_OUTPUT_USD_PER_M;
      break;
    case 'EMAIL_SENT':
      usd = units * EMAIL_USD_PER_UNIT;
      break;
    case 'GCS_UPLOAD':
      // units = bytes subidos.
      usd = (units / 1_000_000_000) * GCS_USD_PER_GB_MONTH;
      break;
    case 'SAT_QUERY':
    case 'JOB_RUN':
    case 'FACTORAJE_API':
      usd = 0;
      break;
  }

  return round6(usd * USD_TO_MXN);
}
