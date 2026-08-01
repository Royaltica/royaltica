import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.validation';
import { UsageService } from '../usage/usage.service';

export interface SendEmailInput {
  to: string | string[];
  subject: string;
  html: string;
  /** Texto plano opcional (fallback para clientes sin HTML). */
  text?: string;
  /**
   * Reply-To opcional (útil en formularios de contacto para que el equipo
   * pueda responder directo al usuario apretando "Responder").
   */
  replyTo?: string | string[];
  /** Si se indica, se registra un UsageEvent EMAIL_SENT para esa organización. */
  organizationId?: string;
  /** Adjuntos opcionales (p. ej. el PDF del reporte de cobranza). */
  attachments?: SendEmailAttachment[];
}

export interface SendEmailAttachment {
  filename: string;
  /** MIME type explícito del adjunto; Resend también puede inferirlo por filename. */
  contentType?: string;
  /** Resend acepta Buffer o contenido base64 en `content`. */
  content: Buffer | string;
}

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const MIME_TYPE_RE = /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/i;

/**
 * Abstracción de envío de correo vía Resend.
 *
 * Si RESEND_API_KEY no está configurada, el servicio corre en modo "stub":
 * `isConfigured` es false y `send` solo registra en el log lo que habría
 * enviado, devolviendo `{ sent: false }`. Así el flujo de invitaciones y
 * alertas funciona en desarrollo sin la API y sin romper nada.
 *
 * El SDK `resend` se carga con import dinámico para no penalizar el arranque
 * cuando no se usa.
 */
