import React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Check,
  Info,
  Link2,
  MessageSquare,
  PhoneCall,
  Download,
  ListChecks,
  Search,
  SlidersHorizontal,
  MessageCircle,
  Pause,
  Wallet as WalletIcon,
  X,
  Scale,
  TrendingDown,
  Users,
  Wallet,
} from 'lucide-react';
import { GLASS, SPRING, SPRING_SUAVE } from './cobranza/campanasUi.tsx';
import { PanelSub, Subpestanas } from './cobranza/vidrio.tsx';
import { NavCobranza, SECCIONES, estiloAcento, grupoDe, seccionesDe, type Section } from './cobranza/secciones.tsx';
import { EASE, Reveal, Figure, Bar, Tag, BlockTitle, type FigureFormat } from './cobranza/primitives.tsx';
import type { Rol } from './cobranza/RolSelector.tsx';
import {
  CANAL_ICON,
  FASES,
  FaseDot,
  PlanCompacto,
  textoHoy,
  CanalIcon,
} from './cobranza/plan.tsx';
import { planDe, planConfig, saldoDe, AGENTES } from './cobranza/mockV1.ts';
import { CobranzaProvider, useCobranzaOpcional, useCobranza, planCuenta, type CuentaViva } from './cobranza/store.tsx';
import { SegmentoChip, SegmentosPanel } from './cobranza/segmento.tsx';
import { SubFacturas } from './cobranza/facturas.tsx';
import { AlertasPanel, useAlertas, type Destino } from './cobranza/alertas.tsx';
import {
  BTN_SEC,
  CONTROL,
  exportarCuentasCsv,
  useAviso,
} from './cobranza/clientes.tsx';
import { AgenteVista } from './cobranza/AgenteVista.tsx';
import { CampanasPanel } from './cobranza/CampanasPanel.tsx';
import { PlantillasPanel } from './cobranza/PlantillasPanel.tsx';
import { ReportesPanel } from './cobranza/ReportesPanel.tsx';
import { DatosPagosPanel, AsignacionPanel } from './cobranza/DatosPagosPanel.tsx';
import { PagosPanel, AvisoPagos } from './cobranza/PagosPanel.tsx';
import { SubWhatsapp, ModoEnvio } from './cobranza/WhatsappPanel.tsx';
import { ConfiguracionPanel } from './cobranza/ConfiguracionPanel.tsx';
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

export function CobranzaInteligenteView(props: VistaProps = {}) {
  // Si quien la monta ya trae el estado (para la barra lateral), se comparte.
  const yaHay = useCobranzaOpcional();
  if (yaHay) return <CobranzaIA {...props} />;
  return (
    <CobranzaProvider>
      <CobranzaIA {...props} />
    </CobranzaProvider>
  );
}

type VistaProps = {
  /** Sección y perfil controlados desde fuera (barra lateral + URL). */
  seccion?: Section;
  rol?: Rol;
  onSeccion?: (s: Section) => void;
  onRol?: (r: Rol) => void;
};

/** Navegación de la barra lateral con el contador de alertas en vivo. Va dentro de <CobranzaProvider>. */
export function NavCobranzaViva(props: { rol: Rol; seccion: Section; onSeccion: (s: Section) => void }) {
  return <NavCobranza {...props} pendientesAlertas={usePendientesAlertas()} />;
}

/** Alertas pendientes, para el contador de la barra lateral. Usar dentro de <CobranzaProvider>. */
export function usePendientesAlertas(): number {
  return useAlertas(MOCK.alertas).vigentes.length;
}

