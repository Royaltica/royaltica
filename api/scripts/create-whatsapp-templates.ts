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

import { COLLECTION_TEMPLATES } from '../src/whatsapp/collection-templates';

/** Valores de ejemplo que Meta exige para aprobar cada variable. */
const EJEMPLO = {
  contacto: 'Patricia Salas',
  folio: 'F-2841',
  monto: '$284,500.00 MXN',
  fecha: '17 de octubre',
  liga: 'pagar.royaltica.com/f-2841',
} as const;

interface PlantillaDef {
  name: string;
  body: string;
  bodyExample: string[];
  buttons?: { type: 'QUICK_REPLY'; text: string }[];
}

// Una sola fuente de verdad: src/whatsapp/collection-templates.ts (la usan
// también el motor de secuencias y la pantalla de Cobranza IA).
const PLANTILLAS: PlantillaDef[] = COLLECTION_TEMPLATES.map((t) => ({
  name: t.name,
  body: t.body,
  bodyExample: t.vars.map((k) => EJEMPLO[k]),
  buttons: t.buttons.length
    ? t.buttons.map((text) => ({ type: 'QUICK_REPLY' as const, text }))
    : undefined,
}));

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
