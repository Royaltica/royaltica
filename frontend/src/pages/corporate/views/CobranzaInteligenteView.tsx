import React from 'react';
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
 * Módulo 2 — Cerebro interno de Cuentas por Cobrar.
 *
 * PROTOTIPO VISUAL: todos los datos de esta vista son de ejemplo, definidos
 * abajo en `MOCK`. No hay ninguna llamada al backend todavía — el objetivo es
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
      razon: 'Paga tarde pero siempre paga — su patrón normal son 15 días',
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
      razon: 'Monto muy alto — vigilar aunque el atraso aún es moderado',
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
      mejor: { canal: 'WhatsApp', tono: 'Estándar', hora: '9–11h', estrategia: 'Recordatorio con liga de pago' },
      nota: 'No responde correo. Por WhatsApp contesta casi siempre en la mañana.',
      mensajes: [
        { fecha: '02 sep 2026, 09:14', canal: 'WhatsApp', tipo: 'Recordatorio', tono: 'Estándar', nivel: 3, vencidoAlEnviar: 40, espera: '3 días', resultado: 'respondio' as const },
        { fecha: '30 ago 2026, 09:05', canal: 'WhatsApp', tipo: 'Recordatorio', tono: 'Suave', nivel: 2, vencidoAlEnviar: 37, espera: '5 días', resultado: 'sin_respuesta' as const },
        { fecha: '25 ago 2026, 16:40', canal: 'Correo', tipo: 'Recordatorio', tono: 'Suave', nivel: 1, vencidoAlEnviar: 32, espera: '7 días', resultado: 'sin_respuesta' as const },
        { fecha: '18 ago 2026, 09:10', canal: 'WhatsApp', tipo: 'Aviso de vencimiento', tono: 'Suave', nivel: 1, vencidoAlEnviar: 25, espera: '—', resultado: 'respondio' as const },
      ],
    },
    {
      cliente: 'Materiales Peninsulares',
      encargado: 'Ana Robles',
      enviados: 11,
      tasa: 64,
      ultimo: 'hace 5 días',
      mejor: { canal: 'Correo', tono: 'Suave', hora: '16–18h', estrategia: 'Plan de pagos en 2 parcialidades' },
      nota: 'Prefiere correo — lo revisa su área administrativa por la tarde.',
      mensajes: [
        { fecha: '29 ago 2026, 16:22', canal: 'Correo', tipo: 'Oferta de plan', tono: 'Suave', nivel: 2, vencidoAlEnviar: 24, espera: '4 días', resultado: 'respondio' as const },
        { fecha: '25 ago 2026, 17:03', canal: 'Correo', tipo: 'Recordatorio', tono: 'Suave', nivel: 1, vencidoAlEnviar: 20, espera: '6 días', resultado: 'sin_respuesta' as const },
        { fecha: '19 ago 2026, 10:30', canal: 'WhatsApp', tipo: 'Recordatorio', tono: 'Suave', nivel: 1, vencidoAlEnviar: 14, espera: '—', resultado: 'sin_respuesta' as const },
      ],
    },
    {
      cliente: 'Grupo Ferretero Bajío',
      encargado: 'Carlos Mendoza',
      enviados: 22,
      tasa: 38,
      ultimo: 'hace 1 día',
      mejor: { canal: 'Llamada', tono: 'Firme', hora: '12–14h', estrategia: 'Escalamiento a llamada del encargado' },
      nota: 'Responde poco por texto. El tono suave no genera respuesta con esta cuenta.',
      mensajes: [
        { fecha: '03 sep 2026, 12:45', canal: 'Llamada', tipo: 'Escalamiento', tono: 'Firme', nivel: 4, vencidoAlEnviar: 34, espera: '2 días', resultado: 'respondio' as const },
        { fecha: '01 sep 2026, 12:10', canal: 'WhatsApp', tipo: 'Recordatorio', tono: 'Firme', nivel: 3, vencidoAlEnviar: 32, espera: '4 días', resultado: 'sin_respuesta' as const },
        { fecha: '28 ago 2026, 09:20', canal: 'WhatsApp', tipo: 'Recordatorio', tono: 'Estándar', nivel: 2, vencidoAlEnviar: 28, espera: '5 días', resultado: 'sin_respuesta' as const },
        { fecha: '23 ago 2026, 09:15', canal: 'Correo', tipo: 'Recordatorio', tono: 'Suave', nivel: 1, vencidoAlEnviar: 23, espera: '—', resultado: 'sin_respuesta' as const },
      ],
    },
    {
      cliente: 'Logística Andrade',
      encargado: 'Ana Robles',
      enviados: 9,
      tasa: 91,
      ultimo: 'hace 8 días',
      mejor: { canal: 'WhatsApp', tono: 'Suave', hora: '9–11h', estrategia: 'Recordatorio simple, sin insistir' },
      nota: 'Responde casi siempre. Basta un recordatorio amable.',
      mensajes: [
        { fecha: '26 ago 2026, 09:32', canal: 'WhatsApp', tipo: 'Recordatorio', tono: 'Suave', nivel: 1, vencidoAlEnviar: 9, espera: '2 días', resultado: 'pago' as const },
        { fecha: '19 ago 2026, 09:40', canal: 'WhatsApp', tipo: 'Aviso de vencimiento', tono: 'Suave', nivel: 1, vencidoAlEnviar: 2, espera: '—', resultado: 'respondio' as const },
      ],
    },
    {
      cliente: 'Constructora Vanguardia',
      encargado: 'María Jiménez',
      enviados: 6,
      tasa: 50,
      ultimo: 'hace 3 días',
      mejor: { canal: 'Correo', tono: 'Estándar', hora: '8–10h', estrategia: 'Recordatorio con estado de cuenta adjunto' },
      nota: 'Cuenta grande, requiere formalidad. Responde mejor con documento adjunto.',
      mensajes: [
        { fecha: '01 sep 2026, 08:30', canal: 'Correo', tipo: 'Recordatorio', tono: 'Estándar', nivel: 2, vencidoAlEnviar: 17, espera: '6 días', resultado: 'respondio' as const },
        { fecha: '26 ago 2026, 08:45', canal: 'Correo', tipo: 'Aviso de vencimiento', tono: 'Suave', nivel: 1, vencidoAlEnviar: 11, espera: '—', resultado: 'sin_respuesta' as const },
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
      { nombre: 'Recordatorio con liga de pago incluida', exito: 81, usos: 96, nota: 'Resuelve en el momento — el cliente no tiene que buscar los datos.' },
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
      horario: '9–11h',
      canal: 'WhatsApp',
      estrategia: 'Aviso 3 días antes del vencimiento',
      exito: 88,
    },
    {
      nombre: 'El que siempre negocia',
      clientes: 17,
      descripcion: 'Puede pagar, pero pide plazo o descuento cada vez.',
      tono: 'Estándar',
      horario: '16–18h',
      canal: 'Correo',
      estrategia: 'Ofrecer plan de parcialidades desde el inicio',
      exito: 71,
    },
    {
      nombre: 'El silencioso',
      clientes: 12,
      descripcion: 'No contesta mensajes, pero reacciona a la llamada.',
      tono: 'Firme',
      horario: '12–14h',
      canal: 'Llamada',
      estrategia: 'Escalar a llamada tras 2 mensajes sin respuesta',
      exito: 54,
    },
    {
      nombre: 'El formal corporativo',
      clientes: 9,
      descripcion: 'Cuenta grande con área administrativa. Requiere documento.',
      tono: 'Estándar',
      horario: '8–10h',
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

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase font-bold tracking-[0.24em] text-brand-ink/40">
            Cobranza inteligente
          </p>
          <h2 className="text-3xl font-serif text-brand-ink mt-1">Control interno de cartera</h2>
          <p className="text-sm text-brand-ink/50 max-w-2xl mt-2">
            El cerebro que analiza toda la cartera: a quién cobrar primero y por qué, qué cuentas se
            están deteriorando, y qué forma de contacto funciona con cada cliente.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              className={`px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest border transition-colors ${
                section === s.id
                  ? 'bg-brand-ink text-brand-paper border-brand-ink'
                  : 'bg-white text-brand-ink/60 border-brand-sand hover:text-brand-ink'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <PrototypeNotice />

      {section === 'prioridades' && <PrioridadesPanel />}
      {section === 'alertas' && <AlertasPanel />}
      {section === 'recordatorios' && <RecordatoriosPanel />}
      {section === 'estrategias' && <EstrategiasPanel />}
      {section === 'perfiles' && <PerfilesPanel />}
      {section === 'equipo' && <EquipoPanel />}
    </div>
  );
}

/** Aviso permanente: nada de lo que se ve aquí viene de datos reales todavía. */
function PrototypeNotice() {
  return (
    <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
      <Info size={15} className="text-amber-600 shrink-0 mt-0.5" />
      <p className="text-[11px] text-amber-900 leading-relaxed">
        <span className="font-bold uppercase tracking-wider">Prototipo visual</span> — los datos de
        esta sección son de ejemplo para validar el diseño. El backend del Módulo 2 aún no existe;
        ningún número aquí proviene de tu cartera real.
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
 * nunca puedan contradecirse — es lo que sostiene el "no es una caja negra".
 */
function scoreOf(factores: readonly { peso: number; valor: number }[]): number {
  return Math.round(factores.reduce((sum, f) => sum + (f.peso * f.valor) / 100, 0));
}

/** Datos de riesgo de una cuenta, por nombre de cliente. */
function cuentaDe(cliente: string): CarteraItem | undefined {
  return MOCK.cartera.find((c) => c.cliente === cliente);
}

function PrioridadesPanel() {
  const total = MOCK.cartera.reduce((sum, c) => sum + c.monto, 0);
  const requierenHumano = MOCK.cartera.filter((c) => c.urgencia === 'alta').length;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MiniStat
          label="En la lista de hoy"
          value={String(MOCK.cartera.length)}
          sub="cuentas priorizadas"
        />
        <MiniStat
          label="Monto en juego"
          value={CURRENCY_FORMATTER.format(total)}
          sub="suma de las cuentas listadas"
        />
        <MiniStat
          label="Requieren humano"
          value={String(requierenHumano)}
          sub="el agente no las toca solo"
          accent
        />
      </div>

      <div className="editorial-card !p-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-brand-sand flex items-center gap-2">
          <Sparkles size={14} className="text-brand-gold" />
          <span className="label-caps !opacity-60">Orden sugerido de trabajo</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[820px]">
            <thead>
              <tr className="border-b border-brand-sand">
                {['Cliente', 'Monto', 'Vencido', 'Riesgo', 'Por qué está aquí', 'Acción'].map((h) => (
                  <th
                    key={h}
                    className="px-5 py-3 text-[9px] uppercase tracking-widest font-bold text-brand-ink/40"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MOCK.cartera.map((c) => (
                <tr
                  key={c.folio}
                  className="border-b border-brand-sand/60 last:border-0 hover:bg-brand-bone/50 transition-colors"
                >
                  <td className="px-5 py-4">
                    <div className="text-sm font-bold text-brand-ink">{c.cliente}</div>
                    <div className="text-[10px] text-brand-ink/40 font-mono mt-0.5">{c.folio}</div>
                  </td>
                  <td className="px-5 py-4 text-sm tabular-nums text-brand-ink">
                    {CURRENCY_FORMATTER.format(c.monto)}
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-sm tabular-nums text-brand-ink">{c.diasVencido}</span>
                    <span className="text-[10px] text-brand-ink/40 ml-1">días</span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1.5">
                      <TrendIcon tendencia={c.tendencia} />
                      <RiskChip score={scoreOf(c.factores)} />
                    </div>
                  </td>
                  <td className="px-5 py-4 max-w-[280px]">
                    <p className="text-[11px] text-brand-ink/60 leading-relaxed">{c.razon}</p>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`audit-badge ${URGENCIA_STYLES[c.urgencia]}`}>{c.accion}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── 2 · Alertas ─────────────────────────────────────────────────────

const SEVERIDAD = {
  critica: { chip: 'bg-red-100 text-red-700', label: 'Crítica', border: 'border-red-200' },
  alta: { chip: 'bg-amber-100 text-amber-700', label: 'Alta', border: 'border-amber-200' },
  media: { chip: 'bg-brand-gold/20 text-brand-ink/70', label: 'Media', border: 'border-brand-sand' },
} as const;

function AlertasPanel() {
  return (
    <div className="space-y-4">
      <p className="text-xs text-brand-ink/50 max-w-2xl">
        Estas alertas se disparan por patrones, no por vencimientos. La idea es avisar
        <em> antes</em> de que el problema sea evidente en el aging.
      </p>
      {MOCK.alertas.map((a) => {
        const s = SEVERIDAD[a.severidad];
        return (
          <div key={a.titulo} className={`bg-white border ${s.border} rounded-2xl p-5 flex gap-4`}>
            <AlertTriangle size={16} className="text-brand-ink/40 shrink-0 mt-0.5" />
            <div className="flex-1 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`audit-badge ${s.chip}`}>{s.label}</span>
                <span className="text-[10px] text-brand-ink/40">{a.cuando}</span>
              </div>
              <h4 className="text-sm font-bold text-brand-ink">{a.titulo}</h4>
              <p className="text-xs text-brand-ink/60 leading-relaxed max-w-3xl">{a.detalle}</p>
            </div>
          </div>
        );
      })}
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

function RecordatoriosPanel() {
  const [selected, setSelected] = React.useState(MOCK.recordatorios[0].cliente);
  const activo = MOCK.recordatorios.find((r) => r.cliente === selected) ?? MOCK.recordatorios[0];
  // El riesgo de la cuenta vive en MOCK.cartera y se enlaza por nombre de
  // cliente. Puede no existir (un cliente contactado sin factura priorizada),
  // por eso las tarjetas de riesgo y simulación se renderizan condicionadas.
  const cuenta = cuentaDe(activo.cliente);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 items-start">
      {/* Lista de clientes */}
      <div className="lg:col-span-2 editorial-card !p-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-brand-sand">
          <span className="label-caps !opacity-60">Clientes contactados</span>
        </div>
        <div>
          {MOCK.recordatorios.map((r) => {
            const cuentaFila = cuentaDe(r.cliente);
            return (
            <button
              key={r.cliente}
              onClick={() => setSelected(r.cliente)}
              aria-current={selected === r.cliente}
              className={`w-full text-left px-6 py-4 border-b border-brand-sand/60 last:border-0 transition-colors ${
                selected === r.cliente ? 'bg-brand-gold/10' : 'hover:bg-brand-bone/60'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-bold text-brand-ink truncate">{r.cliente}</div>
                  <div className="text-[10px] text-brand-ink/40 mt-0.5">
                    {r.enviados} mensajes · último {r.ultimo}
                  </div>
                  <div className="text-[10px] text-brand-ink/40 mt-1">
                    Respuesta{' '}
                    <span className="font-bold text-brand-ink/70 tabular-nums">{r.tasa}%</span>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  {cuentaFila ? (
                    <RiskChip score={scoreOf(cuentaFila.factores)} />
                  ) : (
                    <span className="text-[10px] text-brand-ink/30">—</span>
                  )}
                  <div className="text-[9px] uppercase tracking-widest text-brand-ink/35 mt-1.5">
                    riesgo
                  </div>
                </div>
              </div>
            </button>
            );
          })}
        </div>
      </div>

      {/* Detalle del cliente */}
      <div className="lg:col-span-3 space-y-5">
        {cuenta && <CuentaDetalle cuenta={cuenta} encargado={activo.encargado} />}

        {/* Lo que mejor le funciona */}
        <div className="editorial-card space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="label-caps !opacity-60">Lo que mejor funciona</span>
              <p className="text-xs text-brand-ink/50 mt-1.5 max-w-md leading-relaxed">
                Combinación con mayor tasa de respuesta registrada en esta cuenta.
              </p>
            </div>
            <span className="audit-badge bg-brand-bone text-brand-ink/50 shrink-0">
              {activo.encargado}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <BestFit label="Canal" value={activo.mejor.canal} />
            <BestFit label="Tono" value={activo.mejor.tono} />
            <BestFit label="Horario" value={activo.mejor.hora} />
            <BestFit label="Respuesta" value={`${activo.tasa}%`} accent />
          </div>

          <div className="pt-3 border-t border-brand-sand space-y-2">
            <div>
              <span className="text-[9px] uppercase tracking-widest text-brand-ink/35">
                Estrategia que funciona
              </span>
              <p className="text-sm text-brand-ink mt-1">{activo.mejor.estrategia}</p>
            </div>
            <p className="text-[11px] text-brand-ink/50 leading-relaxed">{activo.nota}</p>
          </div>
        </div>

        {/* Historial de mensajes */}
        <div className="editorial-card !p-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-brand-sand flex items-center gap-2">
            <MessageSquare size={13} className="text-brand-gold" />
            <span className="label-caps !opacity-60">Mensajes enviados</span>
          </div>

          <div className="divide-y divide-brand-sand/60">
            {activo.mensajes.map((m, i) => {
              const Icon = CANAL_ICON[m.canal as keyof typeof CANAL_ICON] ?? MessageSquare;
              const res = RESULTADO_STYLES[m.resultado];
              return (
                <div key={i} className="px-6 py-4 hover:bg-brand-bone/40 transition-colors">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <Icon size={13} className="text-brand-ink/40 shrink-0" />
                    <span className="text-xs font-bold text-brand-ink">{m.tipo}</span>
                    <span className={`audit-badge ${res.chip}`}>{res.label}</span>
                    <span className="text-[10px] text-brand-ink/40 ml-auto tabular-nums">
                      {m.fecha}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-[10px]">
                    <MsgMeta label="Canal" value={m.canal} />
                    <MsgMeta label="Tono" value={m.tono} />
                    <MsgMeta label="Nivel" value={`${m.nivel} de 4`} />
                    <MsgMeta label="Vencida al enviar" value={`${m.vencidoAlEnviar} días`} />
                    <MsgMeta label="Espera al siguiente" value={m.espera} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {cuenta && <SimuladorCuenta cuenta={cuenta} />}
      </div>
    </div>
  );
}

function BestFit({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      className={`px-3 py-3 rounded-xl border ${
        accent ? 'bg-brand-gold/10 border-brand-gold/40' : 'bg-brand-bone border-brand-sand'
      }`}
    >
      <div className="text-[9px] uppercase tracking-widest text-brand-ink/35">{label}</div>
      <div className="text-sm font-bold text-brand-ink mt-1">{value}</div>
    </div>
  );
}

function MsgMeta({ label, value }: { label: string; value: string }) {
  return (
    <span className="text-brand-ink/45">
      {label}: <span className="text-brand-ink/75 font-bold">{value}</span>
    </span>
  );
}

function CuentaDetalle({
  cuenta,
  encargado,
}: {
  cuenta: CarteraItem;
  encargado: string;
}) {
  const score = scoreOf(cuenta.factores);

  return (
    <div className="editorial-card space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <span className="label-caps !opacity-60">Cuenta seleccionada</span>
          <h3 className="text-2xl font-serif text-brand-ink mt-1.5">{cuenta.cliente}</h3>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] font-mono text-brand-ink/40">{cuenta.folio}</span>
            <span className="text-[10px] text-brand-ink/30">·</span>
            <span className="text-[10px] text-brand-ink/40">{encargado}</span>
          </div>
        </div>
        <span className={`audit-badge shrink-0 ${URGENCIA_STYLES[cuenta.urgencia]}`}>
          {cuenta.accion}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <DetalleStat label="Monto" value={CURRENCY_FORMATTER.format(cuenta.monto)} />
        <DetalleStat label="Vencido" value={`${cuenta.diasVencido} días`} />
        <DetalleStat label="Riesgo" value={String(score)} accent />
      </div>

      <div className="px-4 py-3 bg-brand-bone border border-brand-sand rounded-xl">
        <span className="text-[9px] uppercase tracking-widest text-brand-ink/35">
          Por qué está aquí
        </span>
        <p className="text-sm text-brand-ink/75 mt-1 leading-relaxed">{cuenta.razon}</p>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Scale size={13} className="text-brand-gold" />
          <span className="label-caps !opacity-60">Desglose del score</span>
        </div>
        <p className="text-xs text-brand-ink/50 leading-relaxed">
          El score no es una caja negra: es la suma ponderada de estos factores. Cada peso es
          configurable y cada valor sale de datos verificables de la cuenta.
        </p>

        <div className="space-y-4">
          {cuenta.factores.map((f) => (
            <div key={f.nombre}>
              <div className="flex items-baseline justify-between mb-1.5 gap-3">
                <span className="text-[11px] font-bold text-brand-ink/70">{f.nombre}</span>
                <span className="text-[10px] text-brand-ink/40 font-mono shrink-0 tabular-nums">
                  peso {f.peso}% · valor {f.valor} · aporta {Math.round((f.peso * f.valor) / 100)}
                </span>
              </div>
              <div className="h-2 bg-brand-sand/50 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-brand-ink/70"
                  style={{ width: `${f.valor}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="pt-4 border-t border-brand-sand flex items-center justify-between">
          <span className="label-caps !opacity-50">Score compuesto</span>
          <span className="text-4xl font-serif text-brand-ink tabular-nums">{score}</span>
        </div>
      </div>
    </div>
  );
}

function DetalleStat({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`px-3 py-3 rounded-xl border ${
        accent ? 'bg-brand-gold/10 border-brand-gold/40' : 'bg-brand-bone border-brand-sand'
      }`}
    >
      <div className="text-[9px] uppercase tracking-widest text-brand-ink/35">{label}</div>
      <div className="text-sm font-bold text-brand-ink mt-1 tabular-nums">{value}</div>
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

  return (
    <div className="editorial-card space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className="label-caps !opacity-60">Simulador de esta cuenta</span>
          <h4 className="text-lg font-serif text-brand-ink mt-1.5">
            ¿Qué pasa si negocio la factura {cuenta.folio}?
          </h4>
        </div>
        <span className="audit-badge bg-brand-bone text-brand-ink/50 shrink-0">
          Riesgo {score}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Controles */}
        <div className="space-y-6">
          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-3">
              <label htmlFor="sim-monto" className="label-caps !opacity-50">
                Monto a negociar
              </label>
              <span className="text-[10px] text-brand-ink/40 tabular-nums">{porcentaje}%</span>
            </div>
            <input
              id="sim-monto"
              type="range"
              min={25}
              max={100}
              step={5}
              value={porcentaje}
              onChange={(e) => setPorcentaje(Number(e.target.value))}
              className="w-full accent-brand-gold"
            />
            <div className="text-lg font-serif text-brand-ink tabular-nums">
              {CURRENCY_FORMATTER.format(negociado)}
            </div>
            <p className="text-[10px] text-brand-ink/40 leading-relaxed">
              De {CURRENCY_FORMATTER.format(cuenta.monto)} facturados. Bajarlo simula aceptar un
              pago parcial hoy en vez de esperar el total.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-3">
              <label htmlFor="sim-descuento" className="label-caps !opacity-50">
                Descuento por pronto pago
              </label>
              <span className="text-lg font-serif text-brand-ink tabular-nums">{descuento}%</span>
            </div>
            <input
              id="sim-descuento"
              type="range"
              min={0}
              max={10}
              value={descuento}
              onChange={(e) => setDescuento(Number(e.target.value))}
              className="w-full accent-brand-gold"
            />
            <p className="text-[10px] text-brand-ink/40 leading-relaxed">
              El descuento mueve más la aguja en cuentas de riesgo alto: en una que ya paga bien,
              regalas margen sin ganar velocidad.
            </p>
          </div>
        </div>

        {/* Resultado — siempre como "hoy → escenario": el valor del simulador
            está en la comparación, no en el número aislado. */}
        <div className="bg-brand-bone border border-brand-sand rounded-xl p-5 space-y-5">
          <div className="flex items-center justify-between gap-3">
            <span className="label-caps !opacity-50">Resultado proyectado</span>
            <span className="text-[9px] uppercase tracking-widest text-brand-ink/30">
              hoy → escenario
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

          <div className="pt-4 border-t border-brand-sand">
            <div className="text-[9px] uppercase tracking-widest text-brand-ink/35">
              Diferencia
            </div>
            <div
              className={`text-2xl font-serif tabular-nums mt-1 ${
                delta >= 0 ? 'text-green-700' : 'text-red-600'
              }`}
            >
              {delta >= 0 ? '+' : '−'} {CURRENCY_FORMATTER.format(Math.abs(delta))}
            </div>
          </div>
        </div>
      </div>

      <p className="text-[10px] text-brand-ink/40 leading-relaxed">
        Cifras ilustrativas. Simular no cambia nada real — no envía mensajes, no altera la factura
        ni compromete un descuento con el cliente.
      </p>
    </div>
  );
}

// ─── 4 · Estrategias ─────────────────────────────────────────────────

function EstrategiasPanel() {
  const e = MOCK.estrategias.efectividad;
  const tasaRespuesta = Math.round((e.respondidos / e.enviados) * 100);

  return (
    <div className="space-y-5">
      {/* Efectividad del agente */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MiniStat label="Mensajes enviados" value={String(e.enviados)} sub="en los últimos 90 días" />
        <MiniStat label="Tasa de respuesta" value={`${tasaRespuesta}%`} sub={`${e.respondidos} respondieron`} />
        <MiniStat
          label="Cobradas tras contacto"
          value={String(e.cobradasTrasContacto)}
          sub="facturas liquidadas"
        />
        <MiniStat
          label="Días ahorrados"
          value={`−${e.diasAhorrados}`}
          sub="vs. línea base de cobro"
          accent
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        {/* Lo que funciona */}
        <div className="editorial-card !p-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-brand-sand flex items-center gap-2">
            <TrendingUp size={14} className="text-green-600" />
            <span className="label-caps !opacity-60">Lo que sí funciona</span>
          </div>
          <div className="divide-y divide-brand-sand/60">
            {MOCK.estrategias.funcionan.map((s) => (
              <StrategyRow
                key={s.nombre}
                nombre={s.nombre}
                exito={s.exito}
                usos={s.usos}
                nota={s.nota}
                positivo
              />
            ))}
          </div>
        </div>

        {/* Lo que no funciona */}
        <div className="editorial-card !p-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-brand-sand flex items-center gap-2">
            <TrendingDown size={14} className="text-red-500" />
            <span className="label-caps !opacity-60">Lo que no funciona</span>
          </div>
          <div className="divide-y divide-brand-sand/60">
            {MOCK.estrategias.noFuncionan.map((s) => (
              <StrategyRow
                key={s.nombre}
                nombre={s.nombre}
                exito={s.exito}
                usos={s.usos}
                nota={s.nota}
                positivo={false}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StrategyRow({
  nombre,
  exito,
  usos,
  nota,
  positivo,
}: {
  key?: string;
  nombre: string;
  exito: number;
  usos: number;
  nota: string;
  positivo: boolean;
}) {
  return (
    <div className="px-6 py-4 space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-bold text-brand-ink">{nombre}</span>
        <span
          className={`text-lg font-serif tabular-nums shrink-0 ${
            positivo ? 'text-green-700' : 'text-red-600'
          }`}
        >
          {exito}%
        </span>
      </div>
      <div className="h-1.5 bg-brand-sand/50 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${positivo ? 'bg-green-600' : 'bg-red-400'}`}
          style={{ width: `${exito}%` }}
        />
      </div>
      <p className="text-[11px] text-brand-ink/50 leading-relaxed">{nota}</p>
      <p className="text-[9px] uppercase tracking-widest text-brand-ink/30">{usos} veces usada</p>
    </div>
  );
}

// ─── 5 · Perfiles ────────────────────────────────────────────────────

function PerfilesPanel() {
  return (
    <div className="space-y-5">
      <p className="text-xs text-brand-ink/50 max-w-2xl">
        Agrupación de clientes por cómo se comportan, no por cuánto deben. Cada perfil trae la
        combinación que mejor le funciona — es lo que el agente usa como punto de partida con un
        cliente nuevo, antes de tener historial propio suyo.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {MOCK.perfiles.map((p) => (
          <div key={p.nombre} className="editorial-card !p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="text-lg font-serif text-brand-ink">{p.nombre}</h4>
                <p className="text-[11px] text-brand-ink/50 mt-1 leading-relaxed">
                  {p.descripcion}
                </p>
              </div>
              <div className="text-right shrink-0">
                <div className="text-2xl font-serif text-brand-ink tabular-nums leading-none">
                  {p.clientes}
                </div>
                <div className="text-[9px] uppercase tracking-widest text-brand-ink/35 mt-1">
                  clientes
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Tag icon={<MessageSquare size={10} />} text={p.canal} />
              <Tag icon={<Scale size={10} />} text={`Tono ${p.tono}`} />
              <Tag icon={<CalendarClock size={10} />} text={p.horario} />
            </div>

            <div className="pt-3 border-t border-brand-sand">
              <span className="text-[9px] uppercase tracking-widest text-brand-ink/35">
                Estrategia recomendada
              </span>
              <p className="text-sm text-brand-ink mt-1">{p.estrategia}</p>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-1.5 bg-brand-sand/50 rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-brand-gold" style={{ width: `${p.exito}%` }} />
              </div>
              <span className="text-xs font-bold text-brand-ink tabular-nums shrink-0">
                {p.exito}% éxito
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── 6 · Equipo ──────────────────────────────────────────────────────

function EquipoPanel() {
  return (
    <div className="space-y-5">
      <p className="text-xs text-brand-ink/50 max-w-2xl">
        Comparativo entre encargados de cobranza para identificar qué está funcionando y replicarlo
        — no para señalar a nadie.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {MOCK.equipo.map((p) => {
          const pct = Math.round((p.recuperado / p.cartera) * 100);
          return (
            <div key={p.nombre} className="editorial-card !p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-brand-ink text-brand-paper flex items-center justify-center text-xs font-bold shrink-0">
                  {p.nombre.split(' ').map((n) => n[0]).join('')}
                </div>
                <div>
                  <div className="text-sm font-bold text-brand-ink leading-tight">{p.nombre}</div>
                  <div className="text-[10px] text-brand-ink/40">{p.cuentas} cuentas asignadas</div>
                </div>
              </div>

              <div>
                <div className="flex items-baseline justify-between mb-1.5">
                  <span className="text-[10px] uppercase tracking-widest text-brand-ink/40">
                    Recuperado
                  </span>
                  <span className="text-sm font-bold text-brand-ink tabular-nums">{pct}%</span>
                </div>
                <div className="h-2 bg-brand-sand/50 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-brand-gold" style={{ width: `${pct}%` }} />
                </div>
                <div className="text-[10px] text-brand-ink/40 mt-1.5 tabular-nums">
                  {CURRENCY_FORMATTER.format(p.recuperado)} de {CURRENCY_FORMATTER.format(p.cartera)}
                </div>
              </div>

              <div className="pt-3 border-t border-brand-sand space-y-2.5">
                <EquipoStat label="Monto por cobrar" value={CURRENCY_FORMATTER.format(p.porCobrar)} />
                <EquipoStat
                  label="Recordatorios pendientes"
                  value={String(p.pendientes)}
                  alerta={p.pendientes >= 10}
                />
                <EquipoStat label="Días promedio de cobro" value={String(p.diasProm)} />
              </div>
            </div>
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
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[10px] uppercase tracking-widest text-brand-ink/40 leading-tight">
        {label}
      </span>
      <span
        className={`text-sm font-bold tabular-nums shrink-0 ${
          alerta ? 'text-red-600' : 'text-brand-ink'
        }`}
      >
        {value}
      </span>
    </div>
  );
}

// ─── Piezas compartidas ──────────────────────────────────────────────

function MiniStat({
  label,
  value,
  sub,
  accent = false,
}: {
  label: string;
  value: string;
  sub: string;
  accent?: boolean;
}) {
  return (
    <div className={`editorial-card !p-6 ${accent ? 'border-brand-gold' : ''}`}>
      <span className="label-caps !opacity-40 block">{label}</span>
      <div className="text-3xl font-serif text-brand-ink mt-3 tabular-nums">{value}</div>
      <div className="text-[10px] text-brand-ink/40 mt-1">{sub}</div>
    </div>
  );
}

function RiskChip({ score }: { score: number }) {
  const tone =
    score >= 70 ? 'bg-red-100 text-red-700' : score >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700';
  return <span className={`audit-badge tabular-nums ${tone}`}>{score}</span>;
}

function TrendIcon({ tendencia }: { tendencia: 'sube' | 'baja' | 'estable' }) {
  if (tendencia === 'sube') return <TrendingUp size={13} className="text-red-500" aria-label="Riesgo al alza" />;
  if (tendencia === 'baja') return <TrendingDown size={13} className="text-green-600" aria-label="Riesgo a la baja" />;
  return <ArrowRight size={13} className="text-brand-ink/30" aria-label="Riesgo estable" />;
}

function Tag({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-brand-bone border border-brand-sand rounded-lg text-[10px] font-bold text-brand-ink/70">
      {icon}
      {text}
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
      <div className="text-[9px] uppercase tracking-widest text-brand-ink/35">{label}</div>
      <div className="flex items-baseline gap-2 mt-1">
        <span className="text-sm tabular-nums text-brand-ink/40">{antes}</span>
        <ArrowRight size={12} className="text-brand-ink/25 shrink-0 self-center" />
        <span
          className={`tabular-nums ${
            destacado ? 'text-xl font-serif text-brand-ink' : 'text-sm font-bold text-brand-ink'
          }`}
        >
          {despues}
        </span>
      </div>
    </div>
  );
}
