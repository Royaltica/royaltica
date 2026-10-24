import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InvoiceStatus, PaymentType } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
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
import { CustomerRiskService } from '../customers/scoring/customer-risk.service';
import { ActivityLogService } from '../activity/activity-log.service';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import type { Env } from '../config/env.validation';
import {
  DEFAULT_CURRENCY,
  DEFAULT_LOCALE,
} from '../organization/organization.constants';

/**
 * Acción de bitácora (ActivityLog, organizationId=null = evento de
 * plataforma) que registra cada corrida del motor de cobranza (cron
 * 'collection-sequence-engine'), éxito o falla. AdminService la lee para
 * armar el indicador "¿está trabado el agente de recordatorios?" del panel
 * SUPERADMIN — pedido explícito de Paolo.
 */
export const COLLECTION_ENGINE_JOB_RUN_ACTION = 'JOB_RUN_COLLECTION_ENGINE';

/**
 * Acción de bitácora para cada snapshot periódico de salud del sistema
 * (latencia de DB/Redis). Antes el panel SUPERADMIN solo medía esto al
 * cargar la página (snapshot único, sin histórico) — esto guarda una
 * muestra cada 10 minutos para poder calcular uptime % y tendencia de
 * latencia en una ventana de tiempo. Ver AdminService#healthHistory.
 */
export const SYSTEM_HEALTH_SNAPSHOT_ACTION = 'SYSTEM_HEALTH_SNAPSHOT';

/** Acción de bitácora: se mandó una alerta proactiva al equipo (no al cliente). */
export const SUPERADMIN_ALERT_SENT_ACTION = 'SUPERADMIN_ALERT_SENT';

/** Mismo umbral que AdminService#COLLECTION_ENGINE_STALE_HOURS (ver admin.service.ts)
 * — duplicado a propósito para no crear una dependencia circular Jobs↔Admin. */
