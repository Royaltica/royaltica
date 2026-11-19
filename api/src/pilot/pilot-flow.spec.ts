import { Prisma, type InvoiceStatus } from '@prisma/client';
import { BankReconciliationService } from '../bank-reconciliation/bank-reconciliation.service';
import { BankReconciliationMatchingService } from '../bank-reconciliation/bank-reconciliation-matching.service';
import { CollectionSafetyService } from '../collection-safety/collection-safety.service';
import { CollectionSequencesService } from '../collection-sequences/collection-sequences.service';
import { FieldMappingService } from '../external-data-sync/field-mapping.service';
import type { PrismaService } from '../common/prisma/prisma.service';
import type { ActivityLogService } from '../activity/activity-log.service';
import type { NotificationsService } from '../notifications/notifications.service';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

type Movement = { id: string; bankStatementImportId: string; organizationId: string; transactionDate: Date; amount: number; description: string; referenceNumber: string; isDebit: boolean; matchStatus: string; matchedInvoiceId: string | null; matchProposal: null };

describe('Flujo principal del piloto (sin red ni base de datos)', () => {
  afterEach(() => jest.useRealTimers());

  it('registra sombra, importa y propone un abono, frena el cobro, confirma una sola vez y deja de tomar la factura pagada', async () => {
    const now = new Date('2026-11-18T17:00:00Z');
    jest.useFakeTimers({ now });
    const organizationId = 'org-piloto';
    const customer = { id: 'cliente-piloto', name: 'Cliente de prueba', phone: '+520000000001', doNotContact: false, paymentClaimedAt: null, score: null, riskTier: null };
    const invoice = { id: 'factura-piloto', organizationId, direction: 'RECEIVABLE', folio: 'DEMO-FLUJO-1', total: new Prisma.Decimal(1160), subtotal: new Prisma.Decimal(1000), amountPaid: new Prisma.Decimal(0), status: 'PENDING' as InvoiceStatus, date: new Date('2026-10-17T00:00:00Z'), dueDate: new Date('2026-11-17T00:00:00Z'), deletedAt: null, paymentClaimedAt: null, customerId: customer.id, customer };
    const step = { id: 'paso-piloto', stepOrder: 1, daysAfterDue: 1, tone: 'STANDARD', channel: 'WHATSAPP', escalatesToHuman: false, whatsappTemplateName: null };
    const policy = { id: 'politica-piloto', organizationId, isActive: true, deletedAt: null, shadowMode: true, autoSend: false, gracePeriodDays: 0, allowedContactStartHour: 9, allowedContactEndHour: 19, timezone: 'America/Mexico_City', blackoutDates: [], maxContactsPerWeek: 3, paymentDataMaxAgeHours: null, sequenceSteps: [step] };
    let run: { id: string; status: string; currentStepOrder: number } | null = null;
    const movements: Movement[] = [];
    let paid = 0;
    const activity = { record: jest.fn().mockResolvedValue(undefined) };
    const notifications = { notifyOrgAdmins: jest.fn().mockResolvedValue(1) };
    const send = jest.fn().mockRejectedValue(new Error('No debe haber envíos en modo sombra'));

    const tx = {
      invoice: {
        findUnique: jest.fn(async () => ({ ...invoice })),
        findMany: jest.fn(async () => invoice.status === 'PENDING' ? [{ ...invoice }] : []),
        findFirst: jest.fn(async () => ({ ...invoice })),
        update: jest.fn(async ({ data }: { data: Partial<typeof invoice> }) => Object.assign(invoice, data)),
      },
      organization: { findUnique: jest.fn().mockResolvedValue({ collectionPausedAt: null }) },
      invoiceAuditLog: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({}) },
      invoicePayment: {
        create: jest.fn(async ({ data }: { data: { amount: Prisma.Decimal } }) => { paid += Number(data.amount); return { id: 'pago-piloto' }; }),
        aggregate: jest.fn(async () => ({ _sum: { amount: new Prisma.Decimal(paid) } })),
      },
      activityLog: { count: jest.fn().mockResolvedValue(0), findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({}) },
      collectionPolicy: { findFirst: jest.fn(async () => policy) },
      collectionSequenceRun: {
        findUnique: jest.fn(async () => run),
        create: jest.fn(async () => (run = { id: 'corrida-piloto', status: 'ACTIVE', currentStepOrder: 0 })),
        updateMany: jest.fn(async () => { if (run) run.status = 'COMPLETED'; return { count: 1 }; }),
      },
      $queryRaw: jest.fn(async (sql: TemplateStringsArray, ...args: unknown[]) => {
        const query = sql.join('?');
        if (query.includes('ExternalSyncFieldMapping')) return [];
        if (query.includes('COUNT(*)')) return [{ matched: BigInt(movements.filter((m) => m.matchStatus !== 'UNMATCHED').length), unmatched: 0n }];
        if (query.includes('SELECT * FROM "BankTransaction"')) {
          return movements.filter((m) => m.organizationId === args[1] && (query.includes('"bankStatementImportId" =') ? m.bankStatementImportId === args[0] && m.matchStatus === 'UNMATCHED' : m.id === args[0])).map((m) => ({ ...m }));
        }
        if (query.includes('SELECT "id" FROM "BankTransaction"')) {
          return movements.filter((m) => m.organizationId === args[0] && m.matchedInvoiceId === args[2] && m.matchStatus !== 'MANUALLY_MATCHED' && !m.isDebit).map((m) => ({ id: m.id }));
        }
        throw new Error('Consulta inesperada en el flujo del piloto');
      }),
      $executeRaw: jest.fn(async (sql: TemplateStringsArray, ...args: unknown[]) => {
        const query = sql.join('?');
        if (query.includes('INSERT INTO "BankTransaction"')) {
          movements.push({ id: args[0] as string, bankStatementImportId: args[1] as string, organizationId: args[2] as string, transactionDate: args[3] as Date, amount: args[4] as number, description: args[5] as string, referenceNumber: args[6] as string, isDebit: args[8] as boolean, matchStatus: 'UNMATCHED', matchedInvoiceId: null, matchProposal: null });
        } else if (query.includes('UPDATE "BankTransaction"') && query.includes("'AUTO_MATCHED'")) {
          const movement = movements.find((m) => m.id === args[2])!;
          movement.matchStatus = 'AUTO_MATCHED'; movement.matchedInvoiceId = args[0] as string;
        } else if (query.includes('UPDATE "BankTransaction"') && query.includes("'MANUALLY_MATCHED'")) {
          const movement = movements.find((m) => m.id === args[2])!;
          if (movement.matchStatus === 'MANUALLY_MATCHED') return 0;
          movement.matchStatus = 'MANUALLY_MATCHED'; movement.matchedInvoiceId = args[0] as string;
        }
        return 1;
      }),
    };
    const prisma = { ...tx, withOrg: jest.fn(async <T>(id: string, fn: (client: Prisma.TransactionClient) => Promise<T>) => {
      expect(id).toBe(organizationId);
      return fn(tx as unknown as Prisma.TransactionClient);
    }) } as unknown as PrismaService;
    const safety = new CollectionSafetyService(prisma, {} as never);
    const engine = new CollectionSequencesService(prisma, activity as unknown as ActivityLogService, { sendCollectionSequenceStep: send } as never, { sendMessage: send } as never, notifications as unknown as NotificationsService, {} as never, { sendCollectionStep: send } as never, safety, {} as never);
    const matching = new BankReconciliationMatchingService(prisma, activity as unknown as ActivityLogService, notifications as unknown as NotificationsService);
    const banking = new BankReconciliationService(prisma, activity as unknown as ActivityLogService, new FieldMappingService(prisma), matching);

    await expect(engine.advanceSequence(invoice.id)).resolves.toMatchObject({ reason: 'shadow-mode' });
    expect(activity.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'COLLECTION_SEQUENCE_STEP_SHADOW' }));
    expect(run).toMatchObject({ currentStepOrder: 0 });
    const imported = await banking.importStatement({ id: 'admin-piloto', organizationId } as AuthenticatedUser, { buffer: Buffer.from('transactionDate,amount,description,referenceNumber\n2026-11-18,1160,Abono DEMO-FLUJO-1,DEMO-FLUJO-1\n') }, 'Banco de prueba');
    expect(imported).toMatchObject({ imported: 1, autoMatched: 1, errors: [] });
    await expect(engine.advanceSequence(invoice.id)).resolves.toMatchObject({ reason: 'payment-pending-review' });
    expect(invoice.status).toBe('PENDING');
    expect(paid).toBe(0);
    await expect(matching.confirmMatch(movements[0].id, organizationId, 'admin-piloto')).resolves.toMatchObject({ settled: [invoice.id] });
    expect(invoice.status).toBe('PAID');
    expect(Number(invoice.amountPaid)).toBe(1160);
    await expect(engine.advanceSequence(invoice.id)).resolves.toMatchObject({ reason: 'invoice-not-pending' });
    expect(run).toMatchObject({ status: 'COMPLETED' });
    await expect(matching.confirmMatch(movements[0].id, organizationId, 'admin-piloto')).rejects.toThrow('ya se concilió');
    expect(tx.invoicePayment.create).toHaveBeenCalledTimes(1);
    expect(send).not.toHaveBeenCalled();
  });
});
