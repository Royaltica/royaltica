import React from 'react';
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'motion/react';
import {
  CalendarCheck,
  ChevronDown,
  Copy,
  Flag,
  MoreHorizontal,
  Pause,
  Pencil,
  PencilLine,
  Play,
  Plus,
  RotateCcw,
  Trash2,
  UserCheck,
  Zap,
} from 'lucide-react';
import { CURRENCY_FORMATTER } from '../../../../utils/format.ts';
import { HOY, OCASIONES, PLANTILLAS, textoOferta, type Campana } from './mockV1.ts';
import { useCobranza } from './store.tsx';
import {
  OBJETIVOS,
  PREDETERMINADAS,
  accionesDe,
  avance,
  fmtFecha,
  montoDe,
  objetivoDe,
  type AccionCampana,
} from './campanasLogic.ts';
import { EstadoPill, GLASS, GLASS_FLOTANTE, NombreEditable, SPRING, SPRING_SUAVE } from './campanasUi.tsx';
import { CampanaWizard, type ModoWizard } from './CampanaWizard.tsx';
import { useConfirmar } from './vidrio.tsx';

/**
 * Campañas = solo fechas especiales. El cobro de todos los días ya lo hace el
 * plan de cada cliente (niveles 1–4 antes de vencer, etapas A–D después).
 *
 * Dashboard: lo que está en curso, las predeterminadas para empezar rápido y
 * el historial con resultados. Crear o editar abre el asistente por pasos.
 */

const fmt = (n: number) => CURRENCY_FORMATTER.format(n);
/** Monto corto para espacios chicos ($858 mil, $1.2 M). */
const fmtCorto = (n: number) =>
  n >= 1_000_000
    ? `$${(n / 1_000_000).toLocaleString('es-MX', { maximumFractionDigits: 1 })} M`
    : n >= 1_000
      ? `$${Math.round(n / 1_000).toLocaleString('es-MX')} mil`
      : fmt(n);

type Filtro = 'todas' | Campana['estado'];
const FILTROS: { id: Filtro; nombre: string }[] = [
  { id: 'todas', nombre: 'Todas' },
  { id: 'Activa', nombre: 'Activas' },
  { id: 'Programada', nombre: 'Programadas' },
  { id: 'Pausada', nombre: 'Pausadas' },
  { id: 'Borrador', nombre: 'Borradores' },
];

const ICONO_PRESET: Record<string, React.ReactNode> = {
  'p-buen-fin': <Zap size={18} />,
  'p-black': <Zap size={18} />,
  'p-cierre': <CalendarCheck size={18} />,
  'p-contactos': <UserCheck size={18} />,
};

const ACCION: Record<AccionCampana, { nombre: string; icono: React.ReactNode }> = {
  lanzar: { nombre: 'Lanzar', icono: <Play size={14} /> },
  reanudar: { nombre: 'Reanudar', icono: <Play size={14} /> },
  pausar: { nombre: 'Pausar', icono: <Pause size={14} /> },
  editar: { nombre: 'Editar', icono: <Pencil size={14} /> },
  renombrar: { nombre: 'Cambiar nombre', icono: <PencilLine size={14} /> },
  duplicar: { nombre: 'Duplicar', icono: <Copy size={14} /> },
  finalizar: { nombre: 'Finalizar', icono: <Flag size={14} /> },
  eliminar: { nombre: 'Eliminar', icono: <Trash2 size={14} /> },
  repetir: { nombre: 'Repetir este año', icono: <RotateCcw size={14} /> },
};

type Toast = { id: number; texto: string; deshacer?: () => void };

