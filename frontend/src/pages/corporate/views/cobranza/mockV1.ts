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
export type Perfil = 'estandar' | 'cumplido' | 'formal' | 'disputas';
export type CanalPreferido = 'WhatsApp' | 'Correo';

/** Configuración del plan de un cliente (ver plan.tsx → construirPlan). */
export type PlanConfig = {
  hoy: number; // días respecto al vencimiento (negativo = faltan)
  canal: CanalPreferido;
  perfil: Perfil;
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
  perfil: Perfil;
  canal: CanalPreferido;
  resultados: Resultados;
};

export const CARTERA: CuentaCartera[] = [
  {
    id: 'k01', cliente: 'Distribuidora del Norte', folio: 'F-2841', monto: 284_500, pagado: 85_350, dias: 42, vence: '17 ago',
    agente: 'María Jiménez', linea: 'Materiales', registrado: 'Lic. Arturo Garza · Director general',
    finanzas: { nombre: 'Patricia Salas', puesto: 'Tesorería', telefono: '81 2231 0045' },
    ciudad: 'Monterrey', zona: 'UTC-6', horaLocal: '11:20', contactable: true, perfil: 'estandar', canal: 'WhatsApp',
    resultados: { N0: 'Confirmó factura', N1: 'Sin respuesta', N2: 'Respondió', N3: 'Sin respuesta', N4: 'Sin respuesta', A: 'Respondió', B: 'Prometió fecha', C: 'Sin respuesta' },
  },
  {
    id: 'k02', cliente: 'Materiales Peninsulares', folio: 'F-2903', monto: 156_200, pagado: 78_100, dias: 28, vence: '31 ago',
    agente: 'Ana Robles', linea: 'Materiales', registrado: 'Sr. Manuel Poot · Dueño',
    finanzas: { nombre: 'Jorge Canché', puesto: 'Cuentas por pagar', telefono: '999 214 7730' },
    ciudad: 'Mérida', zona: 'UTC-6', horaLocal: '11:20', contactable: true, perfil: 'estandar', canal: 'Correo',
    resultados: { N0: 'Confirmó factura', N1: 'Respondió', N2: 'Sin respuesta', N3: 'Respondió', N4: 'Sin respuesta', A: 'Sin respuesta', B: 'Respondió' },
  },
  {
    id: 'k03', cliente: 'Grupo Ferretero Bajío', folio: 'F-2877', monto: 98_400, pagado: 0, dias: 35, vence: '24 ago',
    agente: 'Carlos Mendoza', linea: 'Materiales', registrado: 'Ing. Raúl Bravo · Director general', finanzas: null,
    ciudad: 'León', zona: 'UTC-6', horaLocal: '11:20', contactable: true, perfil: 'disputas', canal: 'WhatsApp',
    resultados: { N0: 'Aclaró factura', N1: 'Sin respuesta', N2: 'Sin respuesta', N3: 'Sin respuesta', N4: 'Sin respuesta', A: 'Sin respuesta', B: 'Sin respuesta', C: 'Sin respuesta' },
  },
  {
    id: 'k04', cliente: 'Logística Andrade', folio: 'F-2915', monto: 62_800, pagado: 47_100, dias: 12, vence: '16 sep',
    agente: 'Ana Robles', linea: 'Logística', registrado: 'Sr. Tomás Andrade · Dueño',
    finanzas: { nombre: 'Rocío Andrade', puesto: 'Tesorería', telefono: '33 1845 2290' },
    ciudad: 'Guadalajara', zona: 'UTC-6', horaLocal: '11:20', contactable: true, perfil: 'cumplido', canal: 'WhatsApp',
    resultados: { N3: 'Respondió', N4: 'Pagó parcial', A: 'Respondió' },
  },
  {
    id: 'k05', cliente: 'Constructora Vanguardia', folio: 'F-2860', monto: 412_000, pagado: 123_600, dias: 19, vence: '9 sep',
    agente: 'María Jiménez', linea: 'Servicios', registrado: 'Arq. Elena Duarte · Directora', finanzas: null,
    ciudad: 'CDMX', zona: 'UTC-6', horaLocal: '11:20', contactable: true, perfil: 'formal', canal: 'Correo',
    resultados: { N0: 'Confirmó factura', N1: 'Respondió', N2: 'Sin respuesta', N3: 'Sin respuesta', N4: 'Sin respuesta', A: 'Sin respuesta', B: 'Turnado a finanzas' },
  },
  {
    id: 'k06', cliente: 'Comercializadora Lumen', folio: 'F-2951', monto: 74_300, pagado: 0, dias: -5, vence: '3 oct',
    agente: 'Carlos Mendoza', linea: 'Servicios', registrado: 'Lic. Pablo Ortiz · Director',
    finanzas: { nombre: 'Daniela Ortiz', puesto: 'Finanzas', telefono: '55 4410 8812' },
    ciudad: 'CDMX', zona: 'UTC-6', horaLocal: '11:20', contactable: true, perfil: 'estandar', canal: 'WhatsApp',
    resultados: { N0: 'Confirmó factura', N1: 'Sin respuesta', N2: 'Respondió' },
  },
  {
    id: 'k07', cliente: 'Transportes del Pacífico', folio: 'F-2934', monto: 126_300, pagado: 0, dias: 7, vence: '21 sep',
    agente: 'Ana Robles', linea: 'Logística', registrado: 'Sr. Ernesto Ruiz · Dueño',
    finanzas: { nombre: 'Héctor Ruiz', puesto: 'Tesorería', telefono: '669 118 4402' },
    ciudad: 'Mazatlán', zona: 'UTC-7', horaLocal: '10:20', contactable: true, perfil: 'estandar', canal: 'WhatsApp',
    resultados: { N0: 'Confirmó factura', N1: 'Sin respuesta', N2: 'Sin respuesta', N3: 'Sin respuesta', N4: 'Sin respuesta', A: 'Pidió aclaración' },
  },
  {
    id: 'k08', cliente: 'Refaccionaria Occidente', folio: 'F-2958', monto: 44_900, pagado: 0, dias: -3, vence: '1 oct',
    agente: 'Ana Robles', linea: 'Materiales', registrado: 'Sr. Luis Méndez · Dueño',
    finanzas: { nombre: 'Laura Méndez', puesto: 'Finanzas', telefono: '33 3627 1190' },
    ciudad: 'Guadalajara', zona: 'UTC-6', horaLocal: '11:20', contactable: true, perfil: 'estandar', canal: 'WhatsApp',
    resultados: { N0: 'Confirmó factura', N1: 'Respondió', N2: 'Sin respuesta' },
  },
  {
    id: 'k09', cliente: 'Distribuidora Baja', folio: 'F-2947', monto: 58_000, pagado: 0, dias: 1, vence: '27 sep',
    agente: 'Ana Robles', linea: 'Logística', registrado: 'Lic. Sergio Castro · Director',
    finanzas: { nombre: 'Iván Castro', puesto: 'Tesorería', telefono: '664 902 3318' },
    ciudad: 'Tijuana', zona: 'UTC-8', horaLocal: '8:20', contactable: false, motivo: 'Fuera de horario · se puede desde las 9:00',
    perfil: 'estandar', canal: 'WhatsApp',
    resultados: { N0: 'Confirmó factura', N1: 'Sin respuesta', N2: 'Sin respuesta', N3: 'Sin respuesta', N4: 'Sin respuesta' },
  },
  {
    id: 'k10', cliente: 'Grupo Textil Aurora', folio: 'F-2921', monto: 91_200, pagado: 0, dias: 18, vence: '10 sep',
    agente: 'Ana Robles', linea: 'Servicios', registrado: 'Sra. Carmen Leal · Directora',
    finanzas: { nombre: 'Mónica Leal', puesto: 'Finanzas', telefono: '222 581 7764' },
    ciudad: 'Puebla', zona: 'UTC-6', horaLocal: '11:20', contactable: false, motivo: 'Promesa de pago vigente hasta el 30 sep', promesa: true,
    perfil: 'estandar', canal: 'WhatsApp',
    resultados: { N0: 'Confirmó factura', N1: 'Sin respuesta', N2: 'Sin respuesta', N3: 'Sin respuesta', N4: 'Sin respuesta', A: 'Sin respuesta', B: 'Prometió pagar el 30 sep' },
  },
  {
    id: 'k11', cliente: 'Papelera Industrial Sur', folio: 'F-2962', monto: 38_600, pagado: 0, dias: -10, vence: '8 oct',
    agente: 'María Jiménez', linea: 'Materiales', registrado: 'Ing. Óscar Pech · Director',
    finanzas: { nombre: 'Karla Pech', puesto: 'Tesorería', telefono: '999 330 1187' },
    ciudad: 'Mérida', zona: 'UTC-6', horaLocal: '11:20', contactable: true, perfil: 'estandar', canal: 'Correo',
    resultados: { N0: 'Confirmó factura' },
  },
  {
    id: 'k12', cliente: 'Agroinsumos del Valle', folio: 'F-2790', monto: 67_800, pagado: 0, dias: 74, vence: '16 jul',
    agente: 'Carlos Mendoza', linea: 'Materiales', registrado: 'Ing. Sofía Treviño · Directora',
    finanzas: { nombre: 'Rubén Treviño', puesto: 'Tesorería', telefono: '662 219 5540' },
    ciudad: 'Hermosillo', zona: 'UTC-7', horaLocal: '10:20', contactable: true, perfil: 'estandar', canal: 'WhatsApp',
    resultados: { N0: 'Sin respuesta', N1: 'Sin respuesta', N2: 'Sin respuesta', N3: 'Sin respuesta', N4: 'Sin respuesta', A: 'Sin respuesta', B: 'Sin respuesta', C: 'Sin respuesta', D: 'No contestó' },
  },
  {
    id: 'k13', cliente: 'Herrajes Monterrey', folio: 'F-2655', monto: 83_500, pagado: 20_000, dias: 140, vence: '10 may',
    agente: 'María Jiménez', linea: 'Materiales', registrado: 'Sr. Jaime Ríos · Dueño',
    finanzas: { nombre: 'Norma Ríos', puesto: 'Tesorería', telefono: '81 8340 2201' },
    ciudad: 'Monterrey', zona: 'UTC-6', horaLocal: '11:20', contactable: true, perfil: 'estandar', canal: 'WhatsApp',
    resultados: { N0: 'Confirmó factura', N1: 'Sin respuesta', N2: 'Sin respuesta', N3: 'Sin respuesta', N4: 'Sin respuesta', A: 'Sin respuesta', B: 'Respondió', C: 'Sin respuesta', D: 'Plan de pagos incumplido' },
  },
  {
    id: 'k14', cliente: 'Constructora Río Bravo', folio: 'F-2480', monto: 143_800, pagado: 0, dias: 320, vence: '12 nov 2025',
    agente: 'Carlos Mendoza', linea: 'Servicios', registrado: 'Ing. Hugo Salinas · Director',
    finanzas: { nombre: 'Beatriz Salinas', puesto: 'Finanzas', telefono: '868 812 4410' },
    ciudad: 'Matamoros', zona: 'UTC-6', horaLocal: '11:20', contactable: true, disputa: true, perfil: 'formal', canal: 'Correo',
    resultados: { N0: 'Confirmó factura', N1: 'Sin respuesta', N2: 'Sin respuesta', N3: 'Sin respuesta', N4: 'Sin respuesta', A: 'Sin respuesta', B: 'Sin respuesta', C: 'Sin respuesta', D: 'Disputa abierta' },
  },
];

