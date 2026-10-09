import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { AlertTriangle, Copy, Pause, Play, Save, Search } from 'lucide-react';
import { CURRENCY_FORMATTER } from '../../../../utils/format.ts';
import { EASE, Reveal, BlockTitle } from './primitives.tsx';
import {
  HOY,
  OCASIONES,
  PLANTILLAS,
  SEGMENTOS,
  llenarPlantilla,
  saldoDe,
  textoOferta,
  type Campana,
  type CampanaConfig,
  type Ocasion,
  type Oferta,
} from './mockV1.ts';
import { useCobranza, type CuentaViva } from './store.tsx';

/**
 * Campañas = solo fechas especiales. El cobro de todos los días ya lo hace el
 * plan de cada cliente (niveles 1–4 antes de vencer, etapas A–D después).
 * Se arman en 3 pasos: ocasión → oferta → a qué clientes (tú eliges).
 * Quien suele esperar estas campañas para pagar queda fuera por defecto.
 */
const ESTADO_ESTILO: Record<Campana['estado'], string> = {
  Activa: 'bg-emerald-50 text-emerald-700',
  Programada: 'bg-amber-50 text-amber-700',
  Pausada: 'bg-brand-ink/8 text-brand-ink/60',
  Borrador: 'bg-brand-ink/5 text-brand-ink/55',
  Finalizada: 'bg-brand-bone text-brand-ink/45',
};

