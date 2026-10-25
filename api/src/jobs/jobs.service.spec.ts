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
  let notifications: { create: jest.Mock };
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
    notifications = { create: jest.fn().mockResolvedValue(undefined) };
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
    );

    await expect(service.onboardingDataCompletion()).resolves.toEqual({
      checked: 0,
      completed: 0,
    });
    expect(organization.organizationsPendingOnboardingData).not.toHaveBeenCalled();
  });
});
