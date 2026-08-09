/**
 * Cloudflare Email Worker — puente entre Cloudflare Email Routing y Royáltica.
 *
 * Cloudflare recibe el correo que un cliente responde a un recordatorio de
 * cobranza, este Worker lo convierte a JSON, lo FIRMA con HMAC-SHA256 y lo
 * manda a `POST /webhooks/email` del API.
 *
 * La firma es lo que permite al API confiar en el mensaje: sin ella,
 * cualquiera que descubriera la URL del webhook podría inventar respuestas
 * de clientes ("ya pagué") y ensuciar la cobranza.
 *
 * Variables (Settings → Variables del Worker):
 *   ROYALTICA_WEBHOOK_URL  p. ej. https://royaltica-production.up.railway.app/webhooks/email
 *   EMAIL_INBOUND_SECRET   el MISMO valor que en el .env del API (secreto)
 *
 * Nota: `EMAIL_INBOUND_SECRET` debe guardarse como *Secret*, no como variable
 * de texto plano.
 */

/** Límite del cuerpo que reenviamos. Un correo con hilos largos puede pesar
 *  mucho; el clasificador solo necesita lo que el cliente escribió arriba. */
const MAX_BODY_CHARS = 20000;

export default {
  async email(message, env) {
    try {
      const text = await readPlainText(message);

      const payload = JSON.stringify({
        data: {
          from: message.from,
          to: message.to,
          subject: message.headers.get('subject') ?? '',
          text: text.slice(0, MAX_BODY_CHARS),
          message_id: message.headers.get('message-id') ?? null,
          in_reply_to: message.headers.get('in-reply-to') ?? null,
        },
      });

      const signature = await hmacSha256Hex(env.EMAIL_INBOUND_SECRET, payload);

      const res = await fetch(env.ROYALTICA_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Royaltica-Signature': signature,
        },
        body: payload,
      });

      if (!res.ok) {
        console.error(`Royáltica respondió ${res.status}: ${await res.text()}`);
      }
    } catch (err) {
      // Nunca rebotamos el correo por un fallo nuestro: si el webhook está
      // caído, es preferible perder la automatización que devolverle al
      // cliente un "no se pudo entregar" que lo confunda.
      console.error('Fallo al reenviar el correo a Royáltica:', err);
    }
  },
};

/**
 * Extrae el texto plano del correo.
 *
 * `message.raw` es el MIME crudo. Se busca la parte `text/plain`; si el
 * remitente mandó solo HTML, se cae a limpiar las etiquetas — burdo pero
 * suficiente, porque el API vuelve a recortar el citado de todas formas.
 */
async function readPlainText(message) {
  const raw = await new Response(message.raw).text();

  const plain = extractMimePart(raw, 'text/plain');
  if (plain) return plain;

  const html = extractMimePart(raw, 'text/html');
  if (html) {
    return html
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');
  }

  // Sin partes MIME reconocibles: devolvemos el cuerpo tras los encabezados.
  const split = raw.indexOf('\r\n\r\n');
  return split === -1 ? raw : raw.slice(split + 4);
}

/** Saca el contenido de una parte MIME, decodificando quoted-printable. */
function extractMimePart(raw, contentType) {
  const idx = raw.toLowerCase().indexOf(`content-type: ${contentType}`);
  if (idx === -1) return null;

  const afterHeaders = raw.indexOf('\r\n\r\n', idx);
  if (afterHeaders === -1) return null;

  const headerBlock = raw.slice(idx, afterHeaders).toLowerCase();
  let body = raw.slice(afterHeaders + 4);

  // Corta en el siguiente separador de parte (--boundary).
  const boundaryEnd = body.search(/\r\n--[-\w]+/);
  if (boundaryEnd !== -1) body = body.slice(0, boundaryEnd);

  if (headerBlock.includes('quoted-printable')) {
    body = decodeQuotedPrintable(body);
  } else if (headerBlock.includes('base64')) {
    try {
      body = atob(body.replace(/\s/g, ''));
    } catch {
      /* si no decodifica, se deja como vino */
    }
  }

  return body.trim();
}

/** Decodifica quoted-printable (=E1 → á, "=" al final = salto suave). */
function decodeQuotedPrintable(input) {
  const bytes = [];
  const s = input.replace(/=\r?\n/g, '');
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '=' && i + 2 < s.length) {
      const hex = s.slice(i + 1, i + 3);
      if (/^[0-9A-Fa-f]{2}$/.test(hex)) {
        bytes.push(parseInt(hex, 16));
        i += 2;
        continue;
      }
    }
    bytes.push(s.charCodeAt(i));
  }
  return new TextDecoder('utf-8').decode(new Uint8Array(bytes));
}

/** HMAC-SHA256 en hex — el mismo cálculo que valida el API. */
async function hmacSha256Hex(secret, payload) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(payload),
  );
  return [...new Uint8Array(sig)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
