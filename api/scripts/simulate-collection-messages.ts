/**
 * Simulación de mensajes de cobranza (ROY-33): genera mensajes para una
 * "mini base de datos" de clientes con distinto historial de pago, y
 * verifica que el tono se adapte al riesgo y que el guardrail de
 * contenido no marque nada prohibido.
 *
 * No toca la base de datos real (ni local ni producción) — todo corre en
 * memoria, así que es seguro ejecutarlo en cualquier lado:
 *
 *   npx ts-node scripts/simulate-collection-messages.ts
 *
 * Cuando Vertex AI esté activo (VERTEX_PROJECT_ID + VERTEX_KEY_JSON en
 * Railway) y `CollectionPolicy.aiDecisionEnabled` esté prendido, el tono
 * real lo decide Gemini según el riesgo (ver
 * CollectionSequencesAiDecisionService) en vez del mapeo fijo de este
 * script — esto es la versión determinista para verificar que el
 * render + los guardrails funcionan ANTES de conectar la IA.
 */
import { CallGuardrailsService } from '../src/calls/call-guardrails.service';
import { renderMessageTemplate } from '../src/common/message-template.util';

type Tone = 'GENTLE' | 'STANDARD' | 'FIRM' | 'URGENT';

interface SimulatedCustomer {
  id: string;
  name: string;
  paymentHistory: string;
  amount: number;
  dueDate: string;
  daysOverdue: number;
}

/** "Mini base de datos" simulada: 10 perfiles de cliente con historial distinto (ROY-33). */
const SIMULATED_CUSTOMERS: SimulatedCustomer[] = [
  {
    id: 'sim-1',
    name: 'Distribuidora del Norte',
    paymentHistory: 'Buen historial: paga puntual en 9 de las últimas 10 facturas.',
    amount: 42_500,
    dueDate: '2026-08-20',
    daysOverdue: 4,
  },
  {
    id: 'sim-2',
    name: 'Ferretería Cabrera Hnos.',
    paymentHistory: 'Excelente historial: nunca ha tenido un atraso >5 días.',
    amount: 18_900,
    dueDate: '2026-08-22',
    daysOverdue: 2,
  },
  {
    id: 'sim-3',
    name: 'Comercializadora Reyes',
    paymentHistory: 'Historial mixto: paga, pero casi siempre 15-25 días tarde.',
    amount: 118_300,
    dueDate: '2026-07-28',
    daysOverdue: 27,
  },
  {
    id: 'sim-4',
    name: 'Textiles Monarca S.A.',
    paymentHistory: 'Historial mixto: primer atraso relevante tras 2 años puntual.',
    amount: 76_200,
    dueDate: '2026-08-05',
    daysOverdue: 19,
  },
  {
    id: 'sim-5',
    name: 'Refaccionaria El Tornillo',
    paymentHistory: 'Cliente nuevo (3 facturas): dos puntuales, una con atraso leve.',
    amount: 9_450,
    dueDate: '2026-08-15',
    daysOverdue: 9,
  },
  {
    id: 'sim-6',
    name: 'Grupo Industrial Palma',
    paymentHistory: 'Historial de atraso recurrente: 3 facturas anteriores vencidas >45 días.',
    amount: 265_900,
    dueDate: '2026-06-10',
    daysOverdue: 75,
  },
  {
    id: 'sim-7',
    name: 'Consultores Delta',
    paymentHistory: 'Historial de atraso recurrente: relación de bajo volumen, alto atraso.',
    amount: 31_000,
    dueDate: '2026-06-25',
    daysOverdue: 60,
  },
  {
    id: 'sim-8',
    name: 'Maquinados y Procesos SA',
    paymentHistory: 'Buen historial general, pero saldo actual es el más alto que ha tenido.',
    amount: 412_750,
    dueDate: '2026-08-10',
    daysOverdue: 14,
  },
  {
    id: 'sim-9',
    name: 'Panificadora Santa Cruz',
    paymentHistory: 'Historial mixto: atrasos de 20-30 días son su patrón normal.',
    amount: 54_800,
    dueDate: '2026-07-20',
    daysOverdue: 35,
  },
  {
    id: 'sim-10',
    name: 'Constructora Vega y Asociados',
    paymentHistory: 'Historial de atraso recurrente: cuenta ya en seguimiento por cobranza previa.',
    amount: 890_300,
    dueDate: '2026-05-15',
    daysOverdue: 101,
  },
];

/**
 * Política de cobranza simulada (mismo shape/valores típicos que
 * CollectionPolicy) — el mapeo días de atraso -> tono/canal es el mismo
 * criterio que usaría una CollectionSequenceStep real.
 */
const ESCALATION_THRESHOLD_DAYS = 60;

const TEMPLATES: Record<Tone, string> = {
  GENTLE:
    'Hola {{customerName}}, te compartimos un recordatorio amistoso: tienes ' +
    'un saldo de {{amount}} con vencimiento {{dueDate}} ({{daysOverdue}} ' +
    'día(s) de atraso). Si ya realizaste el pago, ignora este mensaje — si ' +
    'no, cualquier duda con gusto te apoyamos.',
  STANDARD:
    'Hola {{customerName}}, tu factura por {{amount}} venció el {{dueDate}} ' +
    'y lleva {{daysOverdue}} días de atraso. Te pedimos regularizar el pago ' +
    'a la brevedad o contactarnos si necesitas acordar una fecha.',
  FIRM:
    'Estimado {{customerName}}, tu adeudo de {{amount}} sigue pendiente ' +
    '{{daysOverdue}} días después de su vencimiento ({{dueDate}}). Es ' +
    'importante regularizarlo esta semana para evitar afectar tu historial ' +
    'crediticio con nosotros. Contáctanos para revisar opciones de pago.',
  URGENT:
    'Estimado {{customerName}}, tu adeudo de {{amount}}, vencido desde ' +
    '{{dueDate}} ({{daysOverdue}} días), requiere atención inmediata. Un ' +
    'representante de Royáltica se pondrá en contacto contigo para resolverlo.',
};

