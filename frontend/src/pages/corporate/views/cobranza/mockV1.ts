// Datos de ejemplo de Cobranza IA. UNA sola cartera (CARTERA) es la fuente
// de verdad: bloques, asignaciones, contactos, equipo, lista del agente,
// planes y reportes se derivan de aquí para que los 3 perfiles cuadren.
// Reemplazar por el API cuando exista el backend del Módulo 2.

export const HOY = '2026-09-28';

export const AGENTES = ['María Jiménez', 'Carlos Mendoza', 'Ana Robles'] as const;
export type Agente = (typeof AGENTES)[number];

export const LINEAS = ['Materiales', 'Servicios', 'Logística'] as const;
export type Linea = (typeof LINEAS)[number];

export type PasoId = 'N0' | 'N1' | 'N2' | 'N3' | 'N4' | 'A' | 'B' | 'C' | 'D';
export type Resultados = Partial<Record<PasoId, string>>;
export type Segmento = 'puntual' | 'tardio' | 'olvidadizo' | 'deterioro' | 'moroso' | 'disputa' | 'nuevo';
export type CanalPreferido = 'WhatsApp' | 'Correo';

/** Configuración del plan de un cliente (ver plan.tsx → construirPlan). */
export type PlanConfig = {
  hoy: number; // días respecto al vencimiento (negativo = faltan)
  canal: CanalPreferido;
  segmento: Segmento;
  desfase: number; // días promedio de atraso (lo usa el segmento "tardío")
  cuentaGrande: boolean;
  aclaraciones: boolean;
  resultados: Resultados;
};

export type Factura = {
  folio: string;
  monto: number;
  emision: string;
  vence: string;
  dias: number; // respecto al vencimiento (negativo = faltan)
  planInicio: string | null;
};

export type CuentaCartera = {
  id: string;
  cliente: string;
  folio: string;
  monto: number;
  pagado: number;
  dias: number;
  vence: string;
  agente: Agente;
  linea: Linea;
  registrado: string; // dueño/director que sí está en la base
  finanzas: { nombre: string; puesto: string; telefono: string } | null;
  ciudad: string;
  zona: string;
  horaLocal: string;
  contactable: boolean;
  motivo?: string;
  promesa?: boolean; // promesa de pago vigente
  disputa?: boolean;
  canal: CanalPreferido;
  cuentaGrande?: boolean; // tono formal, correo con estado de cuenta
  aclaraciones?: boolean; // ha tenido aclaraciones de factura
  /** Factura en cobro: cuándo se emitió y cuándo arrancó su plan. */
  emision: string;
  planInicio: string;
  /** Otras facturas del cliente que todavía no tienen plan de cobranza. */
  facturasExtra?: Factura[];
  /** Campañas especiales (con descuento) en las que terminó pagando. */
  campanasPagadas?: string[];
  /** Veces que su cobranza terminó en negociación de un plan de pagos. */
  negociaciones?: number;
  /** Días de atraso de sus últimas 12 facturas pagadas (negativo = pagó antes). */
  historial: number[];
  promesas: { cumplidas: number; rotas: number };
  resultados: Resultados;
};

