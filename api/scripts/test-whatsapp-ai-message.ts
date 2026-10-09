/**
 * Script one-shot para probar el flujo completo de punta a punta: Vertex AI
 * (Gemini) redacta el texto de un mensaje de cobranza y se envía por
 * WhatsApp usando la Meta Cloud API — el mismo patrón que ya usa José para
 * correo (Vertex genera, EmailService envía), aplicado a WhatsappService.
 *
 * Uso:
 *   npx tsx scripts/test-whatsapp-ai-message.ts +525512345678
 *
 * Requiere en .env:
 *   VERTEX_PROJECT_ID, VERTEX_LOCATION, VERTEX_KEY_FILE (o VERTEX_KEY_JSON)
 *   WHATSAPP_TOKEN, WHATSAPP_PHONE_ID
 *
 * El número destino debe estar verificado como "número de prueba" en el
 * panel de Meta (Mis apps → Configuración de WhatsApp → Paso 1) mientras la
 * app siga en modo desarrollo/sin verificar.
 */

import 'dotenv/config';

async function generarMensaje(): Promise<string> {
  const project = process.env.VERTEX_PROJECT_ID;
  const location = process.env.VERTEX_LOCATION || 'us-central1';
  const keyFile = process.env.VERTEX_KEY_FILE;
  const keyJson = process.env.VERTEX_KEY_JSON;

  if (!project) {
    throw new Error('Falta VERTEX_PROJECT_ID en .env');
  }

  const googleAuthOptions = keyJson
    ? { credentials: JSON.parse(keyJson) as Record<string, unknown> }
    : keyFile
      ? { keyFilename: keyFile }
      : undefined;

  const { VertexAI } = await import('@google-cloud/vertexai');
  const vertexAi = new VertexAI({ project, location, googleAuthOptions });
  const model = vertexAi.getGenerativeModel({ model: 'gemini-2.5-flash' });

  // Mismo guardrail que ya aplicamos en las plantillas reales: nunca hablar
  // de "deuda" ni "cobro" explícito (política de WhatsApp Business de Meta).
  const prompt = `Redacta un recordatorio de pago breve y profesional en español para un cliente con una factura vencida.
Reglas: tono estándar (ni suave de más ni agresivo), sin la palabra "deuda" ni "cobro", máximo 3 oraciones.
Devuelve SOLO el texto del mensaje, sin comillas ni formato adicional.`;

  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
  });

  const texto = (result.response.candidates?.[0]?.content?.parts ?? [])
    .map((p) => p.text ?? '')
    .join('')
    .trim();

  if (!texto) {
    throw new Error('Vertex no devolvió texto (respuesta vacía).');
  }
  return texto;
}

async function enviarWhatsapp(destino: string, texto: string): Promise<void> {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;

  if (!token || !phoneId) {
    throw new Error('Faltan WHATSAPP_TOKEN o WHATSAPP_PHONE_ID en .env');
  }

  const to = destino.startsWith('+') ? destino : `+${destino}`;

  const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: texto },
    }),
    signal: AbortSignal.timeout(8000),
  });

  const data = (await res.json()) as { messages?: { id?: string }[]; error?: { message?: string } };

  if (!res.ok) {
    throw new Error(
      `Meta respondió ${res.status}: ${data.error?.message ?? JSON.stringify(data)}`,
    );
  }

  console.log('✅ Enviado. ID del mensaje:', data.messages?.[0]?.id);
}

async function main() {
  const destino = process.argv[2];
  if (!destino) {
    console.error('Uso: npx tsx scripts/test-whatsapp-ai-message.ts +525512345678');
    process.exit(1);
  }

  console.log('→ Generando mensaje con Vertex AI (Gemini)...');
  const texto = await generarMensaje();
  console.log('\n📝 Mensaje generado:\n', texto, '\n');

  console.log(`→ Enviando por WhatsApp a ${destino}...`);
  await enviarWhatsapp(destino, texto);
}

main().catch((err) => {
  console.error('❌ Error:', err instanceof Error ? err.message : err);
  process.exit(1);
});
