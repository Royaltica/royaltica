import { JobsService } from './jobs.service';
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
import { CustomerRiskService } from '../customers/scoring/customer-risk.service';
import { OrganizationService } from '../organization/organization.service';
import { ActivityLogService } from '../activity/activity-log.service';
import { RedisService } from '../common/redis/redis.service';
import type { PortfolioAnalysisService } from '../portfolio-analysis/portfolio-analysis.service';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.validation';

const makeActivity = () => ({ record: jest.fn().mockResolvedValue(undefined) }) as unknown as ActivityLogService;
const makeRedis = () => ({ isHealthy: jest.fn().mockResolvedValue(true) }) as unknown as RedisService;

describe('JobsService — weeklyCollectionDigest', () => {
  let service: JobsService;
  let prisma: {
    organization: { findMany: jest.Mock };
    user: { findMany: jest.Mock };
  };
  let dashboard: { getReceivablesDigest: jest.Mock; getPortfolioRiskAnalysis: jest.Mock };
  let reports: {
    wasReportSent: jest.Mock;
    generateCollectionReportPdf: jest.Mock;
    recordReportSent: jest.Mock;
  };
  let email: { sendAlert: jest.Mock };
  let whatsapp: { notifyOrgAdmins: jest.Mock };

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-03T08:00:00.000Z'));
    prisma = {
      organization: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'org-1', locale: 'en-CA', currency: 'CAD' },
        ]),
      },
      user: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: 'u-1', email: 'admin@example.com' }]),
      },
    };
    dashboard = {
      getReceivablesDigest: jest.fn().mockResolvedValue({
        collected: { amount: 1200, count: 2 },
        reminders: { total: 3, whatsapp: 1, email: 2 },
        outstanding: { amount: 5000, count: 4 },
      }),
      getPortfolioRiskAnalysis: jest.fn().mockResolvedValue({
        totalCustomers: 10,
        distribution: { SANO: 7, ATENCION: 1, RIESGO: 1, INCOBRABLE: 1, SIN_CLASIFICAR: 0 },
        bestPayers: [],
        worstPayers: [],
        recommendations: [],
        avance: { clientesQueEmpeoraronRiesgo: 1, caidasDePuntualidad: 0 },
        generatedAt: new Date().toISOString(),
      }),
    };
    reports = {
      wasReportSent: jest.fn().mockResolvedValue(false),
      generateCollectionReportPdf: jest.fn().mockResolvedValue(Buffer.from('%PDF-')),
      recordReportSent: jest.fn().mockResolvedValue(undefined),
    };
    email = { sendAlert: jest.fn().mockResolvedValue({ sent: true, id: 'email-1' }) };
    whatsapp = { notifyOrgAdmins: jest.fn().mockResolvedValue({ sent: true }) };

    service = new JobsService(
      prisma as unknown as PrismaService,
      {} as SettingsService,
      {} as NotificationsService,
      email as unknown as EmailService,
      whatsapp as unknown as WhatsappService,
      {} as UsageService,
      {} as ReceivablesService,
      dashboard as unknown as DashboardService,
      reports as unknown as ReportsService,
      { runEngineScan: jest.fn() } as unknown as CollectionSequencesService,
      {} as CustomerScoringService,
      {} as CustomerRiskService,
      {} as OrganizationService,
      { get: jest.fn().mockReturnValue('true') } as unknown as ConfigService<Env, true>,
      makeActivity(),
      makeRedis(),
      {} as PortfolioAnalysisService,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('genera PDF, lo adjunta y registra el envío con periodo semanal normalizado', async () => {
    await expect(service.weeklyCollectionDigest()).resolves.toEqual({ sent: 1 });

    const expectedRange = {
      from: new Date('2026-07-27T00:00:00.000Z'),
      to: new Date('2026-08-03T00:00:00.000Z'),
    };
    expect(reports.wasReportSent).toHaveBeenCalledWith('org-1', expectedRange);
    expect(dashboard.getReceivablesDigest).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 'org-1' }),
      {
        from: expectedRange.from.toISOString(),
        to: expectedRange.to.toISOString(),
      },
    );
    expect(email.sendAlert).toHaveBeenCalledWith(
      'admin@example.com',
      'Resumen de cobranza',
      expect.any(String),
      'org-1',
      [
        {
          filename: 'reporte-cobranza.pdf',
          contentType: 'application/pdf',
          content: Buffer.from('%PDF-'),
        },
      ],
    );
    expect(reports.recordReportSent).toHaveBeenCalledWith(
      'org-1',
      expectedRange,
      1,
      true,
    );
  });

  it('no genera ni envía si no hay destinatarios autorizados', async () => {
    prisma.user.findMany.mockResolvedValue([]);

    await expect(service.weeklyCollectionDigest()).resolves.toEqual({ sent: 0 });

    expect(reports.wasReportSent).not.toHaveBeenCalled();
    expect(dashboard.getReceivablesDigest).not.toHaveBeenCalled();
    expect(reports.generateCollectionReportPdf).not.toHaveBeenCalled();
    expect(email.sendAlert).not.toHaveBeenCalled();
  });

  it('es idempotente: si el periodo ya fue enviado no duplica emails', async () => {
    reports.wasReportSent.mockResolvedValue(true);

    await expect(service.weeklyCollectionDigest()).resolves.toEqual({ sent: 0 });

    expect(dashboard.getReceivablesDigest).not.toHaveBeenCalled();
    expect(reports.generateCollectionReportPdf).not.toHaveBeenCalled();
    expect(email.sendAlert).not.toHaveBeenCalled();
    expect(reports.recordReportSent).not.toHaveBeenCalled();
  });

  it('si falla el PDF envía el resumen sin adjunto y registra el fallo de email', async () => {
    reports.generateCollectionReportPdf.mockRejectedValue(new Error('pdf down'));
    email.sendAlert.mockResolvedValue({ sent: false });

    await expect(service.weeklyCollectionDigest()).resolves.toEqual({ sent: 1 });

    expect(email.sendAlert).toHaveBeenCalledWith(
      'admin@example.com',
      'Resumen de cobranza',
      expect.any(String),
      'org-1',
      undefined,
    );
    expect(reports.recordReportSent).toHaveBeenCalledWith(
      'org-1',
      expect.any(Object),
      1,
      false,
    );
  });
});