export const CARTERA: CuentaCartera[] = [
  {
    id: 'k01', cliente: 'Distribuidora del Norte', folio: 'F-2841', monto: 284_500, pagado: 85_350, dias: 42, vence: '17 ago',
    agente: 'María Jiménez', linea: 'Materiales', registrado: 'Lic. Arturo Garza · Director general',
    finanzas: { nombre: 'Patricia Salas', puesto: 'Tesorería', telefono: '81 2231 0045' },
    ciudad: 'Monterrey', zona: 'UTC-6', horaLocal: '11:20', contactable: true, canal: 'WhatsApp',
    emision: '18 jul', planInicio: '18 jul', facturasExtra: [{ folio: 'F-2968', monto: 96_000, emision: '25 sep', vence: '25 oct', dias: -27, planInicio: null }], campanasPagadas: ['Buen Fin 2025'], negociaciones: 1, 
    historial: [0, -2, 0, 1, 0, 0, 3, 0, 0, 12, 18, 25], promesas: { cumplidas: 3, rotas: 1 },
    resultados: { N0: 'Confirmó factura', N1: 'Sin respuesta', N2: 'Respondió', N3: 'Sin respuesta', N4: 'Sin respuesta', A: 'Respondió', B: 'Prometió fecha', C: 'Sin respuesta' },
  },
  {
    id: 'k02', cliente: 'Materiales Peninsulares', folio: 'F-2903', monto: 156_200, pagado: 78_100, dias: 28, vence: '31 ago',
    agente: 'Ana Robles', linea: 'Materiales', registrado: 'Sr. Manuel Poot · Dueño',
    finanzas: { nombre: 'Jorge Canché', puesto: 'Cuentas por pagar', telefono: '999 214 7730' },
    ciudad: 'Mérida', zona: 'UTC-6', horaLocal: '11:20', contactable: true, canal: 'Correo',
    emision: '1 ago', planInicio: '1 ago', 
    historial: [0, 0, -1, 0, 0, 0, 0, -2, 0, 0, 9, 16], promesas: { cumplidas: 2, rotas: 0 },
    resultados: { N0: 'Confirmó factura', N1: 'Respondió', N2: 'Sin respuesta', N3: 'Respondió', N4: 'Sin respuesta', A: 'Sin respuesta', B: 'Respondió' },
  },
  {
    id: 'k03', cliente: 'Grupo Ferretero Bajío', folio: 'F-2877', monto: 98_400, pagado: 0, dias: 35, vence: '24 ago',
    agente: 'Carlos Mendoza', linea: 'Materiales', registrado: 'Ing. Raúl Bravo · Director general', finanzas: null,
    ciudad: 'León', zona: 'UTC-6', horaLocal: '11:20', contactable: true, aclaraciones: true, canal: 'WhatsApp',
    emision: '25 jul', planInicio: '25 jul', campanasPagadas: ['Buen Fin 2025'], negociaciones: 1, 
    historial: [0, -2, 0, -1, 0, 2, -3, 0, -1, 8, 14, 21], promesas: { cumplidas: 1, rotas: 1 },
    resultados: { N0: 'Aclaró factura', N1: 'Sin respuesta', N2: 'Sin respuesta', N3: 'Sin respuesta', N4: 'Sin respuesta', A: 'Sin respuesta', B: 'Sin respuesta', C: 'Sin respuesta' },
  },
  {
    id: 'k04', cliente: 'Logística Andrade', folio: 'F-2915', monto: 62_800, pagado: 47_100, dias: 12, vence: '16 sep',
    agente: 'Ana Robles', linea: 'Logística', registrado: 'Sr. Tomás Andrade · Dueño',
    finanzas: { nombre: 'Rocío Andrade', puesto: 'Tesorería', telefono: '33 1845 2290' },
    ciudad: 'Guadalajara', zona: 'UTC-6', horaLocal: '11:20', contactable: true, canal: 'WhatsApp',
    emision: '17 ago', planInicio: '17 ago', 
    historial: [14, 15, 13, 16, 15, 14, 15, 16, 14, 15, 13, 15], promesas: { cumplidas: 4, rotas: 0 },
    resultados: { N0: 'Confirmó factura', N3: 'Respondió', N4: 'Pagó parcial' },
  },
  {
    id: 'k05', cliente: 'Constructora Vanguardia', folio: 'F-2860', monto: 412_000, pagado: 123_600, dias: 19, vence: '9 sep',
    agente: 'María Jiménez', linea: 'Servicios', registrado: 'Arq. Elena Duarte · Directora', finanzas: null,
    ciudad: 'CDMX', zona: 'UTC-6', horaLocal: '11:20', contactable: true, cuentaGrande: true, canal: 'Correo',
    emision: '10 ago', planInicio: '10 ago', facturasExtra: [{ folio: 'F-2974', monto: 150_000, emision: '26 sep', vence: '26 oct', dias: -28, planInicio: null }], 
    historial: [0, 0, 2, 0, 5, 0, 0, 3, 0, 0, 4, 0], promesas: { cumplidas: 2, rotas: 0 },
    resultados: { N0: 'Confirmó factura', N1: 'Respondió', N2: 'Sin respuesta', N3: 'Sin respuesta', N4: 'Sin respuesta', A: 'Sin respuesta', B: 'Turnado a finanzas' },
  },
  {
    id: 'k06', cliente: 'Comercializadora Lumen', folio: 'F-2951', monto: 74_300, pagado: 0, dias: -5, vence: '3 oct',
    agente: 'Carlos Mendoza', linea: 'Servicios', registrado: 'Lic. Pablo Ortiz · Director',
    finanzas: { nombre: 'Daniela Ortiz', puesto: 'Finanzas', telefono: '55 4410 8812' },
    ciudad: 'CDMX', zona: 'UTC-6', horaLocal: '11:20', contactable: true, canal: 'WhatsApp',
    emision: '3 sep', planInicio: '3 sep', 
    historial: [], promesas: { cumplidas: 0, rotas: 0 },
    resultados: { N0: 'Confirmó factura', N1: 'Sin respuesta', N2: 'Respondió' },
  },
  {
    id: 'k07', cliente: 'Transportes del Pacífico', folio: 'F-2934', monto: 126_300, pagado: 0, dias: 7, vence: '21 sep',
    agente: 'Ana Robles', linea: 'Logística', registrado: 'Sr. Ernesto Ruiz · Dueño',
    finanzas: { nombre: 'Héctor Ruiz', puesto: 'Tesorería', telefono: '669 118 4402' },
    ciudad: 'Mazatlán', zona: 'UTC-7', horaLocal: '10:20', contactable: true, canal: 'WhatsApp',
    emision: '22 ago', planInicio: '22 ago', facturasExtra: [{ folio: 'F-2971', monto: 41_800, emision: '27 sep', vence: '27 oct', dias: -29, planInicio: null }], 
    historial: [0, 3, 0, 5, 0, 2, 0, 4, 0, 1, 0, 6], promesas: { cumplidas: 2, rotas: 0 },
    resultados: { N0: 'Confirmó factura', N1: 'Sin respuesta', N2: 'Sin respuesta', N3: 'Sin respuesta', N4: 'Sin respuesta', A: 'Pidió aclaración' },
  },
  {
    id: 'k08', cliente: 'Refaccionaria Occidente', folio: 'F-2958', monto: 44_900, pagado: 0, dias: -3, vence: '1 oct',
    agente: 'Ana Robles', linea: 'Materiales', registrado: 'Sr. Luis Méndez · Dueño',
    finanzas: { nombre: 'Laura Méndez', puesto: 'Finanzas', telefono: '33 3627 1190' },
    ciudad: 'Guadalajara', zona: 'UTC-6', horaLocal: '11:20', contactable: true, canal: 'WhatsApp',
    emision: '1 sep', planInicio: '1 sep', facturasExtra: [{ folio: 'F-2966', monto: 22_400, emision: '15 sep', vence: '15 oct', dias: -17, planInicio: null }], 
    historial: [0, -1, 0, 0, -3, 0, 0, 0, -2, 0, 0, 0], promesas: { cumplidas: 0, rotas: 0 },
    resultados: { N0: 'Confirmó factura' },
  },
  {
    id: 'k09', cliente: 'Distribuidora Baja', folio: 'F-2947', monto: 58_000, pagado: 0, dias: 1, vence: '27 sep',
    agente: 'Ana Robles', linea: 'Logística', registrado: 'Lic. Sergio Castro · Director',
    finanzas: { nombre: 'Iván Castro', puesto: 'Tesorería', telefono: '664 902 3318' },
    ciudad: 'Tijuana', zona: 'UTC-8', horaLocal: '8:20', contactable: false, motivo: 'Fuera de horario · se puede desde las 9:00',
    canal: 'WhatsApp',
    emision: '28 ago', planInicio: '28 ago', 
    historial: [2, 0, 6, 0, 3, 0, 0, 5, 0, 4, 0, 2], promesas: { cumplidas: 1, rotas: 0 },
    resultados: { N0: 'Confirmó factura', N1: 'Sin respuesta', N2: 'Sin respuesta', N3: 'Sin respuesta', N4: 'Sin respuesta' },
  },
  {
    id: 'k10', cliente: 'Grupo Textil Aurora', folio: 'F-2921', monto: 91_200, pagado: 0, dias: 18, vence: '10 sep',
    agente: 'Ana Robles', linea: 'Servicios', registrado: 'Sra. Carmen Leal · Directora',
    finanzas: { nombre: 'Mónica Leal', puesto: 'Finanzas', telefono: '222 581 7764' },
    ciudad: 'Puebla', zona: 'UTC-6', horaLocal: '11:20', contactable: false, motivo: 'Promesa de pago vigente hasta el 30 sep', promesa: true,
    canal: 'WhatsApp',
    emision: '11 ago', planInicio: '11 ago', campanasPagadas: ['Buen Fin 2024', 'Buen Fin 2025'], 
    historial: [8, 10, 7, 9, 12, 8, 10, 9, 11, 8, 10, 9], promesas: { cumplidas: 5, rotas: 0 },
    resultados: { N0: 'Confirmó factura', N1: 'Sin respuesta', N2: 'Sin respuesta', N3: 'Sin respuesta', N4: 'Sin respuesta', A: 'Sin respuesta', B: 'Prometió pagar el 30 sep' },
  },
  {
    id: 'k11', cliente: 'Papelera Industrial Sur', folio: 'F-2962', monto: 38_600, pagado: 0, dias: -10, vence: '8 oct',
    agente: 'María Jiménez', linea: 'Materiales', registrado: 'Ing. Óscar Pech · Director',
    finanzas: { nombre: 'Karla Pech', puesto: 'Tesorería', telefono: '999 330 1187' },
    ciudad: 'Mérida', zona: 'UTC-6', horaLocal: '11:20', contactable: true, canal: 'Correo',
    emision: '8 sep', planInicio: '8 sep', 
    historial: [0, 0, 0, -1, 0, 0, 0, 0, 0, -2, 0, 0], promesas: { cumplidas: 0, rotas: 0 },
    resultados: { N0: 'Confirmó factura' },
  },
  {
    id: 'k12', cliente: 'Agroinsumos del Valle', folio: 'F-2790', monto: 67_800, pagado: 0, dias: 74, vence: '16 jul',
    agente: 'Carlos Mendoza', linea: 'Materiales', registrado: 'Ing. Sofía Treviño · Directora',
    finanzas: { nombre: 'Rubén Treviño', puesto: 'Tesorería', telefono: '662 219 5540' },
    ciudad: 'Hermosillo', zona: 'UTC-7', horaLocal: '10:20', contactable: true, canal: 'WhatsApp',
    emision: '16 jun', planInicio: '16 jun', campanasPagadas: ['Cierre de año 2024', 'Buen Fin 2025'], negociaciones: 2, 
    historial: [20, 25, 31, 18, 40, 35, 28, 45, 50, 38, 42, 55], promesas: { cumplidas: 1, rotas: 3 },
    resultados: { N0: 'Sin respuesta', N1: 'Sin respuesta', N2: 'Sin respuesta', N3: 'Sin respuesta', N4: 'Sin respuesta', A: 'Sin respuesta', B: 'Sin respuesta', C: 'Sin respuesta', D: 'No contestó' },
  },
  {
    id: 'k13', cliente: 'Herrajes Monterrey', folio: 'F-2655', monto: 83_500, pagado: 20_000, dias: 140, vence: '10 may',
    agente: 'María Jiménez', linea: 'Materiales', registrado: 'Sr. Jaime Ríos · Dueño',
    finanzas: { nombre: 'Norma Ríos', puesto: 'Tesorería', telefono: '81 8340 2201' },
    ciudad: 'Monterrey', zona: 'UTC-6', horaLocal: '11:20', contactable: true, canal: 'WhatsApp',
    emision: '10 abr', planInicio: '10 abr', campanasPagadas: ['Buen Fin 2024', 'Cierre de año 2024', 'Buen Fin 2025'], negociaciones: 3, 
    historial: [5, 12, 20, 30, 25, 40, 35, 60, 45, 80, 90, 120], promesas: { cumplidas: 1, rotas: 2 },
    resultados: { N0: 'Confirmó factura', N1: 'Sin respuesta', N2: 'Sin respuesta', N3: 'Sin respuesta', N4: 'Sin respuesta', A: 'Sin respuesta', B: 'Respondió', C: 'Sin respuesta', D: 'Plan de pagos incumplido' },
  },
  {
    id: 'k14', cliente: 'Constructora Río Bravo', folio: 'F-2480', monto: 143_800, pagado: 0, dias: 320, vence: '12 nov 2025',
    agente: 'Carlos Mendoza', linea: 'Servicios', registrado: 'Ing. Hugo Salinas · Director',
    finanzas: { nombre: 'Beatriz Salinas', puesto: 'Finanzas', telefono: '868 812 4410' },
    ciudad: 'Matamoros', zona: 'UTC-6', horaLocal: '11:20', contactable: true, disputa: true, cuentaGrande: true, canal: 'Correo',
    emision: '13 oct 2025', planInicio: '13 oct 2025', negociaciones: 2, 
    historial: [0, 5, 0, 10, 0, 8, 15, 0, 22, 30, 0, 40], promesas: { cumplidas: 1, rotas: 1 },
    resultados: { N0: 'Confirmó factura', N1: 'Sin respuesta', N2: 'Sin respuesta', N3: 'Sin respuesta', N4: 'Sin respuesta', A: 'Sin respuesta', B: 'Sin respuesta', C: 'Sin respuesta', D: 'Disputa abierta' },
  },
];

