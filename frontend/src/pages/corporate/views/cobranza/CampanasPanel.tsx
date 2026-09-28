import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { ChevronDown, Copy, Pause, Pencil, Play, Save } from 'lucide-react';
import { CURRENCY_FORMATTER } from '../../../../utils/format.ts';
import { EASE, Reveal, BlockTitle } from './primitives.tsx';
import {
  AGENTES,
  BUCKETS,
  CONFIG_BASE,
  HOY,
  LINEAS,
  PLANTILLAS,
  audiencia,
  bucketDe,
  llenarPlantilla,
  saldoDe,
  type Campana,
  type CampanaConfig,
} from './mockV1.ts';
import { useCobranza } from './store.tsx';

/**
 * Campañas grupales. Todo es configurable pero se arma en un solo lugar,
 * de arriba hacia abajo: 1 Audiencia → 2 Mensaje → 3 Cuándo → Revisar.
 * La audiencia se calcula en vivo sobre la cartera real y dice quién queda
 * fuera y por qué (sin contacto de finanzas, promesa vigente, disputa).
 */
const TONO_BUCKET: Record<string, string> = {
  preventiva: 'bg-emerald-500',
  temprana: 'bg-amber-300',
  media: 'bg-amber-500',
  alta: 'bg-rose-400',
  critica: 'bg-rose-600',
};

const ESTADO_ESTILO: Record<Campana['estado'], string> = {
  Activa: 'bg-emerald-50 text-emerald-700',
  Programada: 'bg-amber-50 text-amber-700',
  Pausada: 'bg-brand-ink/8 text-brand-ink/60',
  Borrador: 'bg-brand-ink/5 text-brand-ink/55',
};

const toggle = (lista: string[], v: string) => (lista.includes(v) ? lista.filter((x) => x !== v) : [...lista, v]);

function nombreSugerido(cfg: CampanaConfig): string {
  if (cfg.tipo === 'Servicio') return 'Validación de contactos';
  if (cfg.tipo === 'Especial') return `Especial · ${cfg.oferta}`;
  const rangos = BUCKETS.filter((b) => cfg.buckets.includes(b.id)).map((b) => b.rango);
  if (!rangos.length) return 'Campaña sin bloque';
  return `${cfg.buckets.length === 1 && cfg.buckets[0] === 'prev' ? 'Preventiva' : 'Recuperación'} · ${rangos.join(', ')}`;
}

