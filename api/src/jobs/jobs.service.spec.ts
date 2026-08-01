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
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.validation';

describe('JobsService — weeklyCollectionDigest', () => {
  let service: JobsService;
  let prisma: {
    organization: { findMany: jest.Mock };
    user: { findMany: jest.Mock };
  };
  let dashboard: { getReceivablesDigest: jest.Mock };
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
      { get: jest.fn().mockReturnValue('true') } as unknown as ConfigService<Env, true>,
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
