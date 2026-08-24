import { BadRequestException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.validation';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

/**
 * Cubre el endpoint POST /notifications/whatsapp/test (probar Twilio/Meta
 * sin esperar el digest diario de las 18:00 — pedido por José para validar
 * el sandbox de Twilio el mismo día que se conecta), incluido el fan-out a
 * WHATSAPP_TEST_CC (stakeholders externos como Paolo, sin cuenta real).
 */
describe('NotificationsService — sendWhatsappTest', () => {
  let service: NotificationsService;
  let prisma: { user: { findUnique: jest.Mock } };
  let whatsapp: { sendMessage: jest.Mock };
  let config: { get: jest.Mock };
  const user = { id: 'u-1' } as AuthenticatedUser;

  const build = () => {
    service = new NotificationsService(
      prisma as unknown as PrismaService,
      whatsapp as unknown as WhatsappService,
      config as unknown as ConfigService<Env, true>,
    );
  };

  beforeEach(() => {
    prisma = { user: { findUnique: jest.fn() } };
    whatsapp = { sendMessage: jest.fn() };
    config = { get: jest.fn().mockReturnValue('') };
    build();
  });

  it('manda el mensaje de prueba al teléfono YA registrado del usuario (opt-in activo)', async () => {
    prisma.user.findUnique.mockResolvedValue({
      whatsappPhone: '+525534677463',
      whatsappOptIn: true,
    });
    whatsapp.sendMessage.mockResolvedValue({ sent: true, mode: 'twilio', id: 'SM123' });

    const result = await service.sendWhatsappTest(user);

    expect(whatsapp.sendMessage).toHaveBeenCalledWith(
      '+525534677463',
      expect.stringContaining('mensaje de prueba'),
    );
    expect(result).toEqual({ sent: true, mode: 'twilio', id: 'SM123', ccSent: 0, ccTotal: 0 });
  });

  it('rechaza si el usuario no tiene el opt-in activo o no registró teléfono', async () => {
    prisma.user.findUnique.mockResolvedValue({ whatsappPhone: null, whatsappOptIn: false });

    await expect(service.sendWhatsappTest(user)).rejects.toThrow(BadRequestException);
    expect(whatsapp.sendMessage).not.toHaveBeenCalled();
  });

  it('si WhatsApp sigue en modo stub (sin credenciales), avisa con un mensaje claro', async () => {
    prisma.user.findUnique.mockResolvedValue({
      whatsappPhone: '+525534677463',
      whatsappOptIn: true,
    });
    whatsapp.sendMessage.mockResolvedValue({ sent: false, mode: 'stub' });

    await expect(service.sendWhatsappTest(user)).rejects.toThrow(
      'WhatsApp no está configurado todavía en el servidor',
    );
  });

  it('también manda una copia a los números de WHATSAPP_TEST_CC (ej. Paolo, sin cuenta real)', async () => {
    prisma.user.findUnique.mockResolvedValue({
      whatsappPhone: '+525534677463',
      whatsappOptIn: true,
    });
    config.get.mockReturnValue('+525574086204, +525500000000');
    whatsapp.sendMessage.mockResolvedValue({ sent: true, mode: 'twilio', id: 'SM1' });

    const result = await service.sendWhatsappTest(user);

    expect(whatsapp.sendMessage).toHaveBeenCalledTimes(3);
    expect(whatsapp.sendMessage).toHaveBeenCalledWith('+525574086204', expect.any(String));
    expect(whatsapp.sendMessage).toHaveBeenCalledWith('+525500000000', expect.any(String));
    expect(result).toEqual(
      expect.objectContaining({ sent: true, ccSent: 2, ccTotal: 2 }),
    );
  });

  it('si un número de WHATSAPP_TEST_CC falla, no rompe el resultado principal', async () => {
    prisma.user.findUnique.mockResolvedValue({
      whatsappPhone: '+525534677463',
      whatsappOptIn: true,
    });
    config.get.mockReturnValue('+525574086204');
    whatsapp.sendMessage
      .mockResolvedValueOnce({ sent: true, mode: 'twilio', id: 'SM1' }) // usuario
      .mockResolvedValueOnce({ sent: false, mode: 'twilio' }); // CC falla

    const result = await service.sendWhatsappTest(user);

    expect(result).toEqual(expect.objectContaining({ sent: true, ccSent: 0, ccTotal: 1 }));
  });
});
