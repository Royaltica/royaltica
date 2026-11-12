/**
 * Corre el análisis de cartera (pasos 1-3) en local SIN guardar nada e
 * imprime un resumen, para revisar los números antes de verlos en pantalla.
 *
 *   npx ts-node scripts/run-portfolio-analysis.ts [ORG_ID] [MENSUAL|QUINCENAL|BIMESTRAL] [--en-curso]
 *
 * Sin ORG_ID usa la organización con más facturas de venta.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { buildPortfolioReport, type InvoiceInput } from '../src/portfolio-analysis/portfolio-analysis.calc';
import {
  isReportFrequency,
  lastClosedPeriod,
  periodContaining,
  previousPeriod,
} from '../src/portfolio-analysis/portfolio-period.util';

async function main() {
  const prisma = new PrismaClient();
  const args = process.argv.slice(2);
  const enCurso = args.includes('--en-curso');
  const freqArg = args.find(isReportFrequency);
  const frequency = freqArg ?? 'MENSUAL';
  let orgId = args.find((a) => !a.startsWith('--') && !isReportFrequency(a));

  if (!orgId) {
    const top = await prisma.invoice.groupBy({
      by: ['organizationId'],
      where: { direction: 'RECEIVABLE', deletedAt: null },
      _count: { _all: true },
      orderBy: { _count: { organizationId: 'desc' } },
      take: 1,
    });
    orgId = top[0]?.organizationId;
  }
  if (!orgId) throw new Error('No hay facturas de venta en la base.');

  const now = new Date();
  const period = enCurso ? { ...periodContaining(frequency, now), to: now } : lastClosedPeriod(frequency, now);
  const previous = previousPeriod(frequency, period);

  const [customers, invoices, messages] = await Promise.all([
    prisma.customer.findMany({
      where: { organizationId: orgId, deletedAt: null },
      select: {
        id: true, name: true, category: true, creditLimitDays: true, phone: true, email: true,
        financeContactPhone: true, financeContactEmail: true, doNotContact: true, isActive: true,
      },
    }),
    prisma.invoice.findMany({
      where: { organizationId: orgId, direction: 'RECEIVABLE', deletedAt: null },
      select: { id: true, customerId: true, folio: true, total: true, date: true, dueDate: true, status: true, paidDate: true },
    }),
    prisma.whatsappMessage.findMany({
      where: { organizationId: orgId, createdAt: { lt: period.to } },
      select: { customerId: true, invoiceId: true, direction: true, kind: true, templateName: true, sent: true, createdAt: true },
    }),
  ]);

  const r = buildPortfolioReport({
    frequency,
    period,
    previous,
    customers,
    invoices: invoices.map((i): InvoiceInput => ({ ...i, total: Number(i.total), status: i.status as InvoiceInput['status'] })),
    messages,
  });

  // --json=<ruta>: además guarda el reporte completo (útil para revisar la pantalla).
  const jsonArg = args.find((a) => a.startsWith('--json='));
  if (jsonArg) {
    const { writeFileSync } = await import('node:fs');
    writeFileSync(jsonArg.slice('--json='.length), JSON.stringify(r, null, 2));
  }

  const money = (n: number) => n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
  const c = r.totals.current;
  const p = r.totals.previous;
  console.log(`\n=== Análisis ${frequency} · ${r.period.label} (vs ${r.previousPeriod.label}) ===`);
  console.log(`Clientes analizados: ${r.customers.length}`);
  console.log(`Saldo abierto: ${money(c.openAmount)} (antes ${money(p.openAmount)})`);
  console.log(`Vencido: ${money(c.overdueAmount)} = ${c.overduePct ?? '—'}% (antes ${money(p.overdueAmount)})`);
  console.log(`Cobrado en el periodo: ${money(c.collectedAmount)} en ${c.collectedCount} facturas · a tiempo ${c.paidOnTimePct ?? '—'}%`);
  console.log(`Respuesta a WhatsApp: ${c.customersResponded}/${c.customersMessaged} clientes`);
  console.log('Riesgo (con saldo):', c.distribution);
  console.log('Tendencias:', r.trendCounts);
  const line = (x: (typeof r.customers)[number]) =>
    `  - ${x.name} [${x.previousTier ?? '—'} → ${x.tier}] ${x.trendReasons.join(' ')}`;
  console.log('\nMejoraron:'); r.improved.forEach((x) => console.log(line(x)));
  console.log('\nEmpeoraron:'); r.worsened.forEach((x) => console.log(line(x)));
  console.log('\nSe están volviendo incobrables:');
  r.becomingUncollectible.forEach((x) =>
    console.log(`  - ${x.name}: ${x.current.maxDaysOverdue} días, faltan ${x.daysToUncollectible} para incobrable · ${money(x.current.overdueAmount)}`),
  );
  console.log('\nNo contestan (deben y se les escribió):'); r.nonResponders.forEach((x) => console.log(`  - ${x.name}`));
  console.log('\nPor tipo de cliente:');
  r.segments.forEach((s) =>
    console.log(`  - ${s.label}: ${s.customers} clientes · a tiempo ${s.paidOnTimePct ?? '—'}% · atraso prom ${s.avgPaymentDelayDays ?? '—'} días · crédito mediano ${s.medianCreditDays ?? '—'} días · pagan tras`, s.paidAfterLevel),
  );
  console.log('\nDatos a corregir:');
  r.dataQuality.forEach((q) => console.log(`  - [${q.severity}] ${q.title}: ${q.count} → ${q.samples.slice(0, 3).map((s) => s.label).join('; ')}`));
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
