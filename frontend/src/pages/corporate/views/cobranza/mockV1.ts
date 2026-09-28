// Datos de ejemplo de las mejoras V1 (perfiles, campañas por bloques,
// plantillas aprobadas, reportes configurables, pagos T+1, contactos de
// finanzas). Reemplazar por el API cuando exista el backend del Módulo 2.

export const AGENTES = ['María Jiménez', 'Carlos Mendoza', 'Ana Robles'] as const;
export type Agente = (typeof AGENTES)[number];

// ── Bloques (buckets) por días de vencimiento ──────────────────────────
export const BUCKETS = [
  { id: 'prev', rango: 'Por vencer', detalle: 'próximos 15 días', cuentas: 24, monto: 920_000, tono: 'preventiva' },
  { id: 'b1', rango: '1–7 días', detalle: 'recién vencidas', cuentas: 18, monto: 612_400, tono: 'temprana' },
  { id: 'b2', rango: '8–15 días', detalle: '', cuentas: 11, monto: 398_200, tono: 'temprana' },
  { id: 'b3', rango: '16–30 días', detalle: '', cuentas: 9, monto: 455_100, tono: 'media' },
  { id: 'b4', rango: '31–60 días', detalle: '', cuentas: 7, monto: 538_900, tono: 'media' },
  { id: 'b5', rango: '61–90 días', detalle: '', cuentas: 4, monto: 210_300, tono: 'alta' },
  { id: 'b6', rango: '91–300 días', detalle: '', cuentas: 5, monto: 284_000, tono: 'alta' },
  { id: 'b7', rango: '+300 días', detalle: 'cartera dura', cuentas: 2, monto: 143_800, tono: 'critica' },
] as const;
export type Bucket = (typeof BUCKETS)[number];

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
    texto: '{{contacto}}, la factura {{folio}} por {{monto}} venció ayer. Puede liquidarla aquí: {{liga}}. Si ya pagó, compártanos el comprobante para registrarlo.' },
  { id: 'B', etapa: 'Etapa B', nombre: 'Preguntar qué pasó', canal: 'WhatsApp', grupo: 'Vencida', estado: 'Aprobada',
    texto: 'Hola, {{contacto}}. Notamos que la factura {{folio}} sigue pendiente. ¿Hubo algún inconveniente con el pago o con la factura? Con gusto lo resolvemos juntos.' },
  { id: 'C', etapa: 'Etapa C', nombre: 'Notificación formal', canal: 'Correo', grupo: 'Vencida', estado: 'Aprobada',
    texto: 'Estimados {{cliente}}: la factura {{folio}} por {{monto}} registra {{dias}} días de atraso. Les pedimos confirmar una fecha de pago esta semana para mantener su línea de crédito en condiciones normales. Liga de pago: {{liga}}.' },
  { id: 'D', etapa: 'Etapa D', nombre: 'Negociación (guion de llamada)', canal: 'Llamada', grupo: 'Vencida', estado: 'Aprobada',
    texto: 'Saludar a {{contacto}}, confirmar el saldo de {{monto}} de la factura {{folio}}, preguntar su capacidad de pago y ofrecer el plan pre-aprobado (hasta 3 parcialidades). Registrar acuerdo y fecha.' },
  { id: 'S1', etapa: 'Servicio', nombre: 'Validar datos de contacto', canal: 'WhatsApp', grupo: 'Servicio', estado: 'Aprobada',
    texto: 'Hola, {{contacto}}. Estamos actualizando nuestros registros: ¿sigue siendo usted el contacto de pagos de {{cliente}}? Si cambió, ¿nos comparte el nombre de la persona de tesorería?' },
  { id: 'E1', etapa: 'Especial', nombre: 'Buen Fin · parcialidades sin recargo', canal: 'WhatsApp', grupo: 'Especial', estado: 'En revisión',
    texto: '{{contacto}}, del 13 al 16 de noviembre puede liquidar su saldo de {{monto}} en hasta 3 parcialidades sin recargo. Aproveche aquí: {{liga}}.' },
];

