import { CollectionSequencesService } from './collection-sequences.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { ActivityLogService } from '../activity/activity-log.service';
import { EmailService } from '../email/email.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { NotificationsService } from '../notifications/notifications.service';

/** Política base: ventana 9-17 UTC, sin gracia, sin tope de contactos. */
const basePolicy = {
  id: 'pol-1',
  organizationId: 'org-1',
  isActive: true,
  deletedAt: null,
  gracePeriodDays: 0,
  allowedContactStartHour: 9,
  allowedContactEndHour: 17,
  timezone: 'UTC',
  maxContactsPerWeek: 10,
  blackoutDates: [] as Date[],
};

const step1 = {
  id: 'step-1',
  collectionPolicyId: 'pol-1',
  stepOrder: 1,
  daysAfterDue: 0,
  channel: 'EMAIL',
  tone: 'GENTLE',
  messageTemplate:
    'Hola {{customerName}}, tu saldo es {{amount}}, venció el {{dueDate}} ({{daysOverdue}} días de atraso).',
  escalatesToHuman: false,
  deletedAt: null,
};

const baseInvoice = {
  id: 'inv-1',
  organizationId: 'org-1',
  direction: 'RECEIVABLE',
  deletedAt: null,
  status: 'PENDING',
  dueDate: new Date('2026-07-25T00:00:00Z'),
  total: 1000,
  folio: 'F-1',
  cfdiUuid: '11111111-1111-1111-1111-111111111111',
  customer: {
    id: 'cust-1',
    name: 'Cliente Uno',
    email: 'cliente@example.com',
    phone: '+15145550000',
  },
};

