/**
 * Heurística local de "fuzzy match" por solape de tokens normalizados: no hay
 * librería de fuzzy-matching instalada (ver constraints del sandbox, mismo
 * criterio que csv-parser.util.ts) así que esto es intencionalmente simple —
 * suficiente para reconocer "ACME INC PAYMENT" contra un cliente "Acme Inc."
 * sin falsos positivos ruidosos por palabras muy comunes.
 */
const STOPWORDS = new Set([
  'inc',
  'ltd',
  'llc',
  'corp',
  'corporation',
  'co',
  'the',
  'and',
  'company',
  'canada',
  'ca',
  'payment',
  'pago',
  'transfer',
  'deposit',
]);

/** Tokeniza: minúsculas, quita puntuación, descarta tokens cortos/ruidosos. */
export function normalizeTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

/**
 * Fracción (0-1) de los tokens del nombre del cliente que aparecen también
 * en la descripción de la transacción. 0 si el nombre no aporta tokens
 * útiles (p. ej. solo stopwords) para evitar falsos positivos.
 */
export function tokenOverlap(description: string, customerName: string): number {
  const nameTokens = normalizeTokens(customerName);
  if (nameTokens.length === 0) return 0;
  const descTokens = new Set(normalizeTokens(description));
  const matched = nameTokens.filter((t) => descTokens.has(t)).length;
  return matched / nameTokens.length;
}