export const saldoDe = (c: CuentaCartera) => c.monto - c.pagado;

// ── Segmentación por comportamiento de pago ────────────────────────────
// Reglas deterministas y explicables (no caja negra), en este orden:
//  nuevo → disputa → moroso → en deterioro → puntual → tardío → olvidadizo

export const SEGMENTOS: Record<Segmento, { nombre: string; chip: string; punto: string; trato: string; calendario: string; tono: string }> = {
  puntual: { nombre: 'Puntual', chip: 'bg-emerald-50 text-emerald-700 border-emerald-200', punto: 'bg-emerald-500', trato: 'Solo aviso de factura y del día de vencimiento. Tono cordial, agradecimiento al pagar y opción de descuento por pronto pago.', calendario: 'Solo niveles 0 y 4', tono: 'Cordial' },
  tardio: { nombre: 'Tardío predecible', chip: 'bg-sky-50 text-sky-700 border-sky-200', punto: 'bg-sky-500', trato: 'Siempre paga, pero tarde. El plan se corre según su patrón para no escalar antes de tiempo. Tono suave.', calendario: 'Etapas corridas por su patrón', tono: 'Suave' },
  olvidadizo: { nombre: 'Olvidadizo', chip: 'bg-amber-50 text-amber-700 border-amber-200', punto: 'bg-amber-400', trato: 'Paga cuando se le recuerda. Plantilla completa, liga de pago en cada aviso, por su canal preferido.', calendario: 'Plan completo', tono: 'Estándar' },
  deterioro: { nombre: 'En deterioro', chip: 'bg-orange-50 text-orange-700 border-orange-200', punto: 'bg-orange-500', trato: 'Buen historial que está empeorando. Una persona le llama al día 3 para entender qué cambió. Alerta al supervisor.', calendario: 'Llamada al día 3', tono: 'Cercano' },
  moroso: { nombre: 'Moroso recurrente', chip: 'bg-rose-50 text-rose-700 border-rose-200', punto: 'bg-rose-600', trato: 'Escalamiento acelerado: formal al día 10 y negociación al 20. Promesas con seguimiento estricto y revisión de su línea de crédito.', calendario: 'Formal día 10 · negociación día 20', tono: 'Firme' },
  disputa: { nombre: 'En disputa', chip: 'bg-brand-ink/5 text-brand-ink/70 border-brand-ink/15', punto: 'bg-brand-ink/50', trato: 'La cobranza se pausa mientras la aclaración siga abierta.', calendario: 'Cobranza vencida en pausa', tono: '—' },
  nuevo: { nombre: 'Nuevo', chip: 'bg-brand-bone text-brand-ink/60 border-brand-ink/12', punto: 'bg-brand-ink/25', trato: 'Sin historial todavía: se usa la plantilla general hasta tener pagos para medir.', calendario: 'Plantilla general', tono: 'Estándar' },
};

