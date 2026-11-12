import { parseFlexibleDate } from './date-parser.util';

const iso = (d: Date | null) => d?.toISOString().slice(0, 10) ?? null;

describe('parseFlexibleDate', () => {
  it('lee el formato de México: día/mes/año con año de 2 o 4 dígitos', () => {
    expect(iso(parseFlexibleDate('31/10/26'))).toBe('2026-10-31'); // el caso del archivo que fallaba
    expect(iso(parseFlexibleDate('31/10/2026'))).toBe('2026-10-31');
    expect(iso(parseFlexibleDate('1/2/2026'))).toBe('2026-02-01');
    expect(iso(parseFlexibleDate('31-10-2026'))).toBe('2026-10-31');
    expect(iso(parseFlexibleDate('31.10.2026'))).toBe('2026-10-31');
  });

  it('una fecha con barras NUNCA se lee como mes/día (formato de EE. UU.)', () => {
    expect(iso(parseFlexibleDate('05/11/2026'))).toBe('2026-11-05'); // 5 de noviembre, no 11 de mayo
  });

  it('lee año-mes-día (ISO), con o sin hora', () => {
    expect(iso(parseFlexibleDate('2026-10-31'))).toBe('2026-10-31');
    expect(iso(parseFlexibleDate('2026/10/31'))).toBe('2026-10-31');
    expect(iso(parseFlexibleDate('2026-10-31T18:30:00.000Z'))).toBe('2026-10-31');
  });

  it('las fechas de calendario quedan a medianoche UTC (no se corren un día)', () => {
    expect(parseFlexibleDate('31/10/2026')!.toISOString()).toBe('2026-10-31T00:00:00.000Z');
  });

  it('rechaza fechas imposibles o texto que no es fecha', () => {
    expect(parseFlexibleDate('31/02/2026')).toBeNull();
    expect(parseFlexibleDate('15/13/2026')).toBeNull();
    expect(parseFlexibleDate('pronto')).toBeNull();
    expect(parseFlexibleDate('')).toBeNull();
  });
});