export function CampanasPanel() {
  const reduce = useReducedMotion();
  const { cartera, campanas, guardarCampana, cambiarEstadoCampana } = useCobranza();
  const [cfg, setCfg] = React.useState<CampanaConfig>(CONFIG_BASE);
  const [nombre, setNombre] = React.useState('');
  const [editando, setEditando] = React.useState<string | null>(null);
  const [verExcluidas, setVerExcluidas] = React.useState(false);
  const set = <K extends keyof CampanaConfig>(k: K, v: CampanaConfig[K]) => setCfg((c) => ({ ...c, [k]: v }));

  const { incluidas, excluidas } = audiencia(cfg, cartera);
  const monto = incluidas.reduce((s, c) => s + saldoDe(c), 0);
  const plantilla = PLANTILLAS.find((p) => p.id === cfg.plantilla)!;
  const disponibles = PLANTILLAS.filter((p) =>
    cfg.tipo === 'Servicio' ? p.grupo === 'Servicio' : cfg.tipo === 'Especial' ? p.grupo === 'Especial' : p.grupo === 'Preventiva' || p.grupo === 'Vencida',
  );
  const ejemplo = incluidas[0];
  const lanzaHoy = cfg.inicio <= HOY;
  const aprobada = plantilla.estado === 'Aprobada';

  const cambiarTipo = (tipo: CampanaConfig['tipo']) =>
    setCfg((c) => ({
      ...c,
      tipo,
      plantilla: tipo === 'Especial' ? 'E1' : tipo === 'Servicio' ? 'S1' : bucketDe(-1).sugerida,
      buckets: tipo === 'Servicio' ? [] : c.buckets.length ? c.buckets : ['prev'],
      seguimiento: { ...c.seguimiento, activo: tipo === 'Bloque' },
    }));

  const cambiarBuckets = (id: string) =>
    setCfg((c) => {
      const buckets = toggle(c.buckets, id);
      // Si es de bloque, sugiere la plantilla del bloque más temprano elegido.
      const primero = BUCKETS.find((b) => buckets.includes(b.id));
      return { ...c, buckets, plantilla: c.tipo === 'Bloque' && primero ? primero.sugerida : c.plantilla };
    });

  const guardar = (estado: Campana['estado']) => {
    const id = editando ?? `c${Date.now()}`;
    const previa = campanas.find((x) => x.id === id);
    guardarCampana({ id, nombre: nombre.trim() || nombreSugerido(cfg), config: cfg, estado, enviados: previa?.enviados ?? 0 });
    setEditando(null);
    setNombre('');
    setCfg(CONFIG_BASE);
  };

  const editar = (c: Campana, duplicar = false) => {
    setCfg(c.config);
    setNombre(duplicar ? `${c.nombre} (copia)` : c.nombre);
    setEditando(duplicar ? null : c.id);
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
      {/* ── Creador ── */}
      <div className="xl:col-span-3 space-y-5">
        <Reveal>
          <div className="bg-brand-paper border border-brand-ink/10 rounded-3xl p-6 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <BlockTitle>{editando ? 'Editar campaña' : 'Nueva campaña'}</BlockTitle>
              <div className="flex gap-1.5">
                {(['Bloque', 'Especial', 'Servicio'] as const).map((t) => (
                  <Chip key={t} activo={cfg.tipo === t} onClick={() => cambiarTipo(t)}>
                    {t === 'Bloque' ? 'Por vencimiento' : t === 'Especial' ? 'Especial' : 'Servicio'}
                  </Chip>
                ))}
              </div>
            </div>

            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder={nombreSugerido(cfg)}
              className="w-full text-lg font-serif text-brand-ink bg-transparent border-b border-brand-ink/12 pb-2 outline-none focus:border-brand-gold/60 placeholder:text-brand-ink/30"
            />

            {/* 1 · Audiencia */}
            <Paso n={1} titulo="A quién">
              {cfg.tipo !== 'Servicio' ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {BUCKETS.map((b) => {
                    const cuentas = cartera.filter((c) => bucketDe(c.dias).id === b.id);
                    const activo = cfg.buckets.includes(b.id);
                    return (
                      <button
                        key={b.id}
                        onClick={() => cambiarBuckets(b.id)}
                        className={`text-left rounded-2xl border px-3.5 py-2.5 transition-colors ${
                          activo ? 'border-brand-gold/60 bg-brand-cream' : 'border-brand-ink/8 hover:bg-brand-bone'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <span className={`w-1.5 h-1.5 rounded-full ${TONO_BUCKET[b.tono]}`} />
                          <span className="text-[12px] font-semibold text-brand-ink">{b.rango}</span>
                        </span>
                        <span className="block text-[11px] text-brand-ink/50 mt-0.5 tabular-nums">
                          {cuentas.length} · {CURRENCY_FORMATTER.format(cuentas.reduce((s, c) => s + saldoDe(c), 0))}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-brand-ink/60">Toda la cartera, para confirmar que el contacto de pagos sigue vigente.</p>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                <Grupo label="Agentes">
                  <Chip activo={!cfg.agentes.length} onClick={() => set('agentes', [])}>Todos</Chip>
                  {AGENTES.map((a) => (
                    <Chip key={a} activo={cfg.agentes.includes(a)} onClick={() => set('agentes', toggle(cfg.agentes, a))}>
                      {a.split(' ')[0]}
                    </Chip>
                  ))}
                </Grupo>
                <Grupo label="Línea de negocio">
                  <Chip activo={!cfg.lineas.length} onClick={() => set('lineas', [])}>Todas</Chip>
                  {LINEAS.map((l) => (
                    <Chip key={l} activo={cfg.lineas.includes(l)} onClick={() => set('lineas', toggle(cfg.lineas, l))}>
                      {l}
                    </Chip>
                  ))}
                </Grupo>
                <Grupo label="Saldo mínimo">
                  <input
                    type="number"
                    min={0}
                    step={10000}
                    value={cfg.montoMin}
                    onChange={(e) => set('montoMin', Number(e.target.value) || 0)}
                    className={CONTROL + ' w-40'}
                  />
                </Grupo>
                <Grupo label="Excluir">
                  <Chip activo={cfg.excluirPromesa} onClick={() => set('excluirPromesa', !cfg.excluirPromesa)}>Con promesa vigente</Chip>
                  <Chip activo={cfg.excluirDisputa} onClick={() => set('excluirDisputa', !cfg.excluirDisputa)}>En disputa</Chip>
                </Grupo>
              </div>
            </Paso>

            {/* 2 · Mensaje */}
            <Paso n={2} titulo="Qué se envía">
              <div className="flex flex-wrap gap-2">
                {disponibles.map((p) => (
                  <Chip key={p.id} activo={cfg.plantilla === p.id} onClick={() => set('plantilla', p.id)}>
                    {p.etapa} · {p.nombre}
                    {p.estado !== 'Aprobada' && <span className="ml-1 text-amber-600">· en revisión</span>}
                  </Chip>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <span className="text-[11px] text-brand-ink/45 mr-1">Canal</span>
                {(['WhatsApp', 'Correo'] as const).map((c) => (
                  <Chip key={c} activo={cfg.canal === c} onClick={() => set('canal', c)}>{c}</Chip>
                ))}
              </div>
              {cfg.tipo === 'Especial' && (
                <input
                  value={cfg.oferta}
                  onChange={(e) => set('oferta', e.target.value)}
                  placeholder="Facilidad de pago que se ofrece"
                  className={CONTROL + ' mt-3'}
                />
              )}
              <div className="mt-3 rounded-2xl bg-brand-bone/60 border border-brand-ink/6 px-4 py-3">
                <div className="text-[10px] uppercase tracking-[0.14em] text-brand-ink/40">
                  Vista previa {ejemplo ? `· así le llega a ${ejemplo.cliente}` : ''}
                </div>
                <p className="text-sm text-brand-ink/75 leading-relaxed mt-1">
                  {ejemplo ? llenarPlantilla(plantilla.texto, ejemplo) : plantilla.texto}
                </p>
              </div>
              <label className="flex flex-wrap items-center gap-2 mt-3 text-[12px] text-brand-ink/70">
                <input
                  type="checkbox"
                  checked={cfg.seguimiento.activo}
                  onChange={(e) => set('seguimiento', { ...cfg.seguimiento, activo: e.target.checked })}
                  className="w-4 h-4 accent-[#b8975a]"
                />
                Si no responde en
                <input
                  type="number"
                  min={1}
                  max={15}
                  value={cfg.seguimiento.dias}
                  onChange={(e) => set('seguimiento', { ...cfg.seguimiento, dias: Number(e.target.value) || 1 })}
                  className={CONTROL + ' !w-16 !py-1'}
                />
                días, enviar
                <select
                  value={cfg.seguimiento.plantilla}
                  onChange={(e) => set('seguimiento', { ...cfg.seguimiento, plantilla: e.target.value })}
                  className={CONTROL + ' !w-auto !py-1'}
                >
                  {disponibles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.etapa} · {p.nombre}
                    </option>
                  ))}
                </select>
              </label>
            </Paso>

            {/* 3 · Cuándo */}
            <Paso n={3} titulo="Cuándo y con qué límites">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Grupo label="Inicio">
                  <input type="date" value={cfg.inicio} onChange={(e) => set('inicio', e.target.value)} className={CONTROL} />
                </Grupo>
                <Grupo label="Hora">
                  <input type="time" value={cfg.hora} onChange={(e) => set('hora', e.target.value)} className={CONTROL} />
                </Grupo>
                <Grupo label="Ventana desde">
                  <input type="time" value={cfg.ventana[0]} onChange={(e) => set('ventana', [e.target.value, cfg.ventana[1]])} className={CONTROL} />
                </Grupo>
                <Grupo label="Ventana hasta">
                  <input type="time" value={cfg.ventana[1]} onChange={(e) => set('ventana', [cfg.ventana[0], e.target.value])} className={CONTROL} />
                </Grupo>
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <span className="text-[11px] text-brand-ink/45 mr-1">Días</span>
                <Chip activo={cfg.diasSemana === 'L-V'} onClick={() => set('diasSemana', 'L-V')}>Lunes a viernes</Chip>
                <Chip activo={cfg.diasSemana === 'L-S'} onClick={() => set('diasSemana', 'L-S')}>Lunes a sábado</Chip>
                <span className="text-[11px] text-brand-ink/45 ml-3 mr-1">Máximo por cliente</span>
                {[1, 2, 3].map((n) => (
                  <Chip key={n} activo={cfg.maxPorSemana === n} onClick={() => set('maxPorSemana', n)}>
                    {n}/semana
                  </Chip>
                ))}
              </div>
              <p className="text-[11px] text-brand-ink/40 mt-2">La ventana se aplica en la hora local de cada cliente.</p>
            </Paso>
          </div>
        </Reveal>
      </div>

      {/* ── Resumen + campañas ── */}
      <div className="xl:col-span-2 space-y-5">
        <Reveal delay={0.05}>
          <div className="bg-brand-paper border border-brand-gold/40 rounded-3xl p-6 xl:sticky xl:top-4 space-y-4">
            <BlockTitle>Resumen</BlockTitle>
            <div className="grid grid-cols-2 gap-3">
              <Dato label="Cuentas" valor={String(incluidas.length)} />
              <Dato label="Saldo" valor={CURRENCY_FORMATTER.format(monto)} />
            </div>
            <ul className="text-[12px] text-brand-ink/65 space-y-1">
              <li>{plantilla.etapa} · {plantilla.nombre} por {cfg.canal}</li>
              {cfg.seguimiento.activo && <li>Seguimiento a los {cfg.seguimiento.dias} días si no responde</li>}
              <li>
                {lanzaHoy ? 'Sale hoy' : `Sale el ${cfg.inicio.slice(8)}/${cfg.inicio.slice(5, 7)}`} a las {cfg.hora} · {cfg.ventana[0]}–{cfg.ventana[1]} ·{' '}
                {cfg.diasSemana} · máx. {cfg.maxPorSemana}/semana
              </li>
            </ul>
            {excluidas.length > 0 && (
              <div>
                <button
                  onClick={() => setVerExcluidas(!verExcluidas)}
                  className="flex items-center gap-1 text-[12px] font-semibold text-rose-600"
                >
                  {excluidas.length} fuera de la campaña
                  <ChevronDown size={13} className={`transition-transform ${verExcluidas ? 'rotate-180' : ''}`} />
                </button>
                {verExcluidas && (
                  <ul className="mt-1.5 space-y-0.5 text-[11px] text-brand-ink/55">
                    {excluidas.map(({ cuenta, motivo }) => (
                      <li key={cuenta.id}>
                        {cuenta.cliente} · <span className="text-rose-600">{motivo}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {!aprobada && <p className="text-[11px] text-amber-700">La plantilla está en revisión: puedes guardarla, pero no lanzarla todavía.</p>}
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => guardar('Borrador')}
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-brand-ink/12 text-[12px] font-semibold text-brand-ink/70 hover:bg-brand-bone"
              >
                <Save size={13} /> Guardar borrador
              </button>
              <button
                onClick={() => guardar(lanzaHoy ? 'Activa' : 'Programada')}
                disabled={!aprobada || !incluidas.length}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-brand-ink text-brand-paper text-[12px] font-semibold hover:bg-brand-ink/85 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Play size={13} /> {lanzaHoy ? `Lanzar a ${incluidas.length} cuentas` : 'Programar'}
              </button>
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="bg-brand-paper border border-brand-ink/10 rounded-3xl overflow-hidden">
            <div className="px-6 py-4 border-b border-brand-ink/8">
              <BlockTitle>Campañas</BlockTitle>
            </div>
            <div className="divide-y divide-brand-ink/6">
              {campanas.map((c) => {
                const pl = PLANTILLAS.find((x) => x.id === c.config.plantilla);
                const n = audiencia(c.config, cartera).incluidas.length;
                return (
                  <motion.div
                    key={c.id}
                    layout={!reduce}
                    transition={{ duration: 0.25, ease: EASE }}
                    className="px-6 py-4 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-brand-ink">{c.nombre}</div>
                        <div className="text-[11px] text-brand-ink/45 mt-0.5">
                          {pl?.etapa} · {c.config.canal} · {n} cuentas · {c.enviados} enviados
                          {c.respuesta !== undefined ? ` · ${c.respuesta}% respuesta` : ''}
                        </div>
                      </div>
                      <span className={`audit-badge shrink-0 ${ESTADO_ESTILO[c.estado]}`}>{c.estado}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {(c.estado === 'Borrador' || c.estado === 'Pausada') && (
                        <Accion
                          onClick={() => cambiarEstadoCampana(c.id, c.config.inicio <= HOY ? 'Activa' : 'Programada')}
                          disabled={pl?.estado !== 'Aprobada'}
                          icon={<Play size={11} />}
                        >
                          {c.estado === 'Pausada' ? 'Reanudar' : 'Lanzar'}
                        </Accion>
                      )}
                      {(c.estado === 'Activa' || c.estado === 'Programada') && (
                        <Accion onClick={() => cambiarEstadoCampana(c.id, 'Pausada')} icon={<Pause size={11} />}>
                          Pausar
                        </Accion>
                      )}
                      <Accion onClick={() => editar(c)} icon={<Pencil size={11} />}>Editar</Accion>
                      <Accion onClick={() => editar(c, true)} icon={<Copy size={11} />}>Duplicar</Accion>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </Reveal>
      </div>
    </div>
  );
}

const CONTROL =
  'w-full px-3 py-2 rounded-xl border border-brand-ink/12 bg-brand-bone/50 text-sm text-brand-ink outline-none focus:border-brand-gold/60';

function Paso({ n, titulo, children }: { n: number; titulo: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <span className="w-6 h-6 shrink-0 rounded-full bg-brand-ink text-brand-paper text-[11px] font-semibold flex items-center justify-center">
        {n}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold text-brand-ink mb-3">{titulo}</div>
        {children}
      </div>
    </div>
  );
}

function Grupo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.14em] text-brand-ink/40 mb-1.5">{label}</div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Dato({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="rounded-2xl bg-brand-bone/60 border border-brand-ink/6 px-3.5 py-2.5">
      <div className="text-[10px] uppercase tracking-[0.14em] text-brand-ink/40">{label}</div>
      <div className="text-xl font-serif text-brand-ink tabular-nums mt-0.5">{valor}</div>
    </div>
  );
}

function Accion({
  onClick,
  icon,
  disabled,
  children,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-brand-ink/12 text-[11px] font-semibold text-brand-ink/65 hover:bg-brand-bone transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {icon}
      {children}
    </button>
  );
}

export function Chip({
  activo,
  onClick,
  children,
}: {
  key?: string | number;
  activo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold border transition-colors ${
        activo ? 'bg-brand-ink text-brand-paper border-brand-ink' : 'border-brand-ink/12 text-brand-ink/65 hover:bg-brand-bone'
      }`}
    >
      {children}
    </button>
  );
}
