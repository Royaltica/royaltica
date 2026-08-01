import { Injectable, Logger } from '@nestjs/common';
import type {
  CollectionContactChannel,
  CollectionSequenceStep,
  CollectionSequenceTone,
} from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { GeminiService } from '../gemini/gemini.service';
import { DashboardService } from '../dashboard/dashboard.service';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { EMIT_DECISION_TOOL } from './collection-decision-tool.definition';

/** Acción decidida por la capa de IA (o por el respaldo determinista). */
export type CollectionAiAction = 'SEND' | 'HOLD' | 'ESCALATE';

export interface CollectionAiDecision {
  action: CollectionAiAction;
  /** Solo presente si action=SEND y se sugiere sobreescribir el canal del paso. */
  channel?: CollectionContactChannel;
  /** Solo presente si action=SEND y se sugiere sobreescribir el tono del paso. */
  tone?: CollectionSequenceTone;
  reasoning: string;
  /** true = la decisión vino de Gemini; false = respaldo determinista (Gemini no disponible/falló). */
  aiDriven: boolean;
}

/** Contexto que ya tiene `advanceSequence` (evita volver a consultarlo). */
export interface DecideNextActionContext {
  organizationId: string;
  customerId: string;
  customerName: string;
  daysOverdue: number;
  amount: number;
  currency: string;
  step: Pick<CollectionSequenceStep, 'stepOrder' | 'channel' | 'tone' | 'escalatesToHuman'>;
  policy: {
    maxContactsPerWeek: number;
    allowedContactStartHour: number;
    allowedContactEndHour: number;
    timezone: string;
    escalationThresholdDays: number;
  };
}

const VALID_ACTIONS: CollectionAiAction[] = ['SEND', 'HOLD', 'ESCALATE'];
const VALID_CHANNELS: CollectionContactChannel[] = ['EMAIL', 'WHATSAPP', 'SMS', 'PHONE'];
const VALID_TONES: CollectionSequenceTone[] = ['GENTLE', 'STANDARD', 'FIRM', 'URGENT'];

/**
 * System instruction NARROW: a diferencia de SYSTEM_INSTRUCTION de AiService
 * (asistente conversacional que responde preguntas), esta instrucción tiene
 * un único propósito — decidir la acción de UN contacto de cobranza — y su
 * única salida válida es la función `emit_decision`. No es un chat.
 */
const DECISION_SYSTEM_INSTRUCTION = `Eres el módulo de decisión de un motor de cobranza automatizado (AR/collections) para Tradespace, una empresa canadiense. Tu ÚNICA tarea es decidir qué hacer con UN contacto de cobranza específico, dado el contexto JSON estructurado que recibirás.

# Reglas de cumplimiento (NO NEGOCIABLES)
- El sistema YA validó que este momento respeta la ventana horaria permitida, las fechas de blackout y el tope de contactos por semana de la política de la organización. Nunca sugieras esperar a "mañana a tal hora" ni nada fuera de lo que el sistema controla: tu única decisión es SEND, HOLD o ESCALATE (y, si es SEND, opcionalmente el canal/tono).
- Estas reglas de cumplimiento las aplica el sistema de todas formas SIN IMPORTAR tu respuesta (defensa en profundidad); tu trabajo es razonar sobre el RIESGO Y LA RELACIÓN, no sobre el cumplimiento horario.

# Cómo decidir
- SEND: continuar con el siguiente paso de la secuencia de cobranza. Es la acción por defecto cuando no hay señales claras de riesgo a la relación.
- HOLD: NO contactar en esta corrida. Úsalo cuando presionar más a este cliente en este momento probablemente dañe una relación comercial valiosa sin mejorar realmente la probabilidad de cobro (ej. cliente de alto valor/larga antigüedad con un atraso menor o su primer atraso, o evidencia de que ya está gestionando el pago).
- ESCALATE: este caso requiere el criterio de una persona del equipo de cobranza, no un mensaje automático más. Úsalo para montos grandes, atrasos severos, clientes de alto valor con deterioro claro de su historial, o cualquier caso donde automatizar más contacto pueda "romper la relación" (la preocupación explícita del cliente Tradespace) sin certeza de cobrar.

# Principio central (instrucción explícita del cliente)
"Si ya se tardó mucho en pagar, discierne si tu flujo de caja soporta seguir presionando un poco más, o si insistir más rompe la relación." Es decir: sopesa SIEMPRE el valor de la relación comercial (monto total histórico facturado, antigüedad, puntualidad pasada) contra el beneficio marginal de un contacto más agresivo. Ante la duda con un cliente grande/importante/de largo plazo, prefiere HOLD o ESCALATE sobre un SEND agresivo y automático.

# Formato de salida
DEBES invocar la función emit_decision exactamente una vez, con:
- action: SEND, HOLD o ESCALATE.
- channel/tone: SOLO si action=SEND y quieres cambiar el canal/tono ya configurado en el paso (opcional; si no hay razón para cambiarlo, omítelo).
- reasoning: 1-3 oraciones, concretas, basadas ÚNICAMENTE en las cifras del contexto recibido (nunca inventes datos que no te dieron). Este texto se guarda en el registro de auditoría de la organización.

No respondas con texto libre: tu única salida es la llamada a emit_decision.`;

