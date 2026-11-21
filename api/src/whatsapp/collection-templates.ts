/**
 * Catálogo de plantillas de WhatsApp de cobranza (Meta, categoría UTILITY,
 * es_MX). ÚNICA fuente de verdad del texto, las variables y los botones:
 *  - scripts/create-whatsapp-templates.ts las sube a Meta para aprobación,
 *  - el motor de secuencias (CollectionSequencesService) y el envío manual
 *    (WhatsappConversationService) arman los parámetros posicionales,
 *  - la pantalla de Cobranza IA muestra el texto final en el hilo.
 *
 * Si cambias un texto aquí, hay que volver a someterlo a Meta: el nombre
 * aprobado y el cuerpo deben coincidir exactamente con lo registrado.
 */

/** Datos de la factura con los que se llenan las variables {{n}}. */
export interface TemplateVars {
  /** Contacto (finanzas/tesorería si existe, si no el general o el cliente). */
  contacto: string;
  folio: string;
  /** Monto ya formateado, ej. "$284,500.00 MXN". */
  monto: string;
  /** Fecha de vencimiento ya formateada, ej. "17 de octubre". */
  fecha: string;
  /** Liga de pago (portal de autoservicio del cliente). */
  liga: string;
  /**
   * Empresa que cobra (la organización cliente de Royáltica). Los mensajes
   * salen de un número de Royáltica, así que el texto debe decir de parte
   * de quién. Hoy solo la usan las plantillas por tipo de deudor.
   */
  empresa: string;
}

type VarKey = keyof TemplateVars;

export interface CollectionTemplate {
  name: string;
  /** Nivel/etapa del plan de cobranza al que corresponde. */
  level: 'N0' | 'N1' | 'N2' | 'N3' | 'N4' | 'A' | 'B';
  label: string;
  /** Días respecto al vencimiento del plan por defecto (negativo = antes). */
  defaultDaysAfterDue: number;
  /**
   * El texto menciona un día relativo ("vence en 3 días", "hoy vence"):
   * solo es cierto ESE día exacto, así que nunca se manda tarde (si ya pasó
   * su día, el motor lo salta en vez de mandar un dato falso).
   */
  exactDay: boolean;
  body: string;
  /** Orden de las variables posicionales {{1}}, {{2}}, ... */
  vars: VarKey[];
  buttons: string[];
}

export const COLLECTION_TEMPLATES: CollectionTemplate[] = [
  {
    // Nombre y texto EXACTOS de la plantilla aprobada en Meta (es_MX).
    name: 'royaltica_nivel_0',
    level: 'N0',
    label: 'Nivel 0 · Confirmación de factura',
    defaultDaysAfterDue: -90,
    exactDay: false,
    body: '¡Hola {{1}}! Esperamos que el día esté de maravilla. Queremos confirmar que recibió correctamente la factura {{2}} por {{3}}, con vencimiento el {{4}}. ¿Todo concuerda de su lado?',
    vars: ['contacto', 'folio', 'monto', 'fecha'],
    buttons: ['Todo en orden', 'Tengo una duda'],
  },
  {
    name: 'nivel_1',
    level: 'N1',
    label: 'Nivel 1 · Aviso preventivo (14 días antes)',
    defaultDaysAfterDue: -14,
    exactDay: false,
    body: '¡Hola {{1}}! Que tenga un excelente día. Le escribimos para avisarle que la factura {{2}} por {{3}} tiene como fecha de vencimiento el {{4}}. ¿La tiene ya en su radar? No hay ninguna prisa, solo queríamos comentárselo con tiempo.',
    vars: ['contacto', 'folio', 'monto', 'fecha'],
    buttons: [],
  },
  {
    name: 'nivel_2',
    level: 'N2',
    label: 'Nivel 2 · Recordatorio de cortesía (7 días antes)',
    defaultDaysAfterDue: -7,
    exactDay: false,
    body: '¡Hola {{1}}! Esperamos que se encuentre muy bien. Le escribimos para recordarle que la factura {{2}} por {{3}} vence el {{4}}. Puede revisarla y pagarla aquí si le es conveniente: {{5}}. ¿Hay algo que podamos aclararle mientras tanto?',
    vars: ['contacto', 'folio', 'monto', 'fecha', 'liga'],
    buttons: ['Todo claro', 'Tengo una pregunta'],
  },
  {
    name: 'nivel_3',
    level: 'N3',
    label: 'Nivel 3 · Vence en 3 días',
    defaultDaysAfterDue: -3,
    exactDay: true,
    body: '¡Hola {{1}}! Ojalá tenga un buen día por allá. Le escribimos para comentarle que la factura {{2}} por {{3}} vence en 3 días, el {{4}}. Puede revisarla aquí: {{5}}. Si ya quedó programada, con gusto la esperamos; si necesita más tiempo, también podemos platicarlo.',
    vars: ['contacto', 'folio', 'monto', 'fecha', 'liga'],
    buttons: ['Ya quedó programada', 'Me gustaría platicarlo'],
  },
  {
    name: 'nivel_4',
    level: 'N4',
    label: 'Nivel 4 · Vence hoy',
    defaultDaysAfterDue: 0,
    exactDay: true,
    body: '¡Hola {{1}}! Esperamos que su semana vaya muy bien. Le escribimos para avisarle que hoy vence la factura {{2}} por {{3}}. Puede liquidarla aquí: {{4}}. Si ya realizó su pago, compártanos su comprobante para dejarlo registrado al momento.',
    vars: ['contacto', 'folio', 'monto', 'liga'],
    buttons: ['Ya pagué, comparto comprobante', 'Tengo una duda'],
  },
  {
    name: 'aviso_vencida',
    level: 'A',
    label: 'Etapa A · Aviso (1 día después)',
    defaultDaysAfterDue: 1,
    exactDay: false,
    body: 'Hola {{1}}, le escribimos para comentarle que la factura {{2}} por {{3}}, con vencimiento el {{4}}, sigue abierta en nuestros registros. Puede revisarla aquí: {{5}}. Si ya pagó, compártanos su comprobante para actualizarlo de inmediato.',
    vars: ['contacto', 'folio', 'monto', 'fecha', 'liga'],
    buttons: ['Ya pagué, comparto comprobante', 'Necesito ayuda'],
  },
  {
    name: 'seguimiento_vencida',
    level: 'B',
    label: 'Etapa B · Seguimiento (7 días después)',
    defaultDaysAfterDue: 7,
    exactDay: false,
    body: 'Hola {{1}}, le escribimos para comentarle que seguimos con la factura {{2}} por {{3}} pendiente de cerrar. Nos gustaría saber si hay algo en lo que podamos apoyarle, o si prefiere que lo platiquemos directamente.',
    vars: ['contacto', 'folio', 'monto'],
    buttons: ['Sí, platiquemos', 'Ya voy a pagar'],
  },
];

