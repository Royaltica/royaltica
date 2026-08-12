import { describe, expect, it } from 'vitest';
import { getPriorityInfo } from './format';

describe('getPriorityInfo', () => {
  // Antes de este fix, la fecha de referencia estaba hardcodeada a
  // '2024-04-27' en vez de usar la fecha real — con eso, cualquier factura
  // salía "Urgente" sin importar su vencimiento real, porque la diferencia
  // de días contra esa fecha fija siempre terminaba siendo enorme. Este test
  // fija "hoy" explícitamente para no depender de cuándo se corra la suite.
  const today = new Date('2026-08-11');

  it('marca como Óptimo una fecha dentro de los próximos 10 días', () => {
    const info = getPriorityInfo('2026-08-15', today);
    expect(info.label).toBe('Óptimo');
    expect(info.score).toBe(1);
  });

  it('marca como En Tiempo entre 11 y 20 días', () => {
    const info = getPriorityInfo('2026-08-25', today);
    expect(info.label).toBe('En Tiempo');
    expect(info.score).toBe(2);
  });

  it('marca como Media Alta entre 21 y 30 días', () => {
    const info = getPriorityInfo('2026-09-05', today);
    expect(info.label).toBe('Media Alta');
    expect(info.score).toBe(3);
  });

  it('marca como Urgente después de 30 días', () => {
    const info = getPriorityInfo('2026-12-01', today);
    expect(info.label).toBe('Urgente');
    expect(info.score).toBe(4);
  });

  it('usa la fecha real de hoy si no se pasa una explícita (regresión del bug de fecha hardcodeada)', () => {
    // Una factura que vence HOY debería salir Óptimo siempre, sin importar
    // en qué año se corra la suite. Con el bug viejo (today fijo en
    // 2024-04-27), esto fallaba porque cualquier fecha posterior a 2024
    // se veía a cientos de días de distancia.
    const todayStr = new Date().toISOString().slice(0, 10);
    const info = getPriorityInfo(todayStr);
    expect(info.label).toBe('Óptimo');
  });
});
