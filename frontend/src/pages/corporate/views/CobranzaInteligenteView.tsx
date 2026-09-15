import React from 'react';
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from 'motion/react';
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  Info,
  Mail,
  MessageSquare,
  Phone,
  Scale,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { CURRENCY_FORMATTER } from '../../../utils/format.ts';

/**
 * Módulo 2. Cerebro interno de Cuentas por Cobrar.
 *
 * PROTOTIPO VISUAL: todos los datos de esta vista son de ejemplo, definidos
 * abajo en `MOCK`. No hay ninguna llamada al backend todavía. El objetivo es
 * validar la forma de los tableros e indicadores antes de construir el API
 * (ver el plan de ejecución del Módulo 2).
 *
 * Cuando exista el backend, cada panel cambia su fuente de datos por el
 * endpoint correspondiente y el resto del componente se queda igual.
 */

type Section =
  | 'prioridades'
  | 'alertas'
  | 'recordatorios'
  | 'estrategias'
  | 'perfiles'
  | 'equipo';

const sections: { id: Section; label: string }[] = [
  { id: 'prioridades', label: 'Prioridades' },
  { id: 'alertas', label: 'Alertas' },
  { id: 'recordatorios', label: 'Recordatorios' },
  { id: 'estrategias', label: 'Estrategias' },
  { id: 'perfiles', label: 'Perfiles' },
  { id: 'equipo', label: 'Equipo' },
];

// ─── Primitivas de movimiento ────────────────────────────────────────
// Sistema de movimiento del módulo. Cada animación responde a una razón:
// jerarquía (qué mirar primero), transición de estado (este número cambió)
// o retroalimentación (tu clic hizo algo). Nada se mueve por decoración.
//
// Todo se degrada a estático bajo `prefers-reduced-motion`, y ninguna
// animación toca layout: solo `transform` y `opacity`, más `width` en las
// barras, que están aisladas y no reflowean el resto de la página.

const EASE = [0.16, 1, 0.3, 1] as const;

