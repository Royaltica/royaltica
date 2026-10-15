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
 * Las fechas se calculan desde HOY REAL con los días del prototipo (`dias`),
 * no con sus fechas fijas: así el backend (motor automático, ventana, nivel
 * que toca) ve el mismo calendario que el plan de cada cliente en pantalla.
 *
 * Uso:  npx tsx scripts/seed-cobranza-demo.ts [--reset] ["Nombre de la organización"]
 *       --reset  borra las conversaciones y ejecuciones de prueba de estos
 *                clientes para empezar de cero. Default: "Royáltica Demo".
 */
import 'dotenv/config';
import { PrismaClient, Prisma } from '@prisma/client';
import { CARTERA } from '../../frontend/src/pages/corporate/views/cobranza/mockV1';

const DIA = 86_400_000;
const hoy = new Date();
const HOY_UTC = Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate());

/** Vencimiento a partir de los días del prototipo (positivo = vencida hace N días). */
const vencimiento = (dias: number) => new Date(HOY_UTC - dias * DIA);

async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('Este script es solo para desarrollo.');
  const args = process.argv.slice(2);
  const reset = args.includes('--reset');
  const orgName = args.find((a) => !a.startsWith('--')) ?? 'Royáltica Demo';
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

    if (reset) {
      await prisma.whatsappMessage.deleteMany({ where: { customerId: customer.id } });
      await prisma.collectionSequenceRun.deleteMany({ where: { invoice: { customerId: customer.id } } });
    }

    const todas = [
      { folio: c.folio, monto: c.monto, dias: c.dias },
      ...(c.facturasExtra ?? []).map((f) => ({ folio: f.folio, monto: f.monto, dias: f.dias })),
    ];
    for (const f of todas) {
      const total = new Prisma.Decimal(f.monto);
      const subtotal = total.div(1.16).toDecimalPlaces(2);
      const dueDate = vencimiento(f.dias);
      const date = new Date(dueDate.getTime() - 30 * DIA);
      await prisma.invoice.upsert({
        where: { cfdiUuid: `demo-${c.id}-${f.folio}` },
        update: { total, subtotal, iva: total.minus(subtotal), date, dueDate, status: 'PENDING' },
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
          date,
          dueDate,
          status: 'PENDING',
          description: 'Factura de ejemplo (Cobranza IA)',
        },
      });
      facturas++;
    }
  }
  console.log(
    `✓ ${clientes} clientes y ${facturas} facturas de ejemplo en "${org.name}"${reset ? ' (conversaciones reiniciadas)' : ''}.`,
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('❌', e instanceof Error ? e.message : e);
  process.exit(1);
});
