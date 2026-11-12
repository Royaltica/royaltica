import {
  buildPortfolioReport,
  compareTrend,
  customerMetrics,
  dataQualityIssues,
  type CustomerInput,
  type InvoiceInput,
  type MessageInput,
} from './portfolio-analysis.calc';
import { lastClosedPeriod, periodContaining, previousPeriod } from './portfolio-period.util';

const d = (s: string) => new Date(`${s}T12:00:00.000Z`);

const cust = (id: string, extra: Partial<CustomerInput> = {}): CustomerInput => ({
  id,
  name: `Cliente ${id}`,
  category: null,
  creditLimitDays: 30,
  phone: '+5215500000000',
  email: null,
  financeContactPhone: null,
  financeContactEmail: null,
  doNotContact: false,
  isActive: true,
  ...extra,
});

let seq = 0;
const inv = (customerId: string, date: string, due: string | null, paid: string | null, total = 1000, extra: Partial<InvoiceInput> = {}): InvoiceInput => ({
  id: `i${++seq}`,
  customerId,
  folio: `F-${seq}`,
  total,
  date: d(date),
  dueDate: due ? d(due) : null,
  status: paid ? 'PAID' : 'PENDING',
  paidDate: paid ? d(paid) : null,
  ...extra,
});

describe('periodos', () => {
  it('quincenal, mensual y bimestral con fin exclusivo', () => {
    const q2 = periodContaining('QUINCENAL', d('2026-10-20'));
    expect(q2.from.toISOString()).toBe('2026-10-16T00:00:00.000Z');
    expect(q2.to.toISOString()).toBe('2026-11-01T00:00:00.000Z');
    expect(q2.label).toBe('16 al 31 de octubre 2026');

    const m = periodContaining('MENSUAL', d('2026-02-10'));
    expect(m.label).toBe('febrero 2026');
    expect(m.to.toISOString()).toBe('2026-03-01T00:00:00.000Z');

    const b = periodContaining('BIMESTRAL', d('2026-10-25'));
    expect(b.label).toBe('septiembre-octubre 2026');
  });

  it('el último periodo cerrado y el anterior (cruza de año)', () => {
    const p = lastClosedPeriod('MENSUAL', d('2026-01-05'));
    expect(p.label).toBe('diciembre 2025');
    expect(previousPeriod('MENSUAL', p).label).toBe('noviembre 2025');
    expect(lastClosedPeriod('QUINCENAL', d('2026-10-20')).label).toBe('1 al 15 de octubre 2026');
  });
});

describe('métricas de un cliente al cierre del periodo', () => {
  const oct = periodContaining('MENSUAL', d('2026-10-10'));

  it('abierto vs pagado se evalúa "al cierre", no hoy', () => {
    // Pagada el 5 de noviembre: al cierre de octubre seguía abierta y vencida.
    const i = inv('a', '2026-09-01', '2026-10-01', '2026-11-05');
    const m = customerMetrics([i], [], oct);
    expect(m.openCount).toBe(1);
    expect(m.overdueCount).toBe(1);
    expect(m.maxDaysOverdue).toBe(30);
    expect(m.paidCount).toBe(0);
  });

  it('puntualidad, atraso promedio y nivel del plan tras el que se pagó', () => {
    const late = inv('a', '2026-09-01', '2026-10-01', '2026-10-11'); // 10 días tarde
    const ok = inv('a', '2026-09-05', '2026-10-15', '2026-10-14');
    const msgs: MessageInput[] = [
      { customerId: 'a', invoiceId: late.id, direction: 'OUTBOUND', kind: 'TEMPLATE', templateName: 'aviso_vencida', sent: true, createdAt: d('2026-10-02') },
      { customerId: 'a', invoiceId: late.id, direction: 'INBOUND', kind: 'BUTTON', templateName: null, sent: true, createdAt: d('2026-10-03') },
    ];
    const m = customerMetrics([late, ok], msgs, oct);
    expect(m.paidCount).toBe(2);
    expect(m.paidOnTime).toBe(1);
    expect(m.paidLate).toBe(1);
    expect(m.avgPaymentDelayDays).toBe(5); // (10 + 0) / 2
    expect(m.responded).toBe(true);
    expect(m.buttonsTapped).toBe(1);
    expect(m.paidAfterLevels).toEqual(['A', 'A']); // la 2a usa el último mensaje al cliente
  });

  it('aplica la misma regla de riesgo del cron (150 días → RIESGO)', () => {
    const i = inv('a', '2026-04-01', '2026-05-01', null);
    expect(customerMetrics([i], [], oct).tier).toBe('RIESGO');
  });
});

