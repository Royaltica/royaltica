import { createHmac } from 'node:crypto';

/**
 * Payloads con el formato de los webhooks de WhatsApp Cloud API (Meta) y su
 * firma. Los usa el reproductor de webhooks (scripts/replay-whatsapp-webhook.ts)
 * y las pruebas de uso rudo. Solo para pruebas: no contiene datos reales.
 */

export interface MetaContext {
  /** phone_number_id del número de Royáltica que recibe el mensaje. */
  phoneNumberId: string;
  /** WhatsApp Business Account id (solo informativo en el payload). */
  wabaId?: string;
}

type MessageBody = Record<string, unknown> & { from: string; id: string; type: string };

const envelope = (ctx: MetaContext, value: Record<string, unknown>) => ({
  object: 'whatsapp_business_account',
  entry: [
    {
      id: ctx.wabaId ?? 'WABA-PRUEBA',
      changes: [
        {
          field: 'messages',
          value: {
            messaging_product: 'whatsapp',
            metadata: { display_phone_number: '520000000000', phone_number_id: ctx.phoneNumberId },
            ...value,
          },
        },
      ],
    },
  ],
});

const now = () => String(Math.floor(Date.now() / 1000));

function inbound(ctx: MetaContext, msg: MessageBody, profileName = 'Contacto de prueba') {
  return envelope(ctx, {
    contacts: [{ profile: { name: profileName }, wa_id: msg.from }],
    messages: [{ timestamp: now(), ...msg }],
  });
}

const withContext = (contextId?: string) =>
  contextId ? { context: { from: '520000000000', id: contextId } } : {};

export function textMessage(ctx: MetaContext, from: string, id: string, body: string, contextId?: string) {
  return inbound(ctx, { from, id, type: 'text', text: { body }, ...withContext(contextId) });
}

/** Botón de respuesta rápida de una plantilla; normalmente responde a un mensaje nuestro. */
export function buttonReply(ctx: MetaContext, from: string, id: string, text: string, contextId?: string) {
  return inbound(ctx, { from, id, type: 'button', button: { text, payload: text }, ...withContext(contextId) });
}

export function imageMessage(ctx: MetaContext, from: string, id: string, caption?: string, contextId?: string) {
  return inbound(ctx, {
    from,
    id,
    type: 'image',
    image: { id: `media-${id}`, mime_type: 'image/jpeg', sha256: 'prueba', ...(caption ? { caption } : {}) },
    ...withContext(contextId),
  });
}

export type DeliveryState = 'sent' | 'delivered' | 'read' | 'failed';

/** Estado de entrega de un mensaje que enviamos (wamid saliente). */
export function statusUpdate(ctx: MetaContext, wamid: string, status: DeliveryState, recipient: string) {
  return envelope(ctx, {
    statuses: [
      {
        id: wamid,
        status,
        timestamp: now(),
        recipient_id: recipient,
        ...(status === 'failed'
          ? { errors: [{ code: 131026, title: 'Message undeliverable' }] }
          : {}),
      },
    ],
  });
}

/** Cabecera x-hub-signature-256 que Meta calcula con el App Secret sobre el cuerpo crudo. */
export function signBody(rawBody: string | Buffer, appSecret: string): string {
  return 'sha256=' + createHmac('sha256', appSecret).update(rawBody).digest('hex');
}