// ── Campañas ───────────────────────────────────────────────────────────
export type Campana = {
  id: string;
  nombre: string;
  tipo: 'Bloque' | 'Especial' | 'Servicio';
  bucket: string;
  plantilla: string;
  canal: string;
  cuentas: number;
  estado: 'Activa' | 'Programada' | 'Borrador';
  detalle: string;
  respuesta?: number;
};

export const CAMPANAS: Campana[] = [
  { id: 'c1', nombre: 'Preventiva · vencen esta semana', tipo: 'Bloque', bucket: 'Por vencer', plantilla: 'N2', canal: 'WhatsApp', cuentas: 24, estado: 'Activa', detalle: '18 enviados hoy', respuesta: 61 },
  { id: 'c2', nombre: 'Recuperación 31–60 días', tipo: 'Bloque', bucket: '31–60 días', plantilla: 'C', canal: 'Correo', cuentas: 7, estado: 'Programada', detalle: 'Sale el lun 29 sep, 9:00' },
  { id: 'c3', nombre: 'Validación de contactos', tipo: 'Servicio', bucket: 'Toda la cartera', plantilla: 'S1', canal: 'WhatsApp', cuentas: 64, estado: 'Activa', detalle: '12 contactos actualizados', respuesta: 44 },
  { id: 'c4', nombre: 'Buen Fin · 3 parcialidades', tipo: 'Especial', bucket: '61–90 días', plantilla: 'E1', canal: 'WhatsApp', cuentas: 4, estado: 'Borrador', detalle: 'Ventana 13–16 nov' },
];

// ── Gestiones (base de reportes) ───────────────────────────────────────
export const RESULTADOS = ['Promesa de pago', 'Pagó', 'Sin respuesta', 'Disputa', 'Escalado', 'No gestionada'] as const;
export type Resultado = (typeof RESULTADOS)[number];
export const LINEAS = ['Materiales', 'Servicios', 'Logística'] as const;

export type Gestion = {
  fecha: string; // YYYY-MM-DD
  hora: string; // HH:MM
  agente: Agente;
  cliente: string;
  linea: (typeof LINEAS)[number];
  resultado: Resultado;
  monto: number;
};