export const TEMPLATE_NAMES = COLLECTION_TEMPLATES.map((t) => t.name);

export function findTemplate(name: string | null | undefined): CollectionTemplate | undefined {
  if (!name) return undefined;
  return COLLECTION_TEMPLATES.find((t) => t.name === name);
}

/** Parámetros posicionales en el orden que espera Meta. */
export function templateParams(t: CollectionTemplate, v: TemplateVars): string[] {
  return t.vars.map((k) => v[k]);
}

/** Texto final tal como lo verá el cliente (para guardarlo en el hilo). */
export function renderTemplateBody(t: CollectionTemplate, v: TemplateVars): string {
  const params = templateParams(t, v);
  return t.body.replace(/\{\{(\d+)\}\}/g, (_, n: string) => params[Number(n) - 1] ?? '');
}

/**
 * Botones cuya pulsación es una AFIRMACIÓN de pago (se avisa al equipo
 * para validarla contra el banco; nunca marca la factura como pagada).
 * Mapa explícito en vez de palabras clave: "Ya quedó programada" o "Ya voy
 * a pagar" son promesas, no pagos.
 */
export const PAYMENT_CLAIM_BUTTONS = new Set(['Ya pagué, comparto comprobante']);

// ── Plantillas por tipo de deudor (piloto) ─────────────────────────────
// Dos por cada uno de los 5 tipos del piloto: aviso previo y primera
// vencida. Categoría UTILITY: una factura concreta, sin ofertas, sin
// urgencia ni consecuencias. TODAVÍA NO SE ENVÍAN: primero hay que
// someterlas a Meta (scripts/create-whatsapp-templates.ts --tipos) y que el
// motor elija plantilla según el tipo de deudor del cliente (pendiente, ese
// dato aún no vive en la base). Detalle en docs/cobranza-ia/plantillas-por-tipo-deudor.md.

/** Identificador estable del tipo de deudor (el mismo que usa el frontend). */
export type DebtorTypeId =
  | 'burocratico-b2b'
  | 'desorganizado-b2b'
  | 'priorizador-b2b'
  | 'intencional-b2b'
  | 'disputador-b2b';

export interface DebtorTypeTemplate {
  name: string;
  debtorType: DebtorTypeId;
  /** previo = antes de la fecha de pago · vencida = primer contacto ya vencida. */
  stage: 'previo' | 'vencida';
  body: string;
  vars: VarKey[];
  buttons: string[];
}

const BASE: VarKey[] = ['contacto', 'empresa', 'folio', 'monto', 'fecha'];