describe('CollectionSequencesService', () => {
  let service: CollectionSequencesService;
  let prisma: {
    invoice: { findUnique: jest.Mock };
    collectionPolicy: { findFirst: jest.Mock };
    collectionSequenceRun: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    organization: { findUnique: jest.Mock; findMany: jest.Mock };
    activityLog: { count: jest.Mock };
    withOrg: jest.Mock;
  };
  let activity: { record: jest.Mock };
  let email: { sendCollectionSequenceStep: jest.Mock };
  let whatsapp: { sendMessage: jest.Mock };
  let notifications: { notifyOrgAdmins: jest.Mock };

  beforeEach(() => {
    prisma = {
      invoice: { findUnique: jest.fn().mockResolvedValue(baseInvoice) },
      collectionPolicy: {
        findFirst: jest.fn().mockResolvedValue({
          ...basePolicy,
          sequenceSteps: [step1],
        }),
      },
      collectionSequenceRun: {
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockImplementation(({ data }) => ({
          id: 'run-1',
          currentStepOrder: 0,
          status: 'ACTIVE',
          ...data,
        })),
        update: jest.fn().mockImplementation(({ data }) => ({ id: 'run-1', ...data })),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      organization: {
        findUnique: jest.fn().mockResolvedValue({ locale: 'en-CA', currency: 'CAD' }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      activityLog: { count: jest.fn().mockResolvedValue(0) },
      withOrg: jest.fn(),
    };
    prisma.withOrg.mockImplementation((_orgId: string, fn: (tx: unknown) => unknown) =>
      fn(prisma),
    );

    activity = { record: jest.fn().mockResolvedValue(undefined) };
    email = {
      sendCollectionSequenceStep: jest.fn().mockResolvedValue({ sent: true }),
    };
    whatsapp = { sendMessage: jest.fn().mockResolvedValue({ sent: true }) };
    notifications = { notifyOrgAdmins: jest.fn().mockResolvedValue(1) };

    service = new CollectionSequencesService(
      prisma as unknown as PrismaService,
      activity as unknown as ActivityLogService,
      email as unknown as EmailService,
      whatsapp as unknown as WhatsappService,
      notifications as unknown as NotificationsService,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('avanza la secuencia: crea la ejecución, envía el paso 1 por email y actualiza currentStepOrder', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-01T12:00:00Z')); // 12:00 UTC, dentro de la ventana

    const result = await service.advanceSequence('inv-1');

    expect(result.outcome).toBe('sent');
    expect(result.stepOrder).toBe(1);
    expect(email.sendCollectionSequenceStep).toHaveBeenCalledTimes(1);
    const [to, , body] = email.sendCollectionSequenceStep.mock.calls[0];
    expect(to).toBe('cliente@example.com');
    expect(body).toContain('Cliente Uno');
    expect(body).not.toContain('{{'); // placeholders resueltos

    expect(prisma.collectionSequenceRun.create).toHaveBeenCalledTimes(1);
    expect(prisma.collectionSequenceRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ currentStepOrder: 1, status: 'COMPLETED' }),
      }),
    );
    expect(activity.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'COLLECTION_SEQUENCE_STEP_SENT' }),
    );
  });

  it('guard rail: fuera de la ventana horaria permitida, no envía y no avanza el paso', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-01T03:00:00Z')); // 03:00 UTC, fuera de 9-17

    const result = await service.advanceSequence('inv-1');

    expect(result.outcome).toBe('skipped');
    expect(result.reason).toBe('outside-contact-window');
    expect(email.sendCollectionSequenceStep).not.toHaveBeenCalled();
    expect(whatsapp.sendMessage).not.toHaveBeenCalled();
    expect(prisma.collectionSequenceRun.update).not.toHaveBeenCalled();
    expect(activity.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'COLLECTION_SEQUENCE_STEP_SKIPPED',
        metadata: expect.objectContaining({ reason: 'outside-contact-window' }),
      }),
    );
  });

  it('guard rail: tope de contactos por semana alcanzado, omite el envío', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-01T12:00:00Z'));
    prisma.activityLog.count.mockResolvedValue(10); // == maxContactsPerWeek

    const result = await service.advanceSequence('inv-1');

    expect(result.outcome).toBe('skipped');
    expect(result.reason).toBe('max-contacts-per-week');
    expect(email.sendCollectionSequenceStep).not.toHaveBeenCalled();
  });

  it('escala a un humano cuando el paso tiene escalatesToHuman=true, sin enviar mensaje automático', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-01T12:00:00Z'));
    prisma.collectionPolicy.findFirst.mockResolvedValue({
      ...basePolicy,
      sequenceSteps: [{ ...step1, escalatesToHuman: true }],
    });

    const result = await service.advanceSequence('inv-1');

    expect(result.outcome).toBe('escalated');
    expect(notifications.notifyOrgAdmins).toHaveBeenCalledTimes(1);
    expect(notifications.notifyOrgAdmins).toHaveBeenCalledWith(
      'org-1',
      expect.objectContaining({ type: 'COLLECTION_SEQUENCE_ESCALATED' }),
    );
    expect(email.sendCollectionSequenceStep).not.toHaveBeenCalled();
    expect(whatsapp.sendMessage).not.toHaveBeenCalled();
    expect(prisma.collectionSequenceRun.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'ESCALATED' }) }),
    );
    expect(activity.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'COLLECTION_SEQUENCE_ESCALATED' }),
    );
  });

  it('sin política activa con pasos, no crea ejecución y omite', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-01T12:00:00Z'));
    prisma.collectionPolicy.findFirst.mockResolvedValue(null);

    const result = await service.advanceSequence('inv-1');

    expect(result.outcome).toBe('skipped');
    expect(result.reason).toBe('no-active-policy-or-steps');
    expect(prisma.collectionSequenceRun.create).not.toHaveBeenCalled();
  });

  it('factura pagada: cierra ejecuciones activas y no envía mensajes', async () => {
    prisma.invoice.findUnique.mockResolvedValue({ ...baseInvoice, status: 'PAID' });

    const result = await service.advanceSequence('inv-1');

    expect(result.outcome).toBe('skipped');
    expect(result.reason).toBe('invoice-not-pending');
    expect(prisma.collectionSequenceRun.updateMany).toHaveBeenCalledWith({
      where: { invoiceId: 'inv-1', status: { in: ['ACTIVE', 'PAUSED'] } },
      data: { status: 'COMPLETED' },
    });
    expect(email.sendCollectionSequenceStep).not.toHaveBeenCalled();
    expect(whatsapp.sendMessage).not.toHaveBeenCalled();
  });

  it('run pausado: no avanza ni envía mensajes', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-01T12:00:00Z'));
    prisma.collectionSequenceRun.findUnique.mockResolvedValue({
      id: 'run-1',
      organizationId: 'org-1',
      invoiceId: 'inv-1',
      collectionPolicyId: 'pol-1',
      currentStepOrder: 0,
      status: 'PAUSED',
      lastStepSentAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.advanceSequence('inv-1');

    expect(result.outcome).toBe('skipped');
    expect(result.reason).toBe('run-paused');
    expect(email.sendCollectionSequenceStep).not.toHaveBeenCalled();
    expect(prisma.collectionSequenceRun.update).not.toHaveBeenCalled();
  });

  it('blackout date: no envía y no consume el paso', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-01T12:00:00Z'));
    prisma.collectionPolicy.findFirst.mockResolvedValue({
      ...basePolicy,
      blackoutDates: [new Date('2026-08-01T00:00:00Z')],
      sequenceSteps: [step1],
    });

    const result = await service.advanceSequence('inv-1');

    expect(result.outcome).toBe('skipped');
    expect(result.reason).toBe('blackout-date');
    expect(email.sendCollectionSequenceStep).not.toHaveBeenCalled();
    expect(prisma.collectionSequenceRun.update).not.toHaveBeenCalled();
  });

  it('ejecución repetida: no duplica el mensaje de un paso ya consumido', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-01T12:00:00Z'));
    prisma.collectionSequenceRun.findUnique.mockResolvedValue({
      id: 'run-1',
      organizationId: 'org-1',
      invoiceId: 'inv-1',
      collectionPolicyId: 'pol-1',
      currentStepOrder: 1,
      status: 'ACTIVE',
      lastStepSentAt: new Date('2026-07-30T12:00:00Z'),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.advanceSequence('inv-1');

    expect(result.outcome).toBe('completed');
    expect(email.sendCollectionSequenceStep).not.toHaveBeenCalled();
    expect(prisma.collectionSequenceRun.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'COMPLETED' } }),
    );
  });

  it('consulta runs aislados por organizationId del usuario', async () => {
    const user = { id: 'u-1', organizationId: 'org-2' } as never;

    await service.findRuns(user);

    expect(prisma.withOrg).toHaveBeenCalledWith('org-2', expect.any(Function));
    expect(prisma.collectionSequenceRun.findMany).toHaveBeenCalledWith({
      where: { organizationId: 'org-2' },
      orderBy: { updatedAt: 'desc' },
    });
  });
});
