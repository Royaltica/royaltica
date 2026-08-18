import { EmailService } from './email.service';
import { ConfigService } from '@nestjs/config';
import { UsageService } from '../usage/usage.service';
import type { Env } from '../config/env.validation';

describe('EmailService — adjuntos Resend', () => {
  let service: EmailService;
  let send: jest.Mock;
  let usage: { record: jest.Mock };

  beforeEach(() => {
    usage = { record: jest.fn().mockResolvedValue(undefined) };
    service = new EmailService(
      { get: jest.fn() } as unknown as ConfigService<Env, true>,
      usage as unknown as UsageService,
    );
    send = jest.fn().mockResolvedValue({ data: { id: 'email-1' }, error: null });
    const internals = service as unknown as {
      client: { emails: { send: jest.Mock } };
      fromEmail: string;
    };
    internals.client = { emails: { send } };
    internals.fromEmail = 'Royáltica <no-reply@example.com>';
  });

  it('mantiene compatibilidad: envía correo sin adjuntos', async () => {
    await expect(
      service.send({
        to: 'admin@example.com',
        subject: 'Resumen',
        html: '<p>ok</p>',
        text: 'ok',
        organizationId: 'org-1',
      }),
    ).resolves.toEqual({ sent: true, id: 'email-1' });

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'admin@example.com',
        subject: 'Resumen',
        attachments: undefined,
      }),
    );
    expect(usage.record).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-1',
        feature: 'EMAIL_SENT',
        units: 1,
      }),
    );
  });

  it('envía adjuntos con filename, MIME type y contenido sin registrar el binario', async () => {
    const pdf = Buffer.from('%PDF-1.7');

    await expect(
      service.sendAlert('admin@example.com', 'Reporte', 'Listo', 'org-1', [
        {
          filename: 'reporte-cobranza.pdf',
          contentType: 'application/pdf',
          content: pdf,
        },
      ]),
    ).resolves.toEqual({ sent: true, id: 'email-1' });

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        attachments: [
          {
            filename: 'reporte-cobranza.pdf',
            contentType: 'application/pdf',
            content: pdf,
          },
        ],
      }),
    );
  });

  it('rechaza adjuntos inválidos sin llamar a Resend', async () => {
    await expect(
      service.sendAlert('admin@example.com', 'Reporte', 'Listo', 'org-1', [
        { filename: '   ', contentType: 'application/pdf', content: Buffer.from('x') },
      ]),
    ).resolves.toEqual({ sent: false });

    expect(send).not.toHaveBeenCalled();
    expect(usage.record).not.toHaveBeenCalled();
  });

  it('reintenta 1 vez ante una falla de red transitoria y sí envía en el segundo intento', async () => {
    send
      .mockRejectedValueOnce(new Error('ETIMEDOUT'))
      .mockResolvedValueOnce({ data: { id: 'email-2' }, error: null });

    const result = await service.send({
      to: 'admin@example.com',
      subject: 'Resumen',
      html: '<p>ok</p>',
    });

    expect(result).toEqual({ sent: true, id: 'email-2' });
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('NO reintenta un rechazo de la API (destinatario inválido, etc.) — reintentar no cambiaría el resultado', async () => {
    send.mockResolvedValueOnce({ data: null, error: { message: 'Invalid recipient' } });

    const result = await service.send({
      to: 'no-es-un-correo',
      subject: 'Resumen',
      html: '<p>ok</p>',
    });

    expect(result).toEqual({ sent: false });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('si ambos intentos fallan por red, devuelve sent:false sin lanzar', async () => {
    send.mockRejectedValue(new Error('ECONNRESET'));

    const result = await service.send({
      to: 'admin@example.com',
      subject: 'Resumen',
      html: '<p>ok</p>',
    });

    expect(result).toEqual({ sent: false });
    expect(send).toHaveBeenCalledTimes(2);
  });
});
