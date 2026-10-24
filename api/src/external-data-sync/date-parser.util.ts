/**
 * Lee la fecha de una celda de CSV. Formatos aceptados (en este orden):
 *  - 2026-10-31 · 2026-10-31T10:00:00Z   (ISO)
 *  - 2026/10/31
 *  - 31/10/2026 · 31-10-2026 · 31.10.2026  (día/mes/año: así se escribe en México)
 *  - 31/10/26                              (año de 2 dígitos = 20xx)
 *
 * Una fecha con barras NUNCA se lee como mes/día (formato de EE. UU.): "05/11/2026"
 * es 5 de noviembre. Antes se usaba `new Date(texto)`, que la leía como 11 de
 * mayo sin avisar, y rechazaba "31/10/26". Devuelve null si no es una fecha real
 * (31/02, mes 13…). Las fechas de calendario se guardan a medianoche UTC.
 */
export function parseFlexibleDate(raw: string): Date | null {
  const s = raw.trim();
  if (!s) return null;

  const iso = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s].*)?$/.exec(s);
  const dmy = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(s);

  let y: number, m: number, d: number;
  if (iso) {
    [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
    // ISO con hora y zona (…T10:00:00Z): se respeta tal cual.
    if (s.length > 10 && /[T\s]/.test(s.slice(10, 11))) {
      const t = new Date(s);
      if (!Number.isNaN(t.getTime())) return t;
    }
  } else if (dmy) {
    d = Number(dmy[1]);
    m = Number(dmy[2]);
    y = Number(dmy[3]);
    if (dmy[3].length === 2) y += 2000;
  } else {
    return null;
  }

  const date = new Date(Date.UTC(y, m - 1, d));
  // Rechaza fechas imposibles (31/02 se "corrige" a marzo en vez de fallar).
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return date;
}