const prom = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const pct = (x: number) => `${Math.round(x * 100)}%`;

export type Diagnostico = { segmento: Segmento; porque: string; aTiempo: number; atrasoProm: number; desfase: number };

/** Calcula el segmento de un cliente con su historial y explica por qué. */
export function segmentoDe(historial: number[], promesas: { rotas: number }, disputa = false): Diagnostico {
  const h = historial;
  const atrasos = h.map((d) => Math.max(0, d));
  const aTiempo = h.length ? h.filter((d) => d <= 0).length / h.length : 0;
  const atrasoProm = Math.round(prom(atrasos));
  const base = { aTiempo, atrasoProm, desfase: 0 };
  if (!h.length) return { ...base, segmento: 'nuevo', porque: 'Cliente nuevo: todavía no hay pagos para medir.' };
  if (disputa) return { ...base, segmento: 'disputa', porque: 'Tiene una aclaración abierta sobre su factura.' };
  if (promesas.rotas >= 2 || (aTiempo < 0.4 && atrasoProm > 20)) {
    const graves = h.filter((d) => d > 20).length;
    return { ...base, segmento: 'moroso', porque: `${graves} de sus últimas ${h.length} facturas se pagaron con más de 20 días de atraso y rompió ${promesas.rotas} ${promesas.rotas === 1 ? 'promesa' : 'promesas'} de pago.` };
  }
  const antes = h.slice(0, -3);
  const antesATiempo = antes.length ? antes.filter((d) => d <= 0).length / antes.length : 0;
  const tendencia = prom(atrasos.slice(-3)) - prom(atrasos.slice(0, -3));
  if (tendencia >= 5 && antesATiempo >= 0.6) {
    return { ...base, segmento: 'deterioro', porque: `Pagaba a tiempo el ${pct(antesATiempo)} de sus facturas; sus últimos 3 pagos promediaron ${Math.round(prom(atrasos.slice(-3)))} días de atraso.` };
  }
  if (aTiempo >= 0.9) return { ...base, segmento: 'puntual', porque: `${pct(aTiempo)} de sus facturas de los últimos 12 meses se pagaron a tiempo.` };
  const desv = Math.sqrt(prom(h.map((d) => (d - prom(h)) ** 2)));
  if (aTiempo < 0.5 && desv <= 3) {
    return { ...base, desfase: atrasoProm, segmento: 'tardio', porque: `Paga en promedio ${atrasoProm} días tarde, siempre con el mismo patrón, y cumple sus promesas.` };
  }
  return { ...base, segmento: 'olvidadizo', porque: `Paga a tiempo el ${pct(aTiempo)}; cuando se atrasa, suele pagar después del recordatorio.` };
}

// ── Comportamiento ante campañas especiales ────────────────────────────
// Detecta al cliente que se atrasa a propósito esperando un descuento:
// pagó en 2+ campañas con descuento Y se atrasa más de 30 días seguido o
// ya se le negoció varias veces. Sale de las campañas por defecto.

