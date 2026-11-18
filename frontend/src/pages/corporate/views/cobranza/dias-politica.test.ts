import { describe, expect, it } from 'vitest';
import { diasDePolitica, fechasDePolitica, VIGENCIA_DIAS } from './dias-politica';

const NOW = new Date('2026-11-18T16:00:00Z');
const ZONE = 'America/Mexico_City';
const LABORABLES = [true, true, true, true, true, false, false];

describe('Calendario de la política', () => {
  it('guarda exclusiones para los fines de semana y recupera la selección desde fechas', () => {
    const dates = fechasDePolitica([], LABORABLES, ZONE, NOW);
    expect(dates.length).toBeGreaterThan(100);
    expect(diasDePolitica(dates, ZONE, NOW)).toEqual(LABORABLES);
    expect(diasDePolitica(dates, ZONE, new Date(NOW.getTime() + 90 * 86_400_000))).toEqual(LABORABLES);
    const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: ZONE });
    expect(dates.every((d) => ['Sat', 'Sun'].includes(weekday.format(new Date(d))))).toBe(true);
  });

  it('conserva las exclusiones puntuales y las fechas fuera de la vigencia', () => {
    const manual = ['2026-12-25T18:00:00.000Z', '2028-01-03T18:00:00.000Z'];
    expect(fechasDePolitica(manual, LABORABLES, ZONE, NOW)).toEqual(expect.arrayContaining(manual));
    expect(diasDePolitica(manual, ZONE, NOW)).toEqual(Array(7).fill(true));
    const vieja = '2025-12-25T18:00:00.000Z';
    expect(fechasDePolitica([vieja, ...manual], LABORABLES, ZONE, NOW)).not.toContain(vieja);
  });

  it('habilitar un día antes bloqueado elimina sus exclusiones dentro del periodo', () => {
    const weekdays = fechasDePolitica([], LABORABLES, ZONE, NOW);
    const allDays = fechasDePolitica(weekdays, Array(7).fill(true), ZONE, NOW);
    expect(allDays).toEqual([]);
  });

  it.each(['America/New_York', 'Asia/Tokyo', 'Pacific/Kiritimati'])('respeta la fecha local y el cambio de horario en %s', (zone) => {
    const dates = fechasDePolitica([], LABORABLES, zone, new Date('2026-03-07T23:30:00Z'));
    expect(diasDePolitica(dates, zone, new Date('2026-03-07T23:30:00Z'))).toEqual(LABORABLES);
    const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: zone });
    expect(dates.every((d) => ['Sat', 'Sun'].includes(weekday.format(new Date(d))))).toBe(true);
  });

  it('rechaza dejar todos los días bloqueados', () => {
    expect(() => fechasDePolitica([], Array(7).fill(false), ZONE, NOW)).toThrow('al menos un día');
  });

  it('no envía más fechas que las admitidas por el endpoint', () => {
    const existing = Array.from({ length: 366 }, (_, i) => new Date(Date.UTC(2030, 0, 1 + i, 18)).toISOString());
    expect(() => fechasDePolitica(existing, LABORABLES, ZONE, NOW)).toThrow('366');
    expect(VIGENCIA_DIAS).toBe(365);
  });
});