/**
 * Capa de decisión IA (opcional, opt-in por CollectionPolicy.aiDecisionEnabled)
 * sobre el motor determinista de escalamiento de cobranza (CollectionSequencesService).
 *
 * Reusa el mismo cliente de Gemini/Vertex AI que AiService y GeminiService
 * (GeminiService.generateFunctionCall), pero con una instrucción de sistema
 * NUEVA y ACOTADA (no la del chat conversacional): su único trabajo es emitir
 * una decisión estructurada para UN contacto de cobranza.
 *
 * Filosofía de "fail closed" (igual que EmailService/WhatsappService/SpeiService
 * en modo stub): CUALQUIER falla — Gemini no configurado, error de red, timeout,
 * respuesta malformada — cae al comportamiento determinista del paso configurado
 * de la secuencia. La IA nunca puede bloquear ni degradar la cobranza automática.
 */
@Injectable()
export class CollectionSequencesAiDecisionService {
  private readonly logger = new Logger(CollectionSequencesAiDecisionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gemini: GeminiService,
    private readonly dashboard: DashboardService,
  ) {}

  async decideNextAction(
    invoiceId: string,
    context: DecideNextActionContext,
  ): Promise<CollectionAiDecision> {
    const fallback: CollectionAiDecision = {
      action: context.step.escalatesToHuman ? 'ESCALATE' : 'SEND',
      channel: context.step.channel,
      tone: context.step.tone,
      reasoning:
        'Respaldo determinista: la decisión de IA no está disponible, se usa ' +
        'el paso configurado de la secuencia de cobranza.',
      aiDriven: false,
    };

    if (!this.gemini.isConfigured) {
      return fallback;
    }

    try {
      const prompt = await this.buildPrompt(invoiceId, context);
      const raw = await this.gemini.generateFunctionCall<Record<string, unknown>>({
        systemInstruction: DECISION_SYSTEM_INSTRUCTION,
        prompt,
        functionDeclaration: EMIT_DECISION_TOOL,
      });

      const decision = this.parseDecision(raw, context);
      if (!decision) {
        this.logger.warn(
          `Decisión IA inválida/malformada para la factura ${invoiceId}; se usa el respaldo determinista.`,
        );
        return fallback;
      }
      return decision;
    } catch (err) {
      this.logger.warn(
        `Fallo al decidir la acción de cobranza con IA para la factura ${invoiceId}: ${
          err instanceof Error ? err.message : String(err)
        }. Se usa el respaldo determinista.`,
      );
      return fallback;
    }
  }

  // ── helpers ───────────────────────────────────────────────

