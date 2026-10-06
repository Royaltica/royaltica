import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  AlertTriangle,
  ArrowRight,
  ChevronDown,
  Check,
  Info,
  Link2,
  MessageSquare,
  Scale,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { EASE, Reveal, Figure, Bar, Tag, BlockTitle, type FigureFormat } from './cobranza/primitives.tsx';
import { RolSelector, type Rol } from './cobranza/RolSelector.tsx';
import {
  CANAL_ICON,
  FASES,
  FaseDot,
  LineaPlan,
  textoHoy,
  CanalIcon,
} from './cobranza/plan.tsx';
import { planDe, saldoDe, AGENTES } from './cobranza/mockV1.ts';
import { CobranzaProvider, useCobranza, planCuenta } from './cobranza/store.tsx';
import { SegmentoChip, SegmentosPanel } from './cobranza/segmento.tsx';
import { AgenteVista } from './cobranza/AgenteVista.tsx';
import { CampanasPanel } from './cobranza/CampanasPanel.tsx';
import { PlantillasPanel } from './cobranza/PlantillasPanel.tsx';
import { ReportesPanel } from './cobranza/ReportesPanel.tsx';
import { DatosPagosPanel, AsignacionPanel } from './cobranza/DatosPagosPanel.tsx';
import { PagosPanel, AvisoPagos } from './cobranza/PagosPanel.tsx';
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
  | 'alertas'
  | 'recordatorios'
  | 'campanas'
  | 'plantillas'
  | 'reportes'
  | 'datos'
  | 'pagos'
  | 'estrategias'
  | 'segmentos'
  | 'equipo';

const LABEL: Record<Section, string> = {
  alertas: 'Alertas',
  recordatorios: 'Recordatorios',
  campanas: 'Campañas',
  plantillas: 'Plantillas',
  reportes: 'Reportes',
  datos: 'Datos',
  pagos: 'Pagos',
  estrategias: 'Estrategias',
  segmentos: 'Segmentos',
  equipo: 'Equipo',
};

// Cada perfil ve solo sus pestañas, agrupadas en Operación y Configuración.
// El Agente no tiene pestañas: una sola lista (ver AgenteVista).
const SECCIONES_POR_ROL: Record<Exclude<Rol, 'agente'>, Section[][]> = {
  admin: [
    ['recordatorios', 'alertas', 'campanas', 'pagos'],
    ['segmentos', 'plantillas', 'reportes', 'datos', 'estrategias', 'equipo'],
  ],
  supervisor: [['recordatorios', 'campanas', 'pagos', 'equipo'], ['segmentos', 'reportes']],
};

const ENCABEZADO: Record<Rol, { titulo: string; texto: string }> = {
  admin: {
    titulo: 'Control interno de cartera',
    texto: 'Todo el módulo: cartera, campañas, plantillas, reportes y la base de datos.',
  },
  supervisor: {
    titulo: 'Operación del equipo',
    texto: 'Prioridades, campañas por bloque y la carga de trabajo de tu equipo.',
  },
  agente: {
    titulo: 'Mis cuentas de hoy',
    texto: 'A quién contactar, a qué número y qué decirle.',
  },
};

// ─── Primitivas de movimiento ────────────────────────────────────────
// Sistema de movimiento del módulo. Cada animación responde a una razón:
// jerarquía (qué mirar primero), transición de estado (este número cambió)
// o retroalimentación (tu clic hizo algo). Nada se mueve por decoración.
//
// Todo se degrada a estático bajo `prefers-reduced-motion`, y ninguna
// animación toca layout: solo `transform` y `opacity`, más `width` en las
// barras, que están aisladas y no reflowean el resto de la página.

// ─── Datos de ejemplo ────────────────────────────────────────────────
// Reemplazar por llamadas reales al API cuando exista el Módulo 2.

