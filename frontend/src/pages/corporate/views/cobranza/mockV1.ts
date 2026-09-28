// Datos de ejemplo de Cobranza IA. UNA sola cartera (CARTERA) es la fuente
// de verdad: bloques, asignaciones, contactos, equipo, lista del agente,
// planes y reportes se derivan de aquí para que los 3 perfiles cuadren.
// Reemplazar por el API cuando exista el backend del Módulo 2.

import { construirPlan } from './plan.tsx';

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
    historial: [0, -2, 0, 1, 0, 0, 3, 0, 0, 12, 18, 25], promesas: { cumplidas: 3, rotas: 1 },
    resultados: { N0: 'Confirmó factura', N1: 'Sin respuesta', N2: 'Respondió', N3: 'Sin respuesta', N4: 'Sin respuesta', A: 'Respondió', B: 'Prometió fecha', C: 'Sin respuesta' },
  },
  {
    id: 'k02', cliente: 'Materiales Peninsulares', folio: 'F-2903', monto: 156_200, pagado: 78_100, dias: 28, vence: '31 ago',
    agente: 'Ana Robles', linea: 'Materiales', registrado: 'Sr. Manuel Poot · Dueño',
    finanzas: { nombre: 'Jorge Canché', puesto: 'Cuentas por pagar', telefono: '999 214 7730' },
    ciudad: 'Mérida', zona: 'UTC-6', horaLocal: '11:20', contactable: true, canal: 'Correo',
    historial: [0, 0, -1, 0, 0, 0, 0, -2, 0, 0, 9, 16], promesas: { cumplidas: 2, rotas: 0 },
    resultados: { N0: 'Confirmó factura', N1: 'Respondió', N2: 'Sin respuesta', N3: 'Respondió', N4: 'Sin respuesta', A: 'Sin respuesta', B: 'Respondió' },
  },
  {
    id: 'k03', cliente: 'Grupo Ferretero Bajío', folio: 'F-2877', monto: 98_400, pagado: 0, dias: 35, vence: '24 ago',
    agente: 'Carlos Mendoza', linea: 'Materiales', registrado: 'Ing. Raúl Bravo · Director general', finanzas: null,
    ciudad: 'León', zona: 'UTC-6', horaLocal: '11:20', contactable: true, aclaraciones: true, canal: 'WhatsApp',
    historial: [0, -2, 0, -1, 0, 2, -3, 0, -1, 8, 14, 21], promesas: { cumplidas: 1, rotas: 1 },
    resultados: { N0: 'Aclaró factura', N1: 'Sin respuesta', N2: 'Sin respuesta', N3: 'Sin respuesta', N4: 'Sin respuesta', A: 'Sin respuesta', B: 'Sin respuesta', C: 'Sin respuesta' },
  },
  {
    id: 'k04', cliente: 'Logística Andrade', folio: 'F-2915', monto: 62_800, pagado: 47_100, dias: 12, vence: '16 sep',
    agente: 'Ana Robles', linea: 'Logística', registrado: 'Sr. Tomás Andrade · Dueño',
    finanzas: { nombre: 'Rocío Andrade', puesto: 'Tesorería', telefono: '33 1845 2290' },
    ciudad: 'Guadalajara', zona: 'UTC-6', horaLocal: '11:20', contactable: true, canal: 'WhatsApp',
    historial: [14, 15, 13, 16, 15, 14, 15, 16, 14, 15, 13, 15], promesas: { cumplidas: 4, rotas: 0 },
    resultados: { N0: 'Confirmó factura', N3: 'Respondió', N4: 'Pagó parcial' },
  },
  {
    id: 'k05', cliente: 'Constructora Vanguardia', folio: 'F-2860', monto: 412_000, pagado: 123_600, dias: 19, vence: '9 sep',
    agente: 'María Jiménez', linea: 'Servicios', registrado: 'Arq. Elena Duarte · Directora', finanzas: null,
    ciudad: 'CDMX', zona: 'UTC-6', horaLocal: '11:20', contactable: true, cuentaGrande: true, canal: 'Correo',
    historial: [0, 0, 2, 0, 5, 0, 0, 3, 0, 0, 4, 0], promesas: { cumplidas: 2, rotas: 0 },
    resultados: { N0: 'Confirmó factura', N1: 'Respondió', N2: 'Sin respuesta', N3: 'Sin respuesta', N4: 'Sin respuesta', A: 'Sin respuesta', B: 'Turnado a finanzas' },
  },
  {
    id: 'k06', cliente: 'Comercializadora Lumen', folio: 'F-2951', monto: 74_300, pagado: 0, dias: -5, vence: '3 oct',
    agente: 'Carlos Mendoza', linea: 'Servicios', registrado: 'Lic. Pablo Ortiz · Director',
    finanzas: { nombre: 'Daniela Ortiz', puesto: 'Finanzas', telefono: '55 4410 8812' },
    ciudad: 'CDMX', zona: 'UTC-6', horaLocal: '11:20', contactable: true, canal: 'WhatsApp',
    historial: [], promesas: { cumplidas: 0, rotas: 0 },
    resultados: { N0: 'Confirmó factura', N1: 'Sin respuesta', N2: 'Respondió' },
  },
  {
    id: 'k07', cliente: 'Transportes del Pacífico', folio: 'F-2934', monto: 126_300, pagado: 0, dias: 7, vence: '21 sep',
    agente: 'Ana Robles', linea: 'Logística', registrado: 'Sr. Ernesto Ruiz · Dueño',
    finanzas: { nombre: 'Héctor Ruiz', puesto: 'Tesorería', telefono: '669 118 4402' },
    ciudad: 'Mazatlán', zona: 'UTC-7', horaLocal: '10:20', contactable: true, canal: 'WhatsApp',
    historial: [0, 3, 0, 5, 0, 2, 0, 4, 0, 1, 0, 6], promesas: { cumplidas: 2, rotas: 0 },
    resultados: { N0: 'Confirmó factura', N1: 'Sin respuesta', N2: 'Sin respuesta', N3: 'Sin respuesta', N4: 'Sin respuesta', A: 'Pidió aclaración' },
  },
  {
    id: 'k08', cliente: 'Refaccionaria Occidente', folio: 'F-2958', monto: 44_900, pagado: 0, dias: -3, vence: '1 oct',
    agente: 'Ana Robles', linea: 'Materiales', registrado: 'Sr. Luis Méndez · Dueño',
    finanzas: { nombre: 'Laura Méndez', puesto: 'Finanzas', telefono: '33 3627 1190' },
    ciudad: 'Guadalajara', zona: 'UTC-6', horaLocal: '11:20', contactable: true, canal: 'WhatsApp',
    historial: [0, -1, 0, 0, -3, 0, 0, 0, -2, 0, 0, 0], promesas: { cumplidas: 0, rotas: 0 },
    resultados: { N0: 'Confirmó factura' },
  },
  {
    id: 'k09', cliente: 'Distribuidora Baja', folio: 'F-2947', monto: 58_000, pagado: 0, dias: 1, vence: '27 sep',
    agente: 'Ana Robles', linea: 'Logística', registrado: 'Lic. Sergio Castro · Director',
    finanzas: { nombre: 'Iván Castro', puesto: 'Tesorería', telefono: '664 902 3318' },
    ciudad: 'Tijuana', zona: 'UTC-8', horaLocal: '8:20', contactable: false, motivo: 'Fuera de horario · se puede desde las 9:00',
    canal: 'WhatsApp',
    historial: [2, 0, 6, 0, 3, 0, 0, 5, 0, 4, 0, 2], promesas: { cumplidas: 1, rotas: 0 },
    resultados: { N0: 'Confirmó factura', N1: 'Sin respuesta', N2: 'Sin respuesta', N3: 'Sin respuesta', N4: 'Sin respuesta' },
  },
  {
    id: 'k10', cliente: 'Grupo Textil Aurora', folio: 'F-2921', monto: 91_200, pagado: 0, dias: 18, vence: '10 sep',
    agente: 'Ana Robles', linea: 'Servicios', registrado: 'Sra. Carmen Leal · Directora',
    finanzas: { nombre: 'Mónica Leal', puesto: 'Finanzas', telefono: '222 581 7764' },
    ciudad: 'Puebla', zona: 'UTC-6', horaLocal: '11:20', contactable: false, motivo: 'Promesa de pago vigente hasta el 30 sep', promesa: true,
    canal: 'WhatsApp',
    historial: [8, 10, 7, 9, 12, 8, 10, 9, 11, 8, 10, 9], promesas: { cumplidas: 5, rotas: 0 },
    resultados: { N0: 'Confirmó factura', N1: 'Sin respuesta', N2: 'Sin respuesta', N3: 'Sin respuesta', N4: 'Sin respuesta', A: 'Sin respuesta', B: 'Prometió pagar el 30 sep' },
  },
  {
    id: 'k11', cliente: 'Papelera Industrial Sur', folio: 'F-2962', monto: 38_600, pagado: 0, dias: -10, vence: '8 oct',
    agente: 'María Jiménez', linea: 'Materiales', registrado: 'Ing. Óscar Pech · Director',
    finanzas: { nombre: 'Karla Pech', puesto: 'Tesorería', telefono: '999 330 1187' },
    ciudad: 'Mérida', zona: 'UTC-6', horaLocal: '11:20', contactable: true, canal: 'Correo',
    historial: [0, 0, 0, -1, 0, 0, 0, 0, 0, -2, 0, 0], promesas: { cumplidas: 0, rotas: 0 },
    resultados: { N0: 'Confirmó factura' },
  },
  {
    id: 'k12', cliente: 'Agroinsumos del Valle', folio: 'F-2790', monto: 67_800, pagado: 0, dias: 74, vence: '16 jul',
    agente: 'Carlos Mendoza', linea: 'Materiales', registrado: 'Ing. Sofía Treviño · Directora',
    finanzas: { nombre: 'Rubén Treviño', puesto: 'Tesorería', telefono: '662 219 5540' },
    ciudad: 'Hermosillo', zona: 'UTC-7', horaLocal: '10:20', contactable: true, canal: 'WhatsApp',
    historial: [20, 25, 31, 18, 40, 35, 28, 45, 50, 38, 42, 55], promesas: { cumplidas: 1, rotas: 3 },
    resultados: { N0: 'Sin respuesta', N1: 'Sin respuesta', N2: 'Sin respuesta', N3: 'Sin respuesta', N4: 'Sin respuesta', A: 'Sin respuesta', B: 'Sin respuesta', C: 'Sin respuesta', D: 'No contestó' },
  },
  {
    id: 'k13', cliente: 'Herrajes Monterrey', folio: 'F-2655', monto: 83_500, pagado: 20_000, dias: 140, vence: '10 may',
    agente: 'María Jiménez', linea: 'Materiales', registrado: 'Sr. Jaime Ríos · Dueño',
    finanzas: { nombre: 'Norma Ríos', puesto: 'Tesorería', telefono: '81 8340 2201' },
    ciudad: 'Monterrey', zona: 'UTC-6', horaLocal: '11:20', contactable: true, canal: 'WhatsApp',
    historial: [5, 12, 20, 30, 25, 40, 35, 60, 45, 80, 90, 120], promesas: { cumplidas: 1, rotas: 2 },
    resultados: { N0: 'Confirmó factura', N1: 'Sin respuesta', N2: 'Sin respuesta', N3: 'Sin respuesta', N4: 'Sin respuesta', A: 'Sin respuesta', B: 'Respondió', C: 'Sin respuesta', D: 'Plan de pagos incumplido' },
  },
  {
    id: 'k14', cliente: 'Constructora Río Bravo', folio: 'F-2480', monto: 143_800, pagado: 0, dias: 320, vence: '12 nov 2025',
    agente: 'Carlos Mendoza', linea: 'Servicios', registrado: 'Ing. Hugo Salinas · Director',
    finanzas: { nombre: 'Beatriz Salinas', puesto: 'Finanzas', telefono: '868 812 4410' },
    ciudad: 'Matamoros', zona: 'UTC-6', horaLocal: '11:20', contactable: true, disputa: true, cuentaGrande: true, canal: 'Correo',
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

// ── Bloques (buckets) por días de vencimiento ──────────────────────────
export const BUCKETS = [
  { id: 'prev', rango: 'Por vencer', min: -999, max: 0, tono: 'preventiva', sugerida: 'N2' },
  { id: 'b1', rango: '1–7 días', min: 1, max: 7, tono: 'temprana', sugerida: 'A' },
  { id: 'b2', rango: '8–15 días', min: 8, max: 15, tono: 'temprana', sugerida: 'B' },
  { id: 'b3', rango: '16–30 días', min: 16, max: 30, tono: 'media', sugerida: 'C' },
  { id: 'b4', rango: '31–60 días', min: 31, max: 60, tono: 'media', sugerida: 'D' },
  { id: 'b5', rango: '61–90 días', min: 61, max: 90, tono: 'alta', sugerida: 'D' },
  { id: 'b6', rango: '91–300 días', min: 91, max: 300, tono: 'alta', sugerida: 'D' },
  { id: 'b7', rango: '+300 días', min: 301, max: 99_999, tono: 'critica', sugerida: 'D' },
] as const;
export type Bucket = (typeof BUCKETS)[number];
export const bucketDe = (dias: number) => BUCKETS.find((b) => dias >= b.min && dias <= b.max)!;

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
  { id: 'E1', etapa: 'Especial', nombre: 'Buen Fin · parcialidades sin recargo', canal: 'WhatsApp', grupo: 'Especial', estado: 'Aprobada',
    texto: '{{contacto}}, del 13 al 16 de noviembre puede liquidar su saldo de {{monto}} en hasta 3 parcialidades sin recargo. Aproveche aquí: {{liga}}.' },
  { id: 'E2', etapa: 'Especial', nombre: 'Black Friday · descuento por pronto pago', canal: 'WhatsApp', grupo: 'Especial', estado: 'En revisión',
    texto: '{{contacto}}, solo el 27 de noviembre: liquide su saldo de {{monto}} y obtenga un descuento por pronto pago. Detalles y pago aquí: {{liga}}.' },
];

