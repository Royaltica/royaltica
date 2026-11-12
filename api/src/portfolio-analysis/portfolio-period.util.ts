/**
 * Periodos del análisis de cartera. Todos son de calendario y en UTC, con
 * fin EXCLUSIVO ([from, to)):
 *  - QUINCENAL: del 1 al 15 y del 16 al fin de mes.
 *  - MENSUAL:   mes calendario.
 *  - BIMESTRAL: ene-feb, mar-abr, may-jun, jul-ago, sep-oct, nov-dic.
 */
export const REPORT_FREQUENCIES = ['QUINCENAL', 'MENSUAL', 'BIMESTRAL'] as const;
export type ReportFrequency = (typeof REPORT_FREQUENCIES)[number];
export const DEFAULT_REPORT_FREQUENCY: ReportFrequency = 'MENSUAL';

export interface Period {
  from: Date;
  to: Date;
  label: string;
}

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d));

export function isReportFrequency(v: unknown): v is ReportFrequency {
  return typeof v === 'string' && (REPORT_FREQUENCIES as readonly string[]).includes(v);
}

/** Periodo (de la frecuencia dada) que CONTIENE la fecha `ref`. */
export function periodContaining(freq: ReportFrequency, ref: Date): Period {
  const y = ref.getUTCFullYear();
  const m = ref.getUTCMonth();
  const d = ref.getUTCDate();
  if (freq === 'QUINCENAL') {
    if (d <= 15) {
      return { from: utc(y, m, 1), to: utc(y, m, 16), label: `1 al 15 de ${MESES[m]} ${y}` };
    }
    const last = utc(y, m + 1, 0).getUTCDate();
    return {
      from: utc(y, m, 16),
      to: utc(y, m + 1, 1),
      label: `16 al ${last} de ${MESES[m]} ${y}`,
    };
  }
  if (freq === 'MENSUAL') {
    return { from: utc(y, m, 1), to: utc(y, m + 1, 1), label: `${MESES[m]} ${y}` };
  }
  const start = m - (m % 2);
  return {
    from: utc(y, start, 1),
    to: utc(y, start + 2, 1),
    label: `${MESES[start]}-${MESES[start + 1]} ${y}`,
  };
}

/** El periodo inmediatamente anterior a `p`. */
export function previousPeriod(freq: ReportFrequency, p: Period): Period {
  return periodContaining(freq, new Date(p.from.getTime() - 86_400_000));
}

/**
 * Último periodo YA CERRADO a la fecha `now` (el que termina en o antes de
 * hoy). Es el que reporta el cron: nunca se analiza un periodo a medias.
 */
export function lastClosedPeriod(freq: ReportFrequency, now: Date): Period {
  return previousPeriod(freq, periodContaining(freq, now));
}
