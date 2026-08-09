import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import type { Env } from '../config/env.validation';
import { classifyIntent } from './collections-intent.util';
import {
  normalizeInboundPayload,
  extractFolioFromSubject,
  type NormalizedInboundEmail,
} from './email-parse.util';

/** Cabeceras que puede traer la firma, según el proveedor. */
export interface InboundSignatureHeaders {
  /** Firma HMAC simple (Cloudflare Worker, reenviador propio). */
  signature?: string;
  /** Trío de Svix, que es lo que usa Resend para correo entrante. */
  svixId?: string;
  svixTimestamp?: string;
  svixSignature?: string;
}

export interface InboundResult {
  processed: boolean;
  reason?: string;
}

/**
 * Webhook ENTRANTE de correo: recibe las respuestas de los clientes a los
 * recordatorios de cobranza y las convierte en un aviso trazable.
 *
 * Espeja deliberadamente el diseño del webhook de WhatsApp, porque las
 * garantías importantes son las mismas:
 *
 *  - El contenido entrante es dato NO CONFIABLE. Nada de lo que diga el
 *    correo dispara una acción por sí solo.
 *  - La factura NUNCA se marca como pagada aquí. Que un cliente escriba
 *    "ya pagué" es un aviso, no una prueba; la confirmación la hace una
 *    persona contra el banco.
 *  - Todo queda en bitácora inmutable (InvoiceAuditLog), que es lo que
 *    permite auditar después por qué el sistema hizo lo que hizo.
 *  - Nunca lanza hacia el proveedor: un webhook que responde 500 provoca
 *    reintentos en bucle.
 */
