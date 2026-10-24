import { describe, it, expect } from 'vitest';
import { construirPlan } from './plan.tsx';
import type { PlanConfig } from './mockV1.ts';

// Cliente "olvidadizo" (plantilla completa) a 5 días de vencer: hoy le toca
// el Nivel 2 (día -7) y el siguiente es el Nivel 3 (día -3).
const base: PlanConfig = {
  hoy: -5,
  canal: 'WhatsApp',
  segmento: 'olvidadizo',
  desfase: 0,
  cuentaGrande: false,
  aclaraciones: false,
  resultados: {},
};

describe('plan ↔ WhatsApp', () => {
  it('sin envíos, el plan va por calendario: hoy toca el Nivel 2', () => {
    const { actual, proxima } = construirPlan(base);
    expect(actual?.id).toBe('N2');
    expect(proxima?.id).toBe('N3');
  });

  it('si el Nivel 2 ya salió por WhatsApp, queda hecho y el plan pasa al Nivel 3', () => {
    const { pasos, actual, proxima } = construirPlan({ ...base, enviados: ['N2'] });
    expect(pasos.find((p) => p.id === 'N2')?.estado).toBe('hecho');
    expect(actual).toBeUndefined(); // ya no hay nada pendiente hoy
    expect(proxima?.id).toBe('N3');
    expect(proxima?.faltan).toBe(2); // se activa cuando llegue su día
  });

  it('un nivel futuro mandado antes de tiempo también queda hecho', () => {
    const { pasos, actual } = construirPlan({ ...base, enviados: ['N3'] });
    expect(pasos.find((p) => p.id === 'N3')?.estado).toBe('hecho');
    expect(actual?.id).toBe('N2'); // el de hoy sigue pendiente
  });
});
