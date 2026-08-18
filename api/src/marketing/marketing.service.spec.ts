import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.validation';
import { MarketingService } from './marketing.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { NotificationsService } from '../notifications/notifications.service';

/**
 * Prueba del flujo real que pidió José: "si un externo se quiere registrar
 * (pide una demo / contacta), que le llegue correo a él Y a nosotros".
 * Cubre /marketing/demo y /marketing/contact — los dos puntos de entrada
 * públicos de royaltica.com para un prospecto externo.
 */
describe('MarketingService — registro externo (demo/contacto)', () => {
  let service: MarketingService;
  let prisma: {
    lead: { create: jest.Mock };
    user: { findMany: jest.Mock };
  };
  let email: { send: jest.Mock };
  let notifications: { create: jest.Mock };
  let config: { get: jest.Mock };

  beforeEach(() => {
    prisma = {
      lead: { create: jest.fn().mockResolvedValue({ id: 'lead-1' }) },
      user: { findMany: jest.fn().mockResolvedValue([{ id: 'admin-1' }]) },
    };
    email = { send: jest.fn().mockResolvedValue({ sent: true, id: 'email-1' }) };
    notifications = { create: jest.fn().mockResolvedValue(undefined) };
    config = {
      get: jest.fn((key: string) => {
        if (key === 'LEADS_EMAIL') return 'hello@royaltica.com';
        return undefined;
      }),
    };

    service = new MarketingService(
      prisma as unknown as PrismaService,
      email as unknown as EmailService,
      notifications as unknown as NotificationsService,
      config as unknown as ConfigService<Env, true>,
    );
  });

  describe('scheduleDemo (POST /marketing/demo)', () => {
    const dto = {
      name: 'Jane Doe',
      company: 'Acme Inc',
      email: 'jane@acme.com',
      phone: '+14165551234',
      jobTitle: 'CFO',
      companySize: 50,
      message: 'Nos interesa la parte de cobranza CxC.',
    };

    it('persiste el lead, avisa al equipo (LEADS_EMAIL) Y confirma al prospecto externo', async () => {
      const result = await service.scheduleDemo(dto as never);

      expect(result).toEqual({ ok: true });
      expect(prisma.lead.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: 'DEMO', email: 'jane@acme.com' }),
        }),
      );

      // Correo interno al equipo — el destinatario es LEADS_EMAIL.
      expect(email.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'hello@royaltica.com',
          subject: expect.stringContaining('Acme Inc'),
        }),
      );
      // Confirmación al prospecto externo — el destinatario es SU correo.
      expect(email.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'jane@acme.com',
          subject: expect.stringContaining('Recibimos tu solicitud'),
        }),
      );
      expect(email.send).toHaveBeenCalledTimes(2);
    });

    it('además notifica in-app a los SUPERADMIN activos (canal redundante al correo)', async () => {
      await service.scheduleDemo(dto as never);

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { role: 'SUPERADMIN', isActive: true } }),
      );
      expect(notifications.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'admin-1', type: 'ACCESS_REQUEST' }),
      );
    });

    it('el honeypot bloquea a los bots SIN persistir el lead ni enviar correos', async () => {
      const result = await service.scheduleDemo({
        ...dto,
        website: 'http://spam.example.com',
      } as never);

      // Responde 200 falso — no le da señal al bot de que fue detectado.
      expect(result).toEqual({ ok: true });
      expect(prisma.lead.create).not.toHaveBeenCalled();
      expect(email.send).not.toHaveBeenCalled();
      expect(notifications.create).not.toHaveBeenCalled();
    });

    it('si falla el correo de confirmación externo, el registro NO se rompe (responde 200 igual)', async () => {
      email.send
        .mockResolvedValueOnce({ sent: true, id: 'internal-1' }) // interno OK
        .mockRejectedValueOnce(new Error('Resend caído')); // confirmación externa falla

      await expect(service.scheduleDemo(dto as never)).resolves.toEqual({ ok: true });
      // El lead ya quedó persistido de todos modos.
      expect(prisma.lead.create).toHaveBeenCalled();
    });

    it('si falla el correo interno al equipo, igual se intenta la confirmación externa', async () => {
      email.send
        .mockRejectedValueOnce(new Error('Resend caído')) // interno falla
        .mockResolvedValueOnce({ sent: true, id: 'ext-1' }); // externo OK

      await expect(service.scheduleDemo(dto as never)).resolves.toEqual({ ok: true });
      expect(email.send).toHaveBeenCalledTimes(2);
    });
  });

  describe('contact (POST /marketing/contact)', () => {
    const dto = {
      name: 'John Smith',
      email: 'john@example.com',
      subject: 'Pregunta sobre precios',
      message: '¿Tienen plan para empresas pequeñas?',
    };

    it('persiste el lead tipo CONTACT y avisa al equipo con Reply-To al prospecto', async () => {
      const result = await service.contact(dto as never);

      expect(result).toEqual({ ok: true });
      expect(prisma.lead.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ type: 'CONTACT' }) }),
      );
      expect(email.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'hello@royaltica.com',
          replyTo: 'john@example.com',
        }),
      );
    });

    it('el honeypot bloquea a los bots también en el formulario de contacto', async () => {
      const result = await service.contact({
        ...dto,
        website: 'http://bot.example.com',
      } as never);

      expect(result).toEqual({ ok: true });
      expect(prisma.lead.create).not.toHaveBeenCalled();
      expect(email.send).not.toHaveBeenCalled();
    });
  });
});
