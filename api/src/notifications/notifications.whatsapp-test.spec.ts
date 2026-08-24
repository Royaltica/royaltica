import { BadRequestException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

/**
 * Cubre el endpoint POST /notifications/whatsapp/test (probar Twilio/Meta
 * sin esperar el digest diario de las 18:00 — pedido por José para validar
 * el sandbox de Twilio el mismo día que se conecta).
 */
describe('NotificationsService — sendWhatsappTest', () => {
  let service: NotificationsService;
  let prisma: { user: { findUnique: jest.Mock } };
  let whatsapp: { sendMessage: jest.Mock };
  const user = { id: 'u-1' } as AuthenticatedUser;

  beforeEach(() => {
    prisma = { user: { findUnique: jest.fn() } };
    whatsapp = { sendMessage: jest.fn() };
    service = new NotificationsService(
      prisma as unknown as PrismaService,
      whatsapp as unknown as WhatsappService,
    );
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
    expect(result).toEqual({ sent: true, mode: 'twilio', id: 'SM123' });
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
});