/** Entrada escalonada: ordena la lectura de arriba hacia abajo. */
function Reveal({
  children,
  delay = 0,
  className = '',
}: {
  // Convención del proyecto: un componente que recibe `key` debe declararla.
  key?: string;
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: reduce ? 0 : delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

type FigureFormat = 'entero' | 'moneda' | 'porcentaje' | 'dias';

const FORMATTERS: Record<FigureFormat, (v: number) => string> = {
  entero: (v) => String(Math.round(v)),
  moneda: (v) => CURRENCY_FORMATTER.format(Math.round(v)),
  porcentaje: (v) => `${Math.round(v)}%`,
  dias: (v) => `${Math.round(v)}`,
};

/**
 * Cifra que transiciona al cambiar de valor. La animación comunica un
 * cambio de estado real (cambiaste de cuenta, moviste el simulador), no
 * es un adorno de carga: por eso solo corre cuando `value` cambia.
 */
function Figure({
  value,
  format = 'entero',
  className = '',
}: {
  value: number;
  format?: FigureFormat;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const mv = useMotionValue(value);
  const text = useTransform(mv, FORMATTERS[format]);

  React.useEffect(() => {
    if (reduce) {
      mv.set(value);
      return;
    }
    const controls = animate(mv, value, { duration: 0.5, ease: EASE });
    return () => controls.stop();
  }, [value, reduce, mv]);

  return (
    <motion.span className={`tabular-nums ${className}`}>
      {reduce ? FORMATTERS[format](value) : text}
    </motion.span>
  );
}

/**
 * Barra de proporción. Crece desde cero para que el ojo lea la magnitud
 * relativa antes que el número exacto.
 */
function Bar({
  value,
  tone = 'ink',
  delay = 0,
}: {
  value: number;
  tone?: 'ink' | 'accent' | 'positivo' | 'negativo';
  delay?: number;
}) {
  const reduce = useReducedMotion();
  const fill = {
    ink: 'bg-brand-ink/70',
    accent: 'bg-brand-gold',
    positivo: 'bg-emerald-600',
    negativo: 'bg-rose-500',
  }[tone];

  return (
    <div className="h-1 bg-brand-ink/8 rounded-full overflow-hidden">
      <motion.div
        className={`h-full rounded-full ${fill}`}
        initial={reduce ? false : { width: 0 }}
        animate={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        transition={{ duration: 0.7, delay: reduce ? 0 : delay, ease: EASE }}
      />
    </div>
  );
}

// ─── Datos de ejemplo ────────────────────────────────────────────────
// Reemplazar por llamadas reales al API cuando exista el Módulo 2.

const MOCK = {
  // Una sola lista: la prioridad de trabajo y el riesgo de cada cuenta son la
  // misma cosa vista desde dos ángulos, así que viven en el mismo registro.
  // `score` NO se guarda: se calcula de los factores (ver `scoreOf`), para que
  // el número que se muestra siempre cuadre con su desglose.
  cartera: [
    {
      cliente: 'Distribuidora del Norte',
      folio: 'F-2841',
      monto: 284_500,
      diasVencido: 42,
      tendencia: 'sube' as const,
      razon: 'Monto alto + puntualidad histórica cayó de 92% a 61% en 3 meses',
      accion: 'Llamada del encargado',
      urgencia: 'alta' as const,
      factores: [
        { nombre: 'Puntualidad histórica', peso: 40, valor: 66 },
        { nombre: 'Concentración en cartera', peso: 30, valor: 88 },
        { nombre: 'Tendencia reciente', peso: 30, valor: 84 },
      ],
    },
    {
      cliente: 'Materiales Peninsulares',
      folio: 'F-2903',
      monto: 156_200,
      diasVencido: 28,
      tendencia: 'estable' as const,
      razon: 'Buen historial, primer atraso relevante en 2 años',
      accion: 'Recordatorio tono suave',
      urgencia: 'media' as const,
      factores: [
        { nombre: 'Puntualidad histórica', peso: 40, valor: 37 },
        { nombre: 'Concentración en cartera', peso: 30, valor: 61 },
        { nombre: 'Tendencia reciente', peso: 30, valor: 70 },
      ],
    },
    {
      cliente: 'Grupo Ferretero Bajío',
      folio: 'F-2877',
      monto: 98_400,
      diasVencido: 35,
      tendencia: 'sube' as const,
      razon: 'Tercer atraso consecutivo, no respondió los últimos 2 mensajes',
      accion: 'Escalar a humano',
      urgencia: 'alta' as const,
      factores: [
        { nombre: 'Puntualidad histórica', peso: 40, valor: 77 },
        { nombre: 'Concentración en cartera', peso: 30, valor: 42 },
        { nombre: 'Tendencia reciente', peso: 30, valor: 92 },
      ],
    },
    {
      cliente: 'Logística Andrade',
      folio: 'F-2915',
      monto: 62_800,
      diasVencido: 12,
      tendencia: 'baja' as const,
      razon: 'Paga tarde pero siempre paga. Su patrón normal son 15 días',
      accion: 'Esperar (no contactar)',
      urgencia: 'baja' as const,
      factores: [
        { nombre: 'Puntualidad histórica', peso: 40, valor: 18 },
        { nombre: 'Concentración en cartera', peso: 30, valor: 24 },
        { nombre: 'Tendencia reciente', peso: 30, valor: 26 },
      ],
    },
    {
      cliente: 'Constructora Vanguardia',
      folio: 'F-2860',
      monto: 412_000,
      diasVencido: 19,
      tendencia: 'estable' as const,
      razon: 'Monto muy alto. Vigilar aunque el atraso aún es moderado',
      accion: 'Recordatorio estándar',
      urgencia: 'media' as const,
      factores: [
        { nombre: 'Puntualidad histórica', peso: 40, valor: 20 },
        { nombre: 'Concentración en cartera', peso: 30, valor: 96 },
        { nombre: 'Tendencia reciente', peso: 30, valor: 28 },
      ],
    },
  ],
  alertas: [
    {
      severidad: 'critica' as const,
      titulo: 'Concentración de riesgo en un solo cliente',
      detalle:
        'El 34% de tu cartera vencida depende de Distribuidora del Norte. Si esa cuenta se deteriora, el impacto es desproporcionado.',
      cuando: 'Detectado hoy',
    },
    {
      severidad: 'alta' as const,
      titulo: 'Grupo Ferretero Bajío está pagando más lento',
      detalle:
        'Sus últimos 3 pagos tardaron 38, 44 y 51 días. Su promedio histórico era 29. La tendencia lleva 3 meses empeorando.',
      cuando: 'Hace 2 días',
    },
    {
      severidad: 'media' as const,
      titulo: '4 facturas vencen esta semana sin recordatorio programado',
      detalle:
        'Suman $318,400 MXN. Ninguna tiene secuencia de cobranza activa porque se importaron después del último ciclo.',
      cuando: 'Hace 4 horas',
    },
    {
      severidad: 'media' as const,
      titulo: 'Materiales Peninsulares rompió su patrón',
      detalle:
        'Cliente con 24 meses de pagos puntuales registró su primer atraso mayor a 15 días. Conviene entender qué cambió antes de presionar.',
      cuando: 'Hace 1 día',
    },
  ],
  recordatorios: [
    {
      cliente: 'Distribuidora del Norte',
      encargado: 'María Jiménez',
      enviados: 18,
      tasa: 72,
      ultimo: 'hace 2 días',
      mejor: { canal: 'WhatsApp', tono: 'Estándar', hora: '9-11h', estrategia: 'Recordatorio con liga de pago' },
      nota: 'No responde correo. Por WhatsApp contesta casi siempre en la mañana.',
      plan: {
        proxima: { accion: 'Llamada del encargado', canal: 'Llamada', cuando: 'mañana 9:30' },
        pasos: [
          { dia: '-5', fase: 'temprana' as const, accion: 'Aviso preventivo', canal: 'WhatsApp', tono: 'Suave', estado: 'hecho' as const, resultado: 'Respondió' },
          { dia: '0', fase: 'temprana' as const, accion: 'Aviso de vencimiento', canal: 'WhatsApp', tono: 'Suave', estado: 'hecho' as const, resultado: 'Sin respuesta' },
          { dia: '+3', fase: 'temprana' as const, accion: 'Primer recordatorio', canal: 'WhatsApp', tono: 'Suave', estado: 'hecho' as const, resultado: 'Sin respuesta' },
          { dia: '+7', fase: 'seguimiento' as const, accion: 'Recordatorio con liga de pago', canal: 'WhatsApp', tono: 'Estándar', estado: 'hecho' as const, resultado: 'Respondió' },
          { dia: '+15', fase: 'seguimiento' as const, accion: 'Segundo intento con liga', canal: 'WhatsApp', tono: 'Estándar', estado: 'hecho' as const, resultado: 'Sin respuesta' },
          { dia: '+45', fase: 'escalamiento' as const, accion: 'Llamada del encargado', canal: 'Llamada', tono: 'Firme', estado: 'actual' as const },
          { dia: '+60', fase: 'escalamiento' as const, accion: 'Propuesta de plan de pagos', canal: 'Llamada', tono: 'Firme', estado: 'programado' as const },
        ],
      },
      mensajes: [
        { fecha: '02 sep 2026, 09:14', canal: 'WhatsApp', tipo: 'Recordatorio', tono: 'Estándar', nivel: 3, vencidoAlEnviar: 40, espera: '3 días', resultado: 'respondio' as const },
        { fecha: '30 ago 2026, 09:05', canal: 'WhatsApp', tipo: 'Recordatorio', tono: 'Suave', nivel: 2, vencidoAlEnviar: 37, espera: '5 días', resultado: 'sin_respuesta' as const },
        { fecha: '25 ago 2026, 16:40', canal: 'Correo', tipo: 'Recordatorio', tono: 'Suave', nivel: 1, vencidoAlEnviar: 32, espera: '7 días', resultado: 'sin_respuesta' as const },
        { fecha: '18 ago 2026, 09:10', canal: 'WhatsApp', tipo: 'Aviso de vencimiento', tono: 'Suave', nivel: 1, vencidoAlEnviar: 25, espera: 'sin siguiente', resultado: 'respondio' as const },
      ],
    },
    {
      cliente: 'Materiales Peninsulares',
      encargado: 'Ana Robles',
      enviados: 11,
      tasa: 64,
      ultimo: 'hace 5 días',
      mejor: { canal: 'Correo', tono: 'Suave', hora: '16-18h', estrategia: 'Plan de pagos en 2 parcialidades' },
      nota: 'Prefiere correo, lo revisa su área administrativa por la tarde.',
      plan: {
        proxima: { accion: 'Oferta de plan en 2 parcialidades', canal: 'Correo', cuando: 'en 2 días, 16:30' },
        pasos: [
          { dia: '-5', fase: 'temprana' as const, accion: 'Aviso preventivo', canal: 'Correo', tono: 'Suave', estado: 'hecho' as const, resultado: 'Respondió' },
          { dia: '0', fase: 'temprana' as const, accion: 'Aviso de vencimiento', canal: 'Correo', tono: 'Suave', estado: 'hecho' as const, resultado: 'Sin respuesta' },
          { dia: '+3', fase: 'temprana' as const, accion: 'Primer recordatorio', canal: 'Correo', tono: 'Suave', estado: 'hecho' as const, resultado: 'Respondió' },
          { dia: '+7', fase: 'seguimiento' as const, accion: 'Recordatorio con estado de cuenta', canal: 'Correo', tono: 'Suave', estado: 'hecho' as const, resultado: 'Sin respuesta' },
          { dia: '+30', fase: 'seguimiento' as const, accion: 'Oferta de plan en 2 parcialidades', canal: 'Correo', tono: 'Suave', estado: 'actual' as const },
          { dia: '+45', fase: 'escalamiento' as const, accion: 'Llamada del encargado', canal: 'Llamada', tono: 'Estándar', estado: 'programado' as const },
        ],
      },
      mensajes: [
        { fecha: '29 ago 2026, 16:22', canal: 'Correo', tipo: 'Oferta de plan', tono: 'Suave', nivel: 2, vencidoAlEnviar: 24, espera: '4 días', resultado: 'respondio' as const },
        { fecha: '25 ago 2026, 17:03', canal: 'Correo', tipo: 'Recordatorio', tono: 'Suave', nivel: 1, vencidoAlEnviar: 20, espera: '6 días', resultado: 'sin_respuesta' as const },
        { fecha: '19 ago 2026, 10:30', canal: 'WhatsApp', tipo: 'Recordatorio', tono: 'Suave', nivel: 1, vencidoAlEnviar: 14, espera: 'sin siguiente', resultado: 'sin_respuesta' as const },
      ],
    },
    {
      cliente: 'Grupo Ferretero Bajío',
      encargado: 'Carlos Mendoza',
      enviados: 22,
      tasa: 38,
      ultimo: 'hace 1 día',
      mejor: { canal: 'Llamada', tono: 'Firme', hora: '12-14h', estrategia: 'Escalamiento a llamada del encargado' },
      nota: 'Responde poco por texto. El tono suave no genera respuesta con esta cuenta.',
      plan: {
        proxima: { accion: 'Escalar a encargado humano', canal: 'Llamada', cuando: 'hoy 12:30' },
        pasos: [
          { dia: '-5', fase: 'temprana' as const, accion: 'Aviso preventivo', canal: 'WhatsApp', tono: 'Suave', estado: 'hecho' as const, resultado: 'Sin respuesta' },
          { dia: '0', fase: 'temprana' as const, accion: 'Aviso de vencimiento', canal: 'Correo', tono: 'Suave', estado: 'hecho' as const, resultado: 'Sin respuesta' },
          { dia: '+3', fase: 'temprana' as const, accion: 'Primer recordatorio', canal: 'WhatsApp', tono: 'Estándar', estado: 'hecho' as const, resultado: 'Sin respuesta' },
          { dia: '+15', fase: 'seguimiento' as const, accion: 'Recordatorio en tono firme', canal: 'WhatsApp', tono: 'Firme', estado: 'hecho' as const, resultado: 'Sin respuesta' },
          { dia: '+35', fase: 'escalamiento' as const, accion: 'Escalar a encargado humano', canal: 'Llamada', tono: 'Firme', estado: 'actual' as const },
          { dia: '+50', fase: 'escalamiento' as const, accion: 'Revisión de crédito con dirección', canal: 'Llamada', tono: 'Firme', estado: 'programado' as const },
        ],
      },
      mensajes: [
        { fecha: '03 sep 2026, 12:45', canal: 'Llamada', tipo: 'Escalamiento', tono: 'Firme', nivel: 4, vencidoAlEnviar: 34, espera: '2 días', resultado: 'respondio' as const },
        { fecha: '01 sep 2026, 12:10', canal: 'WhatsApp', tipo: 'Recordatorio', tono: 'Firme', nivel: 3, vencidoAlEnviar: 32, espera: '4 días', resultado: 'sin_respuesta' as const },
        { fecha: '28 ago 2026, 09:20', canal: 'WhatsApp', tipo: 'Recordatorio', tono: 'Estándar', nivel: 2, vencidoAlEnviar: 28, espera: '5 días', resultado: 'sin_respuesta' as const },
        { fecha: '23 ago 2026, 09:15', canal: 'Correo', tipo: 'Recordatorio', tono: 'Suave', nivel: 1, vencidoAlEnviar: 23, espera: 'sin siguiente', resultado: 'sin_respuesta' as const },
      ],
    },
    {
      cliente: 'Logística Andrade',
      encargado: 'Ana Robles',
      enviados: 9,
      tasa: 91,
      ultimo: 'hace 8 días',
      mejor: { canal: 'WhatsApp', tono: 'Suave', hora: '9-11h', estrategia: 'Recordatorio simple, sin insistir' },
      nota: 'Responde casi siempre. Basta un recordatorio amable.',
      plan: {
        proxima: { accion: 'Recordatorio simple, sin insistir', canal: 'WhatsApp', cuando: 'en 3 días, 9:30' },
        pasos: [
          { dia: '-5', fase: 'temprana' as const, accion: 'Aviso preventivo', canal: 'WhatsApp', tono: 'Suave', estado: 'hecho' as const, resultado: 'Respondió' },
          { dia: '0', fase: 'temprana' as const, accion: 'Aviso de vencimiento', canal: 'WhatsApp', tono: 'Suave', estado: 'hecho' as const, resultado: 'Pagó parcial' },
          { dia: '+15', fase: 'temprana' as const, accion: 'Recordatorio simple, sin insistir', canal: 'WhatsApp', tono: 'Suave', estado: 'actual' as const },
          { dia: '+25', fase: 'seguimiento' as const, accion: 'Recordatorio con liga de pago', canal: 'WhatsApp', tono: 'Suave', estado: 'programado' as const },
          { dia: '+40', fase: 'escalamiento' as const, accion: 'Llamada del encargado', canal: 'Llamada', tono: 'Estándar', estado: 'programado' as const },
        ],
      },
      mensajes: [
        { fecha: '26 ago 2026, 09:32', canal: 'WhatsApp', tipo: 'Recordatorio', tono: 'Suave', nivel: 1, vencidoAlEnviar: 9, espera: '2 días', resultado: 'pago' as const },
        { fecha: '19 ago 2026, 09:40', canal: 'WhatsApp', tipo: 'Aviso de vencimiento', tono: 'Suave', nivel: 1, vencidoAlEnviar: 2, espera: 'sin siguiente', resultado: 'respondio' as const },
      ],
    },
    {
      cliente: 'Constructora Vanguardia',
      encargado: 'María Jiménez',
      enviados: 6,
      tasa: 50,
      ultimo: 'hace 3 días',
      mejor: { canal: 'Correo', tono: 'Estándar', hora: '8-10h', estrategia: 'Recordatorio con estado de cuenta adjunto' },
      nota: 'Cuenta grande, requiere formalidad. Responde mejor con documento adjunto.',
      plan: {
        proxima: { accion: 'Recordatorio con estado de cuenta', canal: 'Correo', cuando: 'mañana 8:30' },
        pasos: [
          { dia: '-7', fase: 'temprana' as const, accion: 'Aviso preventivo (cuenta grande)', canal: 'Correo', tono: 'Estándar', estado: 'hecho' as const, resultado: 'Respondió' },
          { dia: '0', fase: 'temprana' as const, accion: 'Aviso de vencimiento', canal: 'Correo', tono: 'Suave', estado: 'hecho' as const, resultado: 'Sin respuesta' },
          { dia: '+20', fase: 'temprana' as const, accion: 'Recordatorio con estado de cuenta', canal: 'Correo', tono: 'Estándar', estado: 'actual' as const },
          { dia: '+35', fase: 'seguimiento' as const, accion: 'Confirmación con área administrativa', canal: 'Llamada', tono: 'Estándar', estado: 'programado' as const },
          { dia: '+50', fase: 'escalamiento' as const, accion: 'Escalar a dirección de finanzas', canal: 'Llamada', tono: 'Firme', estado: 'programado' as const },
        ],
      },
      mensajes: [
        { fecha: '01 sep 2026, 08:30', canal: 'Correo', tipo: 'Recordatorio', tono: 'Estándar', nivel: 2, vencidoAlEnviar: 17, espera: '6 días', resultado: 'respondio' as const },
        { fecha: '26 ago 2026, 08:45', canal: 'Correo', tipo: 'Aviso de vencimiento', tono: 'Suave', nivel: 1, vencidoAlEnviar: 11, espera: 'sin siguiente', resultado: 'sin_respuesta' as const },
      ],
    },
  ],
  estrategias: {
    efectividad: {
      enviados: 412,
      respondidos: 247,
      cobradasTrasContacto: 168,
      diasAhorrados: 9,
    },
    funcionan: [
      { nombre: 'Recordatorio con liga de pago incluida', exito: 81, usos: 96, nota: 'Resuelve en el momento, el cliente no tiene que buscar los datos.' },
      { nombre: 'Plan de pagos en parcialidades', exito: 74, usos: 38, nota: 'Convierte un "no puedo" en un acuerdo. Solo con planes pre-aprobados.' },
      { nombre: 'Aviso 3 días antes del vencimiento', exito: 69, usos: 124, nota: 'Previene el atraso en vez de perseguirlo después.' },
      { nombre: 'Escalamiento a llamada del encargado', exito: 62, usos: 27, nota: 'Funciona en cuentas grandes que ignoran el texto.' },
    ],
    noFuncionan: [
      { nombre: 'Insistir 3+ veces en la misma semana', exito: 12, usos: 41, nota: 'Baja la tasa de respuesta y deteriora la relación. Roza el hostigamiento.' },
      { nombre: 'Correo sin asunto personalizado', exito: 19, usos: 63, nota: 'Se pierde en la bandeja. El folio en el asunto sube la apertura.' },
      { nombre: 'Tono firme en el primer contacto', exito: 23, usos: 34, nota: 'Genera fricción con clientes que solo se distrajeron.' },
      { nombre: 'Mensajes fuera de horario laboral', exito: 8, usos: 19, nota: 'Sin respuesta, y además fuera de la ventana permitida.' },
    ],
  },
  perfiles: [
    {
      nombre: 'El distraído puntual',
      clientes: 38,
      descripcion: 'Paga bien, pero se le pasa la fecha. Un recordatorio basta.',
      tono: 'Suave',
      horario: '9-11h',
      canal: 'WhatsApp',
      estrategia: 'Aviso 3 días antes del vencimiento',
      exito: 88,
    },
    {
      nombre: 'El que siempre negocia',
      clientes: 17,
      descripcion: 'Puede pagar, pero pide plazo o descuento cada vez.',
      tono: 'Estándar',
      horario: '16-18h',
      canal: 'Correo',
      estrategia: 'Ofrecer plan de parcialidades desde el inicio',
      exito: 71,
    },
    {
      nombre: 'El silencioso',
      clientes: 12,
      descripcion: 'No contesta mensajes, pero reacciona a la llamada.',
      tono: 'Firme',
      horario: '12-14h',
      canal: 'Llamada',
      estrategia: 'Escalar a llamada tras 2 mensajes sin respuesta',
      exito: 54,
    },
    {
      nombre: 'El formal corporativo',
      clientes: 9,
      descripcion: 'Cuenta grande con área administrativa. Requiere documento.',
      tono: 'Estándar',
      horario: '8-10h',
      canal: 'Correo',
      estrategia: 'Recordatorio con estado de cuenta adjunto',
      exito: 66,
    },
  ],
  equipo: [
    {
      nombre: 'María Jiménez',
      cartera: 2_840_000,
      porCobrar: 630_000,
      recuperado: 2_210_000,
      cuentas: 34,
      pendientes: 7,
      diasProm: 31,
    },
    {
      nombre: 'Carlos Mendoza',
      cartera: 1_960_000,
      porCobrar: 780_000,
      recuperado: 1_180_000,
      cuentas: 28,
      pendientes: 14,
      diasProm: 47,
    },
    {
      nombre: 'Ana Robles',
      cartera: 3_120_000,
      porCobrar: 430_000,
      recuperado: 2_690_000,
      cuentas: 41,
      pendientes: 4,
      diasProm: 26,
    },
  ],
};

// ─── Vista principal ─────────────────────────────────────────────────

export function CobranzaInteligenteView() {
  const [section, setSection] = React.useState<Section>('prioridades');
  const reduce = useReducedMotion();

  return (
    <div className="pb-12 max-w-[1400px]">
      {/* Encabezado */}
      <Reveal>
        <p className="text-[10px] uppercase tracking-[0.28em] font-semibold text-brand-ink/35">
          Cobranza inteligente
        </p>
        <h2 className="text-[2.5rem] leading-[1.05] font-serif text-brand-ink mt-2">
          Control interno de cartera
        </h2>
        <p className="text-sm text-brand-ink/55 max-w-[62ch] mt-3 leading-relaxed">
          Analiza la cartera completa: a quién cobrar primero y por qué, qué cuentas se están
          deteriorando y qué forma de contacto funciona con cada cliente.
        </p>
      </Reveal>

      {/* Navegación de secciones: una sola línea, con indicador deslizante.
          El indicador se mueve entre pestañas (layoutId) en vez de aparecer
          y desaparecer, para que la transición confirme el clic. */}
      <Reveal delay={0.06}>
        <nav
          className="mt-8 border-b border-brand-ink/10 flex gap-1 overflow-x-auto scrollbar-custom"
          aria-label="Secciones de cobranza"
        >
          {sections.map((s) => {
            const activa = section === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setSection(s.id)}
                aria-current={activa ? 'page' : undefined}
                className={`relative shrink-0 px-4 py-3 text-[13px] font-semibold transition-colors duration-200 ${
                  activa ? 'text-brand-ink' : 'text-brand-ink/40 hover:text-brand-ink/70'
                }`}
              >
                {s.label}
                {activa && (
                  <motion.span
                    layoutId={reduce ? undefined : 'seccion-activa'}
                    className="absolute left-3 right-3 -bottom-px h-0.5 bg-brand-gold rounded-full"
                    transition={{ duration: 0.32, ease: EASE }}
                  />
                )}
              </button>
            );
          })}
        </nav>
      </Reveal>

      <Reveal delay={0.1}>
        <PrototypeNotice />
      </Reveal>

      {/* El panel entra con un desplazamiento mínimo: confirma que el
          contenido cambió sin hacer esperar a quien ya sabe a dónde va. */}
      <motion.div
        key={section}
        initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: EASE }}
      >
        {section === 'prioridades' && <PrioridadesPanel />}
        {section === 'alertas' && <AlertasPanel />}
        {section === 'recordatorios' && <RecordatoriosPanel />}
        {section === 'estrategias' && <EstrategiasPanel />}
        {section === 'perfiles' && <PerfilesPanel />}
        {section === 'equipo' && <EquipoPanel />}
      </motion.div>
    </div>
  );
}

