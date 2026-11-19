/**
 * Reproductor de webhooks de WhatsApp: arma payloads con el formato real de
 * Meta, los firma con el secreto de la app (X-Hub-Signature-256) y los manda
 * a /webhooks/whatsapp. Sirve para probar de punta a punta SIN depender de
 * Meta (con la app sin publicar Meta no entrega eventos reales).
 *
 * Uso (desde api/):
 *   npx tsx scripts/replay-whatsapp-webhook.ts <escenario> [opciones]
 *
 * Escenarios:
 *   texto      --from 5215512345678 --text "Hola"            respuesta en texto
 *   respuesta  --from … --text "…" --context wamid.XXX       respuesta a un mensaje nuestro (empate exacto)
 *   boton      --from … --text "Ya pagué, comparto comprobante" --context wamid.XXX
 *   imagen     --from … [--text "comprobante"]               archivo (comprobante)
 *   baja       --from …                                      manda "BAJA"
 *   estado     --id wamid.XXX --status delivered|read|sent   estado de entrega
 *   fallo      --id wamid.XXX [--code 131026]                entrega fallida
 *   plantilla  --name aviso_vencida --event REJECTED         aviso de plantilla
 *   duplicado  --from … --text "…"                           manda el MISMO mensaje dos veces (reintento de Meta)
 *   firma-mala --from …                                      firma inválida (debe responder 403)
 *
 * Opciones comunes:
 *   --url http://localhost:8080      destino (default; nunca apunta solo a producción)
 *   --phone-id 123456                phone_number_id receptor (default WHATSAPP_PHONE_ID o "TEST-PN")
 *   --wamid wamid.TEST.1             id del mensaje entrante (default: uno nuevo)
 *
 * El secreto se lee de WHATSAPP_APP_SECRET (.env). Nunca se pasa por
 * argumento ni se imprime. Para staging, exporta el secreto de staging en la
 * terminal antes de correrlo.
 */

import 'dotenv/config';
import { createHmac, randomUUID } from 'node:crypto';

type Args = Record<string, string>;

function parseArgs(argv: string[]): { scenario: string; args: Args } {
  const [scenario = '', ...rest] = argv;
  const args: Args = {};
  for (let i = 0; i < rest.length; i += 1) {
    if (rest[i].startsWith('--')) {
      args[rest[i].slice(2)] = rest[i + 1] ?? '';
      i += 1;
    }
  }
  return { scenario, args };
}

function envelope(phoneId: string, value: Record<string, unknown>, field = 'messages') {
  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'WABA-TEST',
        changes: [
          {
            field,
            value:
              field === 'messages'
                ? { messaging_product: 'whatsapp', metadata: { display_phone_number: '0000000000', phone_number_id: phoneId }, ...value }
                : value,
          },
        ],
      },
    ],
  };
}

function inbound(args: Args, phoneId: string, message: Record<string, unknown>) {
  const from = args.from;
  if (!from) throw new Error('Falta --from (teléfono del cliente, solo dígitos, p. ej. 5215512345678).');
  return envelope(phoneId, {
    contacts: [{ profile: { name: 'Prueba' }, wa_id: from }],
    messages: [
      {
        from,
        id: args.wamid || `wamid.TEST.${randomUUID()}`,
        timestamp: String(Math.floor(Date.now() / 1000)),
        ...(args.context ? { context: { id: args.context } } : {}),
        ...message,
      },
    ],
  });
}

function build(scenario: string, args: Args, phoneId: string): unknown {
  switch (scenario) {
    case 'texto':
    case 'respuesta':
    case 'duplicado':
    case 'firma-mala':
      return inbound(args, phoneId, { type: 'text', text: { body: args.text || 'Hola' } });
    case 'baja':
      return inbound(args, phoneId, { type: 'text', text: { body: 'BAJA' } });
    case 'boton': {
      const text = args.text || 'Ya pagué, comparto comprobante';
      return inbound(args, phoneId, { type: 'button', button: { text, payload: text } });
    }
    case 'imagen':
      return inbound(args, phoneId, {
        type: 'image',
        image: { id: 'MEDIA-TEST', mime_type: 'image/jpeg', ...(args.text ? { caption: args.text } : {}) },
      });
    case 'estado':
    case 'fallo': {
      if (!args.id) throw new Error('Falta --id (wamid del mensaje que enviamos).');
      const status = scenario === 'fallo' ? 'failed' : args.status || 'delivered';
      const code = Number(args.code || 131026);
      return envelope(phoneId, {
        statuses: [
          {
            id: args.id,
            status,
            timestamp: String(Math.floor(Date.now() / 1000)),
            recipient_id: args.from || '5210000000000',
            ...(status === 'failed'
              ? { errors: [{ code, title: 'Message undeliverable', error_data: { details: 'Simulado por el reproductor' } }] }
              : {}),
          },
        ],
      });
    }
    case 'plantilla':
      return envelope(
        phoneId,
        {
          event: (args.event || 'REJECTED').toUpperCase(),
          message_template_name: args.name || 'aviso_vencida',
          message_template_language: 'es_MX',
          reason: args.reason || 'INVALID_FORMAT',
        },
        'message_template_status_update',
      );
    default:
      throw new Error(
        `Escenario desconocido: "${scenario}". Usa: texto, respuesta, boton, imagen, baja, estado, fallo, plantilla, duplicado, firma-mala.`,
      );
  }
}

async function post(url: string, raw: string, signature: string) {
  const res = await fetch(`${url.replace(/\/$/, '')}/webhooks/whatsapp`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-hub-signature-256': signature },
    body: raw,
  });
  const body = await res.text();
  console.log(`→ HTTP ${res.status} ${body}`);
  return res.status;
}

async function main() {
  const { scenario, args } = parseArgs(process.argv.slice(2));
  const url = args.url || 'http://localhost:8080';
  const phoneId = args['phone-id'] || process.env.WHATSAPP_PHONE_ID || 'TEST-PN';
  const secret = process.env.WHATSAPP_APP_SECRET ?? '';

  if (/api\.royaltica\.com/.test(url) && args.confirm !== 'produccion') {
    throw new Error('Ese destino es PRODUCCIÓN. Si de verdad es lo que quieres, agrega --confirm produccion.');
  }
  if (!secret) {
    console.warn('Aviso: WHATSAPP_APP_SECRET vacío. Solo un backend en desarrollo sin secreto aceptará esto.');
  }

  const raw = JSON.stringify(build(scenario, args, phoneId));
  const good = 'sha256=' + createHmac('sha256', secret).update(raw).digest('hex');
  console.log(`Escenario "${scenario}" → ${url}`);

  if (scenario === 'firma-mala') {
    const status = await post(url, raw, 'sha256=' + '0'.repeat(64));
    console.log(status === 403 ? 'OK: la firma inválida se rechazó.' : 'OJO: se esperaba 403.');
    return;
  }
  await post(url, raw, good);
  if (scenario === 'duplicado') {
    console.log('Reintento (mismo wamid):');
    await post(url, raw, good);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