describe('JobsService — whatsappNotificationsDigest (ROY-25)', () => {
  let service: JobsService;
  let prisma: { user: { findMany: jest.Mock } };
  let notifications: { summarySince: jest.Mock };
  let whatsapp: { sendMessage: jest.Mock };
  let usage: { record: jest.Mock };

  beforeEach(() => {
    prisma = {
      user: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'u-1',
            whatsappPhone: '+5215512345678',
            organizationId: 'org-1',
          },
        ]),
      },
    };
    notifications = {
      summarySince: jest.fn().mockResolvedValue({
        total: 3,
        byType: [
          { type: 'INVOICE_OVERDUE', count: 2 },
          { type: 'REP_PENDING', count: 1 },
        ],
      }),
    };
    whatsapp = { sendMessage: jest.fn().mockResolvedValue({ sent: true, mode: 'meta' }) };
    usage = { record: jest.fn().mockResolvedValue(undefined) };

    service = new JobsService(
      prisma as unknown as PrismaService,
      {} as SettingsService,
      notifications as unknown as NotificationsService,
      {} as EmailService,
      whatsapp as unknown as WhatsappService,
      usage as unknown as UsageService,
      {} as ReceivablesService,
      {} as DashboardService,
      {} as ReportsService,
      {} as CollectionSequencesService,
      {} as CustomerScoringService,
      {} as CustomerRiskService,
      {} as OrganizationService,
      { get: jest.fn().mockReturnValue('true') } as unknown as ConfigService<Env, true>,
      makeActivity(),
      makeRedis(),
      {} as PortfolioAnalysisService,
    );
  });

  it('solo consulta usuarios con whatsappOptIn y teléfono registrado', async () => {
    await service.whatsappNotificationsDigest();

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          whatsappOptIn: true,
          whatsappPhone: { not: null },
        }),
      }),
    );
  });

  it('manda UN resumen por WhatsApp con el total y los tipos más frecuentes', async () => {
    const result = await service.whatsappNotificationsDigest();

    expect(whatsapp.sendMessage).toHaveBeenCalledTimes(1);
    expect(whatsapp.sendMessage).toHaveBeenCalledWith(
      '+5215512345678',
      expect.stringContaining('3 notificación(es)'),
    );
    expect(result).toEqual({ sent: 1, skipped: 0 });
  });

  it('si no hubo notificaciones nuevas en 24h, NO manda WhatsApp (nada de spam)', async () => {
    notifications.summarySince.mockResolvedValue({ total: 0, byType: [] });

    const result = await service.whatsappNotificationsDigest();

    expect(whatsapp.sendMessage).not.toHaveBeenCalled();
    expect(result).toEqual({ sent: 0, skipped: 1 });
  });

  it('respeta el kill-switch JOBS_ENABLED', async () => {
    service = new JobsService(
      prisma as unknown as PrismaService,
      {} as SettingsService,
      notifications as unknown as NotificationsService,
      {} as EmailService,
      whatsapp as unknown as WhatsappService,
      usage as unknown as UsageService,
      {} as ReceivablesService,
      {} as DashboardService,
      {} as ReportsService,
      {} as CollectionSequencesService,
      {} as CustomerScoringService,
      {} as CustomerRiskService,
      {} as OrganizationService,
      { get: jest.fn().mockReturnValue('false') } as unknown as ConfigService<Env, true>,
      makeActivity(),
      makeRedis(),
      {} as PortfolioAnalysisService,
    );

    await expect(service.whatsappNotificationsDigest()).resolves.toEqual({
      sent: 0,
      skipped: 0,
    });
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });
});