@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);
  private apiKey = '';
  private fromEmail = '';
  // Tipado laxo: el SDK se carga dinámicamente solo si está configurado.
  private client: import('resend').Resend | null = null;

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly usage: UsageService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.apiKey = this.config.get('RESEND_API_KEY', { infer: true });
    this.fromEmail = this.config.get('RESEND_FROM_EMAIL', { infer: true });

    if (!this.apiKey) {
      this.logger.warn(
        'Resend NO configurado (falta RESEND_API_KEY). Los correos se registran en modo stub (no se envían).',
      );
      return;
    }

    const { Resend } = await import('resend');
    this.client = new Resend(this.apiKey);
    this.logger.log(`Resend inicializado (from: ${this.fromEmail}).`);
  }

  get isConfigured(): boolean {
    return this.client !== null;
  }

  /**
   * Envía un correo. Nunca lanza: si Resend no está configurado o falla,
   * registra el incidente y devuelve `{ sent: false }` para que el flujo de
   * negocio (invitar usuario, generar alerta) continúe sin interrupción.
   */
  async send(input: SendEmailInput): Promise<{ sent: boolean; id?: string }> {
    const attachments = this.validateAttachments(input.attachments);
    if (attachments === null) {
      return { sent: false };
    }

    if (!this.client) {
      this.logger.debug(
        `[stub] Correo NO enviado a ${String(input.to)} — "${input.subject}".`,
      );
      return { sent: false };
    }

    try {
      const { data, error } = await this.client.emails.send({
        from: this.fromEmail,
        to: input.to,
        replyTo: input.replyTo,
        subject: input.subject,
        html: input.html,
        text: input.text,
        attachments: attachments?.map((a) => ({
          filename: a.filename,
          contentType: a.contentType,
          content: a.content,
        })),
      });
      if (error) {
        this.logger.warn(`Resend rechazó el correo: ${error.message}`);
        return { sent: false };
      }
      // Cost tracking: cuenta un correo por destinatario (fire-and-forget).
      if (input.organizationId) {
        const recipients = Array.isArray(input.to) ? input.to.length : 1;
        void this.usage.record({
          organizationId: input.organizationId,
          feature: 'EMAIL_SENT',
          units: recipients,
          metadata: { subject: input.subject },
        });
      }
      return { sent: true, id: data?.id };
    } catch (err) {
      this.logger.warn(
        `Fallo al enviar correo con Resend: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return { sent: false };
    }
  }

  // ── plantillas ────────────────────────────────────────────

  /** Invitación a unirse a la plataforma con link para definir contraseña. */
  async sendInvitation(
    to: string,
    name: string,
    inviteLink: string,
    orgName: string,
    organizationId?: string,
  ): Promise<{ sent: boolean; id?: string }> {
    return this.send({
      to,
      organizationId,
      subject: `Te invitaron a Royáltica (${orgName})`,
      html: this.wrap(
        `<h2>Hola, ${name}</h2>
         <p>Te invitaron a colaborar en <strong>${orgName}</strong> dentro de Royáltica.</p>
         <p>Define tu contraseña y entra con el siguiente botón:</p>
         <p style="margin:24px 0;">
           <a href="${inviteLink}" style="background:#0F62FE;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;">Activar mi cuenta</a>
         </p>
         <p style="color:#667085;font-size:13px;">Si el botón no funciona, copia este enlace:<br>${inviteLink}</p>`,
      ),
      text: `Hola ${name}, te invitaron a ${orgName} en Royáltica. Activa tu cuenta: ${inviteLink}`,
    });
  }

  /** Alerta genérica (documento por vencer, factura vencida, REP pendiente). */
  async sendAlert(
    to: string,
    title: string,
    body: string,
    organizationId?: string,
    attachments?: SendEmailAttachment[],
  ): Promise<{ sent: boolean; id?: string }> {
    return this.send({
      to,
      organizationId,
      subject: `Royáltica · ${title}`,
      html: this.wrap(`<h2>${title}</h2><p>${body}</p>`),
      text: `${title}\n\n${body}`,
      attachments,
    });
  }

  /** Recordatorio de cobro al cliente (agente de Cuentas por Cobrar). */
  async sendCollectionReminder(
    to: string,
    customerName: string,
    folio: string,
    total: string,
    dueDate: string,
    organizationId?: string,
    // Moneda del tenant (default MXN para no romper orgs existentes).
    currency = 'MXN',
  ): Promise<{ sent: boolean; id?: string }> {
    return this.send({
      to,
      organizationId,
      subject: `Recordatorio de pago · factura ${folio}`,
      html: this.wrap(
        `<h2>Hola, ${customerName}</h2>
         <p>Te recordamos que tu factura <strong>${folio}</strong> por
         <strong>$${total} ${currency}</strong> vence el <strong>${dueDate}</strong>.</p>
         <p>Si ya realizaste el pago, ignora este mensaje. Si necesitas apoyo o
         un comprobante, responde a este correo y con gusto te ayudamos.</p>
         <p style="color:#667085;font-size:13px;">Gracias por tu preferencia.</p>`,
      ),
      text: `Hola ${customerName}, tu factura ${folio} por $${total} ${currency} vence el ${dueDate}. Si ya pagaste, ignora este mensaje. Gracias.`,
    });
  }

  /**
   * Paso de la secuencia de escalamiento de cobranza (CollectionSequenceStep).
   * A diferencia de `sendCollectionReminder` (plantilla fija), aquí el cuerpo
   * ya viene resuelto por CollectionSequencesService (placeholders
   * reemplazados) y varía de tono según el paso (GENTLE/STANDARD/FIRM/URGENT).
   */
  async sendCollectionSequenceStep(
    to: string,
    customerName: string,
    body: string,
    organizationId?: string,
    tone?: string,
  ): Promise<{ sent: boolean; id?: string }> {
    return this.send({
      to,
      organizationId,
      subject:
        tone === 'URGENT' || tone === 'FIRM'
          ? 'Royáltica · Cuenta pendiente de pago'
          : 'Royáltica · Recordatorio de pago',
      html: this.wrap(
        `<h2>Hola, ${customerName}</h2>
         <p style="white-space:pre-line;">${body}</p>`,
      ),
      text: body,
    });
  }

  /** Envoltura HTML consistente para todos los correos. */
  private wrap(inner: string): string {
    return `<div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#101828;">
      ${inner}
      <hr style="border:none;border-top:1px solid #EAECF0;margin:32px 0 16px;">
      <p style="color:#98A2B3;font-size:12px;">Royáltica · Inteligencia de proveedores y cumplimiento fiscal.</p>
    </div>`;
  }

  private validateAttachments(
    attachments: SendEmailAttachment[] | undefined,
  ): SendEmailAttachment[] | undefined | null {
    if (!attachments) return undefined;

    for (const attachment of attachments) {
      const filename = attachment.filename.trim();
      if (!filename) {
        this.logger.warn('Correo no enviado: adjunto sin filename.');
        return null;
      }
      if (
        attachment.contentType !== undefined &&
        !MIME_TYPE_RE.test(attachment.contentType)
      ) {
        this.logger.warn(`Correo no enviado: MIME type inválido para ${filename}.`);
        return null;
      }
      const size =
        typeof attachment.content === 'string'
          ? Buffer.byteLength(attachment.content)
          : attachment.content.length;
      if (size === 0) {
        this.logger.warn(`Correo no enviado: adjunto vacío (${filename}).`);
        return null;
      }
      if (size > MAX_ATTACHMENT_BYTES) {
        this.logger.warn(`Correo no enviado: adjunto excede 10MB (${filename}).`);
        return null;
      }
    }

    return attachments;
  }
}
