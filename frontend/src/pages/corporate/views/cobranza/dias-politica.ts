const DIA = 86_400_000;
export const VIGENCIA_DIAS = 365;

function fechaLocal(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const part = (key: string) => parts.find((p) => p.type === key)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function calendario(timezone: string, now: Date) {
  const inicio = Date.parse(`${fechaLocal(now, timezone)}T12:00:00Z`);
  return Array.from({ length: VIGENCIA_DIAS }, (_, i) => {
    const dia = new Date(inicio + i * DIA);
    const fecha = dia.toISOString().slice(0, 10);
    // La exclusión se compara en la zona de la política, no en la del navegador.
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(dia);
    const n = (key: string) => Number(parts.find((p) => p.type === key)!.value);
    const localAsUtc = Date.UTC(n('year'), n('month') - 1, n('day'), n('hour'), n('minute'));
    return { fecha, semana: (dia.getUTCDay() + 6) % 7, iso: new Date(dia.getTime() + (dia.getTime() - localAsUtc)).toISOString() };
  });
}

export function diasDePolitica(blackoutDates: string[], timezone: string, now = new Date()): boolean[] {
  const fechas = new Set(blackoutDates.map((d) => fechaLocal(new Date(d), timezone)));
  // Cuatro semanas permiten distinguir un patrón de un festivo aislado y
  // recuperar la selección al día siguiente sin exigir otro año de fechas.
  const dias = calendario(timezone, now).slice(0, 28);
  return Array.from({ length: 7 }, (_, i) => dias.some((d) => d.semana === i && !fechas.has(d.fecha)));
}

export function fechasDePolitica(blackoutDates: string[], permitidos: boolean[], timezone: string, now = new Date()): string[] {
  if (permitidos.length !== 7 || !permitidos.some(Boolean)) throw new Error('Permite al menos un día con mensajes.');
  const dias = calendario(timezone, now);
  const anteriores = diasDePolitica(blackoutDates, timezone, now);
  const periodo = new Map(dias.map((d) => [d.fecha, d]));
  const fechas = new Map<string, string>();
  for (const iso of blackoutDates) {
    const key = fechaLocal(new Date(iso), timezone);
    if (key < dias[0].fecha) continue;
    const dia = periodo.get(key);
    if (!dia || anteriores[dia.semana] || !permitidos[dia.semana]) fechas.set(key, iso);
  }
  for (const dia of dias) if (!permitidos[dia.semana]) fechas.set(dia.fecha, dia.iso);
  if (fechas.size > 366) throw new Error('La política admite hasta 366 fechas sin mensajes. Revisa las exclusiones existentes.');
  return [...fechas.values()].sort();
}
