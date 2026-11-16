import { OrganizationService } from './organization.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { ActivityLogService } from '../activity/activity-log.service';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.validation';

describe('OrganizationService — onboarding de datos (Fase 5)', () => {
  let service: OrganizationService;
  let prisma: {
    organization: { findMany: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
    customer: { count: jest.Mock };
    invoice: { count: jest.Mock };
  };

  beforeEach(() => {
    prisma = {
      organization: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      customer: { count: jest.fn() },
      invoice: { count: jest.fn() },
    };
    service = new OrganizationService(
      prisma as unknown as PrismaService,
      {} as SettingsService,
      {} as ActivityLogService,
      { get: jest.fn() } as unknown as ConfigService<Env, true>,
    );
  });

  describe('organizationsPendingOnboardingData', () => {
    it('solo trae organizaciones activas sin onboarding marcado', async () => {
      prisma.organization.findMany.mockResolvedValue([{ id: 'org-1', name: 'Acme' }]);
      const res = await service.organizationsPendingOnboardingData();
      expect(res).toEqual([{ id: 'org-1', name: 'Acme' }]);
      expect(prisma.organization.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true, deletedAt: null, onboardingDataCompletedAt: null },
        }),
      );
    });
  });

  describe('checkOnboardingDataCompletion', () => {
    it('marca completado cuando ya hay clientes Y facturas', async () => {
      prisma.organization.findUnique.mockResolvedValue({ onboardingDataCompletedAt: null });
      prisma.customer.count.mockResolvedValue(3);
      prisma.invoice.count.mockResolvedValue(5);

      const res = await service.checkOnboardingDataCompletion('org-1');

      expect(res).toEqual({ justCompleted: true });
      expect(prisma.organization.update).toHaveBeenCalledWith({
        where: { id: 'org-1' },
        data: { onboardingDataCompletedAt: expect.any(Date) },
      });
    });

    it('NO marca completado si falta clientes o facturas', async () => {
      prisma.organization.findUnique.mockResolvedValue({ onboardingDataCompletedAt: null });
      prisma.customer.count.mockResolvedValue(0);
      prisma.invoice.count.mockResolvedValue(5);

      const res = await service.checkOnboardingDataCompletion('org-1');

      expect(res).toEqual({ justCompleted: false });
      expect(prisma.organization.update).not.toHaveBeenCalled();
    });

    it('es idempotente: si ya estaba marcada, no vuelve a consultar conteos ni a avisar', async () => {
      prisma.organization.findUnique.mockResolvedValue({
        onboardingDataCompletedAt: new Date('2026-01-01'),
      });

      const res = await service.checkOnboardingDataCompletion('org-1');

      expect(res).toEqual({ justCompleted: false });
      expect(prisma.customer.count).not.toHaveBeenCalled();
      expect(prisma.organization.update).not.toHaveBeenCalled();
    });

    it('organización inexistente: no revienta, regresa justCompleted=false', async () => {
      prisma.organization.findUnique.mockResolvedValue(null);
      const res = await service.checkOnboardingDataCompletion('nope');
      expect(res).toEqual({ justCompleted: false });
    });
  });
});

describe("OrganizationService — interruptor de emergencia de cobranza", () => {
  const user = { id: "u-1", organizationId: "org-1" } as never;
  let prisma: { organization: { update: jest.Mock; findUniqueOrThrow: jest.Mock } };
  let activity: { record: jest.Mock };
  let service: OrganizationService;

  beforeEach(() => {
    prisma = {
      organization: {
        update: jest.fn().mockResolvedValue({}),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          collectionPausedAt: new Date("2026-11-16T10:00:00Z"),
          collectionPausedReason: "pago masivo en revisión",
          collectionPausedByUserId: "u-1",
        }),
      },
    };
    activity = { record: jest.fn().mockResolvedValue(undefined) };
    service = new OrganizationService(
      prisma as unknown as PrismaService,
      {} as SettingsService,
      activity as unknown as ActivityLogService,
      { get: jest.fn() } as unknown as ConfigService<Env, true>,
    );
  });

  it("pausar guarda fecha, motivo y quién, y lo deja en la bitácora", async () => {
    const res = await service.pauseCollection(user, "  pago masivo en revisión ");
    expect(prisma.organization.update).toHaveBeenCalledWith({
      where: { id: "org-1" },
      data: {
        collectionPausedAt: expect.any(Date),
        collectionPausedReason: "pago masivo en revisión",
        collectionPausedByUserId: "u-1",
      },
    });
    expect(activity.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "COLLECTION_PAUSED", organizationId: "org-1" }),
    );
    expect(res.paused).toBe(true);
  });

  it("reanudar limpia el interruptor y lo deja en la bitácora", async () => {
    prisma.organization.findUniqueOrThrow.mockResolvedValue({
      collectionPausedAt: null,
      collectionPausedReason: null,
      collectionPausedByUserId: null,
    });
    const res = await service.resumeCollection(user);
    expect(prisma.organization.update).toHaveBeenCalledWith({
      where: { id: "org-1" },
      data: { collectionPausedAt: null, collectionPausedReason: null, collectionPausedByUserId: null },
    });
    expect(activity.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "COLLECTION_RESUMED" }),
    );
    expect(res.paused).toBe(false);
  });
});
