/**
 * Utilidades de parseo para correo ENTRANTE.
 *
 * El correo es un formato hostil: el remitente viene envuelto en nombre y
 * comillas, y una respuesta arrastra citado TODO el mensaje original. Ese
 * citado es la trampa más importante de este módulo: si no se recorta, el
 * clasificador leería nuestro propio recordatorio ("...ya realizaste el
 * pago...") y podría clasificar como "el cliente dice que pagó" un correo
 * donde el cliente en realidad escribió "todavía no puedo".
 */

/**
 * Extrae la dirección de un campo From.
 * Acepta `Juan Pérez <juan@x.com>`, `<juan@x.com>` y `juan@x.com`.
 * Devuelve null si no hay algo con forma de correo.
 */
export function parseEmailAddress(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const angle = raw.match(/<([^<>]+)>/);
  const candidate = (angle ? angle[1] : raw).trim().replace(/^"|"$/g, '');
  // Validación deliberadamente laxa: solo confirmamos que tenga forma de
  // correo. La autorización real la da empatar contra un Customer existente.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate)) return null;
  return candidate.toLowerCase();
}

/**
 * Marcadores de inicio del texto citado. Todo lo que venga DESPUÉS de la
 * primera coincidencia se descarta: es el mensaje original, no lo que el
 * cliente escribió ahora.
 */
const QUOTE_MARKERS: RegExp[] = [
  /^>/, // citado clásico
  /^\s*El .+ escribi(ó|o):/i, // Gmail español
  /^\s*On .+ wrote:/i, // Gmail inglés
  /^\s*-{2,}\s*Mensaje original\s*-{2,}/i, // Outlook español
  /^\s*-{2,}\s*Original Message\s*-{2,}/i, // Outlook inglés
  /^\s*_{5,}\s*$/, // separador de Outlook
  /^\s*De:\s.+/i, // encabezado citado Outlook ES
  /^\s*From:\s.+/i, // encabezado citado Outlook EN
];

/**
 * Recorta la respuesta al texto que el cliente realmente escribió,
 * descartando el mensaje citado y las firmas.
 */
export function stripQuotedReply(body: string): string {
  const lines = body.split(/\r?\n/);
  const kept: string[] = [];

  for (const line of lines) {
    if (QUOTE_MARKERS.some((re) => re.test(line))) break;
    // Separador estándar de firma (RFC 3676): "-- " en su propia línea.
    if (/^--\s*$/.test(line)) break;
    kept.push(line);
  }

  return kept.join('\n').trim();
}

/**
 * Intenta sacar el folio de la factura del asunto.
 *
 * El recordatorio sale con asunto `Recordatorio de pago · factura F-123`,
 * y al responder el cliente el asunto queda `Re: Recordatorio de pago ·
 * factura F-123`. Aprovecharlo permite ligar la respuesta a la factura
 * EXACTA en vez de adivinar cuál de las pendientes es.
 */
export function extractFolioFromSubject(subject: string | undefined | null): string | null {
  if (!subject) return null;
  const m = subject.match(/factura\s+([A-Za-z0-9][A-Za-z0-9._/-]{0,63})/i);
  if (!m || !m[1]) return null;
  // Limpia puntuación de cierre que a veces arrastra el asunto.
  return m[1].replace(/[.,;:]+$/, '');
}

/** Payload normalizado, independiente del proveedor de correo entrante. */
export interface NormalizedInboundEmail {
  from: string;
  subject: string;
  text: string;
  messageId: string | null;
}

/**
 * Normaliza el cuerpo del webhook a una forma única.
 *
 * Se toleran varias formas porque cada proveedor de correo entrante manda lo
 * suyo (Resend, SendGrid, Mailgun, Postmark, o un Worker de Cloudflare
 * mandando algo propio). Todos coinciden en lo esencial: remitente, asunto y
 * texto plano.
 */
export function normalizeInboundPayload(payload: unknown): NormalizedInboundEmail | null {
  if (!payload || typeof payload !== 'object') return null;

  const root = payload as Record<string, unknown>;
  // Resend envuelve el contenido real en `data`.
  const data =
    root.data && typeof root.data === 'object'
      ? (root.data as Record<string, unknown>)
      : root;

  const pick = (...keys: string[]): string | null => {
    for (const k of keys) {
      const v = data[k];
      if (typeof v === 'string' && v.trim()) return v;
    }
    return null;
  };

  const from = parseEmailAddress(pick('from', 'sender', 'From'));
  if (!from) return null;

  const rawText =
    pick('text', 'plain', 'body-plain', 'TextBody', 'strippedText') ?? '';

  return {
    from,
    subject: pick('subject', 'Subject') ?? '',
    text: stripQuotedReply(rawText),
    messageId: pick('message_id', 'messageId', 'MessageID', 'Message-Id'),
  };
}
