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
});