describe('JobsService — onboardingDataCompletion (Fase 5)', () => {
  let service: JobsService;
  let prisma: { user: { findMany: jest.Mock } };
  let notifications: { create: jest.Mock; createMany: jest.Mock };
  let organization: {
    organizationsPendingOnboardingData: jest.Mock;
    checkOnboardingDataCompletion: jest.Mock;
  };
  let email: { sendAlert: jest.Mock };
  let whatsapp: { notifyOrgAdmins: jest.Mock };
  let usage: { record: jest.Mock };

  beforeEach(() => {
    prisma = {
      user: { findMany: jest.fn().mockResolvedValue([{ id: 'admin-1', email: 'admin@acme.com' }]) },
    };
    notifications = {
      create: jest.fn().mockResolvedValue(undefined),
      createMany: jest.fn().mockResolvedValue(undefined),
    };
    organization = {
      organizationsPendingOnboardingData: jest
        .fn()
        .mockResolvedValue([{ id: 'org-1', name: 'Acme Inc' }]),
      checkOnboardingDataCompletion: jest.fn().mockResolvedValue({ justCompleted: false }),
    };
    email = { sendAlert: jest.fn().mockResolvedValue({ sent: true, id: 'email-1' }) };
    whatsapp = { notifyOrgAdmins: jest.fn().mockResolvedValue({ sent: true }) };
    usage = { record: jest.fn().mockResolvedValue(undefined) };

    service = new JobsService(
      prisma as unknown as PrismaService,
      {} as SettingsService,
      notifications as unknown as NotificationsService,
      email as unknown as EmailService,
      whatsapp as unknown as WhatsappService,
      usage as unknown as UsageService,
      {} as ReceivablesService,
      {} as DashboardService,
      {} as ReportsService,
      {} as CollectionSequencesService,
      {} as CustomerScoringService,
      {} as CustomerRiskService,
      organization as unknown as OrganizationService,
      { get: jest.fn().mockReturnValue('true') } as unknown as ConfigService<Env, true>,
      makeActivity(),
      makeRedis(),
      {} as PortfolioAnalysisService,
    );
  });

  it('evalúa solo las organizaciones pendientes y no avisa si ninguna terminó', async () => {
    const result = await service.onboardingDataCompletion();

    expect(organization.organizationsPendingOnboardingData).toHaveBeenCalledTimes(1);
    expect(organization.checkOnboardingDataCompletion).toHaveBeenCalledWith('org-1');
    expect(result).toEqual({ checked: 1, completed: 0 });
    expect(email.sendAlert).not.toHaveBeenCalled();
    expect(notifications.create).not.toHaveBeenCalled();
  });

  it('cuando una organización completa su carga, avisa a sus admins Y a los superadmins (una sola vez)', async () => {
    organization.checkOnboardingDataCompletion.mockResolvedValue({ justCompleted: true });
    prisma.user.findMany
      .mockResolvedValueOnce([{ id: 'admin-1', email: 'admin@acme.com' }]) // orgAdmins
      .mockResolvedValueOnce([{ id: 'super-1' }]); // superadmins

    const result = await service.onboardingDataCompletion();

    expect(result).toEqual({ checked: 1, completed: 1 });
    expect(email.sendAlert).toHaveBeenCalledWith(
      'admin@acme.com',
      expect.stringContaining('lista'),
      expect.any(String),
      'org-1',
    );
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'super-1',
        type: 'ONBOARDING_DATA_COMPLETE',
        metadata: { organizationId: 'org-1' },
      }),
    );
  });

  it('respeta el kill-switch JOBS_ENABLED', async () => {
    service = new JobsService(
      prisma as unknown as PrismaService,
      {} as SettingsService,
      notifications as unknown as NotificationsService,
      email as unknown as EmailService,
      whatsapp as unknown as WhatsappService,
      {} as UsageService,
      {} as ReceivablesService,
      {} as DashboardService,
      {} as ReportsService,
      {} as CollectionSequencesService,
      {} as CustomerScoringService,
      {} as CustomerRiskService,
      organization as unknown as OrganizationService,
      { get: jest.fn().mockReturnValue('false') } as unknown as ConfigService<Env, true>,
      makeActivity(),
      makeRedis(),
      {} as PortfolioAnalysisService,
    );

    await expect(service.onboardingDataCompletion()).resolves.toEqual({
      checked: 0,
      completed: 0,
    });
    expect(organization.organizationsPendingOnboardingData).not.toHaveBeenCalled();
  });
});

