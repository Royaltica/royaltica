import {
  findSubsetsSummingTo,
  proposeComposite,
  type PendingInvoiceForMatch,
} from './composite-match';

const perez = { name: 'Distribuidora Pérez', rfc: 'DPE010101AA1' };
const inv = (over: Partial<PendingInvoiceForMatch>): PendingInvoiceForMatch => ({
  id: 'x',
  folio: null,
  total: 1160,
  subtotal: 1000,
  amountPaid: 0,
  dueDate: new Date('2026-11-01'),
  customerId: 'c1',
  customer: perez,
  ...over,
});

describe('proposeComposite', () => {
  it('sin evidencia del cliente en el concepto no propone nada', () => {
    const r = proposeComposite({ amount: 2320, description: 'DEPOSITO', referenceNumber: null }, [
      inv({ id: 'a' }),
      inv({ id: 'b' }),
    ]);
    expect(r).toBeNull();
  });

  it('propone varias facturas que suman exacto (por nombre, sin acentos)', () => {
    const r = proposeComposite(
      { amount: 1740, description: 'SPEI RECIBIDO DISTRIBUIDORA PEREZ', referenceNumber: null },
      [inv({ id: 'a', total: 1160 }), inv({ id: 'b', total: 580 }), inv({ id: 'c', total: 300 })],
    );
    expect(r).toMatchObject({ kind: 'MULTI', invoiceIds: ['a', 'b'], customerId: 'c1' });
  });

  it('reconoce al cliente por RFC en la referencia', () => {
    const r = proposeComposite(
      { amount: 1740, description: 'SPEI', referenceNumber: 'DPE010101AA1' },
      [inv({ id: 'a', total: 1160 }), inv({ id: 'b', total: 580 })],
    );
    expect(r?.kind).toBe('MULTI');
  });

  it('si hay dos combinaciones posibles no elige: MULTI_AMBIGUOUS', () => {
    const r = proposeComposite(
      { amount: 1000, description: 'DISTRIBUIDORA PEREZ', referenceNumber: null },
      [inv({ id: 'a', total: 500 }), inv({ id: 'b', total: 500 }), inv({ id: 'c', total: 500 })],
    );
    expect(r?.kind).toBe('MULTI_AMBIGUOUS');
    expect(r?.invoiceIds.sort()).toEqual(['a', 'b', 'c']);
  });

  it('propone retención de ISR del 10 % sobre el subtotal', () => {
    // 1160 − 1000 × 10 % = 1060
    const r = proposeComposite(
      { amount: 1060, description: 'DISTRIBUIDORA PEREZ', referenceNumber: null },
      [inv({ id: 'a' })],
    );
    expect(r).toMatchObject({ kind: 'RETENTION', invoiceIds: ['a'], retentionRate: 0.1 });
  });

  it('propone pago parcial si el depósito es menor al saldo', () => {
    const r = proposeComposite(
      { amount: 300, description: 'DISTRIBUIDORA PEREZ', referenceNumber: null },
      [inv({ id: 'a' })],
    );
    expect(r).toMatchObject({ kind: 'PARTIAL', invoiceIds: ['a'] });
  });

  it('usa el saldo (total menos pagos previos), no el total', () => {
    const r = proposeComposite(
      { amount: 1060, description: 'DISTRIBUIDORA PEREZ', referenceNumber: null },
      [inv({ id: 'a', total: 1160, amountPaid: 600 }), inv({ id: 'b', total: 500 })],
    );
    // 560 + 500 = 1060
    expect(r).toMatchObject({ kind: 'MULTI', invoiceIds: ['a', 'b'] });
  });

  it('si el concepto menciona a dos clientes no propone nada', () => {
    const r = proposeComposite(
      { amount: 1000, description: 'DISTRIBUIDORA PEREZ Y ACEROS NORTE', referenceNumber: null },
      [
        inv({ id: 'a', total: 400 }),
        inv({ id: 'b', total: 600, customerId: 'c2', customer: { name: 'Aceros Norte' } }),
      ],
    );
    expect(r).toBeNull();
  });
});

describe('findSubsetsSummingTo', () => {
  it('respeta el máximo de facturas por combinación', () => {
    const many = Array.from({ length: 8 }, (_, i) => inv({ id: `i${i}`, total: 100 }));
    expect(findSubsetsSummingTo(many, 800)).toEqual([]); // harían falta 8
    expect(findSubsetsSummingTo(many, 500, 5, 1)).toHaveLength(1);
  });
});
