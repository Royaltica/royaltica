import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  InvoiceStatus,
  type CollectionSequenceRun,
  type CollectionSequenceRunStatus,
  type CollectionSequenceStep,
} from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { ActivityLogService } from '../activity/activity-log.service';
import { EmailService } from '../email/email.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { CreateSequenceStepDto } from './dto/create-sequence-step.dto';
import { UpdateSequenceStepDto } from './dto/update-sequence-step.dto';
import {
  CollectionSequencesAiDecisionService,
  type CollectionAiDecision,
} from './collection-sequences-ai-decision.service';

/** Monto formateado como moneda (mismo helper que ReceivablesService). */
const money = (n: number, locale = 'es-MX') =>
  n.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Resultado de una corrida de `advanceSequence` sobre una factura. */
export type AdvanceOutcome =
  | 'sent'
  | 'manual-required'
  | 'escalated'
  | 'completed'
  | 'skipped';

export interface AdvanceResult {
  outcome: AdvanceOutcome;
  reason?: string;
  stepOrder?: number;
}

/**
 * Motor de escalamiento de cobranza multi-paso (Tradespace, Canadá):
 * dada una factura CxC vencida, recorre la cadena de CollectionSequenceStep
 * definida en la CollectionPolicy activa de la organización, respetando los
 * "guard rails" (ventana horaria, tope de contactos/semana, blackout dates,
 * días de gracia) y deja rastro de cada decisión en ActivityLog.
 */
@Injectable()
export class CollectionSequencesService {
  private readonly logger = new Logger(CollectionSequencesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityLogService,
    private readonly email: EmailService,
    private readonly whatsapp: WhatsappService,
    private readonly notifications: NotificationsService,
    private readonly aiDecision: CollectionSequencesAiDecisionService,
  ) {}

  // ── CRUD de pasos (anidado bajo una CollectionPolicy) ─────

  async createStep(
    user: AuthenticatedUser,
    policyId: string,
    dto: CreateSequenceStepDto,
  ) {
    const organizationId = this.requireOrg(user);
    await this.getOwnedPolicy(organizationId, policyId);

    const step = await this.prisma.withOrg(organizationId, (tx) =>
      tx.collectionSequenceStep.create({
        data: {
          collectionPolicyId: policyId,
          stepOrder: dto.stepOrder,
          daysAfterDue: dto.daysAfterDue,
          channel: dto.channel,
          tone: dto.tone ?? 'STANDARD',
          messageTemplate: dto.messageTemplate,
          escalatesToHuman: dto.escalatesToHuman ?? false,
        },
      }),
    );

    await this.activity.record({
      organizationId,
      userId: user.id,
      action: 'COLLECTION_SEQUENCE_STEP_CREATED',
      entityType: 'CollectionSequenceStep',
      entityId: step.id,
      metadata: { policyId, stepOrder: step.stepOrder, channel: step.channel },
    });

    return step;
  }

  async findAllSteps(user: AuthenticatedUser, policyId: string) {
    const organizationId = this.requireOrg(user);
    await this.getOwnedPolicy(organizationId, policyId);
    return this.prisma.withOrg(organizationId, (tx) =>
      tx.collectionSequenceStep.findMany({
        where: { collectionPolicyId: policyId, deletedAt: null },
        orderBy: { stepOrder: 'asc' },
      }),
    );
  }

  async findOneStep(user: AuthenticatedUser, policyId: string, id: string) {
    const organizationId = this.requireOrg(user);
    await this.getOwnedPolicy(organizationId, policyId);
    const step = await this.prisma.withOrg(organizationId, (tx) =>
      tx.collectionSequenceStep.findFirst({
        where: { id, collectionPolicyId: policyId, deletedAt: null },
      }),
    );
    if (!step) throw new NotFoundException('Paso de secuencia no encontrado.');
    return step;
  }

  async updateStep(
    user: AuthenticatedUser,
    policyId: string,
    id: string,
    dto: UpdateSequenceStepDto,
  ) {
    const organizationId = this.requireOrg(user);
    await this.getOwnedPolicy(organizationId, policyId);

    const updated = await this.prisma.withOrg(organizationId, async (tx) => {
      const existing = await tx.collectionSequenceStep.findFirst({
        where: { id, collectionPolicyId: policyId, deletedAt: null },
      });
      if (!existing) throw new NotFoundException('Paso de secuencia no encontrado.');

      return tx.collectionSequenceStep.update({
        where: { id },
        data: {
          stepOrder: dto.stepOrder ?? undefined,
          daysAfterDue: dto.daysAfterDue ?? undefined,
          channel: dto.channel ?? undefined,
          tone: dto.tone ?? undefined,
          messageTemplate: dto.messageTemplate ?? undefined,
          escalatesToHuman: dto.escalatesToHuman ?? undefined,
        },
      });
    });

    await this.activity.record({
      organizationId,
      userId: user.id,
      action: 'COLLECTION_SEQUENCE_STEP_UPDATED',
      entityType: 'CollectionSequenceStep',
      entityId: id,
      metadata: { fields: Object.keys(dto) },
    });

    return updated;
  }

