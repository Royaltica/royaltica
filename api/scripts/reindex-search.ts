/**
 * Script one-shot para reconstruir todos los índices de Meilisearch
 * desde Postgres. Útil para:
 *   - Inicializar Meili en producción por primera vez.
 *   - Reindexar después de cambiar el schema de un índice.
 *   - Recuperarse si Meili perdió el volumen o se corrompió.
 *
 * Uso:
 *   # Desde /api con la CLI de Railway (usa las envs de producción):
 *   railway run -- npm run tsx scripts/reindex-search.ts
 *
 *   # O local, con .env cargado y Meili corriendo:
 *   npx tsx scripts/reindex-search.ts
 *
 * Requiere MEILI_HOST y MEILI_MASTER_KEY seteadas. Si no hay Meili
 * configurado, el script termina en un warning sin hacer nada.
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const BATCH = 500;

async function main() {
  const host = process.env.MEILI_HOST;
  const key = process.env.MEILI_MASTER_KEY;

  if (!host) {
    console.warn('⚠ MEILI_HOST no configurado — nada que hacer.');
    process.exit(0);
  }

  const { MeiliSearch } = await import('meilisearch');
  const meili = new MeiliSearch({ host, apiKey: key || undefined });
  const prisma = new PrismaClient();

  console.log(`→ Meilisearch: ${host}`);

  // 1) Suppliers
  await reindex('suppliers', async () => {
    const rows = await prisma.supplier.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        organizationId: true,
        name: true,
        legalName: true,
        rfc: true,
        contact: true,
        email: true,
        category: true,
        activity: true,
        isApproved: true,
        score: true,
        seniorityYears: true,
        createdAt: true,
      },
    });
    return rows.map((s) => ({
      ...s,
      createdAt: s.createdAt?.getTime?.() ?? null,
    }));
  });

  // 2) Invoices
  await reindex('invoices', async () => {
    const rows = await prisma.invoice.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        organizationId: true,
        folio: true,
        uuid: true,
        supplierId: true,
        status: true,
        direction: true,
        total: true,
        issueDate: true,
        dueDate: true,
        concept: true,
        supplier: { select: { name: true } },
      },
    });
    return rows.map((i) => ({
      id: i.id,
      organizationId: i.organizationId,
      folio: i.folio,
      uuid: i.uuid,
      supplierId: i.supplierId,
      supplierName: i.supplier?.name ?? null,
      status: i.status,
      direction: i.direction,
      total: Number(i.total),
      issueDate: i.issueDate?.getTime?.() ?? null,
      dueDate: i.dueDate?.getTime?.() ?? null,
      concept: i.concept,
    }));
  });

  // 3) Customers
  await reindex('customers', async () => {
    const rows = await prisma.customer.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        organizationId: true,
        name: true,
        legalName: true,
        rfc: true,
        email: true,
      },
    });
    return rows;
  });

  await prisma.$disconnect();
  console.log('✓ Reindex terminado.');

  async function reindex(
    uid: 'suppliers' | 'invoices' | 'customers',
    fetch: () => Promise<Array<Record<string, unknown> & { id: string }>>,
  ): Promise<void> {
    console.log(`\n→ Reindexando "${uid}"…`);
    // Asegurar índice
    await meili.createIndex(uid, { primaryKey: 'id' }).catch(() => {
      /* ya existe */
    });
    // Vaciar y volver a llenar (más simple que hacer delta)
    await meili.index(uid).deleteAllDocuments();
    const docs = await fetch();
    if (docs.length === 0) {
      console.log(`  · sin documentos`);
      return;
    }
    for (let i = 0; i < docs.length; i += BATCH) {
      const batch = docs.slice(i, i + BATCH);
      await meili.index(uid).addDocuments(batch);
      console.log(`  · ${Math.min(i + BATCH, docs.length)} / ${docs.length}`);
    }
  }
}

main().catch((err) => {
  console.error('✗ Error:', err);
  process.exit(1);
});
