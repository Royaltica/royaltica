import {
  parseEmailAddress,
  stripQuotedReply,
  extractFolioFromSubject,
  normalizeInboundPayload,
} from './email-parse.util';

describe('parseEmailAddress', () => {
  it('extrae la dirección del formato "Nombre <correo>"', () => {
    expect(parseEmailAddress('Juan Pérez <juan@empresa.mx>')).toBe(
      'juan@empresa.mx',
    );
  });

  it('acepta una dirección pelona y la normaliza a minúsculas', () => {
    expect(parseEmailAddress('Juan@Empresa.MX')).toBe('juan@empresa.mx');
  });

  it('devuelve null si no hay algo con forma de correo', () => {
    expect(parseEmailAddress('no soy un correo')).toBeNull();
    expect(parseEmailAddress(undefined)).toBeNull();
    expect(parseEmailAddress('')).toBeNull();
  });
});

describe('stripQuotedReply', () => {
  it('recorta el mensaje citado de Gmail en español', () => {
    const body = [
      'Ya te transferí ayer, ahí lo checas.',
      '',
      'El vie, 8 ago 2026 a las 10:00, Royáltica (<no-reply@royaltica.com>) escribió:',
      '> Te recordamos que tu factura F-123 vence...',
    ].join('\n');
    expect(stripQuotedReply(body)).toBe('Ya te transferí ayer, ahí lo checas.');
  });

  it('recorta el citado de Outlook', () => {
    const body = [
      'Todavía no puedo pagar.',
      '_____________________________',
      'De: Royáltica <no-reply@royaltica.com>',
      'Asunto: Recordatorio de pago',
    ].join('\n');
    expect(stripQuotedReply(body)).toBe('Todavía no puedo pagar.');
  });

  it('recorta la firma delimitada por "-- "', () => {
    const body = ['Ahí te va el comprobante.', '-- ', 'Juan Pérez', 'Director'].join(
      '\n',
    );
    expect(stripQuotedReply(body)).toBe('Ahí te va el comprobante.');
  });

  it('deja intacto un mensaje sin citado', () => {
    expect(stripQuotedReply('Hola, ¿me mandan el estado de cuenta?')).toBe(
      'Hola, ¿me mandan el estado de cuenta?',
    );
  });
});

describe('extractFolioFromSubject', () => {
  it('saca el folio de una respuesta al recordatorio', () => {
    expect(
      extractFolioFromSubject('Re: Recordatorio de pago · factura F-123'),
    ).toBe('F-123');
  });

  it('tolera puntuación al final', () => {
    expect(extractFolioFromSubject('Re: factura A-99.')).toBe('A-99');
  });

  it('devuelve null si el asunto no menciona una factura', () => {
    expect(extractFolioFromSubject('Hola')).toBeNull();
    expect(extractFolioFromSubject(undefined)).toBeNull();
  });
});

describe('normalizeInboundPayload', () => {
  it('normaliza el formato de Resend (contenido dentro de data)', () => {
    const res = normalizeInboundPayload({
      type: 'email.received',
      data: {
        from: 'Juan <juan@empresa.mx>',
        subject: 'Re: Recordatorio de pago · factura F-1',
        text: 'Ya pagué.\n> mensaje original',
        message_id: 'abc123',
      },
    });
    expect(res).toEqual({
      from: 'juan@empresa.mx',
      subject: 'Re: Recordatorio de pago · factura F-1',
      text: 'Ya pagué.',
      messageId: 'abc123',
    });
  });

  it('normaliza un payload plano de otro proveedor', () => {
    const res = normalizeInboundPayload({
      from: 'ana@x.com',
      subject: 'Duda',
      'body-plain': 'Tengo una pregunta',
    });
    expect(res?.from).toBe('ana@x.com');
    expect(res?.text).toBe('Tengo una pregunta');
  });

  it('devuelve null si no hay remitente reconocible', () => {
    expect(normalizeInboundPayload({ subject: 'sin from' })).toBeNull();
    expect(normalizeInboundPayload(null)).toBeNull();
    expect(normalizeInboundPayload('texto')).toBeNull();
  });
});
