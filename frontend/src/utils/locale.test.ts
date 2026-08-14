import { describe, expect, it } from 'vitest';
import { DEFAULT_CURRENCY, DEFAULT_LOCALE, getCurrencyFormatter, getDateFormatter } from './locale';

describe('getCurrencyFormatter', () => {
  it('usa el locale/currency de la organización cuando vienen definidos', () => {
    const fmt = getCurrencyFormatter('en-CA', 'CAD');
    const formatted = fmt.format(1234.5);
    expect(formatted).toContain('1,234.50');
  });

  it('cae a es-MX/MXN por defecto cuando la organización aún no tiene locale/currency (ej. antes de que resuelva /settings)', () => {
    const fmt = getCurrencyFormatter(null, undefined);
    expect(fmt.resolvedOptions().locale).toBe(DEFAULT_LOCALE);
    expect(fmt.resolvedOptions().currency).toBe(DEFAULT_CURRENCY);
  });
});

describe('getDateFormatter', () => {
  it('usa el locale dado', () => {
    const fmt = getDateFormatter('en-CA');
    expect(fmt.resolvedOptions().locale).toBe('en-CA');
  });

  it('cae a es-MX si no se pasa locale', () => {
    const fmt = getDateFormatter(undefined);
    expect(fmt.resolvedOptions().locale).toBe(DEFAULT_LOCALE);
  });
});
