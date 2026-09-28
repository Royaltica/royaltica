import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { CalendarClock, ChevronDown, Copy, Link2, Pause, Pencil, Phone, Play, Save } from 'lucide-react';
import { CURRENCY_FORMATTER } from '../../../../utils/format.ts';
import { EASE, Reveal, BlockTitle } from './primitives.tsx';
import {
  AGENTES,
  BUCKETS,
  CONFIG_BASE,
  HOY,
  LINEAS,
  PLANTILLAS,
  SEGMENTOS,
  VENTANA_NIVEL,
  audiencia,
  bucketDe,
  llenarPlantilla,
  saldoDe,
  type Campana,
  type CampanaConfig,
  type Momento,
} from './mockV1.ts';
import { PLANTILLA as PASOS_PLAN, cuandoPaso } from './plan.tsx';
import { useCobranza } from './store.tsx';

/**
 * Campañas grupales, armadas en 3 preguntas:
 *  1 ¿A quién le llega?  → por vencer, ya vencidas o toda la cartera.
 *  2 ¿Qué se le envía?   → cobranza temprana (niveles 1–4) o después del
 *                          vencimiento (etapas A–D), más especiales/servicio.
 *  3 ¿Cuándo?            → fecha, horario y límites.
 * La audiencia se calcula en vivo y dice quién queda fuera y por qué.
 */