export function llenarPlantilla(texto: string, c: CuentaCartera): string {
  const monto = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(saldoDe(c));
  return texto
    .replaceAll('{{cliente}}', c.cliente)
    .replaceAll('{{contacto}}', c.finanzas?.nombre ?? c.registrado.split(' · ')[0])
    .replaceAll('{{folio}}', c.folio)
    .replaceAll('{{monto}}', monto)
    .replaceAll('{{fecha}}', c.vence)
    .replaceAll('{{dias}}', String(Math.abs(c.dias)))
    .replaceAll('{{liga}}', 'pagar.royaltica.com/' + c.folio.toLowerCase());
}

// ── Campañas ───────────────────────────────────────────────────────────
export type Momento = 'porVencer' | 'vencidas' | 'todas';

export type CampanaConfig = {
  momento: Momento;
  buckets: string[]; // vencidas: rangos de atraso (vacío = todos)
  segmentos: string[]; // vacío = todos
  agentes: string[]; // vacío = todos
  lineas: string[]; // vacío = todas
  montoMin: number;
  excluirPromesa: boolean;
  plantilla: string;
  canal: 'WhatsApp' | 'Correo';
  seguimiento: { activo: boolean; dias: number; plantilla: string };
  oferta: string;
  inicio: string; // YYYY-MM-DD
  hora: string;
  horario: [string, string];
  diasSemana: 'L-V' | 'L-S';
  maxPorSemana: number;
};