export const GESTIONES: Gestion[] = [
  { fecha: '2026-09-22', hora: '09:14', agente: 'María Jiménez', cliente: 'Distribuidora del Norte', linea: 'Materiales', resultado: 'Promesa de pago', monto: 284_500 },
  { fecha: '2026-09-22', hora: '11:40', agente: 'Ana Robles', cliente: 'Logística Andrade', linea: 'Logística', resultado: 'Pagó', monto: 47_100 },
  { fecha: '2026-09-22', hora: '16:05', agente: 'Carlos Mendoza', cliente: 'Grupo Ferretero Bajío', linea: 'Materiales', resultado: 'Sin respuesta', monto: 98_400 },
  { fecha: '2026-09-23', hora: '10:22', agente: 'Ana Robles', cliente: 'Materiales Peninsulares', linea: 'Materiales', resultado: 'Promesa de pago', monto: 78_100 },
  { fecha: '2026-09-23', hora: '12:48', agente: 'María Jiménez', cliente: 'Constructora Vanguardia', linea: 'Servicios', resultado: 'Escalado', monto: 288_400 },
  { fecha: '2026-09-23', hora: '17:30', agente: 'Carlos Mendoza', cliente: 'Comercializadora Lumen', linea: 'Servicios', resultado: 'Sin respuesta', monto: 74_300 },
  { fecha: '2026-09-24', hora: '09:05', agente: 'Ana Robles', cliente: 'Transportes del Pacífico', linea: 'Logística', resultado: 'Disputa', monto: 126_300 },
  { fecha: '2026-09-24', hora: '13:12', agente: 'María Jiménez', cliente: 'Refaccionaria Occidente', linea: 'Materiales', resultado: 'Pagó', monto: 44_900 },
  { fecha: '2026-09-24', hora: '18:40', agente: 'Carlos Mendoza', cliente: 'Grupo Ferretero Bajío', linea: 'Materiales', resultado: 'Escalado', monto: 98_400 },
  { fecha: '2026-09-25', hora: '10:02', agente: 'Ana Robles', cliente: 'Grupo Textil Aurora', linea: 'Servicios', resultado: 'Promesa de pago', monto: 91_200 },
  { fecha: '2026-09-25', hora: '15:26', agente: 'María Jiménez', cliente: 'Distribuidora del Norte', linea: 'Materiales', resultado: 'Sin respuesta', monto: 199_150 },
  { fecha: '2026-09-26', hora: '09:48', agente: 'Carlos Mendoza', cliente: 'Comercializadora Lumen', linea: 'Servicios', resultado: 'Promesa de pago', monto: 74_300 },
  { fecha: '2026-09-26', hora: '12:15', agente: 'Ana Robles', cliente: 'Distribuidora Baja', linea: 'Logística', resultado: 'Sin respuesta', monto: 58_000 },
  { fecha: '2026-09-26', hora: '16:55', agente: 'María Jiménez', cliente: 'Constructora Vanguardia', linea: 'Servicios', resultado: 'Promesa de pago', monto: 288_400 },
  { fecha: '2026-09-27', hora: '08:30', agente: 'Carlos Mendoza', cliente: 'Agroinsumos del Valle', linea: 'Materiales', resultado: 'No gestionada', monto: 67_800 },
  { fecha: '2026-09-27', hora: '08:30', agente: 'Ana Robles', cliente: 'Transportes del Pacífico', linea: 'Logística', resultado: 'No gestionada', monto: 126_300 },
  { fecha: '2026-09-27', hora: '08:30', agente: 'María Jiménez', cliente: 'Papelera Industrial Sur', linea: 'Materiales', resultado: 'No gestionada', monto: 38_600 },
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
  { id: 'm1', fecha: '27 sep', referencia: 'SPEI 8841207 LOGISTICA ANDRADE', monto: 15_700, sugerencia: 'Logística Andrade · F-2915', confianza: 'alta' },
  { id: 'm2', fecha: '27 sep', referencia: 'DEP 00392 MAT PENINSULARES', monto: 39_050, sugerencia: 'Materiales Peninsulares · F-2903 (parcial)', confianza: 'media' },
  { id: 'm3', fecha: '26 sep', referencia: 'SPEI 7712093 SIN REFERENCIA', monto: 12_400, sugerencia: null, confianza: 'baja' },
];

// ── Contactos de finanzas (obligatorio en B2B) ─────────────────────────
export type ContactoFinanzas = {
  cliente: string;
  registrado: string; // quien sí está en la base (director/dueño)
  finanzas: { nombre: string; puesto: string; telefono: string } | null;
};

export const CONTACTOS: ContactoFinanzas[] = [
  { cliente: 'Distribuidora del Norte', registrado: 'Lic. Arturo Garza · Director general', finanzas: { nombre: 'Patricia Salas', puesto: 'Tesorería', telefono: '81 2231 0045' } },
  { cliente: 'Materiales Peninsulares', registrado: 'Sr. Manuel Poot · Dueño', finanzas: { nombre: 'Jorge Canché', puesto: 'Cuentas por pagar', telefono: '999 214 7730' } },
  { cliente: 'Grupo Ferretero Bajío', registrado: 'Ing. Raúl Bravo · Director general', finanzas: null },
  { cliente: 'Logística Andrade', registrado: 'Sr. Tomás Andrade · Dueño', finanzas: { nombre: 'Rocío Andrade', puesto: 'Tesorería', telefono: '33 1845 2290' } },
  { cliente: 'Constructora Vanguardia', registrado: 'Arq. Elena Duarte · Directora', finanzas: null },
  { cliente: 'Comercializadora Lumen', registrado: 'Lic. Pablo Ortiz · Director', finanzas: { nombre: 'Daniela Ortiz', puesto: 'Finanzas', telefono: '55 4410 8812' } },
];

