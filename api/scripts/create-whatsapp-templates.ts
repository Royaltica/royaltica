/**
 * Sube las 7 plantillas de cobranza temprana (Nivel 0-4 + Etapas A-B) a Meta
 * para su aprobación, vía Graph API. Cada una queda igual al texto acordado
 * con Paolo: tono cálido, sin lenguaje de cobranza, categoría Utilidad.
 *
 * Uso:
 *   npx tsx scripts/create-whatsapp-templates.ts
 *
 * Requiere en .env:
 *   WHATSAPP_WABA_ID    → ID de la cuenta de WhatsApp Business (NO el Phone ID)
 *   WHATSAPP_TOKEN       → token con permiso whatsapp_business_management
 *
 * Dónde encontrar el WABA ID: Meta for Developers → tu app → WhatsApp →
 * Configuración de la API → "ID de la cuenta de WhatsApp Business".
 */

import 'dotenv/config';

type Boton = { type: 'QUICK_REPLY'; text: string };

interface PlantillaDef {
  name: string;
  body: string;
  bodyExample: string[];
  buttons?: Boton[];
}

const PLANTILLAS: PlantillaDef[] = [
  {
    name: 'confirmacion_factura',
    body: '¡Hola {{1}}! Esperamos que el día le esté tratando bien. Le escribimos para confirmarle que recibió correctamente la factura {{2}} por {{3}}, con vencimiento el {{4}}. ¿Todo concuerda de su lado?',
    bodyExample: ['Patricia Salas', 'F-2841', '$284,500.00 MXN', '17 de octubre'],
    buttons: [{ type: 'QUICK_REPLY', text: 'Todo en orden' }, { type: 'QUICK_REPLY', text: 'Tengo una duda' }],
  },
  {
    name: 'aviso_preventivo_pago',
    body: '¡Hola {{1}}! Que tenga un excelente día. Le escribimos para avisarle que la factura {{2}} por {{3}} tiene como fecha de vencimiento el {{4}}. ¿La tiene ya en su radar? No hay ninguna prisa, solo queríamos comentárselo con tiempo.',
    bodyExample: ['Patricia Salas', 'F-2841', '$284,500.00 MXN', '17 de octubre'],
  },
  {
    name: 'recordatorio_cortesia_pago',
    body: '¡Hola {{1}}! Esperamos que se encuentre muy bien. Le escribimos para recordarle que la factura {{2}} por {{3}} vence el {{4}}. Puede revisarla y pagarla aquí si le es conveniente: {{5}}. ¿Hay algo que podamos aclararle mientras tanto?',
    bodyExample: ['Patricia Salas', 'F-2841', '$284,500.00 MXN', '17 de octubre', 'pagar.royaltica.com/f-2841'],
    buttons: [{ type: 'QUICK_REPLY', text: 'Todo claro' }, { type: 'QUICK_REPLY', text: 'Tengo una pregunta' }],
  },
  {
    name: 'vence_3_dias',
    body: '¡Hola {{1}}! Ojalá tenga un buen día por allá. Le escribimos para comentarle que la factura {{2}} por {{3}} vence en 3 días, el {{4}}. Puede revisarla aquí: {{5}}. Si ya quedó programada, con gusto la esperamos; si necesita más tiempo, también podemos platicarlo.',
    bodyExample: ['Patricia Salas', 'F-2841', '$284,500.00 MXN', '17 de octubre', 'pagar.royaltica.com/f-2841'],
    buttons: [{ type: 'QUICK_REPLY', text: 'Ya quedó programada' }, { type: 'QUICK_REPLY', text: 'Me gustaría platicarlo' }],
  },
  {
    name: 'vence_hoy',
    body: '¡Hola {{1}}! Esperamos que su semana vaya muy bien. Le escribimos para avisarle que hoy vence la factura {{2}} por {{3}}. Puede liquidarla aquí: {{4}}. Si ya realizó su pago, compártanos su comprobante para dejarlo registrado al momento.',
    bodyExample: ['Patricia Salas', 'F-2841', '$284,500.00 MXN', 'pagar.royaltica.com/f-2841'],
    buttons: [{ type: 'QUICK_REPLY', text: 'Ya pagué, comparto comprobante' }, { type: 'QUICK_REPLY', text: 'Tengo una duda' }],
  },
  {
    name: 'aviso_vencida',
    body: 'Hola {{1}}, le escribimos para comentarle que la factura {{2}} por {{3}}, con vencimiento el {{4}}, sigue abierta en nuestros registros. Puede revisarla aquí: {{5}}. Si ya pagó, compártanos su comprobante para actualizarlo de inmediato.',
    bodyExample: ['Patricia Salas', 'F-2841', '$284,500.00 MXN', '17 de octubre', 'pagar.royaltica.com/f-2841'],
    buttons: [{ type: 'QUICK_REPLY', text: 'Ya pagué, comparto comprobante' }, { type: 'QUICK_REPLY', text: 'Necesito ayuda' }],
  },
  {
    name: 'seguimiento_vencida',
    body: 'Hola {{1}}, le escribimos para comentarle que seguimos con la factura {{2}} por {{3}} pendiente de cerrar. Nos gustaría saber si hay algo en lo que podamos apoyarle, o si prefiere que lo platiquemos directamente.',
    bodyExample: ['Patricia Salas', 'F-2841', '$284,500.00 MXN'],
    buttons: [{ type: 'QUICK_REPLY', text: 'Sí, platiquemos' }, { type: 'QUICK_REPLY', text: 'Ya voy a pagar' }],
  },
];

async function crear(waba: string, token: string, p: PlantillaDef) {
  const components: unknown[] = [
    {
      type: 'BODY',
      text: p.body,
      example: { body_text: [p.bodyExample] },
    },
  ];
  if (p.buttons) components.push({ type: 'BUTTONS', buttons: p.buttons });

  const res = await fetch(`https://graph.facebook.com/v21.0/${waba}/message_templates`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: p.name,
      language: 'es_MX',
      category: 'UTILITY',
      components,
    }),
    signal: AbortSignal.timeout(15000),
  });
  const data = (await res.json()) as { id?: string; status?: string; error?: { message?: string; error_user_msg?: string } };
  return { ok: res.ok, status: res.status, data };
}

async function main() {
  const waba = process.env.WHATSAPP_WABA_ID;
  const token = process.env.WHATSAPP_TOKEN;
  if (!waba || !token) {
    throw new Error('Faltan WHATSAPP_WABA_ID o WHATSAPP_TOKEN en .env');
  }

  console.log(`→ Subiendo ${PLANTILLAS.length} plantillas a la cuenta ${waba}...\n`);
  let ok = 0;
  for (const p of PLANTILLAS) {
    const r = await crear(waba, token, p);
    if (r.ok) {
      ok++;
      console.log(`✅ ${p.name} → enviada (id ${r.data.id}, estatus inicial: ${r.data.status ?? 'PENDING'})`);
    } else {
      console.log(`❌ ${p.name} → ${r.status}: ${r.data.error?.error_user_msg ?? r.data.error?.message ?? JSON.stringify(r.data)}`);
    }
  }
  console.log(`\n${ok}/${PLANTILLAS.length} enviadas a revisión. Revisa su estatus en Meta Business → Administrador de plantillas de mensajes.`);
}

main().catch((err) => {
  console.error('❌ Error:', err instanceof Error ? err.message : err);
  process.exit(1);
});