// ── Plantilla de cobranza (Recordatorios → Plan) ────────────────────
// Una sola escalera para toda la cartera: 5 niveles ANTES de vencer y 4
// etapas DESPUÉS. Cada cliente la hereda y solo se ajusta por reglas simples
// (perfil + canal preferido). Nada se mueve a mano: el estado de cada paso
// sale de comparar su día contra el día de hoy del cliente.

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
      pagado: 85_350,
      diasVencido: 42,
      tendencia: 'sube' as const,
      razon: 'Monto alto + puntualidad histórica cayó de 92% a 61% en 3 meses',
      accion: 'Negociación por llamada',
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
      pagado: 78_100,
      diasVencido: 28,
      tendencia: 'estable' as const,
      razon: 'Buen historial, primer atraso relevante en 2 años',
      accion: 'Notificación formal',
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
      pagado: 0,
      diasVencido: 35,
      tendencia: 'sube' as const,
      razon: 'Tercer atraso consecutivo, no respondió los últimos 2 mensajes',
      accion: 'Negociación por llamada',
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
      pagado: 47_100,
      diasVencido: 12,
      tendencia: 'baja' as const,
      razon: 'Paga tarde pero siempre paga. Su patrón normal son 15 días: no conviene escalar antes',
      accion: 'Esperar su patrón (~15 días)',
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
      pagado: 123_600,
      diasVencido: 19,
      tendencia: 'estable' as const,
      razon: 'Monto muy alto. Vigilar aunque el atraso aún es moderado',
      accion: 'Notificación formal (mañana)',
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
        'El 23% de tu cartera vencida depende de Constructora Vanguardia ($288,400). Si esa cuenta se deteriora, el impacto es desproporcionado.',
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
      titulo: '2 clientes sin contacto de finanzas',
      detalle:
        'Grupo Ferretero Bajío y Constructora Vanguardia solo tienen registrado al director. Quedan fuera de las campañas hasta registrar a tesorería (Datos y pagos).',
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
      plan: planDe('Distribuidora del Norte'),
      mensajes: [
        { fecha: '02 sep 2026, 09:14', canal: 'WhatsApp', tipo: 'Recordatorio', tono: 'Estándar', nivel: 3, vencidoAlEnviar: 40, espera: '3 días', resultado: 'respondio' as const, texto: 'Hola, Distribuidora del Norte. Le recordamos la factura F-2841 por $284,500.00 MXN, con vencimiento el 22 de julio. Puede liquidarla desde esta liga segura. Si ya realizó el pago o necesita el estado de cuenta, responda este mensaje y lo revisamos.', respuesta: 'Sí, la vimos. Estamos cerrando el mes, la programamos para la próxima semana.' },
        { fecha: '30 ago 2026, 09:05', canal: 'WhatsApp', tipo: 'Recordatorio', tono: 'Suave', nivel: 2, vencidoAlEnviar: 37, espera: '5 días', resultado: 'sin_respuesta' as const, texto: 'Buen día. Seguimos al pendiente de la factura F-2841. Si requiere una copia del comprobante fiscal o apoyo con el proceso, con gusto lo atendemos.' },
        { fecha: '25 ago 2026, 16:40', canal: 'Correo', tipo: 'Recordatorio', tono: 'Suave', nivel: 1, vencidoAlEnviar: 32, espera: '7 días', resultado: 'sin_respuesta' as const, texto: 'Estimados, adjuntamos el estado de cuenta con el detalle de la factura F-2841. Quedamos atentos a cualquier aclaración.' },
        { fecha: '18 ago 2026, 09:10', canal: 'WhatsApp', tipo: 'Aviso de vencimiento', tono: 'Suave', nivel: 1, vencidoAlEnviar: 25, espera: 'sin siguiente', resultado: 'respondio' as const, texto: 'Hola. Le informamos que la factura F-2841 por $284,500.00 MXN cumple su fecha de vencimiento hoy. Si ya está programada, ignore este aviso.', respuesta: 'Recibido, la tenemos en revisión con el área de pagos.' },
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
      plan: planDe('Materiales Peninsulares'),
      mensajes: [
        { fecha: '29 ago 2026, 16:22', canal: 'Correo', tipo: 'Oferta de plan', tono: 'Suave', nivel: 2, vencidoAlEnviar: 24, espera: '4 días', resultado: 'respondio' as const, texto: 'Estimados. Sabemos que este mes ha sido distinto para ustedes. Podemos dividir la factura F-2903 en dos parcialidades, la primera este mes y la segunda el siguiente, sin costo adicional. ¿Les funciona?', respuesta: 'Nos ayudaría muchísimo. Confirmamos la primera parcialidad para el viernes.' },
        { fecha: '25 ago 2026, 17:03', canal: 'Correo', tipo: 'Recordatorio', tono: 'Suave', nivel: 1, vencidoAlEnviar: 20, espera: '6 días', resultado: 'sin_respuesta' as const, texto: 'Buenas tardes. Le recordamos la factura F-2903 por $156,200.00 MXN. Si necesita el estado de cuenta o revisar fechas, quedamos a sus órdenes.' },
        { fecha: '19 ago 2026, 10:30', canal: 'WhatsApp', tipo: 'Recordatorio', tono: 'Suave', nivel: 1, vencidoAlEnviar: 14, espera: 'sin siguiente', resultado: 'sin_respuesta' as const, texto: 'Hola, Materiales Peninsulares. Un recordatorio de la factura F-2903. Cualquier duda, con gusto la resolvemos.' },
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
      plan: planDe('Grupo Ferretero Bajío'),
      mensajes: [
        { fecha: '03 sep 2026, 12:45', canal: 'Llamada', tipo: 'Escalamiento', tono: 'Firme', nivel: 4, vencidoAlEnviar: 34, espera: '2 días', resultado: 'respondio' as const, texto: 'Buenas tardes. Le marcamos desde Royáltica para revisar juntos el estatus de la factura F-2877 y encontrar una fecha que les funcione. ¿Tiene unos minutos?', respuesta: 'Sí, páseme con quien lleva el tema. Lo vemos el lunes con administración.' },
        { fecha: '01 sep 2026, 12:10', canal: 'WhatsApp', tipo: 'Recordatorio', tono: 'Firme', nivel: 3, vencidoAlEnviar: 32, espera: '4 días', resultado: 'sin_respuesta' as const, texto: 'Estimados, la factura F-2877 por $98,400.00 MXN continúa pendiente de conciliación. Le pedimos confirmar una fecha estimada de pago.' },
        { fecha: '28 ago 2026, 09:20', canal: 'WhatsApp', tipo: 'Recordatorio', tono: 'Estándar', nivel: 2, vencidoAlEnviar: 28, espera: '5 días', resultado: 'sin_respuesta' as const, texto: 'Hola. Le recordamos la factura F-2877. Si hay algún tema con la documentación, lo revisamos con gusto.' },
        { fecha: '23 ago 2026, 09:15', canal: 'Correo', tipo: 'Recordatorio', tono: 'Suave', nivel: 1, vencidoAlEnviar: 23, espera: 'sin siguiente', resultado: 'sin_respuesta' as const, texto: 'Buen día, Grupo Ferretero Bajío. Le compartimos el recordatorio de la factura F-2877 y su estado de cuenta.' },
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
      plan: planDe('Logística Andrade'),
      mensajes: [
        { fecha: '26 ago 2026, 09:32', canal: 'WhatsApp', tipo: 'Recordatorio', tono: 'Suave', nivel: 1, vencidoAlEnviar: 9, espera: '2 días', resultado: 'pago' as const, texto: 'Hola, Logística Andrade. Un recordatorio breve de la factura F-2915. Como siempre, cualquier cosa nos dice.', respuesta: 'Listo, ya se envió la transferencia del resto. Les paso el comprobante.' },
        { fecha: '19 ago 2026, 09:40', canal: 'WhatsApp', tipo: 'Aviso de vencimiento', tono: 'Suave', nivel: 1, vencidoAlEnviar: 2, espera: 'sin siguiente', resultado: 'respondio' as const, texto: 'Buen día. La factura F-2915 por $62,800.00 MXN vence hoy. Si ya está en proceso, ignore este mensaje.', respuesta: 'Va, hacemos un abono parcial hoy y el resto la próxima semana.' },
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
      plan: planDe('Constructora Vanguardia'),
      mensajes: [
        { fecha: '01 sep 2026, 08:30', canal: 'Correo', tipo: 'Recordatorio', tono: 'Estándar', nivel: 2, vencidoAlEnviar: 17, espera: '6 días', resultado: 'respondio' as const, texto: 'Estimados. Adjuntamos el estado de cuenta correspondiente a la factura F-2860 por $412,000.00 MXN. Quedamos atentos a la programación de pago por parte de su área administrativa.', respuesta: 'Gracias. Lo turnamos a finanzas, nos confirman la programación esta semana.' },
        { fecha: '26 ago 2026, 08:45', canal: 'Correo', tipo: 'Aviso de vencimiento', tono: 'Suave', nivel: 1, vencidoAlEnviar: 11, espera: 'sin siguiente', resultado: 'sin_respuesta' as const, texto: 'Buen día, Constructora Vanguardia. Le informamos que la factura F-2860 cumple su fecha de vencimiento hoy. Adjuntamos el comprobante fiscal para su referencia.' },
      ],
    },
    {
      cliente: 'Comercializadora Lumen',
      encargado: 'Carlos Mendoza',
      enviados: 3,
      tasa: 67,
      ultimo: 'hace 2 días',
      mejor: { canal: 'WhatsApp', tono: 'Suave', hora: '10-12h', estrategia: 'Avisos tempranos con liga de pago' },
      nota: 'Cliente nuevo, aún sin historial suficiente: se usa la plantilla general tal cual. Su factura todavía no vence.',
      plan: planDe('Comercializadora Lumen'),
      mensajes: [
        { fecha: '17 sep 2026, 10:15', canal: 'WhatsApp', tipo: 'Recordatorio de cortesía', tono: 'Suave', nivel: 2, vencidoAlEnviar: -7, espera: 'sin siguiente', resultado: 'respondio' as const, texto: 'Hola, Comercializadora Lumen. Le recordamos que la factura F-2951 por $74,300.00 MXN vence el 29 de septiembre. Si le es más práctico, puede pagarla desde esta liga segura. ¿Todo en orden con la factura?', respuesta: 'Todo bien, gracias. La tenemos programada para el viernes 26.' },
        { fecha: '10 sep 2026, 10:05', canal: 'WhatsApp', tipo: 'Aviso preventivo', tono: 'Cordial', nivel: 1, vencidoAlEnviar: -14, espera: '7 días', resultado: 'sin_respuesta' as const, texto: 'Buen día. Solo para tenerlo en su radar: la factura F-2951 por $74,300.00 MXN vence el 29 de septiembre.' },
        { fecha: '30 ago 2026, 09:40', canal: 'Correo', tipo: 'Confirmación de factura', tono: 'Informativo', nivel: 0, vencidoAlEnviar: -30, espera: '11 días', resultado: 'respondio' as const, texto: 'Estimados, les compartimos la factura F-2951 por $74,300.00 MXN con vencimiento el 29 de septiembre. Si algún dato no coincide con su orden de compra, avísennos y lo corregimos.', respuesta: 'Recibida y validada. Gracias.' },
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
  return (
    <CobranzaProvider>
      <CobranzaIA />
    </CobranzaProvider>
  );
}

function CobranzaIA() {
  const [rol, setRol] = React.useState<Rol>('admin');
  const [section, setSection] = React.useState<Section>('recordatorios');
  const reduce = useReducedMotion();
  const grupos = rol === 'agente' ? [] : SECCIONES_POR_ROL[rol];

  const cambiarRol = (r: Rol) => {
    setRol(r);
    if (r !== 'agente' && !SECCIONES_POR_ROL[r].flat().includes(section)) setSection('recordatorios');
  };

  return (
    <div className="pb-12 max-w-[1400px]">
      {/* Encabezado + selector de perfil */}
      <Reveal>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] font-semibold text-brand-ink/35">
              Cobranza inteligente
            </p>
            <h2 className="text-[2.5rem] leading-[1.05] font-serif text-brand-ink mt-2">
              {ENCABEZADO[rol].titulo}
            </h2>
            <p className="text-sm text-brand-ink/55 max-w-[62ch] mt-3 leading-relaxed">
              {ENCABEZADO[rol].texto}
            </p>
          </div>
          <div className="w-full lg:w-auto lg:min-w-[560px]">
            <RolSelector rol={rol} onChange={cambiarRol} />
          </div>
        </div>
      </Reveal>

      {rol !== 'agente' && (
        <Reveal delay={0.06}>
          {/* Pestañas del perfil: grupos separados por un divisor fino. El
              indicador se desliza (layoutId) para confirmar el clic. */}
          <nav
            className="mt-8 border-b border-brand-ink/10 flex items-center gap-1 overflow-x-auto scrollbar-custom"
            aria-label="Secciones de cobranza"
          >
            {grupos.map((grupo, gi) => (
              <React.Fragment key={gi}>
                {gi > 0 && <span className="w-px h-4 bg-brand-ink/12 mx-2 shrink-0" aria-hidden />}
                {grupo.map((id) => {
                  const activa = section === id;
                  return (
                    <button
                      key={id}
                      onClick={() => setSection(id)}
                      aria-current={activa ? 'page' : undefined}
                      className={`relative shrink-0 px-4 py-3 text-[13px] font-semibold transition-colors duration-200 ${
                        activa ? 'text-brand-ink' : 'text-brand-ink/40 hover:text-brand-ink/70'
                      }`}
                    >
                      {LABEL[id]}
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
              </React.Fragment>
            ))}
          </nav>
          <div className="mt-3">
            <AvisoPagos onIr={() => setSection('pagos')} />
          </div>
        </Reveal>
      )}

      {rol !== 'agente' && (
        <Reveal delay={0.08}>
          <div className="mt-6">
            <ResumenHoy />
          </div>
        </Reveal>
      )}

      <Reveal delay={0.1}>
        <PrototypeNotice />
      </Reveal>

      <motion.div
        key={`${rol}-${section}`}
        initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: EASE }}
      >
        {rol === 'agente' ? (
          <AgenteVista />
        ) : (
          <>
            {section === 'alertas' && <AlertasPanel />}
            {section === 'recordatorios' && <RecordatoriosPanel />}
            {section === 'campanas' && <CampanasPanel />}
            {section === 'plantillas' && <PlantillasPanel />}
            {section === 'reportes' && <ReportesPanel soloEquipo={rol === 'supervisor'} />}
            {section === 'datos' && <DatosPagosPanel />}
            {section === 'pagos' && <PagosPanel soloLectura={rol === 'supervisor'} />}
            {section === 'estrategias' && <EstrategiasPanel />}
            {section === 'segmentos' && <SegmentosPanel />}
            {section === 'equipo' && (
              <>
                <EquipoPanel />
                <AsignacionPanel />
              </>
            )}
          </>
        )}
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

/** Porcentaje ya liquidado de una cuenta, redondeado. */
function pctPagado(cuenta: CarteraItem): number {
  if (cuenta.monto <= 0) return 0;
  return Math.round((cuenta.pagado / cuenta.monto) * 100);
}

/** Datos de riesgo de una cuenta, por nombre de cliente. */
function cuentaDe(cliente: string): CarteraItem | undefined {
  return MOCK.cartera.find((c) => c.cliente === cliente);
}

/**
 * Resumen del día (Administrador y Supervisor). Sale de la misma cartera que
 * ven los agentes, así que cambia en vivo: si un agente envía o un pago salda
 * una factura, el número de hoy baja.
 */
function ResumenHoy() {
  const { cartera, resultadosHoy } = useCobranza();
  const abiertas = cartera.filter((c) => !c.saldada);
  // "Para atender hoy": el paso vigente del plan todavía no tiene resultado.
  const hoy = abiertas
    .map((c) => ({ c, paso: planCuenta(c).actual }))
    .filter(({ c, paso }) => paso && !c.resultados[paso.id] && !resultadosHoy[c.id]);
  const montoHoy = hoy.reduce((a, { c }) => a + saldoDe(c), 0);
  const porCobrar = abiertas.reduce((a, c) => a + saldoDe(c), 0);
  const vencida = abiertas.filter((c) => c.dias > 0).reduce((a, c) => a + saldoDe(c), 0);
  const humano = hoy.filter(({ paso }) => paso!.canal === 'Llamada').length;

  return (
    <StatRow>
      <MiniStat label="Para atender hoy" value="" numeric={hoy.length} sub="clientes con un paso que toca hoy" />
      <MiniStat label="Monto en juego" value="" numeric={montoHoy} format="moneda" sub="saldo de los clientes de hoy" />
      <MiniStat
        label="Cartera vencida"
        value=""
        numeric={vencida}
        format="moneda"
        sub={`${porCobrar ? Math.round((vencida / porCobrar) * 100) : 0}% de lo que está por cobrar`}
      />
      <MiniStat label="Requieren humano" value="" numeric={humano} sub="hoy toca llamada, no mensaje" accent />
    </StatRow>
  );
}


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

type RecordatorioItem = (typeof MOCK.recordatorios)[number];

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
  const { cartera } = useCobranza();
  const planDeCliente = (cliente: string) => planCuenta(cartera.find((c) => c.cliente === cliente)!);
  const [selected, setSelected] = React.useState(MOCK.recordatorios[0].cliente);
  const [sub, setSub] = React.useState<SubSeccion>('resumen');
  const activo = MOCK.recordatorios.find((r) => r.cliente === selected) ?? MOCK.recordatorios[0];
  const reduce = useReducedMotion();
  // El riesgo de la cuenta vive en MOCK.cartera y se enlaza por nombre de
  // cliente. Puede no existir (un cliente contactado sin factura priorizada),
  // por eso las tarjetas de riesgo y simulación se renderizan condicionadas.
  const cuenta = cuentaDe(activo.cliente);
  const activoVivo = cartera.find((c) => c.cliente === activo.cliente)!;

  // Agregados de la cartera contactada: llenan el pie de la lista con algo
  // útil en vez de dejar aire muerto bajo los cinco clientes.
  const totalMensajes = MOCK.recordatorios.reduce((s, r) => s + r.enviados, 0);
  const tasaPromedio = Math.round(
    MOCK.recordatorios.reduce((s, r) => s + r.tasa, 0) / MOCK.recordatorios.length,
  );
  const enEscalamiento = MOCK.recordatorios.filter((r) =>
    planDeCliente(r.cliente).actual?.fase === 'escalamiento',
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
              const pasoActual = planDeCliente(r.cliente).actual;
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
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-semibold text-brand-ink truncate">{r.cliente}</span>
                        <SegmentoChip cuenta={cartera.find((c) => c.cliente === r.cliente)!} />
                        {cartera.find((c) => c.cliente === r.cliente)!.saldada && (
                          <span className="audit-badge bg-emerald-50 text-emerald-700">Saldada</span>
                        )}
                      </div>
                      {pasoActual && (
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <FaseDot fase={pasoActual.fase} />
                          <span className="text-[11px] text-brand-ink/55 truncate">
                            {pasoActual.etiqueta} · {pasoActual.nombre}
                          </span>
                        </div>
                      )}
                      {cuentaFila && (
                        <div className="mt-2">
                          <div className="flex items-baseline justify-between gap-2 mb-1">
                            <span className="text-[10px] text-brand-ink/40">
                              Pagado{' '}
                              <span className="font-semibold text-brand-ink/70 tabular-nums">
                                {pctPagado(cuentaFila)}%
                              </span>
                            </span>
                            <span className="text-[10px] text-brand-ink/35 tabular-nums">
                              falta {CURRENCY_FORMATTER.format(cuentaFila.monto - cuentaFila.pagado)}
                            </span>
                          </div>
                          <Bar value={pctPagado(cuentaFila)} tone="positivo" delay={0.15} />
                        </div>
                      )}
                      <div className="text-[11px] text-brand-ink/35 mt-2 tabular-nums">
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
                  <span>{activoVivo.agente}</span>
                  <SegmentoChip cuenta={activoVivo} />
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

      {/* Avance de pago: cuánto de la factura ya entró y cuánto falta */}
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <BlockTitle>Avance de pago</BlockTitle>
          <span className="text-[11px] text-brand-ink/45 tabular-nums">
            {pctPagado(cuenta)}% liquidado
          </span>
        </div>
        <Bar value={pctPagado(cuenta)} tone="positivo" delay={0.1} />
        <div className="grid grid-cols-2 divide-x divide-brand-ink/8">
          <div className="pr-4">
            <div className="text-[10px] uppercase tracking-[0.14em] text-brand-ink/35">Pagado</div>
            <div className="text-base font-serif text-emerald-700 mt-1 tabular-nums">
              <Figure value={cuenta.pagado} format="moneda" />
            </div>
          </div>
          <div className="pl-4">
            <div className="text-[10px] uppercase tracking-[0.14em] text-brand-ink/35">
              Falta por pagar
            </div>
            <div className="text-base font-serif text-brand-ink mt-1 tabular-nums">
              <Figure value={cuenta.monto - cuenta.pagado} format="moneda" />
            </div>
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
  const { mejor, nota } = registro;
  const { cartera } = useCobranza();
  const cuentaViva = cartera.find((c) => c.cliente === registro.cliente)!;
  const { pasos, actual, proxima, ajustes } = planCuenta(cuentaViva);
  const vigentes = pasos.filter((p) => p.estado !== 'omitido');
  const hechos = vigentes.filter((p) => p.estado === 'hecho').length;
  const avance = Math.round((hechos / vigentes.length) * 100);
  const antes = pasos.filter((p) => p.fase === 'temprana');
  const despues = pasos.filter((p) => p.fase !== 'temprana');
  const vencida = registro.plan.hoy > 0;

  return (
    <div className="px-7 py-6 space-y-6">
      {/* Hoy + próxima acción: lo primero que alguien necesita saber */}
      <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 bg-brand-cream border border-brand-gold/30 rounded-2xl">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.14em] text-brand-ink/40">
            {proxima ? 'Próxima acción' : 'Etapa en curso'}
          </div>
          <div className="text-base font-semibold text-brand-ink mt-1">
            {(proxima ?? actual)?.etiqueta} · {(proxima ?? actual)?.nombre}
          </div>
          <div className={`text-[11px] mt-1 font-semibold ${vencida ? 'text-rose-600' : 'text-emerald-700'}`}>
            Hoy: {textoHoy(registro.plan.hoy)}
          </div>
        </div>
        {(proxima ?? actual) && (
          <div className="flex items-center gap-4 shrink-0">
            <Tag icon={<CanalIcon canal={(proxima ?? actual)!.canal} />} text={(proxima ?? actual)!.canal} />
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-[0.14em] text-brand-ink/35">Cuándo</div>
              <div className="text-sm font-semibold text-brand-ink mt-0.5">
                {proxima ? (proxima.faltan === 1 ? 'mañana' : `en ${proxima.faltan} días`) : 'en curso'}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Por qué este plan: plantilla general + ajustes de este cliente */}
      <div>
        <BlockTitle>Por qué este plan</BlockTitle>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-3">
          <BestFit label="Canal" value={mejor.canal} />
          <BestFit label="Tono" value={mejor.tono} />
          <BestFit label="Horario" value={mejor.hora} />
          <BestFit label="Respuesta" value={`${registro.tasa}%`} accent />
        </div>
        <p className="text-xs text-brand-ink/50 leading-relaxed mt-3">{nota}</p>
        <div className="mt-3 px-4 py-3 rounded-xl bg-brand-bone/60 border border-brand-ink/6">
          <div className="text-[10px] uppercase tracking-[0.14em] text-brand-ink/40">
            Plantilla general · ajustes para este cliente
          </div>
          <ul className="mt-1.5 space-y-1">
            {ajustes.map((a) => (
              <li key={a} className="flex gap-2 text-xs text-brand-ink/65 leading-relaxed">
                <span className="text-brand-gold">•</span>
                {a}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <LineaPlan pasos={pasos} />
    </div>
  );
}

// ── Subpestaña 3 · Historial ────────────────────────────────────────
// Registro de todo lo enviado y lo que contestó el cliente. Cada mensaje se
// abre para leer el texto exacto que salió y la respuesta literal recibida.

function SubHistorial({ registro, reduce }: { registro: RecordatorioItem; reduce: boolean | null }) {
  const [abierto, setAbierto] = React.useState<string | null>(null);
  const respondidos = registro.mensajes.filter((m) => m.respuesta).length;

  return (
    <div className="px-7 py-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <BlockTitle icon={<MessageSquare size={13} className="text-brand-gold" />}>
          Registro de mensajes
        </BlockTitle>
        <span className="text-[11px] text-brand-ink/40 tabular-nums">
          {registro.mensajes.length} enviados · {respondidos} con respuesta
        </span>
      </div>

      <ol className="relative border-l border-brand-ink/10 ml-3 space-y-3">
        {registro.mensajes.map((m, i) => {
          const Icon = CANAL_ICON[m.canal as keyof typeof CANAL_ICON] ?? MessageSquare;
          const res = RESULTADO_STYLES[m.resultado];
          const id = `${m.fecha}-${m.tipo}`;
          const expandido = abierto === id;

          return (
            <motion.li
              key={id}
              initial={reduce ? false : { opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: reduce ? 0 : 0.08 + i * 0.06, ease: EASE }}
              className="pl-6"
            >
              <span className="absolute -left-[9px] flex items-center justify-center w-[18px] h-[18px] rounded-full bg-brand-paper border border-brand-ink/15">
                <Icon size={9} className="text-brand-ink/45" />
              </span>

              <button
                onClick={() => setAbierto(expandido ? null : id)}
                aria-expanded={expandido}
                className={`w-full text-left rounded-xl border px-4 py-3 transition-colors ${
                  expandido
                    ? 'bg-brand-cream border-brand-gold/40'
                    : 'bg-brand-paper border-brand-ink/8 hover:border-brand-ink/20'
                }`}
              >
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="text-[13px] font-semibold text-brand-ink">{m.tipo}</span>
                  <span className={`audit-badge ${res.chip}`}>{res.label}</span>
                  <span className="flex items-center gap-2 ml-auto shrink-0">
                    <span className="text-[11px] text-brand-ink/35 tabular-nums whitespace-nowrap">
                      {m.fecha}
                    </span>
                    <ChevronDown
                      size={14}
                      className={`text-brand-ink/30 transition-transform duration-200 ${
                        expandido ? 'rotate-180' : ''
                      }`}
                    />
                  </span>
                </div>

                <dl className="flex flex-wrap gap-x-5 gap-y-1 mt-2 text-[11px]">
                  <MsgMeta label="Canal" value={m.canal} />
                  <MsgMeta label="Tono" value={m.tono} />
                  <MsgMeta label="Nivel" value={`${m.nivel} de 4`} />
                  <MsgMeta
                    label={m.vencidoAlEnviar < 0 ? 'Faltaban al enviar' : 'Vencida al enviar'}
                    value={`${Math.abs(m.vencidoAlEnviar)} días`}
                  />
                </dl>
              </button>

              {/* El detalle aparece sin animar altura: solo el contenido entra
                  con opacidad y desplazamiento, para no tocar el layout. */}
              {expandido && (
                <motion.div
                  initial={reduce ? false : { opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, ease: EASE }}
                  className="mt-2 space-y-2"
                >
                  <Burbuja
                    autor="Royáltica"
                    marca={m.canal}
                    texto={m.texto}
                    tono="enviado"
                  />
                  {m.respuesta ? (
                    <Burbuja
                      autor={registro.cliente}
                      marca="Respuesta"
                      texto={m.respuesta}
                      tono="recibido"
                    />
                  ) : (
                    <p className="text-[11px] text-brand-ink/35 italic pl-4">
                      Sin respuesta del cliente a este mensaje.
                    </p>
                  )}
                </motion.div>
              )}
            </motion.li>
          );
        })}
      </ol>
    </div>
  );
}

function Burbuja({
  autor,
  marca,
  texto,
  tono,
}: {
  autor: string;
  marca: string;
  texto: string;
  tono: 'enviado' | 'recibido';
}) {
  const enviado = tono === 'enviado';
  return (
    <div
      className={`rounded-xl px-4 py-3 border ${
        enviado
          ? 'bg-brand-paper border-brand-ink/10 ml-0 mr-6'
          : 'bg-emerald-50/60 border-emerald-200 ml-6 mr-0'
      }`}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <span
          className={`text-[10px] uppercase tracking-[0.12em] font-semibold ${
            enviado ? 'text-brand-ink/45' : 'text-emerald-700'
          }`}
        >
          {autor}
        </span>
        <span className="text-[10px] text-brand-ink/30">{marca}</span>
      </div>
      <p className="text-[13px] text-brand-ink/80 leading-relaxed">{texto}</p>
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

// ─── 6 · Equipo ──────────────────────────────────────────────────────

function EquipoPanel() {
  const { cartera, envios, resultadosHoy } = useCobranza();
  // Todo sale de la misma cartera que ven Supervisor y Agente.
  const equipo = AGENTES.map((nombre) => {
    const suyas = cartera.filter((c) => c.agente === nombre);
    const vencidas = suyas.filter((c) => c.dias > 0);
    return {
      nombre,
      cuentas: suyas.length,
      cartera: suyas.reduce((s, c) => s + c.monto, 0),
      porCobrar: suyas.reduce((s, c) => s + saldoDe(c), 0),
      recuperado: suyas.reduce((s, c) => s + c.pagado, 0),
      // Pendientes de hoy: el paso vigente del plan aún no tiene resultado.
      pendientes: suyas.filter((c) => {
        const act = planCuenta(c).actual;
        return act && !c.resultados[act.id] && !envios[c.id] && !resultadosHoy[c.id];
      }).length,
      diasProm: vencidas.length ? Math.round(vencidas.reduce((s, c) => s + c.dias, 0) / vencidas.length) : 0,
    };
  });
  return (
    <div className="space-y-5">
      <Reveal>
        <p className="text-sm text-brand-ink/55 max-w-[62ch] leading-relaxed">
          Comparativo entre encargados de cobranza para identificar qué está funcionando y
          replicarlo, no para señalar a nadie.
        </p>
      </Reveal>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {equipo.map((persona, i) => {
          const pct = Math.round((persona.recuperado / persona.cartera) * 100);
          const saturado = persona.pendientes >= 4;
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
    <div className="px-5 py-4">
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