export type Comportamiento = {
  campanasPagadas: string[];
  atrasosLargos: number;
  negociaciones: number;
  esperaDescuentos: boolean;
  porque: string;
};

export function comportamientoDe(c: CuentaCartera): Comportamiento {
  const campanasPagadas = c.campanasPagadas ?? [];
  const atrasosLargos = c.historial.filter((d) => d > 30).length;
  const negociaciones = c.negociaciones ?? 0;
  const esperaDescuentos = campanasPagadas.length >= 2 && (atrasosLargos >= 2 || negociaciones >= 2);
  const porque = esperaDescuentos
    ? `Pagó en ${campanasPagadas.length} campañas con descuento (${campanasPagadas.join(', ')}), tuvo ${atrasosLargos} facturas con más de 30 días de atraso y ${negociaciones} negociaciones. Parece esperar la siguiente campaña para pagar.`
    : campanasPagadas.length >= 2
      ? `Pagó en ${campanasPagadas.length} campañas, pero sin atrasos largos ni negociaciones repetidas: no hay señal de que espere descuentos.`
      : 'Sin señales de que espere campañas con descuento para pagar.';
  return { campanasPagadas, atrasosLargos, negociaciones, esperaDescuentos, porque };
}

export const diagnosticoDe = (c: CuentaCartera) => segmentoDe(c.historial, c.promesas, c.disputa);
/** Segmento que tenía hace 3 facturas: sirve para detectar quién cambió. */
export const diagnosticoAnterior = (c: CuentaCartera) => segmentoDe(c.historial.slice(0, -3), c.promesas, c.disputa);
export const cuentaPorCliente = (cliente: string) => CARTERA.find((c) => c.cliente === cliente);

export function planConfig(c: CuentaCartera, segmento?: Segmento): PlanConfig {
  const d = diagnosticoDe(c);
  return {
    hoy: c.dias,
    canal: c.canal,
    segmento: segmento ?? d.segmento,
    desfase: d.atrasoProm,
    cuentaGrande: !!c.cuentaGrande,
    aclaraciones: !!c.aclaraciones,
    resultados: c.resultados,
  };
}

export function planDe(cliente: string): PlanConfig {
  return planConfig(cuentaPorCliente(cliente)!);
}

// ── Plantillas aprobadas por etapa ─────────────────────────────────────
export type Plantilla = {
  id: string;
  etapa: string;
  nombre: string;
  canal: 'WhatsApp' | 'Correo' | 'Llamada';
  grupo: 'Preventiva' | 'Vencida' | 'Servicio' | 'Especial';
  texto: string;
  estado: 'Aprobada' | 'En revisión';
};

export const PLANTILLAS: Plantilla[] = [
  { id: 'N0', etapa: 'Nivel 0', nombre: 'Confirmación de factura', canal: 'Correo', grupo: 'Preventiva', estado: 'Aprobada',
    texto: 'Estimados {{cliente}}: les compartimos la factura {{folio}} por {{monto}} con vencimiento el {{fecha}}. Si algún dato no coincide con su orden de compra, avísennos y lo corregimos.' },
  { id: 'N1', etapa: 'Nivel 1', nombre: 'Aviso preventivo', canal: 'WhatsApp', grupo: 'Preventiva', estado: 'Aprobada',
    texto: 'Buen día, {{contacto}}. Para tenerlo en su radar: la factura {{folio}} por {{monto}} vence el {{fecha}}.' },
  { id: 'N2', etapa: 'Nivel 2', nombre: 'Recordatorio de cortesía', canal: 'WhatsApp', grupo: 'Preventiva', estado: 'Aprobada',
    texto: 'Hola, {{contacto}}. Le recordamos que la factura {{folio}} por {{monto}} vence el {{fecha}}. Si le es práctico, puede pagarla aquí: {{liga}}. ¿Todo en orden con la factura?' },
  { id: 'N3', etapa: 'Nivel 3', nombre: 'Vence en 3 días', canal: 'WhatsApp', grupo: 'Preventiva', estado: 'Aprobada',
    texto: '{{contacto}}, la factura {{folio}} por {{monto}} vence en 3 días ({{fecha}}). Puede liquidarla desde {{liga}}. Si ya está programada, ignore este mensaje.' },
  { id: 'N4', etapa: 'Nivel 4', nombre: 'Vence hoy', canal: 'WhatsApp', grupo: 'Preventiva', estado: 'Aprobada',
    texto: 'Hoy vence la factura {{folio}} por {{monto}}. Liga de pago: {{liga}}. Si ya se realizó el pago, le agradecemos y puede ignorar este aviso.' },
  { id: 'A', etapa: 'Etapa A', nombre: 'Aviso urgente', canal: 'WhatsApp', grupo: 'Vencida', estado: 'Aprobada',
    texto: '{{contacto}}, la factura {{folio}} por {{monto}} venció el {{fecha}}. Puede liquidarla aquí: {{liga}}. Si ya pagó, compártanos el comprobante para registrarlo.' },
  { id: 'B', etapa: 'Etapa B', nombre: 'Preguntar qué pasó', canal: 'WhatsApp', grupo: 'Vencida', estado: 'Aprobada',
    texto: 'Hola, {{contacto}}. Notamos que la factura {{folio}} por {{monto}} sigue pendiente. ¿Hubo algún inconveniente con el pago o con la factura? Con gusto lo resolvemos juntos.' },
  { id: 'C', etapa: 'Etapa C', nombre: 'Notificación formal', canal: 'Correo', grupo: 'Vencida', estado: 'Aprobada',
    texto: 'Estimados {{cliente}}: la factura {{folio}} por {{monto}} registra {{dias}} días de atraso. Les pedimos confirmar una fecha de pago esta semana para mantener su línea de crédito en condiciones normales. Liga de pago: {{liga}}.' },
  { id: 'D', etapa: 'Etapa D', nombre: 'Negociación (guion de llamada)', canal: 'Llamada', grupo: 'Vencida', estado: 'Aprobada',
    texto: 'Saludar a {{contacto}}, confirmar el saldo de {{monto}} de la factura {{folio}} ({{dias}} días vencida), preguntar su capacidad de pago y ofrecer el plan pre-aprobado (hasta 3 parcialidades). Registrar acuerdo y fecha.' },
  { id: 'S1', etapa: 'Servicio', nombre: 'Validar datos de contacto', canal: 'WhatsApp', grupo: 'Servicio', estado: 'Aprobada',
    texto: 'Hola, {{contacto}}. Estamos actualizando nuestros registros: ¿sigue siendo usted el contacto de pagos de {{cliente}}? Si cambió, ¿nos comparte el nombre de la persona de tesorería?' },
  { id: 'E1', etapa: 'Especial', nombre: 'Buen Fin', canal: 'WhatsApp', grupo: 'Especial', estado: 'Aprobada',
    texto: '{{contacto}}, del 13 al 16 de noviembre puede liquidar su saldo de {{monto}} con {{oferta}}. Aproveche aquí: {{liga}}.' },
  { id: 'E2', etapa: 'Especial', nombre: 'Black Friday', canal: 'WhatsApp', grupo: 'Especial', estado: 'En revisión',
    texto: '{{contacto}}, solo el 27 de noviembre: liquide su saldo de {{monto}} con {{oferta}}. Detalles y pago aquí: {{liga}}.' },
  { id: 'E3', etapa: 'Especial', nombre: 'Cierre de año', canal: 'Correo', grupo: 'Especial', estado: 'Aprobada',
    texto: 'Estimados {{cliente}}: para cerrar el año al corriente, del 1 al 20 de diciembre pueden liquidar su saldo de {{monto}} con {{oferta}}. Liga de pago: {{liga}}.' },
  { id: 'E4', etapa: 'Especial', nombre: 'Oferta especial', canal: 'WhatsApp', grupo: 'Especial', estado: 'Aprobada',
    texto: '{{contacto}}, por tiempo limitado puede liquidar su saldo de {{monto}} con {{oferta}}. Detalles y pago aquí: {{liga}}.' },
];

