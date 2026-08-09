/**
 * Clasificación DETERMINISTA de la respuesta de un cliente a un recordatorio
 * de cobranza. Es intencionalmente un motor de reglas (no un LLM): el estado
 * financiero nunca debe depender de la interpretación de un modelo.
 *
 * La IA, cuando se usa en cobranza, redacta el mensaje saliente a partir de
 * cifras ya calculadas; NUNCA decide si alguien pagó. Esta separación es la
 * que permite auditar por qué el sistema clasificó un mensaje como lo hizo.
 *
 * Nota: `whatsapp-webhook.service.ts` tiene hoy su propia copia de estas
 * listas. Se dejó intacta a propósito para no chocar con trabajo en curso;
 * unificarla contra este util es un follow-up pendiente.
 */

/** Qué quiso decir el cliente, según las reglas de abajo. */
export type CustomerIntent = 'PAYMENT_CLAIMED' | 'CUSTOMER_REPLY';

/**
 * Palabras (sin acentos, en minúsculas) que sugieren que el cliente afirma
 * haber pagado. Coincidencia por inclusión: explicable y auditable.
 */
export const PAYMENT_HINTS = [
  'ya pague',
  'ya lo pague',
  'pague',
  'pagado',
  'pagamos',
  'pago realizado',
  'realice el pago',
  'hice el pago',
  'hice la transferencia',
  'transferi',
  'transferencia',
  'deposit', // deposité / depósito / depositado
  'liquid', // liquidé / liquidado
  'abone', // aboné
  'saldado',
  'cubierto',
  'ya quedo',
  'ya esta pagada',
] as const;

/**
 * Negaciones que invalidan una aparente afirmación de pago.
 * "no he pagado" contiene "pague"… pero claramente no es un pago.
 */
export const NEGATIONS = [
  'no ',
  'aun no',
  'todavia no',
  'no he',
  'no puedo',
  'cuando',
] as const;

/**
 * Frases que exigen intervención humana inmediata, sin importar el resto del
 * mensaje. Son de tolerancia cero por diseño: en cobranza, dejar que un bot
 * conteste un tema legal o una queja formal es un riesgo real, así que aquí
 * se prefiere escalar de más y no de menos.
 */
export const ESCALATION_HINTS = [
  'abogado',
  'demanda',
  'demandar',
  'legal',
  'juridico',
  'queja',
  'profeco',
  'condusef',
  'acoso',
  'hostigamiento',
  'denuncia',
  'fraude',
  'no debo',
  'no reconozco',
  'esta mal',
  'error en el monto',
  'hablar con una persona',
  'hablar con alguien',
] as const;

/** Normaliza a minúsculas y sin acentos, para comparar de forma estable. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

export interface IntentResult {
  intent: CustomerIntent;
  /** Palabra que disparó la clasificación de pago (null si no aplica). */
  matched: string | null;
  /** true si el mensaje debe pasar a un humano de inmediato. */
  needsHuman: boolean;
  /** Palabra que disparó el escalamiento (null si no aplica). */
  escalationMatch: string | null;
}

/**
 * Regla determinista: ¿el mensaje afirma un pago, y necesita a un humano?
 *
 * El escalamiento se evalúa de forma INDEPENDIENTE de la intención: un
 * mensaje puede afirmar un pago y aun así requerir intervención humana
 * (p. ej. "ya pagué, y si insisten hablo con mi abogado").
 */
export function classifyIntent(text: string): IntentResult {
  const n = normalize(text);

  const escalationMatch = ESCALATION_HINTS.find((h) => n.includes(h)) ?? null;
  const matched = PAYMENT_HINTS.find((h) => n.includes(h)) ?? null;
  const negated = NEGATIONS.some((neg) => n.includes(neg));

  const claimsPayment = Boolean(matched) && !negated;

  return {
    intent: claimsPayment ? 'PAYMENT_CLAIMED' : 'CUSTOMER_REPLY',
    matched: claimsPayment ? matched : null,
    needsHuman: escalationMatch !== null,
    escalationMatch,
  };
}