describe('JobsService — zona horaria de los crons que escriben a deudores', () => {
  it.each(['receivableReminders', 'customerServiceMessage', 'collectionSequenceEngine'])(
    '%s corre en hora de la Ciudad de México',
    (method) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fn = (JobsService.prototype as any)[method];
      const options = Reflect.getMetadata('SCHEDULE_CRON_OPTIONS', fn);
      expect(options).toMatchObject({ timeZone: 'America/Mexico_City' });
    },
  );
});

describe('JobsService — recordatorio antiguo de un paso (apagado por defecto)', () => {
  const build = (legacy: 'true' | 'false') => {
    const receivables = { runReminderScan: jest.fn().mockResolvedValue({ sent: 1 }) };
    const config = {
      get: jest.fn((key: string) =>
        key === 'LEGACY_RECEIVABLE_REMINDER_ENABLED' ? legacy : 'true',
      ),
    };
    const service = new JobsService(
      {} as PrismaService,
      {} as SettingsService,
      {} as NotificationsService,
      {} as EmailService,
      {} as WhatsappService,
      {} as UsageService,
      receivables as unknown as ReceivablesService,
      {} as DashboardService,
      {} as ReportsService,
      {} as CollectionSequencesService,
      {} as CustomerScoringService,
      {} as CustomerRiskService,
      {} as OrganizationService,
      config as unknown as ConfigService<Env, true>,
      makeActivity(),
      makeRedis(),
      {} as PortfolioAnalysisService,
    );
    return { service, receivables };
  };

  it('no envía nada si LEGACY_RECEIVABLE_REMINDER_ENABLED no es "true"', async () => {
    const { service, receivables } = build('false');
    await expect(service.receivableReminders()).resolves.toEqual({ sent: 0 });
    expect(receivables.runReminderScan).not.toHaveBeenCalled();
  });

  it('se puede volver a encender con la variable', async () => {
    const { service, receivables } = build('true');
    await expect(service.receivableReminders()).resolves.toEqual({ sent: 2 });
    expect(receivables.runReminderScan).toHaveBeenCalledTimes(2);
  });
});

