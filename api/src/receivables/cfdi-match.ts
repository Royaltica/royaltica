/**
 * Empate de un CFDI de venta con el cliente de la cartera. Funciones puras
 * (sin base de datos) para poder probarlas y reutilizarlas.
 *
 * Orden: 1) RFC exacto (salvo RFC genéricos del SAT), 2) nombre normalizado
 * igual (razón social o nombre comercial), 3) sugerencias por parecido.
 */

/** RFC genéricos: "público en general" y extranjero. No identifican a nadie. */
export const RFC_GENERICOS = new Set(['XAXX010101000', 'XEXX010101000']);

/** Persona moral (12) o física (13), formato SAT. */
const RFC_RE = /^[A-ZÑ&]{3,4}\d{6}[A-Z\d]{3}$/;

export const rfcValido = (rfc: string | null | undefined): boolean =>
  !!rfc && RFC_RE.test(rfc.trim().toUpperCase()) && !RFC_GENERICOS.has(rfc.trim().toUpperCase());

// Sufijos societarios y palabras que no distinguen a una empresa de otra.
const RUIDO = new Set([
  'sa', 'de', 'cv', 'sab', 'sapi', 'srl', 's', 'rl', 'sc', 'ac', 'del', 'la', 'el', 'los', 'las', 'y', 'e', 'en', 'c',
  'v', 'mi', 'sas', 'spr', 'sociedad', 'anonima', 'capital', 'variable', 'responsabilidad', 'limitada',
]);

/** Minúsculas, sin acentos ni puntuación, sin sufijos societarios. */
export function normalizarNombre(nombre: string | null | undefined): string {
  if (!nombre) return '';
  return tokens(nombre).join(' ');
}

function tokens(nombre: string): string[] {
  return nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    // "S.A.P.I." → "sapi", "C.V." → "cv": las siglas con punto quedan como una palabra.
    .replace(/\./g, '')
    .replace(/&/g, ' y ')
    .replace(/[^a-z0-9ñ ]/g, ' ')
    .split(/\s+/)
    .filter((t) => t && !RUIDO.has(t));
}

/** Parecido 0–1 entre dos nombres (Jaccard de palabras significativas). */
export function parecido(a: string, b: string): number {
  const ta = new Set(tokens(a));
  const tb = new Set(tokens(b));
  if (!ta.size || !tb.size) return 0;
  let comun = 0;
  for (const t of ta) if (tb.has(t)) comun++;
  return comun / (ta.size + tb.size - comun);
}

export type ClienteMatch = { id: string; name: string; legalName: string; rfc: string };

export type ResultadoMatch =
  | { tipo: 'rfc' | 'nombre'; cliente: ClienteMatch; sugerencias: [] }
  | { tipo: 'sin_match'; cliente: null; sugerencias: { cliente: ClienteMatch; parecido: number }[] };

/** A partir de qué parecido se sugiere un cliente (no se asigna solo). */
export const UMBRAL_SUGERENCIA = 0.34;

export function empatarCliente(
  rfcReceptor: string,
  nombreReceptor: string | null,
  clientes: ClienteMatch[],
): ResultadoMatch {
  const rfc = rfcReceptor.trim().toUpperCase();
  if (!RFC_GENERICOS.has(rfc)) {
    const porRfc = clientes.filter((c) => c.rfc?.trim().toUpperCase() === rfc);
    // Dos clientes con el mismo RFC es ambiguo: se deja a revisión con ambos como sugerencia.
    if (porRfc.length === 1) return { tipo: 'rfc', cliente: porRfc[0], sugerencias: [] };
    if (porRfc.length > 1) {
      return { tipo: 'sin_match', cliente: null, sugerencias: porRfc.map((c) => ({ cliente: c, parecido: 1 })) };
    }
  }

  const nombre = normalizarNombre(nombreReceptor);
  if (nombre) {
    const porNombre = clientes.filter(
      (c) => normalizarNombre(c.legalName) === nombre || normalizarNombre(c.name) === nombre,
    );
    if (porNombre.length === 1) return { tipo: 'nombre', cliente: porNombre[0], sugerencias: [] };
  }

  const sugerencias = nombreReceptor
    ? clientes
        .map((c) => ({ cliente: c, parecido: Math.max(parecido(nombreReceptor, c.legalName), parecido(nombreReceptor, c.name)) }))
        .filter((s) => s.parecido >= UMBRAL_SUGERENCIA)
        .sort((a, b) => b.parecido - a.parecido)
        .slice(0, 3)
    : [];
  return { tipo: 'sin_match', cliente: null, sugerencias };
}
