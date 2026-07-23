import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.validation';
import { PrismaService } from '../common/prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { NotificationsService } from '../notifications/notifications.service';
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

    // Confirmación al usuario
    await this.email
      .send({
        to: dto.email,
        subject: `Recibimos tu solicitud de demo · ${this.brandName}`,
        html: this.demoConfirmationHtml(dto),
        text: this.demoConfirmationText(dto),
      })
      .catch(() => undefined);

    // Notificación in-app a superadmins
    await this.notifySuperadmins(
      'Nueva solicitud de demo',
      `${dto.name} (${dto.company}) — ${dto.email}` +
        (dto.preferredDate ? ` · ${dto.preferredDate}` : ''),
      { leadId: lead.id, type: 'DEMO' },
    );

    this.logger.warn(
      `[LEAD DEMO] ${dto.email} (${dto.company}) — id=${lead.id}`,
    );
    return { ok: true };
  }

  async contact(dto: ContactDto): Promise<{ ok: true }> {
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

    await this.email
      .send({
        to: dto.email,
        subject: `Recibimos tu mensaje · ${this.brandName}`,
        html: this.contactConfirmationHtml(dto),
        text: this.contactConfirmationText(dto),
      })
      .catch(() => undefined);

    await this.notifySuperadmins(
      'Nuevo mensaje de contacto',
      `${dto.name} — ${dto.email}${dto.subject ? ` · "${dto.subject}"` : ''}`,
      { leadId: lead.id, type: 'CONTACT' },
    );

    this.logger.warn(
      `[LEAD CONTACT] ${dto.email} — id=${lead.id}`,
    );
    return { ok: true };
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

  private demoConfirmationHtml(d: ScheduleDemoDto): string {
    return `<!doctype html><meta charset="utf-8"/>
<div style="font-family:system-ui,-apple-system,sans-serif;line-height:1.6;color:#111;max-width:560px;margin:0 auto;padding:32px 24px">
  <div style="text-align:center;margin-bottom:24px">
    <div style="text-transform:uppercase;letter-spacing:3px;font-size:11px;color:#C9A961">Royáltica</div>
    <h1 style="margin:12px 0 0;font-family:Georgia,serif;font-size:28px;font-weight:400">Hola ${escapeHtml(firstName(d.name))} 👋</h1>
  </div>
  <p>Gracias por tu interés en <strong>Royáltica</strong>. Recibimos tu solicitud de demo y nuestro equipo te contactará dentro de las próximas <strong>24 horas hábiles</strong> para coordinar la sesión${
    d.preferredDate ? ` (tomamos en cuenta tu preferencia del <strong>${escapeHtml(d.preferredDate)}${d.preferredTime ? ' ' + escapeHtml(d.preferredTime) : ''}</strong>)` : ''
  }.</p>
  <p>En la demo verás:</p>
  <ul style="padding-left:20px">
    <li>Cómo Royáltica orquesta el flujo de aprobación de facturas y REP.</li>
    <li>Automatización de DIOT y validación 69-B contra el SAT.</li>
    <li>Portal de proveedores y auditoría forense con IA.</li>
  </ul>
  <p>Si necesitas urgencia, puedes responder directo a este correo.</p>
  <p style="margin-top:32px">Un abrazo,<br/>El equipo de Royáltica</p>
  <hr style="border:none;border-top:1px solid #E8E2D5;margin:32px 0"/>
  <p style="font-size:11px;color:#999;text-align:center">
    Este correo se envió a ${escapeHtml(d.email)} porque solicitaste una demo en royaltica.com.<br/>
    Si no fuiste tú, ignora este mensaje.
  </p>
</div>`;
  }

  private demoConfirmationText(d: ScheduleDemoDto): string {
    return `Hola ${firstName(d.name)},

Gracias por tu interés en Royáltica. Recibimos tu solicitud de demo y te contactaremos en las próximas 24h hábiles para coordinar la sesión.

En la demo verás cómo orquestamos el flujo de aprobación de facturas y REP, la automatización de DIOT y la validación 69-B, el portal de proveedores y la auditoría forense con IA.

Si necesitas urgencia, responde directo a este correo.

— El equipo de Royáltica
`;
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

  private contactConfirmationHtml(d: ContactDto): string {
    return `<!doctype html><meta charset="utf-8"/>
<div style="font-family:system-ui,-apple-system,sans-serif;line-height:1.6;color:#111;max-width:560px;margin:0 auto;padding:32px 24px">
  <div style="text-align:center;margin-bottom:24px">
    <div style="text-transform:uppercase;letter-spacing:3px;font-size:11px;color:#C9A961">Royáltica</div>
    <h1 style="margin:12px 0 0;font-family:Georgia,serif;font-size:26px;font-weight:400">Recibimos tu mensaje</h1>
  </div>
  <p>Hola ${escapeHtml(firstName(d.name))}, gracias por escribirnos. Un miembro del equipo te responderá pronto al mismo correo desde el que enviaste tu consulta.</p>
  <div style="margin:24px 0;padding:16px;background:#F8F5EF;border-radius:8px;font-size:13px;color:#555">
    <strong style="display:block;text-transform:uppercase;letter-spacing:1px;font-size:10px;color:#999;margin-bottom:8px">Tu mensaje</strong>
    <div style="white-space:pre-wrap">${escapeHtml(d.message)}</div>
  </div>
  <p style="margin-top:24px">— El equipo de Royáltica</p>
</div>`;
  }

  private contactConfirmationText(d: ContactDto): string {
    return `Hola ${firstName(d.name)},

Recibimos tu mensaje. Un miembro del equipo te responderá pronto.

Tu mensaje:
${d.message}

— El equipo de Royáltica
`;
  }
}

function row(label: string, value: string): string {
  return `<tr>
    <td style="padding:8px 12px 8px 0;color:#666;font-size:12px;text-transform:uppercase;letter-spacing:1px;white-space:nowrap;vertical-align:top">${escapeHtml(label)}</td>
    <td style="padding:8px 0;font-size:14px;color:#111">${value}</td>
  </tr>`;
}

function firstName(full: string): string {
  return full.trim().split(/\s+/)[0] ?? full;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