  async removeStep(user: AuthenticatedUser, policyId: string, id: string) {
    const organizationId = this.requireOrg(user);
    await this.getOwnedPolicy(organizationId, policyId);

    await this.prisma.withOrg(organizationId, async (tx) => {
      const existing = await tx.collectionSequenceStep.findFirst({
        where: { id, collectionPolicyId: policyId, deletedAt: null },
      });
      if (!existing) throw new NotFoundException('Paso de secuencia no encontrado.');
      await tx.collectionSequenceStep.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
    });

    await this.activity.record({
      organizationId,
      userId: user.id,
      action: 'COLLECTION_SEQUENCE_STEP_DELETED',
      entityType: 'CollectionSequenceStep',
      entityId: id,
    });

    return { deleted: true, id };
  }

  // ── Ejecuciones (CollectionSequenceRun): consulta + control manual ──

  async findRuns(user: AuthenticatedUser) {
    const organizationId = this.requireOrg(user);
    return this.prisma.withOrg(organizationId, (tx) =>
      tx.collectionSequenceRun.findMany({
        where: { organizationId },
        orderBy: { updatedAt: 'desc' },
      }),
    );
  }

  /** Bandeja operacional de cobranza: runs enriquecidos con factura, cliente
   * y política para que el equipo sepa qué requiere atención humana. */
  async commandCenter(user: AuthenticatedUser) {
    const organizationId = this.requireOrg(user);
    const runs = await this.prisma.withOrg(organizationId, (tx) =>
      tx.collectionSequenceRun.findMany({
        where: { organizationId },
        orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
        include: {
          collectionPolicy: { select: { name: true, preferredChannel: true } },
          invoice: {
            select: {
              id: true,
              folio: true,
              total: true,
              currency: true,
              dueDate: true,
              status: true,
              customer: { select: { id: true, name: true, email: true, phone: true } },
            },
          },
        },
      }),
    );

    const now = Date.now();
    const items = runs.map((run) => {
      const dueDate = run.invoice.dueDate;
      const daysOverdue = dueDate
        ? Math.max(0, Math.floor((now - dueDate.getTime()) / 86_400_000))
        : 0;
      const needsHuman =
        run.status === 'ESCALATED' ||
        run.status === 'PAUSED' ||
        daysOverdue >= 30 ||
        (!(run.invoice.customer?.email) && !(run.invoice.customer?.phone));
      return {
        id: run.id,
        status: run.status,
        currentStepOrder: run.currentStepOrder,
        lastStepSentAt: run.lastStepSentAt,
        updatedAt: run.updatedAt,
        daysOverdue,
        needsHuman,
        policy: run.collectionPolicy,
        invoice: {
          ...run.invoice,
          total: Number(run.invoice.total),
        },
      };
    });

    return {
      total: items.length,
      needsHuman: items.filter((i) => i.needsHuman).length,
      active: items.filter((i) => i.status === 'ACTIVE').length,
      escalated: items.filter((i) => i.status === 'ESCALATED').length,
      items,
    };
  }