function CobranzaIA({ seccion: seccionProp, rol: rolProp, onSeccion, onRol }: VistaProps) {
  const [rolLocal, setRolLocal] = React.useState<Rol>('admin');
  const [seccionLocal, setSeccionLocal] = React.useState<Section>('recordatorios');
  const rol = rolProp ?? rolLocal;
  const section = seccionProp ?? seccionLocal;
  // Sin barra lateral que la controle (uso suelto), se muestran pestañas arriba.
  const controlada = !!onSeccion;
  const setSection = (s: Section) => (onSeccion ? onSeccion(s) : setSeccionLocal(s));
  // "Ver cliente" desde otra pestaña: abre Clientes con ese cliente elegido.
  const [foco, setFoco] = React.useState<{ cliente: string; n: number; sub?: SubSeccion } | null>(null);
  const verCliente = (cliente: string, sub?: SubSeccion) => {
    setFoco((f) => ({ cliente, sub, n: (f?.n ?? 0) + 1 }));
    setSection('recordatorios');
  };
  const reduce = useReducedMotion();
  const meta = SECCIONES[section];
  const titulo = rol === 'agente' ? ENCABEZADO.agente.titulo : meta.titulo;
  const texto = rol === 'agente' ? ENCABEZADO.agente.texto : meta.texto;

  const cambiarRol = (r: Rol) => {
    if (onRol) return onRol(r);
    setRolLocal(r);
    if (r !== 'agente' && !seccionesDe(r).includes(section)) setSeccionLocal('recordatorios');
  };

  return (
    <div className="relative isolate flex-1 pb-12 w-full font-royaltica" style={estiloAcento(section)}>
      {/* Luz ambiente con el color de la sección: cada parte se reconoce sin gritar.
          Se sale del margen del contenido para cubrir toda la pantalla, sin cortes. */}
      <div aria-hidden className="pointer-events-none absolute -top-6 sm:-top-8 -inset-x-5 sm:-inset-x-8 bottom-0 -z-10 overflow-hidden">
        <div className="absolute -top-24 right-[4%] w-[560px] h-[560px] rounded-full bg-[rgb(var(--acento)/0.12)] blur-[120px] transition-colors duration-700" />
        <div className="absolute top-[420px] -left-28 w-[520px] h-[520px] rounded-full bg-cyan-200/30 blur-[120px]" />
        <div className="absolute top-[1000px] right-[20%] w-[560px] h-[560px] rounded-full bg-[rgb(var(--acento)/0.1)] blur-[130px] transition-colors duration-700" />
      </div>

      {/* Encabezado compacto: nombre de la sección, para qué sirve y el estado de los datos. */}
      <header className="flex flex-wrap items-center gap-x-6 gap-y-3 pr-14">
        <div className="flex items-center gap-3.5 min-w-0 flex-1">
          <motion.span
            key={section + rol}
            initial={reduce ? false : { scale: 0.7, opacity: 0, rotate: -8 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            transition={SPRING}
            className="shrink-0 w-11 h-11 rounded-[15px] flex items-center justify-center bg-brand-ink shadow-[0_12px_26px_-12px_rgba(17,24,39,0.6)]"
            style={{ color: `rgb(${meta.acento})` }}
          >
            <meta.Icono size={19} />
          </motion.span>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={section + rol}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4 }}
              transition={SPRING}
              className="min-w-0"
            >
              <h2 className="text-[26px] leading-tight tracking-tight text-brand-ink">{titulo}</h2>
              <p className="text-[13px] text-brand-ink/50 leading-snug truncate max-w-[80ch]">{texto}</p>
            </motion.div>
          </AnimatePresence>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Solo el Administrador decide si los recordatorios salen solos o con su aprobación. */}
          {rol === 'admin' && section === 'recordatorios' && <ModoEnvio />}
          <FuenteDatos />
        </div>
      </header>

      {/* Uso suelto (sin barra lateral): pestañas de vidrio arriba. */}
      {!controlada && rol !== 'agente' && (
        <nav className="mt-5 glass rounded-full p-1.5 flex items-center gap-0.5 overflow-x-auto [scrollbar-width:none]" aria-label="Secciones de cobranza">
          {seccionesDe(rol).map((id) => {
            const activa = section === id;
            return (
              <button
                key={id}
                onClick={() => setSection(id)}
                aria-current={activa ? 'page' : undefined}
                className={`relative shrink-0 rounded-full px-4 py-2.5 text-[13px] font-semibold outline-none transition-colors ${
                  activa ? 'text-white' : 'text-brand-ink/50 hover:text-brand-ink'
                }`}
              >
                {activa && (
                  <motion.span layoutId={reduce ? undefined : 'seccion-activa'} transition={SPRING} className="absolute inset-0 rounded-full bg-brand-ink" />
                )}
                <span className="relative">{SECCIONES[id].nombre}</span>
              </button>
            );
          })}
        </nav>
      )}

      {rol !== 'agente' && section !== 'pagos' && section !== 'configuracion' && (
        <div className="mt-3 pl-[58px]">
          <AvisoPagos onIr={() => setSection('pagos')} />
        </div>
      )}
      <div className="h-6" />

      <motion.div
        key={`${rol}-${section}`}
        initial={reduce ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={reduce ? { duration: 0 } : SPRING_SUAVE}
      >
        {rol === 'agente' ? (
          <AgenteVista renderPlan={(c) => <SubPlan registro={registroDe(c)} />} />
        ) : (
          <>
            {section === 'alertas' && (
              <AlertasPanel onVerCliente={verCliente} onIr={(d: Destino) => setSection(d)} />
            )}
            {section === 'recordatorios' && <RecordatoriosPanel foco={foco} />}
            {section === 'campanas' && <CampanasPanel />}
            {section === 'plantillas' && <PlantillasPanel onIrSegmentos={() => setSection('segmentos')} />}
            {section === 'reportes' && <ReportesPanel soloEquipo={rol === 'supervisor'} />}
            {section === 'datos' && <DatosPagosPanel />}
            {section === 'pagos' && <PagosPanel soloLectura={rol === 'supervisor'} onVerCliente={verCliente} />}
            {section === 'segmentos' && <SegmentosPanel onVerPlantillas={() => setSection('plantillas')} />}
            {section === 'equipo' && <EquipoConSub />}
            {section === 'configuracion' && <ConfiguracionPanel />}
          </>
        )}
      </motion.div>
    </div>
  );
}

/** Equipo en dos partes: cómo va cada persona y a quién le toca cada cuenta. */
function EquipoConSub() {
  const [parte, setParte] = React.useState<'desempeno' | 'asignacion'>('desempeno');
  const { cartera } = useCobranza();
  const sinAsignar = cartera.filter((c) => (c.agente as string) === 'Sin asignar').length;
  return (
    <div className="space-y-5">
      <Subpestanas
        grupo="equipo"
        etiqueta="Partes de Equipo"
        valor={parte}
        onChange={setParte}
        opciones={[
          { id: 'desempeno', nombre: 'Desempeño' },
          { id: 'asignacion', nombre: 'Asignación de cuentas', n: sinAsignar, alerta: true },
        ]}
      />
      <PanelSub id={parte}>{parte === 'desempeno' ? <EquipoPanel /> : <AsignacionPanel />}</PanelSub>
    </div>
  );
}

/** De dónde salen los datos: chip discreto, el detalle va en el tooltip. */
function FuenteDatos() {
  const { fuente } = useCobranza();
  if (fuente === 'cargando') return <span className="h-6" />;
  const real = fuente === 'real';
  const detalle = real
    ? 'Clientes, facturas, agentes, historial de pagos, plan y WhatsApp vienen de tu cartera. Pagos, campañas y reportes todavía usan datos de ejemplo.'
    : 'Tu base todavía no tiene clientes (o no hubo conexión con el servidor). Carga tu cartera en la pestaña Datos para trabajar con tus clientes reales.';
  return (
    <span
      title={detalle}
      className="inline-flex items-center gap-2 rounded-full pl-2.5 pr-3 py-1 text-[11.5px] text-brand-ink/60 bg-white/55 backdrop-blur-xl border border-white/80 ring-1 ring-brand-ink/[0.06]"
    >
      <span className={`w-1.5 h-1.5 rounded-full ${real ? 'bg-emerald-500' : 'bg-amber-400'}`} />
      <span className="font-semibold text-brand-ink/80">{real ? 'Datos reales de tu base' : 'Datos de ejemplo'}</span>
      <span className="hidden md:inline text-brand-ink/45">
        {real ? '· pagos, campañas y reportes aún de ejemplo' : '· carga tu cartera en Datos'}
      </span>
      <Info size={12} className="text-brand-ink/35" aria-hidden />
    </span>
  );
}

// ─── 1 · Prioridades ─────────────────────────────────────────────────
// Orden sugerido de trabajo. El desglose del score de cada cuenta y el
// simulador viven en la pestaña de Recordatorios, junto al historial del
// cliente; aquí solo se muestra el score ya compuesto.