describe('JobsService — alertas por cambio de segmento (C3)', () => {
  const DAY = 86_400_000;
  const build = (segmentCustomers: unknown[], withOrgFails = false) => {
    const tx = {
      customer: { findMany: jest.fn().mockResolvedValue(segmentCustomers) },
      activityLog: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const prisma = {
      organization: { findMany: jest.fn().mockResolvedValue([{ id: 'org-1' }]) },
      customer: { findMany: jest.fn().mockResolvedValue([{ id: 'c1', name: 'Uno', score: 80, riskTier: 'SANO' }]) },
      user: { findMany: jest.fn().mockResolvedValue([{ id: 'u1', email: 'admin@example.com' }]) },
      withOrg: jest.fn((_org: string, fn: (t: unknown) => unknown) =>
        withOrgFails ? Promise.reject(new Error('db down')) : fn(tx),
      ),
    };
    const notifications = { createMany: jest.fn().mockResolvedValue(undefined) };
    const email = { sendAlert: jest.fn().mockResolvedValue({ sent: true }) };
    const activity = makeActivity();
    const service = new JobsService(
      prisma as unknown as PrismaService,
      {} as SettingsService,
      notifications as unknown as NotificationsService,
      email as unknown as EmailService,
      { notifyOrgAdmins: jest.fn() } as unknown as WhatsappService,
      { record: jest.fn() } as unknown as UsageService,
      {} as ReceivablesService,
      {} as DashboardService,
      {} as ReportsService,
      {} as CollectionSequencesService,
      { recomputeOne: jest.fn().mockResolvedValue({ score: 80, previousScore: 80, droppedSignificantly: false }) } as unknown as CustomerScoringService,
      { recomputeOne: jest.fn().mockResolvedValue({ worsened: false }) } as unknown as CustomerRiskService,
      {} as OrganizationService,
      { get: jest.fn().mockReturnValue('true') } as unknown as ConfigService<Env, true>,
      activity,
      makeRedis(),
      {} as PortfolioAnalysisService,
    );
    return { service, notifications, activity };
  };

  const paidInvoices = (lates: number[], lastPaidHoursAgo: number) =>
    lates.map((late, i) => {
      const paidDate = new Date(Date.now() - (i === lates.length - 1 ? lastPaidHoursAgo * 3_600_000 : (lates.length - i) * 30 * DAY));
      return { id: `i${i}`, status: 'PAID', total: 100, amountPaid: 100, paidDate, dueDate: new Date(paidDate.getTime() - late * DAY) };
    });

  it('avisa a los administradores cuando un cliente entra hoy a "En deterioro"', async () => {
    const { service, notifications, activity } = build([
      { id: 'c1', name: 'Uno', category: null, riskTier: 'SANO', score: 80, invoices: paidInvoices([0, 0, 0, 0, 0, 0, 0, 10, 15], 2) },
    ]);
    const result = await service.customerScoreRecompute();
    expect(result.alerted).toBe(1);
    expect(notifications.createMany).toHaveBeenCalledWith(
      ['u1'],
      expect.objectContaining({ type: 'CUSTOMER_SEGMENT_WORSENED', title: 'Uno pasó a En deterioro' }),
    );
    expect(activity.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'CUSTOMER_SEGMENT_WORSENED', entityId: 'c1', metadata: { segment: 'deterioro', previous: 'olvidadizo' } }),
    );
  });

  it('no avisa si el pago que lo cambió es de días anteriores', async () => {
    const { service, notifications } = build([
      { id: 'c1', name: 'Uno', category: null, riskTier: 'SANO', score: 80, invoices: paidInvoices([0, 0, 0, 0, 0, 0, 0, 10, 15], 48) },
    ]);
    await expect(service.customerScoreRecompute()).resolves.toMatchObject({ alerted: 0 });
    expect(notifications.createMany).not.toHaveBeenCalled();
  });

  it('si falla la consulta de segmentos, el recálculo de score sigue', async () => {
    const { service } = build([], true);
    await expect(service.customerScoreRecompute()).resolves.toEqual({ recomputed: 1, alerted: 0 });
  });
});
