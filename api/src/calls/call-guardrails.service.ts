import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { ActivityLogService } from '../activity/activity-log.service';
import { isBlackoutDate, isWithinContactWindow } from '../common/timezone.util';
import {
  MANDATORY_DISCLOSURE_SCRIPT,
  RECORDING_CONSENT_LINE,
  ESCALATION_TRIGGER_PHRASES,
  FORBIDDEN_AGENT_PHRASES,
  normalizeForScreening,
} from './call-guardrails.constants';

export type CallBlockReason =
  | 'customer-not-found'
  | 'customer-do-not-contact'
  | 'no-phone'
  | 'no-active-policy'
  | 'blackout-date'
  | 'outside-contact-window'
  | 'max-contacts-per-week';

export interface CallAttemptEvaluation {
  allowed: boolean;
  reason?: CallBlockReason;
  disclosureScript?: string;
  recordingConsentLine?: string;
}

export interface ScriptScreenResult {
  safe: boolean;
  flaggedPhrases: string[];
}

/**
 * Guardrails para llamadas telefónicas hechas por un agente de IA (Retell
 * AI u otro proveedor, una vez que haya API key). Este servicio NO hace
 * llamadas — es la capa de reglas que cualquier integración de voz debe
 * consultar ANTES de marcar y DURANTE la conversación.
 *
 * Reutiliza la MISMA CollectionPolicy (horario, blackout dates, rate limit
 * semanal) que ya rige email/WhatsApp/SMS en CollectionSequencesService,
 * así que una llamada de IA nunca tiene un estándar más laxo que los demás
 * canales. Lo que agrega, específico de voz:
 *  - guion de apertura obligatorio (identificarse como sistema automatizado)
 *  - filtro de frases prohibidas para lo que el agente está por decir
 *  - detección de frases del deudor que fuerzan escalar a un humano
 *  - opt-out ("no contactar") a nivel cliente, que aplica a TODOS los canales
 */
@Injectable()
export class CallGuardrailsService {
  private readonly logger = new Logger(CallGuardrailsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityLogService,
  ) {}

  /** Evalúa si, en este momento, se le puede marcar a este cliente por voz. */
  async evaluateCallAttempt(
    organizationId: string,
    customerId: string,
    policyId: string,
  ): Promise<CallAttemptEvaluation> {
    const customer = await this.prisma.withOrg(organizationId, (tx) =>
      tx.customer.findFirst({
        where: { id: customerId, organizationId, deletedAt: null },
      }),
    );
    if (!customer) return { allowed: false, reason: 'customer-not-found' };
    if (customer.doNotContact) {
      return { allowed: false, reason: 'customer-do-not-contact' };
    }
    if (!customer.phone) {
      return { allowed: false, reason: 'no-phone' };
    }

    const policy = await this.prisma.withOrg(organizationId, (tx) =>
      tx.collectionPolicy.findFirst({
        where: { id: policyId, organizationId, deletedAt: null, isActive: true },
      }),
    );
    if (!policy) return { allowed: false, reason: 'no-active-policy' };

    const now = new Date();
    if (isBlackoutDate(now, policy.blackoutDates, policy.timezone)) {
      return { allowed: false, reason: 'blackout-date' };
    }
    if (
      !isWithinContactWindow(
        now,
        policy.timezone,
        policy.allowedContactStartHour,
        policy.allowedContactEndHour,
      )
    ) {
      return { allowed: false, reason: 'outside-contact-window' };
    }

    const weekAgo = new Date(now.getTime() - 7 * 86_400_000);
    const callsThisWeek = await this.prisma.activityLog.count({
      where: {
        organizationId,
        entityType: 'Customer',
        entityId: customerId,
        action: { in: ['CALL_ATTEMPT_STARTED', 'CALL_ESCALATED'] },
        createdAt: { gte: weekAgo },
      },
    });
    if (callsThisWeek >= policy.maxContactsPerWeek) {
      return { allowed: false, reason: 'max-contacts-per-week' };
    }

    return {
      allowed: true,
      disclosureScript: MANDATORY_DISCLOSURE_SCRIPT,
      recordingConsentLine: RECORDING_CONSENT_LINE,
    };
  }

  /** Registra el inicio de un intento de llamada (cuenta para el rate limit semanal). */
  async recordAttemptStarted(
    organizationId: string,
    customerId: string,
    metadata: Record<string, unknown> = {},
  ): Promise<void> {
    await this.activity.record({
      organizationId,
      action: 'CALL_ATTEMPT_STARTED',
      entityType: 'Customer',
      entityId: customerId,
      metadata,
    });
  }

  /** Registra que la llamada se escaló a un humano. */
  async recordEscalation(
    organizationId: string,
    customerId: string,
    reason: string,
  ): Promise<void> {
    this.logger.log(`Llamada escalada a humano (cliente ${customerId}): ${reason}`);
    await this.activity.record({
      organizationId,
      action: 'CALL_ESCALATED',
      entityType: 'Customer',
      entityId: customerId,
      metadata: { reason },
    });
  }

  /**
   * Marca a un cliente como "no contactar" — aplica a TODOS los canales
   * (lo consume también CollectionSequencesService, no solo llamadas).
   */
  async setDoNotContact(
    organizationId: string,
    customerId: string,
    reason: string,
    userId?: string,
  ): Promise<void> {
    await this.prisma.withOrg(organizationId, (tx) =>
      tx.customer.update({
        where: { id: customerId },
        data: {
          doNotContact: true,
          doNotContactReason: reason,
          doNotContactAt: new Date(),
        },
      }),
    );
    await this.activity.record({
      organizationId,
      userId,
      action: 'CUSTOMER_DO_NOT_CONTACT_SET',
      entityType: 'Customer',
      entityId: customerId,
      metadata: { reason },
    });
  }

  /**
   * Revisa un fragmento de texto que el agente de IA está por decir contra
   * la lista de frases prohibidas. Red de seguridad determinista adicional
   * al system prompt del modelo de voz — no lo reemplaza.
   */
  screenAgentText(text: string): ScriptScreenResult {
    const normalized = normalizeForScreening(text);
    const flagged = FORBIDDEN_AGENT_PHRASES.filter((phrase) =>
      normalized.includes(normalizeForScreening(phrase)),
    );
    return { safe: flagged.length === 0, flaggedPhrases: flagged };
  }

  /** `true` si algo que dijo el DEUDOR obliga a escalar la llamada a un humano. */
  shouldEscalateFromDebtorText(text: string): boolean {
    const normalized = normalizeForScreening(text);
    return ESCALATION_TRIGGER_PHRASES.some((phrase) =>
      normalized.includes(normalizeForScreening(phrase)),
    );
  }
}
