import { ownText } from './email-inbound.service';
import { classifyIntent } from '../whatsapp/inbound-intent';
import { COLLECTION_FOOTER_TEXT } from '../email/email.service';

describe('baja por correo', () => {
  const cita = `El lun, 16 nov 2026 a las 11:00, Cobranza <cobranza@royaltica.com> escribió:\n> Hola, tu factura F-1 vence el 20 de noviembre.\n> ${COLLECTION_FOOTER_TEXT}`;

  it('ownText se queda solo con lo que escribió la persona', () => {
    expect(ownText(`BAJA\n\n${cita}`)).toBe('BAJA');
    expect(ownText('Gracias, ya lo reviso\n\n-----Mensaje original-----\nDe: x')).toBe('Gracias, ya lo reviso');
  });

  it('"BAJA" como respuesta, aun con el correo citado, es una baja', () => {
    expect(classifyIntent(ownText(`Baja\n\n${cita}`)).intent).toBe('OPT_OUT');
  });

  it('una respuesta normal que cita nuestro pie NO es una baja', () => {
    expect(classifyIntent(ownText(`Ya pagamos ayer, saludos\n\n${cita}`)).intent).not.toBe('OPT_OUT');
  });

  it('nuestro propio pie no dispara la baja si alguien lo reenvía completo', () => {
    expect(classifyIntent(COLLECTION_FOOTER_TEXT).intent).not.toBe('OPT_OUT');
  });
});