  /**
   * Arma el contexto JSON estructurado que ve el modelo: historial de pago,
   * riesgo y valor de la relación del cliente, además del paso/política
   * vigentes. Nunca lanza por datos faltantes: usa valores por defecto seguros.
   */
  private async buildPrompt(
    invoiceId: string,
    context: DecideNextActionContext,
  ): Promise<string> {
    const fakeUser = { organizationId: context.organizationId } as AuthenticatedUser;

    const [ranking, atRisk, lifetime] = await Promise.all([
      this.dashboard.getCustomerRanking(fakeUser).catch(() => null),
      this.dashboard.getAtRiskCustomers(fakeUser).catch(() => null),
      this.lifetimeRelationshipValue(context.organizationId, context.customerId),
    ]);

    const rankingEntry = ranking?.customers?.find(
      (c: { customerId: string }) => c.customerId === context.customerId,
    );
    const atRiskEntry = atRisk?.customers?.find(
      (c: { customerId: string }) => c.customerId === context.customerId,
    );

    const payload = {
      invoiceId,
      customer: {
        name: context.customerName,
        totalLifetimeInvoiced: lifetime.totalInvoiced,
        totalLifetimePaid: lifetime.totalPaid,
        relationshipTenureDays: lifetime.tenureDays,
        historicalOnTimePaymentPct: rankingEntry?.onTimePct ?? null,
        historicalAvgDelayDays: rankingEntry?.avgDelayDays ?? null,
        settledInvoicesCount: rankingEntry?.settled ?? 0,
        isFlaggedAtRisk: Boolean(atRiskEntry),
        atRiskReason: atRiskEntry?.reason ?? null,
      },
      currentInvoice: {
        daysOverdue: context.daysOverdue,
        amount: context.amount,
        currency: context.currency,
      },
      sequenceStep: {
        stepOrder: context.step.stepOrder,
        configuredChannel: context.step.channel,
        configuredTone: context.step.tone,
        escalatesToHumanByDefault: context.step.escalatesToHuman,
      },
      orgPolicy: {
        escalationThresholdDays: context.policy.escalationThresholdDays,
        maxContactsPerWeek: context.policy.maxContactsPerWeek,
        allowedContactWindow: `${context.policy.allowedContactStartHour}:00-${context.policy.allowedContactEndHour}:00 ${context.policy.timezone}`,
      },
    };

    return `Decide la acción para este contacto de cobranza. Contexto:\n${JSON.stringify(payload, null, 2)}`;
  }

  /**
   * Valor total histórico facturado/cobrado al cliente (todas las facturas,
   * cualquier estado) y su antigüedad como cliente. Es el proxy de "valor de
   * la relación" que pide Tradespace para no arriesgar clientes importantes.
   */
  private async lifetimeRelationshipValue(
    organizationId: string,
    customerId: string,
  ): Promise<{ totalInvoiced: number; totalPaid: number; tenureDays: number }> {
    const [invoicedAgg, paidAgg, customer] = await Promise.all([
      this.prisma.invoice.aggregate({
        where: { organizationId, customerId, direction: 'RECEIVABLE', deletedAt: null },
        _sum: { total: true },
      }),
      this.prisma.invoice.aggregate({
        where: {
          organizationId,
          customerId,
          direction: 'RECEIVABLE',
          deletedAt: null,
          status: 'PAID',
        },
        _sum: { total: true },
      }),
      this.prisma.customer.findUnique({
        where: { id: customerId },
        select: { createdAt: true },
      }),
    ]);

    const tenureDays = customer
      ? Math.max(0, Math.floor((Date.now() - customer.createdAt.getTime()) / 86_400_000))
      : 0;

    return {
      totalInvoiced: Number(invoicedAgg._sum.total ?? 0),
      totalPaid: Number(paidAgg._sum.total ?? 0),
      tenureDays,
    };
  }

  /**
   * Valida estrictamente la forma de la respuesta del modelo: nunca confía
   * en prosa libre ni en un shape inesperado. Cualquier campo inválido hace
   * que la respuesta completa se descarte (el llamador cae al respaldo).
   */
  private parseDecision(
    raw: Record<string, unknown> | null,
    context: DecideNextActionContext,
  ): CollectionAiDecision | null {
    if (!raw) return null;

    const action = raw.action;
    if (typeof action !== 'string' || !VALID_ACTIONS.includes(action as CollectionAiAction)) {
      return null;
    }

    const reasoning = typeof raw.reasoning === 'string' && raw.reasoning.trim()
      ? raw.reasoning.trim()
      : 'Decisión de IA sin justificación explícita.';

    let channel: CollectionContactChannel | undefined;
    if (typeof raw.channel === 'string' && VALID_CHANNELS.includes(raw.channel as CollectionContactChannel)) {
      channel = raw.channel as CollectionContactChannel;
    }

    let tone: CollectionSequenceTone | undefined;
    if (typeof raw.tone === 'string' && VALID_TONES.includes(raw.tone as CollectionSequenceTone)) {
      tone = raw.tone as CollectionSequenceTone;
    }

    if (action !== 'SEND') {
      // HOLD/ESCALATE no llevan canal/tono: se ignoran si el modelo los mandó igual.
      return { action: action as CollectionAiAction, reasoning, aiDriven: true };
    }

    return {
      action: 'SEND',
      channel: channel ?? context.step.channel,
      tone: tone ?? context.step.tone,
      reasoning,
      aiDriven: true,
    };
  }
}