describe('tendencia contra el periodo anterior', () => {
  const sep = periodContaining('MENSUAL', d('2026-09-10'));
  const oct = periodContaining('MENSUAL', d('2026-10-10'));

  it('empeoró: ahora tiene saldo vencido y su atraso creció', () => {
    const i = inv('a', '2026-08-20', '2026-09-25', null, 5000);
    const prev = customerMetrics([i], [], sep);
    const curr = customerMetrics([i], [], oct);
    const t = compareTrend(curr, prev, true);
    expect(t.trend).toBe('EMPEORO');
    expect(t.reasons.join(' ')).toContain('pasó de 5 a 36 días');
  });

  it('mejoró: liquidó lo vencido', () => {
    const i = inv('a', '2026-08-01', '2026-08-31', '2026-10-05');
    const t = compareTrend(customerMetrics([i], [], oct), customerMetrics([i], [], sep), true);
    expect(t.trend).toBe('MEJORO');
    expect(t.reasons).toContain('Quedó sin saldo vencido.');
  });
});

describe('datos a corregir', () => {
  it('detecta faltantes, duplicados y clientes sin contacto', () => {
    const c = [cust('a', { phone: null }), cust('b')];
    const list = [
      inv('a', '2026-09-01', null, null),
      inv('b', '2026-09-01', '2026-10-01', null, 100, { folio: 'X-1' }),
      inv('b', '2026-09-02', '2026-10-02', null, 100, { folio: 'x-1 ' }),
      inv('b', '2026-09-03', '2026-10-03', null, 100, { status: 'PAID', paidDate: null }),
    ];
    const codes = dataQualityIssues(c, list).map((i) => i.code);
    expect(codes).toEqual(
      expect.arrayContaining(['INVOICE_NO_DUE_DATE', 'DUPLICATE_FOLIO', 'CUSTOMER_NO_CONTACT', 'PAID_NO_PAID_DATE']),
    );
  });
});

describe('reporte completo', () => {
  it('arma totales, listas y tipos de cliente sin romperse con un cliente nuevo', () => {
    const oct = periodContaining('MENSUAL', d('2026-10-10'));
    const report = buildPortfolioReport({
      frequency: 'MENSUAL',
      period: oct,
      previous: previousPeriod('MENSUAL', oct),
      customers: [cust('a'), cust('b'), cust('nuevo')],
      invoices: [
        inv('a', '2026-04-01', '2026-05-01', null, 9000), // se acerca a incobrable
        inv('b', '2026-08-01', '2026-08-31', '2026-10-05'),
        inv('nuevo', '2026-10-05', '2026-11-05', null),
      ],
      messages: [],
      now: d('2026-11-01'),
    });
    expect(report.trendCounts.NUEVO).toBe(1);
    expect(report.improved.map((r) => r.customerId)).toContain('b');
    expect(report.becomingUncollectible[0].customerId).toBe('a');
    expect(report.becomingUncollectible[0].daysToUncollectible).toBe(17);
    expect(report.totals.current.overdueAmount).toBe(9000);
    expect(report.segments.length).toBeGreaterThan(0);
  });
});

describe('estrategias', () => {
  it('mide respuesta y pago por nivel del plan y separa lo que funciona de lo que no', () => {
    const { strategyStats } = jest.requireActual('./portfolio-analysis.calc') as typeof import('./portfolio-analysis.calc');
    const oct = periodContaining('MENSUAL', d('2026-10-10'));
    const invs: InvoiceInput[] = [];
    const msgs: MessageInput[] = [];
    // Nivel 3: 3 envíos, 2 pagan en ≤14 días y 1 contesta → funciona.
    for (let k = 0; k < 3; k++) {
      const i = inv(`c${k}`, '2026-09-01', '2026-10-10', k < 2 ? '2026-10-09' : null);
      invs.push(i);
      msgs.push({ customerId: `c${k}`, invoiceId: i.id, direction: 'OUTBOUND', kind: 'TEMPLATE', templateName: 'nivel_3', sent: true, createdAt: d('2026-10-07') });
    }
    msgs.push({ customerId: 'c0', invoiceId: null, direction: 'INBOUND', kind: 'BUTTON', templateName: null, sent: true, createdAt: d('2026-10-08') });
    // Etapa A: 3 envíos sin pago → no funciona.
    for (let k = 3; k < 6; k++) {
      const i = inv(`c${k}`, '2026-08-01', '2026-09-01', null);
      invs.push(i);
      msgs.push({ customerId: `c${k}`, invoiceId: i.id, direction: 'OUTBOUND', kind: 'TEMPLATE', templateName: 'aviso_vencida', sent: true, createdAt: d('2026-10-02') });
    }
    // Texto con IA: 1 envío → poca muestra.
    msgs.push({ customerId: 'c0', invoiceId: null, direction: 'OUTBOUND', kind: 'TEXT', templateName: null, sent: true, createdAt: d('2026-10-08') });

    const s = strategyStats(msgs, invs, oct);
    expect(s.totalSends).toBe(7);
    expect(s.working.map((x) => x.key)).toEqual(['N3']);
    expect(s.working[0].paidRatePct).toBe(67);
    expect(s.working[0].responseRatePct).toBe(33);
    expect(s.notWorking.map((x) => x.key)).toEqual(['A']);
    expect(s.lowSample.map((x) => x.key)).toEqual(['TEXTO_LIBRE']);
  });
});