type CarteraItem = (typeof MOCK.cartera)[number];


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

  const pctVencida = porCobrar ? Math.round((vencida / porCobrar) * 100) : 0;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <KpiVidrio i={0} icono={<Users size={16} />} label="Para atender hoy" numeric={hoy.length} sub="clientes con un paso que toca hoy" />
      <KpiVidrio i={1} icono={<Wallet size={16} />} label="Saldo de hoy" numeric={montoHoy} format="moneda" sub="lo que deben los clientes de hoy" />
      <KpiVidrio
        i={2}
        icono={<TrendingDown size={16} />}
        label="Cartera vencida"
        numeric={vencida}
        format="moneda"
        sub={`${pctVencida}% de todo lo que está por cobrar`}
        barra={pctVencida}
      />
      <KpiVidrio i={3} icono={<PhoneCall size={16} />} label="Requieren llamada" numeric={humano} sub="hoy toca una persona, no un mensaje" accent />
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

type SubSeccion = 'facturas' | 'plan' | 'whatsapp' | 'historial' | 'riesgo';

const SUB_SECCIONES: { id: SubSeccion; label: string }[] = [
  { id: 'facturas', label: 'Facturas' },
  { id: 'plan', label: 'Plan' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'historial', label: 'Historial' },
  { id: 'riesgo', label: 'Riesgo y simulador' },
];

/**
 * Expediente de un cliente que todavía no tiene mensajes registrados: misma
 * forma que los de MOCK.recordatorios, con lo que se sabe de la cartera.
 */
function registroDe(c: CuentaViva): RecordatorioItem {
  const encontrado = MOCK.recordatorios.find((r) => r.cliente === c.cliente);
  if (encontrado) return encontrado;
  return {
    cliente: c.cliente,
    encargado: c.agente,
    enviados: 0,
    tasa: 0,
    ultimo: '—',
    mejor: { canal: c.canal, tono: 'Estándar', hora: '—', estrategia: 'Plantilla general' },
    nota: c.diagnostico.porque,
    // Del propio cliente (no por nombre): un cliente real puede no existir en el prototipo.
    plan: planConfig(c, c.segmento),
    mensajes: [],
  } as unknown as RecordatorioItem;
}

/**
 * El expediente de cada cliente se reparte en subpestañas en vez de apilarse.
 * Antes la columna de detalle medía 2,260px (más de cuatro pantallas) contra
 * 511px de la lista: eso dejaba 1,750px de columna izquierda vacía. Con las
 * subpestañas cada vista cabe de un vistazo y las alturas se emparejan.
 */
type FiltroCli = 'todos' | 'vencidos' | 'sin_finanzas' | 'pausados' | 'espera' | 'sin_plan';
const FILTROS_CLI: { id: FiltroCli; nombre: string; prueba: (c: CuentaViva) => boolean }[] = [
  { id: 'todos', nombre: 'Todos', prueba: () => true },
  { id: 'vencidos', nombre: 'Vencidos', prueba: (c) => !c.saldada && c.dias > 0 },
  { id: 'sin_finanzas', nombre: 'Sin contacto', prueba: (c) => !c.finanzas },
  { id: 'pausados', nombre: 'Pausados', prueba: (c) => !c.contactable },
  { id: 'espera', nombre: 'Espera descuentos', prueba: (c) => c.comportamiento.esperaDescuentos },
  { id: 'sin_plan', nombre: 'Factura sin plan', prueba: (c) => c.facturas.some((f) => !f.planInicio) },
];