export function llenarPlantilla(texto: string, c: CuentaCartera, oferta = 'las facilidades de esta campaña'): string {
  const monto = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(saldoDe(c));
  return texto
    .replaceAll('{{cliente}}', c.cliente)
    .replaceAll('{{contacto}}', c.finanzas?.nombre ?? c.registrado.split(' · ')[0])
    .replaceAll('{{folio}}', c.folio)
    .replaceAll('{{monto}}', monto)
    .replaceAll('{{fecha}}', c.vence)
    .replaceAll('{{dias}}', String(Math.abs(c.dias)))
    .replaceAll('{{oferta}}', oferta)
    .replaceAll('{{liga}}', 'pagar.royaltica.com/' + c.folio.toLowerCase());
}

// ── Campañas: solo fechas especiales ───────────────────────────────────
// El cobro diario lo hace el plan de cada cliente (niveles 1–4 antes de
// vencer, etapas A–D después). Las campañas son para fechas especiales y
// van solo a los clientes que se elijan.

export type Ocasion = 'buen_fin' | 'black_friday' | 'cierre' | 'personalizada' | 'contacto';
export type Oferta = { tipo: 'descuento' | 'parcialidades' | 'ninguna'; valor: number };

export const OCASIONES: { id: Ocasion; nombre: string; fechas: string; inicio: string; fin: string; plantilla: string; oferta: Oferta }[] = [
  { id: 'buen_fin', nombre: 'Buen Fin', fechas: '13 al 16 de noviembre', inicio: '2026-11-13', fin: '2026-11-16', plantilla: 'E1', oferta: { tipo: 'parcialidades', valor: 3 } },
  { id: 'black_friday', nombre: 'Black Friday', fechas: '27 de noviembre', inicio: '2026-11-27', fin: '2026-11-27', plantilla: 'E2', oferta: { tipo: 'descuento', valor: 5 } },
  { id: 'cierre', nombre: 'Cierre de año', fechas: '1 al 20 de diciembre', inicio: '2026-12-01', fin: '2026-12-20', plantilla: 'E3', oferta: { tipo: 'parcialidades', valor: 2 } },
  { id: 'personalizada', nombre: 'Fecha personalizada', fechas: 'tú eliges', inicio: HOY, fin: HOY, plantilla: 'E4', oferta: { tipo: 'descuento', valor: 5 } },
  { id: 'contacto', nombre: 'Validar contactos', fechas: 'cuando quieras', inicio: HOY, fin: HOY, plantilla: 'S1', oferta: { tipo: 'ninguna', valor: 0 } },
];

export function textoOferta(o: Oferta): string {
  if (o.tipo === 'descuento') return `${o.valor}% de descuento por pronto pago`;
  if (o.tipo === 'parcialidades') return `hasta ${o.valor} parcialidades sin recargo`;
  return '';
}

export type CampanaConfig = {
  ocasion: Ocasion;
  plantilla: string;
  oferta: Oferta;
  inicio: string; // YYYY-MM-DD
  fin: string;
  canal: 'WhatsApp' | 'Correo';
  clientes: string[]; // ids de cuenta elegidos
};

export type Campana = {
  id: string;
  nombre: string;
  config: CampanaConfig;
  estado: 'Activa' | 'Programada' | 'Pausada' | 'Borrador' | 'Finalizada';
  enviados: number;
  respuesta?: number;
  /** Solo campañas pasadas: quiénes terminaron pagando con la oferta. */
  pagaron?: string[];
};

const OC = (id: Ocasion) => OCASIONES.find((o) => o.id === id)!;

