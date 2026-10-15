/**
 * SOLO DESARROLLO LOCAL. Registra en la base los 14 clientes de ejemplo de
 * Cobranza IA (los mismos de la pestaña Clientes, frontend/.../mockV1.ts) con
 * sus facturas pendientes, para que la subpestaña WhatsApp de cada cliente
 * tenga una conversación real que probar.
 *
 * Los teléfonos son INVÁLIDOS a propósito (+52 00 0000 00NN, lada 00 no
 * existe): aunque se configure el token de Meta, ningún mensaje de prueba
 * puede llegarle a una persona real. Idempotente (upsert por RFC/UUID).
 *
 * Uso:  npx tsx scripts/seed-cobranza-demo.ts ["Nombre de la organización"]
 *       (default: "Royáltica Demo")
 */
import 'dotenv/config';
import { PrismaClient, Prisma } from '@prisma/client';
import { CARTERA, HOY } from '../../frontend/src/pages/corporate/views/cobranza/mockV1';

const MESES: Record<string, number> = {
  ene: 0, feb: 1, mar: 2, abr: 3, may: 4, jun: 5, jul: 6, ago: 7, sep: 8, oct: 9, nov: 10, dic: 11,
};
const ANIO = Number(HOY.slice(0, 4));

/** "17 ago" → fecha UTC del año del prototipo. */
function fecha(txt: string): Date {
  const [d, m] = txt.trim().split(/\s+/);
  const mes = MESES[m.toLowerCase().slice(0, 3)];
  if (mes === undefined) throw new Error(`Fecha no reconocida: "${txt}"`);
  return new Date(Date.UTC(ANIO, mes, Number(d)));
}

async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('Este script es solo para desarrollo.');
  const orgName = process.argv[2] ?? 'Royáltica Demo';
  const prisma = new PrismaClient();
  const org = await prisma.organization.findFirst({ where: { name: orgName, deletedAt: null } });
  if (!org) throw new Error(`No existe la organización "${orgName}".`);

  let clientes = 0;
  let facturas = 0;
  for (const [i, c] of CARTERA.entries()) {
    const n = String(i + 1).padStart(2, '0');
    const telefono = c.finanzas ? `+52000000000${n}` : null;
    const rfc = `DEMO${c.id.toUpperCase()}0000`.slice(0, 12);
    const customer = await prisma.customer.upsert({
      where: { organizationId_rfc: { organizationId: org.id, rfc } },
      update: {
        name: c.cliente,
        financeContactName: c.finanzas?.nombre ?? null,
        financeContactPhone: telefono,
        contact: c.registrado,
      },
      create: {
        organizationId: org.id,
        name: c.cliente,
        legalName: c.cliente,
        rfc,
        contact: c.registrado,
        financeContactName: c.finanzas?.nombre ?? null,
        financeContactPhone: telefono,
        externalId: `demo:${c.id}`,
        doNotContact: !c.contactable,
        doNotContactReason: c.contactable ? null : (c.motivo ?? 'No contactable en el prototipo'),
      },
    });
    clientes++;

    const todas = [
      { folio: c.folio, monto: c.monto, emision: c.emision, vence: c.vence },
      ...(c.facturasExtra ?? []).map((f) => ({ folio: f.folio, monto: f.monto, emision: f.emision, vence: f.vence })),
    ];
    for (const f of todas) {
      const total = new Prisma.Decimal(f.monto);
      const subtotal = total.div(1.16).toDecimalPlaces(2);
      await prisma.invoice.upsert({
        where: { cfdiUuid: `demo-${c.id}-${f.folio}` },
        update: { total, subtotal, iva: total.minus(subtotal), dueDate: fecha(f.vence), status: 'PENDING' },
        create: {
          organizationId: org.id,
          direction: 'RECEIVABLE',
          customerId: customer.id,
          folio: f.folio,
          cfdiUuid: `demo-${c.id}-${f.folio}`,
          rfcEmisor: org.rfc,
          rfcReceptor: rfc,
          subtotal,
          iva: total.minus(subtotal),
          total,
          date: fecha(f.emision),
          dueDate: fecha(f.vence),
          status: 'PENDING',
          description: 'Factura de ejemplo (Cobranza IA)',
        },
      });
      facturas++;
    }
  }
  console.log(`✓ ${clientes} clientes y ${facturas} facturas de ejemplo en "${org.name}".`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('❌', e instanceof Error ? e.message : e);
  process.exit(1);
});