export type Campana = {
  id: string;
  nombre: string;
  config: CampanaConfig;
  estado: 'Activa' | 'Programada' | 'Pausada' | 'Borrador';
  enviados: number;
  respuesta?: number;
};

export const CONFIG_BASE: CampanaConfig = {
  momento: 'porVencer',
  buckets: [],
  segmentos: [],
  agentes: [],
  lineas: [],
  montoMin: 0,
  excluirPromesa: true,
  plantilla: 'N2',
  canal: 'WhatsApp',
  seguimiento: { activo: true, dias: 4, plantilla: 'N3' },
  oferta: 'Hasta 3 parcialidades sin recargo',
  inicio: HOY,
  hora: '09:30',
  horario: ['09:00', '18:00'],
  diasSemana: 'L-V',
  maxPorSemana: 2,
};

/** Pasos del plan que puede mandar una campaña (el nivel 0 sale solo al emitir). */
export const PASOS_CAMPANA = ['N1', 'N2', 'N3', 'N4', 'A', 'B', 'C', 'D'];

/** En cobranza temprana, el nivel decide a quién le toca: vencen en N días o menos. */
export const VENTANA_NIVEL: Record<string, number> = { N1: 14, N2: 7, N3: 3, N4: 0 };

/**
 * Cuentas que entran a una campaña + las que quedan fuera y por qué: sin
 * contacto de finanzas, promesa vigente, o porque el plan de su segmento no
 * incluye ese nivel/etapa (p. ej. a un Puntual no se le manda el nivel 2).
 */