/** Aviso permanente: nada de lo que se ve aquí viene de datos reales todavía. */
function PrototypeNotice() {
  return (
    <div className="my-7 flex items-start gap-3 pl-4 border-l-2 border-amber-400">
      <p className="text-[11px] text-brand-ink/60 leading-relaxed max-w-[75ch]">
        <span className="font-semibold text-brand-ink">Prototipo visual.</span> Los datos de esta
        sección son de ejemplo para validar el diseño. El backend del Módulo 2 aún no existe, así
        que ninguna cifra proviene de tu cartera real.
      </p>
    </div>
  );
}

// ─── 1 · Prioridades ─────────────────────────────────────────────────
// Orden sugerido de trabajo. El desglose del score de cada cuenta y el
// simulador viven en la pestaña de Recordatorios, junto al historial del
// cliente; aquí solo se muestra el score ya compuesto.

type CarteraItem = (typeof MOCK.cartera)[number];

const URGENCIA_STYLES = {
  alta: 'bg-red-100 text-red-700',
  media: 'bg-amber-100 text-amber-700',
  baja: 'bg-brand-sand/40 text-brand-ink/50',
} as const;

/**
 * Score compuesto a partir de sus factores ponderados.
 * Se calcula en vez de guardarse para que el número mostrado y su desglose
 * nunca puedan contradecirse. Es lo que sostiene el "no es una caja negra".
 */
