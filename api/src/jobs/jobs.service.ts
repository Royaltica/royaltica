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
import { ReportsService } from '../reports/reports.service';
import { CollectionSequencesService } from '../collection-sequences/collection-sequences.service';
import { CustomerScoringService } from '../customers/scoring/customer-scoring.service';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import type { Env } from '../config/env.validation';
import {
  DEFAULT_CURRENCY,
  DEFAULT_LOCALE,
} from '../organization/organization.constants';

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
    private readonly reports: ReportsService,
    private readonly collectionSequences: CollectionSequencesService,
    private readonly customerScoring: CustomerScoringService,
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
    // T-14 (preventivo) y T-3 (urgente, con liga de pago + datos bancarios)
    // corren en el mismo pase diario: sus ventanas de vencimiento no se
    // traslapan, así que nunca compiten por el mismo recordatorio.
    const [t14, t3] = await Promise.all([
      this.receivables.runReminderScan('T14'),
      this.receivables.runReminderScan('T3'),
    ]);
    return { sent: t14.sent + t3.sent };
  }

  // ── FR-06: mantenimiento de datos para buenos pagadores (cada ~6 meses) ──
  // Corre diario (barato: la mayoría de los días no encuentra a nadie que
  // cruce el umbral de 182 días) para no depender de un cron mensual que
  // podría desfasarse del aniversario exacto de cada cliente.
  @Cron(CronExpression.EVERY_DAY_AT_11AM, { name: 'customer-service-message' })
  async customerServiceMessage(): Promise<{ sent: number }> {
    if (!this.enabled) return { sent: 0 };
    return this.receivables.runServiceMessageScan();
  }

  // ── Motor de escalamiento de cobranza multi-paso (Tradespace) ──
  // Corre después del recordatorio de un solo paso (10am): avanza cada
  // CollectionSequenceRun activa/por iniciar según la CollectionPolicy de
  // cada organización (guard rails de ventana horaria, tope semanal,
  // blackout dates, días de gracia). Ver CollectionSequencesService.
  @Cron(CronExpression.EVERY_DAY_AT_11AM, { name: 'collection-sequence-engine' })
  async collectionSequenceEngine(): Promise<{
    evaluated: number;
    sent: number;
    escalated: number;
    skipped: number;
  }> {
    if (!this.enabled) return { evaluated: 0, sent: 0, escalated: 0, skipped: 0 };
    return this.collectionSequences.runEngineScan();
  }

  // ── Resumen diario de notificaciones por WhatsApp (ROY-25) ──
  // A diferencia de `fanOut(critical=true)` (que dispara WhatsApp al
  // instante para un solo evento de alta prioridad), este job conecta
  // TODAS las notificaciones in-app de un usuario (facturas vencidas, REP
  // pendiente, documentos por vencer, cobranza escalada, etc.) con un
  // único mensaje resumen por WhatsApp, una vez al día — solo a quien hizo
  // opt-in con su teléfono. Si no hubo notificaciones nuevas en las
  // últimas 24h, no manda nada (nunca spamea un día "tranquilo").
  @Cron(CronExpression.EVERY_DAY_AT_6PM, { name: 'whatsapp-notifications-digest' })
  async whatsappNotificationsDigest(): Promise<{ sent: number; skipped: number }> {
    if (!this.enabled) return { sent: 0, skipped: 0 };
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const users = await this.prisma.user.findMany({
      where: { isActive: true, whatsappOptIn: true, whatsappPhone: { not: null } },
      select: { id: true, whatsappPhone: true, organizationId: true },
    });

    let sent = 0;
    let skipped = 0;
    for (const user of users) {
      if (!user.whatsappPhone) {
        skipped += 1;
        continue;
      }
      const { total, byType } = await this.notifications.summarySince(user.id, since);
      if (total === 0) {
        skipped += 1;
        continue;
      }

      const top = byType
        .slice(0, 3)
        .map((g) => `${g.count} ${this.humanizeNotificationType(g.type)}`)
        .join(', ');
      const text =
        `Royáltica · Tienes ${total} notificación(es) nueva(s) hoy: ${top}.` +
        ' Revisa el detalle en tu panel.';

      const res = await this.whatsapp.sendMessage(user.whatsappPhone, text);
      if (res.sent) {
        sent += 1;
        if (user.organizationId) {
          void this.usage.record({
            organizationId: user.organizationId,
            feature: 'JOB_RUN',
            units: 1,
            metadata: { job: 'whatsapp-notifications-digest', total },
          });
        }
      } else {
        skipped += 1;
      }
    }

    this.logger.log(
      `whatsapp-notifications-digest: ${sent} resumen(es) enviado(s), ${skipped} omitido(s).`,
    );
    return { sent, skipped };
  }

  // ── Resumen semanal de cobranza al director (lunes 8am) ───
  @Cron('0 8 * * 1', { name: 'weekly-collection-digest' })
  async weeklyCollectionDigest(): Promise<{ sent: number }> {
    if (!this.enabled) return { sent: 0 };
    let sent = 0;
    const orgs = await this.activeOrganizations();
    const now = new Date();
    const range = this.previousSevenDayRange(now);

    for (const org of orgs) {
      const admins = await this.orgAdmins(org.id);
      if (admins.length === 0) continue;

      if (await this.reports.wasReportSent(org.id, range)) {
        this.logger.debug(
          `weekly-collection-digest: reporte ya enviado para org ${org.id}.`,
        );
        continue;
      }

      const locale = org.locale ?? DEFAULT_LOCALE;
      const currency = org.currency ?? DEFAULT_CURRENCY;
      const fmt = (n: number) =>
        n.toLocaleString(locale, { style: 'currency', currency });
      const weekLabel = range.from.toLocaleDateString(locale, {
        day: 'numeric',
        month: 'long',
      });

      const digest = await this.dashboard.getReceivablesDigest(
        { organizationId: org.id } as AuthenticatedUser,
        { from: range.from.toISOString(), to: range.to.toISOString() },
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

      // PDF de cobranza (KPIs + antigüedad + clientes en riesgo) para adjuntar
      // al correo. Si falla la generación no bloqueamos el envío del resumen
      // en texto plano: se manda sin adjunto y se registra el error.
      let attachments:
        | { filename: string; contentType: string; content: Buffer }[]
        | undefined;
      try {
        const pdf = await this.reports.generateCollectionReportPdf(org.id, {
          from: range.from,
          to: range.to,
        });
        attachments = [
          {
            filename: 'reporte-cobranza.pdf',
            contentType: 'application/pdf',
            content: pdf,
          },
        ];
      } catch (err) {
        this.logger.warn(
          `No se pudo generar el PDF de cobranza para org ${org.id}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }

      // Correo a cada admin + WhatsApp a los admins con opt-in (fire-and-forget).
      const results = await Promise.all(
        admins.map((a) =>
          this.email.sendAlert(a.email, title, body, org.id, attachments),
        ),
      );
      void this.whatsapp.notifyOrgAdmins(org.id, `📊 Royáltica · ${title}. ${body}`);
      const emailSent = results.some((r) => r.sent);
      if (!emailSent) {
        this.logger.warn(
          `weekly-collection-digest: ningún correo fue enviado para org ${org.id}.`,
        );
      }
      sent += 1;
      await this.reports.recordReportSent(org.id, range, admins.length, emailSent);
    }

    this.logger.log(`weekly-collection-digest: ${sent} organización(es) notificada(s).`);
    return { sent };
  }

  // ── Score de puntualidad por cliente (FR-04/FR-05, spec "Mejoras V1") ──
  // Recalcula el score de TODO cliente CxC con al menos una factura, y si
  // cayó significativamente (ver SCORE_DROP_ALERT_THRESHOLD) alerta a los
  // admins sugiriendo intervención humana — tal cual pide el ejemplo de la
  // especificación (93% -> 61%). Corre después del motor de secuencias
  // (11am) para que el guardrail de FR-05 (excluir a buenos pagadores de
  // pasos agresivos) ya haya usado el score del día anterior esa mañana; el
  // valor fresco de hoy se usará mañana.
  @Cron('30 11 * * *', { name: 'customer-score-recompute' })
  async customerScoreRecompute(): Promise<{ recomputed: number; alerted: number }> {
    if (!this.enabled) return { recomputed: 0, alerted: 0 };
    let recomputed = 0;
    let alerted = 0;
    const orgs = await this.activeOrganizations();

    for (const org of orgs) {
      const customers = await this.prisma.customer.findMany({
        where: {
          organizationId: org.id,
          deletedAt: null,
          invoices: { some: { direction: 'RECEIVABLE', deletedAt: null } },
        },
        select: { id: true, name: true, score: true },
      });
      if (customers.length === 0) continue;

      const admins = await this.orgAdmins(org.id);
      for (const customer of customers) {
        const result = await this.customerScoring.recomputeOne(
          customer.id,
          customer.score,
        );
        recomputed += 1;
        if (result.droppedSignificantly) {
          await this.fanOut(
            org.id,
            admins,
            {
              type: 'CUSTOMER_SCORE_DROP',
              title: 'Riesgo alto: puntualidad en caída',
              body:
                `El score de puntualidad de ${customer.name} cayó de ` +
                `${result.previousScore}% a ${result.score}%. Se sugiere ` +
                'intervención humana inmediata.',
            },
            true, // crítico: también dispara WhatsApp a admins con opt-in
          );
          alerted += 1;
        }
      }
    }

    this.logger.log(
      `customer-score-recompute: ${recomputed} recalculado(s), ${alerted} alerta(s).`,
    );
    return { recomputed, alerted };
  }

  // ── helpers ───────────────────────────────────────────────

  /** "INVOICE_OVERDUE" -> "Invoice overdue" (legible en el resumen de WhatsApp). */
  private humanizeNotificationType(type: string): string {
    const lower = type.toLowerCase().replace(/_/g, ' ');
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  }

  private activeOrganizations() {
    return this.prisma.organization.findMany({
      where: { isActive: true, deletedAt: null },
      select: { id: true, locale: true, currency: true },
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

  private previousSevenDayRange(reference: Date): { from: Date; to: Date } {
    const to = new Date(reference);
    to.setUTCHours(0, 0, 0, 0);
    const from = new Date(to.getTime() - 7 * 86_400_000);
    return { from, to };
  }
}
