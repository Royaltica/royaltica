import {
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { WhatsappService } from './whatsapp.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailService } from '../email/email.service';
import { WhatsappConversationService } from './whatsapp-conversation.service';
import { PAYMENT_CLAIM_BUTTONS } from './collection-templates';
import { classifyIntent as classifyInbound, type CustomerIntent as InboundIntent } from './inbound-intent';
import type { Env } from '../config/env.validation';

/** Clasificación determinista de la respuesta de un cliente. */
/**
 * Intenciones de una respuesta del cliente. Un solo detector para WhatsApp y
 * correo (inbound-intent.ts): baja, número equivocado, disputa, afirmación de
 * pago o respuesta normal.
 */
export type CustomerIntent = InboundIntent;

/** true si el mensaje es un pedido de baja (BAJA, STOP, "no me escriban"…). */
export function isOptOutRequest(text: string): boolean {
  return classifyInbound(text).intent === 'OPT_OUT';
}

/** Orden de los estados de entrega de Meta (no se retrocede: leído > entregado). */
const DELIVERY_RANK: Record<string, number> = { sent: 1, delivered: 2, read: 3, failed: 4 };

interface DeliveryStatus {
  waMessageId: string;
  status: string;
  timestamp: Date;
  error: string | null;
}

interface IncomingMessage {
  from: string;
  text: string;
  waMessageId: string;
  profileName?: string;
  /** TEXT = escrito; BUTTON = botón de respuesta rápida; MEDIA = imagen/documento. */
  kind: 'TEXT' | 'BUTTON' | 'MEDIA';
  /** Número de Meta que recibió el mensaje (para contestar por el mismo). */
  phoneNumberId: string | null;
  /** wamid del mensaje NUESTRO al que responde (Meta lo manda al responder o tocar un botón). */
  contextId: string | null;
}

interface ResolvedSender {
  customer: { id: string; name: string; organizationId: string };
  /** Factura exacta si el mensaje responde a uno nuestro que la tenía. */
  invoiceId: string | null;
  how: 'context' | 'phone' | 'recent-outbound';
}

/**
 * Webhook ENTRANTE de WhatsApp (Meta Cloud API). Recibe las respuestas de los
 * clientes a los recordatorios de cobranza, clasifica la intención con una
 * regla determinista (¿dice que ya pagó?) y avisa al director para que dé
 * seguimiento. Nunca ejecuta acciones dictadas por el contenido del mensaje:
 * una afirmación de pago es un AVISO, no una prueba — el director confirma el
 * cobro manualmente contra el banco. El contenido entrante es dato no confiable.
 */
@Injectable()
export class WhatsappWebhookService {
  private readonly logger = new Logger(WhatsappWebhookService.name);

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly prisma: PrismaService,
    private readonly whatsapp: WhatsappService,
    private readonly notifications: NotificationsService,
    private readonly email: EmailService,
    private readonly conversations: WhatsappConversationService,
  ) {}

  /**
   * Challenge de verificación de Meta (GET). Devuelve `hub.challenge` solo si
   * el modo es 'subscribe' y el token coincide con WHATSAPP_VERIFY_TOKEN.
   */
  verifyChallenge(
    mode: string | undefined,
    token: string | undefined,
    challenge: string | undefined,
  ): string {
    const expected = this.config.get('WHATSAPP_VERIFY_TOKEN', { infer: true });
    if (!expected) {
      throw new ForbiddenException(
        'Webhook de WhatsApp sin configurar (falta WHATSAPP_VERIFY_TOKEN).',
      );
    }
    if (mode === 'subscribe' && token === expected && challenge) {
      return challenge;
    }
    throw new ForbiddenException('Verificación de webhook inválida.');
  }

  /**
   * Valida la firma HMAC-SHA256 del webhook (cabecera X-Hub-Signature-256).
   * Si no hay WHATSAPP_APP_SECRET configurado (modo stub/desarrollo), no se
   * puede validar y se acepta con una advertencia — en producción SIEMPRE debe
   * estar el secreto. Comparación en tiempo constante.
   */
  verifySignature(rawBody: Buffer | undefined, signature: string | undefined): boolean {
    const secret = this.config.get('WHATSAPP_APP_SECRET', { infer: true });
    if (!secret) {
      // En producción, sin secreto no hay forma de saber que el aviso viene de
      // Meta: cualquiera podría fingir que un cliente contestó o pagó. Se rechaza.
      if (this.config.get('NODE_ENV', { infer: true }) === 'production') {
        this.logger.error(
          'Webhook de WhatsApp rechazado: falta WHATSAPP_APP_SECRET en producción (no se puede validar la firma de Meta).',
        );
        return false;
      }
      this.logger.warn(
        'WHATSAPP_APP_SECRET no configurado: la firma del webhook NO se valida (solo aceptable en desarrollo).',
      );
      return true;
    }
    if (!rawBody || !signature) return false;
    const expected =
      'sha256=' + createHmac('sha256', secret).update(rawBody).digest('hex');
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  /**
   * Procesa el payload entrante de Meta: extrae los mensajes de texto y, por
   * cada uno, empata al cliente por teléfono, clasifica la intención y avisa al
   * director. Idempotente por diseño (registrar dos veces el mismo aviso no
   * cambia el estado financiero). Nunca lanza: un webhook debe responder 200
   * aunque un mensaje suelto falle, para que Meta no lo reintente en bucle.
   */
  async handleIncoming(payload: unknown): Promise<{ processed: number; statuses: number }> {
    const statuses = await this.applyDeliveryStatuses(this.extractStatuses(payload));
    const messages = this.extractMessages(payload);
    let processed = 0;
    for (const msg of messages) {
      try {
        await this.processMessage(msg);
        processed += 1;
      } catch (err) {
        this.logger.warn(
          `No se pudo procesar mensaje entrante de ${msg.from}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }
    return { processed, statuses };
  }

  // ── helpers ───────────────────────────────────────────────

  /**
   * Aplana el payload de Meta a una lista de mensajes. Acepta texto, botones
   * de respuesta rápida de las plantillas (`button` / `interactive`) y
   * archivos (`image` / `document`, p. ej. un comprobante: se registra que
   * llegó, el archivo NO se descarga). Ignora estatus de entrega y demás.
   */
  private extractMessages(payload: unknown): IncomingMessage[] {
    const out: IncomingMessage[] = [];
    const root = payload as {
      entry?: {
        changes?: {
          value?: {
            metadata?: { phone_number_id?: string };
            contacts?: { profile?: { name?: string }; wa_id?: string }[];
            messages?: {
              from?: string;
              id?: string;
              type?: string;
              text?: { body?: string };
              button?: { text?: string; payload?: string };
              interactive?: {
                button_reply?: { title?: string };
                list_reply?: { title?: string };
              };
              image?: { caption?: string };
              document?: { caption?: string; filename?: string };
              context?: { id?: string };
            }[];
          };
        }[];
      }[];
    };
    for (const entry of root?.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value;
        const profileName = value?.contacts?.[0]?.profile?.name;
        const phoneNumberId = value?.metadata?.phone_number_id ?? null;
        for (const m of value?.messages ?? []) {
          if (!m.from) continue;
          let kind: IncomingMessage['kind'];
          let text: string | undefined;
          if (m.type === 'text') {
            kind = 'TEXT';
            text = m.text?.body;
          } else if (m.type === 'button') {
            kind = 'BUTTON';
            text = m.button?.text ?? m.button?.payload;
          } else if (m.type === 'interactive') {
            kind = 'BUTTON';
            text = m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title;
          } else if (m.type === 'image' || m.type === 'document') {
            kind = 'MEDIA';
            const caption = m.image?.caption ?? m.document?.caption ?? m.document?.filename;
            text = `[${m.type === 'image' ? 'Imagen' : 'Documento'} recibido${caption ? `: ${caption}` : ''}]`;
          } else {
            continue;
          }
          if (!text) continue;
          out.push({
            from: m.from,
            text,
            waMessageId: m.id ?? '',
            profileName,
            kind,
            phoneNumberId,
            contextId: m.context?.id ?? null,
          });
        }
      }
    }
    return out;
  }

  /** Regla determinista (inbound-intent.ts): baja, número equivocado, disputa, pago o respuesta. */
  classifyIntent(text: string): { intent: CustomerIntent; matched: string | null } {
    return classifyInbound(text);
  }

  private async processMessage(msg: IncomingMessage): Promise<void> {
    const resolved = await this.resolveSender(msg);
    if (!resolved) return; // quedó en la bandeja sin dueño (o se ignoró)
    const { customer } = resolved;

    // Si responde a un mensaje nuestro de una factura, es ESA factura. Si no,
    // la pendiente más vencida (o la más reciente, para dar contexto).
    const invoice = resolved.invoiceId
      ? await this.prisma.invoice.findFirst({
          where: { id: resolved.invoiceId, customerId: customer.id, deletedAt: null },
        })
      : await this.prisma.invoice.findFirst({
          where: {
            customerId: customer.id,
            direction: 'RECEIVABLE',
            deletedAt: null,
          },
          orderBy: [{ status: 'asc' }, { dueDate: 'asc' }],
        });

    // Hilo de la conversación: esto es lo que abre la ventana de 24h para
    // contestar con texto libre. Si Meta reintenta el webhook (mismo wamid),
    // no se duplica ni se vuelve a avisar al equipo.
    const recorded = await this.conversations.recordInbound({
      organizationId: customer.organizationId,
      customerId: customer.id,
      invoiceId: invoice?.id ?? null,
      kind: msg.kind,
      body: msg.text.slice(0, 2000),
      waMessageId: msg.waMessageId,
      phoneNumberId: msg.phoneNumberId,
    });
    if (!recorded && msg.waMessageId) {
      this.logger.debug(`Mensaje ${msg.waMessageId} ya registrado (reintento de Meta); se ignora.`);
      return;
    }

    // Baja: el cliente pide que no le escriban. Aplica a TODOS los canales
    // automáticos (doNotContact) hasta que una persona lo reactive.
    if (msg.kind !== 'MEDIA' && isOptOutRequest(msg.text)) {
      await this.prisma.customer.update({
        where: { id: customer.id },
        data: {
          doNotContact: true,
          doNotContactAt: new Date(),
          doNotContactReason: `Pidió la baja por WhatsApp: "${msg.text.slice(0, 120)}"`,
        },
      });
      if (invoice) {
        await this.prisma.invoiceAuditLog.create({
          data: {
            invoiceId: invoice.id,
            action: 'CUSTOMER_OPT_OUT',
            metadata: {
              channel: 'whatsapp',
              from: msg.from,
              waMessageId: msg.waMessageId,
              text: msg.text.slice(0, 500),
            } as Prisma.InputJsonValue,
          },
        });
      }
      await this.notifications.notifyOrgAdmins(customer.organizationId, {
        type: 'CUSTOMER_OPT_OUT',
        title: 'Un cliente pidió no recibir más mensajes',
        body: `${customer.name} pidió la baja por WhatsApp ("${msg.text.slice(0, 120)}"). Ya no se le enviarán recordatorios automáticos por ningún canal; si fue un error, reactívalo en su ficha.`,
        metadata: { customerId: customer.id, invoiceId: invoice?.id ?? null },
      });
      this.logger.log(`Baja de contacto por WhatsApp: ${customer.name}.`);
      return;
    }

    // Botones: mapa explícito (un botón es una frase fija, no texto libre).
    // Solo "Ya pagué, comparto comprobante" es una afirmación de pago; "Ya
    // quedó programada" o "Ya voy a pagar" son promesas, no pagos.
    const { intent, matched } =
      msg.kind === 'BUTTON'
        ? PAYMENT_CLAIM_BUTTONS.has(msg.text)
          ? { intent: 'PAYMENT_CLAIMED' as CustomerIntent, matched: msg.text }
          : { intent: 'CUSTOMER_REPLY' as CustomerIntent, matched: null }
        : this.classifyIntent(msg.text);
    const folio = invoice?.folio ?? invoice?.cfdiUuid.slice(0, 8) ?? 's/folio';
    const total = invoice
      ? Number(invoice.total).toLocaleString('es-MX', {
          minimumFractionDigits: 2,
        })
      : null;

    // Historial inmutable del aviso (se AWAITEA: es trazabilidad de cobranza).
    if (invoice) {
      await this.prisma.invoiceAuditLog.create({
        data: {
          invoiceId: invoice.id,
          action: intent,
          metadata: {
            channel: 'whatsapp',
            kind: msg.kind,
            from: msg.from,
            waMessageId: msg.waMessageId,
            text: msg.text.slice(0, 500),
            matchedKeyword: matched,
          } as Prisma.InputJsonValue,
        },
      });
    }

    // Número equivocado: ya no se le escribe a ese contacto (todos los canales)
    // hasta que alguien capture uno nuevo y lo reactive.
    if (intent === 'WRONG_CONTACT') {
      await this.prisma.customer.update({
        where: { id: customer.id },
        data: {
          doNotContact: true,
          doNotContactAt: new Date(),
          doNotContactReason: `Respondieron que no es el contacto correcto: "${msg.text.slice(0, 120)}". Captura un contacto nuevo.`,
        },
      });
      const title = 'El contacto de un cliente no es el correcto';
      const body = `En el número de ${customer.name} respondieron que no es la persona correcta ("${msg.text.slice(0, 120)}"). Ya no se le escribirá ahí; captura un contacto nuevo en su ficha y reactívalo.`;
      await this.notifications.notifyOrgAdmins(customer.organizationId, {
        type: 'CUSTOMER_WRONG_CONTACT',
        title,
        body,
        metadata: { customerId: customer.id, invoiceId: invoice?.id ?? null },
      });
      void this.whatsapp.notifyOrgAdmins(customer.organizationId, `Royáltica · ${title}: ${body}`);
      return;
    }

    // Disputa ("no reconozco", "no recibimos la mercancía"): se pausa la
    // cobranza automática de esa factura (o de todas las del cliente si no
    // respondió a un mensaje concreto) hasta que una persona la revise.
    let pausedRuns = 0;
    if (intent === 'DISPUTE') {
      const invoiceIds =
        resolved.how === 'context' && invoice
          ? [invoice.id]
          : (
              await this.prisma.invoice.findMany({
                where: { customerId: customer.id, direction: 'RECEIVABLE', status: 'PENDING', deletedAt: null },
                select: { id: true },
              })
            ).map((i) => i.id);
      if (invoiceIds.length) {
        const res = await this.prisma.collectionSequenceRun.updateMany({
          where: { invoiceId: { in: invoiceIds }, status: 'ACTIVE' },
          data: { status: 'PAUSED' },
        });
        pausedRuns = res.count;
      }
    }

    // "Ya pagué": pausa 72 h los envíos automáticos a este cliente (guardia
    // payment-claimed de CollectionSafetyService). Se marca al cliente y no a
    // una factura porque el mensaje no dice con certeza cuál pagó.
    if (intent === 'PAYMENT_CLAIMED') {
      if (resolved.how === 'context' && invoice) {
        // Respondió al mensaje de una factura concreta: se pausa esa.
        await this.prisma.invoice.update({
          where: { id: invoice.id },
          data: { paymentClaimedAt: new Date() },
        });
      } else {
        await this.prisma.customer.update({
          where: { id: customer.id },
          data: { paymentClaimedAt: new Date() },
        });
      }
    }

    // Aviso al director (in-app + WhatsApp opt-in). NO se marca la factura como
    // pagada: una afirmación del cliente no es prueba de pago.
    const title =
      intent === 'PAYMENT_CLAIMED'
        ? 'Cliente reporta un pago'
        : intent === 'DISPUTE'
          ? 'Cliente en desacuerdo con una factura'
          : 'Respuesta de cliente (cobranza)';
    const body =
      intent === 'PAYMENT_CLAIMED'
        ? `${customer.name} reporta que ya pagó la factura ${folio}${
            total ? ` ($${total} MXN)` : ''
          }. Verifícalo contra el banco y confírmalo en Royáltica. Mensaje: "${msg.text.slice(0, 200)}"`
        : intent === 'DISPUTE'
          ? `${customer.name} no está de acuerdo con ${
              resolved.how === 'context' ? `la factura ${folio}` : 'sus facturas'
            }: "${msg.text.slice(0, 200)}". ${
              pausedRuns
                ? 'Se pausó la cobranza automática hasta que una persona lo revise y la reanude.'
                : 'Revísalo antes de que salga el siguiente recordatorio.'
            }`
          : `${customer.name} respondió al recordatorio de cobranza: "${msg.text.slice(
              0,
              200,
            )}". Dale seguimiento.`;

    await this.notifications.notifyOrgAdmins(customer.organizationId, {
      type:
        intent === 'PAYMENT_CLAIMED'
          ? 'RECEIVABLE_PAYMENT_CLAIMED'
          : intent === 'DISPUTE'
            ? 'RECEIVABLE_CUSTOMER_DISPUTE'
            : 'RECEIVABLE_CUSTOMER_REPLY',
      title,
      body,
      metadata: { invoiceId: invoice?.id ?? null, customerId: customer.id },
    });

    const emoji = intent === 'PAYMENT_CLAIMED' || intent === 'DISPUTE' ? '🔔' : '💬';
    void this.whatsapp.notifyOrgAdmins(
      customer.organizationId,
      `${emoji} Royáltica · ${title}: ${body}`,
    );

    this.logger.log(
      `Cobranza entrante de ${customer.name} clasificada como ${intent}${
        matched ? ` (palabra: "${matched}")` : ''
      }.`,
    );
  }

  /**
   * ¿De qué cliente es este mensaje? En orden, sin adivinar:
   *  1. Responde a un mensaje nuestro (context.id = wamid saliente): exacto.
   *  2. Un solo cliente con ese teléfono (últimos 10 dígitos, incluye el de
   *     Finanzas/Tesorería).
   *  3. Varios: el último al que le escribimos desde el MISMO número de Meta
   *     en los últimos 30 días, si es uno solo.
   *  4. Si sigue sin quedar claro, va a la bandeja sin dueño
   *     (WhatsappInboundUnmatched) y NO se le atribuye a nadie.
   * Antes se tomaba el primer cliente que coincidiera, aunque fuera de otra
   * organización.
   */
  private async resolveSender(msg: IncomingMessage): Promise<ResolvedSender | null> {
    if (msg.contextId) {
      const original = await this.prisma.whatsappMessage.findFirst({
        where: { waMessageId: msg.contextId, direction: 'OUTBOUND' },
        select: {
          invoiceId: true,
          customer: { select: { id: true, name: true, organizationId: true, deletedAt: true } },
        },
      });
      if (original?.customer && !original.customer.deletedAt) {
        const { id, name, organizationId } = original.customer;
        return { customer: { id, name, organizationId }, invoiceId: original.invoiceId, how: 'context' };
      }
    }

    const candidates = await this.findCustomersByPhone(msg.from);
    if (candidates.length === 1) {
      return { customer: candidates[0], invoiceId: null, how: 'phone' };
    }

    if (candidates.length > 1 && msg.phoneNumberId) {
      const recent = await this.prisma.whatsappMessage.findMany({
        where: {
          direction: 'OUTBOUND',
          phoneNumberId: msg.phoneNumberId,
          customerId: { in: candidates.map((c) => c.id) },
          createdAt: { gte: new Date(Date.now() - 30 * 86_400_000) },
        },
        orderBy: { createdAt: 'desc' },
        select: { customerId: true },
        take: 20,
      });
      const recentIds = [...new Set(recent.map((r) => r.customerId))];
      if (recentIds.length === 1) {
        const c = candidates.find((x) => x.id === recentIds[0])!;
        return { customer: c, invoiceId: null, how: 'recent-outbound' };
      }
    }

    await this.recordUnmatched(msg, candidates);
    return null;
  }

  /** Guarda un mensaje que no se pudo atribuir con certeza (idempotente por wamid). */
  private async recordUnmatched(
    msg: IncomingMessage,
    candidates: { id: string; name: string; organizationId: string }[],
  ): Promise<void> {
    const orgs = [...new Set(candidates.map((c) => c.organizationId))];
    const organizationId = orgs.length === 1 ? orgs[0] : null;
    try {
      await this.prisma.whatsappInboundUnmatched.create({
        data: {
          organizationId,
          fromPhone: msg.from,
          phoneNumberId: msg.phoneNumberId,
          waMessageId: msg.waMessageId || null,
          kind: msg.kind,
          body: msg.text.slice(0, 2000),
          candidates: candidates.map((c) => ({
            organizationId: c.organizationId,
            customerId: c.id,
            name: c.name,
          })) as Prisma.InputJsonValue,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return;
      throw err;
    }
    if (candidates.length === 0) {
      this.logger.debug(`Mensaje entrante de ${msg.from} sin cliente asociado; queda en la bandeja sin dueño.`);
      return;
    }
    this.logger.warn(
      `Mensaje entrante de ${msg.from} coincide con ${candidates.length} clientes; queda en la bandeja sin dueño.`,
    );
    if (organizationId) {
      await this.notifications.notifyOrgAdmins(organizationId, {
        type: 'WHATSAPP_INBOUND_UNMATCHED',
        title: 'Mensaje de WhatsApp sin cliente claro',
        body: `Llegó un mensaje de un teléfono que tienen ${candidates.length} clientes (${candidates
          .map((c) => c.name)
          .join(', ')}). Revísalo y asígnalo al correcto.`,
        metadata: { candidates: candidates.map((c) => c.id) },
      });
    }
  }

  /**
   * Clientes con ese teléfono (últimos 10 dígitos, tolera +52 / 521 / 52).
   * Consulta cruzando organizaciones: el webhook no tiene contexto de org.
   * Incluye el teléfono de Finanzas/Tesorería (FR-02).
   */
  private async findCustomersByPhone(
    from: string,
  ): Promise<{ id: string; name: string; organizationId: string }[]> {
    const target = from.replace(/\D/g, '').slice(-10);
    if (target.length < 10) return [];
    const candidates = await this.prisma.customer.findMany({
      where: {
        deletedAt: null,
        OR: [{ phone: { not: null } }, { financeContactPhone: { not: null } }],
      },
      select: {
        id: true,
        name: true,
        organizationId: true,
        phone: true,
        financeContactPhone: true,
      },
    });
    const last10 = (p: string | null) => (p ? p.replace(/\D/g, '').slice(-10) : null);
    return candidates
      .filter((c) => last10(c.financeContactPhone) === target || last10(c.phone) === target)
      .map(({ id, name, organizationId }) => ({ id, name, organizationId }));
  }

  /** Estados de entrega de los mensajes que enviamos (sent/delivered/read/failed). */
  private extractStatuses(payload: unknown): DeliveryStatus[] {
    const out: DeliveryStatus[] = [];
    const root = payload as {
      entry?: {
        changes?: {
          value?: {
            statuses?: {
              id?: string;
              status?: string;
              timestamp?: string;
              errors?: { code?: number; title?: string; message?: string }[];
            }[];
          };
        }[];
      }[];
    };
    for (const entry of root?.entry ?? []) {
      for (const change of entry.changes ?? []) {
        for (const st of change.value?.statuses ?? []) {
          if (!st.id || !st.status || !(st.status in DELIVERY_RANK)) continue;
          const seconds = Number(st.timestamp);
          const err = st.errors?.[0];
          out.push({
            waMessageId: st.id,
            status: st.status,
            timestamp: Number.isFinite(seconds) ? new Date(seconds * 1000) : new Date(),
            error: err ? `${err.code ?? ''} ${err.title ?? err.message ?? ''}`.trim() : null,
          });
        }
      }
    }
    return out;
  }

  /** Guarda el estado de entrega sin retroceder (un "delivered" tardío no pisa un "read"). */
  private async applyDeliveryStatuses(statuses: DeliveryStatus[]): Promise<number> {
    let applied = 0;
    for (const st of statuses) {
      try {
        const current = await this.prisma.whatsappMessage.findUnique({
          where: { waMessageId: st.waMessageId },
          select: { id: true, deliveryStatus: true },
        });
        if (!current) continue;
        const before = DELIVERY_RANK[current.deliveryStatus ?? ''] ?? 0;
        if (DELIVERY_RANK[st.status] <= before) continue;
        await this.prisma.whatsappMessage.update({
          where: { id: current.id },
          data: {
            deliveryStatus: st.status,
            deliveryStatusAt: st.timestamp,
            deliveryError: st.status === 'failed' ? st.error : null,
            ...(st.status === 'failed' ? { sent: false } : {}),
          },
        });
        applied += 1;
      } catch (err) {
        this.logger.warn(
          `No se pudo guardar el estado ${st.status} de ${st.waMessageId}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }
    return applied;
  }
}
