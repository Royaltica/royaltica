import { describe, expect, it } from 'vitest';
import type { Invoice, Supplier } from '../types';
import {
  calculateAuditScore,
  getAIRecommendation,
  getComplianceChecks,
  getSupplierChecklist,
  isInvoiceFullyValidated,
} from './format';

function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: 'INV-1',
    providerId: 'PROV-1',
    provider: 'Proveedor de prueba',
    amount: 10_000,
    date: '2026-08-01',
    status: 'pending',
    poNumber: 'PO-1',
    description: 'Factura de prueba',
    ...overrides,
  };
}

function makeSupplier(overrides: Partial<Supplier> = {}): Supplier {
  return {
    id: 'PROV-1',
    name: 'Proveedor de prueba',
    rfc: 'AAA010101AAA',
    contact: 'contacto@proveedor.com',
    isApproved: true,
    category: 'Servicios TI',
    priority: 'Media',
    legalName: 'Proveedor de Prueba SA de CV',
    activity: 'Consultoría',
    seniorityYears: 3,
    documents: [],
    ...overrides,
  };
}

describe('calculateAuditScore', () => {
  it('da 100 cuando no hay discrepancias y las 2 firmas están completas', () => {
    const inv = makeInvoice({ signatures: 2 });
    expect(calculateAuditScore(inv)).toBe(100);
  });

  it('penaliza el pilar de PO cuando hay DISCREPANCY', () => {
    const inv = makeInvoice({ forensicStatus: 'DISCREPANCY', signatures: 2 });
    const withoutIssue = calculateAuditScore(makeInvoice({ signatures: 2 }));
    expect(calculateAuditScore(inv)).toBeLessThan(withoutIssue);
  });

  it('da 0 en los pilares de PO e integridad cuando está BLOCKED', () => {
    const inv = makeInvoice({ forensicStatus: 'BLOCKED', signatures: 0 });
    expect(calculateAuditScore(inv)).toBe(0);
  });

  it('nunca excede 100', () => {
    const inv = makeInvoice({ signatures: 5 });
    expect(calculateAuditScore(inv)).toBeLessThanOrEqual(100);
  });
});

describe('isInvoiceFullyValidated', () => {
  it('es true solo si el status es audited/approved Y hay 2+ firmas', () => {
    expect(isInvoiceFullyValidated(makeInvoice({ status: 'audited', signatures: 2 }))).toBe(true);
    expect(isInvoiceFullyValidated(makeInvoice({ status: 'approved', signatures: 3 }))).toBe(true);
  });

  it('es false si falta alguna firma aunque el status sea audited', () => {
    expect(isInvoiceFullyValidated(makeInvoice({ status: 'audited', signatures: 1 }))).toBe(false);
  });

  it('es false si el status no es audited/approved aunque tenga firmas', () => {
    expect(isInvoiceFullyValidated(makeInvoice({ status: 'pending', signatures: 2 }))).toBe(false);
  });
});

describe('getComplianceChecks', () => {
  it('marca ok cuando el CFDI está Vigente ante el SAT', () => {
    const checks = getComplianceChecks(makeInvoice({ satStatus: 'Vigente' }));
    expect(checks[0].status).toBe('ok');
  });

  it('marca fail cuando el CFDI está Cancelado (no se debe pagar)', () => {
    const checks = getComplianceChecks(makeInvoice({ satStatus: 'Cancelado' }));
    expect(checks[0].status).toBe('fail');
    expect(checks[0].detail).toMatch(/no debe procederse con el pago/i);
  });

  it('marca warn cuando no se pudo verificar o no se encontró el folio', () => {
    expect(getComplianceChecks(makeInvoice({ satStatus: 'No Encontrado' })).forEach(c => expect(c.status).toBe('warn')));
    expect(getComplianceChecks(makeInvoice({ satStatus: 'No Verificado' })).forEach(c => expect(c.status).toBe('warn')));
  });

  it('marca pending cuando aún no se ha consultado', () => {
    const checks = getComplianceChecks(makeInvoice({ satStatus: undefined }));
    expect(checks[0].status).toBe('pending');
  });
});

describe('getSupplierChecklist', () => {
  it('cuenta factores + documentos validados sobre el total', () => {
    const supplier = makeSupplier({
      isApproved: true,
      sat69b: { listed: false, status: 'ok', rfcValid: true },
      documents: [{ status: 'Validado', type: 'REPSE' }, { status: 'Pendiente', type: 'Opinión SAT' }],
    });
    // factores: rfcValid=true, !listed=true, isApproved=true -> 3 pasados
    // docs: 1 validado de 2 -> +1 pasado
    const result = getSupplierChecklist(supplier);
    expect(result.total).toBe(5);
    expect(result.passed).toBe(4);
  });

  it('no inventa cumplimiento cuando no hay verificación 69-B', () => {
    const supplier = makeSupplier({ sat69b: undefined, documents: [] });
    const result = getSupplierChecklist(supplier);
    // rfcValid y !listed dependen de sat69b -> ambos false sin datos
    expect(result.total).toBe(3);
  });
});

describe('getAIRecommendation', () => {
  it('recomienda factoraje cuando es urgente y de alto impacto', () => {
    const inv = makeInvoice({ date: new Date().toISOString().slice(0, 10), amount: 1_000_000 });
    // fuerza alto impacto con presupuesto pequeño
    const rec = getAIRecommendation(inv, 5_000_000);
    expect(rec.strategy).toBe('fintech');
  });

  it('recomienda pago con caja propia cuando el monto es bajo y no urgente', () => {
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 5); // dentro de "Óptimo"
    const inv = makeInvoice({ date: oldDate.toISOString().slice(0, 10), amount: 100 });
    const rec = getAIRecommendation(inv, 5_000_000);
    expect(rec.strategy).toBe('cash');
  });
});
