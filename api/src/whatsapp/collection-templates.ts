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