const fmt = (n: number) => CURRENCY_FORMATTER.format(n);
const fecha = (iso: string) => `${iso.slice(8)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

/** Por qué un cliente no puede recibir la campaña (o null si sí puede). */
function bloqueo(c: CuentaViva): string | null {
  if (!c.finanzas) return 'Sin contacto de finanzas';
  if (c.segmento === 'disputa') return 'En disputa';
  return null;
}

/** Sugeridos para una campaña con oferta: vencidos de más de 15 días, sin señal de esperar descuentos. */
function sugeridos(cartera: CuentaViva[], ocasion: Ocasion): string[] {
  return cartera
    .filter((c) => !c.saldada && !bloqueo(c))
    .filter((c) => (ocasion === 'contacto' ? true : c.dias > 15 && !c.comportamiento.esperaDescuentos && !c.promesa))
    .map((c) => c.id);
}

function configDe(ocasion: Ocasion, cartera: CuentaViva[]): CampanaConfig {
  const o = OCASIONES.find((x) => x.id === ocasion)!;
  return {
    ocasion,
    plantilla: o.plantilla,
    oferta: o.oferta,
    inicio: o.inicio,
    fin: o.fin,
    canal: PLANTILLAS.find((p) => p.id === o.plantilla)?.canal === 'Correo' ? 'Correo' : 'WhatsApp',
    clientes: sugeridos(cartera, ocasion),
  };
}

export function CampanasPanel({ soloLectura = false }: { soloLectura?: boolean }) {
  const reduce = useReducedMotion();
  const { cartera, campanas, guardarCampana, cambiarEstadoCampana } = useCobranza();
  const abiertas = cartera.filter((c) => !c.saldada);
  const [cfg, setCfg] = React.useState<CampanaConfig>(() => configDe('buen_fin', abiertas));
  const [nombre, setNombre] = React.useState('');
  const [buscar, setBuscar] = React.useState('');
  const set = <K extends keyof CampanaConfig>(k: K, v: CampanaConfig[K]) => setCfg((c) => ({ ...c, [k]: v }));

  const ocasion = OCASIONES.find((o) => o.id === cfg.ocasion)!;
  const plantilla = PLANTILLAS.find((p) => p.id === cfg.plantilla)!;
  const conOferta = cfg.ocasion !== 'contacto';
  const elegidos = abiertas.filter((c) => cfg.clientes.includes(c.id));
  const monto = elegidos.reduce((a, c) => a + saldoDe(c), 0);
  const aprovechadores = elegidos.filter((c) => c.comportamiento.esperaDescuentos);
  const lanzaHoy = cfg.inicio <= HOY;
  const aprobada = plantilla.estado === 'Aprobada';
  const nombreFinal = nombre.trim() || `${ocasion.nombre} ${cfg.inicio.slice(0, 4)}`;
  const visibles = abiertas.filter((c) => c.cliente.toLowerCase().includes(buscar.toLowerCase()));

  const alternar = (id: string) =>
    set('clientes', cfg.clientes.includes(id) ? cfg.clientes.filter((x) => x !== id) : [...cfg.clientes, id]);

  const guardar = (estado: Campana['estado']) => {
    guardarCampana({ id: `c${Date.now()}`, nombre: nombreFinal, config: cfg, estado, enviados: 0 });
    setNombre('');
    setCfg(configDe('buen_fin', abiertas));
  };

  const duplicar = (c: Campana) => {
    setCfg({ ...c.config, inicio: OCASIONES.find((o) => o.id === c.config.ocasion)!.inicio, fin: OCASIONES.find((o) => o.id === c.config.ocasion)!.fin, clientes: sugeridos(abiertas, c.config.ocasion) });
    setNombre('');
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  };

  const actuales = campanas.filter((c) => c.estado !== 'Finalizada');
  const pasadas = campanas.filter((c) => c.estado === 'Finalizada');

  return (
    <div className="space-y-5">
      <Reveal>
        <p className="text-sm text-brand-ink/60 max-w-[80ch] leading-relaxed">
          El cobro de todos los días lo hace el <span className="font-semibold text-brand-ink">plan de cada cliente</span>{' '}
          (niveles 1–4 antes de vencer y etapas A–D después). Las campañas son solo para fechas especiales y le llegan
          únicamente a los clientes que elijas.
        </p>
      </Reveal>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
        {/* ── Creador ── */}
        {!soloLectura && (
          <div className="xl:col-span-3">
            <Reveal>
              <div className="bg-brand-paper border border-brand-ink/10 rounded-3xl p-6 space-y-7">
                <BlockTitle>Nueva campaña</BlockTitle>

                {/* 1 · Ocasión */}
                <Paso n={1} titulo="¿Qué fecha especial?">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {OCASIONES.map((o) => (
                      <button
                        key={o.id}
                        onClick={() => setCfg(configDe(o.id, abiertas))}
                        aria-pressed={cfg.ocasion === o.id}
                        className={`text-left rounded-2xl border px-4 py-3 transition-colors ${
                          cfg.ocasion === o.id ? 'border-brand-gold/60 bg-brand-cream' : 'border-brand-ink/10 hover:bg-brand-bone'
                        }`}
                      >
                        <span className="block text-[13px] font-semibold text-brand-ink">{o.nombre}</span>
                        <span className="block text-[11px] text-brand-ink/50 mt-0.5">{o.fechas}</span>
                      </button>
                    ))}
                  </div>
                  {(cfg.ocasion === 'personalizada' || cfg.ocasion === 'contacto') && (
                    <div className="grid grid-cols-2 gap-3 mt-3 max-w-sm">
                      <Campo label="Desde">
                        <input type="date" value={cfg.inicio} onChange={(e) => set('inicio', e.target.value)} className={CONTROL} />
                      </Campo>
                      <Campo label="Hasta">
                        <input type="date" value={cfg.fin} onChange={(e) => set('fin', e.target.value)} className={CONTROL} />
                      </Campo>
                    </div>
                  )}
                </Paso>

                {/* 2 · Oferta */}
                <Paso n={2} titulo={conOferta ? '¿Qué se ofrece?' : 'Mensaje'}>
                  {conOferta && (
                    <div className="flex flex-wrap items-center gap-2">
                      {(
                        [
                          ['parcialidades', 'Parcialidades sin recargo'],
                          ['descuento', 'Descuento por pronto pago'],
                          ['ninguna', 'Solo recordatorio'],
                        ] as [Oferta['tipo'], string][]
                      ).map(([t, label]) => (
                        <Chip
                          key={t}
                          activo={cfg.oferta.tipo === t}
                          onClick={() => set('oferta', { tipo: t, valor: t === 'descuento' ? 5 : t === 'parcialidades' ? 3 : 0 })}
                        >
                          {label}
                        </Chip>
                      ))}
                      {cfg.oferta.tipo !== 'ninguna' && (
                        <label className="flex items-center gap-2 text-[12px] text-brand-ink/65 ml-1">
                          <input
                            type="number"
                            min={1}
                            max={cfg.oferta.tipo === 'descuento' ? 20 : 12}
                            value={cfg.oferta.valor}
                            onChange={(e) => set('oferta', { ...cfg.oferta, valor: Number(e.target.value) || 1 })}
                            className={CONTROL + ' !w-16 !py-1'}
                          />
                          {cfg.oferta.tipo === 'descuento' ? '%' : 'parcialidades'}
                        </label>
                      )}
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    <span className="text-[11px] text-brand-ink/45 mr-1">Canal</span>
                    {(['WhatsApp', 'Correo'] as const).map((c) => (
                      <Chip key={c} activo={cfg.canal === c} onClick={() => set('canal', c)}>
                        {c}
                      </Chip>
                    ))}
                  </div>
                  <div className="mt-3 rounded-2xl bg-brand-bone/60 border border-brand-ink/6 px-4 py-3">
                    <div className="text-[10px] uppercase tracking-[0.14em] text-brand-ink/40">
                      Así le llega{elegidos[0] ? ` a ${elegidos[0].cliente}` : ''} · plantilla aprobada
                    </div>
                    <p className="text-sm text-brand-ink/75 leading-relaxed mt-1">
                      {elegidos[0]
                        ? llenarPlantilla(plantilla.texto, elegidos[0], textoOferta(cfg.oferta) || undefined)
                        : plantilla.texto}
                    </p>
                  </div>
                </Paso>

                {/* 3 · Clientes */}
                <Paso n={3} titulo="¿A qué clientes?">
                  <div className="flex flex-wrap items-center gap-2">
                    <Chip activo={false} onClick={() => set('clientes', sugeridos(abiertas, cfg.ocasion))}>
                      Sugeridos
                    </Chip>
                    <Chip activo={false} onClick={() => set('clientes', abiertas.filter((c) => !bloqueo(c)).map((c) => c.id))}>
                      Todos
                    </Chip>
                    <Chip activo={false} onClick={() => set('clientes', [])}>
                      Ninguno
                    </Chip>
                    <div className="relative ml-auto">
                      <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-brand-ink/30" />
                      <input
                        value={buscar}
                        onChange={(e) => setBuscar(e.target.value)}
                        placeholder="Buscar cliente"
                        className={CONTROL + ' !pl-8 !py-1.5 w-48'}
                      />
                    </div>
                  </div>
                  {conOferta && (
                    <p className="text-[11px] text-brand-ink/45 mt-2">
                      Sugeridos: vencidos de más de 15 días, sin promesa de pago vigente y sin historial de esperar descuentos.
                    </p>
                  )}
                  <ul className="mt-3 border border-brand-ink/8 rounded-2xl divide-y divide-brand-ink/6 max-h-[380px] overflow-y-auto">
                    {visibles.map((c) => {
                      const motivo = bloqueo(c);
                      const marcado = cfg.clientes.includes(c.id);
                      const espera = c.comportamiento.esperaDescuentos;
                      return (
                        <li key={c.id}>
                          <label
                            className={`flex items-start gap-3 px-4 py-2.5 ${motivo ? 'opacity-45 cursor-not-allowed' : 'cursor-pointer hover:bg-brand-bone/50'}`}
                          >
                            <input
                              type="checkbox"
                              checked={marcado}
                              disabled={!!motivo}
                              onChange={() => alternar(c.id)}
                              className="mt-0.5 w-4 h-4 accent-[#b8975a]"
                            />
                            <span className="min-w-0 flex-1">
                              <span className="flex flex-wrap items-center gap-2">
                                <span className="text-[13px] font-semibold text-brand-ink">{c.cliente}</span>
                                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${SEGMENTOS[c.segmento].chip}`}>
                                  {SEGMENTOS[c.segmento].nombre}
                                </span>
                                {espera && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-rose-50 text-rose-700">
                                    <AlertTriangle size={10} /> Espera descuentos
                                  </span>
                                )}
                              </span>
                              <span className="block text-[11px] text-brand-ink/45 mt-0.5">
                                {fmt(saldoDe(c))} · {c.dias > 0 ? `${c.dias} días vencida` : `vence en ${-c.dias} días`}
                                {motivo && ` · ${motivo}`}
                                {espera && marcado && ` · ${c.comportamiento.campanasPagadas.length} campañas pagadas y ${c.comportamiento.negociaciones} negociaciones`}
                              </span>
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </Paso>
              </div>
            </Reveal>
          </div>
        )}

        {/* ── Resumen + campañas ── */}
        <div className={`${soloLectura ? 'xl:col-span-5 grid grid-cols-1 lg:grid-cols-2 gap-5 items-start' : 'xl:col-span-2 space-y-5'}`}>
          {!soloLectura && (
            <Reveal delay={0.05}>
              <div className="bg-brand-paper border border-brand-gold/40 rounded-3xl p-6 xl:sticky xl:top-4 space-y-4">
                <BlockTitle>Resumen</BlockTitle>
                <input
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder={nombreFinal}
                  className="w-full text-lg font-serif text-brand-ink bg-transparent border-b border-brand-ink/12 pb-1.5 outline-none focus:border-brand-gold/60 placeholder:text-brand-ink/35"
                />
                <div className="grid grid-cols-2 gap-3">
                  <Dato label="Clientes" valor={String(elegidos.length)} />
                  <Dato label="Por cobrar" valor={fmt(monto)} />
                </div>
                <ul className="text-[12px] text-brand-ink/65 space-y-1">
                  <li>
                    {ocasion.nombre} · del {fecha(cfg.inicio)} al {fecha(cfg.fin)}
                  </li>
                  {conOferta && <li>{textoOferta(cfg.oferta) || 'Sin oferta: solo recordatorio'}</li>}
                  <li>Por {cfg.canal} · el plan de cada cliente sigue igual</li>
                </ul>
                {aprovechadores.length > 0 && (
                  <p className="text-[12px] text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2 leading-relaxed">
                    Incluiste a {aprovechadores.map((c) => c.cliente).join(', ')}, que suele esperar estas campañas para pagar.
                    Ofrecerle otra vez el descuento refuerza ese hábito.
                  </p>
                )}
                {!aprobada && (
                  <p className="text-[11px] text-amber-700">La plantilla está en revisión: puedes guardarla, pero no lanzarla todavía.</p>
                )}
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => guardar('Borrador')}
                    className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-brand-ink/12 text-[12px] font-semibold text-brand-ink/70 hover:bg-brand-bone"
                  >
                    <Save size={13} /> Guardar
                  </button>
                  <button
                    onClick={() => guardar(lanzaHoy ? 'Activa' : 'Programada')}
                    disabled={!aprobada || !elegidos.length}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-brand-ink text-brand-paper text-[12px] font-semibold hover:bg-brand-ink/85 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Play size={13} /> {lanzaHoy ? `Lanzar a ${elegidos.length}` : `Programar para el ${fecha(cfg.inicio)}`}
                  </button>
                </div>
              </div>
            </Reveal>
          )}

          <Reveal delay={0.1}>
            <ListaCampanas
              titulo="Campañas"
              campanas={actuales}
              soloLectura={soloLectura}
              onEstado={cambiarEstadoCampana}
              onDuplicar={duplicar}
            />
          </Reveal>
          <Reveal delay={0.14}>
            <ListaCampanas titulo="Historial" campanas={pasadas} soloLectura={soloLectura} onDuplicar={duplicar} />
          </Reveal>
        </div>
      </div>
    </div>
  );
}

