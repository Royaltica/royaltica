import {
  diagnose,
  loadSegmentInputs,
  newlyWorsened,
  segmentOf,
  summarizeSegments,
  type SegmentInput,
} from './customer-segments';

const DAY = 86_400_000;
const NOW = new Date('2026-11-18T18:00:00Z');
const ago = (d: number) => new Date(NOW.getTime() - d * DAY);

describe('segmentOf (mismas reglas que la pantalla)', () => {
  it.each([
    [[], 0, false, 'nuevo'],
    [[0, 0, 0], 0, true, 'disputa'],
    [[1, 2, 0], 2, false, 'moroso'],
    [[30, 25, 40, 0, 35], 0, false, 'moroso'],
    [[0, 0, -2, 0, 0, 12, 10, 15], 0, false, 'deterioro'],
    [[0, -1, 0, 0, 0, 0, 0, 0, 0, 0], 0, false, 'puntual'],
    [[6, 7, 5, 6, 8, 6], 0, false, 'tardio'],
    [[0, 0, 12, 0, 3, 0], 0, false, 'olvidadizo'],
  ] as const)('%j, %i promesas rotas, disputa %s → %s', (history, broken, disputed, expected) => {
    expect(segmentOf([...history], broken, disputed).segment).toBe(expected);
  });

  it('explica el porqué y calcula el corrimiento del tardío', () => {
    const d = segmentOf([6, 7, 5, 6, 8, 6], 0, false);
    expect(d.reason).toContain('6 días tarde');
    expect(d.offsetDays).toBe(6);
  });
});

describe('loadSegmentInputs', () => {
  const customer = (invoices: unknown[]) => ({ id: 'c1', name: 'Uno', category: 'Distribuidor', riskTier: 'SANO', score: 90, invoices });
  const db = (customers: unknown[], logs: unknown[] = []) => ({
    customer: { findMany: jest.fn().mockResolvedValue(customers) },
    activityLog: { findMany: jest.fn().mockResolvedValue(logs) },
  });

  it('cuenta promesas rotas, ignora las cumplidas y las que aún no vencen', async () => {
    const d = db(
      [customer([
        { id: 'i1', status: 'PENDING', total: 1000, amountPaid: 200, dueDate: ago(30), paidDate: null },
        { id: 'i2', status: 'PAID', total: 500, amountPaid: 500, dueDate: ago(60), paidDate: ago(40) },
        { id: 'i3', status: 'PAID', total: 500, amountPaid: 500, dueDate: ago(90), paidDate: ago(70) },
      ])],
      [
        { action: 'CUSTOMER_PROMISED_PAYMENT', entityId: 'i1', metadata: { promisedDate: ago(10).toISOString() }, createdAt: ago(15) }, // rota
        { action: 'CUSTOMER_PROMISED_PAYMENT', entityId: 'i2', metadata: { promisedDate: ago(45).toISOString() }, createdAt: ago(50) }, // pagó 5 días tarde: rota
        { action: 'CUSTOMER_PROMISED_PAYMENT', entityId: 'i3', metadata: { promisedDate: ago(71).toISOString() }, createdAt: ago(75) }, // cumplida (tolerancia 1 día)
        { action: 'CUSTOMER_PROMISED_PAYMENT', entityId: 'i1', metadata: { promisedDate: new Date(NOW.getTime() + 3 * DAY).toISOString() }, createdAt: ago(1) }, // no vence
        { action: 'CUSTOMER_PROMISED_PAYMENT', entityId: 'i1', metadata: {}, createdAt: ago(1) }, // sin fecha
      ],
    );
    const [c] = await loadSegmentInputs(d as never, 'org-1', { now: NOW });
    expect(c.brokenPromises).toBe(2);
    expect(c.outstanding).toBe(800);
    expect(c.payments.map((p) => p.daysLate)).toEqual([20, 20]);
    expect(d.activityLog.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ organizationId: 'org-1' }) }));
  });

  it('una aclaración sobre una factura abierta reciente cuenta como disputa; una vieja o ya pagada, no', async () => {
    const invoices = [
      { id: 'i1', status: 'PENDING', total: 100, amountPaid: 0, dueDate: ago(5), paidDate: null },
      { id: 'i2', status: 'PAID', total: 100, amountPaid: 100, dueDate: ago(50), paidDate: ago(48) },
    ];
    const reciente = await loadSegmentInputs(db([customer(invoices)], [{ action: 'CUSTOMER_DISPUTED_INVOICE', entityId: 'i1', metadata: {}, createdAt: ago(3) }]) as never, 'org-1', { now: NOW });
    const vieja = await loadSegmentInputs(db([customer(invoices)], [{ action: 'CUSTOMER_DISPUTED_INVOICE', entityId: 'i1', metadata: {}, createdAt: ago(120) }]) as never, 'org-1', { now: NOW });
    const pagada = await loadSegmentInputs(db([customer(invoices)], [{ action: 'CUSTOMER_DISPUTED_INVOICE', entityId: 'i2', metadata: {}, createdAt: ago(3) }]) as never, 'org-1', { now: NOW });
    expect([reciente[0].disputed, vieja[0].disputed, pagada[0].disputed]).toEqual([true, false, false]);
  });

  it('filtra por agente cuando se pide y no consulta la bitácora si no hay facturas', async () => {
    const d = db([{ ...customer([]) }]);
    await loadSegmentInputs(d as never, 'org-1', { assignedAgentId: 'u-9', now: NOW });
    expect(d.customer.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ organizationId: 'org-1', assignedAgentId: 'u-9' }) }));
    expect(d.activityLog.findMany).not.toHaveBeenCalled();
  });
});