function RecordatoriosPanel({ foco }: { foco?: { cliente: string; n: number; sub?: SubSeccion } | null }) {
  const { cartera, reasignar, pausarContacto, agentesReales } = useCobranza();
  const { avisar, nodo } = useAviso();
  const [filtro, setFiltro] = React.useState<FiltroCli>('todos');
  const [agenteF, setAgenteF] = React.useState('');
  const [orden, setOrden] = React.useState<'original' | 'saldo' | 'dias' | 'nombre'>('original');
  const [seleccion, setSeleccion] = React.useState<string[] | null>(null);
  const [destino, setDestino] = React.useState('');
  const planDeCliente = (cliente: string) => planCuenta(cartera.find((c) => c.cliente === cliente)!);
  const [selected, setSelected] = React.useState(cartera[0]?.cliente ?? '');
  const [sub, setSub] = React.useState<SubSeccion>('facturas');
  const [buscar, setBuscar] = React.useState('');
  const [masFiltros, setMasFiltros] = React.useState(false);
  // La lista ocupa toda la pantalla; el expediente de un cliente se abre aparte.
  const [vista, setVista] = React.useState<'lista' | 'cliente'>('lista');
  const abrir = (cliente: string) => {
    setSelected(cliente);
    setVista('cliente');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  // Tocar "Clientes" en la barra lateral regresa a la lista.
  React.useEffect(() => {
    const volver = (e: Event) => (e as CustomEvent<string>).detail === 'recordatorios' && setVista('lista');
    window.addEventListener('cobranza:inicio-seccion', volver);
    return () => window.removeEventListener('cobranza:inicio-seccion', volver);
  }, []);
  // Viene de "Ver cliente" (Alertas u otra pestaña).
  React.useEffect(() => {
    if (!foco) return;
    setVista('cliente');
    setSelected(foco.cliente);
    setSub(foco.sub ?? 'facturas');
    setBuscar('');
    setFiltro('todos');
  }, [foco]);
  const registros = cartera.map(registroDe);
  const cuentaPor = (n: string) => cartera.find((c) => c.cliente === n)!;
  const pruebaF = FILTROS_CLI.find((f) => f.id === filtro)!.prueba;
  const visibles = registros
    .filter((r) => {
      const c = cuentaPor(r.cliente);
      if (!c) return false;
      const q = buscar.trim().toLowerCase();
      if (q && ![r.cliente, c.datos?.rfc, c.folio, c.finanzas?.nombre].join(' ').toLowerCase().includes(q)) return false;
      if (agenteF && c.agente !== agenteF) return false;
      return pruebaF(c);
    })
    .sort((a, b) => {
      const ca = cuentaPor(a.cliente);
      const cb = cuentaPor(b.cliente);
      if (orden === 'saldo') return saldoDe(cb) - saldoDe(ca);
      if (orden === 'dias') return cb.dias - ca.dias;
      if (orden === 'nombre') return a.cliente.localeCompare(b.cliente, 'es');
      return 0;
    });
  const agentesLista = agentesReales?.map((a) => a.nombre) ?? [...new Set([...AGENTES, ...cartera.map((c) => c.agente)])];
  const alternarSel = (n: string) => setSeleccion((s) => (s ? (s.includes(n) ? s.filter((x) => x !== n) : [...s, n]) : [n]));
  const elegidas = (seleccion ?? []).map(cuentaPor).filter(Boolean);
  const reasignarSel = () => {
    if (!destino || !elegidas.length) return;
    elegidas.forEach((c) => reasignar(c.id, destino as CuentaViva['agente']));
    avisar(`${elegidas.length} ${elegidas.length === 1 ? 'cliente reasignado' : 'clientes reasignados'} a ${destino}`);
    setSeleccion([]);
    setDestino('');
  };
  const pausarSel = async () => {
    const reales = elegidas.filter((c) => c.dbId && c.contactable);
    if (!reales.length) return avisar('Ninguno de los elegidos se puede pausar (ya pausados o de ejemplo).', { error: true });
    const errs = (await Promise.all(reales.map((c) => pausarContacto(c.id, true, 'Pausado en lote')))).filter(Boolean);
    if (errs.length) return avisar(errs[0]!, { error: true });
    avisar(`Pausaste el contacto con ${reales.length} ${reales.length === 1 ? 'cliente' : 'clientes'}`, {
      deshacer: () => void Promise.all(reales.map((c) => pausarContacto(c.id, false))),
    });
    setSeleccion([]);
  };
  const activo = registros.find((r) => r.cliente === selected) ?? registros[0];
  const reduce = useReducedMotion();
  // El riesgo de la cuenta vive en MOCK.cartera y se enlaza por nombre de
  // cliente. Puede no existir (un cliente contactado sin factura priorizada),
  // por eso las tarjetas de riesgo y simulación se renderizan condicionadas.
  const cuenta = cuentaDe(activo.cliente);
  const activoVivo = cartera.find((c) => c.cliente === activo.cliente)!;

  // Agregados de la cartera contactada: llenan el pie de la lista con algo
  // útil en vez de dejar aire muerto bajo los cinco clientes.
  const conMensajes = registros.filter((r) => r.enviados > 0);
  const totalMensajes = registros.reduce((s, r) => s + r.enviados, 0);
  const tasaPromedio = Math.round(
    conMensajes.reduce((s, r) => s + r.tasa, 0) / Math.max(1, conMensajes.length),
  );
  const enEscalamiento = registros.filter((r) =>
    planDeCliente(r.cliente).actual?.fase === 'escalamiento',
  ).length;

  const filtrosActivos = (agenteF ? 1 : 0) + (orden !== 'original' ? 1 : 0);
  const planActivo = planCuenta(activoVivo);
  const saldoActivo = saldoDe(activoVivo);

  const posicion = visibles.findIndex((r) => r.cliente === activo.cliente);
  const vecino = (d: number) => {
    if (!visibles.length) return;
    const i = posicion < 0 ? 0 : (posicion + d + visibles.length) % visibles.length;
    setSelected(visibles[i].cliente);
  };

  return (
    <div>
      <AnimatePresence mode="wait" initial={false}>
      {vista === 'lista' ? (
      <motion.div
        key="lista"
        initial={reduce ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
        transition={SPRING_SUAVE}
        className="space-y-5"
      >
        <ResumenHoy />
        <div className="glass rounded-[28px] overflow-hidden flex flex-col">
          <div className="px-5 pt-4 pb-3 space-y-3 border-b border-brand-ink/[0.06]">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[15px] font-semibold text-brand-ink">Clientes</span>
              <span className="rounded-full bg-brand-ink/[0.06] px-2 py-0.5 text-[11px] font-semibold tabular-nums text-brand-ink/55">
                {visibles.length === cartera.length ? cartera.length : `${visibles.length} de ${cartera.length}`}
              </span>
              <label className="glass-campo order-last md:order-none w-full md:w-auto md:flex-1 md:max-w-[440px] md:ml-4 flex items-center gap-2 rounded-full px-3.5 py-2">
                <Search size={14} className="text-brand-ink/35 shrink-0" />
                <input
                  value={buscar}
                  onChange={(e) => setBuscar(e.target.value)}
                  placeholder="Buscar cliente, RFC o folio"
                  className="w-full bg-transparent text-[13px] text-brand-ink placeholder:text-brand-ink/35 outline-none"
                />
                {buscar && (
                  <button type="button" onClick={() => setBuscar('')} aria-label="Limpiar búsqueda" className="text-brand-ink/35 hover:text-brand-ink">
                    <X size={13} />
                  </button>
                )}
              </label>
              <span className="flex-1" />
              <button
                type="button"
                onClick={() => setMasFiltros((v) => !v)}
                aria-expanded={masFiltros}
                aria-label="Más filtros"
                title="Agente y orden"
                className={`relative w-10 h-10 shrink-0 rounded-full flex items-center justify-center transition-colors ${
                  masFiltros ? 'bg-brand-ink text-white' : 'glass-campo text-brand-ink/55 hover:text-brand-ink'
                }`}
              >
                <SlidersHorizontal size={15} />
                {filtrosActivos > 0 && !masFiltros && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-brand-gold text-[9.5px] font-bold text-brand-ink flex items-center justify-center">
                    {filtrosActivos}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setSeleccion((s) => (s ? null : []))}
                aria-pressed={!!seleccion}
                className={`ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11.5px] font-semibold transition-colors ${
                  seleccion ? 'bg-brand-ink text-white' : 'text-brand-ink/55 hover:text-brand-ink hover:bg-brand-ink/[0.05]'
                }`}
              >
                {seleccion ? <X size={12} /> : <ListChecks size={12} />} {seleccion ? 'Terminar' : 'Seleccionar'}
              </button>
            </div>

            <AnimatePresence initial={false}>
              {masFiltros && (
                <motion.div
                  initial={reduce ? false : { opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
                  transition={{ duration: 0.2, ease: EASE }}
                  className="overflow-hidden"
                >
                  <div className="grid grid-cols-2 gap-2 max-w-md">
                    <select value={agenteF} onChange={(e) => setAgenteF(e.target.value)} className={CONTROL + ' !rounded-full !py-2 !text-[12px]'} aria-label="Filtrar por agente">
                      <option value="">Todos los agentes</option>
                      {[...new Set(cartera.map((c) => c.agente))].sort().map((a) => (
                        <option key={a}>{a}</option>
                      ))}
                    </select>
                    <select value={orden} onChange={(e) => setOrden(e.target.value as typeof orden)} className={CONTROL + ' !rounded-full !py-2 !text-[12px]'} aria-label="Ordenar">
                      <option value="original">Por prioridad</option>
                      <option value="saldo">Mayor saldo</option>
                      <option value="dias">Más días vencida</option>
                      <option value="nombre">Nombre</option>
                    </select>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex gap-1.5 overflow-x-auto -mx-5 px-5 [scrollbar-width:none]">
              {FILTROS_CLI.map((f) => {
                const n = cartera.filter(f.prueba).length;
                if (f.id !== 'todos' && !n) return null;
                const on = filtro === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFiltro(f.id)}
                    aria-pressed={on}
                    className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11.5px] font-semibold transition-colors ${
                      on ? 'bg-brand-ink text-white' : 'bg-white/55 ring-1 ring-brand-ink/[0.07] text-brand-ink/55 hover:text-brand-ink hover:bg-white'
                    }`}
                  >
                    {f.nombre}
                    <span className={`tabular-nums text-[10.5px] ${on ? 'text-white/60' : 'text-brand-ink/35'}`}>{n}</span>
                  </button>
                );
              })}
            </div>

            {seleccion && (
              <div className="rounded-2xl bg-[rgb(var(--acento)/0.08)] ring-1 ring-[rgb(var(--acento)/0.25)] px-3 py-2.5 space-y-2">
                <div className="flex items-center gap-3 text-[12px]">
                  <span className="font-semibold text-brand-ink tabular-nums">{seleccion.length} elegidos</span>
                  <button type="button" onClick={() => setSeleccion(visibles.map((r) => r.cliente))} className="text-[11.5px] font-semibold text-brand-ink/55 hover:text-brand-ink">
                    Todos
                  </button>
                  <button type="button" onClick={() => setSeleccion([])} className="text-[11.5px] font-semibold text-brand-ink/55 hover:text-brand-ink">
                    Ninguno
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <select value={destino} onChange={(e) => setDestino(e.target.value)} className={CONTROL + ' !w-auto !rounded-full !py-1.5 !text-[12px]'} aria-label="Reasignar a">
                    <option value="">Reasignar a…</option>
                    {agentesLista.map((a) => (
                      <option key={a}>{a}</option>
                    ))}
                  </select>
                  <button type="button" onClick={reasignarSel} disabled={!destino || !elegidas.length} className={BTN_SEC}>
                    <Users size={11} /> Reasignar
                  </button>
                  <button type="button" onClick={() => void pausarSel()} disabled={!elegidas.length} className={BTN_SEC}>
                    <Pause size={11} /> Pausar
                  </button>
                  <button type="button" onClick={() => exportarCuentasCsv(elegidas, 'clientes-seleccionados.csv')} disabled={!elegidas.length} className={BTN_SEC}>
                    <Download size={11} /> Exportar
                  </button>
                </div>
              </div>
            )}
          </div>

          {visibles.length > 0 && (
            <div className="hidden md:grid grid-cols-[minmax(0,2.3fr)_minmax(0,1.7fr)_minmax(0,1fr)_120px_120px_24px] gap-4 px-5 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-ink/35">
              <span className="pl-[52px]">Cliente</span>
              <span>Hoy toca</span>
              <span>Agente</span>
              <span className="text-right">Saldo</span>
              <span className="text-right">Vencimiento</span>
              <span />
            </div>
          )}
          <div className="p-2 space-y-0.5">
            {visibles.map((r) => {
              const c = cuentaPor(r.cliente);
              const cuentaFila = cuentaDe(r.cliente);
              const activa = selected === r.cliente;
              const elegida = !!seleccion?.includes(r.cliente);
              const planFila = planDeCliente(r.cliente);
              const pasoActual = planFila.actual;
              const siguiente = !pasoActual ? planFila.proxima : undefined;
              const riesgo = cuentaFila ? nivelRiesgo(scoreOf(cuentaFila.factores)) : null;
              const insignia = c.saldada
                ? { t: 'Saldada', cls: 'bg-emerald-500/10 text-emerald-700' }
                : !c.contactable
                  ? { t: 'Pausado', cls: 'bg-amber-500/12 text-amber-800' }
                  : c.facturas.some((f) => !f.planInicio)
                    ? { t: 'Sin plan', cls: 'bg-amber-500/12 text-amber-800' }
                    : c.comportamiento.esperaDescuentos
                      ? { t: 'Espera descuento', cls: 'bg-rose-500/10 text-rose-700' }
                      : null;
              return (
                <button
                  key={r.cliente}
                  type="button"
                  onClick={() => (seleccion ? alternarSel(r.cliente) : abrir(r.cliente))}
                  aria-current={activa && !seleccion ? 'true' : undefined}
                  aria-pressed={seleccion ? elegida : undefined}
                  className={`group relative w-full text-left rounded-[18px] px-3 py-3 flex md:grid md:grid-cols-[minmax(0,2.3fr)_minmax(0,1.7fr)_minmax(0,1fr)_120px_120px_24px] items-center gap-3 md:gap-4 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand-gold/70 hover:bg-white/70 ${
                    elegida ? 'bg-[rgb(var(--acento)/0.08)]' : ''
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                  {seleccion ? (
                    <span
                      aria-hidden
                      className={`relative w-10 h-10 shrink-0 rounded-full flex items-center justify-center transition-colors ${
                        elegida ? 'bg-brand-ink text-white' : 'bg-white ring-1 ring-brand-ink/15 text-transparent'
                      }`}
                    >
                      <Check size={15} strokeWidth={3} />
                    </span>
                  ) : (
                    <Iniciales nombre={r.cliente} riesgo={riesgo} />
                  )}
                  <div className="relative min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-[13.5px] font-semibold text-brand-ink truncate">{r.cliente}</span>
                      {insignia && (
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${insignia.cls}`}>{insignia.t}</span>
                      )}
                    </div>
                    <div className="text-[11.5px] text-brand-ink/40 font-mono truncate hidden md:block">{c.folio}</div>
                    <div className="flex md:hidden items-center gap-1.5 mt-0.5 text-[11.5px] text-brand-ink/50 min-w-0">
                      {pasoActual ? <FaseDot fase={pasoActual.fase} /> : null}
                      <span className="truncate">{pasoActual ? `${pasoActual.etiqueta} · ${pasoActual.nombre}` : siguiente ? `Al día · ${siguiente.etiqueta} en ${siguiente.faltan} d` : c.agente}</span>
                    </div>
                  </div>
                  </div>
                    <div className="hidden md:flex items-center gap-1.5 text-[12.5px] text-brand-ink/60 min-w-0">
                      {pasoActual ? (
                        <>
                          <FaseDot fase={pasoActual.fase} />
                          <span className="truncate">
                            {pasoActual.etiqueta} · {pasoActual.nombre}
                          </span>
                        </>
                      ) : siguiente ? (
                        <>
                          <Check size={11} className="text-emerald-600 shrink-0" />
                          <span className="truncate">
                            Al día · {siguiente.etiqueta} en {siguiente.faltan} d
                          </span>
                        </>
                      ) : (
                        <span className="truncate text-brand-ink/40">Plan terminado</span>
                      )}
                    </div>
                  <span className="hidden md:block text-[12.5px] text-brand-ink/55 truncate">{c.agente}</span>
                  <div className="shrink-0 text-right md:contents">
                    <div className="text-[13px] font-semibold tabular-nums text-brand-ink md:text-right">{c.saldada ? '—' : compacto(saldoDe(c))}</div>
                    <div className={`text-[10.5px] md:text-[12px] tabular-nums md:text-right ${c.dias > 0 && !c.saldada ? 'text-rose-600 font-semibold' : 'text-brand-ink/45'}`}>
                      {c.saldada ? 'pagada' : c.dias > 0 ? `${c.dias} d vencida` : c.dias === 0 ? 'vence hoy' : `vence en ${-c.dias} d`}
                    </div>
                  </div>
                  <ChevronRight size={16} className="hidden md:block text-brand-ink/25 group-hover:text-brand-ink/60 group-hover:translate-x-0.5 transition-all" />
                </button>
              );
            })}
            {!visibles.length && (
              <div className="px-6 py-10 text-center">
                <p className="text-[13px] text-brand-ink/45">Ningún cliente coincide.</p>
                <button
                  type="button"
                  onClick={() => {
                    setBuscar('');
                    setFiltro('todos');
                    setAgenteF('');
                  }}
                  className="mt-3 text-[12px] font-semibold text-brand-ink/60 hover:text-brand-ink underline underline-offset-2"
                >
                  Quitar filtros
                </button>
              </div>
            )}
          </div>

          {/* Pulso de la cartera contactada */}
          <div className="grid grid-cols-3 border-t border-brand-ink/[0.06] bg-white/40">
            <ListaStat label="Mensajes" value={String(totalMensajes)} />
            <ListaStat label="Respuesta" value={`${tasaPromedio}%`} />
            <ListaStat label="Escalando" value={String(enEscalamiento)} alerta={enEscalamiento > 0} />
          </div>
        </div>
      </motion.div>
      ) : (
      <motion.div
        key="cliente"
        initial={reduce ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
        transition={SPRING_SUAVE}
        className="space-y-4"
      >
      {/* Volver a la lista y pasar al cliente de al lado */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setVista('lista')}
          className="inline-flex items-center gap-1.5 h-10 pl-3 pr-4 rounded-full bg-white/70 ring-1 ring-brand-ink/10 text-[13px] font-semibold text-brand-ink/70 hover:bg-white hover:text-brand-ink transition-colors"
        >
          <ArrowLeft size={15} /> Clientes
        </button>
        <span className="flex-1" />
        {posicion >= 0 && (
          <span className="text-[12px] text-brand-ink/45 tabular-nums mr-1">
            {posicion + 1} de {visibles.length}
          </span>
        )}
        <button type="button" onClick={() => vecino(-1)} aria-label="Cliente anterior" className="w-10 h-10 rounded-full bg-white/70 ring-1 ring-brand-ink/10 flex items-center justify-center text-brand-ink/60 hover:bg-white hover:text-brand-ink">
          <ChevronLeft size={16} />
        </button>
        <button type="button" onClick={() => vecino(1)} aria-label="Cliente siguiente" className="w-10 h-10 rounded-full bg-white/70 ring-1 ring-brand-ink/10 flex items-center justify-center text-brand-ink/60 hover:bg-white hover:text-brand-ink">
          <ChevronRight size={16} />
        </button>
      </div>
      <motion.div
        key={activo.cliente}
        initial={reduce ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={SPRING_SUAVE}
        className="glass rounded-[28px] overflow-hidden min-w-0"
      >
        <div className="relative px-5 sm:px-7 pt-6 pb-5">
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-[rgb(var(--acento)/0.08)] to-transparent" />
          <div className="relative flex flex-wrap items-start gap-4">
            <Iniciales nombre={activo.cliente} grande riesgo={cuenta ? nivelRiesgo(scoreOf(cuenta.factores)) : null} />
            <div className="min-w-0 flex-1">
              <h3 className="text-[1.55rem] leading-tight font-serif text-brand-ink truncate">{activo.cliente}</h3>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-[12px] text-brand-ink/45">
                <span className="font-mono text-[11.5px]">{activoVivo.folio}</span>
                <span aria-hidden>·</span>
                <span>{activoVivo.agente}</span>
                {activoVivo.finanzas && (
                  <>
                    <span aria-hidden>·</span>
                    <span className="truncate">{activoVivo.finanzas.nombre}</span>
                  </>
                )}
                <SegmentoChip cuenta={activoVivo} />
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setSub('facturas')}
                className="inline-flex items-center gap-1.5 h-10 px-4 rounded-full bg-white/70 ring-1 ring-brand-ink/10 text-[12.5px] font-semibold text-brand-ink/70 hover:bg-white hover:text-brand-ink transition-colors"
              >
                <WalletIcon size={14} /> Registrar pago
              </button>
              <button
                type="button"
                onClick={() => setSub('whatsapp')}
                className="inline-flex items-center gap-1.5 h-10 px-4 rounded-full bg-emerald-600 text-white text-[12.5px] font-semibold hover:bg-emerald-700 shadow-[0_10px_24px_-12px_rgba(5,150,105,0.7)] transition-colors"
              >
                <MessageCircle size={14} /> WhatsApp
              </button>
            </div>
          </div>

          {/* La cuenta en cuatro datos */}
          <div className="relative grid grid-cols-2 lg:grid-cols-4 gap-2 mt-5">
            <DatoCuenta label="Saldo" value={activoVivo.saldada ? 'Saldada' : CURRENCY_FORMATTER.format(saldoActivo)} />
            <DatoCuenta
              label="Vencimiento"
              value={activoVivo.dias > 0 ? `${activoVivo.dias} días vencida` : activoVivo.dias === 0 ? 'Vence hoy' : `En ${-activoVivo.dias} días`}
              tono={activoVivo.dias > 0 && !activoVivo.saldada ? 'rojo' : undefined}
            />
            <DatoCuenta
              label="Hoy toca"
              value={
                activoVivo.saldada
                  ? 'Nada'
                  : planActivo.actual
                    ? `${planActivo.actual.etiqueta} · ${planActivo.actual.nombre}`
                    : planActivo.proxima
                      ? `Al día · ${planActivo.proxima.etiqueta} en ${planActivo.proxima.faltan} d`
                      : 'Plan terminado'
              }
            />
            <DatoCuenta label="Pagado" value={`${Math.round((activoVivo.pagado / Math.max(1, activoVivo.monto)) * 100)}%`} barra={(activoVivo.pagado / Math.max(1, activoVivo.monto)) * 100} />
          </div>

          {!activoVivo.contactable && (
            <p className="relative mt-3 flex items-center gap-2 text-[12px] text-amber-900 bg-amber-500/10 rounded-2xl px-3.5 py-2.5">
              <Pause size={13} className="shrink-0" /> Contacto en pausa: {activoVivo.motivo ?? 'sin motivo'}. Ningún canal automático le escribe.
            </p>
          )}

          <div className="relative mt-5">
            <Subpestanas
              grupo="expediente"
              etiqueta={`Expediente de ${activo.cliente}`}
              valor={sub}
              onChange={setSub}
              opciones={SUB_SECCIONES.map((x) => ({ id: x.id, nombre: x.label }))}
            />
          </div>
        </div>

        <div className="border-t border-brand-ink/[0.06]">
          <motion.div
            key={`${activo.cliente}-${sub}`}
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduce ? { duration: 0 } : SPRING_SUAVE}
          >
            {sub === 'facturas' && <SubFacturas cuenta={activoVivo} />}
            {sub === 'plan' && <SubPlan registro={activo} />}
            {sub === 'whatsapp' && <SubWhatsapp cuenta={activoVivo} />}
            {sub === 'historial' && <SubHistorial registro={activo} reduce={reduce} />}
            {sub === 'riesgo' && (
              <>
                <SubResumen cuenta={cuenta} />
                {cuenta && (
                  <div className="border-t border-brand-ink/8">
                    <SimuladorCuenta cuenta={cuenta} />
                  </div>
                )}
              </>
            )}
          </motion.div>
        </div>
      </motion.div>
      </motion.div>
      )}
      </AnimatePresence>
      {nodo}
    </div>
  );
}

const compacto = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)} M` : n >= 1000 ? `$${Math.round(n / 1000)} mil` : CURRENCY_FORMATTER.format(n);

const TONO_INICIAL = {
  alto: 'bg-rose-500',
  medio: 'bg-amber-400',
  bajo: 'bg-emerald-500',
} as const;

/** Círculo con iniciales; el punto de color dice el riesgo de la cuenta. */
function Iniciales({ nombre, riesgo, grande = false }: { nombre: string; riesgo: keyof typeof TONO_INICIAL | null; grande?: boolean }) {
  const ini = nombre
    .replace(/\b(S\.?A\.?|de|C\.?V\.?|SAPI|S\.? de R\.?L\.?)\b/gi, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
  return (
    <span
      className={`relative shrink-0 rounded-full flex items-center justify-center font-bold text-brand-ink/75 bg-gradient-to-br from-[rgb(var(--acento)/0.2)] to-[rgb(var(--acento)/0.06)] ring-1 ring-[rgb(var(--acento)/0.22)] ${
        grande ? 'w-14 h-14 text-[17px]' : 'w-10 h-10 text-[12.5px]'
      }`}
    >
      {ini || '?'}
      {riesgo && (
        <span
          title={`Riesgo ${riesgo}`}
          className={`absolute bottom-0 right-0 rounded-full ring-2 ring-white ${TONO_INICIAL[riesgo]} ${grande ? 'w-3.5 h-3.5' : 'w-2.5 h-2.5'}`}
        />
      )}
    </span>
  );
}

function DatoCuenta({ label, value, tono, barra }: { label: string; value: string; tono?: 'rojo'; barra?: number }) {
  return (
    <div className="rounded-2xl bg-white/55 ring-1 ring-brand-ink/[0.06] px-3.5 py-2.5 min-w-0">
      <div className="text-[10px] uppercase tracking-[0.14em] text-brand-ink/35">{label}</div>
      <div title={value} className={`text-[13.5px] font-semibold mt-0.5 truncate tabular-nums ${tono === 'rojo' ? 'text-rose-600' : 'text-brand-ink'}`}>{value}</div>
      {barra !== undefined && (
        <div className="mt-1.5 h-1 rounded-full bg-brand-ink/[0.07] overflow-hidden">
          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, Math.max(0, barra))}%` }} />
        </div>
      )}
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
      className={`px-3.5 py-2.5 rounded-2xl ring-1 ${
        accent ? 'bg-cyan-500/[0.08] ring-cyan-500/20' : 'bg-white/55 ring-brand-ink/[0.06]'
      }`}
    >
      <div className="text-[10px] uppercase tracking-[0.14em] text-brand-ink/35">{label}</div>
      <div className="text-[13px] font-semibold text-brand-ink mt-1 truncate">{value}</div>
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
    <section className="glass rounded-[28px] p-7 space-y-6">
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
        El desglose de riesgo está disponible para las cuentas analizadas. Este cliente todavía no tiene uno: revisa su segmento y su comportamiento en Facturas.
      </p>
    );
  }
  const score = scoreOf(cuenta.factores);
  const nivel = nivelRiesgo(score);

  return (
    <div className="px-7 py-6 space-y-6">
      <div className="grid grid-cols-3 divide-x divide-white/70 border-y border-brand-ink/8">
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
        <div className="grid grid-cols-2 divide-x divide-white/70">
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
  const vencida = registro.plan.hoy > 0;
  const foco = actual ?? proxima;

  return (
    <div className="px-5 sm:px-7 py-6 space-y-5">
      {/* Lo que sigue, en una franja */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-[22px] px-5 py-4 bg-gradient-to-r from-[rgb(var(--acento)/0.1)] to-white/50 ring-1 ring-[rgb(var(--acento)/0.18)]">
        <div className="min-w-[12rem] flex-1">
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-brand-ink/40">
            {actual ? 'Toca hoy' : proxima ? 'Lo que sigue' : 'Plan terminado'}
          </div>
          <div className="flex items-center gap-2 mt-1">
            {foco && <FaseDot fase={foco.fase} />}
            <span className="text-[15px] font-semibold text-brand-ink truncate">
              {foco ? `${foco.etiqueta} · ${foco.nombre}` : 'Sin pasos pendientes'}
            </span>
          </div>
        </div>
        {foco && (
          <div className="flex flex-wrap items-center gap-1.5 text-[11.5px]">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 ring-1 ring-brand-ink/[0.07] px-3 py-1.5 font-semibold text-brand-ink/70">
              <CanalIcon canal={foco.canal} /> {foco.canal}
            </span>
            <span className="rounded-full bg-white/80 ring-1 ring-brand-ink/[0.07] px-3 py-1.5 font-semibold text-brand-ink/70">
              {actual ? 'Hoy' : proxima!.faltan === 1 ? 'Mañana' : `En ${proxima!.faltan} días`}
            </span>
          </div>
        )}
        <span className={`w-full sm:w-auto text-[11.5px] font-semibold ${vencida ? 'text-rose-600' : 'text-emerald-700'}`}>
          {textoHoy(registro.plan.hoy)}
        </span>
      </div>

      <PlanCompacto pasos={pasos} />

      {/* Por qué este plan: corto, con el detalle a un clic */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <BestFit label="Canal" value={mejor.canal} />
        <BestFit label="Tono" value={mejor.tono} />
        <BestFit label="Horario" value={mejor.hora} />
        <BestFit label="Respuesta" value={`${registro.tasa}%`} accent />
      </div>
      <details className="group rounded-2xl bg-white/45 ring-1 ring-brand-ink/[0.06] px-4 py-3 [&_summary::-webkit-details-marker]:hidden">
        <summary className="flex items-center gap-2 cursor-pointer list-none text-[12px] font-semibold text-brand-ink/60 hover:text-brand-ink">
          <Info size={13} className="text-brand-ink/35" /> Por qué este plan
          <ChevronDown size={14} className="ml-auto text-brand-ink/30 transition-transform group-open:rotate-180" />
        </summary>
        <p className="text-[12px] text-brand-ink/55 leading-relaxed mt-2.5">{nota}</p>
        <ul className="mt-2 space-y-1">
          {ajustes.map((a) => (
            <li key={a} className="flex gap-2 text-[12px] text-brand-ink/60 leading-relaxed">
              <span className="text-brand-gold">•</span>
              {a}
            </li>
          ))}
        </ul>
      </details>
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

// ─── 6 · Equipo ──────────────────────────────────────────────────────

/** Quién lleva cuentas: usuarios reales (si hay acceso) + los que ya tienen cartera. */
function nombresEquipo(cartera: CuentaViva[], reales: { nombre: string; activo: boolean }[] | null, fuente: string): string[] {
  const conCartera = [...new Set(cartera.map((c) => c.agente))];
  const base = fuente === 'real' ? (reales ?? []).filter((a) => a.activo).map((a) => a.nombre) : [...AGENTES];
  const todos = [...new Set([...base, ...conCartera])];
  // "Sin asignar" al final: es cartera que nadie está trabajando.
  return [...todos.filter((n) => n !== 'Sin asignar').sort((a, b) => a.localeCompare(b, 'es')), ...(todos.includes('Sin asignar') ? ['Sin asignar'] : [])];
}

function EquipoPanel() {
  const { cartera, envios, resultadosHoy, agentesReales, fuente } = useCobranza();
  // Todo sale de la misma cartera que ven Supervisor y Agente.
  const equipo = nombresEquipo(cartera, agentesReales, fuente).map((nombre) => {
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
          replicarlo, no para señalar a nadie. Para invitar o desactivar personas ve a Configuración → Usuarios.
        </p>
      </Reveal>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {equipo.map((persona, i) => {
          const pct = persona.cartera ? Math.round((persona.recuperado / persona.cartera) * 100) : 0;
          const saturado = persona.pendientes >= 4;
          return (
            <Reveal key={persona.nombre} delay={0.06 + i * 0.06}>
              <article className="glass rounded-[28px] p-6 space-y-5 h-full">
                <div>
                  <h4 className={`text-lg font-semibold ${persona.nombre === 'Sin asignar' ? 'text-amber-700' : 'text-brand-ink'}`}>{persona.nombre}</h4>
                  <p className="text-[11px] text-brand-ink/40 mt-0.5">
                    {persona.nombre === 'Sin asignar'
                      ? `${persona.cuentas} ${persona.cuentas === 1 ? 'cuenta' : 'cuentas'} sin responsable · asígnalas abajo`
                      : `${persona.cuentas} ${persona.cuentas === 1 ? 'cuenta asignada' : 'cuentas asignadas'}`}
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

                <div className="divide-y divide-white/70 border-t border-brand-ink/8">
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

/** Cifra del resumen del día en vidrio, con el mismo lenguaje que Campañas. */
function KpiVidrio({
  label,
  numeric,
  sub,
  icono,
  format = 'entero',
  accent = false,
  barra,
  i = 0,
}: {
  label: string;
  numeric: number;
  sub: string;
  icono: React.ReactNode;
  format?: FigureFormat;
  /** Destaca la cifra que pide acción humana. */
  accent?: boolean;
  /** Porcentaje 0–100 para una barra fina bajo la cifra. */
  barra?: number;
  i?: number;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...SPRING_SUAVE, delay: reduce ? 0 : 0.05 + i * 0.04 }}
      className={`min-w-0 rounded-[24px] p-4 sm:p-5 ${GLASS}`}
    >
      <div className="flex items-center gap-2.5">
        <span
          className={`shrink-0 w-8 h-8 rounded-xl flex items-center justify-center ${
            accent ? 'bg-brand-ink text-brand-gold' : 'bg-[rgb(var(--acento)/0.12)] text-[rgb(var(--acento))]'
          }`}
        >
          {icono}
        </span>
        <span className="text-[12px] text-brand-ink/55 truncate">{label}</span>
      </div>
      <div
        className={`text-[22px] sm:text-[28px] font-semibold tracking-tight tabular-nums leading-none mt-4 truncate ${
          accent ? 'text-cyan-700' : 'text-brand-ink'
        }`}
      >
        <Figure value={numeric} format={format} />
      </div>
      {barra !== undefined && (
        <div className="mt-3 h-1 rounded-full bg-brand-ink/[0.07] overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-amber-400 to-rose-400"
            initial={reduce ? false : { width: 0 }}
            animate={{ width: `${Math.min(100, Math.max(0, barra))}%` }}
            transition={{ ...SPRING_SUAVE, delay: reduce ? 0 : 0.2 }}
          />
        </div>
      )}
      <div className="text-[11.5px] text-brand-ink/45 mt-2 leading-snug">{sub}</div>
    </motion.div>
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
