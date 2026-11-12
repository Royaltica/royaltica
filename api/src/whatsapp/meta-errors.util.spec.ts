import { describeMetaError } from './meta-errors.util';

const body = (code: number, message: string, details?: string) =>
  JSON.stringify({ error: { message, type: 'OAuthException', code, ...(details ? { error_data: { details } } : {}) } });

describe('describeMetaError', () => {
  it('131030: número fuera de la lista de destinatarios permitidos (cuenta de prueba)', () => {
    const e = describeMetaError(400, body(131030, '(#131030) Recipient phone number not in allowed list'));
    expect(e.code).toBe(131030);
    expect(e.message).toContain('lista de destinatarios permitidos');
  });

  it('132001: la plantilla no existe con ese nombre/idioma', () => {
    const e = describeMetaError(404, body(132001, 'Template name does not exist in the translation', 'template name (x) does not exist in es_MX'));
    expect(e.message).toContain('no existe con ese nombre e idioma');
    expect(e.detail).toContain('es_MX');
  });

  it('132000: cantidad de variables distinta', () => {
    expect(describeMetaError(400, body(132000, 'Number of parameters does not match')).message).toContain('número distinto de variables');
  });

  it('190 / 401: token vencido', () => {
    expect(describeMetaError(401, body(190, 'Error validating access token: Session has expired')).message).toContain('venció');
    expect(describeMetaError(401, '').code).toBe(401);
  });

  it('100 con "does not exist": Phone ID equivocado', () => {
    const e = describeMetaError(400, body(100, 'Unsupported post request. Object with ID \'123\' does not exist, cannot be loaded due to missing permissions'));
    expect(e.message).toContain('WHATSAPP_PHONE_ID');
  });

  it('código desconocido: mensaje genérico con el código y el texto de Meta', () => {
    const e = describeMetaError(400, body(999999, 'algo raro'));
    expect(e.message).toContain('999999');
    expect(e.detail).toBe('algo raro');
  });

  it('respuesta que no es JSON no revienta', () => {
    expect(describeMetaError(502, '<html>Bad gateway</html>').message).toContain('HTTP 502');
  });
});