const input = (id: string, lates: number[], extra: Partial<SegmentInput> = {}): SegmentInput => ({
  id,
  name: `Cliente ${id}`,
  category: null,
  riskTier: null,
  score: null,
  outstanding: 100,
  payments: lates.map((d, i) => ({ paidAt: ago(lates.length - i), daysLate: d })),
  brokenPromises: 0,
  disputed: false,
  ...extra,
});

describe('summarizeSegments', () => {
  it('agrupa por segmento, tipo de deudor y riesgo, con saldo', () => {
    const r = summarizeSegments([
      input('a', [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], { category: 'Gobierno', riskTier: 'SANO', outstanding: 1000.5 }),
      input('b', [], { category: 'Gobierno', outstanding: 200 }),
      input('c', [], { category: '  ' }),
    ]);
    expect(r.segments.find((s) => s.segment === 'puntual')).toMatchObject({ count: 1, outstanding: 1000.5 });
    expect(r.segments.find((s) => s.segment === 'nuevo')).toMatchObject({ count: 2, name: 'Nuevo' });
    expect(r.segments).toHaveLength(7);
    expect(r.byCategory).toEqual([
      { category: 'Gobierno', count: 2, outstanding: 1200.5 },
      { category: 'Sin tipo', count: 1, outstanding: 100 },
    ]);
    expect(r.byRiskTier).toEqual(expect.arrayContaining([{ riskTier: 'SIN_CALCULAR', count: 2, outstanding: 300 }]));
    expect(r.customers[0]).toMatchObject({ id: 'a', segment: 'puntual', segmentName: 'Puntual' });
  });
});

describe('newlyWorsened', () => {
  it('avisa a quien entró hoy a deterioro por un pago reciente, una sola vez', () => {
    const lates = [0, 0, 0, 0, 0, 0, 0, 10, 15];
    const c = input('d', lates);
    // El último pago (15 días tarde) se registró hace 1 día: antes de él no era deterioro.
    c.payments[c.payments.length - 1].paidAt = ago(0.5);
    const since = ago(1);
    expect(diagnose(c, since).segment).not.toBe('deterioro');
    expect(newlyWorsened([c], since)).toEqual([expect.objectContaining({ id: 'd', segment: 'deterioro' })]);
    // Al día siguiente ese pago ya no es "reciente": no se repite el aviso.
    expect(newlyWorsened([c], ago(0.1))).toEqual([]);
  });

  it('no avisa por segmentos que no son de riesgo ni por quien ya estaba ahí', () => {
    const puntual = input('p', [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    const yaMoroso = input('m', [30, 25, 40, 35, 50]);
    yaMoroso.payments[yaMoroso.payments.length - 1].paidAt = ago(0.5);
    expect(newlyWorsened([puntual, yaMoroso], ago(1))).toEqual([]);
  });
});