function scoreOf(factores: readonly { peso: number; valor: number }[]): number {
  return Math.round(factores.reduce((sum, f) => sum + (f.peso * f.valor) / 100, 0));
}

/** Datos de riesgo de una cuenta, por nombre de cliente. */
function cuentaDe(cliente: string): CarteraItem | undefined {
  return MOCK.cartera.find((c) => c.cliente === cliente);
}

function PrioridadesPanel() {
  const reduce = useReducedMotion();
  const total = MOCK.cartera.reduce((sum, c) => sum + c.monto, 0);
  const requierenHumano = MOCK.cartera.filter((c) => c.urgencia === 'alta').length;
  const riesgoProm = Math.round(
    MOCK.cartera.reduce((sum, c) => sum + scoreOf(c.factores), 0) / MOCK.cartera.length,
  );

  return (
    <div className="space-y-6">
      <Reveal>
        <StatRow>
          <MiniStat
            label="En la lista de hoy"
            value=""
            numeric={MOCK.cartera.length}
            sub="cuentas priorizadas"
          />
          <MiniStat
            label="Monto en juego"
            value=""
            numeric={total}
            format="moneda"
            sub="suma de las cuentas listadas"
          />
          <MiniStat
            label="Riesgo promedio"
            value=""
            numeric={riesgoProm}
            sub="score compuesto de la lista"
          />
          <MiniStat
            label="Requieren humano"
            value=""
            numeric={requierenHumano}
            sub="el agente no las trabaja solo"
            accent
          />
        </StatRow>
      </Reveal>

      <Reveal delay={0.08}>
        <div className="bg-brand-paper border border-brand-ink/10 rounded-3xl overflow-hidden">
          <div className="px-6 py-4 flex items-center gap-2 border-b border-brand-ink/8">
            <Sparkles size={14} className="text-brand-gold" />
            <BlockTitle>Orden sugerido de trabajo</BlockTitle>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[1000px]">
              <thead>
                <tr>
                  {['Cliente', 'Monto', 'Vencido', 'Riesgo', 'Por qué está aquí', 'Acción'].map(
                    (h) => (
                      <th
                        key={h}
                        className="px-6 py-3 text-[10px] uppercase tracking-[0.14em] font-semibold text-brand-ink/35 border-b border-brand-ink/8"
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {MOCK.cartera.map((c, i) => {
                  const score = scoreOf(c.factores);
                  return (
                    <motion.tr
                      key={c.folio}
                      initial={reduce ? false : { opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{
                        duration: 0.3,
                        delay: reduce ? 0 : 0.12 + i * 0.05,
                        ease: EASE,
                      }}
                      className="group border-b border-brand-ink/6 last:border-0 hover:bg-brand-cream/60 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <span className="text-[11px] tabular-nums text-brand-ink/25 w-3">
                            {i + 1}
                          </span>
                          <div>
                            <div className="text-sm font-semibold text-brand-ink whitespace-nowrap">
                              {c.cliente}
                            </div>
                            <div className="text-[10px] text-brand-ink/35 font-mono mt-0.5">
                              {c.folio}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-base font-serif text-brand-ink tabular-nums whitespace-nowrap">
                        {CURRENCY_FORMATTER.format(c.monto)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-base font-serif text-brand-ink tabular-nums">
                          {c.diasVencido}
                        </span>
                        <span className="text-[11px] text-brand-ink/40 ml-1.5">días</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <TrendIcon tendencia={c.tendencia} />
                          <RiskChip score={score} />
                        </div>
                      </td>
                      <td className="px-6 py-4 min-w-[240px] max-w-[300px]">
                        <p className="text-xs text-brand-ink/55 leading-relaxed">{c.razon}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`audit-badge whitespace-nowrap ${URGENCIA_STYLES[c.urgencia]}`}
                        >
                          {c.accion}
                        </span>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </Reveal>
    </div>
  );
}

// ─── 2 · Alertas ─────────────────────────────────────────────────────

const SEVERIDAD = {
  critica: { rail: 'bg-rose-500', chip: 'bg-rose-50 text-rose-700', label: 'Crítica' },
  alta: { rail: 'bg-amber-400', chip: 'bg-amber-50 text-amber-700', label: 'Alta' },
  media: { rail: 'bg-brand-gold', chip: 'bg-brand-gold/10 text-brand-ink/70', label: 'Media' },
} as const;

function AlertasPanel() {
  const reduce = useReducedMotion();

  return (
    <div className="space-y-5">
      <Reveal>
        <p className="text-sm text-brand-ink/55 max-w-[62ch] leading-relaxed">
          Estas alertas se disparan por patrones, no por vencimientos. Avisan antes de que el
          problema sea evidente en el aging.
        </p>
      </Reveal>

      <div className="space-y-3">
        {MOCK.alertas.map((a, i) => {
          const s = SEVERIDAD[a.severidad];
          return (
            <Reveal key={a.titulo} delay={0.06 + i * 0.06}>
              {/* El rail de color a la izquierda carga la severidad, así el
                  ojo puede escanear la columna sin leer cada etiqueta. */}
              <motion.article
                whileHover={reduce ? undefined : { x: 3 }}
                transition={{ duration: 0.2, ease: EASE }}
                className="flex bg-brand-paper border border-brand-ink/10 rounded-2xl overflow-hidden"
              >
                <div className={`w-1 shrink-0 ${s.rail}`} aria-hidden />
                <div className="flex-1 px-6 py-5 space-y-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <h4 className="text-[15px] font-semibold text-brand-ink">{a.titulo}</h4>
                    <span className={`audit-badge ${s.chip}`}>{s.label}</span>
                    <span className="text-[11px] text-brand-ink/35 ml-auto whitespace-nowrap">
                      {a.cuando}
                    </span>
                  </div>
                  <p className="text-[13px] text-brand-ink/60 leading-relaxed max-w-[80ch]">
                    {a.detalle}
                  </p>
                </div>
              </motion.article>
            </Reveal>
          );
        })}
      </div>
    </div>
  );
}

// ─── 3 · Recordatorios enviados ──────────────────────────────────────

const RESULTADO_STYLES = {
  pago: { chip: 'bg-green-100 text-green-700', label: 'Pagó' },
  respondio: { chip: 'bg-brand-gold/20 text-brand-ink/70', label: 'Respondió' },
  sin_respuesta: { chip: 'bg-brand-sand/40 text-brand-ink/40', label: 'Sin respuesta' },
} as const;

const CANAL_ICON = {
  WhatsApp: MessageSquare,
  Correo: Mail,
  Llamada: Phone,
} as const;

type RecordatorioItem = (typeof MOCK.recordatorios)[number];
type PasoPlan = RecordatorioItem['plan']['pasos'][number];

type SubSeccion = 'resumen' | 'plan' | 'historial' | 'simulador';

const SUB_SECCIONES: { id: SubSeccion; label: string }[] = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'plan', label: 'Plan' },
  { id: 'historial', label: 'Historial' },
  { id: 'simulador', label: 'Simulador' },
];

/**
 * El expediente de cada cliente se reparte en subpestañas en vez de apilarse.
 * Antes la columna de detalle medía 2,260px (más de cuatro pantallas) contra
 * 511px de la lista: eso dejaba 1,750px de columna izquierda vacía. Con las
 * subpestañas cada vista cabe de un vistazo y las alturas se emparejan.
 */
function RecordatoriosPanel() {
  const [selected, setSelected] = React.useState(MOCK.recordatorios[0].cliente);
  const [sub, setSub] = React.useState<SubSeccion>('resumen');
  const activo = MOCK.recordatorios.find((r) => r.cliente === selected) ?? MOCK.recordatorios[0];
  const reduce = useReducedMotion();
  // El riesgo de la cuenta vive en MOCK.cartera y se enlaza por nombre de
  // cliente. Puede no existir (un cliente contactado sin factura priorizada),
  // por eso las tarjetas de riesgo y simulación se renderizan condicionadas.
  const cuenta = cuentaDe(activo.cliente);

  // Agregados de la cartera contactada: llenan el pie de la lista con algo
  // útil en vez de dejar aire muerto bajo los cinco clientes.
  const totalMensajes = MOCK.recordatorios.reduce((s, r) => s + r.enviados, 0);
  const tasaPromedio = Math.round(
    MOCK.recordatorios.reduce((s, r) => s + r.tasa, 0) / MOCK.recordatorios.length,
  );
  const enEscalamiento = MOCK.recordatorios.filter((r) =>
    r.plan.pasos.some((p) => p.estado === 'actual' && p.fase === 'escalamiento'),
  ).length;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
      {/* Lista de clientes */}
      <Reveal className="lg:col-span-2">
        <div className="bg-brand-paper border border-brand-ink/10 rounded-3xl overflow-hidden lg:sticky lg:top-4">
          <div className="px-6 py-4 border-b border-brand-ink/8">
            <BlockTitle>Clientes contactados</BlockTitle>
          </div>
          <div>
            {MOCK.recordatorios.map((r) => {
              const cuentaFila = cuentaDe(r.cliente);
              const activa = selected === r.cliente;
              const pasoActual = r.plan.pasos.find((p) => p.estado === 'actual');
              return (
                <button
                  key={r.cliente}
                  onClick={() => setSelected(r.cliente)}
                  aria-current={activa ? 'true' : undefined}
                  className={`relative w-full text-left px-6 py-4 border-b border-brand-ink/6 last:border-0 transition-colors duration-200 ${
                    activa ? 'bg-brand-cream' : 'hover:bg-brand-bone'
                  }`}
                >
                  {/* La marca de selección se desliza entre renglones en vez
                      de parpadear: confirma el clic sin cortar la lectura. */}
                  {activa && (
                    <motion.span
                      layoutId={reduce ? undefined : 'cliente-activo'}
                      className="absolute left-0 top-0 bottom-0 w-0.5 bg-brand-gold"
                      transition={{ duration: 0.3, ease: EASE }}
                    />
                  )}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-brand-ink truncate">
                        {r.cliente}
                      </div>
                      {pasoActual && (
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <FaseDot fase={pasoActual.fase} />
                          <span className="text-[11px] text-brand-ink/55 truncate">
                            {pasoActual.accion}
                          </span>
                        </div>
                      )}
                      <div className="text-[11px] text-brand-ink/35 mt-1 tabular-nums">
                        {r.enviados} mensajes · {r.tasa}% respuesta
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      {cuentaFila ? (
                        <RiskChip score={scoreOf(cuentaFila.factores)} />
                      ) : (
                        <span className="text-[11px] text-brand-ink/25">sin factura</span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Resumen de la cartera contactada */}
          <div className="grid grid-cols-3 divide-x divide-brand-ink/8 border-t border-brand-ink/10 bg-brand-bone/50">
            <ListaStat label="Mensajes" value={String(totalMensajes)} />
            <ListaStat label="Respuesta" value={`${tasaPromedio}%`} />
            <ListaStat label="Escalando" value={String(enEscalamiento)} alerta={enEscalamiento > 0} />
          </div>
        </div>
      </Reveal>

      {/* Expediente del cliente, en subpestañas */}
      <div className="lg:col-span-3">
        <motion.div
          key={activo.cliente}
          initial={reduce ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: EASE }}
          className="bg-brand-paper border border-brand-ink/10 rounded-3xl overflow-hidden"
        >
          {/* Cabecera fija del expediente */}
          <div className="px-7 pt-6 pb-0">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <BlockTitle>Cuenta seleccionada</BlockTitle>
                <h3 className="text-[1.6rem] leading-tight font-serif text-brand-ink mt-1.5">
                  {activo.cliente}
                </h3>
                <div className="flex items-center gap-2 mt-1 text-[11px] text-brand-ink/40">
                  {cuenta && <span className="font-mono">{cuenta.folio}</span>}
                  {cuenta && <span className="w-px h-3 bg-brand-ink/15" aria-hidden />}
                  <span>{activo.encargado}</span>
                </div>
              </div>
              {cuenta && (
                <span className={`audit-badge shrink-0 ${URGENCIA_STYLES[cuenta.urgencia]}`}>
                  {cuenta.accion}
                </span>
              )}
            </div>

            {/* Subpestañas: indicador deslizante, mismo lenguaje que la
                navegación principal para que se lea como el mismo sistema. */}
            <nav className="flex gap-1 mt-5 border-b border-brand-ink/10 -mx-7 px-7">
              {SUB_SECCIONES.map((s) => {
                const activa = sub === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => setSub(s.id)}
                    aria-current={activa ? 'page' : undefined}
                    className={`relative px-3.5 py-2.5 text-xs font-semibold transition-colors duration-200 ${
                      activa ? 'text-brand-ink' : 'text-brand-ink/40 hover:text-brand-ink/70'
                    }`}
                  >
                    {s.label}
                    {activa && (
                      <motion.span
                        layoutId={reduce ? undefined : 'subseccion-activa'}
                        className="absolute left-2 right-2 -bottom-px h-0.5 bg-brand-gold rounded-full"
                        transition={{ duration: 0.3, ease: EASE }}
                      />
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          <motion.div
            key={`${activo.cliente}-${sub}`}
            initial={reduce ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: EASE }}
          >
            {sub === 'resumen' && <SubResumen cuenta={cuenta} />}
            {sub === 'plan' && <SubPlan registro={activo} />}
            {sub === 'historial' && <SubHistorial registro={activo} reduce={reduce} />}
            {sub === 'simulador' && cuenta && <SimuladorCuenta cuenta={cuenta} />}
            {sub === 'simulador' && !cuenta && (
              <p className="px-7 py-8 text-sm text-brand-ink/45">
                Este cliente no tiene una factura priorizada, así que no hay nada que simular
                todavía.
              </p>
            )}
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}

function ListaStat({ label, value, alerta = false }: { label: string; value: string; alerta?: boolean }) {
  return (
    <div className="px-4 py-3 text-center">
      <div className="text-[9px] uppercase tracking-[0.12em] text-brand-ink/35">{label}</div>
      <div
        className={`text-lg font-serif mt-1 tabular-nums ${
          alerta ? 'text-rose-600' : 'text-brand-ink'
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function BestFit({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      className={`px-3.5 py-3 rounded-xl border ${
        accent ? 'bg-brand-gold/10 border-brand-gold/40' : 'bg-brand-bone border-brand-ink/8'
      }`}
    >
      <div className="text-[10px] uppercase tracking-[0.14em] text-brand-ink/35">{label}</div>
      <div className="text-sm font-semibold text-brand-ink mt-1.5">{value}</div>
    </div>
  );
}

function MsgMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-1.5">
      <dt className="text-brand-ink/40">{label}</dt>
      <dd className="text-brand-ink/75 font-semibold">{value}</dd>
    </div>
  );
}

/**
 * Simulador por cuenta: qué pasa con ESTA factura si se negocia el monto o se
 * ofrece un descuento por pronto pago. La probabilidad base sale del score de
 * riesgo del cliente, así que el mismo descuento rinde distinto en cada cuenta.
 */
function SimuladorCuenta({ cuenta }: { cuenta: CarteraItem }) {
  const [descuento, setDescuento] = React.useState(3);
  const [porcentaje, setPorcentaje] = React.useState(100);

  // Al cambiar de cuenta se reinician los controles: un escenario ajustado
  // para una factura no significa nada aplicado a otra.
  React.useEffect(() => {
    setDescuento(3);
    setPorcentaje(100);
  }, [cuenta.folio]);

  // Cálculo ILUSTRATIVO. La curva real de aceptación se calibra con el
  // histórico de la organización cuando el módulo esté conectado al backend.
  const score = scoreOf(cuenta.factores);
  const negociado = Math.round(cuenta.monto * (porcentaje / 100));
  const probBase = Math.max(0.12, (100 - score) / 100);
  const probCon = Math.min(0.95, probBase + descuento * 0.06 + (100 - porcentaje) * 0.004);
  const esperadoSin = Math.round(cuenta.monto * probBase);
  const esperadoCon = Math.round(negociado * probCon * (1 - descuento / 100));
  const delta = esperadoCon - esperadoSin;
  const diasSin = Math.round(20 + score * 0.6);
  const diasCon = Math.max(3, Math.round(diasSin - descuento * 2.2 - (100 - porcentaje) * 0.15));
  const favorable = delta >= 0;

  return (
    <section className="bg-brand-paper border border-brand-ink/10 rounded-3xl p-7 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <BlockTitle>Simulador de esta cuenta</BlockTitle>
          <h4 className="text-xl font-serif text-brand-ink mt-2">
            ¿Qué pasa si negocio la factura {cuenta.folio}?
          </h4>
        </div>
        <span className="audit-badge bg-brand-bone text-brand-ink/50 shrink-0">
          Riesgo {score}
        </span>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-7">
        {/* Controles */}
        <div className="space-y-7">
          <div className="space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <label
                htmlFor="sim-monto"
                className="text-[11px] uppercase tracking-[0.14em] font-semibold text-brand-ink/45"
              >
                Monto a negociar
              </label>
              <span className="text-xl font-serif text-brand-ink tabular-nums">
                <Figure value={negociado} format="moneda" />
              </span>
            </div>
            <input
              id="sim-monto"
              type="range"
              min={25}
              max={100}
              step={5}
              value={porcentaje}
              onChange={(e) => setPorcentaje(Number(e.target.value))}
              className="w-full accent-[var(--color-brand-gold)] cursor-pointer"
            />
            <p className="text-[11px] text-brand-ink/45 leading-relaxed">
              {porcentaje}% de {CURRENCY_FORMATTER.format(cuenta.monto)} facturados. Bajarlo simula
              aceptar un pago parcial hoy en vez de esperar el total.
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <label
                htmlFor="sim-descuento"
                className="text-[11px] uppercase tracking-[0.14em] font-semibold text-brand-ink/45"
              >
                Descuento por pronto pago
              </label>
              <span className="text-xl font-serif text-brand-ink tabular-nums">{descuento}%</span>
            </div>
            <input
              id="sim-descuento"
              type="range"
              min={0}
              max={10}
              value={descuento}
              onChange={(e) => setDescuento(Number(e.target.value))}
              className="w-full accent-[var(--color-brand-gold)] cursor-pointer"
            />
            <p className="text-[11px] text-brand-ink/45 leading-relaxed">
              El descuento mueve más la aguja en cuentas de riesgo alto. En una que ya paga bien,
              regalas margen sin ganar velocidad.
            </p>
          </div>
        </div>

        {/* Resultado, siempre como "hoy contra escenario": el valor del
            simulador está en la comparación, no en el número aislado. */}
        <div className="bg-brand-cream border border-brand-ink/8 rounded-2xl p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <span className="text-[11px] uppercase tracking-[0.16em] font-semibold text-brand-ink/45">
              Resultado proyectado
            </span>
            <span className="text-[10px] uppercase tracking-[0.14em] text-brand-ink/30">
              hoy / escenario
            </span>
          </div>

          <CompareRow
            label="Probabilidad de cobro"
            antes={`${Math.round(probBase * 100)}%`}
            despues={`${Math.round(probCon * 100)}%`}
          />
          <CompareRow
            label="Valor esperado"
            antes={CURRENCY_FORMATTER.format(esperadoSin)}
            despues={CURRENCY_FORMATTER.format(esperadoCon)}
            destacado
          />
          <CompareRow
            label="Días estimados al cobro"
            antes={`${diasSin} días`}
            despues={`${diasCon} días`}
          />

          <div className="pt-4 border-t border-brand-ink/10">
            <div className="text-[10px] uppercase tracking-[0.14em] text-brand-ink/35">
              Diferencia
            </div>
            {/* El color aquí es estado real: verde crea valor, rojo lo destruye. */}
            <div
              className={`flex items-baseline gap-1.5 text-3xl font-serif mt-1.5 ${
                favorable ? 'text-emerald-700' : 'text-rose-600'
              }`}
            >
              <span>{favorable ? '+' : '-'}</span>
              <Figure value={Math.abs(delta)} format="moneda" />
            </div>
          </div>
        </div>
      </div>

      <p className="text-[11px] text-brand-ink/40 leading-relaxed">
        Cifras ilustrativas. Simular no cambia nada real: no envía mensajes, no altera la factura ni
        compromete un descuento con el cliente.
      </p>
    </section>
  );
}

// ── Fases de la escalera de cobranza ────────────────────────────────
// La escalera arranca ANTES del vencimiento: eso es la cobranza temprana.
// El color codifica la fase, no la decora.

const FASES = {
  temprana: { label: 'Temprana', punto: 'bg-emerald-500', chip: 'bg-emerald-50 text-emerald-700', linea: 'bg-emerald-200' },
  seguimiento: { label: 'Seguimiento', punto: 'bg-amber-400', chip: 'bg-amber-50 text-amber-700', linea: 'bg-amber-200' },
  escalamiento: { label: 'Escalamiento', punto: 'bg-rose-500', chip: 'bg-rose-50 text-rose-700', linea: 'bg-rose-200' },
} as const;

function FaseDot({ fase }: { fase: keyof typeof FASES }) {
  return <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${FASES[fase].punto}`} aria-hidden />;
}

// ── Subpestaña 1 · Resumen ──────────────────────────────────────────

function SubResumen({ cuenta }: { cuenta: CarteraItem | undefined }) {
  if (!cuenta) {
    return (
      <p className="px-7 py-8 text-sm text-brand-ink/45">
        Este cliente ha sido contactado, pero no tiene una factura priorizada en la cartera.
      </p>
    );
  }
  const score = scoreOf(cuenta.factores);
  const nivel = nivelRiesgo(score);

  return (
    <div className="px-7 py-6 space-y-6">
      <div className="grid grid-cols-3 divide-x divide-brand-ink/8 border-y border-brand-ink/8">
        <div className="pr-4 py-3.5">
          <div className="text-[10px] uppercase tracking-[0.14em] text-brand-ink/35">Monto</div>
          <div className="text-xl font-serif text-brand-ink mt-1.5 tabular-nums">
            <Figure value={cuenta.monto} format="moneda" />
          </div>
        </div>
        <div className="px-4 py-3.5">
          <div className="text-[10px] uppercase tracking-[0.14em] text-brand-ink/35">Vencido</div>
          <div className="text-xl font-serif text-brand-ink mt-1.5 tabular-nums">
            <Figure value={cuenta.diasVencido} /> <span className="text-sm">días</span>
          </div>
        </div>
        <div className="pl-4 py-3.5">
          <div className="text-[10px] uppercase tracking-[0.14em] text-brand-ink/35">Riesgo</div>
          <div
            className={`text-xl font-serif mt-1.5 tabular-nums ${
              nivel === 'alto' ? 'text-rose-600' : nivel === 'medio' ? 'text-amber-600' : 'text-emerald-700'
            }`}
          >
            <Figure value={score} />
          </div>
        </div>
      </div>

      <div className="pl-4 border-l-2 border-brand-gold">
        <div className="text-[10px] uppercase tracking-[0.14em] text-brand-ink/35">
          Por qué está aquí
        </div>
        <p className="text-sm text-brand-ink/75 mt-1.5 leading-relaxed">{cuenta.razon}</p>
      </div>

      <div className="space-y-3.5">
        <div className="flex items-center gap-2">
          <Scale size={13} className="text-brand-gold" />
          <BlockTitle>Desglose del score</BlockTitle>
        </div>
        {cuenta.factores.map((f, i) => (
          <div key={f.nombre}>
            <div className="flex items-baseline justify-between gap-3 mb-1.5">
              <span className="text-xs font-semibold text-brand-ink/75">{f.nombre}</span>
              <span className="text-[11px] text-brand-ink/40 tabular-nums shrink-0">
                peso {f.peso}% · aporta{' '}
                <span className="font-semibold text-brand-ink/70">
                  {Math.round((f.peso * f.valor) / 100)}
                </span>
              </span>
            </div>
            <Bar value={f.valor} delay={0.1 + i * 0.07} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Subpestaña 2 · Plan de escalamiento y seguimiento ───────────────

function SubPlan({ registro }: { registro: RecordatorioItem }) {
  const { plan, mejor, nota } = registro;
  const hechos = plan.pasos.filter((p) => p.estado === 'hecho').length;
  const avance = Math.round((hechos / plan.pasos.length) * 100);

  return (
    <div className="px-7 py-6 space-y-6">
      {/* Próxima acción: lo primero que alguien necesita saber al abrir */}
      <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 bg-brand-cream border border-brand-gold/30 rounded-2xl">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.14em] text-brand-ink/40">
            Próxima acción
          </div>
          <div className="text-base font-semibold text-brand-ink mt-1">{plan.proxima.accion}</div>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <Tag icon={<CanalIcon canal={plan.proxima.canal} />} text={plan.proxima.canal} />
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-[0.14em] text-brand-ink/35">Cuándo</div>
            <div className="text-sm font-semibold text-brand-ink mt-0.5">{plan.proxima.cuando}</div>
          </div>
        </div>
      </div>

      {/* Lo que mejor funciona: justifica por qué el plan es así y no otro */}
      <div>
        <BlockTitle>Por qué este plan</BlockTitle>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-3">
          <BestFit label="Canal" value={mejor.canal} />
          <BestFit label="Tono" value={mejor.tono} />
          <BestFit label="Horario" value={mejor.hora} />
          <BestFit label="Respuesta" value={`${registro.tasa}%`} accent />
        </div>
        <p className="text-xs text-brand-ink/50 leading-relaxed mt-3">{nota}</p>
      </div>

      {/* Escalera de cobranza */}
      <div className="space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <BlockTitle>Escalamiento y seguimiento</BlockTitle>
          <div className="flex items-center gap-3">
            {(Object.keys(FASES) as (keyof typeof FASES)[]).map((f) => (
              <span key={f} className="flex items-center gap-1.5">
                <FaseDot fase={f} />
                <span className="text-[10px] text-brand-ink/45">{FASES[f].label}</span>
              </span>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-1">
            <Bar value={avance} tone="accent" delay={0.1} />
          </div>
          <span className="text-[11px] text-brand-ink/45 tabular-nums shrink-0">
            {hechos} de {plan.pasos.length} pasos
          </span>
        </div>

        <ol className="relative border-l border-brand-ink/10 ml-2 mt-4 space-y-4">
          {plan.pasos.map((paso, i) => (
            <PasoEscalera key={`${paso.dia}-${paso.accion}`} paso={paso} index={i} />
          ))}
        </ol>
      </div>
    </div>
  );
}

function PasoEscalera({
  paso,
  index,
}: {
  // Convención del proyecto: un componente que recibe `key` debe declararla.
  key?: string;
  paso: PasoPlan;
  index: number;
}) {
  const reduce = useReducedMotion();
  const fase = FASES[paso.fase];
  const esActual = paso.estado === 'actual';
  const hecho = paso.estado === 'hecho';

  return (
    <motion.li
      initial={reduce ? false : { opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.26, delay: reduce ? 0 : 0.06 + index * 0.05, ease: EASE }}
      className="pl-5"
    >
      <span
        className={`absolute -left-[5px] w-2.5 h-2.5 rounded-full border-2 border-brand-paper ${
          hecho ? fase.punto : esActual ? fase.punto : 'bg-brand-ink/15'
        }`}
        aria-hidden
      />
      <div
        className={`rounded-xl px-4 py-3 border transition-colors ${
          esActual
            ? 'bg-brand-cream border-brand-gold/40'
            : hecho
              ? 'bg-brand-paper border-brand-ink/8'
              : 'bg-brand-bone/40 border-brand-ink/6'
        }`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`text-[11px] font-mono font-semibold tabular-nums px-1.5 py-0.5 rounded ${fase.chip}`}
          >
            día {paso.dia}
          </span>
          <span
            className={`text-sm font-semibold ${hecho || esActual ? 'text-brand-ink' : 'text-brand-ink/45'}`}
          >
            {paso.accion}
          </span>
          {esActual && (
            <span className="audit-badge bg-brand-gold/15 text-brand-ink/70">Ahora</span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-[11px] text-brand-ink/40">
          <span>{paso.canal}</span>
          <span>Tono {paso.tono}</span>
          {paso.estado === 'programado' && <span className="italic">programado</span>}
          {paso.resultado && (
            <span className="ml-auto font-semibold text-brand-ink/60">{paso.resultado}</span>
          )}
        </div>
      </div>
    </motion.li>
  );
}

function CanalIcon({ canal }: { canal: string }) {
  const Icon = CANAL_ICON[canal as keyof typeof CANAL_ICON] ?? MessageSquare;
  return <Icon size={11} />;
}

// ── Subpestaña 3 · Historial ────────────────────────────────────────

function SubHistorial({ registro, reduce }: { registro: RecordatorioItem; reduce: boolean | null }) {
  return (
    <div className="px-7 py-6">
      <ol className="relative border-l border-brand-ink/10 ml-3 space-y-5">
        {registro.mensajes.map((m, i) => {
          const Icon = CANAL_ICON[m.canal as keyof typeof CANAL_ICON] ?? MessageSquare;
          const res = RESULTADO_STYLES[m.resultado];
          return (
            <motion.li
              key={`${m.fecha}-${m.tipo}`}
              initial={reduce ? false : { opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: reduce ? 0 : 0.08 + i * 0.06, ease: EASE }}
              className="pl-6"
            >
              <span className="absolute -left-[9px] flex items-center justify-center w-[18px] h-[18px] rounded-full bg-brand-paper border border-brand-ink/15">
                <Icon size={9} className="text-brand-ink/45" />
              </span>

              <div className="flex flex-wrap items-center gap-2.5">
                <span className="text-[13px] font-semibold text-brand-ink">{m.tipo}</span>
                <span className={`audit-badge ${res.chip}`}>{res.label}</span>
                <span className="text-[11px] text-brand-ink/35 ml-auto tabular-nums whitespace-nowrap">
                  {m.fecha}
                </span>
              </div>

              <dl className="flex flex-wrap gap-x-5 gap-y-1 mt-2 text-[11px]">
                <MsgMeta label="Canal" value={m.canal} />
                <MsgMeta label="Tono" value={m.tono} />
                <MsgMeta label="Nivel" value={`${m.nivel} de 4`} />
                <MsgMeta label="Vencida al enviar" value={`${m.vencidoAlEnviar} días`} />
                <MsgMeta label="Espera al siguiente" value={m.espera} />
              </dl>
            </motion.li>
          );
        })}
      </ol>
    </div>
  );
}

// ─── 4 · Estrategias ─────────────────────────────────────────────────

function EstrategiasPanel() {
  const e = MOCK.estrategias.efectividad;
  const tasaRespuesta = Math.round((e.respondidos / e.enviados) * 100);

  return (
    <div className="space-y-6">
      <Reveal>
        <StatRow>
          <MiniStat
            label="Mensajes enviados"
            value=""
            numeric={e.enviados}
            sub="en los últimos 90 días"
          />
          <MiniStat
            label="Tasa de respuesta"
            value=""
            numeric={tasaRespuesta}
            format="porcentaje"
            sub={`${e.respondidos} clientes respondieron`}
          />
          <MiniStat
            label="Cobradas tras contacto"
            value=""
            numeric={e.cobradasTrasContacto}
            sub="facturas liquidadas"
          />
          <MiniStat
            label="Días ahorrados"
            value=""
            numeric={e.diasAhorrados}
            sub="contra la línea base de cobro"
            accent
          />
        </StatRow>
      </Reveal>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        <Reveal delay={0.08}>
          <StrategyColumn
            titulo="Lo que sí funciona"
            icono={<TrendingUp size={14} className="text-emerald-600" />}
            estrategias={MOCK.estrategias.funcionan}
            positivo
          />
        </Reveal>
        <Reveal delay={0.14}>
          <StrategyColumn
            titulo="Lo que no funciona"
            icono={<TrendingDown size={14} className="text-rose-500" />}
            estrategias={MOCK.estrategias.noFuncionan}
            positivo={false}
          />
        </Reveal>
      </div>
    </div>
  );
}

function StrategyColumn({
  titulo,
  icono,
  estrategias,
  positivo,
}: {
  titulo: string;
  icono: React.ReactNode;
  estrategias: readonly { nombre: string; exito: number; usos: number; nota: string }[];
  positivo: boolean;
}) {
  return (
    <section className="bg-brand-paper border border-brand-ink/10 rounded-3xl overflow-hidden h-full">
      <div className="px-6 py-4 border-b border-brand-ink/8 flex items-center gap-2">
        {icono}
        <BlockTitle>{titulo}</BlockTitle>
      </div>
      <div className="divide-y divide-brand-ink/6">
        {estrategias.map((s, i) => (
          <div key={s.nombre} className="px-6 py-5 space-y-2.5">
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-sm font-semibold text-brand-ink">{s.nombre}</span>
              <span
                className={`text-2xl font-serif tabular-nums shrink-0 ${
                  positivo ? 'text-emerald-700' : 'text-rose-600'
                }`}
              >
                <Figure value={s.exito} format="porcentaje" />
              </span>
            </div>
            <Bar value={s.exito} tone={positivo ? 'positivo' : 'negativo'} delay={0.2 + i * 0.08} />
            <p className="text-xs text-brand-ink/55 leading-relaxed">{s.nota}</p>
            <p className="text-[11px] text-brand-ink/30">{s.usos} veces usada</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── 5 · Perfiles ────────────────────────────────────────────────────

function PerfilesPanel() {
  const reduce = useReducedMotion();

  return (
    <div className="space-y-5">
      <Reveal>
        <p className="text-sm text-brand-ink/55 max-w-[62ch] leading-relaxed">
          Agrupación de clientes por cómo se comportan, no por cuánto deben. Cada perfil trae la
          combinación que mejor le funciona, y es el punto de partida del agente con un cliente
          nuevo, antes de tener historial propio suyo.
        </p>
      </Reveal>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {MOCK.perfiles.map((p, i) => (
          <Reveal key={p.nombre} delay={0.06 + i * 0.06}>
            <motion.article
              whileHover={reduce ? undefined : { y: -3 }}
              transition={{ duration: 0.25, ease: EASE }}
              className="bg-brand-paper border border-brand-ink/10 rounded-3xl p-6 space-y-5 h-full"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h4 className="text-xl font-serif text-brand-ink">{p.nombre}</h4>
                  <p className="text-xs text-brand-ink/50 mt-1.5 leading-relaxed max-w-[38ch]">
                    {p.descripcion}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-3xl font-serif text-brand-ink leading-none">
                    <Figure value={p.clientes} />
                  </div>
                  <div className="text-[10px] uppercase tracking-[0.14em] text-brand-ink/35 mt-1.5">
                    clientes
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Tag icon={<MessageSquare size={11} />} text={p.canal} />
                <Tag icon={<Scale size={11} />} text={`Tono ${p.tono}`} />
                <Tag icon={<CalendarClock size={11} />} text={p.horario} />
              </div>

              <div className="pt-4 border-t border-brand-ink/8">
                <div className="text-[10px] uppercase tracking-[0.14em] text-brand-ink/35">
                  Estrategia recomendada
                </div>
                <p className="text-sm text-brand-ink mt-1.5">{p.estrategia}</p>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <Bar value={p.exito} tone="accent" delay={0.25 + i * 0.06} />
                </div>
                <span className="text-sm font-semibold text-brand-ink tabular-nums shrink-0">
                  <Figure value={p.exito} format="porcentaje" /> éxito
                </span>
              </div>
            </motion.article>
          </Reveal>
        ))}
      </div>
    </div>
  );
}

// ─── 6 · Equipo ──────────────────────────────────────────────────────

function EquipoPanel() {
  return (
    <div className="space-y-5">
      <Reveal>
        <p className="text-sm text-brand-ink/55 max-w-[62ch] leading-relaxed">
          Comparativo entre encargados de cobranza para identificar qué está funcionando y
          replicarlo, no para señalar a nadie.
        </p>
      </Reveal>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {MOCK.equipo.map((persona, i) => {
          const pct = Math.round((persona.recuperado / persona.cartera) * 100);
          const saturado = persona.pendientes >= 10;
          return (
            <Reveal key={persona.nombre} delay={0.06 + i * 0.06}>
              <article className="bg-brand-paper border border-brand-ink/10 rounded-3xl p-6 space-y-5 h-full">
                <div>
                  <h4 className="text-lg font-semibold text-brand-ink">{persona.nombre}</h4>
                  <p className="text-[11px] text-brand-ink/40 mt-0.5">
                    {persona.cuentas} cuentas asignadas
                  </p>
                </div>

                <div>
                  <div className="flex items-baseline justify-between gap-3 mb-2">
                    <span className="text-[10px] uppercase tracking-[0.14em] text-brand-ink/35">
                      Recuperado
                    </span>
                    <span className="text-sm font-semibold text-brand-ink tabular-nums">
                      <Figure value={pct} format="porcentaje" />
                    </span>
                  </div>
                  <Bar value={pct} tone="accent" delay={0.2 + i * 0.06} />
                </div>

                <div className="divide-y divide-brand-ink/6 border-t border-brand-ink/8">
                  <EquipoStat
                    label="Cartera total"
                    value={CURRENCY_FORMATTER.format(persona.cartera)}
                  />
                  <EquipoStat
                    label="Por cobrar"
                    value={CURRENCY_FORMATTER.format(persona.porCobrar)}
                  />
                  <EquipoStat
                    label="Recordatorios pendientes"
                    value={String(persona.pendientes)}
                    alerta={saturado}
                  />
                  <EquipoStat label="Días promedio de cobro" value={`${persona.diasProm} días`} />
                </div>

                {saturado && (
                  <p className="text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2 leading-relaxed">
                    Carga alta de recordatorios pendientes. Conviene redistribuir cuentas.
                  </p>
                )}
              </article>
            </Reveal>
          );
        })}
      </div>
    </div>
  );
}

function EquipoStat({
  label,
  value,
  alerta = false,
}: {
  label: string;
  value: string;
  alerta?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2.5">
      <span className="text-[11px] text-brand-ink/50">{label}</span>
      <span
        className={`text-sm tabular-nums font-semibold ${
          alerta ? 'text-rose-600' : 'text-brand-ink'
        }`}
      >
        {value}
      </span>
    </div>
  );
}

// ─── Piezas compartidas ──────────────────────────────────────────────
// Escala de forma del módulo, aplicada sin excepción según jerarquía:
//   tarjeta principal   rounded-3xl   (secciones)
//   panel secundario    rounded-2xl   (fila de alerta, resultado, métricas)
//   elemento interno    rounded-xl    (mosaicos y avisos dentro de tarjeta)
//   chip                rounded-lg    (score de riesgo, etiquetas)
//   píldora             rounded-full  (audit-badge y barras)
//
// Acento único: brand-gold (el cian #06B6D4 de la marca). Rojo, ámbar y verde
// aparecen solo como estado semántico real (riesgo, severidad, resultado de un
// escenario), nunca como decoración.

/**
 * Métrica de cabecera. A densidad alta las cifras respiran en la retícula
 * en vez de vivir cada una en su caja: el separador es una línea, no un
 * borde de tarjeta.
 */
function MiniStat({
  label,
  value,
  sub,
  accent = false,
  format = 'entero',
  numeric,
}: {
  label: string;
  value: string;
  sub: string;
  accent?: boolean;
  format?: FigureFormat;
  /** Si se pasa, la cifra transiciona en vez de saltar. */
  numeric?: number;
}) {
  return (
    <div className="px-5 py-4 first:pl-0">
      <div className="text-[10px] uppercase tracking-[0.16em] font-semibold text-brand-ink/35">
        {label}
      </div>
      <div
        className={`text-[2rem] leading-none font-serif mt-2.5 ${
          accent ? 'text-brand-gold' : 'text-brand-ink'
        }`}
      >
        {numeric !== undefined ? <Figure value={numeric} format={format} /> : value}
      </div>
      <div className="text-[11px] text-brand-ink/40 mt-2">{sub}</div>
    </div>
  );
}

/** Fila de métricas separadas por línea vertical, no por tarjetas. */
function StatRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-brand-ink/8 border-y border-brand-ink/10 bg-brand-paper rounded-2xl">
      {children}
    </div>
  );
}

/** Escala de riesgo. El color es estado, no decoración. */
const RIESGO_TONOS = {
  alto: { chip: 'bg-rose-50 text-rose-700 border-rose-200', bar: 'negativo' as const },
  medio: { chip: 'bg-amber-50 text-amber-700 border-amber-200', bar: 'ink' as const },
  bajo: { chip: 'bg-emerald-50 text-emerald-700 border-emerald-200', bar: 'positivo' as const },
};

function nivelRiesgo(score: number): keyof typeof RIESGO_TONOS {
  return score >= 70 ? 'alto' : score >= 40 ? 'medio' : 'bajo';
}

function RiskChip({ score }: { score: number }) {
  const tono = RIESGO_TONOS[nivelRiesgo(score)];
  return (
    <span
      className={`inline-flex items-center justify-center min-w-[2.25rem] px-2 py-1 rounded-lg border text-xs font-bold tabular-nums ${tono.chip}`}
    >
      {score}
    </span>
  );
}

function TrendIcon({ tendencia }: { tendencia: 'sube' | 'baja' | 'estable' }) {
  if (tendencia === 'sube')
    return <TrendingUp size={13} className="text-rose-500" aria-label="Riesgo al alza" />;
  if (tendencia === 'baja')
    return <TrendingDown size={13} className="text-emerald-600" aria-label="Riesgo a la baja" />;
  return <ArrowRight size={13} className="text-brand-ink/25" aria-label="Riesgo estable" />;
}

function Tag({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-brand-bone border border-brand-ink/10 rounded-lg text-[11px] font-semibold text-brand-ink/70">
      {icon}
      {text}
    </span>
  );
}

/** Encabezado de bloque dentro de una tarjeta. */
function BlockTitle({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] font-semibold text-brand-ink/40">
      {icon}
      {children}
    </div>
  );
}

function CompareRow({
  label,
  antes,
  despues,
  destacado = false,
}: {
  label: string;
  antes: string;
  despues: string;
  destacado?: boolean;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.14em] text-brand-ink/35">{label}</div>
      <div className="flex items-baseline gap-2 mt-1.5">
        <span className="text-sm tabular-nums text-brand-ink/40">{antes}</span>
        <ArrowRight size={12} className="text-brand-ink/25 shrink-0 self-center" />
        <span
          className={`tabular-nums ${
            destacado ? 'text-2xl font-serif text-brand-ink' : 'text-sm font-bold text-brand-ink'
          }`}
        >
          {despues}
        </span>
      </div>
    </div>
  );
}
