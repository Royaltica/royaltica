/**
 * Reglas de guardrail para llamadas telefónicas hechas por un agente de IA
 * (cobranza saliente, o soporte entrante). Contexto legal: en México, la
 * cobranza vía llamada está regulada por CONDUSEF (registro REDECO) y hay
 * jurisprudencia (2026) que sanciona la cobranza abusiva — horarios
 * indebidos, amenazas, presión indebida, contacto a terceros sin
 * autorización, uso de documentos que aparenten ser oficiales sin serlo.
 *
 * Estas constantes son la "letra" de esas reglas dentro del código: el
 * texto de la revelación obligatoria, y las listas de frases que dan una
 * señal server-side determinista (además del system prompt del modelo de
 * voz, que sigue siendo la primera línea de defensa).
 */

/**
 * Guion de apertura OBLIGATORIO. El agente debe identificarse como sistema
 * automatizado antes de cualquier otra cosa — nunca debe hacerse pasar por
 * una persona. `{{organizationName}}` se reemplaza en tiempo de llamada.
 */
export const MANDATORY_DISCLOSURE_SCRIPT =
  'Hola, le habla un asistente automatizado de {{organizationName}}, ' +
  'gestionado por Royáltica. Esta llamada puede ser grabada con fines de ' +
  'calidad y cumplimiento. Le contacto por una factura pendiente. Si ' +
  'prefiere hablar con una persona, o no desea recibir más llamadas de ' +
  'este tipo, dígamelo y lo atiendo de inmediato.';

export const RECORDING_CONSENT_LINE =
  'Esta llamada puede ser grabada con fines de calidad y cumplimiento.';

/**
 * Si el DEUDOR dice algo que contiene una de estas frases, la llamada debe
 * escalar a un humano de inmediato (o agendar callback), sin excepción.
 */
export const ESCALATION_TRIGGER_PHRASES: readonly string[] = [
  'hablar con una persona',
  'hablar con un humano',
  'hablar con alguien',
  'quiero hablar con un agente',
  'esto es acoso',
  'me estan acosando',
  'los voy a demandar',
  'voy a demandar',
  'mi abogado',
  'condusef',
  'ya no me llamen',
  'no me vuelvan a llamar',
  'no quiero que me llamen',
  'dejen de llamarme',
  'quiero que me quiten de la lista',
];

/**
 * Contenido que el AGENTE tiene prohibido decir. Es una red de seguridad
 * server-side ADICIONAL al system prompt del modelo — nunca el único
 * mecanismo — pero da un punto de control determinista antes de sintetizar
 * audio: si el texto generado contiene algo de esta lista, se bloquea/
 * regenera en vez de reproducirse.
 */
export const FORBIDDEN_AGENT_PHRASES: readonly string[] = [
  // Amenazas legales falsas o presión indebida
  'lo vamos a demandar',
  'te vamos a demandar',
  'orden de aprehension',
  'va a ir a la carcel',
  'vas a ir a la carcel',
  'embargo',
  'reporte a buro',
  'reportado al buro',
  'accion legal inmediata',
  // Solicitar datos sensibles por voz (deben ir por canal seguro, nunca voz)
  'numero de tarjeta',
  'cvv',
  'codigo de seguridad de tu tarjeta',
  'contraseña',
  'clabe interbancaria',
  'nip',
  // Prometer condonaciones/descuentos fuera de política
  'te condono la deuda',
  'te quito toda la deuda',
  'descuento especial solo por hoy',
  // Divulgación de la deuda a terceros / medios (prohibido por CONDUSEF)
  'le contamos a tu familia',
  'le avisamos a tu jefe',
  'lo publicamos',
];

/** Normaliza texto (minúsculas, sin acentos) para comparar contra las listas de arriba. */
export function normalizeForScreening(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}