function ListaCampanas({
  titulo,
  campanas,
  soloLectura,
  onEstado,
  onDuplicar,
}: {
  titulo: string;
  campanas: Campana[];
  soloLectura: boolean;
  onEstado?: (id: string, estado: Campana['estado']) => void;
  onDuplicar: (c: Campana) => void;
}) {
  const reduce = useReducedMotion();
  const { cartera } = useCobranza();
  const nombreDe = (id: string) => cartera.find((c) => c.id === id)?.cliente ?? id;
  if (!campanas.length) return null;
  return (
    <div className="bg-brand-paper border border-brand-ink/10 rounded-3xl overflow-hidden">
      <div className="px-6 py-4 border-b border-brand-ink/8">
        <BlockTitle>{titulo}</BlockTitle>
      </div>
      <div className="divide-y divide-brand-ink/6">
        {campanas.map((c) => {
          const pl = PLANTILLAS.find((x) => x.id === c.config.plantilla);
          const oferta = textoOferta(c.config.oferta);
          return (
            <motion.div key={c.id} layout={!reduce} transition={{ duration: 0.25, ease: EASE }} className="px-6 py-4 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-brand-ink">{c.nombre}</div>
                  <div className="text-[11px] text-brand-ink/45 mt-0.5">
                    {fecha(c.config.inicio)} al {fecha(c.config.fin)} · {c.config.clientes.length} clientes{oferta ? ` · ${oferta}` : ''}
                    {c.estado !== 'Borrador' && c.estado !== 'Programada' ? ` · ${c.enviados} enviados` : ''}
                    {c.respuesta !== undefined ? ` · ${c.respuesta}% respuesta` : ''}
                  </div>
                  {c.pagaron && (
                    <div className="text-[11px] text-brand-ink/60 mt-1">
                      Pagaron con la oferta: <span className="font-semibold">{c.pagaron.map(nombreDe).join(', ')}</span>
                    </div>
                  )}
                </div>
                <span className={`audit-badge shrink-0 ${ESTADO_ESTILO[c.estado]}`}>{c.estado}</span>
              </div>
              {!soloLectura && (
                <div className="flex flex-wrap gap-1.5">
                  {onEstado && (c.estado === 'Borrador' || c.estado === 'Pausada') && (
                    <Accion
                      onClick={() => onEstado(c.id, c.config.inicio <= HOY ? 'Activa' : 'Programada')}
                      disabled={pl?.estado !== 'Aprobada'}
                      icon={<Play size={11} />}
                    >
                      {c.estado === 'Pausada' ? 'Reanudar' : c.config.inicio <= HOY ? 'Lanzar' : 'Programar'}
                    </Accion>
                  )}
                  {onEstado && (c.estado === 'Activa' || c.estado === 'Programada') && (
                    <Accion onClick={() => onEstado(c.id, 'Pausada')} icon={<Pause size={11} />}>
                      Pausar
                    </Accion>
                  )}
                  <Accion onClick={() => onDuplicar(c)} icon={<Copy size={11} />}>
                    {c.estado === 'Finalizada' ? 'Repetir este año' : 'Duplicar'}
                  </Accion>
                </div>
              )}
            </motion.div>
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

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-[0.14em] text-brand-ink/40">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
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

