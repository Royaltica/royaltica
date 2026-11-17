import { CollectionSequencesService } from './collection-sequences.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { ActivityLogService } from '../activity/activity-log.service';
import { EmailService } from '../email/email.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CollectionSequencesAiDecisionService } from './collection-sequences-ai-decision.service';
import { WhatsappConversationService } from '../whatsapp/whatsapp-conversation.service';
import { pickNextStep } from './collection-sequences.service';
import { CollectionSafetyService } from '../collection-safety/collection-safety.service';
import { SettingsService } from '../settings/settings.service';
import { localDay } from './collection-sequences.service';

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
    collectionSequenceStep: {
      create: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
    };
    activityLog: { count: jest.Mock };
    withOrg: jest.Mock;
  };
  let activity: { record: jest.Mock };
  let email: { sendCollectionSequenceStep: jest.Mock };
  let whatsapp: { sendMessage: jest.Mock };
  let notifications: { notifyOrgAdmins: jest.Mock };
  let aiDecision: { decideNextAction: jest.Mock };
  let conversations: { sendCollectionStep: jest.Mock };
  let safety: {
    checkBeforeSend: jest.Mock;
    withOrganizationLock: jest.Mock;
    claimDailyRun: jest.Mock;
    releaseDailyRun: jest.Mock;
  };
  let settings: { get: jest.Mock };

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
      collectionSequenceStep: {
        create: jest.fn().mockImplementation(({ data }) => ({ id: 'step-new', ...data })),
        findFirst: jest.fn().mockResolvedValue(step1),
        update: jest.fn().mockImplementation(({ data }) => ({ ...step1, ...data })),
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
    // Por defecto no se llama (aiDecisionEnabled=false en basePolicy); las
    // pruebas que activan el flag configuran su propio mockResolvedValue.
    aiDecision = { decideNextAction: jest.fn() };
    conversations = {
      sendCollectionStep: jest.fn().mockResolvedValue({ sent: true, kind: 'TEMPLATE' }),
    };

    safety = {
      checkBeforeSend: jest.fn().mockResolvedValue({ ok: true }),
      withOrganizationLock: jest.fn().mockImplementation((_org: string, fn: () => unknown) => fn()),
      claimDailyRun: jest.fn().mockResolvedValue(true),
      releaseDailyRun: jest.fn().mockResolvedValue(undefined),
    };
    settings = { get: jest.fn().mockResolvedValue({ collectionEngineHour: 11 }) };

    service = new CollectionSequencesService(
      prisma as unknown as PrismaService,
      activity as unknown as ActivityLogService,
      email as unknown as EmailService,
      whatsapp as unknown as WhatsappService,
      notifications as unknown as NotificationsService,
      aiDecision as unknown as CollectionSequencesAiDecisionService,
      conversations as unknown as WhatsappConversationService,
      safety as unknown as CollectionSafetyService,
      settings as unknown as SettingsService,
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

  it('Fase 2 — cliente RIESGO: salta los niveles GENTLE y arranca en el primer paso STANDARD+', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-01T12:00:00Z'));
    const gentle1 = { ...step1, id: 'g1', stepOrder: 1, daysAfterDue: -14, tone: 'GENTLE' };
    const gentle2 = { ...step1, id: 'g2', stepOrder: 2, daysAfterDue: -7, tone: 'GENTLE' };
    const standard = { ...step1, id: 's3', stepOrder: 3, daysAfterDue: 0, tone: 'STANDARD' };
    prisma.collectionPolicy.findFirst.mockResolvedValue({
      ...basePolicy,
      sequenceSteps: [gentle1, gentle2, standard],
    });
    prisma.invoice.findUnique.mockResolvedValue({
      ...baseInvoice,
      customer: { ...baseInvoice.customer, riskTier: 'RIESGO' },
    });

    const result = await service.advanceSequence('inv-1');

    expect(result.outcome).toBe('sent');
    expect(result.stepOrder).toBe(3); // el STANDARD, no el GENTLE 1
    expect(prisma.collectionSequenceRun.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ currentStepOrder: 2 }) }),
    );
    // Los 2 niveles GENTLE quedan en bitácora como saltados (auditoría), no silenciosos.
    expect(activity.record).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ stepOrder: 1, reason: 'risk-tier-fast-track' }),
      }),
    );
    expect(activity.record).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ stepOrder: 2, reason: 'risk-tier-fast-track' }),
      }),
    );
  });

  it('Fase 2 — cliente SANO (sin riskTier) sigue el plan completo, incluido el primer GENTLE', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-01T12:00:00Z'));
    const gentle1 = { ...step1, id: 'g1', stepOrder: 1, daysAfterDue: 0, tone: 'GENTLE' };
    prisma.collectionPolicy.findFirst.mockResolvedValue({
      ...basePolicy,
      sequenceSteps: [gentle1],
    });

    const result = await service.advanceSequence('inv-1');

    expect(result.outcome).toBe('sent');
    expect(result.stepOrder).toBe(1);
    expect(prisma.collectionSequenceRun.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ currentStepOrder: 0 }) }),
    );
  });

  it('Fase 2 — cliente ATENCION NO se fast-trackea (solo RIESGO/INCOBRABLE)', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-01T12:00:00Z'));
    const gentle1 = { ...step1, id: 'g1', stepOrder: 1, daysAfterDue: 0, tone: 'GENTLE' };
    prisma.collectionPolicy.findFirst.mockResolvedValue({
      ...basePolicy,
      sequenceSteps: [gentle1],
    });
    prisma.invoice.findUnique.mockResolvedValue({
      ...baseInvoice,
      customer: { ...baseInvoice.customer, riskTier: 'ATENCION' },
    });

    const result = await service.advanceSequence('inv-1');

    expect(result.stepOrder).toBe(1); // recibe el GENTLE normal, no se salta nada
  });

  it('guard rail: fuera de la ventana horaria permitida, no envía y no avanza el paso', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-01T03:00:00Z')); // 03:00 UTC, fuera de 9-17

    const result = await service.advanceSequence('inv-1');

    expect(result.outcome).toBe('skipped');
    expect(result.reason).toBe('outside-contact-window');
    expect(email.sendCollectionSequenceStep).not.toHaveBeenCalled();
    expect(conversations.sendCollectionStep).not.toHaveBeenCalled();
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
    expect(conversations.sendCollectionStep).not.toHaveBeenCalled();
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
    expect(conversations.sendCollectionStep).not.toHaveBeenCalled();
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

  it('aiDecisionEnabled=false (default): no consulta la IA y el comportamiento determinista no cambia', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-01T12:00:00Z'));
    // basePolicy no define aiDecisionEnabled (undefined = falsy = comportamiento previo).

    const result = await service.advanceSequence('inv-1');

    expect(result.outcome).toBe('sent');
    expect(result.stepOrder).toBe(1);
    expect(aiDecision.decideNextAction).not.toHaveBeenCalled();
    expect(email.sendCollectionSequenceStep).toHaveBeenCalledTimes(1);
    const [, , , , tone] = email.sendCollectionSequenceStep.mock.calls[0];
    expect(tone).toBe('GENTLE'); // tono fijo del paso, no el de la IA
  });

  it('aiDecisionEnabled=true + acción HOLD: no envía ni avanza el paso', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-01T12:00:00Z'));
    prisma.collectionPolicy.findFirst.mockResolvedValue({
      ...basePolicy,
      aiDecisionEnabled: true,
      sequenceSteps: [step1],
    });
    aiDecision.decideNextAction.mockResolvedValue({
      action: 'HOLD',
      reasoning: 'Cliente de alto valor, primer atraso: no presionar aún.',
      aiDriven: true,
    });

    const result = await service.advanceSequence('inv-1');

    expect(result.outcome).toBe('skipped');
    expect(result.reason).toBe('ai-hold');
    expect(email.sendCollectionSequenceStep).not.toHaveBeenCalled();
    expect(prisma.collectionSequenceRun.update).not.toHaveBeenCalled();
    expect(activity.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'COLLECTION_SEQUENCE_STEP_SKIPPED',
        metadata: expect.objectContaining({ reason: 'ai-hold' }),
      }),
    );
  });

  it('aiDecisionEnabled=true + acción ESCALATE: escala igual que un paso escalatesToHuman', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-01T12:00:00Z'));
    prisma.collectionPolicy.findFirst.mockResolvedValue({
      ...basePolicy,
      aiDecisionEnabled: true,
      sequenceSteps: [step1], // step1.escalatesToHuman = false
    });
    aiDecision.decideNextAction.mockResolvedValue({
      action: 'ESCALATE',
      reasoning: 'Monto alto y atraso severo: requiere seguimiento humano.',
      aiDriven: true,
    });

    const result = await service.advanceSequence('inv-1');

    expect(result.outcome).toBe('escalated');
    expect(notifications.notifyOrgAdmins).toHaveBeenCalledTimes(1);
    expect(email.sendCollectionSequenceStep).not.toHaveBeenCalled();
    expect(activity.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'COLLECTION_SEQUENCE_ESCALATED',
        metadata: expect.objectContaining({
          aiReasoning: 'Monto alto y atraso severo: requiere seguimiento humano.',
        }),
      }),
    );
  });

  it('aiDecisionEnabled=true + acción SEND con canal sugerido: usa el canal de la IA', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-01T12:00:00Z'));
    prisma.collectionPolicy.findFirst.mockResolvedValue({
      ...basePolicy,
      aiDecisionEnabled: true,
      sequenceSteps: [step1], // step1.channel = EMAIL
    });
    aiDecision.decideNextAction.mockResolvedValue({
      action: 'SEND',
      channel: 'WHATSAPP',
      tone: 'FIRM',
      reasoning: 'Cliente no responde a correo; WhatsApp históricamente funciona mejor.',
      aiDriven: true,
    });

    const result = await service.advanceSequence('inv-1');

    expect(result.outcome).toBe('sent');
    expect(conversations.sendCollectionStep).toHaveBeenCalledTimes(1);
    expect(email.sendCollectionSequenceStep).not.toHaveBeenCalled();
    expect(activity.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'COLLECTION_SEQUENCE_STEP_SENT',
        metadata: expect.objectContaining({ channel: 'WHATSAPP', tone: 'FIRM' }),
      }),
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

  describe('createStep / updateStep — FR-10 (regulación jurídica de plantillas)', () => {
    const user = { id: 'u-1', organizationId: 'org-1' } as never;
    const validDtoObj = {
      stepOrder: 2,
      daysAfterDue: 5,
      channel: 'EMAIL',
      messageTemplate: 'Hola {{customerName}}, tu saldo {{amount}} venció el {{dueDate}}.',
    };

    it('crea el paso cuando la plantilla usa solo variables aprobadas', async () => {
      await service.createStep(user, 'pol-1', validDtoObj as never);
      expect(prisma.collectionSequenceStep.create).toHaveBeenCalledTimes(1);
    });

    it('rechaza el paso si la plantilla usa una variable no aprobada', async () => {
      const dto = {
        ...validDtoObj,
        messageTemplate: 'Hola {{customerName}}, tu RFC es {{taxId}}.',
      };

      await expect(service.createStep(user, 'pol-1', dto as never)).rejects.toThrow(
        /no cumple con la regulación jurídica/,
      );
      expect(prisma.collectionSequenceStep.create).not.toHaveBeenCalled();
    });

    it('rechaza el paso si la plantilla amenaza con acción penal por una deuda civil', async () => {
      const dto = {
        ...validDtoObj,
        messageTemplate: 'Paga {{amount}} o vas a la cárcel, {{customerName}}.',
      };

      await expect(service.createStep(user, 'pol-1', dto as never)).rejects.toThrow(
        /no cumple con la regulación jurídica/,
      );
    });

    it('updateStep valida la plantilla solo si viene en el PATCH', async () => {
      await service.updateStep(user, 'pol-1', 'step-1', {} as never);
      expect(prisma.collectionSequenceStep.update).toHaveBeenCalledTimes(1);

      const badDto = {
        messageTemplate: 'Le avisaremos a tu jefe que debes {{amount}}.',
      } as never;
      await expect(
        service.updateStep(user, 'pol-1', 'step-1', badDto),
      ).rejects.toThrow(/no cumple con la regulación jurídica/);
    });
  });

  describe('plan por niveles (cobranza temprana con plantillas de Meta)', () => {
    const lvl = (stepOrder: number, daysAfterDue: number, whatsappTemplateName: string | null) => ({
      ...step1,
      id: `s-${stepOrder}`,
      stepOrder,
      daysAfterDue,
      channel: 'WHATSAPP',
      whatsappTemplateName,
    });
    const plan = [
      lvl(1, -90, 'royaltica_nivel_0'),
      lvl(2, -14, 'nivel_1'),
      lvl(3, -7, 'nivel_2'),
      lvl(4, -3, 'nivel_3'),
      lvl(5, 0, 'nivel_4'),
      lvl(6, 1, 'aviso_vencida'),
    ];

    it('primer contacto antes del vencimiento: manda la confirmación aunque otros niveles ya apliquen', () => {
      const r = pickNextStep(plan, 0, -10);
      expect(r.step?.whatsappTemplateName).toBe('royaltica_nivel_0');
      expect(r.superseded).toHaveLength(0);
    });

    it('niveles previos que ya no aplican se saltan (no se manda el aviso de 14 días a 6 días de vencer)', () => {
      const r = pickNextStep(plan, 1, -6);
      expect(r.step?.whatsappTemplateName).toBe('nivel_2');
      expect(r.superseded.map((s) => s.whatsappTemplateName)).toEqual(['nivel_1']);
    });

    it('"vence en 3 días" solo se manda ese día exacto; si ya pasó, espera al siguiente nivel', () => {
      const r = pickNextStep(plan, 3, -1);
      // nivel_3 quedó atrás y nivel_4 (día 0) aún no toca
      expect(r.step?.whatsappTemplateName).toBe('nivel_4');
      expect(r.superseded.map((s) => s.whatsappTemplateName)).toEqual(['nivel_3']);
    });

    it('sin pasos negativos se comporta igual que antes: siguiente en orden si ya le toca', () => {
      const legacy = [{ ...step1, whatsappTemplateName: null }];
      expect(pickNextStep(legacy, 0, 3).step?.stepOrder).toBe(1);
      expect(pickNextStep(legacy, 1, 3).step).toBeUndefined();
    });

    it('advanceSequence antes del vencimiento manda el nivel por WhatsApp con su plantilla', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-07-18T12:00:00Z')); // 7 días antes del 25
      prisma.collectionPolicy.findFirst.mockResolvedValue({ ...basePolicy, sequenceSteps: plan });
      prisma.collectionSequenceRun.findUnique.mockResolvedValue({
        id: 'run-1',
        currentStepOrder: 2,
        status: 'ACTIVE',
      });

      const result = await service.advanceSequence('inv-1');

      expect(result).toEqual({ outcome: 'sent', stepOrder: 3 });
      expect(conversations.sendCollectionStep).toHaveBeenCalledWith(
        expect.objectContaining({ templateName: 'nivel_2' }),
      );
    });

    it('modo con aprobación: el motor no manda nada solo', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-07-18T12:00:00Z'));
      prisma.collectionPolicy.findFirst.mockResolvedValue({ ...basePolicy, autoSend: false, sequenceSteps: plan });
      prisma.collectionSequenceRun.findUnique.mockResolvedValue({ id: 'run-1', currentStepOrder: 2, status: 'ACTIVE' });
      const result = await service.advanceSequence('inv-1');
      expect(result.reason).toBe('awaiting-approval');
      expect(conversations.sendCollectionStep).not.toHaveBeenCalled();
    });

    it('sin niveles previos, una factura que aún no vence se omite (comportamiento original)', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-07-18T12:00:00Z'));
      const result = await service.advanceSequence('inv-1');
      expect(result).toEqual({ outcome: 'skipped', reason: 'not-yet-due' });
    });
  });

  describe('guardias de pago y modo sombra', () => {
    it('updatePlanSettings solo cambia los campos que vienen y lo deja en la bitácora', async () => {
      (prisma.collectionPolicy as unknown as { update: jest.Mock }).update = jest
        .fn()
        .mockImplementation(({ data }) => ({ id: 'pol-1', ...data }));
      jest
        .spyOn(service, 'ensureLevelPlan')
        .mockResolvedValue({ policy: { id: 'pol-1' } } as never);
      const user = { id: 'u-1', organizationId: 'org-1' } as never;

      await service.updatePlanSettings(user, { shadowMode: true, paymentDataMaxAgeHours: 36 });

      expect(
        (prisma.collectionPolicy as unknown as { update: jest.Mock }).update,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'pol-1' },
          data: { shadowMode: true, paymentDataMaxAgeHours: 36 },
        }),
      );
      expect(activity.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'COLLECTION_PLAN_SETTINGS_CHANGED' }),
      );
    });

    it('con un pago parcial registrado, el mensaje pide el saldo y no el total', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-08-01T12:00:00Z'));
      prisma.invoice.findUnique.mockResolvedValue({ ...baseInvoice, total: 1000, amountPaid: 400 });

      await service.advanceSequence('inv-1');

      const body = email.sendCollectionSequenceStep.mock.calls[0][2] as string;
      expect(body).toContain('600.00');
      expect(body).not.toContain('1,000.00');
    });

    it('no envía si la guardia de pago lo bloquea y deja el motivo registrado', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-08-01T12:00:00Z'));
      safety.checkBeforeSend.mockResolvedValue({
        ok: false,
        reason: 'payment-pending-review',
        detail: { bankTransactionId: 'tx-1' },
      });

      const result = await service.advanceSequence('inv-1');

      expect(result).toMatchObject({ outcome: 'skipped', reason: 'payment-pending-review' });
      expect(email.sendCollectionSequenceStep).not.toHaveBeenCalled();
      expect(conversations.sendCollectionStep).not.toHaveBeenCalled();
      expect(prisma.collectionSequenceRun.update).not.toHaveBeenCalled();
      expect(activity.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'COLLECTION_SEQUENCE_STEP_SKIPPED',
          metadata: expect.objectContaining({
            reason: 'payment-pending-review',
            bankTransactionId: 'tx-1',
          }),
        }),
      );
    });

    it('pasa a la guardia los datos de "ya pagué" de la factura y la frescura de la política', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-08-01T12:00:00Z'));
      const claimed = new Date('2026-07-31T10:00:00Z');
      prisma.invoice.findUnique.mockResolvedValue({ ...baseInvoice, paymentClaimedAt: claimed });
      prisma.collectionPolicy.findFirst.mockResolvedValue({
        ...basePolicy,
        paymentDataMaxAgeHours: 36,
        sequenceSteps: [step1],
      });

      await service.advanceSequence('inv-1');

      expect(safety.checkBeforeSend).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: 'org-1',
          invoiceId: 'inv-1',
          invoicePaymentClaimedAt: claimed,
          paymentDataMaxAgeHours: 36,
        }),
      );
    });

    it('en modo sombra registra lo que enviaría, no envía y no avanza la secuencia', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-08-01T12:00:00Z'));
      prisma.collectionPolicy.findFirst.mockResolvedValue({
        ...basePolicy,
        shadowMode: true,
        sequenceSteps: [step1],
      });

      const result = await service.advanceSequence('inv-1');

      expect(result).toMatchObject({ outcome: 'skipped', reason: 'shadow-mode', stepOrder: 1 });
      expect(email.sendCollectionSequenceStep).not.toHaveBeenCalled();
      expect(prisma.collectionSequenceRun.update).not.toHaveBeenCalled();
      expect(activity.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'COLLECTION_SEQUENCE_STEP_SHADOW',
          metadata: expect.objectContaining({ channel: 'EMAIL', stepOrder: 1 }),
        }),
      );
    });

    it('en modo sombra también evalúa políticas "con aprobación" (no se queda en awaiting-approval)', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-08-01T12:00:00Z'));
      prisma.collectionPolicy.findFirst.mockResolvedValue({
        ...basePolicy,
        autoSend: false,
        shadowMode: true,
        sequenceSteps: [step1],
      });

      const result = await service.advanceSequence('inv-1');

      expect(result.reason).toBe('shadow-mode');
      expect(email.sendCollectionSequenceStep).not.toHaveBeenCalled();
    });

    it('sin modo sombra, una política "con aprobación" sigue esperando a una persona', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-08-01T12:00:00Z'));
      prisma.collectionPolicy.findFirst.mockResolvedValue({
        ...basePolicy,
        autoSend: false,
        sequenceSteps: [step1],
      });

      const result = await service.advanceSequence('inv-1');

      expect(result.reason).toBe('awaiting-approval');
      expect(safety.checkBeforeSend).not.toHaveBeenCalled();
    });

    it('runEngineScan no procesa una organización si no obtiene el candado', async () => {
      prisma.organization.findMany.mockResolvedValue([{ id: 'org-1' }]);
      safety.withOrganizationLock.mockResolvedValue(null);
      const advance = jest.spyOn(service, 'advanceSequence');

      const result = await service.runEngineScan();

      expect(result.evaluated).toBe(0);
      expect(advance).not.toHaveBeenCalled();
      // Solo organizaciones sin el interruptor de emergencia encendido.
      expect(prisma.organization.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ collectionPausedAt: null }),
        }),
      );
    });
  });

  describe('motor por hora con hora de arranque por organización', () => {
    beforeEach(() => {
      prisma.organization.findMany.mockResolvedValue([{ id: 'org-1' }]);
      (prisma as unknown as { collectionSequenceStep: Record<string, jest.Mock> }).collectionSequenceStep.aggregate =
        jest.fn().mockResolvedValue({ _min: { daysAfterDue: 0 } });
      (prisma.invoice as unknown as Record<string, jest.Mock>).findMany = jest
        .fn()
        .mockResolvedValue([{ id: 'inv-1' }]);
      prisma.collectionPolicy.findFirst.mockResolvedValue({
        ...basePolicy,
        timezone: 'America/Mexico_City',
        allowedContactEndHour: 21,
        sequenceSteps: [step1],
      });
    });

    it('antes de la hora de la organización no procesa ni marca el día', async () => {
      // 16:00 UTC = 10:00 en CDMX; la organización arranca a las 11:00.
      const advance = jest.spyOn(service, 'advanceSequence');
      const r = await service.runEngineScan(new Date('2026-11-18T16:00:00Z'));
      expect(r.evaluated).toBe(0);
      expect(advance).not.toHaveBeenCalled();
      expect(safety.claimDailyRun).not.toHaveBeenCalled();
    });

    it('a partir de su hora procesa una vez y marca el día local', async () => {
      // 17:30 UTC = 11:30 en CDMX.
      const advance = jest
        .spyOn(service, 'advanceSequence')
        .mockResolvedValue({ outcome: 'sent', stepOrder: 1 });
      const r = await service.runEngineScan(new Date('2026-11-18T17:30:00Z'));
      expect(r.evaluated).toBe(1);
      expect(advance).toHaveBeenCalledWith('inv-1');
      expect(safety.claimDailyRun).toHaveBeenCalledWith('org-1', '2026-11-18');
    });

    it('si ya corrió hoy no vuelve a procesar', async () => {
      safety.claimDailyRun.mockResolvedValue(false);
      const advance = jest.spyOn(service, 'advanceSequence');
      const r = await service.runEngineScan(new Date('2026-11-18T19:00:00Z'));
      expect(r.evaluated).toBe(0);
      expect(advance).not.toHaveBeenCalled();
    });

    it('respeta la hora configurada por la organización', async () => {
      settings.get.mockResolvedValue({ collectionEngineHour: 13 });
      const advance = jest.spyOn(service, 'advanceSequence');
      // 18:30 UTC = 12:30 en CDMX: todavía no.
      await service.runEngineScan(new Date('2026-11-18T18:30:00Z'));
      expect(advance).not.toHaveBeenCalled();
    });

    it('si la corrida falla a medias libera la marca para reintentar la siguiente hora', async () => {
      jest.spyOn(service, 'advanceSequence').mockRejectedValue(new Error('db down'));
      await expect(service.runEngineScan(new Date('2026-11-18T17:30:00Z'))).rejects.toThrow('db down');
      expect(safety.releaseDailyRun).toHaveBeenCalledWith('org-1', '2026-11-18');
    });

    it('en modo sombra avisa a los administradores con el resumen del día', async () => {
      prisma.collectionPolicy.findFirst.mockResolvedValue({
        ...basePolicy,
        timezone: 'America/Mexico_City',
        allowedContactEndHour: 21,
        shadowMode: true,
        sequenceSteps: [step1],
      });
      (prisma.invoice as unknown as Record<string, jest.Mock>).findMany = jest
        .fn()
        .mockResolvedValue([{ id: 'inv-1' }, { id: 'inv-2' }]);
      jest
        .spyOn(service, 'advanceSequence')
        .mockResolvedValueOnce({ outcome: 'skipped', reason: 'shadow-mode' })
        .mockResolvedValueOnce({ outcome: 'skipped', reason: 'payment-pending-review' });

      await service.runEngineScan(new Date('2026-11-18T17:30:00Z'));

      expect(notifications.notifyOrgAdmins).toHaveBeenCalledWith(
        'org-1',
        expect.objectContaining({
          type: 'COLLECTION_SHADOW_SUMMARY',
          metadata: { shadow: 1, blocked: 1 },
        }),
      );
    });

    it('force ignora la hora y la marca diaria', async () => {
      const advance = jest.spyOn(service, 'advanceSequence').mockResolvedValue({ outcome: 'completed' });
      await service.runEngineScan(new Date('2026-11-18T08:00:00Z'), { force: true });
      expect(advance).toHaveBeenCalled();
      expect(safety.claimDailyRun).not.toHaveBeenCalled();
    });

    it('localDay usa el día de la zona horaria (no el de UTC)', () => {
      // 02:00 UTC del 19 = 20:00 del 18 en CDMX.
      expect(localDay(new Date('2026-11-19T02:00:00Z'), 'America/Mexico_City')).toBe('2026-11-18');
    });
  });
});

