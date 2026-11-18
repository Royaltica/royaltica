import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import type { PrismaService } from '../common/prisma/prisma.service';
import { LEVEL_PLAN_STEPS } from '../collection-sequences/collection-sequences.service';

export const PILOT_RFC = 'PILOTO000000';
export const PILOT_NAME = 'Piloto Demo';
const DAY = 86_400_000;

function pilotId(key: string): string {
  const hex = createHash('sha256').update(`royaltica:piloto-demo:${key}`).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export const PILOT_ORGANIZATION_ID = pilotId('organization');

function assertDevelopment() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('La semilla del piloto no está permitida en producción.');
  }
}

/** Conserva lo probado; para volver al estado inicial se debe reiniciar primero. */
export async function seedPilot(prisma: PrismaService, now = new Date()) {
  assertDevelopment();
  const organizationId = PILOT_ORGANIZATION_ID;
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const dateAt = (offset: number) => new Date(today + offset * DAY);

  return prisma.withOrg(organizationId, async (tx) => {
    await tx.organization.upsert({
      where: { id: organizationId, rfc: PILOT_RFC },
      update: {},
      create: {
        id: organizationId,
        rfc: PILOT_RFC,
        name: PILOT_NAME,
        legalName: 'Piloto Demo — datos de ejemplo',
        settings: { product: 'CXC', multiUserEnabled: true },
      },
    });

    const users = [
      { key: 'admin', name: 'Administrador Demo', role: 'CORPORATE_ADMIN', operationalProfile: 'ADMINISTRADOR_DATA' },
      { key: 'supervisor', name: 'Supervisor Demo', role: 'CORPORATE_USER', operationalProfile: 'SUPERVISOR_GERENTE' },
      { key: 'agente', name: 'Agente Demo', role: 'CORPORATE_USER', operationalProfile: 'AGENTE_EJECUTIVO' },
    ] as const;
    for (const user of users) {
      await tx.user.upsert({
        where: { id: pilotId(user.key), organizationId },
        update: {},
        create: {
          id: pilotId(user.key),
          organizationId,
          firebaseUid: `piloto-demo-${user.key}`,
          email: `${user.key}@piloto.invalid`,
          name: user.name,
          role: user.role,
          operationalProfile: user.operationalProfile,
          permissions: user.key === 'admin' ? ['*'] : ['dashboard', 'cxc', 'configuracion'],
        },
      });
    }

    const customerIds: string[] = [];
    for (let i = 1; i <= 10; i++) {
      const number = String(i).padStart(2, '0');
      const id = pilotId(`customer-${i}`);
      customerIds.push(id);
      await tx.customer.upsert({
        where: { id, organizationId },
        update: {},
        create: {
          id,
          organizationId,
          rfc: `DEMO000000${number}`,
          name: `Cliente Demo ${number}`,
          legalName: `Cliente Demo ${number} — datos de ejemplo`,
          externalId: `piloto:cliente:${number}`,
          phone: `+5200000000${number}`,
          financeContactPhone: `+5200000000${number}`,
          financeContactName: `Finanzas Demo ${number}`,
          assignedAgentId: pilotId('agente'),
          notes: 'Datos de ejemplo. Teléfono inválido con lada 00.',
        },
      });
    }

    const dueOffsets = [30, 14, 7, 3, 0, -1, -7, -20, -35, -60];
    for (let i = 0; i < 25; i++) {
      const number = String(i + 1).padStart(3, '0');
      const customerIndex = i % 10;
      const id = pilotId(`invoice-${i + 1}`);
      const total = new Prisma.Decimal(1160 + i * 116);
      const subtotal = total.div(1.16).toDecimalPlaces(2);
      const dueOffset = dueOffsets[i % dueOffsets.length];
      await tx.invoice.upsert({
        where: { id, organizationId },
        update: {},
        create: {
          id,
          organizationId,
          direction: 'RECEIVABLE',
          customerId: customerIds[customerIndex],
          folio: `DEMO-${number}`,
          cfdiUuid: pilotId(`cfdi-${i + 1}`),
          rfcEmisor: PILOT_RFC,
          rfcReceptor: `DEMO000000${String(customerIndex + 1).padStart(2, '0')}`,
          subtotal,
          iva: total.minus(subtotal),
          total,
          date: dateAt(Math.min(dueOffset - 30, 0)),
          dueDate: dateAt(dueOffset),
          status: 'PENDING',
          description: 'Factura de ejemplo — Piloto Demo (sin validez fiscal)',
        },
      });
    }

    const policyId = pilotId('policy');
    await tx.collectionPolicy.upsert({
      where: { id: policyId, organizationId },
      update: { shadowMode: true, autoSend: false },
      create: {
        id: policyId,
        organizationId,
        name: 'Plan de cobranza por niveles — Demo',
        maxContactsPerWeek: 3,
        allowedContactStartHour: 9,
        allowedContactEndHour: 19,
        timezone: 'America/Mexico_City',
        gracePeriodDays: 0,
        escalationThresholdDays: 35,
        preferredChannel: 'WHATSAPP',
        shadowMode: true,
        autoSend: false,
      },
    });
    for (const [i, step] of LEVEL_PLAN_STEPS.entries()) {
      await tx.collectionSequenceStep.upsert({
        where: { id: pilotId(`step-${i + 1}`), collectionPolicy: { organizationId } },
        update: {},
        create: {
          ...step,
          id: pilotId(`step-${i + 1}`),
          collectionPolicyId: policyId,
          stepOrder: i + 1,
        },
      });
    }

    const statementId = pilotId('statement');
    await tx.bankStatementImport.upsert({
      where: { id: statementId, organizationId },
      update: {},
      create: {
        id: statementId,
        organizationId,
        bankName: 'Banco Demo — estado de cuenta de ejemplo',
        importedAt: now,
        periodFrom: dateAt(-7),
        periodTo: dateAt(0),
        totalTransactions: 4,
        unmatchedCount: 4,
      },
    });
    const movements = [
      { amount: 1160, description: 'Abono de ejemplo DEMO-001', isDebit: false },
      { amount: 1276, description: 'Abono de ejemplo DEMO-002', isDebit: false },
      { amount: 150, description: 'Cargo de ejemplo por comisión', isDebit: true },
      { amount: 300, description: 'Cargo de ejemplo por servicio', isDebit: true },
    ];
    for (const [i, movement] of movements.entries()) {
      await tx.bankTransaction.upsert({
        where: { id: pilotId(`movement-${i + 1}`), organizationId },
        update: {},
        create: {
          ...movement,
          id: pilotId(`movement-${i + 1}`),
          organizationId,
          bankStatementImportId: statementId,
          transactionDate: dateAt(-3 + i),
          referenceNumber: `DEMO-MOV-${i + 1}`,
          dedupeKey: `piloto:movimiento:${i + 1}`,
          rawRowData: { ejemplo: true, ...movement },
        },
      });
    }
    return { organizationId };
  });
}

export async function resetPilot(prisma: PrismaService): Promise<boolean> {
  assertDevelopment();
  return prisma.withOrg(PILOT_ORGANIZATION_ID, async (tx) => {
    const org = await tx.organization.findUnique({ where: { rfc: PILOT_RFC } });
    if (!org) return false;
    if (org.id !== PILOT_ORGANIZATION_ID || org.name !== PILOT_NAME) {
      throw new Error('El RFC del piloto pertenece a otra organización. No se borró nada.');
    }
    // Estas dos bitácoras no tienen FK; las demás relaciones usan ON DELETE CASCADE.
    await tx.aiFeedback.deleteMany({ where: { organizationId: org.id } });
    await tx.collectionReport.deleteMany({ where: { organizationId: org.id } });
    await tx.organization.delete({ where: { id: org.id, rfc: PILOT_RFC } });
    return true;
  });
}
