/**
 * Script one-shot para probar que el AGENTE puede escribir PRIMERO, sin que
 * el destinatario le haya mandado un mensaje antes.
 *
 * WhatsApp exige que todo primer contacto de una empresa hacia alguien que
 * nunca le ha escrito use una PLANTILLA pre-aprobada por Meta (texto libre
 * da el error 131047: "más de 24h desde la última respuesta del cliente").
 * "hello_world" viene aprobada de fábrica en cualquier número de prueba, así
 * que sirve para confirmar que el envío-primero funciona de punta a punta
 * antes de someter una plantilla real de cobranza a aprobación.
 *
 * Uso:
 *   npx tsx scripts/test-whatsapp-template.ts +5215574086204
 *
 * Requiere en .env: WHATSAPP_TOKEN, WHATSAPP_PHONE_ID
 * El número destino debe estar en tu lista de destinatarios de prueba
 * (Mis apps → WhatsApp → Configuración de la API → Paso 1).
 */

import 'dotenv/config';

async function main() {
  const destino = process.argv[2];
  if (!destino) {
    console.error('Uso: npx tsx scripts/test-whatsapp-template.ts +5215574086204');
    process.exit(1);
  }

  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  if (!token || !phoneId) {
    throw new Error('Faltan WHATSAPP_TOKEN o WHATSAPP_PHONE_ID en .env');
  }

  const to = destino.startsWith('+') ? destino : `+${destino}`;

  console.log(`→ Enviando plantilla "hello_world" a ${to} (sin que haya escrito antes)...`);

  const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: 'hello_world',
        language: { code: 'en_US' }, // hello_world solo existe en en_US.
      },
    }),
    signal: AbortSignal.timeout(8000),
  });

  const data = (await res.json()) as { messages?: { id?: string }[]; error?: { message?: string } };

  if (!res.ok) {
    console.error(`❌ Meta respondió ${res.status}:`, data.error?.message ?? data);
    process.exit(1);
  }

  console.log('✅ Enviado. ID del mensaje:', data.messages?.[0]?.id);
  console.log('\nSi te llegó sin haber escrito antes: confirmado, el agente SÍ puede iniciar contacto.');
  console.log('Siguiente paso: crear una plantilla propia de "recordatorio de pago" en el');
  console.log('Administrador de plantillas de mensajes de Meta, someterla a aprobación, y');
  console.log('usar WhatsappService.sendTemplate() con ese nombre en vez de "hello_world".');
}

main().catch((err) => {
  console.error('❌ Error:', err instanceof Error ? err.message : err);
  process.exit(1);
});
