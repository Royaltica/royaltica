import {
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { WhatsappService } from './whatsapp.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailService } from '../email/email.service';
import { WhatsappConversationService } from './whatsapp-conversation.service';
import { PAYMENT_CLAIM_BUTTONS } from './collection-templates';
import type { Env } from '../config/env.validation';

/** Clasificación determinista de la respuesta de un cliente. */
export type CustomerIntent = 'PAYMENT_CLAIMED' | 'CUSTOMER_REPLY';

/**
 * Palabras (sin acentos, minúsculas) que indican que el cliente afirma haber
 * pagado. Coincidencia por inclusión: explicable y auditable, sin caja negra.
 */
const PAYMENT_HINTS = [
  'ya pague',
  'ya lo pague',
  'pague',
  'pagado',
  'pagamos',
  'pago realizado',
  'realice el pago',
  'hice el pago',
  'hice la transferencia',
  'transferi',
  'transferencia',
  'deposit', // deposité / depósito / depositado
  'liquid', // liquidé / liquidado
  'abone', // aboné
  'saldado',
  'cubierto',
  'ya quedo',
  'ya esta pagada',
];

/** Negaciones que invalidan una aparente afirmación de pago. */
const NEGATIONS = ['no ', 'aun no', 'todavia no', 'no he', 'no puedo', 'cuando'];

interface IncomingMessage {
  from: string;
  text: string;
  waMessageId: string;
  profileName?: string;
  /** TEXT = escrito; BUTTON = botón de respuesta rápida; MEDIA = imagen/documento. */
  kind: 'TEXT' | 'BUTTON' | 'MEDIA';
  /** Número de Meta que recibió el mensaje (para contestar por el mismo). */
  phoneNumberId: string | null;
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
  async handleIncoming(payload: unknown): Promise<{ processed: number }> {
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
    return { processed };
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
          });
        }
      }
    }
    return out;
  }

  /** Regla determinista: ¿el mensaje afirma un pago? */
  classifyIntent(text: string): { intent: CustomerIntent; matched: string | null } {
    const n = text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '');
    const matched = PAYMENT_HINTS.find((h) => n.includes(h)) ?? null;
    if (matched && !NEGATIONS.some((neg) => n.includes(neg))) {
      return { intent: 'PAYMENT_CLAIMED', matched };
    }
    return { intent: 'CUSTOMER_REPLY', matched: null };
  }

  private async processMessage(msg: IncomingMessage): Promise<void> {
    const customer = await this.findCustomerByPhone(msg.from);
    if (!customer) {
      this.logger.debug(
        `Mensaje entrante de ${msg.from} sin cliente asociado; se ignora.`,
      );
      return;
    }

    // Factura de venta pendiente más vencida (a la que se refiere el cobro).
    // Si no hay pendiente, se toma la más reciente para dar contexto al aviso.
    const invoice = await this.prisma.invoice.findFirst({
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

    // Botones: mapa explícito (un botón es una frase fija, no texto libre).
    // Solo "Ya pagué, comparto comprobante" es una afirmación de pago; "Ya
    // quedó programada" o "Ya voy a pagar" son promesas, no pagos.
    const { intent, matched } =
      msg.kind === 'BUTTON'
        ? PAYMENT_CLAIM_BUTTONS.has(msg.text)
          ? { intent: 'PAYMENT_CLAIMED' as const, matched: msg.text }
          : { intent: 'CUSTOMER_REPLY' as const, matched: null }
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

    // Aviso al director (in-app + WhatsApp opt-in). NO se marca la factura como
    // pagada: una afirmación del cliente no es prueba de pago.
    const title =
      intent === 'PAYMENT_CLAIMED'
        ? 'Cliente reporta un pago'
        : 'Respuesta de cliente (cobranza)';
    const body =
      intent === 'PAYMENT_CLAIMED'
        ? `${customer.name} reporta que ya pagó la factura ${folio}${
            total ? ` ($${total} MXN)` : ''
          }. Verifícalo contra el banco y confírmalo en Royáltica. Mensaje: "${msg.text.slice(0, 200)}"`
        : `${customer.name} respondió al recordatorio de cobranza: "${msg.text.slice(
            0,
            200,
          )}". Dale seguimiento.`;

    await this.notifications.notifyOrgAdmins(customer.organizationId, {
      type:
        intent === 'PAYMENT_CLAIMED'
          ? 'RECEIVABLE_PAYMENT_CLAIMED'
          : 'RECEIVABLE_CUSTOMER_REPLY',
      title,
      body,
      metadata: { invoiceId: invoice?.id ?? null, customerId: customer.id },
    });

    const emoji = intent === 'PAYMENT_CLAIMED' ? '🔔' : '💬';
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
   * Empata el teléfono entrante (solo dígitos, formato de Meta) con un cliente.
   * Consulta cruzando organizaciones (el webhook no tiene contexto de org, igual
   * que el escaneo del agente de cobranza). Compara por los últimos 10 dígitos
   * (número nacional MX) para tolerar prefijos +52 / 521 / 52.
   */
  private async findCustomerByPhone(from: string): Promise<{
    id: string;
    name: string;
    organizationId: string;
  } | null> {
    const target = from.replace(/\D/g, '').slice(-10);
    if (target.length < 10) return null;
    // Incluye el teléfono de Finanzas/Tesorería (FR-02): los recordatorios
    // salen a ese número cuando existe, así que la respuesta llega de ahí.
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
    const match = candidates.find(
      (c) => last10(c.financeContactPhone) === target || last10(c.phone) === target,
    );
    if (!match) return null;
    return { id: match.id, name: match.name, organizationId: match.organizationId };
  }
}