export const DEBTOR_TYPE_TEMPLATES: DebtorTypeTemplate[] = [
  {
    name: 'tipo_burocratico_previo',
    debtorType: 'burocratico-b2b',
    stage: 'previo',
    body: 'Hola {{1}}, de parte de {{2}}. Para que la factura {{3}} por {{4}}, con fecha de pago el {{5}}, avance sin contratiempos, ¿nos confirma si ya cuenta con la orden de compra, el contrarrecibo y los documentos que necesitan? Si falta algo, lo enviamos hoy.',
    vars: BASE,
    buttons: ['Todo completo', 'Falta un documento'],
  },
  {
    name: 'tipo_burocratico_vencida',
    debtorType: 'burocratico-b2b',
    stage: 'vencida',
    body: 'Hola {{1}}, de parte de {{2}}. Queremos dar seguimiento a la factura {{3}} por {{4}}, con fecha de pago el {{5}}. ¿En qué paso de su proceso de pago se encuentra y quién la tiene? Si falta algún documento, se lo enviamos de inmediato.',
    vars: BASE,
    buttons: ['Ya está autorizada', 'Falta un documento'],
  },
  {
    name: 'tipo_desorganizado_previo',
    debtorType: 'desorganizado-b2b',
    stage: 'previo',
    body: 'Hola {{1}}, de parte de {{2}}. Le adelantamos su estado de cuenta: la factura {{3}} por {{4}} tiene como fecha de pago el {{5}}. Aquí puede revisarla: {{6}}. Gracias.',
    vars: [...BASE, 'liga'],
    buttons: ['Recibido', 'Tengo una duda'],
  },
  {
    name: 'tipo_desorganizado_vencida',
    debtorType: 'desorganizado-b2b',
    stage: 'vencida',
    body: 'Hola {{1}}, de parte de {{2}}. Por si le sirve para su control, le compartimos el detalle de la factura {{3}} por {{4}}, con fecha de pago el {{5}}: {{6}}. ¿Le ayuda si coordinamos una fecha de pago?',
    vars: [...BASE, 'liga'],
    buttons: ['Ya pagué, comparto comprobante', 'Coordinemos una fecha'],
  },
  {
    name: 'tipo_priorizador_previo',
    debtorType: 'priorizador-b2b',
    stage: 'previo',
    body: 'Hola {{1}}, de parte de {{2}}. Con tiempo le comentamos que la factura {{3}} por {{4}} tiene como fecha de pago el {{5}}. Si prefiere dejar un calendario de pagos desde ahora, con gusto lo revisamos. ¿Qué le funcionaría?',
    vars: BASE,
    buttons: ['Está programada', 'Prefiero un calendario'],
  },
  {
    name: 'tipo_priorizador_vencida',
    debtorType: 'priorizador-b2b',
    stage: 'vencida',
    body: 'Hola {{1}}, de parte de {{2}}. Sobre la factura {{3}} por {{4}}, con fecha de pago el {{5}}: sabemos que hay varios compromisos. Si nos comparte cuándo podría quedar lista, la dejamos agendada. ¿Qué fecha le acomoda?',
    vars: BASE,
    buttons: ['Les comparto una fecha', 'Platiquemos'],
  },
  {
    name: 'tipo_intencional_previo',
    debtorType: 'intencional-b2b',
    stage: 'previo',
    body: 'Hola {{1}}, de parte de {{2}}. Le recordamos con tiempo que la factura {{3}} por {{4}} tiene como fecha de pago el {{5}}. ¿Nos confirma que está programada para esa fecha?',
    vars: BASE,
    buttons: ['Sí, está programada', 'Tengo una duda'],
  },
  {
    name: 'tipo_intencional_vencida',
    debtorType: 'intencional-b2b',
    stage: 'vencida',
    body: 'Hola {{1}}, de parte de {{2}}. Le escribimos por la factura {{3}} por {{4}}, con fecha de pago el {{5}}. ¿Nos confirma la fecha en que quedará lista? Con ese dato actualizamos su cuenta en nuestros registros.',
    vars: BASE,
    buttons: ['Les comparto la fecha', 'Ya pagué, comparto comprobante'],
  },
  {
    name: 'tipo_disputador_previo',
    debtorType: 'disputador-b2b',
    stage: 'previo',
    body: 'Hola {{1}}, de parte de {{2}}. Si hay alguna diferencia por aclarar en la factura {{3}} por {{4}}, con fecha de pago el {{5}}, avísenos con tiempo y la revisamos antes de esa fecha. ¿Todo en orden?',
    vars: BASE,
    buttons: ['Todo en orden', 'Hay una diferencia'],
  },
  {
    name: 'tipo_disputador_vencida',
    debtorType: 'disputador-b2b',
    stage: 'vencida',
    body: 'Hola {{1}}, de parte de {{2}}. Sobre la factura {{3}} por {{4}}: entendemos que puede haber una diferencia por aclarar. ¿Nos comparte el detalle (cantidad, precio o producto) para revisarlo hoy?',
    vars: ['contacto', 'empresa', 'folio', 'monto'],
    buttons: ['Les mando el detalle', 'Ya está aclarado'],
  },
];