function toneForDaysOverdue(daysOverdue: number): Tone {
  if (daysOverdue < 10) return 'GENTLE';
  if (daysOverdue < 30) return 'STANDARD';
  if (daysOverdue < ESCALATION_THRESHOLD_DAYS) return 'FIRM';
  return 'URGENT';
}

function money(n: number): string {
  return n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
}

async function main(): Promise<void> {
  // CallGuardrailsService normalmente recibe PrismaService/ActivityLogService
  // por DI; aquí solo se usa screenAgentText(), que es puro (no toca DB), así
  // que se instancia con stubs.
  const guardrails = new CallGuardrailsService(
    {} as never,
    {} as never,
  );

  const lines: string[] = [];
  const log = (s = '') => {
    lines.push(s);
    console.log(s);
  };

  log('# Simulación de mensajes de cobranza (ROY-33)\n');
  log(`Generado: ${new Date().toISOString()}\n`);
  log(
    `Umbral de escalación a humano: ${ESCALATION_THRESHOLD_DAYS} días de atraso.\n`,
  );

  for (const customer of SIMULATED_CUSTOMERS) {
    const escalates = customer.daysOverdue >= ESCALATION_THRESHOLD_DAYS;
    const tone = toneForDaysOverdue(customer.daysOverdue);

    log(`## ${customer.name} (${customer.id})`);
    log(`- Historial: ${customer.paymentHistory}`);
    log(`- Saldo: ${money(customer.amount)} | Vencida: ${customer.dueDate} | Atraso: ${customer.daysOverdue} días`);
    log(`- Tono asignado: **${tone}**${escalates ? ' → ESCALA A HUMANO (no se envía mensaje automático)' : ''}`);

    if (escalates) {
      log('');
      continue;
    }

    const message = renderMessageTemplate(TEMPLATES[tone], {
      customerName: customer.name,
      amount: money(customer.amount),
      dueDate: customer.dueDate,
      daysOverdue: customer.daysOverdue,
    });

    const screen = guardrails.screenAgentText(message);

    log(`- Guardrail de contenido: ${screen.safe ? '✅ sin frases prohibidas' : `❌ FLAGGED: ${screen.flaggedPhrases.join(', ')}`}`);
    log('- Mensaje generado:');
    log('  > ' + message.replace(/\n/g, '\n  > '));
    log('');
  }

  log('---');
  log(
    'Nota: el tono aquí se asigna con un mapeo determinista por días de ' +
      'atraso (mismo criterio que una CollectionSequenceStep real). Con ' +
      'Vertex AI activo y `aiDecisionEnabled=true` en la CollectionPolicy, ' +
      'este paso lo decide Gemini considerando también el historial de pago ' +
      'completo del cliente (CollectionSequencesAiDecisionService), no solo ' +
      'los días de atraso.',
  );

  const allSafe = SIMULATED_CUSTOMERS.every((c) => {
    if (c.daysOverdue >= ESCALATION_THRESHOLD_DAYS) return true;
    const tone = toneForDaysOverdue(c.daysOverdue);
    const message = renderMessageTemplate(TEMPLATES[tone], {
      customerName: c.name,
      amount: money(c.amount),
      dueDate: c.dueDate,
      daysOverdue: c.daysOverdue,
    });
    return guardrails.screenAgentText(message).safe;
  });

  if (!allSafe) {
    console.error('\n⚠️  Al menos un mensaje simulado disparó el guardrail de contenido.');
    process.exitCode = 1;
  }

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const fs = require('node:fs');
  fs.writeFileSync(__dirname + '/output-simulacion-mensajes.md', lines.join('\n'));

  // Salida estructurada (JSON) para graficar/comparar resultados (ROY-33,
  // punto 2 de José): un registro por cliente con lo que un dashboard o
  // gráfica necesitaría, sin tener que re-parsear el markdown.
  const summary = SIMULATED_CUSTOMERS.map((c) => {
    const escalates = c.daysOverdue >= ESCALATION_THRESHOLD_DAYS;
    const tone = toneForDaysOverdue(c.daysOverdue);
    let guardrailSafe = true;
    if (!escalates) {
      const message = renderMessageTemplate(TEMPLATES[tone], {
        customerName: c.name,
        amount: money(c.amount),
        dueDate: c.dueDate,
        daysOverdue: c.daysOverdue,
      });
      guardrailSafe = guardrails.screenAgentText(message).safe;
    }
    return {
      id: c.id,
      name: c.name,
      paymentHistory: c.paymentHistory,
      amount: c.amount,
      dueDate: c.dueDate,
      daysOverdue: c.daysOverdue,
      tone,
      escalatesToHuman: escalates,
      guardrailSafe,
    };
  });
  fs.writeFileSync(
    __dirname + '/output-simulacion-mensajes.json',
    JSON.stringify(
      { generatedAt: new Date().toISOString(), escalationThresholdDays: ESCALATION_THRESHOLD_DAYS, customers: summary },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