export const CAMPANAS: Campana[] = [
  {
    id: 'c3', nombre: 'Validación de contactos', estado: 'Activa', enviados: 11, respuesta: 27,
    config: { ocasion: 'contacto', plantilla: 'S1', oferta: OC('contacto').oferta, inicio: '2026-09-27', fin: '2026-10-11', canal: 'WhatsApp', clientes: ['k01', 'k02', 'k04', 'k06', 'k07', 'k08', 'k09', 'k10', 'k11', 'k12', 'k13'] },
  },
  {
    id: 'c5', nombre: 'Buen Fin 2026', estado: 'Borrador', enviados: 0,
    config: { ocasion: 'buen_fin', plantilla: 'E1', oferta: OC('buen_fin').oferta, inicio: '2026-11-13', fin: '2026-11-16', canal: 'WhatsApp', clientes: ['k01', 'k02'] },
  },
  {
    id: 'h1', nombre: 'Buen Fin 2025', estado: 'Finalizada', enviados: 9, pagaron: ['k13', 'k12', 'k03', 'k01', 'k10'],
    config: { ocasion: 'buen_fin', plantilla: 'E1', oferta: { tipo: 'parcialidades', valor: 3 }, inicio: '2025-11-14', fin: '2025-11-17', canal: 'WhatsApp', clientes: ['k01', 'k03', 'k05', 'k07', 'k09', 'k10', 'k12', 'k13', 'k14'] },
  },
  {
    id: 'h2', nombre: 'Cierre de año 2024', estado: 'Finalizada', enviados: 6, pagaron: ['k13', 'k12'],
    config: { ocasion: 'cierre', plantilla: 'E3', oferta: { tipo: 'descuento', valor: 4 }, inicio: '2024-12-01', fin: '2024-12-20', canal: 'Correo', clientes: ['k03', 'k05', 'k10', 'k12', 'k13', 'k14'] },
  },
  {
    id: 'h3', nombre: 'Buen Fin 2024', estado: 'Finalizada', enviados: 7, pagaron: ['k13', 'k10'],
    config: { ocasion: 'buen_fin', plantilla: 'E1', oferta: { tipo: 'parcialidades', valor: 3 }, inicio: '2024-11-15', fin: '2024-11-18', canal: 'WhatsApp', clientes: ['k01', 'k03', 'k05', 'k10', 'k12', 'k13', 'k14'] },
  },
];

// ── Gestiones (base de reportes). Agente, línea y monto salen de CARTERA ─
export const RESULTADOS = ['Promesa de pago', 'Pagó', 'Sin respuesta', 'Disputa', 'Escalado', 'Enviado', 'No gestionada'] as const;
export type Resultado = (typeof RESULTADOS)[number];

export type Gestion = {
  fecha: string;
  hora: string;
  agente: string;
  cliente: string;
  linea: Linea;
  resultado: Resultado;
  monto: number;
};

export function gestion(fecha: string, hora: string, cliente: string, resultado: Resultado, monto?: number): Gestion {
  const c = cuentaPorCliente(cliente)!;
  return { fecha, hora, cliente, resultado, agente: c.agente, linea: c.linea, monto: monto ?? saldoDe(c) };
}

export const GESTIONES: Gestion[] = [
  gestion('2026-09-22', '09:14', 'Distribuidora del Norte', 'Promesa de pago'),
  gestion('2026-09-22', '11:40', 'Logística Andrade', 'Pagó', 47_100),
  gestion('2026-09-22', '16:05', 'Grupo Ferretero Bajío', 'Sin respuesta'),
  gestion('2026-09-23', '10:22', 'Materiales Peninsulares', 'Promesa de pago'),
  gestion('2026-09-23', '12:48', 'Constructora Vanguardia', 'Escalado'),
  gestion('2026-09-23', '17:30', 'Agroinsumos del Valle', 'Sin respuesta'),
  gestion('2026-09-24', '09:05', 'Transportes del Pacífico', 'Disputa'),
  gestion('2026-09-24', '13:12', 'Herrajes Monterrey', 'Pagó', 20_000),
  gestion('2026-09-24', '18:40', 'Grupo Ferretero Bajío', 'Escalado'),
  gestion('2026-09-25', '10:02', 'Grupo Textil Aurora', 'Promesa de pago'),
  gestion('2026-09-25', '15:26', 'Distribuidora del Norte', 'Sin respuesta'),
  gestion('2026-09-26', '09:48', 'Comercializadora Lumen', 'Enviado'),
  gestion('2026-09-26', '12:15', 'Distribuidora Baja', 'Sin respuesta'),
  gestion('2026-09-26', '16:55', 'Constructora Río Bravo', 'Disputa'),
  gestion('2026-09-27', '08:30', 'Refaccionaria Occidente', 'No gestionada'),
  gestion('2026-09-27', '08:30', 'Papelera Industrial Sur', 'No gestionada'),
];

// ── Pagos: conciliación con ERP y REP ──────────────────────────────────
// Un pago real se guarda UNA vez, con la lista de dónde se vio (evidencias):
// el ERP es la señal rápida y el REP (complemento de pago) la confirmación
// fiscal. La fecha oficial del pago es la del REP. El saldo de cada factura
// sale de sumar sus pagos: por eso estos montos cuadran con `pagado` arriba.

export type Fuente = 'ERP' | 'REP' | 'CSV';
export type Evidencia = { fuente: Fuente; fecha: string; texto: string };
export type EstadoPago = 'confirmado' | 'solo_erp' | 'solo_rep' | 'discrepancia';

export type Pago = {
  id: string;
  cuentaId: string;
  monto: number;
  fechaPago: string;
  metodo: 'PPD' | 'PUE';
  estado: EstadoPago;
  evidencias: Evidencia[];
  parcialidad?: number;
  /** Para pagos PPD vistos solo en el ERP: fecha límite para emitir el REP. */
  limiteRep?: string;
  diasRep?: number;
  avisado?: boolean;
  montoRep?: number;
  nota?: string;
};

