import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.validation';
import { PrismaService } from '../common/prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { NotificationsService } from '../notifications/notifications.service';
import { postToSlack } from '../common/slack-notifier';
import { renderEmail } from '../email/templates/render';
import { DemoConfirmationEmail } from '../email/templates/DemoConfirmationEmail';
import { ContactConfirmationEmail } from '../email/templates/ContactConfirmationEmail';
import type { ScheduleDemoDto } from './dto/schedule-demo.dto';
import type { ContactDto } from './dto/contact.dto';

/**
 * Captura de leads públicos (agendar demo + contactar) desde royaltica.com.
 *
 * - Persiste cada solicitud en `Lead` para que el equipo tenga historial y
 *   pueda operarlas desde el panel admin.
 * - Envía correo al equipo (LEADS_EMAIL) con los datos del lead — si Resend
 *   no está configurado, EmailService cae a modo stub y el flujo NO falla.
 * - Envía correo de confirmación al usuario si Resend está activo.
 * - Crea una notificación in-app para los SUPERADMIN (canal redundante).
 *
 * Ninguna de las notificaciones bloquea la respuesta 200: el usuario debe
 * ver "gracias, te contactamos" incluso si algún canal externo falla.
 */
@Injectable()
export class MarketingService {
  private readonly logger = new Logger(MarketingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  private get leadsEmail(): string {
    return (
      this.config.get('LEADS_EMAIL', { infer: true }) || 'hello@royaltica.com'
    );
  }

  private get brandName(): string {
    return 'Royáltica';
  }

  async scheduleDemo(dto: ScheduleDemoDto): Promise<{ ok: true }> {
    // Honeypot: si el campo `website` llegó lleno, es un bot. Respondemos
    // 200 falso para no darle señal, pero no guardamos ni notificamos.
    if (dto.website && dto.website.trim() !== '') {
      this.logger.warn(`[SPAM demo] Honeypot activado desde ${dto.email}`);
      return { ok: true };
    }

    const lead = await this.prisma.lead.create({
      data: {
        type: 'DEMO',
        name: dto.name,
        company: dto.company,
        email: dto.email.toLowerCase(),
        phone: dto.phone ?? null,
        jobTitle: dto.jobTitle ?? null,
        companySize: dto.companySize ?? null,
        preferredDate: dto.preferredDate ? new Date(dto.preferredDate) : null,
        preferredTime: dto.preferredTime ?? null,
        message: dto.message ?? null,
        source: dto.source ?? null,
      },
    });

    // Correo interno al equipo
    await this.email
      .send({
        to: this.leadsEmail,
        subject: `🎯 Nueva demo solicitada: ${dto.company}`,
        html: this.demoInternalHtml(dto),
        text: this.demoInternalText(dto),
      })
      .catch((err) =>
        this.logger.error(`Fallo enviando correo interno de demo: ${err}`),
      );

    // Confirmación al usuario (plantilla React reutilizable — ver
    // ../email/templates/DemoConfirmationEmail.tsx).
    await this.sendDemoConfirmation(dto);

    // Notificación in-app a superadmins
    await this.notifySuperadmins(
      'Nueva solicitud de demo',
      `${dto.name} (${dto.company}) — ${dto.email}` +
        (dto.preferredDate ? ` · ${dto.preferredDate}` : ''),
      { leadId: lead.id, type: 'DEMO' },
    );

    // Notificación opcional a Slack (fire-and-forget)
    void postToSlack(
      this.config.get('SLACK_LEADS_WEBHOOK', { infer: true }),
      {
        text: `🎯 Nueva demo: ${dto.name} (${dto.company})`,
        blocks: [
          {
            type: 'header',
            text: { type: 'plain_text', text: `🎯 Nueva demo · ${dto.company}` },
          },
          {
            type: 'section',
            fields: [
              { type: 'mrkdwn', text: `*Nombre:*\n${dto.name}` },
              { type: 'mrkdwn', text: `*Correo:*\n<mailto:${dto.email}|${dto.email}>` },
              dto.phone && { type: 'mrkdwn', text: `*Tel:*\n${dto.phone}` },
              dto.jobTitle && { type: 'mrkdwn', text: `*Puesto:*\n${dto.jobTitle}` },
              dto.companySize && { type: 'mrkdwn', text: `*Empleados:*\n${dto.companySize}` },
              dto.preferredDate && { type: 'mrkdwn', text: `*Fecha preferida:*\n${dto.preferredDate}${dto.preferredTime ? ' ' + dto.preferredTime : ''}` },
            ].filter(Boolean),
          },
          dto.message && {
            type: 'section',
            text: { type: 'mrkdwn', text: `*Contexto:*\n${dto.message}` },
          },
        ].filter(Boolean),
      },
    );

    this.logger.warn(
      `[LEAD DEMO] ${dto.email} (${dto.company}) — id=${lead.id}`,
    );
    return { ok: true };
  }

  async contact(dto: ContactDto): Promise<{ ok: true }> {
    // Honeypot (ver scheduleDemo).
    if (dto.website && dto.website.trim() !== '') {
      this.logger.warn(`[SPAM contact] Honeypot activado desde ${dto.email}`);
      return { ok: true };
    }

    const lead = await this.prisma.lead.create({
      data: {
        type: 'CONTACT',
        name: dto.name,
        company: dto.company ?? null,
        email: dto.email.toLowerCase(),
        phone: dto.phone ?? null,
        subject: dto.subject ?? null,
        message: dto.message,
        source: dto.source ?? null,
      },
    });

    await this.email
      .send({
        to: this.leadsEmail,
        replyTo: dto.email,
        subject: `📨 Nuevo contacto: ${dto.subject ?? dto.name}`,
        html: this.contactInternalHtml(dto),
        text: this.contactInternalText(dto),
      })
      .catch((err) =>
        this.logger.error(`Fallo enviando correo interno de contacto: ${err}`),
      );

    await this.sendContactConfirmation(dto);

    await this.notifySuperadmins(
      'Nuevo mensaje de contacto',
      `${dto.name} — ${dto.email}${dto.subject ? ` · "${dto.subject}"` : ''}`,
      { leadId: lead.id, type: 'CONTACT' },
    );

    void postToSlack(
      this.config.get('SLACK_LEADS_WEBHOOK', { infer: true }),
      {
        text: `📨 Nuevo contacto: ${dto.name}`,
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: `📨 ${dto.subject ?? 'Nuevo contacto'}`,
            },
          },
          {
            type: 'section',
            fields: [
              { type: 'mrkdwn', text: `*Nombre:*\n${dto.name}` },
              { type: 'mrkdwn', text: `*Correo:*\n<mailto:${dto.email}|${dto.email}>` },
              dto.company && { type: 'mrkdwn', text: `*Empresa:*\n${dto.company}` },
              dto.phone && { type: 'mrkdwn', text: `*Tel:*\n${dto.phone}` },
            ].filter(Boolean),
          },
          {
            type: 'section',
            text: { type: 'mrkdwn', text: `*Mensaje:*\n${dto.message}` },
          },
        ],
      },
    );

    this.logger.warn(
      `[LEAD CONTACT] ${dto.email} — id=${lead.id}`,
    );
    return { ok: true };
  }

  /**
   * Renderiza y envía la confirmación de demo con la plantilla React
   * (DemoConfirmationEmail). Nunca lanza: un fallo de render o de envío no
   * debe tumbar el flujo de captura del lead (mismo criterio que el resto
   * de correos de este servicio).
   */
  private async sendDemoConfirmation(dto: ScheduleDemoDto): Promise<void> {
    try {
      const { html, text } = await renderEmail(
        DemoConfirmationEmail({
          name: dto.name,
          company: dto.company,
          email: dto.email,
          preferredDate: dto.preferredDate,
          preferredTime: dto.preferredTime,
        }),
      );
      await this.email.send({
        to: dto.email,
        subject: `Recibimos tu solicitud de demo · ${this.brandName}`,
        html,
        text,
      });
    } catch (err) {
      this.logger.error(
        `Fallo renderizando/enviando confirmación de demo: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  /** Renderiza y envía la confirmación de contacto con la plantilla React. */
  private async sendContactConfirmation(dto: ContactDto): Promise<void> {
    try {
      const { html, text } = await renderEmail(
        ContactConfirmationEmail({ name: dto.name, message: dto.message }),
      );
      await this.email.send({
        to: dto.email,
        subject: `Recibimos tu mensaje · ${this.brandName}`,
        html,
        text,
      });
    } catch (err) {
      this.logger.error(
        `Fallo renderizando/enviando confirmación de contacto: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  private async notifySuperadmins(
    title: string,
    body: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    const admins = await this.prisma.user
      .findMany({
        where: { role: 'SUPERADMIN', isActive: true },
        select: { id: true },
      })
      .catch(() => [] as { id: string }[]);
    await Promise.all(
      admins.map((a) =>
        this.notifications
          .create({
            userId: a.id,
            type: 'ACCESS_REQUEST',
            title,
            body,
            metadata,
          })
          .catch(() => undefined),
      ),
    );
  }

  // ─── Plantillas HTML/text ───────────────────────────────────────

  private demoInternalHtml(d: ScheduleDemoDto): string {
    return `<!doctype html><meta charset="utf-8"/>
<div style="font-family:system-ui,-apple-system,sans-serif;line-height:1.5;color:#111;max-width:600px;margin:0 auto;padding:24px">
  <div style="border-left:4px solid #C9A961;padding-left:16px;margin-bottom:24px">
    <div style="text-transform:uppercase;letter-spacing:2px;font-size:11px;color:#666">Nueva demo solicitada</div>
    <h1 style="margin:8px 0 0;font-size:24px">${escapeHtml(d.company)}</h1>
  </div>
  <table style="width:100%;border-collapse:collapse;font-size:14px">
    ${row('Nombre', d.name)}
    ${row('Empresa', d.company)}
    ${row('Correo', `<a href="mailto:${escapeHtml(d.email)}">${escapeHtml(d.email)}</a>`)}
    ${d.phone ? row('Teléfono', d.phone) : ''}
    ${d.jobTitle ? row('Puesto', d.jobTitle) : ''}
    ${d.companySize ? row('Tamaño de empresa', `${d.companySize} empleados`) : ''}
    ${d.preferredDate ? row('Fecha preferida', d.preferredDate) : ''}
    ${d.preferredTime ? row('Horario preferido', d.preferredTime) : ''}
    ${d.source ? row('Origen', d.source) : ''}
  </table>
  ${
    d.message
      ? `<div style="margin-top:24px;padding:16px;background:#F8F5EF;border-radius:8px;font-size:14px"><strong style="display:block;text-transform:uppercase;letter-spacing:1px;font-size:11px;color:#666;margin-bottom:8px">Mensaje</strong>${escapeHtml(d.message)}</div>`
      : ''
  }
  <p style="margin-top:32px;font-size:12px;color:#999">— Sistema Royáltica</p>
</div>`;
  }

  private demoInternalText(d: ScheduleDemoDto): string {
    return [
      `Nueva demo solicitada — ${d.company}`,
      '',
      `Nombre: ${d.name}`,
      `Empresa: ${d.company}`,
      `Correo: ${d.email}`,
      d.phone && `Teléfono: ${d.phone}`,
      d.jobTitle && `Puesto: ${d.jobTitle}`,
      d.companySize && `Empleados: ${d.companySize}`,
      d.preferredDate && `Fecha preferida: ${d.preferredDate}`,
      d.preferredTime && `Horario preferido: ${d.preferredTime}`,
      d.source && `Origen: ${d.source}`,
      '',
      d.message && `Mensaje: ${d.message}`,
    ]
      .filter(Boolean)
      .join('\n');
  }

  private contactInternalHtml(d: ContactDto): string {
    return `<!doctype html><meta charset="utf-8"/>
<div style="font-family:system-ui,-apple-system,sans-serif;line-height:1.5;color:#111;max-width:600px;margin:0 auto;padding:24px">
  <div style="border-left:4px solid #C9A961;padding-left:16px;margin-bottom:24px">
    <div style="text-transform:uppercase;letter-spacing:2px;font-size:11px;color:#666">Nuevo contacto</div>
    <h1 style="margin:8px 0 0;font-size:22px">${escapeHtml(d.subject ?? d.name)}</h1>
  </div>
  <table style="width:100%;border-collapse:collapse;font-size:14px">
    ${row('Nombre', d.name)}
    ${d.company ? row('Empresa', d.company) : ''}
    ${row('Correo', `<a href="mailto:${escapeHtml(d.email)}">${escapeHtml(d.email)}</a>`)}
    ${d.phone ? row('Teléfono', d.phone) : ''}
    ${d.source ? row('Origen', d.source) : ''}
  </table>
  <div style="margin-top:24px;padding:16px;background:#F8F5EF;border-radius:8px;font-size:14px;white-space:pre-wrap">
    ${escapeHtml(d.message)}
  </div>
  <p style="margin-top:24px;font-size:12px;color:#999">Responde a <a href="mailto:${escapeHtml(d.email)}">${escapeHtml(d.email)}</a> — este correo ya tiene reply-to configurado.</p>
</div>`;
  }

  private contactInternalText(d: ContactDto): string {
    return [
      `Nuevo contacto — ${d.subject ?? d.name}`,
      '',
      `Nombre: ${d.name}`,
      d.company && `Empresa: ${d.company}`,
      `Correo: ${d.email}`,
      d.phone && `Teléfono: ${d.phone}`,
      d.source && `Origen: ${d.source}`,
      '',
      `Mensaje:`,
      d.message,
    ]
      .filter(Boolean)
      .join('\n');
  }

}

function row(label: string, value: string): string {
  return `<tr>
    <td style="padding:8px 12px 8px 0;color:#666;font-size:12px;text-transform:uppercase;letter-spacing:1px;white-space:nowrap;vertical-align:top">${escapeHtml(label)}</td>
    <td style="padding:8px 0;font-size:14px;color:#111">${value}</td>
  </tr>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