@Injectable()
export class EmailInboundService {
  private readonly logger = new Logger(EmailInboundService.name);

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly whatsapp: WhatsappService,
  ) {}

  /**
   * Valida la firma del webhook.
   *
   * Si no hay `EMAIL_INBOUND_SECRET` configurado, no hay nada contra qué
   * validar: se acepta con advertencia (solo tolerable en desarrollo). En
   * producción el secreto SIEMPRE debe estar, o cualquiera podría inyectar
   * respuestas falsas de clientes.
   */
  verifySignature(
    rawBody: Buffer | undefined,
    headers: InboundSignatureHeaders,
  ): boolean {
    const secret = this.config.get('EMAIL_INBOUND_SECRET', { infer: true });
    if (!secret) {
      this.logger.warn(
        'EMAIL_INBOUND_SECRET no configurado: la firma del correo entrante NO se valida (solo aceptable en desarrollo).',
      );
      return true;
    }
    if (!rawBody) return false;

    // Svix (Resend): se firma `${id}.${timestamp}.${body}` y la cabecera
    // trae una o más firmas separadas por espacio, cada una como `v1,<b64>`.
    if (headers.svixSignature && headers.svixId && headers.svixTimestamp) {
      const signedContent = `${headers.svixId}.${headers.svixTimestamp}.${rawBody.toString('utf8')}`;
      // El secreto de Svix viene como `whsec_<base64>`.
      const key = secret.startsWith('whsec_')
        ? Buffer.from(secret.slice(6), 'base64')
        : Buffer.from(secret, 'utf8');
      const expected = createHmac('sha256', key)
        .update(signedContent)
        .digest('base64');
      return headers.svixSignature
        .split(' ')
        .some((part) => this.safeEquals(part.replace(/^v1,/, ''), expected));
    }

    // HMAC simple sobre el cuerpo crudo, en hex (con o sin prefijo sha256=).
    if (headers.signature) {
      const expected = createHmac('sha256', secret)
        .update(rawBody)
        .digest('hex');
      return this.safeEquals(
        headers.signature.replace(/^sha256=/, ''),
        expected,
      );
    }

    return false;
  }

  /** Comparación en tiempo constante, tolerante a longitudes distintas. */
  private safeEquals(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
  }

  /**
   * Procesa el correo entrante. Nunca lanza: cualquier fallo se registra y se
   * responde 200 para que el proveedor no reintente indefinidamente.
   */
  async handleIncoming(payload: unknown): Promise<InboundResult> {
    try {
      const email = normalizeInboundPayload(payload);
      if (!email) {
        return { processed: false, reason: 'payload-no-reconocido' };
      }
      return await this.processEmail(email);
    } catch (err) {
      this.logger.warn(
        `No se pudo procesar el correo entrante: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return { processed: false, reason: 'error-interno' };
    }
  }

  private async processEmail(email: NormalizedInboundEmail): Promise<InboundResult> {
    const customer = await this.findCustomerByEmail(email.from);
    if (!customer) {
      // Correo de alguien que no es cliente: se ignora en silencio a
      // propósito (no confirmamos ni negamos si la dirección existe).
      this.logger.debug(`Correo entrante de ${email.from} sin cliente asociado; se ignora.`);
      return { processed: false, reason: 'cliente-no-encontrado' };
    }

    const invoice = await this.findInvoice(customer.id, email.subject);
    const { intent, matched, needsHuman, escalationMatch } = classifyIntent(
      email.text,
    );

    const folio = invoice?.folio ?? invoice?.cfdiUuid.slice(0, 8) ?? 's/folio';
    const total = invoice
      ? Number(invoice.total).toLocaleString('es-MX', {
          minimumFractionDigits: 2,
        })
      : null;

    // Bitácora inmutable. Se AWAITEA (no fire-and-forget): es el rastro que
    // sostiene cualquier disputa posterior sobre cómo se cobró.
    if (invoice) {
      await this.prisma.invoiceAuditLog.create({
        data: {
          invoiceId: invoice.id,
          action: needsHuman ? 'CUSTOMER_ESCALATION' : intent,
          metadata: {
            channel: 'email',
            from: email.from,
            messageId: email.messageId,
            subject: email.subject.slice(0, 200),
            text: email.text.slice(0, 500),
            matchedKeyword: matched,
            escalationKeyword: escalationMatch,
          } as Prisma.InputJsonValue,
        },
      });
    }

    await this.notifyResponsibles(customer, {
      intent,
      needsHuman,
      escalationMatch,
      folio,
      total,
      text: email.text,
      invoiceId: invoice?.id ?? null,
    });

    this.logger.log(
      `Correo de cobranza de ${customer.name} clasificado como ${intent}` +
        (matched ? ` (palabra: "${matched}")` : '') +
        (needsHuman ? ` · ESCALA A HUMANO (palabra: "${escalationMatch}")` : ''),
    );

    return { processed: true };
  }

  /**
   * Avisa a quien puede actuar. Incluye SUPERADMIN además de CORPORATE_ADMIN
   * (el helper genérico `notifyOrgAdmins` solo cubre CORPORATE_ADMIN, y en
   * Royáltica hay fundadores operando como SUPERADMIN que también deben
   * enterarse de un reclamo de pago).
   */
  private async notifyResponsibles(
    customer: { id: string; name: string; organizationId: string },
    ctx: {
      intent: string;
      needsHuman: boolean;
      escalationMatch: string | null;
      folio: string;
      total: string | null;
      text: string;
      invoiceId: string | null;
    },
  ): Promise<void> {
    const excerpt = ctx.text.slice(0, 200);

    let title: string;
    let body: string;
    let type: string;

    if (ctx.needsHuman) {
      type = 'RECEIVABLE_ESCALATION';
      title = 'Cobranza: requiere atención humana';
      body =
        `${customer.name} respondió algo que NO debe contestar el agente ` +
        `(detonante: "${ctx.escalationMatch}"). Factura ${ctx.folio}. ` +
        `Atiéndelo personalmente. Mensaje: "${excerpt}"`;
    } else if (ctx.intent === 'PAYMENT_CLAIMED') {
      type = 'RECEIVABLE_PAYMENT_CLAIMED';
      title = 'Cliente reporta un pago';
      body =
        `${customer.name} reporta por correo que ya pagó la factura ${ctx.folio}` +
        (ctx.total ? ` ($${ctx.total} MXN)` : '') +
        `. Verifícalo contra el banco y confírmalo en Royáltica. ` +
        `Mensaje: "${excerpt}"`;
    } else {
      type = 'RECEIVABLE_CUSTOMER_REPLY';
      title = 'Respuesta de cliente (cobranza)';
      body = `${customer.name} respondió al recordatorio por correo: "${excerpt}". Dale seguimiento.`;
    }

    const responsibles = await this.prisma.user.findMany({
      where: {
        organizationId: customer.organizationId,
        role: { in: ['CORPORATE_ADMIN', 'SUPERADMIN'] },
        isActive: true,
      },
      select: { id: true },
    });

    await this.notifications.createMany(
      responsibles.map((u) => u.id),
      {
        type,
        title,
        body,
        metadata: { invoiceId: ctx.invoiceId, customerId: customer.id },
      },
    );

    const emoji = ctx.needsHuman ? '⚠️' : ctx.intent === 'PAYMENT_CLAIMED' ? '🔔' : '💬';
    void this.whatsapp.notifyOrgAdmins(
      customer.organizationId,
      `${emoji} Royáltica · ${title}: ${body}`,
    );
  }

  /**
   * Empata el remitente con un cliente por correo (exacto, sin distinguir
   * mayúsculas). Consulta cruzando organizaciones a propósito: el webhook no
   * tiene contexto de org, igual que el de WhatsApp.
   */
  private async findCustomerByEmail(from: string): Promise<{
    id: string;
    name: string;
    organizationId: string;
  } | null> {
    const match = await this.prisma.customer.findFirst({
      where: {
        deletedAt: null,
        email: { equals: from, mode: 'insensitive' },
      },
      select: { id: true, name: true, organizationId: true },
    });
    return match;
  }

  /**
   * Encuentra la factura a la que se refiere la respuesta.
   *
   * Primero intenta el folio del asunto (`Re: Recordatorio de pago · factura
   * F-123`), que liga la respuesta a la factura EXACTA. Si no hay folio
   * reconocible, cae a la pendiente más vencida — el mismo criterio que usa
   * el webhook de WhatsApp.
   */
  private async findInvoice(customerId: string, subject: string) {
    const folio = extractFolioFromSubject(subject);

    if (folio) {
      const byFolio = await this.prisma.invoice.findFirst({
        where: {
          customerId,
          direction: 'RECEIVABLE',
          deletedAt: null,
          folio,
        },
      });
      if (byFolio) return byFolio;
    }

    return this.prisma.invoice.findFirst({
      where: {
        customerId,
        direction: 'RECEIVABLE',
        deletedAt: null,
      },
      orderBy: [{ status: 'asc' }, { dueDate: 'asc' }],
    });
  }
}
