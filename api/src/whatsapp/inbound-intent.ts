/**
 * Clasificación determinista de lo que responde un cliente por WhatsApp.
 * Reglas por inclusión de frases (sin acentos, minúsculas, sin signos):
 * explicables y auditables, sin caja negra. El texto entrante es dato no
 * confiable: aquí solo se etiqueta, nunca se ejecuta lo que diga.
 *
 * Prioridad (de la más protectora a la menos): baja → número equivocado →
 * disputa → afirmación de pago → respuesta normal.
 */
export type CustomerIntent =
  | 'OPT_OUT'
  | 'WRONG_CONTACT'
  | 'DISPUTE'
  | 'PAYMENT_CLAIMED'
  | 'CUSTOMER_REPLY';

export interface IntentResult {
  intent: CustomerIntent;
  /** Frase que disparó la regla (para la bitácora). */
  matched: string | null;
}

/** Minúsculas, sin acentos, sin signos y con espacios simples. */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Mensajes que SOLO dicen esto son una baja ("BAJA", "Stop."). */
const OPT_OUT_EXACT = new Set([
  'baja',
  'stop',
  'alto',
  'cancelar',
  'cancelar mensajes',
  'no molestar',
  'unsubscribe',
  'darme de baja',
  'dar de baja',
  'quiero baja',
]);

/**
 * Palabras que, al inicio de un mensaje corto, son baja ("Baja por favor").
 * No incluye "cancelar" ni "dar de baja" ("cancelar la factura", "dar de baja
 * la factura duplicada") ni "alto" ("alto ahí, ¿quién habla?").
 */
const OPT_OUT_PREFIXES = ['baja', 'stop', 'unsubscribe', 'darme de baja', 'dame de baja', 'denme de baja', 'deme de baja'];

/** Frases de baja dentro de un mensaje más largo. */
const OPT_OUT_PHRASES = [
  'no me escriban',
  'no me escriba',
  'no me manden',
  'no me mande',
  'no me envien',
  'no me envie',
  'no me contacten',
  'no me contacte',
  'no me vuelvan a escribir',
  'no vuelvan a escribir',
  'no vuelva a escribir',
  'dejen de escribir',
  'deje de escribir',
  'dejen de mandar',
  'deje de mandar',
  'dejen de enviar',
  'deje de enviar',
  'dejen de molestar',
  'deje de molestar',
  'ya no me escriban',
  'ya no me manden',
  'ya no quiero recibir',
  'no quiero recibir',
  'no deseo recibir',
  'cancelar mensajes',
  'cancelen los mensajes',
  'cancelen mensajes',
  'denme de baja',
  'deme de baja',
  'darme de baja',
  'dar de baja este numero',
  'quiero darme de baja',
  'quiero la baja',
  'solicito la baja',
  'solicito baja',
  'eliminen mi numero',
  'borren mi numero',
  'quiten mi numero',
];

/**
 * Si aparece alguna, la frase de baja NO cuenta ("no se dé de baja", "¿cómo
 * me doy de baja del portal?"): ante la duda no se apaga a un cliente.
 */
const OPT_OUT_NEGATIONS = [
  'no se de de baja',
  'no me de de baja',
  'no me den de baja',
  'no quiero darme de baja',
  'no quiero la baja',
  'no es baja',
  'sin darme de baja',
  'no cancelar',
  'no cancelen',
];

const WRONG_CONTACT_PHRASES = [
  'numero equivocado',
  'telefono equivocado',
  'se equivoco de numero',
  'se equivocaron de numero',
  'equivocado de numero',
  'no soy esa persona',
  'no soy la persona',
  'no soy el contacto',
  'no soy quien',
  'no se quien es',
  'no conozco a',
  'no conozco esa empresa',
  'no conozco la empresa',
  'ya no trabajo',
  'ya no laboro',
  'ya no colaboro',
  'deje de trabajar',
  'no trabajo ahi',
  'no trabajo aqui',
  'no trabajo en esa',
  'no trabajo en la empresa',
  'no trabajo para',
  'no pertenezco a',
  'no tengo relacion con',
  'no tengo nada que ver',
  'este numero no es de',
  'este no es el numero',
  'este numero ya no es',
  'cambio de dueno',
];