const COLLECTION_ENGINE_STALE_HOURS_FOR_ALERT = 26;

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
    private readonly customerRisk: CustomerRiskService,
    private readonly config: ConfigService<Env, true>,
    private readonly activity: ActivityLogService,
    private readonly redis: RedisService,
  ) {}

  private get enabled(): boolean {
    return this.config.get('JOBS_ENABLED', { infer: true }) === 'true';
  }

  // ── Histórico de latencia/uptime (panel SUPERADMIN → Salud) ─
  /**
   * Mide latencia real de DB y Redis cada 10 minutos y lo guarda en
   * ActivityLog (acción SYSTEM_HEALTH_SNAPSHOT, plataforma completa, sin
   * organizationId). Corre siempre, incluso si JOBS_ENABLED=false — es un
   * chequeo de infraestructura, no un recordatorio de negocio.
   */
  @Cron(CronExpression.EVERY_10_MINUTES, { name: 'system-health-snapshot' })
  async systemHealthSnapshot(): Promise<{
    dbOk: boolean;
    dbLatencyMs: number;
    redisOk: boolean;
    redisLatencyMs: number;
  }> {
    const dbStart = Date.now();
    const dbOk = await this.prisma.isHealthy();
    const dbLatencyMs = Date.now() - dbStart;

    const redisStart = Date.now();
    const redisOk = await this.redis.isHealthy();
    const redisLatencyMs = Date.now() - redisStart;

    const result = { dbOk, dbLatencyMs, redisOk, redisLatencyMs };
    await this.activity.record({
      action: SYSTEM_HEALTH_SNAPSHOT_ACTION,
      entityType: 'SystemHealth',
      metadata: result,
    });
    return result;
  }

  // ── Alertas proactivas al equipo (panel SUPERADMIN) ──────
  /**
   * Chequeo diario de eventos críticos de PLATAFORMA (no de un cliente en
   * particular) y aviso proactivo al equipo de Royáltica por correo y/o
   * WhatsApp — pedido explícito: "que nos avise solo si algo se traba",
   * en vez de tener que entrar al panel a revisar. Cubre:
   *   1) El motor de recordatorios de cobranza lleva trabado o la última
   *      corrida falló (ver AdminService#collectionEngineHealth).
   *   2) Clientes activos con 30+ días sin ningún login.
   *   3) Pico de costo operativo: últimas 24h > 2x el promedio diario de
   *      los 6 días previos.
   * Si SUPERADMIN_ALERT_EMAIL y SUPERADMIN_ALERT_WHATSAPP están vacíos, el
   * chequeo corre igual (queda en ActivityLog) pero no manda nada.
   */
  @Cron(CronExpression.EVERY_DAY_AT_9AM, { name: 'superadmin-critical-alerts' })
  async superadminCriticalAlerts(): Promise<{ sent: boolean; reasons: string[] }> {
    if (!this.enabled) return { sent: false, reasons: [] };

    const reasons: string[] = [];

    // 1) Motor de cobranza trabado/falló.
    const lastEngineRun = await this.prisma.activityLog.findFirst({
      where: { action: COLLECTION_ENGINE_JOB_RUN_ACTION },
      orderBy: { createdAt: 'desc' },
    });
    if (lastEngineRun) {
      const meta = (lastEngineRun.metadata ?? {}) as Record<string, unknown>;
      const hoursSince = (Date.now() - lastEngineRun.createdAt.getTime()) / 3_600_000;
      if (hoursSince > COLLECTION_ENGINE_STALE_HOURS_FOR_ALERT) {
        reasons.push(
          `El motor de recordatorios de cobranza lleva ${Math.round(hoursSince)}h sin correr exitosamente.`,
        );
      } else if (meta.success === false) {
        reasons.push('La última corrida del motor de recordatorios de cobranza falló.');
      }
    }

    // 2) Clientes activos con 30+ días sin ningún login (se excluyen los
    // dados de alta hace menos de 30 días: apenas están arrancando).
    const staleCutoff = new Date(Date.now() - 30 * 86_400_000);
    const candidateOrgs = await this.prisma.organization.findMany({
      where: { isActive: true, deletedAt: null, createdAt: { lt: staleCutoff } },
      select: { id: true, name: true },
    });
    if (candidateOrgs.length > 0) {
      const lastLogins = await this.prisma.user.groupBy({
        by: ['organizationId'],
        where: {
          organizationId: { in: candidateOrgs.map((o) => o.id) },
          lastLoginAt: { not: null },
        },
        _max: { lastLoginAt: true },
      });
      const lastLoginByOrg = new Map(
        lastLogins.map((l) => [l.organizationId, l._max.lastLoginAt as Date]),
      );
      const staleOrgs = candidateOrgs.filter((o) => {
        const last = lastLoginByOrg.get(o.id);
        return !last || last < staleCutoff;
      });
      if (staleOrgs.length > 0) {
        const names = staleOrgs.slice(0, 5).map((o) => o.name).join(', ');
        reasons.push(
          `${staleOrgs.length} cliente(s) activo(s) sin ningún login en 30+ días: ${names}${
            staleOrgs.length > 5 ? '…' : ''
          }.`,
        );
      }
    }

    // 3) Pico de costo operativo (últimas 24h vs. promedio diario previo).
    const since7d = new Date(Date.now() - 7 * 86_400_000);
    const since1d = new Date(Date.now() - 1 * 86_400_000);
    const [costPrev6d, costLast24h] = await Promise.all([
      this.prisma.usageEvent.aggregate({
        where: { createdAt: { gte: since7d, lt: since1d } },
        _sum: { estimatedCostMxn: true },
      }),
      this.prisma.usageEvent.aggregate({
        where: { createdAt: { gte: since1d } },
        _sum: { estimatedCostMxn: true },
      }),
    ]);
    const avgDailyCostPrev6d = Number(costPrev6d._sum.estimatedCostMxn ?? 0) / 6;
    const latestDailyCost = Number(costLast24h._sum.estimatedCostMxn ?? 0);
    if (avgDailyCostPrev6d > 0 && latestDailyCost > avgDailyCostPrev6d * 2) {
      reasons.push(
        `El costo operativo de las últimas 24h ($${latestDailyCost.toFixed(2)} MXN) ` +
          `es más del doble del promedio diario de los 6 días previos ($${avgDailyCostPrev6d.toFixed(2)} MXN).`,
      );
    }

    if (reasons.length === 0) return { sent: false, reasons: [] };

    const title = 'Alertas críticas del panel Superadmin';
    const body = reasons.map((r, i) => `${i + 1}. ${r}`).join('\n');
    const alertEmail = this.config.get('SUPERADMIN_ALERT_EMAIL', { infer: true });
    const alertWhatsapp = this.config.get('SUPERADMIN_ALERT_WHATSAPP', { infer: true });

    if (alertEmail) {
      await this.email.sendAlert(alertEmail, title, body).catch(() => undefined);
    }
    if (alertWhatsapp) {
      await this.whatsapp
        .sendMessage(alertWhatsapp, `Royáltica · ${title}\n${body}`)
        .catch(() => undefined);
    }

    await this.activity.record({
      action: SUPERADMIN_ALERT_SENT_ACTION,
      entityType: 'SuperadminAlert',
      metadata: { reasons, emailed: !!alertEmail, whatsapped: !!alertWhatsapp },
    });

    return { sent: true, reasons };
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
    const startedAt = Date.now();
    try {
      const result = await this.collectionSequences.runEngineScan();
      // Evento de plataforma (sin organizationId): el panel SUPERADMIN lo lee
      // para saber si el "agente de recordatorios" está vivo y al corriente,
      // o si se quedó trabado/falló — pedido explícito de Paolo.
      await this.activity.record({
        action: COLLECTION_ENGINE_JOB_RUN_ACTION,
        entityType: 'JobRun',
        metadata: { success: true, durationMs: Date.now() - startedAt, ...result },
      });
      return result;
    } catch (err) {
      this.logger.error(
        `collection-sequence-engine falló: ${err instanceof Error ? err.message : String(err)}`,
      );
      await this.activity.record({
        action: COLLECTION_ENGINE_JOB_RUN_ACTION,
        entityType: 'JobRun',
        metadata: {
          success: false,
          durationMs: Date.now() - startedAt,
          error: err instanceof Error ? err.message : String(err),
        },
      });
      throw err;
    }
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

      // Fase 3: diagnóstico de cartera (distribución de riesgo) para el
      // cuerpo del correo; el detalle completo (quién paga peor, sugerencias
      // de crédito) va en el PDF adjunto.
      const portfolio = await this.dashboard.getPortfolioRiskAnalysis(
        { organizationId: org.id } as AuthenticatedUser,
        range,
      );

      const title = 'Resumen de cobranza';
      const body =
        `Semana del ${weekLabel}: ` +
        `cobrado ${fmt(digest.collected.amount)} (${digest.collected.count} factura[s]); ` +
        `${digest.reminders.total} recordatorio[s] enviados ` +
        `(${digest.reminders.whatsapp} WhatsApp, ${digest.reminders.email} correo); ` +
        `pendiente por cobrar ${fmt(digest.outstanding.amount)} (${digest.outstanding.count} factura[s]). ` +
        `Cartera: ${portfolio.distribution.RIESGO} en riesgo, ` +
        `${portfolio.distribution.INCOBRABLE} incobrable(s) ` +
        `(${portfolio.avance.clientesQueEmpeoraronRiesgo} empeoraron esta semana).`;

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

  // ── Score de puntualidad + riesgo/incobrabilidad por cliente (FR-04/FR-05,
  // spec "Mejoras V1", y pedido de Paolo de clasificación de incobrabilidad) ──
  // Recalcula el score y el tier de riesgo de TODO cliente CxC con al menos
  // una factura, y alerta a los admins cuando: (a) el score cayó
  // significativamente (ver SCORE_DROP_ALERT_THRESHOLD), tal cual pide el
  // ejemplo de la especificación (93% -> 61%), o (b) el tier de riesgo
  // EMPEORÓ (ver CustomerRiskService — nunca alerta por una mejora). Ambas
  // clasificaciones se calculan juntas, en el mismo loop, para no recorrer
  // la cartera de clientes dos veces por día. Corre después del motor de
  // secuencias (11am) para que el guardrail de FR-05 (excluir a buenos
  // pagadores de pasos agresivos) ya haya usado el score del día anterior
  // esa mañana; el valor fresco de hoy se usará mañana.
  @Cron('30 11 * * *', { name: 'customer-score-recompute' })
  async customerScoreRecompute(): Promise<{
    recomputed: number;
    alerted: number;
  }> {
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
        select: { id: true, name: true, score: true, riskTier: true },
      });
      if (customers.length === 0) continue;

      const admins = await this.orgAdmins(org.id);
      for (const customer of customers) {
        const scoreResult = await this.customerScoring.recomputeOne(
          customer.id,
          customer.score,
        );
        recomputed += 1;
        if (scoreResult.droppedSignificantly) {
          await this.fanOut(
            org.id,
            admins,
            {
              type: 'CUSTOMER_SCORE_DROP',
              title: 'Riesgo alto: puntualidad en caída',
              body:
                `El score de puntualidad de ${customer.name} cayó de ` +
                `${scoreResult.previousScore}% a ${scoreResult.score}%. Se sugiere ` +
                'intervención humana inmediata.',
            },
            true, // crítico: también dispara WhatsApp a admins con opt-in
          );
          alerted += 1;
          // Un solo registro por evento (no uno por admin notificado): es lo
          // que Fase 3 (DashboardService.getPortfolioRiskAnalysis) cuenta
          // para el "avance" del análisis semanal de cartera.
          await this.activity.record({
            organizationId: org.id,
            action: 'CUSTOMER_SCORE_DROP',
            entityType: 'Customer',
            entityId: customer.id,
            metadata: {
              previousScore: scoreResult.previousScore,
              score: scoreResult.score,
            },
          });
        }

        const riskResult = await this.customerRisk.recomputeOne(
          customer.id,
          scoreResult.score,
          customer.riskTier,
        );
        if (riskResult.worsened) {
          const critical = riskResult.tier === 'INCOBRABLE';
          await this.fanOut(
            org.id,
            admins,
            {
              type: 'CUSTOMER_RISK_WORSENED',
              title:
                riskResult.tier === 'INCOBRABLE'
                  ? 'Cliente marcado como incobrable'
                  : `Cliente pasó a riesgo: ${riskResult.tier}`,
              body:
                `${customer.name} pasó a ${riskResult.tier} ` +
                `(${riskResult.reason}). Se sugiere revisar política de crédito.`,
            },
            critical,
          );
          alerted += 1;
          await this.activity.record({
            organizationId: org.id,
            action: 'CUSTOMER_RISK_WORSENED',
            entityType: 'Customer',
            entityId: customer.id,
            metadata: {
              previousTier: riskResult.previousTier,
              tier: riskResult.tier,
              maxDaysOverdue: riskResult.maxDaysOverdue,
            },
          });
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