const TONO_BUCKET: Record<string, string> = {
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

const NIVELES = ['N1', 'N2', 'N3', 'N4'];
const ETAPAS = ['A', 'B', 'C', 'D'];
const OTROS = ['E1', 'E2', 'S1'];
const VENCIDAS = BUCKETS.filter((b) => b.id !== 'prev');

const toggle = (lista: string[], v: string) => (lista.includes(v) ? lista.filter((x) => x !== v) : [...lista, v]);

function textoMomento(cfg: CampanaConfig): string {
  if (cfg.momento === 'porVencer') {
    const n = VENTANA_NIVEL[cfg.plantilla] ?? 14;
    return n === 0 ? 'Vencen hoy' : `Vencen en ${n} días o menos`;
  }
  if (cfg.momento === 'todas') return 'Toda la cartera';
  const r = VENCIDAS.filter((b) => cfg.buckets.includes(b.id)).map((b) => b.rango);
  return r.length ? `Vencidas ${r.join(', ')}` : 'Todas las vencidas';
}

function nombreSugerido(cfg: CampanaConfig): string {
  const pl = PLANTILLAS.find((p) => p.id === cfg.plantilla)!;
  if (pl.grupo === 'Especial') return `Especial · ${cfg.oferta}`;
  if (pl.grupo === 'Servicio') return pl.nombre;
  return `${cfg.momento === 'porVencer' ? 'Temprana' : 'Vencidas'} · ${pl.nombre}`;
}

export function CampanasPanel() {
  const reduce = useReducedMotion();
  const { cartera, campanas, guardarCampana, cambiarEstadoCampana } = useCobranza();
  const [cfg, setCfg] = React.useState<CampanaConfig>(CONFIG_BASE);
  const [nombre, setNombre] = React.useState('');
  const [editando, setEditando] = React.useState<string | null>(null);
  const [masFiltros, setMasFiltros] = React.useState(false);
  const [verExcluidas, setVerExcluidas] = React.useState(false);
  const set = <K extends keyof CampanaConfig>(k: K, v: CampanaConfig[K]) => setCfg((c) => ({ ...c, [k]: v }));

  const { incluidas, excluidas } = audiencia(cfg, cartera);
  const monto = incluidas.reduce((s, c) => s + saldoDe(c), 0);
  const plantilla = PLANTILLAS.find((p) => p.id === cfg.plantilla)!;
  const esLlamada = plantilla.canal === 'Llamada';
  const ejemplo = incluidas[0];
  const lanzaHoy = cfg.inicio <= HOY;
  const aprobada = plantilla.estado === 'Aprobada';
  const filtrosActivos = cfg.segmentos.length + cfg.agentes.length + cfg.lineas.length + (cfg.montoMin ? 1 : 0);

  // Elegir el momento sugiere el mensaje que le corresponde, y al revés:
  // elegir un nivel o etapa pone el momento correcto. Nunca quedan cruzados.
  const cambiarMomento = (momento: Momento) =>
    setCfg((c) => ({
      ...c,
      momento,
      plantilla:
        momento === 'porVencer'
          ? 'N2'
          : momento === 'vencidas'
            ? (VENCIDAS.find((b) => c.buckets.includes(b.id))?.sugerida ?? 'A')
            : 'S1',
    }));
  const elegirMensaje = (id: string) => {
    const siguiente = [...NIVELES, ...ETAPAS][[...NIVELES, ...ETAPAS].indexOf(id) + 1];
    setCfg((c) => ({
      ...c,
      plantilla: id,
      momento: NIVELES.includes(id) ? 'porVencer' : ETAPAS.includes(id) ? 'vencidas' : id === 'S1' ? 'todas' : c.momento === 'todas' ? 'vencidas' : c.momento,
      seguimiento: { ...c.seguimiento, activo: !!siguiente && !OTROS.includes(id), plantilla: siguiente ?? c.seguimiento.plantilla },
    }));
  };

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
      <div className="xl:col-span-3">
        <Reveal>
          <div className="bg-brand-paper border border-brand-ink/10 rounded-3xl p-6 space-y-7">
            <div className="flex items-center justify-between gap-3">
              <BlockTitle>{editando ? 'Editar campaña' : 'Nueva campaña'}</BlockTitle>
            </div>
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder={nombreSugerido(cfg)}
              className="w-full text-lg font-serif text-brand-ink bg-transparent border-b border-brand-ink/12 pb-2 outline-none focus:border-brand-gold/60 placeholder:text-brand-ink/30"
            />

            {/* 1 · A quién */}
            <Paso n={1} titulo="¿A quién le llega?">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <Opcion
                  activo={cfg.momento === 'porVencer'}
                  onClick={() => cambiarMomento('porVencer')}
                  titulo="Por vencer"
                  texto="Facturas que todavía no vencen"
                  punto="bg-emerald-500"
                />
                <Opcion
                  activo={cfg.momento === 'vencidas'}
                  onClick={() => cambiarMomento('vencidas')}
                  titulo="Ya vencidas"
                  texto="Facturas con días de atraso"
                  punto="bg-rose-500"
                />
                <Opcion
                  activo={cfg.momento === 'todas'}
                  onClick={() => cambiarMomento('todas')}
                  titulo="Toda la cartera"
                  texto="Mensajes de servicio"
                  punto="bg-brand-ink/40"
                />
              </div>

              {cfg.momento === 'porVencer' && (
                <p className="mt-3 text-[12px] text-brand-ink/60">
                  El nivel que elijas en el paso 2 decide a quién le toca: {textoMomento(cfg).toLowerCase()}.
                </p>
              )}

              {cfg.momento === 'vencidas' && (
                <div className="mt-3">
                  <div className="text-[12px] text-brand-ink/60 mb-2">¿Con cuántos días de atraso? (si no eliges, van todas)</div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {VENCIDAS.map((b) => {
                      const cuentas = cartera.filter((c) => c.dias > 0 && bucketDe(c.dias).id === b.id);
                      const activo = cfg.buckets.includes(b.id);
                      return (
                        <button
                          key={b.id}
                          onClick={() =>
                            setCfg((c) => {
                              const buckets = toggle(c.buckets, b.id);
                              // Sugiere la etapa del rango más temprano elegido.
                              const primero = VENCIDAS.find((x) => buckets.includes(x.id));
                              return { ...c, buckets, plantilla: primero && ETAPAS.includes(c.plantilla) ? primero.sugerida : c.plantilla };
                            })
                          }
                          className={`text-left rounded-xl border px-3 py-2 transition-colors ${
                            activo ? 'border-brand-gold/60 bg-brand-cream' : 'border-brand-ink/8 hover:bg-brand-bone'
                          }`}
                        >
                          <span className="flex items-center gap-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${TONO_BUCKET[b.tono]}`} />
                            <span className="text-[12px] font-semibold text-brand-ink">{b.rango}</span>
                          </span>
                          <span className="block text-[11px] text-brand-ink/45 tabular-nums">
                            {cuentas.length} · {CURRENCY_FORMATTER.format(cuentas.reduce((s, c) => s + saldoDe(c), 0))}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Resultado en una frase */}
              <p className="mt-4 text-sm text-brand-ink/70">
                Le llega a <span className="font-semibold text-brand-ink">{incluidas.length} {incluidas.length === 1 ? 'cliente' : 'clientes'}</span>{' '}
                con {CURRENCY_FORMATTER.format(monto)} por cobrar
                {excluidas.length > 0 && <span className="text-brand-ink/45"> · {excluidas.length} {excluidas.length === 1 ? 'queda' : 'quedan'} fuera (ver resumen)</span>}
              </p>

              <button
                onClick={() => setMasFiltros(!masFiltros)}
                className="mt-3 flex items-center gap-1 text-[12px] font-semibold text-brand-ink/55 hover:text-brand-ink"
              >
                Más filtros{filtrosActivos ? ` (${filtrosActivos})` : ''}
                <ChevronDown size={13} className={`transition-transform ${masFiltros ? 'rotate-180' : ''}`} />
              </button>
              {masFiltros && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3 p-4 rounded-2xl bg-brand-bone/50 border border-brand-ink/6">
                  <div className="sm:col-span-2">
                    <Grupo label="Segmento de pago">
                      <Chip activo={!cfg.segmentos.length} onClick={() => set('segmentos', [])}>Todos</Chip>
                      {(Object.keys(SEGMENTOS) as (keyof typeof SEGMENTOS)[]).map((sg) => (
                        <Chip key={sg} activo={cfg.segmentos.includes(sg)} onClick={() => set('segmentos', toggle(cfg.segmentos, sg))}>
                          {SEGMENTOS[sg].nombre}
                        </Chip>
                      ))}
                    </Grupo>
                  </div>
                  <Grupo label="Agente">
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
                  <Grupo label="No enviar a">
                    <Chip activo={cfg.excluirPromesa} onClick={() => set('excluirPromesa', !cfg.excluirPromesa)}>
                      Quien tiene promesa de pago vigente
                    </Chip>
                  </Grupo>
                </div>
              )}
            </Paso>

            {/* 2 · Qué se envía */}
            <Paso n={2} titulo="¿Qué se le envía?">
              <div className="space-y-4">
                <GrupoMensajes
                  titulo="Cobranza temprana · antes del vencimiento"
                  subtitulo="Niveles 1 a 4. Solo para facturas que todavía no vencen."
                  tono="temprana"
                  ids={NIVELES}
                  activo={cfg.plantilla}
                  atenuado={cfg.momento !== 'porVencer'}
                  onElegir={elegirMensaje}
                />
                <GrupoMensajes
                  titulo="Después del vencimiento"
                  subtitulo="Etapas A a D. Solo para facturas ya vencidas."
                  tono="vencida"
                  ids={ETAPAS}
                  activo={cfg.plantilla}
                  atenuado={cfg.momento !== 'vencidas'}
                  onElegir={elegirMensaje}
                />
                <div>
                  <div className="text-[11px] text-brand-ink/45 mb-1.5">Otros mensajes</div>
                  <div className="flex flex-wrap gap-1.5">
                    {OTROS.map((id) => {
                      const p = PLANTILLAS.find((x) => x.id === id)!;
                      return (
                        <Chip key={id} activo={cfg.plantilla === id} onClick={() => elegirMensaje(id)}>
                          {p.nombre}
                          {p.estado !== 'Aprobada' && <span className="ml-1 text-amber-600">· en revisión</span>}
                        </Chip>
                      );
                    })}
                  </div>
                </div>
              </div>

              {plantilla.grupo === 'Especial' && (
                <input
                  value={cfg.oferta}
                  onChange={(e) => set('oferta', e.target.value)}
                  placeholder="Facilidad de pago que se ofrece"
                  className={CONTROL + ' mt-4'}
                />
              )}

              {esLlamada ? (
                <p className="mt-4 flex items-start gap-2 text-[12px] text-brand-ink/70 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
                  <Phone size={13} className="text-rose-600 shrink-0 mt-0.5" />
                  La negociación es por llamada: la campaña no manda mensaje, le crea la tarea de llamar a cada agente con su guion.
                </p>
              ) : (
                <div className="flex flex-wrap items-center gap-2 mt-4">
                  <span className="text-[11px] text-brand-ink/45 mr-1">Canal</span>
                  {(['WhatsApp', 'Correo'] as const).map((c) => (
                    <Chip key={c} activo={cfg.canal === c} onClick={() => set('canal', c)}>
                      {c}
                    </Chip>
                  ))}
                </div>
              )}

              <div className="mt-3 rounded-2xl bg-brand-bone/60 border border-brand-ink/6 px-4 py-3">
                <div className="text-[10px] uppercase tracking-[0.14em] text-brand-ink/40">
                  {esLlamada ? 'Guion' : 'Vista previa'} {ejemplo ? `· así le llega a ${ejemplo.cliente}` : ''}
                </div>
                <p className="text-sm text-brand-ink/75 leading-relaxed mt-1">
                  {ejemplo ? llenarPlantilla(plantilla.texto, ejemplo) : plantilla.texto}
                </p>
              </div>

              {!OTROS.includes(cfg.plantilla) && !esLlamada && (
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
                  días, seguir con
                  <select
                    value={cfg.seguimiento.plantilla}
                    onChange={(e) => set('seguimiento', { ...cfg.seguimiento, plantilla: e.target.value })}
                    className={CONTROL + ' !w-auto !py-1'}
                  >
                    {[...NIVELES, ...ETAPAS]
                      .slice([...NIVELES, ...ETAPAS].indexOf(cfg.plantilla) + 1)
                      .map((id) => {
                        const p = PLANTILLAS.find((x) => x.id === id)!;
                        return (
                          <option key={id} value={id}>
                            {p.etapa} · {p.nombre}
                          </option>
                        );
                      })}
                  </select>
                </label>
              )}
            </Paso>

            {/* 3 · Cuándo */}
            <Paso n={3} titulo="¿Cuándo y con qué límites?">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Grupo label="Inicio">
                  <input type="date" value={cfg.inicio} onChange={(e) => set('inicio', e.target.value)} className={CONTROL} />
                </Grupo>
                <Grupo label="Hora">
                  <input type="time" value={cfg.hora} onChange={(e) => set('hora', e.target.value)} className={CONTROL} />
                </Grupo>
                <Grupo label="Horario desde">
                  <input type="time" value={cfg.horario[0]} onChange={(e) => set('horario', [e.target.value, cfg.horario[1]])} className={CONTROL} />
                </Grupo>
                <Grupo label="Horario hasta">
                  <input type="time" value={cfg.horario[1]} onChange={(e) => set('horario', [cfg.horario[0], e.target.value])} className={CONTROL} />
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
              <p className="text-[11px] text-brand-ink/40 mt-2">El horario se aplica en la hora local de cada cliente.</p>
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
              <Dato label="Clientes" valor={String(incluidas.length)} />
              <Dato label="Por cobrar" valor={CURRENCY_FORMATTER.format(monto)} />
            </div>
            <ul className="text-[12px] text-brand-ink/65 space-y-1">
              <li>{textoMomento(cfg)}</li>
              <li>
                {plantilla.etapa} · {plantilla.nombre} {esLlamada ? '(tarea de llamada)' : `por ${cfg.canal}`}
              </li>
              {cfg.seguimiento.activo && !esLlamada && !OTROS.includes(cfg.plantilla) && (
                <li>
                  Si no responde en {cfg.seguimiento.dias} días: {PLANTILLAS.find((p) => p.id === cfg.seguimiento.plantilla)?.nombre}
                </li>
              )}
              <li>
                {lanzaHoy ? 'Sale hoy' : `Sale el ${cfg.inicio.slice(8)}/${cfg.inicio.slice(5, 7)}`} a las {cfg.hora} · {cfg.horario[0]}–
                {cfg.horario[1]} · {cfg.diasSemana} · máx. {cfg.maxPorSemana}/semana
              </li>
            </ul>
            {excluidas.length > 0 && (
              <div>
                <button onClick={() => setVerExcluidas(!verExcluidas)} className="flex items-center gap-1 text-[12px] font-semibold text-rose-600">
                  {excluidas.length} {excluidas.length === 1 ? 'queda' : 'quedan'} fuera
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
                <Play size={13} /> {lanzaHoy ? `Lanzar a ${incluidas.length} ${incluidas.length === 1 ? 'cliente' : 'clientes'}` : 'Programar'}
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
                  <motion.div key={c.id} layout={!reduce} transition={{ duration: 0.25, ease: EASE }} className="px-6 py-4 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-brand-ink">{c.nombre}</div>
                        <div className="text-[11px] text-brand-ink/45 mt-0.5">
                          {textoMomento(c.config)} · {pl?.etapa} · {n} clientes · {c.enviados} enviados
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
                      <Accion onClick={() => editar(c)} icon={<Pencil size={11} />}>
                        Editar
                      </Accion>
                      <Accion onClick={() => editar(c, true)} icon={<Copy size={11} />}>
                        Duplicar
                      </Accion>
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

/** Opción grande del paso 1 (por vencer / vencidas / toda la cartera). */
function Opcion({ activo, onClick, titulo, texto, punto }: { activo: boolean; onClick: () => void; titulo: string; texto: string; punto: string }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={activo}
      className={`text-left rounded-2xl border px-4 py-3 transition-colors ${
        activo ? 'border-brand-gold/60 bg-brand-cream' : 'border-brand-ink/10 hover:bg-brand-bone'
      }`}
    >
      <span className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${punto}`} />
        <span className="text-[13px] font-semibold text-brand-ink">{titulo}</span>
      </span>
      <span className="block text-[11px] text-brand-ink/50 mt-0.5">{texto}</span>
    </button>
  );
}

/** Bloque de mensajes del paso 2: niveles tempranos o etapas vencidas. */
function GrupoMensajes({
  titulo,
  subtitulo,
  tono,
  ids,
  activo,
  atenuado,
  onElegir,
}: {
  titulo: string;
  subtitulo: string;
  tono: 'temprana' | 'vencida';
  ids: string[];
  activo: string;
  atenuado: boolean;
  onElegir: (id: string) => void;
}) {
  const color =
    tono === 'temprana'
      ? { borde: 'border-emerald-200', fondo: 'bg-emerald-50/60', titulo: 'text-emerald-800', chip: 'bg-emerald-100 text-emerald-800' }
      : { borde: 'border-rose-200', fondo: 'bg-rose-50/50', titulo: 'text-rose-800', chip: 'bg-rose-100 text-rose-800' };
  return (
    <div className={`rounded-2xl border ${color.borde} ${color.fondo} p-3.5 transition-opacity ${atenuado ? 'opacity-50 hover:opacity-80' : ''}`}>
      <div className="flex items-center gap-2">
        <CalendarClock size={13} className={color.titulo} />
        <span className={`text-[12px] font-semibold ${color.titulo}`}>{titulo}</span>
      </div>
      <p className="text-[11px] text-brand-ink/50 mt-0.5">{subtitulo}</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
        {ids.map((id) => {
          const paso = PASOS_PLAN.find((p) => p.id === id)!;
          const p = PLANTILLAS.find((x) => x.id === id)!;
          const sel = activo === id;
          return (
            <button
              key={id}
              onClick={() => onElegir(id)}
              aria-pressed={sel}
              className={`text-left rounded-xl border px-3 py-2.5 bg-brand-paper transition-colors ${
                sel ? 'border-brand-ink ring-1 ring-brand-ink' : 'border-brand-ink/10 hover:border-brand-ink/25'
              }`}
            >
              <span className={`inline-block text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${color.chip}`}>
                {paso.etiqueta}
              </span>
              <span className="block text-[12px] font-semibold text-brand-ink mt-1.5 leading-tight">{p.nombre}</span>
              <span className="block text-[11px] text-brand-ink/45 mt-0.5">{cuandoPaso(paso.id, paso.dia)}</span>
              <span className="flex items-center gap-1 text-[10px] text-brand-ink/45 mt-1">
                {p.canal === 'Llamada' ? (
                  <>
                    <Phone size={10} /> Llamada
                  </>
                ) : paso.liga ? (
                  <>
                    <Link2 size={10} /> Liga de pago
                  </>
                ) : (
                  'Solo aviso'
                )}
              </span>
            </button>
          );
        })}
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
