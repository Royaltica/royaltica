import { ConfigService } from '@nestjs/config';
import { DiagnosticHealthTier } from '@prisma/client';
import type { Env } from '../config/env.validation';
import { PreSaleDiagnosticService } from './pre-sale-diagnostic.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { SubmitDiagnosticDto } from './dto/submit-diagnostic.dto';

describe('PreSaleDiagnosticService', () => {
  let service: PreSaleDiagnosticService;
  let prisma: {
    preSaleDiagnostic: { create: jest.Mock; findUnique: jest.Mock };
    user: { findMany: jest.Mock };
  };
  let email: { send: jest.Mock };
  let notifications: { create: jest.Mock };
  let config: { get: jest.Mock };

  const baseDto: SubmitDiagnosticDto = {
    contactName: 'Jane Doe',
    contactEmail: 'jane@acme.com',
    company: 'Acme Inc',
    hasCollectionPolicy: true,
    collectionMethod: 'SOFTWARE',
    avgDaysToCollect: 10,
    overduePortfolioPct: 5,
    usesSoftware: true,
  } as SubmitDiagnosticDto;

  beforeEach(() => {
    prisma = {
      preSaleDiagnostic: {
        create: jest.fn().mockImplementation(({ data }) => ({ id: 'diag-1', createdAt: new Date(), ...data })),
        findUnique: jest.fn(),
      },
      user: { findMany: jest.fn().mockResolvedValue([{ id: 'admin-1' }]) },
    };
    email = { send: jest.fn().mockResolvedValue({ sent: true, id: 'email-1' }) };
    notifications = { create: jest.fn().mockResolvedValue(undefined) };
    config = {
      get: jest.fn((key: string) => (key === 'LEADS_EMAIL' ? 'hello@royaltica.com' : undefined)),
    };

    service = new PreSaleDiagnosticService(
      prisma as unknown as PrismaService,
      email as unknown as EmailService,
      notifications as unknown as NotificationsService,
      config as unknown as ConfigService<Env, true>,
    );
  });

  describe('analyze (regla determinista, sin IA)', () => {
    it('política + proceso con software + bajo atraso -> SALUDABLE, sin deducciones', () => {
      const r = service.analyze(baseDto);
      expect(r.score).toBe(100);
      expect(r.tier).toBe(DiagnosticHealthTier.SALUDABLE);
    });

    it('sin política de cobranza resta puntos y genera una recomendación específica', () => {
      const r = service.analyze({ ...baseDto, hasCollectionPolicy: false });
      expect(r.score).toBe(80);
      expect(r.recommendations[0]).toMatch(/política de cobranza/i);
    });

    it('sin ningún proceso (NINGUNO) resta más que un proceso manual', () => {
      const sinProceso = service.analyze({ ...baseDto, collectionMethod: 'NINGUNO' });
      const manual = service.analyze({ ...baseDto, collectionMethod: 'MANUAL_EXCEL' });
      expect(sinProceso.score).toBeLessThan(manual.score);
    });

    it('combinación de señales malas -> RIESGO_ALTO', () => {
      const r = service.analyze({
        ...baseDto,
        hasCollectionPolicy: false,
        collectionMethod: 'NINGUNO',
        avgDaysToCollect: 60,
        overduePortfolioPct: 40,
        usesSoftware: false,
      });
      expect(r.tier).toBe(DiagnosticHealthTier.RIESGO_ALTO);
      expect(r.score).toBeLessThan(50);
    });

    it('el score nunca baja de 0 ni sube de 100', () => {
      const r = service.analyze({
        ...baseDto,
        hasCollectionPolicy: false,
        collectionMethod: 'NINGUNO',
        avgDaysToCollect: 9999,
        overduePortfolioPct: 100,
        usesSoftware: false,
      });
      expect(r.score).toBeGreaterThanOrEqual(0);
    });

    it('máximo 3 recomendaciones aunque haya más señales', () => {
      const r = service.analyze({
        ...baseDto,
        hasCollectionPolicy: false,
        collectionMethod: 'NINGUNO',
        avgDaysToCollect: 60,
        overduePortfolioPct: 40,
        usesSoftware: false,
      });
      expect(r.recommendations.length).toBeLessThanOrEqual(3);
    });
  });

  describe('submit', () => {
    it('persiste el diagnóstico, avisa al equipo Y manda el primer análisis al prospecto', async () => {
      const result = await service.submit(baseDto);

      expect(result.id).toBe('diag-1');
      expect(result.tier).toBe(DiagnosticHealthTier.SALUDABLE);
      expect(prisma.preSaleDiagnostic.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            contactEmail: 'jane@acme.com',
            score: 100,
            tier: DiagnosticHealthTier.SALUDABLE,
          }),
        }),
      );
      expect(email.send).toHaveBeenCalledTimes(2); // interno + prospecto
      const recipients = email.send.mock.calls.map((c) => c[0].to);
      expect(recipients).toContain('hello@royaltica.com');
      expect(recipients).toContain('jane@acme.com');
      expect(notifications.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'PRE_SALE_DIAGNOSTIC_SUBMITTED' }),
      );
    });

    it('honeypot: con "website" lleno no persiste nada ni manda correos', async () => {
      const result = await service.submit({ ...baseDto, website: 'http://bot.example' });

      expect(result.id).toBeNull();
      expect(prisma.preSaleDiagnostic.create).not.toHaveBeenCalled();
      expect(email.send).not.toHaveBeenCalled();
      expect(notifications.create).not.toHaveBeenCalled();
    });

    it('un fallo al enviar el correo interno no tumba el flujo (el diagnóstico ya quedó guardado)', async () => {
      email.send.mockRejectedValueOnce(new Error('resend down'));
      await expect(service.submit(baseDto)).resolves.toMatchObject({ id: 'diag-1' });
    });
  });

  describe('findOne', () => {
    it('regresa el diagnóstico guardado sin exponer datos internos de más', async () => {
      prisma.preSaleDiagnostic.findUnique.mockResolvedValue({
        id: 'diag-1',
        contactName: 'Jane Doe',
        contactEmail: 'jane@acme.com',
        company: 'Acme Inc',
        score: 80,
        tier: DiagnosticHealthTier.OPORTUNIDADES,
        recommendations: ['Definir una política de cobranza formal.'],
        createdAt: new Date('2026-10-24'),
      });

      const res = await service.findOne('diag-1');
      expect(res).toEqual({
        id: 'diag-1',
        contactName: 'Jane Doe',
        company: 'Acme Inc',
        score: 80,
        tier: DiagnosticHealthTier.OPORTUNIDADES,
        recommendations: ['Definir una política de cobranza formal.'],
        createdAt: new Date('2026-10-24'),
      });
    });

    it('lanza NotFoundException si no existe', async () => {
      prisma.preSaleDiagnostic.findUnique.mockResolvedValue(null);
      await expect(service.findOne('nope')).rejects.toThrow('no encontrado');
    });
  });
});
