/**
 * Reproductor de webhooks de WhatsApp para staging y pruebas locales (C4).
 *
 * Arma payloads con el formato real de Meta, los firma con WHATSAPP_APP_SECRET
 * (cabecera x-hub-signature-256) y los manda a <url>/webhooks/whatsapp. Así se
 * prueba el webhook sin depender de que Meta entregue eventos.
 *
 * Uso, desde api/ (el secreto debe ser el mismo que tiene el backend destino):
 *   WHATSAPP_APP_SECRET=... npx ts-node scripts/replay-whatsapp-webhook.ts \
 *     --url http://localhost:8080 --caso texto --from 5215500000001
 *
 * Casos: texto, boton, imagen, estados, baja, duplicado, todos.
 * Opciones: --texto "..."  --contexto <wamid de un mensaje nuestro>
 *           --wamid <wamid saliente para "estados">  --phone-id <id del número>
 *
 * Nunca apunta a producción: rechaza api.royaltica.com y app.royaltica.com.
 */
import { randomUUID } from 'node:crypto';
import {
  buttonReply,
  imageMessage,
  signBody,
  statusUpdate,
  textMessage,
  type MetaContext,
} from '../src/whatsapp/testing/meta-webhook-payloads';

const CASOS = ['texto', 'boton', 'imagen', 'estados', 'baja', 'duplicado', 'todos'] as const;
type Caso = (typeof CASOS)[number];
const HOSTS_PRODUCCION = new Set(['api.royaltica.com', 'app.royaltica.com', 'royaltica.com', 'www.royaltica.com']);

function argumentos(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const clave = argv[i];
    if (!clave.startsWith('--')) continue;
    const valor = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true';
    out[clave.slice(2)] = valor;
  }
  return out;
}

function destino(url: string | undefined): URL {
  if (!url) throw new Error('Falta --url (por ejemplo http://localhost:8080).');
  const base = new URL(url);
  if (HOSTS_PRODUCCION.has(base.hostname)) {
    throw new Error(`No se permite producción (${base.hostname}). Usa local o staging.`);
  }
  return new URL('/webhooks/whatsapp', base);
}

const wamid = () => `wamid.PRUEBA.${randomUUID()}`;

function payloads(caso: Caso, a: Record<string, string>, ctx: MetaContext): { nombre: string; cuerpo: unknown }[] {
  const from = a.from ?? '5210000000001';
  const contexto = a.contexto;
  switch (caso) {
    case 'texto':
      return [{ nombre: 'texto', cuerpo: textMessage(ctx, from, wamid(), a.texto ?? 'Hola, ¿me confirman el saldo?', contexto) }];
    case 'boton':
      return [{ nombre: 'botón', cuerpo: buttonReply(ctx, from, wamid(), a.texto ?? 'Ya pagué, comparto comprobante', contexto) }];
    case 'imagen':
      return [{ nombre: 'imagen', cuerpo: imageMessage(ctx, from, wamid(), a.texto ?? 'comprobante', contexto) }];
    case 'baja':
      return [{ nombre: 'baja', cuerpo: textMessage(ctx, from, wamid(), 'BAJA', contexto) }];
    case 'estados': {
      if (!a.wamid) throw new Error('El caso "estados" requiere --wamid (un mensaje que enviamos).');
      return (['sent', 'delivered', 'read', 'failed'] as const).map((estado) => ({
        nombre: `estado ${estado}`,
        cuerpo: statusUpdate(ctx, a.wamid, estado, from),
      }));
    }
    case 'duplicado': {
      const cuerpo = textMessage(ctx, from, wamid(), a.texto ?? 'Mensaje repetido por Meta', contexto);
      return Array.from({ length: 5 }, (_, i) => ({ nombre: `duplicado ${i + 1}/5`, cuerpo }));
    }
    case 'todos':
      return (['texto', 'boton', 'imagen', 'duplicado'] as const).flatMap((c) => payloads(c, a, ctx));
  }
}

async function main() {
  const a = argumentos(process.argv.slice(2));
  const caso = (a.caso ?? 'texto') as Caso;
  if (!CASOS.includes(caso)) throw new Error(`Caso desconocido: ${caso}. Opciones: ${CASOS.join(', ')}.`);
  const url = destino(a.url);
  const secreto = process.env.WHATSAPP_APP_SECRET ?? '';
  if (!secreto) throw new Error('Falta WHATSAPP_APP_SECRET (el mismo del backend destino).');
  const ctx: MetaContext = { phoneNumberId: a['phone-id'] ?? 'PN-PRUEBA' };

  for (const { nombre, cuerpo } of payloads(caso, a, ctx)) {
    const raw = JSON.stringify(cuerpo);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-hub-signature-256': signBody(raw, secreto) },
      body: raw,
    });
    const texto = (await res.text()).slice(0, 200);
    console.log(`${res.ok ? 'OK ' : 'ERR'} ${res.status} ${nombre}${texto ? ` → ${texto}` : ''}`);
    if (!res.ok) process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