  /** Decisiones recientes de IA dentro del motor de cobranza. */
  async aiActionsInbox(user: AuthenticatedUser) {
    const organizationId = this.requireOrg(user);
    const logs = await this.prisma.withOrg(organizationId, (tx) =>
      tx.activityLog.findMany({
        where: {
          organizationId,
          action: {
            in: [
              'COLLECTION_SEQUENCE_STEP_SENT',
              'COLLECTION_SEQUENCE_STEP_SKIPPED',
              'COLLECTION_SEQUENCE_ESCALATED',
            ],
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    );

    const items = logs
      .filter((log) => {
        const metadata = log.metadata as Record<string, unknown>;
        return metadata?.aiDriven === true;
      })
      .map((log) => {
        const metadata = log.metadata as Record<string, unknown>;
        return {
          id: log.id,
          action: log.action,
          createdAt: log.createdAt,
          runId: log.entityId,
          invoiceId: metadata.invoiceId,
          stepOrder: metadata.stepOrder,
          channel: metadata.channel,
          tone: metadata.tone,
          reason: metadata.reason,
          aiReasoning: metadata.aiReasoning,
        };
      });

    return { total: items.length, items };
  }

  async findRun(user: AuthenticatedUser, id: string) {
    const organizationId = this.requireOrg(user);
    const run = await this.prisma.withOrg(organizationId, (tx) =>
      tx.collectionSequenceRun.findFirst({ where: { id, organizationId } }),
    );
    if (!run) throw new NotFoundException('Ejecución de secuencia no encontrada.');
    return run;
  }

  /** Pausa manual (ej. cliente en negociación de pago): el motor deja de avanzarla. */
  async pauseRun(user: AuthenticatedUser, id: string) {
    return this.setRunStatus(user, id, 'PAUSED', 'COLLECTION_SEQUENCE_RUN_PAUSED');
  }

  /** Reanuda una ejecución pausada o escalada (un humano decide volver a automatizar). */
  async resumeRun(user: AuthenticatedUser, id: string) {
    return this.setRunStatus(user, id, 'ACTIVE', 'COLLECTION_SEQUENCE_RUN_RESUMED');
  }

  /** Cancela definitivamente (ej. cuenta enviada a legal/factoraje, ya no aplica cobranza automática). */
  async cancelRun(user: AuthenticatedUser, id: string) {
    return this.setRunStatus(user, id, 'CANCELLED', 'COLLECTION_SEQUENCE_RUN_CANCELLED');
  }

  private async setRunStatus(
    user: AuthenticatedUser,
    id: string,
    status: CollectionSequenceRunStatus,
    action: string,
  ) {
    const organizationId = this.requireOrg(user);
    const updated = await this.prisma.withOrg(organizationId, async (tx) => {
      const existing = await tx.collectionSequenceRun.findFirst({
        where: { id, organizationId },
      });
      if (!existing) throw new NotFoundException('Ejecución de secuencia no encontrada.');
      return tx.collectionSequenceRun.update({ where: { id }, data: { status } });
    });

    await this.activity.record({
      organizationId,
      userId: user.id,
      action,
      entityType: 'CollectionSequenceRun',
      entityId: id,
      metadata: { status },
    });

    return updated;
  }

  // ── Motor de escalamiento (uso interno, disparado por JobsService) ──

  /**
   * Recorre las organizaciones con una CollectionPolicy activa y avanza la
   * secuencia de cada factura CxC vencida. Idempotente: cada corrida evalúa
   * el estado real (run.currentStepOrder, guard rails) antes de actuar.
   */
  async runEngineScan(): Promise<{
    evaluated: number;
    sent: number;
    escalated: number;
    skipped: number;
  }> {
    let evaluated = 0;
    let sent = 0;
    let escalated = 0;
    let skipped = 0;

    const orgs = await this.prisma.organization.findMany({
      where: {
        isActive: true,
        deletedAt: null,
        collectionPolicies: { some: { isActive: true, deletedAt: null } },
      },
      select: { id: true },
    });

    for (const org of orgs) {
      const invoices = await this.prisma.invoice.findMany({
        where: {
          organizationId: org.id,
          direction: 'RECEIVABLE',
          deletedAt: null,
          status: InvoiceStatus.PENDING,
          dueDate: { not: null, lt: new Date() },
        },
        select: { id: true },
      });

      for (const inv of invoices) {
        evaluated += 1;
        const result = await this.advanceSequence(inv.id);
        if (result.outcome === 'sent' || result.outcome === 'manual-required') {
          sent += 1;
        } else if (result.outcome === 'escalated') {
          escalated += 1;
        } else {
          skipped += 1;
        }
      }
    }

    this.logger.log(
      `collection-sequence-engine: ${evaluated} evaluada(s), ${sent} enviada(s), ${escalated} escalada(s), ${skipped} omitida(s).`,
    );
    return { evaluated, sent, escalated, skipped };
  }

  /**
   * Avanza (o inicia) la secuencia de escalamiento de UNA factura. Es el
   * corazón del motor: decide si toca enviar el siguiente paso, si hay que
   * escalar a un humano, o si algún guard rail obliga a esperar. Nunca lanza:
   * cualquier condición no elegible se reporta como `skipped` con `reason`.
   */
  async advanceSequence(invoiceId: string): Promise<AdvanceResult> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { customer: true },
    });
    if (!invoice || invoice.deletedAt || invoice.direction !== 'RECEIVABLE') {
      return { outcome: 'skipped', reason: 'invoice-not-eligible' };
    }
    if (!invoice.customer) {
      return { outcome: 'skipped', reason: 'no-customer' };
    }
    if (!invoice.dueDate) {
      return { outcome: 'skipped', reason: 'no-due-date' };
    }

    // Factura ya cobrada/rechazada: si había una ejecución en curso, se cierra.
    if (invoice.status !== InvoiceStatus.PENDING) {
      await this.prisma.collectionSequenceRun.updateMany({
        where: { invoiceId, status: { in: ['ACTIVE', 'PAUSED'] } },
        data: { status: 'COMPLETED' },
      });
      return { outcome: 'skipped', reason: 'invoice-not-pending' };
    }

    const policy = await this.prisma.collectionPolicy.findFirst({
      where: { organizationId: invoice.organizationId, isActive: true, deletedAt: null },
      include: {
        sequenceSteps: { where: { deletedAt: null }, orderBy: { stepOrder: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!policy || policy.sequenceSteps.length === 0) {
      return { outcome: 'skipped', reason: 'no-active-policy-or-steps' };
    }

    const now = new Date();
    const daysOverdue = Math.floor(
      (now.getTime() - invoice.dueDate.getTime()) / 86_400_000,
    );
    if (daysOverdue < 0) {
      return { outcome: 'skipped', reason: 'not-yet-due' };
    }
    if (daysOverdue < policy.gracePeriodDays) {
      return { outcome: 'skipped', reason: 'within-grace-period' };
    }

    let run = await this.prisma.collectionSequenceRun.findUnique({
      where: { invoiceId },
    });
    if (!run) {
      run = await this.prisma.collectionSequenceRun.create({
        data: {
          organizationId: invoice.organizationId,
          invoiceId,
          collectionPolicyId: policy.id,
          currentStepOrder: 0,
          status: 'ACTIVE',
        },
      });
    }

    if (run.status !== 'ACTIVE') {
      return { outcome: 'skipped', reason: `run-${run.status.toLowerCase()}` };
    }

    const nextStep = policy.sequenceSteps.find(
      (s) => s.stepOrder === run!.currentStepOrder + 1,
    );
    if (!nextStep) {
      // No hay más pasos definidos: la secuencia se dio por completada.
      await this.prisma.collectionSequenceRun.update({
        where: { id: run.id },
        data: { status: 'COMPLETED' },
      });
      return { outcome: 'completed' };
    }
    if (nextStep.daysAfterDue > daysOverdue) {
      return { outcome: 'skipped', reason: 'step-not-due-yet' };
    }

    // ── Guard rails de la política ──
    if (this.isBlackout(now, policy.blackoutDates, policy.timezone)) {
      await this.logStep(invoice, run, nextStep, 'COLLECTION_SEQUENCE_STEP_SKIPPED', {
        reason: 'blackout-date',
      });
      return { outcome: 'skipped', reason: 'blackout-date' };
    }

    const hour = this.localHour(now, policy.timezone);
    if (hour < policy.allowedContactStartHour || hour >= policy.allowedContactEndHour) {
      await this.logStep(invoice, run, nextStep, 'COLLECTION_SEQUENCE_STEP_SKIPPED', {
        reason: 'outside-contact-window',
        hour,
      });
      return { outcome: 'skipped', reason: 'outside-contact-window' };
    }

    const weekAgo = new Date(now.getTime() - 7 * 86_400_000);
    const contactsThisWeek = await this.prisma.activityLog.count({
      where: {
        entityType: 'CollectionSequenceRun',
        entityId: run.id,
        action: {
          in: ['COLLECTION_SEQUENCE_STEP_SENT', 'COLLECTION_SEQUENCE_ESCALATED'],
        },
        createdAt: { gte: weekAgo },
      },
    });
    if (contactsThisWeek >= policy.maxContactsPerWeek) {
      await this.logStep(invoice, run, nextStep, 'COLLECTION_SEQUENCE_STEP_SKIPPED', {
        reason: 'max-contacts-per-week',
      });
      return { outcome: 'skipped', reason: 'max-contacts-per-week' };
    }

    // ── Ejecuta el paso ──
    const org = await this.prisma.organization.findUnique({
      where: { id: invoice.organizationId },
      select: { locale: true, currency: true },
    });
    const locale = org?.locale ?? 'es-MX';
    const currency = org?.currency ?? 'MXN';
    const amount = `${money(Number(invoice.total), locale)} ${currency}`;
    const dueDateStr = invoice.dueDate.toLocaleDateString(locale);
    const customerName = invoice.customer.name;
    const isLastStep = !policy.sequenceSteps.some(
      (s) => s.stepOrder > nextStep.stepOrder,
    );

    // ── Decisión IA opcional (Tradespace: "discernir" según riesgo/relación) ──
    // Opt-in por CollectionPolicy.aiDecisionEnabled (default false = sin
    // cambios). Los guard rails de arriba YA se aplicaron sin importar esto;
    // la IA solo influye en acción/canal/tono dentro de lo ya permitido.
    let aiDecision: CollectionAiDecision | null = null;
    if (policy.aiDecisionEnabled) {
      aiDecision = await this.aiDecision.decideNextAction(invoiceId, {
        organizationId: invoice.organizationId,
        customerId: invoice.customer.id,
        customerName,
        daysOverdue,
        amount: Number(invoice.total),
        currency,
        step: nextStep,
        policy: {
          maxContactsPerWeek: policy.maxContactsPerWeek,
          allowedContactStartHour: policy.allowedContactStartHour,
          allowedContactEndHour: policy.allowedContactEndHour,
          timezone: policy.timezone,
          escalationThresholdDays: policy.escalationThresholdDays,
        },
      });

      if (aiDecision.action === 'HOLD') {
        await this.logStep(invoice, run, nextStep, 'COLLECTION_SEQUENCE_STEP_SKIPPED', {
          reason: 'ai-hold',
          aiReasoning: aiDecision.reasoning,
          aiDriven: aiDecision.aiDriven,
        });
        return { outcome: 'skipped', reason: 'ai-hold', stepOrder: nextStep.stepOrder };
      }
    }

    const shouldEscalate = nextStep.escalatesToHuman || aiDecision?.action === 'ESCALATE';
    // Canal/tono efectivos: la IA solo puede sobreescribirlos cuando decide
    // SEND; en cualquier otro caso (IA deshabilitada, HOLD ya resuelto arriba,
    // o sin sugerencia explícita) se usan los valores fijos del paso.
    const effectiveChannel =
      aiDecision?.action === 'SEND' && aiDecision.channel
        ? aiDecision.channel
        : nextStep.channel;
    const effectiveTone =
      aiDecision?.action === 'SEND' && aiDecision.tone ? aiDecision.tone : nextStep.tone;

    if (shouldEscalate) {
      await this.notifications.notifyOrgAdmins(invoice.organizationId, {
        type: 'COLLECTION_SEQUENCE_ESCALATED',
        title: 'Cobranza escalada a un humano',
        body: `La factura ${this.folioOf(invoice)} de ${customerName} lleva ${daysOverdue} día(s) de atraso y requiere seguimiento manual (paso ${nextStep.stepOrder} de la secuencia de cobranza).`,
      });
      await this.prisma.collectionSequenceRun.update({
        where: { id: run.id },
        data: { currentStepOrder: nextStep.stepOrder, status: 'ESCALATED', lastStepSentAt: now },
      });
      await this.logStep(invoice, run, nextStep, 'COLLECTION_SEQUENCE_ESCALATED', {
        daysOverdue,
        ...(aiDecision
          ? { aiReasoning: aiDecision.reasoning, aiDriven: aiDecision.aiDriven }
          : {}),
      });
      return { outcome: 'escalated', stepOrder: nextStep.stepOrder };
    }

    const body = this.renderTemplate(nextStep.messageTemplate, {
      customerName,
      amount,
      dueDate: dueDateStr,
      daysOverdue,
    });

    let channelSent = false;
    let manualChannelRequired = false;
    if (effectiveChannel === 'EMAIL' && invoice.customer.email) {
      const res = await this.email.sendCollectionSequenceStep(
        invoice.customer.email,
        customerName,
        body,
        invoice.organizationId,
        effectiveTone,
      );
      channelSent = res.sent;
    } else if (effectiveChannel === 'WHATSAPP' && invoice.customer.phone) {
      const res = await this.whatsapp.sendMessage(invoice.customer.phone, body);
      channelSent = res.sent;
    } else if (effectiveChannel === 'SMS' || effectiveChannel === 'PHONE') {
      // Sin proveedor automático para SMS/llamada: se notifica a los admins
      // para que hagan el contacto manualmente, pero el paso SÍ avanza (el
      // sistema ya hizo su parte al detectarlo y avisar).
      manualChannelRequired = true;
    }

    if (manualChannelRequired) {
      await this.notifications.notifyOrgAdmins(invoice.organizationId, {
        type: 'COLLECTION_SEQUENCE_MANUAL_CHANNEL',
        title: 'Paso de cobranza requiere contacto manual',
        body: `El paso ${nextStep.stepOrder} de la secuencia (${effectiveChannel}) para la factura ${this.folioOf(invoice)} no tiene canal automatizado disponible; contacta manualmente a ${customerName}.`,
      });
    } else if (!channelSent) {
      // Sin correo/teléfono disponible para el canal del paso, o falló el
      // envío: no se consume el paso, se reintenta en la siguiente corrida.
      await this.logStep(invoice, run, nextStep, 'COLLECTION_SEQUENCE_STEP_SKIPPED', {
        reason: 'no-contact-channel-or-send-failed',
        channel: effectiveChannel,
      });
      return { outcome: 'skipped', reason: 'send-failed' };
    }

    await this.prisma.collectionSequenceRun.update({
      where: { id: run.id },
      data: {
        currentStepOrder: nextStep.stepOrder,
        lastStepSentAt: now,
        status: isLastStep ? 'COMPLETED' : 'ACTIVE',
      },
    });
    await this.logStep(invoice, run, nextStep, 'COLLECTION_SEQUENCE_STEP_SENT', {
      channel: effectiveChannel,
      tone: effectiveTone,
      daysOverdue,
      manualChannelRequired,
      ...(aiDecision
        ? { aiReasoning: aiDecision.reasoning, aiDriven: aiDecision.aiDriven }
        : {}),
    });

    return {
      outcome: manualChannelRequired ? 'manual-required' : 'sent',
      stepOrder: nextStep.stepOrder,
    };
  }

  // ── helpers ───────────────────────────────────────────────

  private folioOf(invoice: { folio: string | null; cfdiUuid: string }): string {
    return invoice.folio ?? invoice.cfdiUuid.slice(0, 8);
  }

  private renderTemplate(
    template: string,
    ctx: { customerName: string; amount: string; dueDate: string; daysOverdue: number },
  ): string {
    return template
      .replace(/\{\{\s*customerName\s*\}\}/g, ctx.customerName)
      .replace(/\{\{\s*amount\s*\}\}/g, ctx.amount)
      .replace(/\{\{\s*dueDate\s*\}\}/g, ctx.dueDate)
      .replace(/\{\{\s*daysOverdue\s*\}\}/g, String(ctx.daysOverdue));
  }

  /** Hora local (0-23) de `date` en la zona horaria IANA indicada. */
  private localHour(date: Date, timezone: string): number {
    try {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: 'numeric',
        hour12: false,
      }).formatToParts(date);
      const hourPart = parts.find((p) => p.type === 'hour')?.value ?? '0';
      // Algunos runtimes devuelven "24" para la medianoche.
      return Number(hourPart) % 24;
    } catch {
      // Zona horaria inválida: no bloquea el envío, usa la hora UTC.
      return date.getUTCHours();
    }
  }

  /** Clave YYYY-MM-DD de `date` en la zona horaria indicada (para comparar blackout dates). */
  private dateKey(date: Date, timezone: string): string {
    try {
      return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(date);
    } catch {
      return date.toISOString().slice(0, 10);
    }
  }

  private isBlackout(date: Date, blackoutDates: Date[], timezone: string): boolean {
    const key = this.dateKey(date, timezone);
    return blackoutDates.some((d) => this.dateKey(d, timezone) === key);
  }

  private async logStep(
    invoice: { id: string; organizationId: string },
    run: CollectionSequenceRun,
    step: CollectionSequenceStep,
    action: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    await this.activity.record({
      organizationId: invoice.organizationId,
      action,
      entityType: 'CollectionSequenceRun',
      entityId: run.id,
      metadata: { invoiceId: invoice.id, stepOrder: step.stepOrder, ...metadata },
    });
  }

  private async getOwnedPolicy(organizationId: string, policyId: string) {
    const policy = await this.prisma.withOrg(organizationId, (tx) =>
      tx.collectionPolicy.findFirst({
        where: { id: policyId, organizationId, deletedAt: null },
      }),
    );
    if (!policy) throw new NotFoundException('Política de cobranza no encontrada.');
    return policy;
  }

  private requireOrg(user: AuthenticatedUser): string {
    if (!user.organizationId) {
      throw new ForbiddenException('Tu cuenta no pertenece a una organización.');
    }
    return user.organizationId;
  }
}