export const saldoDe = (c: CuentaCartera) => c.monto - c.pagado;
export const cuentaPorCliente = (cliente: string) => CARTERA.find((c) => c.cliente === cliente);

export function planDe(cliente: string): PlanConfig {
  const c = cuentaPorCliente(cliente)!;
  return { hoy: c.dias, canal: c.canal, perfil: c.perfil, resultados: c.resultados };
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
export type CampanaConfig = {
  tipo: 'Bloque' | 'Especial' | 'Servicio';
  buckets: string[];
  agentes: string[]; // vacío = todos
  lineas: string[]; // vacío = todas
  montoMin: number;
  excluirPromesa: boolean;
  excluirDisputa: boolean;
  plantilla: string;
  canal: 'WhatsApp' | 'Correo';
  seguimiento: { activo: boolean; dias: number; plantilla: string };
  oferta: string;
  inicio: string; // YYYY-MM-DD
  hora: string;
  ventana: [string, string];
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
  tipo: 'Bloque',
  buckets: ['prev'],
  agentes: [],
  lineas: [],
  montoMin: 0,
  excluirPromesa: true,
  excluirDisputa: true,
  plantilla: 'N2',
  canal: 'WhatsApp',
  seguimiento: { activo: true, dias: 3, plantilla: 'N3' },
  oferta: 'Hasta 3 parcialidades sin recargo',
  inicio: HOY,
  hora: '09:30',
  ventana: ['09:00', '18:00'],
  diasSemana: 'L-V',
  maxPorSemana: 2,
};

/** Cuentas que entran a una campaña con esta configuración + las que se excluyen y por qué. */
export function audiencia(cfg: CampanaConfig, cartera: CuentaCartera[]) {
  const incluidas: CuentaCartera[] = [];
  const excluidas: { cuenta: CuentaCartera; motivo: string }[] = [];
  for (const c of cartera) {
    const enBloque = cfg.tipo === 'Servicio' || cfg.buckets.includes(bucketDe(c.dias).id);
    if (!enBloque) continue;
    if (cfg.agentes.length && !cfg.agentes.includes(c.agente)) continue;
    if (cfg.lineas.length && !cfg.lineas.includes(c.linea)) continue;
    if (saldoDe(c) < cfg.montoMin) continue;
    if (!c.finanzas) excluidas.push({ cuenta: c, motivo: 'Sin contacto de finanzas' });
    else if (cfg.excluirPromesa && c.promesa) excluidas.push({ cuenta: c, motivo: 'Promesa de pago vigente' });
    else if (cfg.excluirDisputa && c.disputa) excluidas.push({ cuenta: c, motivo: 'En disputa' });
    else incluidas.push(c);
  }
  return { incluidas, excluidas };
}

export const CAMPANAS: Campana[] = [
  {
    id: 'c1', nombre: 'Preventiva · por vencer', estado: 'Activa', enviados: 3, respuesta: 67,
    config: { ...CONFIG_BASE, buckets: ['prev'], plantilla: 'N2' },
  },
  {
    id: 'c2', nombre: 'Recuperación 16–60 días', estado: 'Programada', enviados: 0,
    config: { ...CONFIG_BASE, buckets: ['b3', 'b4'], plantilla: 'C', canal: 'Correo', inicio: '2026-09-29', hora: '09:00', seguimiento: { activo: true, dias: 5, plantilla: 'D' } },
  },
  {
    id: 'c3', nombre: 'Validación de contactos', estado: 'Activa', enviados: 12, respuesta: 44,
    config: { ...CONFIG_BASE, tipo: 'Servicio', plantilla: 'S1', excluirPromesa: false, seguimiento: { activo: false, dias: 3, plantilla: 'S1' } },
  },
  {
    id: 'c4', nombre: 'Buen Fin · 3 parcialidades', estado: 'Borrador', enviados: 0,
    config: { ...CONFIG_BASE, tipo: 'Especial', buckets: ['b5', 'b6', 'b7'], plantilla: 'E1', inicio: '2026-11-13', seguimiento: { activo: false, dias: 2, plantilla: 'E1' } },
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
