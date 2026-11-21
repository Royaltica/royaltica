import { classifyIntent } from './inbound-intent';

const intent = (t: string) => classifyIntent(t).intent;

describe('classifyIntent (WhatsApp entrante)', () => {
  it.each([
    'BAJA',
    'Baja.',
    'STOP',
    'stop!',
    'Por favor ya no me escriban',
    'No me manden más mensajes',
    'Dejen de escribir a este número',
    'No quiero recibir estos mensajes',
    'Quiero darme de baja',
    'cancelar mensajes',
  ])('baja: %s', (t) => expect(intent(t)).toBe('OPT_OUT'));

  it.each([
    'Por favor no se dé de baja mi cuenta',
    'La factura está dada de alta, ¿cuándo baja el precio?',
    'Voy a dar de baja al proveedor anterior',
    'El stop loss ya quedó',
  ])('NO es baja: %s', (t) => expect(intent(t)).not.toBe('OPT_OUT'));

  it.each([
    'Número equivocado',
    'Se equivocó de número, joven',
    'Yo ya no trabajo en esa empresa',
    'No soy la persona que busca',
    'Este número ya no es de la empresa',
  ])('número equivocado: %s', (t) => expect(intent(t)).toBe('WRONG_CONTACT'));

  it.each([
    'Esa factura no es nuestra',
    'No reconozco ese cargo',
    'Ya la cancelé en el SAT',
    'No recibimos la mercancía',
    'El monto incorrecto, revisen',
    'Tenemos una nota de crédito pendiente',
  ])('disputa: %s', (t) => expect(intent(t)).toBe('DISPUTE'));

  it.each([
    'Ya pagué la factura',
    'Hice la transferencia hoy',
    'Ya quedó, les mando el comprobante',
    'No, ya pagué ayer',
    'Depositado desde el lunes',
  ])('afirmación de pago: %s', (t) => expect(intent(t)).toBe('PAYMENT_CLAIMED'));

  it.each([
    'Aún no he pagado, la próxima semana',
    'Mañana les hago la transferencia',
    '¿Cuándo vence el pago?',
    'No tenemos registrada esa transferencia',
    '¿Me pueden reenviar el PDF?',
    'Gracias',
    '',
  ])('respuesta normal: %s', (t) => expect(intent(t)).toBe('CUSTOMER_REPLY'));

  it('una baja pesa más que una afirmación de pago', () => {
    expect(intent('Ya pagué, no me escriban más')).toBe('OPT_OUT');
  });

  it('una disputa pesa más que una afirmación de pago', () => {
    expect(intent('Esa ya la cancelé, y la otra ya la pagué')).toBe('DISPUTE');
  });

  it('regresa la regla que disparó, para la bitácora', () => {
    expect(classifyIntent('Dejen de molestar').matched).toBe('dejen de molestar');
  });

  it.each(['Baja por favor', 'STOP gracias', 'Denme de baja!'])('baja corta al inicio: %s', (t) => expect(intent(t)).toBe('OPT_OUT'));

  it.each([
    '¿Pueden dar de baja la factura F-1 que está duplicada?',
    'Cancelar la factura 123',
    'Bajamos el precio la próxima vez',
    'baja de precio en la factura de la semana pasada por favor',
  ])('no es baja: %s', (t) => expect(intent(t)).not.toBe('OPT_OUT'));
});