export function audiencia(cfg: CampanaConfig, cartera: (CuentaCartera & { segmento?: Segmento })[]) {
  const incluidas: CuentaCartera[] = [];
  const excluidas: { cuenta: CuentaCartera; motivo: string }[] = [];
  const pl = PLANTILLAS.find((p) => p.id === cfg.plantilla);
  for (const c of cartera) {
    if (cfg.momento === 'porVencer' && !(c.dias <= 0 && c.dias >= -(VENTANA_NIVEL[cfg.plantilla] ?? 14))) continue;
    if (cfg.momento === 'vencidas' && !(c.dias > 0 && (!cfg.buckets.length || cfg.buckets.includes(bucketDe(c.dias).id)))) continue;
    const segmento = c.segmento ?? diagnosticoDe(c).segmento;
    if (cfg.segmentos.length && !cfg.segmentos.includes(segmento)) continue;
    if (cfg.agentes.length && !cfg.agentes.includes(c.agente)) continue;
    if (cfg.lineas.length && !cfg.lineas.includes(c.linea)) continue;
    if (saldoDe(c) < cfg.montoMin) continue;
    const paso = PASOS_CAMPANA.includes(cfg.plantilla)
      ? construirPlan(planConfig(c, segmento)).pasos.find((p) => p.id === cfg.plantilla)
      : undefined;
    if (!c.finanzas) excluidas.push({ cuenta: c, motivo: 'Sin contacto de finanzas' });
    else if (cfg.excluirPromesa && c.promesa) excluidas.push({ cuenta: c, motivo: 'Promesa de pago vigente' });
    else if (paso?.estado === 'omitido')
      excluidas.push({ cuenta: c, motivo: `Su plan no incluye ${pl?.etapa ?? 'este paso'} (${SEGMENTOS[segmento].nombre})` });
    else incluidas.push(c);
  }
  return { incluidas, excluidas };
}