export function CampanasPanel({ soloLectura = false }: { soloLectura?: boolean }) {
  const reduce = useReducedMotion();
  const { cartera, campanas, cambiarEstadoCampana, eliminarCampana, restaurarCampana, guardarCampana } = useCobranza();
  const abiertas = cartera.filter((c) => !c.saldada);
  const [wizard, setWizard] = React.useState<ModoWizard | null>(null);
  const [filtro, setFiltro] = React.useState<Filtro>('todas');
  const [toast, setToast] = React.useState<Toast | null>(null);

  const avisar = React.useCallback((texto: string, deshacer?: () => void) => {
    setToast({ id: Date.now(), texto, deshacer });
  }, []);
  React.useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), toast.deshacer ? 6000 : 3500);
    return () => window.clearTimeout(t);
  }, [toast]);

  const enCurso = campanas.filter((c) => c.estado !== 'Finalizada');
  const pasadas = campanas.filter((c) => c.estado === 'Finalizada');
  const visibles = filtro === 'todas' ? enCurso : enCurso.filter((c) => c.estado === filtro);
  const cuenta = (e: Campana['estado']) => enCurso.filter((c) => c.estado === e).length;

  // KPIs
  const vivas = enCurso.filter((c) => c.estado === 'Activa' || c.estado === 'Programada');
  const enJuego = vivas.reduce((a, c) => a + montoDe(abiertas, c.config.clientes), 0);
  const envH = pasadas.reduce((a, c) => a + c.enviados, 0);
  const pagH = pasadas.reduce((a, c) => a + (c.pagaron?.length ?? 0), 0);
  const tasa = envH ? Math.round((pagH / envH) * 100) : null;

  const plantillaOk = (c: Campana) => PLANTILLAS.find((p) => p.id === c.config.plantilla)?.estado === 'Aprobada';

  const { confirmar, nodo: nodoConfirmar } = useConfirmar();

  const ejecutar = (c: Campana, a: AccionCampana, confirmado = false) => {
    // Lanzar manda mensajes y finalizar la cierra: ambas se confirman.
    if (!confirmado && a === 'lanzar') {
      const hoy = c.config.inicio <= HOY;
      const n = c.config.clientes.length;
      return confirmar({
        titulo: hoy ? `¿Lanzar "${c.nombre}"?` : `¿Programar "${c.nombre}"?`,
        mensaje: hoy
          ? `Sale hoy por ${c.config.canal} a ${n} ${n === 1 ? 'cliente' : 'clientes'}. Los mensajes enviados no se pueden retirar.`
          : `Saldrá el ${fmtFecha(c.config.inicio)} por ${c.config.canal} a ${n} ${n === 1 ? 'cliente' : 'clientes'}. Puedes pausarla antes.`,
        accion: hoy ? `Lanzar a ${n}` : 'Programar',
        alConfirmar: () => ejecutar(c, a, true),
      });
    }
    if (!confirmado && a === 'finalizar') {
      return confirmar({
        titulo: `¿Finalizar "${c.nombre}"?`,
        mensaje: 'Deja de enviar mensajes y pasa al historial con sus resultados. Para volver a usarla, la repites desde el historial.',
        accion: 'Finalizar campaña',
        peligro: true,
        alConfirmar: () => ejecutar(c, a, true),
      });
    }
    switch (a) {
      case 'lanzar':
      case 'reanudar': {
        const estado = c.config.inicio <= HOY ? 'Activa' : 'Programada';
        cambiarEstadoCampana(c.id, estado);
        avisar(
          estado === 'Activa'
            ? a === 'reanudar'
              ? `"${c.nombre}" se reanudó`
              : `"${c.nombre}" salió a ${c.config.clientes.length} clientes`
            : `"${c.nombre}" quedó programada para el ${fmtFecha(c.config.inicio)}`,
        );
        return;
      }
      case 'pausar':
        cambiarEstadoCampana(c.id, 'Pausada');
        avisar(`"${c.nombre}" está en pausa. Reanúdala cuando quieras`);
        return;
      case 'finalizar':
        cambiarEstadoCampana(c.id, 'Finalizada');
        avisar(`"${c.nombre}" pasó al historial`);
        return;
      case 'editar':
        setWizard({ tipo: 'editar', campana: c });
        return;
      case 'renombrar':
        // Lo resuelve la tarjeta: abre el nombre para editarlo en su lugar.
        return;
      case 'duplicar':
        setWizard({ tipo: 'copia', campana: c, repetir: false });
        return;
      case 'repetir':
        setWizard({ tipo: 'copia', campana: c, repetir: true });
        return;
      case 'eliminar': {
        const index = eliminarCampana(c.id);
        avisar(`Eliminaste "${c.nombre}"`, () => restaurarCampana(c, index));
        return;
      }
    }
  };

  const renombrar = (c: Campana, nombre: string) => {
    guardarCampana({ ...c, nombre });
    avisar(`Ahora se llama "${nombre}"`, () => guardarCampana(c));
  };

  return (
    <div className="relative">
      {/* Luz de fondo para que el vidrio tenga qué difuminar */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-10 h-[560px] overflow-hidden -z-0">
        <div className="absolute -top-24 right-[8%] w-[420px] h-[420px] rounded-full bg-brand-gold/20 blur-[100px]" />
        <div className="absolute top-40 left-[4%] w-[360px] h-[360px] rounded-full bg-cyan-200/40 blur-[100px]" />
      </div>

      <div className="relative space-y-8">
        {/* ── Encabezado oscuro con cifras ── */}
        <motion.section
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={SPRING_SUAVE}
          className="relative overflow-hidden rounded-[30px] bg-brand-ink text-white p-6 sm:p-8"
        >
          <div aria-hidden className="pointer-events-none absolute -top-32 -right-20 w-[380px] h-[380px] rounded-full bg-brand-gold/25 blur-[90px]" />
          <div className="relative flex flex-col lg:flex-row lg:items-end gap-6">
            <div className="flex-1 min-w-0">
              {/* El para qué ya lo dice el encabezado de la sección: aquí solo el título y las cifras. */}
              <h2 className="text-2xl sm:text-3xl tracking-tight">Fechas que mueven pagos</h2>
            </div>
            {!soloLectura && (
              <motion.button
                type="button"
                onClick={() => setWizard({ tipo: 'nueva' })}
                whileHover={reduce ? undefined : { scale: 1.02 }}
                whileTap={reduce ? undefined : { scale: 0.97 }}
                transition={SPRING}
                className="shrink-0 inline-flex items-center gap-2 self-start lg:self-auto rounded-full bg-brand-gold text-brand-ink px-6 py-3.5 text-[14px] font-semibold shadow-[0_14px_40px_-12px_rgba(6,182,212,0.8)] hover:bg-cyan-400 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-ink"
              >
                <Plus size={17} strokeWidth={2.5} /> Nueva campaña
              </motion.button>
            )}
          </div>
          <div className="relative grid grid-cols-2 lg:grid-cols-4 gap-px mt-8 rounded-2xl overflow-hidden bg-white/10">
            <Kpi label="Activas" valor={String(cuenta('Activa'))} />
            <Kpi label="Programadas" valor={String(cuenta('Programada'))} />
            <Kpi label="En juego" valor={fmt(enJuego)} corto={fmtCorto(enJuego)} nota="activas y programadas" />
            <Kpi label="Pagaron con campaña" valor={tasa === null ? '—' : `${tasa}%`} nota="histórico" />
          </div>
        </motion.section>

        {/* ── Predeterminadas ── */}
        {!soloLectura && (
          <section aria-labelledby="campanas-rapidas">
            <Titulo id="campanas-rapidas" detalle="Ya traen fechas, oferta y plantilla. Solo ajustas lo que quieras.">
              Empieza con una predeterminada
            </Titulo>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              {PREDETERMINADAS.map((p, i) => {
                const pl = PLANTILLAS.find((x) => x.id === OCASIONES.find((o) => o.id === p.ocasion)!.plantilla);
                return (
                  <motion.button
                    key={p.id}
                    type="button"
                    onClick={() => setWizard({ tipo: 'nueva', objetivo: p.objetivo, ocasion: p.ocasion })}
                    initial={reduce ? false : { opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    whileHover={reduce ? undefined : { y: -4 }}
                    whileTap={reduce ? undefined : { scale: 0.98 }}
                    transition={{ ...SPRING, delay: reduce ? 0 : 0.05 + i * 0.04 }}
                    className={`group flex flex-col items-start justify-start text-left rounded-[24px] p-5 ${GLASS} hover:bg-white/85 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/70`}
                  >
                    <span className="w-10 h-10 rounded-2xl bg-brand-ink text-brand-gold flex items-center justify-center">
                      {ICONO_PRESET[p.id]}
                    </span>
                    <span className="block text-[15px] font-semibold text-brand-ink mt-4">{p.nombre}</span>
                    <span className="block text-[12px] text-brand-ink/50 mt-0.5">{p.fechas}</span>
                    {pl?.estado !== 'Aprobada' && (
                      <span className="inline-block mt-2 text-[10.5px] font-semibold text-amber-700 bg-amber-500/10 rounded-full px-2 py-0.5">
                        Plantilla en revisión
                      </span>
                    )}
                  </motion.button>
                );
              })}
              <motion.button
                type="button"
                onClick={() => setWizard({ tipo: 'nueva' })}
                initial={reduce ? false : { opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={reduce ? undefined : { y: -4 }}
                whileTap={reduce ? undefined : { scale: 0.98 }}
                transition={{ ...SPRING, delay: reduce ? 0 : 0.21 }}
                className="col-span-2 lg:col-span-1 flex flex-col items-start justify-start text-left rounded-[24px] p-5 border-2 border-dashed border-brand-ink/15 hover:border-brand-gold/70 hover:bg-white/50 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/70"
              >
                <span className="w-10 h-10 rounded-2xl bg-white/80 ring-1 ring-brand-ink/10 text-brand-ink flex items-center justify-center">
                  <Plus size={18} />
                </span>
                <span className="block text-[15px] font-semibold text-brand-ink mt-4">Desde cero</span>
                <span className="block text-[12px] text-brand-ink/50 mt-0.5">Tú eliges cada paso</span>
              </motion.button>
            </div>
          </section>
        )}

        {/* ── En curso ── */}
        <section aria-labelledby="campanas-curso">
          <div className="flex flex-col sm:flex-row sm:items-end gap-3 mb-4">
            <Titulo id="campanas-curso" sinMargen>
              En curso
            </Titulo>
            <Segmentado
              opciones={FILTROS.map((f) => ({
                ...f,
                n: f.id === 'todas' ? enCurso.length : cuenta(f.id as Campana['estado']),
              }))}
              valor={filtro}
              onChange={setFiltro}
            />
          </div>
          <LayoutGroup>
            <motion.div layout={!reduce} className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <AnimatePresence mode="popLayout" initial={false}>
                {visibles.map((c) => (
                  <TarjetaCampana
                    key={c.id}
                    c={c}
                    monto={montoDe(abiertas, c.config.clientes)}
                    soloLectura={soloLectura}
                    plantillaOk={plantillaOk(c)}
                    onAccion={(a) => ejecutar(c, a)}
                    onRenombrar={(n) => renombrar(c, n)}
                  />
                ))}
              </AnimatePresence>
            </motion.div>
          </LayoutGroup>
          {!visibles.length && (
            <div className={`rounded-[26px] px-6 py-12 text-center ${GLASS}`}>
              <p className="text-[15px] font-semibold text-brand-ink">
                {filtro === 'todas' ? 'No hay campañas en curso' : `No hay campañas ${FILTROS.find((f) => f.id === filtro)!.nombre.toLowerCase()}`}
              </p>
              <p className="text-[13px] text-brand-ink/50 mt-1">
                {soloLectura ? 'Cuando el administrador lance una, aparecerá aquí.' : 'Empieza con una predeterminada o crea una desde cero.'}
              </p>
            </div>
          )}
        </section>

        {/* ── Historial ── */}
        {pasadas.length > 0 && (
          <section aria-labelledby="campanas-historial">
            <Titulo id="campanas-historial" detalle="Cuántos pagaron con cada oferta. Úsalo para decidir si repetirla.">
              Historial y resultados
            </Titulo>
            <div className={`rounded-[26px] overflow-hidden ${GLASS}`}>
              <AnimatePresence initial={false}>
                {pasadas.map((c, i) => (
                  <FilaHistorial
                    key={c.id}
                    c={c}
                    primera={i === 0}
                    soloLectura={soloLectura}
                    onAccion={(a) => ejecutar(c, a)}
                    onRenombrar={(n) => renombrar(c, n)}
                  />
                ))}
              </AnimatePresence>
            </div>
          </section>
        )}
      </div>

      {/* Asistente */}
      <AnimatePresence>
        {wizard && <CampanaWizard key="wizard" modo={wizard} onClose={() => setWizard(null)} onListo={(t) => avisar(t)} />}
      </AnimatePresence>

      {nodoConfirmar}
      {/* Aviso flotante */}
      <div className="fixed bottom-6 inset-x-0 z-[90] flex justify-center pointer-events-none px-4" aria-live="polite">
        <AnimatePresence>
          {toast && (
            <motion.div
              key={toast.id}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.95, filter: 'blur(6px)' }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.97 }}
              transition={SPRING}
              className="font-royaltica pointer-events-auto flex items-center gap-4 rounded-full pl-5 pr-2 py-2 bg-brand-ink/90 backdrop-blur-xl text-white shadow-[0_20px_50px_-15px_rgba(17,24,39,0.6)] ring-1 ring-white/10"
            >
              <span className="text-[13px]">{toast.texto}</span>
              {toast.deshacer ? (
                <button
                  type="button"
                  onClick={() => {
                    toast.deshacer?.();
                    setToast(null);
                  }}
                  className="rounded-full bg-white/10 hover:bg-white/20 px-3.5 py-1.5 text-[12.5px] font-semibold text-brand-gold transition-colors"
                >
                  Deshacer
                </button>
              ) : (
                <span className="w-2" />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── Tarjeta de campaña en curso ───────────────────────────────────────

function TarjetaCampana({
  c,
  monto,
  soloLectura,
  plantillaOk,
  onAccion: onAccionPanel,
  onRenombrar,
}: {
  key?: string;
  c: Campana;
  monto: number;
  soloLectura: boolean;
  plantillaOk: boolean;
  onAccion: (a: AccionCampana) => void;
  onRenombrar: (nombre: string) => void;
}) {
  const reduce = useReducedMotion();
  const [editandoNombre, setEditandoNombre] = React.useState(false);
  const onAccion = (a: AccionCampana) => (a === 'renombrar' ? setEditandoNombre(true) : onAccionPanel(a));
  const { principal, menu } = accionesDe(c);
  const obj = OBJETIVOS.find((o) => o.id === objetivoDe(c.config))!;
  const oferta = textoOferta(c.config.oferta);
  const progreso = avance(c);
  const bloqueada = (principal === 'lanzar' || principal === 'reanudar') && !plantillaOk;
  const etiquetaPrincipal =
    principal === 'lanzar' && c.config.inicio > HOY ? 'Programar' : principal ? ACCION[principal].nombre : '';

  return (
    <motion.article
      layout={!reduce}
      initial={reduce ? false : { opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, filter: 'blur(4px)' }}
      transition={SPRING}
      className={`relative rounded-[26px] p-5 sm:p-6 ${GLASS}`}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <EstadoPill estado={c.estado} />
          <h3 className="text-lg text-brand-ink mt-2.5 min-w-0">
            {soloLectura ? (
              <span className="block truncate">{c.nombre}</span>
            ) : (
              <NombreEditable
                valor={c.nombre}
                editando={editandoNombre}
                onEditando={setEditandoNombre}
                onGuardar={onRenombrar}
                className="text-lg"
              />
            )}
          </h3>
          <p className="text-[12.5px] text-brand-ink/50 mt-0.5 truncate">
            {obj.nombre}
            {oferta ? ` · ${oferta}` : ''}
          </p>
        </div>
        {!soloLectura && <MenuAcciones acciones={menu} onAccion={onAccion} nombre={c.nombre} />}
      </div>

      {/* Fechas y avance */}
      <div className="mt-5">
        <div className="flex items-center justify-between text-[12px] text-brand-ink/50 tabular-nums">
          <span>{fmtFecha(c.config.inicio)}</span>
          <span>{fmtFecha(c.config.fin)}</span>
        </div>
        <div className="mt-1.5 h-1.5 rounded-full bg-brand-ink/[0.07] overflow-hidden">
          <motion.div
            className={`h-full rounded-full ${c.estado === 'Pausada' ? 'bg-amber-400' : 'bg-gradient-to-r from-brand-gold to-cyan-300'}`}
            initial={reduce ? false : { width: 0 }}
            animate={{ width: `${Math.max(progreso * 100, c.estado === 'Activa' ? 3 : 0)}%` }}
            transition={{ ...SPRING_SUAVE, delay: reduce ? 0 : 0.15 }}
          />
        </div>
      </div>

      {/* Cifras */}
      <dl className="grid grid-cols-4 gap-2 mt-5">
        <Mini label="Clientes" valor={String(c.config.clientes.length)} />
        <Mini label="Por cobrar" valor={fmtCorto(monto)} titulo={fmt(monto)} />
        <Mini label="Enviados" valor={c.estado === 'Borrador' || c.estado === 'Programada' ? '—' : String(c.enviados)} />
        <Mini label="Respuesta" valor={c.respuesta !== undefined ? `${c.respuesta}%` : '—'} />
      </dl>

      {!soloLectura && principal && (
        <div className="flex items-center gap-2 mt-5">
          <motion.button
            type="button"
            onClick={() => onAccion(principal)}
            disabled={bloqueada}
            title={bloqueada ? 'La plantilla sigue en revisión en Meta' : undefined}
            whileTap={reduce || bloqueada ? undefined : { scale: 0.97 }}
            transition={SPRING}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[12.5px] font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/70 disabled:opacity-35 disabled:cursor-not-allowed ${
              principal === 'pausar'
                ? 'bg-white/70 text-brand-ink ring-1 ring-brand-ink/10 hover:bg-white'
                : 'bg-brand-ink text-white hover:bg-black'
            }`}
          >
            {ACCION[principal].icono} {etiquetaPrincipal}
          </motion.button>
          {menu.includes('editar') && (
            <button
              type="button"
              onClick={() => onAccion('editar')}
              className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[12.5px] font-semibold text-brand-ink/60 hover:text-brand-ink hover:bg-white/70 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/70"
            >
              <Pencil size={13} /> Editar
            </button>
          )}
          {bloqueada && <span className="text-[11.5px] text-amber-700 ml-auto">Plantilla en revisión</span>}
        </div>
      )}
    </motion.article>
  );
}

// ── Fila del historial ────────────────────────────────────────────────

function FilaHistorial({
  c,
  primera,
  soloLectura,
  onAccion: onAccionPanel,
  onRenombrar,
}: {
  key?: string;
  c: Campana;
  primera: boolean;
  soloLectura: boolean;
  onAccion: (a: AccionCampana) => void;
  onRenombrar: (nombre: string) => void;
}) {
  const reduce = useReducedMotion();
  const [editandoNombre, setEditandoNombre] = React.useState(false);
  const onAccion = (a: AccionCampana) => (a === 'renombrar' ? setEditandoNombre(true) : onAccionPanel(a));
  const { cartera } = useCobranza();
  const [abierta, setAbierta] = React.useState(false);
  const pagaron = c.pagaron ?? [];
  const tasa = c.enviados ? Math.round((pagaron.length / c.enviados) * 100) : null;
  const nombreDe = (id: string) => cartera.find((x) => x.id === id)?.cliente ?? id;
  const oferta = textoOferta(c.config.oferta);
  const { menu } = accionesDe(c);

  return (
    <motion.div
      layout={!reduce}
      initial={reduce ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
      transition={SPRING}
      className={primera ? '' : 'border-t border-brand-ink/[0.06]'}
    >
      <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-6 px-5 sm:px-6 py-4">
        {editandoNombre ? (
          <div className="flex items-center gap-3 min-w-0 flex-1 pl-7">
            <span className="min-w-0 flex-1">
              <NombreEditable
                valor={c.nombre}
                editando
                onEditando={setEditandoNombre}
                onGuardar={onRenombrar}
                className="text-[14.5px] font-semibold"
              />
            </span>
          </div>
        ) : (
        <button
          type="button"
          onClick={() => setAbierta((v) => !v)}
          onDoubleClick={() => !soloLectura && setEditandoNombre(true)}
          aria-expanded={abierta}
          className="flex items-center gap-3 min-w-0 flex-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/70 rounded-xl"
        >
          <motion.span animate={{ rotate: abierta ? 180 : 0 }} transition={SPRING} className="text-brand-ink/35 shrink-0">
            <ChevronDown size={16} />
          </motion.span>
          <span className="min-w-0">
            <span className="block text-[14.5px] font-semibold text-brand-ink truncate">{c.nombre}</span>
            <span className="block text-[12px] text-brand-ink/50 truncate">
              {fmtFecha(c.config.inicio)} · {c.config.canal}
              {oferta ? ` · ${oferta}` : ''}
            </span>
          </span>
        </button>
        )}

        <div className="flex items-center gap-4 md:w-[300px]">
          <div className="flex-1">
            <div className="flex items-baseline justify-between text-[12px]">
              <span className="text-brand-ink/50">
                Pagaron <span className="font-semibold text-brand-ink tabular-nums">{pagaron.length}</span> de{' '}
                <span className="tabular-nums">{c.enviados}</span>
              </span>
              <span className="font-semibold text-brand-ink tabular-nums">{tasa === null ? '—' : `${tasa}%`}</span>
            </div>
            <div className="mt-1.5 h-1.5 rounded-full bg-brand-ink/[0.07] overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-emerald-500"
                initial={reduce ? false : { width: 0 }}
                whileInView={{ width: `${tasa ?? 0}%` }}
                viewport={{ once: true }}
                transition={SPRING_SUAVE}
              />
            </div>
          </div>
        </div>

        {!soloLectura && (
          <div className="flex items-center gap-1 md:justify-end">
            <button
              type="button"
              onClick={() => onAccion('repetir')}
              className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[12.5px] font-semibold text-brand-ink bg-white/70 ring-1 ring-brand-ink/10 hover:bg-white transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/70"
            >
              <RotateCcw size={13} /> Repetir
            </button>
            <MenuAcciones acciones={menu} onAccion={onAccion} nombre={c.nombre} />
          </div>
        )}
      </div>

      <AnimatePresence initial={false}>
        {abierta && (
          <motion.div
            initial={reduce ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={SPRING_SUAVE}
            className="overflow-hidden"
          >
            <div className="px-5 sm:px-6 pb-5 pl-12 sm:pl-[52px]">
              {pagaron.length ? (
                <>
                  <div className="text-[12px] text-brand-ink/50 mb-2">Pagaron con la oferta</div>
                  <div className="flex flex-wrap gap-1.5">
                    {pagaron.map((id) => (
                      <span key={id} className="rounded-full bg-emerald-500/10 text-emerald-800 px-3 py-1 text-[12px] font-semibold">
                        {nombreDe(id)}
                      </span>
                    ))}
                  </div>
                  <div className="text-[12px] text-brand-ink/50 mt-3">
                    No pagaron: {c.config.clientes.filter((id) => !pagaron.includes(id)).map(nombreDe).join(', ') || 'nadie'}
                  </div>
                </>
              ) : (
                <p className="text-[12.5px] text-brand-ink/50">
                  Aún no hay pagos registrados con esta campaña. Se actualiza cuando entran los pagos del periodo.
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Menú "⋯" con confirmación para eliminar ───────────────────────────

function MenuAcciones({
  acciones,
  onAccion,
  nombre,
}: {
  acciones: AccionCampana[];
  onAccion: (a: AccionCampana) => void;
  nombre: string;
}) {
  const reduce = useReducedMotion();
  const [abierto, setAbierto] = React.useState(false);
  const [confirmar, setConfirmar] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) cerrar();
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && cerrar();
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', fuera);
      document.removeEventListener('keydown', esc);
    };
  }, [abierto]);

  const cerrar = () => {
    setAbierto(false);
    setConfirmar(false);
  };

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        aria-label={`Más acciones de ${nombre}`}
        aria-haspopup="menu"
        aria-expanded={abierto}
        onClick={() => (abierto ? cerrar() : setAbierto(true))}
        className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/70 ${
          abierto ? 'bg-white text-brand-ink ring-1 ring-brand-ink/10' : 'text-brand-ink/45 hover:text-brand-ink hover:bg-white/70'
        }`}
      >
        <MoreHorizontal size={18} />
      </button>
      <AnimatePresence>
        {abierto && (
          <motion.div
            role="menu"
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.92, y: -6, filter: 'blur(4px)' }}
            animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: -4 }}
            transition={SPRING}
            style={{ transformOrigin: 'top right' }}
            className={`absolute right-0 top-11 z-30 w-56 rounded-[20px] p-1.5 ${GLASS_FLOTANTE}`}
          >
            <AnimatePresence mode="wait" initial={false}>
              {!confirmar ? (
                <motion.div key="lista" initial={reduce ? false : { opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={SPRING}>
                  {acciones.map((a) => (
                    <button
                      key={a}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        if (a === 'eliminar') return setConfirmar(true);
                        cerrar();
                        onAccion(a);
                      }}
                      className={`w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-semibold text-left transition-colors outline-none focus-visible:bg-brand-ink/[0.05] ${
                        a === 'eliminar' ? 'text-rose-600 hover:bg-rose-500/10' : 'text-brand-ink/80 hover:bg-brand-ink/[0.05]'
                      }`}
                    >
                      <span className="opacity-70">{ACCION[a].icono}</span>
                      {ACCION[a].nombre}
                    </button>
                  ))}
                  {!acciones.includes('eliminar') && (
                    <p className="px-3 pt-2 pb-1.5 text-[11px] text-brand-ink/40 leading-snug border-t border-brand-ink/[0.06] mt-1">
                      Para eliminarla, primero pausa o finaliza la campaña.
                    </p>
                  )}
                </motion.div>
              ) : (
                <motion.div key="confirmar" initial={reduce ? false : { opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }} transition={SPRING} className="p-2">
                  <p className="text-[13px] font-semibold text-brand-ink">¿Eliminar esta campaña?</p>
                  <p className="text-[12px] text-brand-ink/50 mt-1 leading-snug">Podrás deshacerlo unos segundos.</p>
                  <div className="flex gap-1.5 mt-3">
                    <button
                      type="button"
                      autoFocus
                      onClick={() => setConfirmar(false)}
                      className="flex-1 rounded-full px-3 py-2 text-[12.5px] font-semibold text-brand-ink/70 bg-white/70 ring-1 ring-brand-ink/10 hover:bg-white transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        cerrar();
                        onAccion('eliminar');
                      }}
                      className="flex-1 rounded-full px-3 py-2 text-[12.5px] font-semibold text-white bg-rose-600 hover:bg-rose-700 transition-colors"
                    >
                      Eliminar
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Piezas chicas ─────────────────────────────────────────────────────

function Segmentado<T extends string>({
  opciones,
  valor,
  onChange,
}: {
  opciones: { id: T; nombre: string; n: number }[];
  valor: T;
  onChange: (v: T) => void;
}) {
  const reduce = useReducedMotion();
  return (
    <div role="tablist" aria-label="Filtrar campañas" className="sm:ml-auto inline-flex max-w-full overflow-x-auto rounded-full p-1 bg-white/55 backdrop-blur-xl border border-white/80 ring-1 ring-brand-ink/[0.06]">
      {opciones.map((o) => {
        const activo = o.id === valor;
        return (
          <button
            key={o.id}
            type="button"
            role="tab"
            aria-selected={activo}
            onClick={() => onChange(o.id)}
            className={`relative shrink-0 rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/70 ${
              activo ? 'text-white' : 'text-brand-ink/55 hover:text-brand-ink'
            }`}
          >
            {activo && (
              <motion.span
                layoutId={reduce ? undefined : 'filtro-campanas'}
                transition={SPRING}
                className="absolute inset-0 rounded-full bg-brand-ink shadow-[0_6px_16px_-8px_rgba(17,24,39,0.7)]"
              />
            )}
            <span className="relative">
              {o.nombre}
              {o.n > 0 && <span className={`ml-1.5 tabular-nums ${activo ? 'text-brand-gold' : 'text-brand-ink/35'}`}>{o.n}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function Titulo({ id, children, detalle, sinMargen }: { id: string; children: React.ReactNode; detalle?: string; sinMargen?: boolean }) {
  return (
    <div className={sinMargen ? '' : 'mb-4'}>
      <h3 id={id} className="text-xl text-brand-ink">
        {children}
      </h3>
      {detalle && <p className="text-[13px] text-brand-ink/50 mt-0.5">{detalle}</p>}
    </div>
  );
}

function Kpi({ label, valor, corto, nota }: { label: string; valor: string; corto?: string; nota?: string }) {
  return (
    <div className="bg-brand-ink/60 backdrop-blur-sm px-5 py-4 min-w-0" title={corto ? valor : undefined}>
      <div className="text-[11.5px] text-white/50">{label}</div>
      <div className="text-2xl sm:text-[28px] font-semibold tracking-tight tabular-nums mt-1 truncate">
        {corto ? (
          <>
            <span className="xl:hidden">{corto}</span>
            <span className="hidden xl:inline">{valor}</span>
          </>
        ) : (
          valor
        )}
      </div>
      {nota && <div className="text-[11px] text-white/35 mt-0.5">{nota}</div>}
    </div>
  );
}

function Mini({ label, valor, titulo }: { label: string; valor: string; titulo?: string }) {
  return (
    <div className="min-w-0 rounded-2xl bg-white/50 px-3 py-2.5" title={titulo}>
      <dt className="text-[11px] text-brand-ink/45 truncate">{label}</dt>
      <dd className="text-[15px] font-semibold text-brand-ink tabular-nums mt-0.5 truncate">{valor}</dd>
    </div>
  );
}

/** Chip compacto (lo usa también la pestaña Plantillas). */
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