// ── Asignación de cuentas (supervisor puede cambiar de agente) ─────────
export const ASIGNACIONES: { cliente: string; saldo: number; dias: number; agente: Agente }[] = [
  { cliente: 'Distribuidora del Norte', saldo: 199_150, dias: 42, agente: 'María Jiménez' },
  { cliente: 'Grupo Ferretero Bajío', saldo: 98_400, dias: 35, agente: 'Carlos Mendoza' },
  { cliente: 'Materiales Peninsulares', saldo: 78_100, dias: 28, agente: 'Ana Robles' },
  { cliente: 'Constructora Vanguardia', saldo: 288_400, dias: 19, agente: 'María Jiménez' },
  { cliente: 'Transportes del Pacífico', saldo: 126_300, dias: 7, agente: 'Ana Robles' },
  { cliente: 'Logística Andrade', saldo: 15_700, dias: 12, agente: 'Ana Robles' },
  { cliente: 'Comercializadora Lumen', saldo: 74_300, dias: -5, agente: 'Carlos Mendoza' },
];

// ── Vista del agente: sus cuentas de hoy ───────────────────────────────
export type CuentaAgente = {
  id: string;
  cliente: string;
  contacto: string;
  puesto: string;
  telefono: string;
  ciudad: string;
  zona: string;
  horaLocal: string;
  contactable: boolean;
  motivo?: string;
  saldo: number;
  dias: number; // negativo = faltan días para vencer
  folio: string;
  fecha: string;
  plantilla: string; // id de PLANTILLAS
};

export const MIS_CUENTAS: CuentaAgente[] = [
  { id: 'a1', cliente: 'Transportes del Pacífico', contacto: 'Héctor Ruiz', puesto: 'Tesorería', telefono: '669 118 4402', ciudad: 'Mazatlán', zona: 'UTC-7', horaLocal: '10:20', contactable: true, saldo: 126_300, dias: 7, folio: 'F-2934', fecha: '21 sep', plantilla: 'B' },
  { id: 'a2', cliente: 'Materiales Peninsulares', contacto: 'Jorge Canché', puesto: 'Cuentas por pagar', telefono: '999 214 7730', ciudad: 'Mérida', zona: 'UTC-6', horaLocal: '11:20', contactable: true, saldo: 78_100, dias: 28, folio: 'F-2903', fecha: '31 ago', plantilla: 'C' },
  { id: 'a3', cliente: 'Refaccionaria Occidente', contacto: 'Laura Méndez', puesto: 'Finanzas', telefono: '33 3627 1190', ciudad: 'Guadalajara', zona: 'UTC-6', horaLocal: '11:20', contactable: true, saldo: 44_900, dias: -3, folio: 'F-2958', fecha: '1 oct', plantilla: 'N3' },
  { id: 'a4', cliente: 'Logística Andrade', contacto: 'Rocío Andrade', puesto: 'Tesorería', telefono: '33 1845 2290', ciudad: 'Guadalajara', zona: 'UTC-6', horaLocal: '11:20', contactable: true, saldo: 15_700, dias: 12, folio: 'F-2915', fecha: '16 sep', plantilla: 'B' },
  { id: 'a5', cliente: 'Distribuidora Baja', contacto: 'Iván Castro', puesto: 'Tesorería', telefono: '664 902 3318', ciudad: 'Tijuana', zona: 'UTC-8', horaLocal: '8:20', contactable: false, motivo: 'Fuera de horario · se puede desde las 9:00', saldo: 58_000, dias: 1, folio: 'F-2947', fecha: '27 sep', plantilla: 'A' },
  { id: 'a6', cliente: 'Grupo Textil Aurora', contacto: 'Mónica Leal', puesto: 'Finanzas', telefono: '222 581 7764', ciudad: 'Puebla', zona: 'UTC-6', horaLocal: '11:20', contactable: false, motivo: 'Promesa de pago vigente hasta el 30 sep', saldo: 91_200, dias: 18, folio: 'F-2921', fecha: '10 sep', plantilla: 'B' },
];

export function llenarPlantilla(texto: string, c: CuentaAgente, monto: string): string {
  return texto
    .replaceAll('{{cliente}}', c.cliente)
    .replaceAll('{{contacto}}', c.contacto)
    .replaceAll('{{folio}}', c.folio)
    .replaceAll('{{monto}}', monto)
    .replaceAll('{{fecha}}', c.fecha)
    .replaceAll('{{dias}}', String(Math.abs(c.dias)))
    .replaceAll('{{liga}}', 'pagar.royaltica.com/' + c.folio.toLowerCase());
}
