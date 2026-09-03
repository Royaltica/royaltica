import React from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Brain,
  CalendarClock,
  Info,
  MessageSquare,
  Scale,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Users,
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

type Section = 'prioridades' | 'riesgo' | 'alertas' | 'aprendizaje' | 'simulador' | 'equipo';

const sections: { id: Section; label: string }[] = [
  { id: 'prioridades', label: 'Prioridades' },
  { id: 'riesgo', label: 'Riesgo' },
  { id: 'alertas', label: 'Alertas' },
  { id: 'aprendizaje', label: 'Aprendizaje' },
  { id: 'simulador', label: 'Simulador' },
  { id: 'equipo', label: 'Equipo' },
];

// ─── Datos de ejemplo ────────────────────────────────────────────────
// Reemplazar por llamadas reales al API cuando exista el Módulo 2.

const MOCK = {
  prioridades: [
    {
      cliente: 'Distribuidora del Norte',
      folio: 'F-2841',
      monto: 284_500,
      diasVencido: 42,
      riesgo: 78,
      razon: 'Monto alto + puntualidad histórica cayó de 92% a 61% en 3 meses',
      accion: 'Llamada del encargado',
      urgencia: 'alta' as const,
    },
    {
      cliente: 'Materiales Peninsulares',
      folio: 'F-2903',
      monto: 156_200,
      diasVencido: 28,
      riesgo: 54,
      razon: 'Buen historial, primer atraso relevante en 2 años',
      accion: 'Recordatorio tono suave',
      urgencia: 'media' as const,
    },
    {
      cliente: 'Grupo Ferretero Bajío',
      folio: 'F-2877',
      monto: 98_400,
      diasVencido: 35,
      riesgo: 71,
      razon: 'Tercer atraso consecutivo, no respondió los últimos 2 mensajes',
      accion: 'Escalar a humano',
      urgencia: 'alta' as const,
    },
    {
      cliente: 'Logística Andrade',
      folio: 'F-2915',
      monto: 62_800,
      diasVencido: 12,
      riesgo: 22,
      razon: 'Paga tarde pero siempre paga — su patrón normal son 15 días',
      accion: 'Esperar (no contactar)',
      urgencia: 'baja' as const,
    },
    {
      cliente: 'Constructora Vanguardia',
      folio: 'F-2860',
      monto: 412_000,
      diasVencido: 19,
      riesgo: 45,
      razon: 'Monto muy alto — vigilar aunque el atraso aún es moderado',
      accion: 'Recordatorio estándar',
      urgencia: 'media' as const,
    },
  ],
  riesgo: [
    {
      cliente: 'Distribuidora del Norte',
      score: 78,
      tendencia: 'sube' as const,
      factores: [
        { nombre: 'Puntualidad histórica', peso: 40, valor: 61 },
        { nombre: 'Concentración en cartera', peso: 30, valor: 88 },
        { nombre: 'Tendencia reciente', peso: 30, valor: 84 },
      ],
    },
    {
      cliente: 'Grupo Ferretero Bajío',
      score: 71,
      tendencia: 'sube' as const,
      factores: [
        { nombre: 'Puntualidad histórica', peso: 40, valor: 58 },
        { nombre: 'Concentración en cartera', peso: 30, valor: 42 },
        { nombre: 'Tendencia reciente', peso: 30, valor: 92 },
      ],
    },
    {
      cliente: 'Materiales Peninsulares',
      score: 54,
      tendencia: 'estable' as const,
      factores: [
        { nombre: 'Puntualidad histórica', peso: 40, valor: 38 },
        { nombre: 'Concentración en cartera', peso: 30, valor: 61 },
        { nombre: 'Tendencia reciente', peso: 30, valor: 70 },
      ],
    },
    {
      cliente: 'Logística Andrade',
      score: 22,
      tendencia: 'baja' as const,
      factores: [
        { nombre: 'Puntualidad histórica', peso: 40, valor: 18 },
        { nombre: 'Concentración en cartera', peso: 30, valor: 24 },
        { nombre: 'Tendencia reciente', peso: 30, valor: 26 },
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
  aprendizaje: [
    {
      cliente: 'Distribuidora del Norte',
      mejor: { canal: 'WhatsApp', tono: 'Estándar', hora: '9–11h' },
      tasa: 72,
      intentos: 18,
      nota: 'No responde correo. Por WhatsApp contesta casi siempre en la mañana.',
    },
    {
      cliente: 'Materiales Peninsulares',
      mejor: { canal: 'Correo', tono: 'Suave', hora: '16–18h' },
      tasa: 64,
      intentos: 11,
      nota: 'Prefiere correo — probablemente lo revisa su área administrativa por la tarde.',
    },
    {
      cliente: 'Grupo Ferretero Bajío',
      mejor: { canal: 'WhatsApp', tono: 'Firme', hora: '12–14h' },
      tasa: 38,
      intentos: 22,
      nota: 'Responde poco en general. El tono suave no genera respuesta con esta cuenta.',
    },
    {
      cliente: 'Logística Andrade',
      mejor: { canal: 'WhatsApp', tono: 'Suave', hora: '9–11h' },
      tasa: 91,
      intentos: 9,
      nota: 'Responde casi siempre. Basta un recordatorio amable.',
    },
  ],
  equipo: [
    { nombre: 'María Jiménez', cartera: 2_840_000, recuperado: 2_210_000, cuentas: 34, diasProm: 31 },
    { nombre: 'Carlos Mendoza', cartera: 1_960_000, recuperado: 1_180_000, cuentas: 28, diasProm: 47 },
    { nombre: 'Ana Robles', cartera: 3_120_000, recuperado: 2_690_000, cuentas: 41, diasProm: 26 },
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
      {section === 'riesgo' && <RiesgoPanel />}
      {section === 'alertas' && <AlertasPanel />}
      {section === 'aprendizaje' && <AprendizajePanel />}
      {section === 'simulador' && <SimuladorPanel />}
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

const URGENCIA_STYLES = {
  alta: 'bg-red-100 text-red-700',
  media: 'bg-amber-100 text-amber-700',
  baja: 'bg-brand-sand/40 text-brand-ink/50',
} as const;

function PrioridadesPanel() {
  const total = MOCK.prioridades.reduce((sum, p) => sum + p.monto, 0);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MiniStat label="En la lista de hoy" value={String(MOCK.prioridades.length)} sub="cuentas priorizadas" />
        <MiniStat label="Monto en juego" value={CURRENCY_FORMATTER.format(total)} sub="suma de las cuentas listadas" />
        <MiniStat label="Requieren humano" value="2" sub="el agente no las toca solo" accent />
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
                  <th key={h} className="px-5 py-3 text-[9px] uppercase tracking-widest font-bold text-brand-ink/40">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MOCK.prioridades.map((p) => (
                <tr key={p.folio} className="border-b border-brand-sand/60 last:border-0 hover:bg-brand-bone/50 transition-colors">
                  <td className="px-5 py-4">
                    <div className="text-sm font-bold text-brand-ink">{p.cliente}</div>
                    <div className="text-[10px] text-brand-ink/40 font-mono mt-0.5">{p.folio}</div>
                  </td>
                  <td className="px-5 py-4 text-sm tabular-nums text-brand-ink">
                    {CURRENCY_FORMATTER.format(p.monto)}
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-sm tabular-nums text-brand-ink">{p.diasVencido}</span>
                    <span className="text-[10px] text-brand-ink/40 ml-1">días</span>
                  </td>
                  <td className="px-5 py-4">
                    <RiskChip score={p.riesgo} />
                  </td>
                  <td className="px-5 py-4 max-w-[280px]">
                    <p className="text-[11px] text-brand-ink/60 leading-relaxed">{p.razon}</p>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`audit-badge ${URGENCIA_STYLES[p.urgencia]}`}>{p.accion}</span>
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

// ─── 2 · Riesgo ──────────────────────────────────────────────────────

function RiesgoPanel() {
  const [selected, setSelected] = React.useState(MOCK.riesgo[0].cliente);
  const activo = MOCK.riesgo.find((r) => r.cliente === selected) ?? MOCK.riesgo[0];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
      <div className="lg:col-span-2 editorial-card !p-0 overflow-hidden self-start">
        <div className="px-6 py-4 border-b border-brand-sand">
          <span className="label-caps !opacity-60">Score por cliente</span>
        </div>
        <div>
          {MOCK.riesgo.map((r) => (
            <button
              key={r.cliente}
              onClick={() => setSelected(r.cliente)}
              className={`w-full text-left px-6 py-4 border-b border-brand-sand/60 last:border-0 transition-colors ${
                selected === r.cliente ? 'bg-brand-gold/10' : 'hover:bg-brand-bone/60'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-bold text-brand-ink">{r.cliente}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <TrendIcon tendencia={r.tendencia} />
                  <RiskChip score={r.score} />
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="lg:col-span-3 editorial-card space-y-6">
        <div>
          <span className="label-caps !opacity-60">Desglose del score</span>
          <h3 className="text-2xl font-serif text-brand-ink mt-2">{activo.cliente}</h3>
          <p className="text-xs text-brand-ink/50 mt-2 leading-relaxed">
            El score no es una caja negra: es la suma ponderada de estos factores. Cada peso es
            configurable y cada valor sale de datos verificables de la cuenta.
          </p>
        </div>

        <div className="space-y-4">
          {activo.factores.map((f) => (
            <div key={f.nombre}>
              <div className="flex items-baseline justify-between mb-1.5">
                <span className="text-[11px] font-bold text-brand-ink/70">{f.nombre}</span>
                <span className="text-[10px] text-brand-ink/40 font-mono">
                  peso {f.peso}% · valor {f.valor}
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
          <span className="text-4xl font-serif text-brand-ink tabular-nums">{activo.score}</span>
        </div>
      </div>
    </div>
  );
}

// ─── 3 · Alertas ─────────────────────────────────────────────────────

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

// ─── 4 · Aprendizaje ─────────────────────────────────────────────────

function AprendizajePanel() {
  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 px-4 py-3 bg-brand-cream border border-brand-sand rounded-xl">
        <Brain size={15} className="text-brand-gold shrink-0 mt-0.5" />
        <p className="text-[11px] text-brand-ink/70 leading-relaxed max-w-3xl">
          El sistema registra cada intento de contacto y su resultado desde el primer mensaje. Con
          eso aprende qué combinación de canal, tono y horario funciona con cada cliente — sin
          modelos opacos: es la tasa de respuesta observada, y se puede auditar.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {MOCK.aprendizaje.map((a) => (
          <div key={a.cliente} className="editorial-card !p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <h4 className="text-sm font-bold text-brand-ink">{a.cliente}</h4>
              <div className="text-right shrink-0">
                <div className="text-2xl font-serif text-brand-ink tabular-nums leading-none">
                  {a.tasa}%
                </div>
                <div className="text-[9px] uppercase tracking-widest text-brand-ink/40 mt-1">
                  respuesta
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Tag icon={<MessageSquare size={10} />} text={a.mejor.canal} />
              <Tag icon={<Scale size={10} />} text={`Tono ${a.mejor.tono}`} />
              <Tag icon={<CalendarClock size={10} />} text={a.mejor.hora} />
            </div>

            <p className="text-[11px] text-brand-ink/55 leading-relaxed border-t border-brand-sand pt-3">
              {a.nota}
            </p>
            <p className="text-[9px] uppercase tracking-widest text-brand-ink/30">
              basado en {a.intentos} intentos
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── 5 · Simulador ───────────────────────────────────────────────────

function SimuladorPanel() {
  const [descuento, setDescuento] = React.useState(3);
  const [segmento, setSegmento] = React.useState('vencidas60');

  // Cálculo ilustrativo — la fórmula real vive en el backend cuando exista.
  const carteraBase = 4_860_000;
  const afectada = segmento === 'vencidas60' ? 1_940_000 : segmento === 'vencidas30' ? 3_120_000 : carteraBase;
  const aceptacionEstimada = Math.min(0.85, 0.18 + descuento * 0.11);
  const recuperado = Math.round(afectada * aceptacionEstimada);
  const costo = Math.round(recuperado * (descuento / 100));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <div className="editorial-card space-y-6">
        <div>
          <span className="label-caps !opacity-60">Escenario</span>
          <h3 className="text-xl font-serif text-brand-ink mt-2">¿Y si ofrezco un descuento?</h3>
          <p className="text-xs text-brand-ink/50 mt-2 leading-relaxed">
            Simula sin tocar nada real. Sirve para decidir con números en vez de a ojo.
          </p>
        </div>

        <div className="space-y-2">
          <label htmlFor="sim-segmento" className="label-caps !opacity-50 block">
            Aplicar a
          </label>
          <select
            id="sim-segmento"
            value={segmento}
            onChange={(e) => setSegmento(e.target.value)}
            className="w-full px-4 py-3 bg-white border border-brand-sand rounded-xl text-sm text-brand-ink focus:outline-none focus:border-brand-gold"
          >
            <option value="vencidas60">Facturas vencidas +60 días</option>
            <option value="vencidas30">Facturas vencidas +30 días</option>
            <option value="todas">Toda la cartera vencida</option>
          </select>
        </div>

        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <label htmlFor="sim-descuento" className="label-caps !opacity-50">
              Descuento por pronto pago
            </label>
            <span className="text-lg font-serif text-brand-ink tabular-nums">{descuento}%</span>
          </div>
          <input
            id="sim-descuento"
            type="range"
            min={1}
            max={10}
            value={descuento}
            onChange={(e) => setDescuento(Number(e.target.value))}
            className="w-full accent-brand-gold"
          />
        </div>
      </div>

      <div className="editorial-card space-y-5">
        <span className="label-caps !opacity-60">Resultado proyectado</span>

        <div className="space-y-4">
          <ResultRow label="Cartera afectada" value={CURRENCY_FORMATTER.format(afectada)} />
          <ResultRow
            label="Aceptación estimada"
            value={`${Math.round(aceptacionEstimada * 100)}%`}
          />
          <ResultRow
            label="Recuperación esperada"
            value={CURRENCY_FORMATTER.format(recuperado)}
            strong
          />
          <ResultRow label="Costo del descuento" value={`− ${CURRENCY_FORMATTER.format(costo)}`} />
        </div>

        <div className="pt-4 border-t border-brand-sand flex items-baseline justify-between">
          <span className="text-[11px] font-bold text-brand-ink/70">Neto vs. no hacer nada</span>
          <span className="text-2xl font-serif text-brand-ink tabular-nums">
            {CURRENCY_FORMATTER.format(recuperado - costo)}
          </span>
        </div>

        <p className="text-[10px] text-brand-ink/40 leading-relaxed">
          Cifras ilustrativas. La curva de aceptación real se calibra con el histórico de la
          organización una vez que el módulo esté conectado.
        </p>
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

              <div className="pt-3 border-t border-brand-sand flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-widest text-brand-ink/40">
                  Días promedio
                </span>
                <span className="text-lg font-serif text-brand-ink tabular-nums">{p.diasProm}</span>
              </div>
            </div>
          );
        })}
      </div>
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

function ResultRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-[11px] text-brand-ink/55">{label}</span>
      <span
        className={`tabular-nums ${strong ? 'text-lg font-serif text-brand-ink' : 'text-sm text-brand-ink/80'}`}
      >
        {value}
      </span>
    </div>
  );
}