const DISPUTE_PHRASES = [
  'no es mi factura',
  'no es nuestra factura',
  'esa factura no es',
  'no reconozco',
  'no reconocemos',
  'no la reconozco',
  'no corresponde',
  'factura cancelada',
  'ya la cancele',
  'ya la cancelamos',
  'ya fue cancelada',
  'esta cancelada',
  'se cancelo',
  'no recibi',
  'no recibimos',
  'nunca recibi',
  'nunca recibimos',
  'no nos llego',
  'no me llego',
  'no llego la mercancia',
  'no llego el producto',
  'no llego el pedido',
  'producto danado',
  'mercancia danada',
  'llego incompleto',
  'llego incompleta',
  'pedido incompleto',
  'monto incorrecto',
  'monto equivocado',
  'cantidad incorrecta',
  'esta mal la factura',
  'factura incorrecta',
  'factura mal',
  'hay un error en la factura',
  'error en la factura',
  'no estoy de acuerdo',
  'no estamos de acuerdo',
  'nota de credito pendiente',
  'falta la nota de credito',
  'no debo',
  'no debemos',
  'devolucion',
  'reclamacion',
  'aclaracion',
];

const PAYMENT_HINTS = [
  'ya pague',
  'ya lo pague',
  'ya la pague',
  'pague',
  'pagado',
  'pagada',
  'pagamos',
  'pago realizado',
  'realice el pago',
  'realizamos el pago',
  'hice el pago',
  'hicimos el pago',
  'hice la transferencia',
  'hicimos la transferencia',
  'transferi',
  'transferencia',
  'deposit',
  'liquid',
  'abone',
  'abonamos',
  'saldado',
  'saldada',
  'cubierto',
  'cubierta',
  'ya quedo',
  'ya esta pagada',
];

/** Negaciones que invalidan una aparente afirmación de pago. */
const PAYMENT_NEGATIONS = [
  'no he',
  'no hemos',
  'aun no',
  'todavia no',
  'no puedo',
  'no podemos',
  'no tengo',
  'no tenemos',
  'no cuento',
  'no contamos',
  'no pague',
  'no pagamos',
  'no se ha',
  'no ha quedado',
  'no esta pagad',
  'cuando',
  'voy a',
  'vamos a',
  'manana',
  'la proxima',
  'el proximo',
];

/** Busca la primera frase que aparece empezando en límite de palabra (permite sufijos: "deposit" → "depositado"). */
function findPhrase(n: string, phrases: readonly string[]): string | null {
  const padded = ` ${n}`;
  return phrases.find((p) => padded.includes(` ${p}`)) ?? null;
}

export function classifyIntent(text: string): IntentResult {
  const n = normalizeText(text);
  if (!n) return { intent: 'CUSTOMER_REPLY', matched: null };

  if (!OPT_OUT_NEGATIONS.some((neg) => n.includes(neg))) {
    if (OPT_OUT_EXACT.has(n)) return { intent: 'OPT_OUT', matched: n };
    // "BAJA por favor", "Stop gracias": empieza con la palabra de baja y es corto.
    const prefix = OPT_OUT_PREFIXES.find((p) => n.startsWith(`${p} `) && n.length <= p.length + 25);
    if (prefix) return { intent: 'OPT_OUT', matched: prefix };
    const optOut = findPhrase(n, OPT_OUT_PHRASES);
    if (optOut) return { intent: 'OPT_OUT', matched: optOut };
  }

  const wrong = findPhrase(n, WRONG_CONTACT_PHRASES);
  if (wrong) return { intent: 'WRONG_CONTACT', matched: wrong };

  const dispute = findPhrase(n, DISPUTE_PHRASES);
  if (dispute) return { intent: 'DISPUTE', matched: dispute };

  const paid = findPhrase(n, PAYMENT_HINTS);
  if (paid && !findPhrase(n, PAYMENT_NEGATIONS)) {
    return { intent: 'PAYMENT_CLAIMED', matched: paid };
  }
  return { intent: 'CUSTOMER_REPLY', matched: null };
}
