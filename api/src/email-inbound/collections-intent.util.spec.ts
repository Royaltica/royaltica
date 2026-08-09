import { classifyIntent } from './collections-intent.util';

describe('classifyIntent', () => {
  it('detecta una afirmación de pago', () => {
    const r = classifyIntent('Ya pagué la factura ayer');
    expect(r.intent).toBe('PAYMENT_CLAIMED');
    expect(r.matched).not.toBeNull();
    expect(r.needsHuman).toBe(false);
  });

  it('detecta el pago aunque venga sin acentos', () => {
    expect(classifyIntent('ya hice la transferencia').intent).toBe(
      'PAYMENT_CLAIMED',
    );
  });

  it('NO marca pago cuando hay negación ("todavía no")', () => {
    const r = classifyIntent('Todavía no he pagado, dame unos días');
    expect(r.intent).toBe('CUSTOMER_REPLY');
    expect(r.matched).toBeNull();
  });

  it('NO marca pago ante una pregunta sobre cuándo pagar', () => {
    expect(classifyIntent('¿Cuándo vence el pago?').intent).toBe(
      'CUSTOMER_REPLY',
    );
  });

  it('escala a humano si menciona abogado', () => {
    const r = classifyIntent('Esto lo va a ver mi abogado');
    expect(r.needsHuman).toBe(true);
    expect(r.escalationMatch).toBe('abogado');
  });

  it('escala a humano si dispute el monto', () => {
    expect(classifyIntent('No reconozco ese cargo').needsHuman).toBe(true);
  });

  it('escala aunque además afirme el pago (ambas señales son independientes)', () => {
    const r = classifyIntent('Ya pagué, y si insisten hablo con mi abogado');
    expect(r.intent).toBe('PAYMENT_CLAIMED');
    expect(r.needsHuman).toBe(true);
  });

  it('un mensaje neutral no escala ni afirma pago', () => {
    const r = classifyIntent('Buenos días, ¿me mandan el estado de cuenta?');
    expect(r.intent).toBe('CUSTOMER_REPLY');
    expect(r.needsHuman).toBe(false);
  });
});
