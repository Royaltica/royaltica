import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InvoiceStatus, PaymentType } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailService } from '../email/email.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { UsageService } from '../usage/usage.service';
import { ReceivablesService } from '../receivables/receivables.service';
import { DashboardService } from '../dashboard/dashboard.service';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import type { Env } from '../config/env.validation';

/**
 * Tareas programadas (recordatorios) basadas en @nestjs/schedule.
 *
 * Decisión: se usa @nestjs/schedule (cron in-proc) en lugar de BullMQ.
 * El trabajo aquí es un escaneo periódico idempotente (documentos por
 * vencer, facturas vencidas, REP pendiente), no un flujo de jobs con
 * reintentos/concurrencia. Cuando se necesite procesamiento asíncrono
 * con cola persistente (p. ej. reintentos de dispersión de factoraje vía
 * webhook), se puede introducir BullMQ sin tocar estos recordatorios.
 *
 * Cada tarea puede invocarse manualmente (p. ej. desde un endpoint admin
 * o una prueba) además de su disparo por cron.
 */
@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly notifications: NotificationsService,
    private readonly email: EmailService,
    private readonly whatsapp: WhatsappService,
    private readonly usage: UsageService,
    private readonly receivables: ReceivablesService,
    private readonly dashboard: DashboardService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  private get enabled(): boolean {
    return this.config.get('JOBS_ENABLED', { infer: true }) === 'true';
  }

  // ── Documentos KYC por vencer ─────────────────────────────
  @Cron(CronExpression.EVERY_DAY_AT_7AM, { name: 'document-expiry' })
  async documentExpiryReminders(): Promise<{ notified: number }> {
    if (!this.enabled) return { notified: 0 };
    let notified = 0;
    const orgs = await this.activeOrganizations();
    const now = new Date();

    for (const org of orgs) {
      const { documentAlertDays } = await this.settings.get(org.id);
      const limit = new Date(now.getTime() + documentAlertDays * 86_400_000);

      const docs = await this.prisma.supplierDocument.findMany({
        where: {
          deletedAt: null,
          supplier: { organizationId: org.id, deletedAt: null },
          expiresAt: { gte: now, lte: limit },
        },
        select: {
          type: true,
          expiresAt: true,
          supplier: { select: { name: true } },
        },
      });
      if (docs.length === 0) continue;

      const admins = await this.orgAdmins(org.id);
      const body = `Tienes ${docs.length} documento(s) de proveedores por vencer en los próximos ${documentAlertDays} días.`;
      notified += await this.fanOut(
        org.id,
        admins,
        {
          type: 'DOCUMENT_EXPIRING',
          title: 'Documentos por vencer',
          body,
        },
        true, // crítico: dispara también WhatsApp a admins con opt-in
      );
    }

    this.logger.log(`document-expiry: ${notified} notificación(es).`);
    return { notified };
  }

  // ── Facturas vencidas (no pagadas tras su dueDate) ────────
  @Cron(CronExpression.EVERY_DAY_AT_8AM, { name: 'invoice-overdue' })
  async overdueInvoiceReminders(): Promise<{ notified: number }> {
    if (!this.enabled) return { notified: 0 };
    let notified = 0;
    const now = new Date();
    const orgs = await this.activeOrganizations();

    for (const org of orgs) {
      const overdue = await this.prisma.invoice.count({
        where: {
          organizationId: org.id,
          direction: 'PAYABLE',
          deletedAt: null,
          dueDate: { lt: now },
          status: {
            in: [
              InvoiceStatus.PENDING,
              InvoiceStatus.AUDITED,
              InvoiceStatus.APPROVED,
            ],
          },
        },
      });
      if (overdue === 0) continue;

      const admins = await this.orgAdmins(org.id);
      notified += await this.fanOut(org.id, admins, {
        type: 'INVOICE_OVERDUE',
        title: 'Facturas vencidas',
        body: `Hay ${overdue} factura(s) vencida(s) pendientes de pago.`,
      });
    }

    this.logger.log(`invoice-overdue: ${notified} notificación(es).`);
    return { notified };
  }

  // ── REP pendiente (PPD pagada sin complemento de pago) ────
  @Cron(CronExpression.EVERY_DAY_AT_9AM, { name: 'rep-reminder' })
  async repReminders(): Promise<{ notified: number }> {
    if (!this.enabled) return { notified: 0 };
    let notified = 0;
    const orgs = await this.activeOrganizations();

    for (const org of orgs) {
      const pending = await this.prisma.invoice.count({
        where: {
          organizationId: org.id,
          deletedAt: null,
          paymentType: PaymentType.PPD,
          status: InvoiceStatus.PAID,
          repStatus: 'PENDING',
        },
      });
      if (pending === 0) continue;

      const admins = await this.orgAdmins(org.id);
      notified += await this.fanOut(org.id, admins, {
        type: 'REP_PENDING',
        title: 'REP pendientes',
        body: `Hay ${pending} factura(s) PPD pagada(s) sin su REP (complemento de pago). Solicita su emisión al cliente.`,
      });
    }

    this.logger.log(`rep-reminder: ${notified} notificación(es).`);
    return { notified };
  }

  // ── Agente de cobranza: recordatorios de cobro al cliente (CxC) ──
  @Cron(CronExpression.EVERY_DAY_AT_10AM, { name: 'receivable-reminder' })
  async receivableReminders(): Promise<{ sent: number }> {
    if (!this.enabled) return { sent: 0 };
    return this.receivables.runReminderScan();
  }

  // ── Resumen semanal de cobranza al director (lunes 8am) ───
  @Cron('0 8 * * 1', { name: 'weekly-collection-digest' })
  async weeklyCollectionDigest(): Promise<{ sent: number }> {
    if (!this.enabled) return { sent: 0 };
    let sent = 0;
    const orgs = await this.activeOrganizations();
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 86_400_000);
    const fmt = (n: number) =>
      n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
    const weekLabel = weekAgo.toLocaleDateString('es-MX', {
      day: 'numeric',
      month: 'long',
    });

    for (const org of orgs) {
      const digest = await this.dashboard.getReceivablesDigest(
        { organizationId: org.id } as AuthenticatedUser,
        { from: weekAgo.toISOString(), to: now.toISOString() },
      );
      // Nada que reportar: no molestamos con un resumen vacío.
      if (
        digest.collected.count === 0 &&
        digest.reminders.total === 0 &&
        digest.outstanding.count === 0
      ) {
        continue;
      }

      const title = 'Resumen de cobranza';
      const body =
        `Semana del ${weekLabel}: ` +
        `cobrado ${fmt(digest.collected.amount)} (${digest.collected.count} factura[s]); ` +
        `${digest.reminders.total} recordatorio[s] enviados ` +
        `(${digest.reminders.whatsapp} WhatsApp, ${digest.reminders.email} correo); ` +
        `pendiente por cobrar ${fmt(digest.outstanding.amount)} (${digest.outstanding.count} factura[s]).`;

      const admins = await this.orgAdmins(org.id);
      // Correo a cada admin + WhatsApp a los admins con opt-in (fire-and-forget).
      await Promise.all(
        admins.map((a) => this.email.sendAlert(a.email, title, body, org.id)),
      );
      void this.whatsapp.notifyOrgAdmins(org.id, `📊 Royáltica · ${title}. ${body}`);
      if (admins.length > 0) sent += 1;
    }

    this.logger.log(`weekly-collection-digest: ${sent} organización(es) notificada(s).`);
    return { sent };
  }

  // ── helpers ───────────────────────────────────────────────

  private activeOrganizations() {
    return this.prisma.organization.findMany({
      where: { isActive: true, deletedAt: null },
      select: { id: true },
    });
  }

  private orgAdmins(organizationId: string) {
    return this.prisma.user.findMany({
      where: {
        organizationId,
        role: 'CORPORATE_ADMIN',
        isActive: true,
      },
      select: { id: true, email: true },
    });
  }

  /**
   * Crea notificación in-app + correo para cada destinatario. Si `critical` es
   * true, además dispara la alerta por WhatsApp a los admins con opt-in (solo
   * para eventos de alta prioridad, p. ej. documentos KYC vencidos).
   */
  private async fanOut(
    organizationId: string,
    recipients: { id: string; email: string }[],
    payload: { type: string; title: string; body: string },
    critical = false,
  ): Promise<number> {
    if (recipients.length === 0) return 0;
    await this.notifications.createMany(
      recipients.map((r) => r.id),
      payload,
    );
    await Promise.all(
      recipients.map((r) =>
        this.email.sendAlert(
          r.email,
          payload.title,
          payload.body,
          organizationId,
        ),
      ),
    );
    if (critical) {
      void this.whatsapp.notifyOrgAdmins(
        organizationId,
        `Royáltica · ${payload.title}: ${payload.body}`,
      );
    }
    void this.usage.record({
      organizationId,
      feature: 'JOB_RUN',
      units: 1,
      metadata: { job: payload.type, recipients: recipients.length },
    });
    return recipients.length;
  }
}
