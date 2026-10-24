import { describe, it, expect } from 'vitest';
import { cuentaDesdeApi } from './carteraReal.ts';
import { segmentoDe, planConfig, diagnosticoDe, comportamientoDe, gestion } from './mockV1.ts';
import { construirPlan } from './plan.tsx';
import type { PortfolioCustomer } from '../../../../services/apiClient.ts';

const DIA = 86_400_000;
const hoy = new Date();
const enDias = (n: number) =>
  new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate()) + n * DIA).toISOString();

const base: PortfolioCustomer = {
  id: 'uuid-1',
  externalId: null,
  name: 'Cliente Real SA',
  rfc: 'CRS010101AB1',
  contact: 'Lic. Pérez',
  email: null,
  phone: null,
  financeContactName: 'Tesorería',
  financeContactEmail: null,
  financeContactPhone: '+5215512345678',
  doNotContact: false,
  doNotContactReason: null,
  score: null,
  agent: { id: 'ag', name: 'Ana Robles' },
  pending: [
    { id: 'i1', folio: 'F-1', total: 1000, currency: 'MXN', date: enDias(-35), dueDate: enDias(-5) },
    { id: 'i2', folio: 'F-2', total: 500, currency: 'MXN', date: enDias(-2), dueDate: enDias(28) },
  ],
  history: [],
};

describe('cartera real → formato de la pantalla', () => {
  it('cliente real nuevo: factura más antigua como principal, días reales y valores neutros', () => {
    const c = cuentaDesdeApi(base);
    expect(c.id).toBe('uuid-1');
    expect(c.dbId).toBe('uuid-1');
    expect(c.folio).toBe('F-1');
    expect(c.dias).toBe(5); // vencida hace 5 días
    expect(c.facturasExtra?.map((f) => f.folio)).toEqual(['F-2']);
    expect(c.finanzas?.telefono).toBe('+5215512345678');
    expect(c.canal).toBe('WhatsApp');
    expect(c.ciudad).toBe('—');
    expect(segmentoDe(c.historial, c.promesas).segmento).toBe('nuevo');
  });

  it('cliente de prueba (demo:k01): conserva el id del prototipo y sus datos sin backend', () => {
    const c = cuentaDesdeApi({ ...base, externalId: 'demo:k01', name: 'Distribuidora del Norte' });
    expect(c.id).toBe('k01');
    expect(c.dbId).toBe('uuid-1');
    expect(c.ciudad).toBe('Monterrey');
  });

  it('pidió no ser contactado → no contactable con su motivo', () => {
    const c = cuentaDesdeApi({ ...base, doNotContact: true, doNotContactReason: 'Disputa abierta' });
    expect(c.contactable).toBe(false);
    expect(c.motivo).toBe('Disputa abierta');
  });

  it('un cliente cargado por CSV que NO existe en el prototipo no rompe plan, segmento ni bitácora', () => {
    const c = cuentaDesdeApi({ ...base, name: 'Ferretería La Prueba', history: [0, 3, -1] });
    expect(() => {
      const seg = diagnosticoDe(c).segmento;
      construirPlan({ ...planConfig(c, seg), enviados: [] });
      comportamientoDe(c);
      gestion('2026-10-19', '10:00', c.cliente, 'Enviado', undefined, c);
    }).not.toThrow();
  });
});