export const CAMPANAS: Campana[] = [
  {
    id: 'c1', nombre: 'Temprana · Recordatorio de cortesía', estado: 'Activa', enviados: 1, respuesta: 100,
    config: { ...CONFIG_BASE, momento: 'porVencer', plantilla: 'N2' },
  },
  {
    id: 'c2', nombre: 'Vencidas 16–60 días · Notificación formal', estado: 'Programada', enviados: 0,
    config: { ...CONFIG_BASE, momento: 'vencidas', buckets: ['b3', 'b4'], plantilla: 'C', canal: 'Correo', inicio: '2026-09-29', hora: '09:00', seguimiento: { activo: true, dias: 5, plantilla: 'D' } },
  },
  {
    id: 'c3', nombre: 'Validación de contactos', estado: 'Activa', enviados: 11, respuesta: 27,
    config: { ...CONFIG_BASE, momento: 'todas', plantilla: 'S1', excluirPromesa: false, seguimiento: { activo: false, dias: 3, plantilla: 'S1' } },
  },
  {
    id: 'c4', nombre: 'Buen Fin · 3 parcialidades', estado: 'Borrador', enviados: 0,
    config: { ...CONFIG_BASE, momento: 'vencidas', buckets: ['b3', 'b4', 'b5', 'b6', 'b7'], segmentos: ['deterioro', 'moroso'], plantilla: 'E1', inicio: '2026-11-13', seguimiento: { activo: false, dias: 2, plantilla: 'E1' } },
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

// ── Pagos: movimientos bancarios por validar (T+1) ─────────────────────
export type Movimiento = {
  id: string;
  fecha: string;
  referencia: string;
  monto: number;
  sugerencia: string | null;
  confianza: 'alta' | 'media' | 'baja';
};

export const MOVIMIENTOS: Movimiento[] = [
  { id: 'm1', fecha: '27 sep', referencia: 'SPEI 8841207 LOGISTICA ANDRADE', monto: 15_700, sugerencia: 'Logística Andrade · F-2915 (liquida)', confianza: 'alta' },
  { id: 'm2', fecha: '27 sep', referencia: 'DEP 00392 MAT PENINSULARES', monto: 39_050, sugerencia: 'Materiales Peninsulares · F-2903 (parcial)', confianza: 'media' },
  { id: 'm3', fecha: '26 sep', referencia: 'SPEI 7712093 SIN REFERENCIA', monto: 12_400, sugerencia: null, confianza: 'baja' },
];

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
  k06: [{ campanaId: 'c1', campana: 'Temprana · Recordatorio de cortesía', plantilla: 'N2', hora: 'ayer 09:30', respuesta: RESPUESTAS_SIM.k06 }],
  k07: [{ campanaId: 'c3', campana: 'Validación de contactos', plantilla: 'S1', hora: 'ayer 10:00', respuesta: RESPUESTAS_SIM.k07 }],
  k02: [{ campanaId: 'c3', campana: 'Validación de contactos', plantilla: 'S1', hora: 'ayer 10:00' }],
  k04: [{ campanaId: 'c3', campana: 'Validación de contactos', plantilla: 'S1', hora: 'ayer 10:00' }],
  k10: [{ campanaId: 'c3', campana: 'Validación de contactos', plantilla: 'S1', hora: 'ayer 10:00' }],
};