export const ERP_CONECTADO = { nombre: 'Odoo', ultima: 'hoy 06:00', siguiente: 'hoy 18:00' };

export const PAGOS_INICIALES: Pago[] = [
  {
    id: 'p1', cuentaId: 'k01', monto: 85_350, fechaPago: '10 sep', metodo: 'PPD', estado: 'confirmado', parcialidad: 1,
    evidencias: [
      { fuente: 'ERP', fecha: '11 sep', texto: 'Odoo: el saldo bajó de $284,500 a $199,150' },
      { fuente: 'REP', fecha: '18 sep', texto: 'REP 7c41…e2a0 · parcialidad 1 · vigente en el SAT' },
    ],
  },
  {
    id: 'p2', cuentaId: 'k02', monto: 78_100, fechaPago: '5 sep', metodo: 'PPD', estado: 'solo_erp', parcialidad: 1,
    limiteRep: '10 oct', diasRep: 12,
    evidencias: [{ fuente: 'ERP', fecha: '6 sep', texto: 'Odoo: el saldo bajó de $156,200 a $78,100' }],
  },
  {
    id: 'p3', cuentaId: 'k04', monto: 47_100, fechaPago: '22 sep', metodo: 'PPD', estado: 'confirmado', parcialidad: 1,
    evidencias: [
      { fuente: 'ERP', fecha: '23 sep', texto: 'Odoo: el saldo bajó de $62,800 a $15,700' },
      { fuente: 'REP', fecha: '25 sep', texto: 'REP 1b9d…44f3 · parcialidad 1 · vigente en el SAT' },
    ],
  },
  {
    id: 'p4', cuentaId: 'k05', monto: 123_600, fechaPago: '15 sep', metodo: 'PPD', estado: 'solo_erp', parcialidad: 1,
    limiteRep: '10 oct', diasRep: 12,
    evidencias: [{ fuente: 'ERP', fecha: '16 sep', texto: 'Odoo: el saldo bajó de $412,000 a $288,400' }],
  },
  {
    id: 'p5', cuentaId: 'k13', monto: 20_000, fechaPago: '24 sep', metodo: 'PUE', estado: 'confirmado',
    nota: 'Factura PUE: no lleva REP, el ERP es la única fuente.',
    evidencias: [{ fuente: 'ERP', fecha: '25 sep', texto: 'Odoo: el saldo bajó de $83,500 a $63,500' }],
  },
];

/** Lo que trae la siguiente sincronización del ERP (simulada). */
export const SYNC_ERP_SIM: Pago = {
  id: 'p6', cuentaId: 'k07', monto: 60_000, fechaPago: '27 sep', metodo: 'PPD', estado: 'solo_erp', parcialidad: 1,
  limiteRep: '10 oct', diasRep: 12,
  evidencias: [{ fuente: 'ERP', fecha: 'hoy 11:24', texto: 'Odoo: el saldo bajó de $126,300 a $66,300' }],
};

/** Lo que trae el CSV de cartera (simulado): un saldo que bajó y una factura nueva. */
export const CSV_SIM = {
  pago: {
    id: 'p8', cuentaId: 'k03', monto: 30_000, fechaPago: '26 sep', metodo: 'PPD', estado: 'solo_erp', parcialidad: 1,
    limiteRep: '10 oct', diasRep: 12,
    evidencias: [{ fuente: 'CSV', fecha: 'hoy 11:24', texto: 'Reporte de cartera: el saldo bajó de $98,400 a $68,400' }],
  } as Pago,
  facturaNueva: { cuentaId: 'k12', factura: { folio: 'F-2983', monto: 25_600, emision: '27 sep', vence: '27 oct', dias: -29, planInicio: null } as Factura },
};

/** Lo que trae el ZIP de REP (simulado): un caso de cada tipo. */
export const ZIP_REP_SIM = {
  confirma: { cuentaId: 'k05', uuid: 'a83f…19c2', fecha: '27 sep', monto: 123_600 },
  discrepa: { cuentaId: 'k02', uuid: '5e07…b7d1', fecha: '26 sep', monto: 78_000 },
  nuevo: { cuentaId: 'k06', uuid: 'd2c5…0a6e', fecha: '27 sep', fechaPago: '26 sep', monto: 74_300 },
  desconocido: { uuid: 'f914…3b88', rfc: 'TME150312AB4', nombre: 'Textiles Mérida SA de CV', monto: 18_500, fecha: '27 sep' },
};

// ── Respuestas simuladas a campañas ─────────────────────────────────────
// Al lanzar una campaña, estos clientes "contestan" para que el agente vea
// las respuestas arriba de su lista.
export const RESPUESTAS_SIM: Record<string, string> = {
  k01: 'La tenemos programada para el viernes 2 de octubre, les mando el comprobante.',
  k02: 'Recibido. ¿Nos pueden mandar el estado de cuenta actualizado?',
  k07: 'Sigo siendo yo, pero los pagos ahora los ve mi asistente Rosa Díaz (669 118 4410).',
  k06: 'Todo en orden, la pagamos el 2 de octubre.',
  k12: '¿Podemos pagar en dos partes? Este mes no nos alcanza completo.',
};

/** Toques que ya hicieron las campañas activas antes de hoy. */
export const TOQUES_INICIALES: Record<string, { campanaId: string; campana: string; plantilla: string; hora: string; respuesta?: string }[]> = {
  k07: [{ campanaId: 'c3', campana: 'Validación de contactos', plantilla: 'S1', hora: 'ayer 10:00', respuesta: RESPUESTAS_SIM.k07 }],
  k02: [{ campanaId: 'c3', campana: 'Validación de contactos', plantilla: 'S1', hora: 'ayer 10:00' }],
  k04: [{ campanaId: 'c3', campana: 'Validación de contactos', plantilla: 'S1', hora: 'ayer 10:00' }],
  k10: [{ campanaId: 'c3', campana: 'Validación de contactos', plantilla: 'S1', hora: 'ayer 10:00' }],
};
