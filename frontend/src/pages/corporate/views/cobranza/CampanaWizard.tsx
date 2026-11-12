import React from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  AlertTriangle,
  ArrowRight,
  BellRing,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  ChevronLeft,
  FastForward,
  Gift,
  Layers,
  ListChecks,
  Mail,
  MessageCircle,
  Pencil,
  PencilLine,
  Percent,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { CalendarioCampana } from './CalendarioCampana.tsx';
import { CURRENCY_FORMATTER } from '../../../../utils/format.ts';
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
  type Objetivo,
  type Ocasion,
  type Oferta,
} from './mockV1.ts';
import { useCobranza } from './store.tsx';
import {
  OBJETIVOS,
  bloqueo,
  configDe,
  fmtFecha,
  montoDe,
  objetivoDe,
  sugeridos,
} from './campanasLogic.ts';
import {
  BotonPrincipal,
  BotonSecundario,
  GLASS_FLOTANTE,
  NombreEditable,
  OpcionCard,
  SPRING,
  SPRING_SUAVE,
  Stepper,
} from './campanasUi.tsx';

// Asistente para crear o editar una campaña. Un paso a la vez: los pasos
// siguientes no se muestran hasta completar el actual, y los ya resueltos
// quedan como renglones compactos que se pueden tocar para cambiarlos.

type PasoId = 'objetivo' | 'fecha' | 'oferta' | 'canal' | 'clientes' | 'revisar';

const PREGUNTA: Record<PasoId, string> = {
  objetivo: '¿Qué quieres lograr?',
  fecha: '¿Cuándo?',
  oferta: '¿Qué les ofreces?',
  canal: '¿Por dónde les llega?',
  clientes: '¿A quién le llega?',
  revisar: 'Revisa y lanza',
};

const ICONO_OBJETIVO: Record<Objetivo, React.ReactNode> = {
  recuperar: <RotateCcw size={18} />,
  adelantar: <FastForward size={18} />,
  cierre: <CalendarCheck size={18} />,
  contactos: <UserCheck size={18} />,
};

export type ModoWizard =
  | { tipo: 'nueva'; objetivo?: Objetivo; ocasion?: Ocasion }
  | { tipo: 'editar'; campana: Campana }
  | { tipo: 'copia'; campana: Campana; repetir: boolean };

const fmt = (n: number) => CURRENCY_FORMATTER.format(n);
const pasosDe = (o: Objetivo | null): PasoId[] =>
  o === 'contactos'
    ? ['objetivo', 'fecha', 'canal', 'clientes', 'revisar']
    : ['objetivo', 'fecha', 'oferta', 'canal', 'clientes', 'revisar'];

export function CampanaWizard({
  modo,
  onClose,
  onListo,
}: {
  key?: string;
  modo: ModoWizard;
  onClose: () => void;
  /** Mensaje corto para el aviso del dashboard. */
  onListo: (mensaje: string) => void;
}) {
  const reduce = useReducedMotion();
  const { cartera, guardarCampana } = useCobranza();
  const abiertas = React.useMemo(() => cartera.filter((c) => !c.saldada), [cartera]);

  // ── Estado inicial según el modo ──
  const inicial = React.useMemo(() => {
    if (modo.tipo === 'editar') {
      const cfg = { ...modo.campana.config, objetivo: objetivoDe(modo.campana.config) };
      return { cfg, nombre: modo.campana.nombre, paso: pasosDe(cfg.objetivo).length - 1 };
    }
    if (modo.tipo === 'copia') {
      const base = modo.campana.config;
      const obj = objetivoDe(base);
      const cfg = modo.repetir
        ? { ...configDe(obj, base.ocasion, abiertas), oferta: base.oferta, canal: base.canal }
        : { ...base, objetivo: obj };
      const oc = OCASIONES.find((o) => o.id === cfg.ocasion)!;
      const nombre = modo.repetir ? `${oc.nombre} ${cfg.inicio.slice(0, 4)}` : `Copia de ${modo.campana.nombre}`;
      return { cfg, nombre, paso: pasosDe(obj).length - 1 };
    }
    if (modo.objetivo && modo.ocasion) {
      // Predeterminada: objetivo y fecha ya resueltos; sigue en el paso 3.
      return { cfg: configDe(modo.objetivo, modo.ocasion, abiertas), nombre: '', paso: 2 };
    }
    return { cfg: null as CampanaConfig | null, nombre: '', paso: 0 };
    // Solo al abrir: el asistente no debe reiniciarse si cambia la cartera.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [cfg, setCfg] = React.useState<CampanaConfig | null>(inicial.cfg);
  const [nombre, setNombre] = React.useState(inicial.nombre);
  const [paso, setPaso] = React.useState(inicial.paso);
  const [alcanzado, setAlcanzado] = React.useState(inicial.paso);
  const [direccion, setDireccion] = React.useState(1);
  const [confirmarCierre, setConfirmarCierre] = React.useState(false);
  const [editandoNombre, setEditandoNombre] = React.useState(false);
  // Al cambiar de paso, la vista regresa arriba (en móvil se desplaza el cuerpo; en escritorio, la columna).
  const columnaRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const col = columnaRef.current;
    const opts: ScrollToOptions = { top: 0, behavior: reduce ? 'auto' : 'smooth' };
    col?.scrollTo(opts);
    col?.parentElement?.scrollTo(opts);
  }, [paso, reduce]);
  const [modoClientes, setModoClientes] = React.useState<'sugeridos' | 'todos' | 'elegir' | null>(
    modo.tipo === 'nueva' ? null : 'elegir',
  );

  const objetivo = cfg ? objetivoDe(cfg) : null;
  const pasos = pasosDe(objetivo);
  const actual = pasos[Math.min(paso, pasos.length - 1)];
  const sucio = modo.tipo !== 'nueva' || alcanzado > 0;

  const set = <K extends keyof CampanaConfig>(k: K, v: CampanaConfig[K]) =>
    setCfg((c) => (c ? { ...c, [k]: v } : c));

  const ir = (i: number) => {
    setDireccion(i > paso ? 1 : -1);
    setPaso(i);
    setAlcanzado((a) => Math.max(a, i));
  };
  const siguiente = () => ir(Math.min(paso + 1, pasos.length - 1));

  // Avanza solo tras un instante, para que se vea la opción elegida.
  const timer = React.useRef<number | null>(null);
  const avanzarSolo = (desde: number) => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(
      () => {
        setDireccion(1);
        setPaso(desde + 1);
        setAlcanzado((a) => Math.max(a, desde + 1));
      },
      reduce ? 0 : 320,
    );
  };
  React.useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  // ── Cierre: Esc, fondo y confirmación si hay cambios ──
  const pedirCierre = React.useCallback(() => {
    if (sucio) setConfirmarCierre(true);
    else onClose();
  }, [sucio, onClose]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (confirmarCierre) setConfirmarCierre(false);
        else pedirCierre();
      }
    };
    window.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [confirmarCierre, pedirCierre]);

  // ── Derivados ──
  const ocasion = cfg ? OCASIONES.find((o) => o.id === cfg.ocasion)! : null;
  const plantilla = cfg ? PLANTILLAS.find((p) => p.id === cfg.plantilla)! : null;
  const elegidos = cfg ? abiertas.filter((c) => cfg.clientes.includes(c.id)) : [];
  const monto = cfg ? montoDe(abiertas, cfg.clientes) : 0;
  // Solo importa si hay oferta: sin descuento ni parcialidades no se refuerza el hábito.
  const aprovechadores =
    cfg && cfg.oferta.tipo !== 'ninguna' ? elegidos.filter((c) => c.comportamiento.esperaDescuentos) : [];
  const aprobada = plantilla?.estado === 'Aprobada';
  const lanzaHoy = cfg ? cfg.inicio <= HOY : false;
  const nombreFinal =
    nombre.trim() ||
    (!ocasion || !cfg
      ? 'Nueva campaña'
      : cfg.ocasion === 'personalizada'
        ? `Campaña del ${fmtFecha(cfg.inicio)}`
        : `${ocasion.nombre} ${cfg.inicio.slice(0, 4)}`);
  const fechasValidas = cfg ? cfg.fin >= cfg.inicio : false;

  const guardar = (estado: Campana['estado']) => {
    if (!cfg) return;
    const base = modo.tipo === 'editar' ? modo.campana : null;
    guardarCampana({
      id: base?.id ?? `c${Date.now()}`,
      nombre: nombreFinal,
      config: cfg,
      estado,
      enviados: base?.enviados ?? 0,
      respuesta: base?.respuesta,
    });
    const n = elegidos.length;
    onListo(
      estado === 'Borrador'
        ? `"${nombreFinal}" quedó como borrador`
        : modo.tipo === 'editar' && base?.estado === estado
          ? `Guardaste los cambios de "${nombreFinal}"`
          : estado === 'Activa'
            ? `"${nombreFinal}" salió a ${n} ${n === 1 ? 'cliente' : 'clientes'}`
            : `"${nombreFinal}" quedó programada para el ${fmtFecha(cfg.inicio)}`,
    );
    onClose();
  };

  // ── Resumen de cada paso resuelto (renglón compacto) ──
  const resumen = (p: PasoId): string => {
    if (!cfg) return '';
    switch (p) {
      case 'objetivo':
        return OBJETIVOS.find((o) => o.id === objetivo)!.nombre;
      case 'fecha':
        return `${ocasion!.nombre} · ${fmtFecha(cfg.inicio)}${cfg.fin !== cfg.inicio ? ` al ${fmtFecha(cfg.fin)}` : ''}`;
      case 'oferta':
        return textoOferta(cfg.oferta) || 'Solo recordatorio, sin oferta';
      case 'canal':
        return cfg.canal;
      case 'clientes':
        return `${cfg.clientes.length} ${cfg.clientes.length === 1 ? 'cliente' : 'clientes'} · ${fmt(monto)}`;
      default:
        return '';
    }
  };

  /** Renglones compactos de los pasos ya resueltos en [desde, hasta). */
  const renderResueltos = (desde: number, hasta: number) => (
    <div className={`space-y-2 ${desde > 0 ? 'mt-6' : ''}`}>
      <AnimatePresence initial={false}>
        {pasos.slice(desde, hasta).map((p, j) => {
          const i = desde + j;
          if (p === 'revisar') return null;
          return (
            <motion.button
              key={p}
              type="button"
              layout={!reduce}
              onClick={() => ir(i)}
              initial={reduce ? false : { opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }}
              transition={SPRING}
              className="group w-full flex items-center gap-3 rounded-2xl px-4 py-3 text-left bg-white/55 hover:bg-white/85 border border-white/80 ring-1 ring-brand-ink/[0.05] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/70"
            >
              <span className="w-6 h-6 shrink-0 rounded-full bg-brand-ink text-brand-gold text-[11px] font-semibold flex items-center justify-center tabular-nums">
                {i + 1}
              </span>
              <span className="text-[12px] text-brand-ink/45 shrink-0 hidden sm:block w-40 truncate">{PREGUNTA[p]}</span>
              <span className="text-[13.5px] font-semibold text-brand-ink truncate flex-1">{resumen(p)}</span>
              <span className="flex items-center gap-1 text-[12px] font-semibold text-brand-ink/40 group-hover:text-cyan-700 transition-colors">
                <Pencil size={12} /> Cambiar
              </span>
            </motion.button>
          );
        })}
      </AnimatePresence>
    </div>
  );

  const variantes = {
    entra: (d: number) => (reduce ? { opacity: 0 } : { opacity: 0, y: d > 0 ? 36 : -24, filter: 'blur(8px)' }),
    centro: { opacity: 1, y: 0, filter: 'blur(0px)' },
    sale: (d: number) => (reduce ? { opacity: 0 } : { opacity: 0, y: d > 0 ? -20 : 28, filter: 'blur(6px)' }),
  };

  const progreso = (paso + (actual === 'revisar' ? 1 : 0)) / pasos.length;

  return createPortal(
    <div className="font-royaltica fixed inset-0 z-[80]" role="presentation">
      {/* Fondo */}
      <motion.div
        className="absolute inset-0 bg-brand-ink/35 backdrop-blur-md"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: reduce ? 0 : 0.35 }}
        onClick={pedirCierre}
      />

      {/* Hoja */}
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="campana-wizard-titulo"
        className="absolute inset-x-3 top-3 bottom-3 sm:inset-x-6 sm:top-[4vh] sm:bottom-[4vh] mx-auto max-w-[1180px] rounded-[32px] overflow-hidden flex flex-col bg-[#F7FBFC]/80 backdrop-blur-3xl backdrop-saturate-150 border border-white/80 shadow-[0_50px_120px_-30px_rgba(17,24,39,0.55)]"
        // Sin desenfoque en la hoja: animar filter sobre vidrio es caro y se traba.
        initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 28 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: 16 }}
        style={{ willChange: 'transform, opacity' }}
        transition={reduce ? { duration: 0 } : SPRING_SUAVE}
      >
        {/* Luz de fondo: le da algo que difuminar al vidrio */}
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-24 w-[520px] h-[520px] rounded-full bg-brand-gold/25 blur-[110px]" />
          <div className="absolute -bottom-48 -left-32 w-[520px] h-[520px] rounded-full bg-cyan-200/40 blur-[120px]" />
        </div>

        {/* Barra superior */}
        <header className="relative flex items-center gap-4 px-5 sm:px-8 pt-5 sm:pt-6 pb-4">
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-ink/45">
              {modo.tipo === 'editar' ? 'Editar campaña' : modo.tipo === 'copia' ? (modo.repetir ? 'Repetir campaña' : 'Duplicar campaña') : 'Nueva campaña'}
            </div>
            <h2 id="campana-wizard-titulo" className="text-xl sm:text-2xl text-brand-ink mt-0.5 min-w-0">
              {!cfg ? (
                <span className="block truncate">Arma tu campaña en unos pasos</span>
              ) : nombre.trim() || editandoNombre ? (
                <NombreEditable
                  valor={nombre.trim() || nombreFinal}
                  editando={editandoNombre}
                  onEditando={setEditandoNombre}
                  onGuardar={setNombre}
                  className="text-xl sm:text-2xl"
                />
              ) : (
                <span className="flex items-center gap-3 min-w-0">
                  <span className="truncate">
                    {alcanzado >= pasos.length - 1 ? nombreFinal : 'Arma tu campaña en unos pasos'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setEditandoNombre(true)}
                    className="shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold text-brand-ink/60 bg-white/60 ring-1 ring-brand-ink/[0.08] hover:bg-white hover:text-brand-ink transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/70"
                  >
                    <PencilLine size={13} /> Ponle nombre
                  </button>
                </span>
              )}
            </h2>
          </div>
          <button
            type="button"
            onClick={pedirCierre}
            aria-label="Cerrar"
            className="w-10 h-10 rounded-full flex items-center justify-center bg-white/70 hover:bg-white border border-white ring-1 ring-brand-ink/10 text-brand-ink/70 hover:text-brand-ink transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/70"
          >
            <X size={18} />
          </button>
        </header>

        {/* Progreso: muestra cuánto falta, sin adelantar los pasos */}
        <div className="relative px-5 sm:px-8">
          <div className="h-1 rounded-full bg-brand-ink/[0.07] overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-brand-gold to-cyan-300"
              initial={false}
              animate={{ width: `${Math.max(progreso, 0.04) * 100}%` }}
              transition={SPRING_SUAVE}
            />
          </div>
          <div className="mt-2 text-[11px] text-brand-ink/45 tabular-nums">
            Paso {Math.min(paso + 1, pasos.length)} de {pasos.length}
          </div>
        </div>

        {/* Cuerpo */}
        <div className="relative flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-6 px-5 sm:px-8 pb-6 pt-4 overflow-y-auto lg:overflow-hidden">
          <div ref={columnaRef} className="min-h-0 lg:overflow-y-auto lg:pr-2 -mr-2 pr-2 pb-2">
            {renderResueltos(0, paso)}

            {/* Paso actual */}
            <AnimatePresence mode="wait" custom={direccion} initial={false}>
              <motion.section
                key={actual}
                custom={direccion}
                variants={variantes}
                initial="entra"
                animate="centro"
                exit="sale"
                transition={reduce ? { duration: 0 } : SPRING_SUAVE}
                className="mt-5"
                aria-labelledby={`paso-${actual}`}
              >
                <div className="flex items-baseline gap-3 mb-5">
                  <span className="text-[12px] font-semibold text-cyan-700 tabular-nums">
                    {String(Math.min(paso + 1, pasos.length)).padStart(2, '0')}
                  </span>
                  <h3 id={`paso-${actual}`} className="text-2xl sm:text-[28px] text-brand-ink leading-tight">
                    {PREGUNTA[actual]}
                  </h3>
                </div>

                {actual === 'objetivo' && (
                  <div role="radiogroup" className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {OBJETIVOS.map((o) => (
                      <OpcionCard
                        key={o.id}
                        grupo="objetivo"
                        activa={objetivo === o.id}
                        icono={ICONO_OBJETIVO[o.id]}
                        titulo={o.nombre}
                        detalle={o.detalle}
                        onClick={() => {
                          if (objetivo !== o.id) {
                            // Cambiar el objetivo rehace lo que sigue.
                            setCfg(configDe(o.id, o.ocasiones[0], abiertas));
                            setModoClientes(null);
                            setAlcanzado(0);
                          }
                          avanzarSolo(0);
                        }}
                      />
                    ))}
                  </div>
                )}

                {actual === 'fecha' && cfg && objetivo && (
                  <PasoFecha
                    cfg={cfg}
                    objetivo={objetivo}
                    onOcasion={(oc, necesitaFechas) => {
                      if (oc !== cfg.ocasion) {
                        setCfg({ ...configDe(objetivo, oc, abiertas), canal: cfg.canal });
                        setModoClientes(null);
                        setAlcanzado(paso);
                      }
                      if (!necesitaFechas) avanzarSolo(paso);
                    }}
                    onFechas={(inicio, fin) => setCfg({ ...cfg, inicio, fin })}
                    onContinuar={siguiente}
                    valido={fechasValidas}
                    nombre={nombre}
                    onNombre={setNombre}
                    sugerido={nombreFinal}
                  />
                )}

                {actual === 'oferta' && cfg && (
                  <PasoOferta
                    oferta={cfg.oferta}
                    onTipo={(t) => {
                      // Al regresar a un tipo ya usado se conserva su valor; si no, el recomendado.
                      const valor = cfg.oferta.tipo === t ? cfg.oferta.valor : VALOR_INICIAL[t];
                      set('oferta', { tipo: t, valor, texto: t === 'beneficio' ? (cfg.oferta.texto ?? '') : undefined });
                      if (t === 'ninguna') avanzarSolo(paso);
                    }}
                    onValor={(v) => set('oferta', { ...cfg.oferta, valor: v })}
                    onTexto={(texto) => set('oferta', { ...cfg.oferta, texto })}
                    onContinuar={siguiente}
                  />
                )}

                {actual === 'canal' && cfg && plantilla && (
                  <div className="space-y-5">
                    <div role="radiogroup" className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <OpcionCard
                        grupo="canal"
                        activa={cfg.canal === 'WhatsApp'}
                        icono={<MessageCircle size={18} />}
                        titulo="WhatsApp"
                        detalle="Se lee en minutos. Ideal para fechas cortas."
                        onClick={() => set('canal', 'WhatsApp')}
                      />
                      <OpcionCard
                        grupo="canal"
                        activa={cfg.canal === 'Correo'}
                        icono={<Mail size={18} />}
                        titulo="Correo"
                        detalle="Más formal. Llega a tesorería con copia."
                        onClick={() => set('canal', 'Correo')}
                      />
                    </div>
                    <VistaMensaje
                      canal={cfg.canal}
                      texto={
                        elegidos[0]
                          ? llenarPlantilla(plantilla.texto, elegidos[0], textoOferta(cfg.oferta) || undefined)
                          : plantilla.texto
                      }
                      para={elegidos[0]?.cliente}
                      aprobada={aprobada}
                    />
                    <div className="flex justify-end">
                      <BotonPrincipal onClick={siguiente}>
                        Continuar <ArrowRight size={15} />
                      </BotonPrincipal>
                    </div>
                  </div>
                )}

                {actual === 'clientes' && cfg && objetivo && (
                  <PasoClientes
                    cfg={cfg}
                    objetivo={objetivo}
                    modo={modoClientes}
                    onModo={(m) => {
                      setModoClientes(m);
                      if (m === 'sugeridos') set('clientes', sugeridos(abiertas, objetivo));
                      if (m === 'todos') set('clientes', abiertas.filter((c) => !bloqueo(c)).map((c) => c.id));
                    }}
                    onClientes={(ids) => set('clientes', ids)}
                    onContinuar={siguiente}
                  />
                )}

                {actual === 'revisar' && cfg && (
                  <div className="space-y-5">
                    <label className="block">
                      <span className="text-[12px] text-brand-ink/50">Nombre de la campaña</span>
                      <input
                        value={nombre}
                        onChange={(e) => setNombre(e.target.value)}
                        placeholder={nombreFinal}
                        className="mt-1 w-full bg-transparent text-2xl sm:text-3xl font-semibold tracking-tight text-brand-ink placeholder:text-brand-ink/30 border-b border-brand-ink/12 focus:border-brand-gold pb-2 outline-none transition-colors"
                      />
                    </label>

                    <div className="grid grid-cols-2 gap-3">
                      <Cifra label="Clientes" valor={String(elegidos.length)} />
                      <Cifra label="Por cobrar" valor={fmt(monto)} />
                    </div>

                    <Destinatarios elegidos={elegidos} />

                    <ul className="space-y-2">
                      <Aviso tono="info" icono={<Sparkles size={14} />}>
                        El plan diario de cada cliente sigue igual: la campaña es un mensaje extra.
                      </Aviso>
                      {aprovechadores.length > 0 && (
                        <Aviso tono="riesgo" icono={<AlertTriangle size={14} />}>
                          {aprovechadores.map((c) => c.cliente).join(', ')} suele esperar estas campañas para pagar.
                          Ofrecerle otra vez la oferta refuerza ese hábito.
                        </Aviso>
                      )}
                      {!aprobada && (
                        <Aviso tono="alerta" icono={<AlertTriangle size={14} />}>
                          La plantilla de {ocasion?.nombre} sigue en revisión en Meta: puedes guardarla, pero no lanzarla todavía.
                        </Aviso>
                      )}
                      {!elegidos.length && (
                        <Aviso tono="alerta" icono={<Users size={14} />}>
                          No hay clientes elegidos. Regresa al paso de clientes para elegir al menos uno.
                        </Aviso>
                      )}
                    </ul>

                    <div className="flex flex-col-reverse sm:flex-row sm:items-center gap-2 pt-2">
                      {modo.tipo === 'editar' && modo.campana.estado !== 'Borrador' ? (
                        <>
                          <span className="text-[12px] text-brand-ink/45 sm:mr-auto">
                            Sigue {modo.campana.estado.toLowerCase()}. Los mensajes ya enviados no se repiten.
                          </span>
                          <BotonPrincipal onClick={() => guardar(modo.campana.estado)} disabled={!elegidos.length}>
                            Guardar cambios
                          </BotonPrincipal>
                        </>
                      ) : (
                        <>
                          <div className="sm:mr-auto">
                            <BotonSecundario onClick={() => guardar('Borrador')}>Guardar como borrador</BotonSecundario>
                          </div>
                          <BotonPrincipal
                            onClick={() => guardar(lanzaHoy ? 'Activa' : 'Programada')}
                            disabled={!aprobada || !elegidos.length}
                            title={!aprobada ? 'La plantilla sigue en revisión en Meta' : undefined}
                          >
                            {lanzaHoy
                              ? `Lanzar a ${elegidos.length} ${elegidos.length === 1 ? 'cliente' : 'clientes'}`
                              : `Programar para el ${fmtFecha(cfg.inicio)}`}
                            <ArrowRight size={15} />
                          </BotonPrincipal>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </motion.section>
            </AnimatePresence>

            {renderResueltos(paso + 1, alcanzado + 1)}

            {paso > 0 && actual !== 'revisar' && (
              <button
                type="button"
                onClick={() => ir(paso - 1)}
                className="mt-6 inline-flex items-center gap-1 text-[12.5px] font-semibold text-brand-ink/45 hover:text-brand-ink transition-colors"
              >
                <ChevronLeft size={14} /> Atrás
              </button>
            )}
          </div>

          {/* Lo que llevas: crece conforme avanzas */}
          <aside className="hidden lg:block min-h-0 overflow-y-auto">
            <div className="rounded-[26px] p-5 bg-white/55 backdrop-blur-xl border border-white/80 ring-1 ring-brand-ink/[0.05] space-y-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-ink/45">Tu campaña</div>
              {!cfg ? (
                <p className="text-[13px] text-brand-ink/50 leading-relaxed">
                  Elige un objetivo y aquí verás cómo va quedando.
                </p>
              ) : (
                <>
                  <ul className="space-y-2.5">
                    <AnimatePresence initial={false}>
                      {pasos
                        .filter((p, i) => p !== 'revisar' && i < alcanzado)
                        .map((p) => (
                          <motion.li
                            key={p}
                            layout={!reduce}
                            initial={reduce ? false : { opacity: 0, x: 12 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0 }}
                            transition={SPRING}
                            className="flex items-start gap-2.5"
                          >
                            <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-brand-gold shrink-0" />
                            <span className="text-[13px] text-brand-ink/75 leading-snug">{resumen(p)}</span>
                          </motion.li>
                        ))}
                    </AnimatePresence>
                  </ul>
                  {alcanzado > pasos.indexOf('clientes') && (
                    <motion.div
                      initial={reduce ? false : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={SPRING}
                      className="rounded-2xl bg-brand-ink text-white p-4"
                    >
                      <div className="text-[11px] uppercase tracking-[0.14em] text-white/50">En juego</div>
                      <div className="text-2xl font-semibold tracking-tight tabular-nums mt-1">{fmt(monto)}</div>
                      <div className="text-[12px] text-white/60 mt-0.5">
                        {elegidos.length} {elegidos.length === 1 ? 'cliente' : 'clientes'}
                      </div>
                    </motion.div>
                  )}
                </>
              )}
            </div>
          </aside>
        </div>

        {/* Confirmar cierre */}
        <AnimatePresence>
          {confirmarCierre && (
            <motion.div
              className="absolute inset-0 z-10 flex items-center justify-center p-4 bg-white/30 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduce ? 0 : 0.2 }}
            >
              <motion.div
                role="alertdialog"
                aria-labelledby="cerrar-titulo"
                className={`w-full max-w-sm rounded-[26px] p-6 ${GLASS_FLOTANTE}`}
                initial={reduce ? false : { scale: 0.94, y: 10 }}
                animate={{ scale: 1, y: 0 }}
                exit={reduce ? { opacity: 0 } : { scale: 0.96, opacity: 0 }}
                transition={SPRING}
              >
                <h4 id="cerrar-titulo" className="text-lg font-semibold text-brand-ink">
                  {modo.tipo === 'editar' ? '¿Salir sin guardar?' : '¿Descartar esta campaña?'}
                </h4>
                <p className="text-[13px] text-brand-ink/55 mt-1.5 leading-relaxed">
                  {modo.tipo === 'editar'
                    ? 'Los cambios que hiciste se pierden. La campaña queda como estaba.'
                    : 'Puedes guardarla como borrador y terminarla después.'}
                </p>
                <div className="flex flex-col gap-2 mt-5">
                  {modo.tipo !== 'editar' && cfg && (
                    <BotonPrincipal onClick={() => guardar('Borrador')}>Guardar como borrador</BotonPrincipal>
                  )}
                  <BotonSecundario onClick={onClose}>{modo.tipo === 'editar' ? 'Salir sin guardar' : 'Descartar'}</BotonSecundario>
                  <button
                    type="button"
                    autoFocus
                    onClick={() => setConfirmarCierre(false)}
                    className="text-[13px] font-semibold text-brand-ink/50 hover:text-brand-ink py-2 transition-colors"
                  >
                    Seguir editando
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>,
    document.body,
  );
}

// ── Pasos ─────────────────────────────────────────────────────────────

function PasoFecha({
  cfg,
  objetivo,
  onOcasion,
  onFechas,
  onContinuar,
  valido,
  nombre,
  onNombre,
  sugerido,
}: {
  cfg: CampanaConfig;
  objetivo: Objetivo;
  onOcasion: (o: Ocasion, necesitaFechas: boolean) => void;
  onFechas: (inicio: string, fin: string) => void;
  onContinuar: () => void;
  valido: boolean;
  nombre: string;
  onNombre: (v: string) => void;
  sugerido: string;
}) {
  const reduce = useReducedMotion();
  const ids = OBJETIVOS.find((o) => o.id === objetivo)!.ocasiones;
  const libre = cfg.ocasion === 'personalizada' || cfg.ocasion === 'contacto';
  return (
    <div className="space-y-5">
      <div role="radiogroup" className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {ids.map((id) => {
          const o = OCASIONES.find((x) => x.id === id)!;
          const necesita = id === 'personalizada' || id === 'contacto';
          return (
            <OpcionCard
              key={id}
              vertical grupo="fecha"
              activa={cfg.ocasion === id}
              icono={<CalendarDays size={18} />}
              titulo={o.nombre}
              detalle={o.fechas.charAt(0).toUpperCase() + o.fechas.slice(1)}
              onClick={() => onOcasion(id, necesita)}
            />
          );
        })}
      </div>
      <AnimatePresence initial={false}>
        {libre && (
          <motion.div
            initial={reduce ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
            transition={SPRING_SUAVE}
            className="overflow-hidden"
          >
            <div className="space-y-4 pt-1">
              {cfg.ocasion === 'personalizada' && (
                <label className="block rounded-[22px] px-5 py-4 bg-white/55 border border-white/80 ring-1 ring-brand-ink/[0.05] focus-within:ring-2 focus-within:ring-brand-gold/70 transition-shadow">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-ink/45">
                    Nombre de tu campaña
                  </span>
                  <input
                    value={nombre}
                    maxLength={60}
                    onChange={(e) => onNombre(e.target.value)}
                    placeholder={`Ej. Aniversario, Regreso a clases… (si lo dejas vacío: ${sugerido})`}
                    className="mt-1 w-full bg-transparent text-[17px] font-semibold text-brand-ink placeholder:font-normal placeholder:text-[14px] placeholder:text-brand-ink/35 outline-none"
                  />
                </label>
              )}
              <CalendarioCampana inicio={cfg.inicio} fin={cfg.fin} onCambio={onFechas} />
            </div>
            {!valido && <p className="text-[12px] text-rose-700 mt-2">La fecha de fin no puede ser antes del inicio.</p>}
            <div className="flex justify-end mt-5">
              <BotonPrincipal onClick={onContinuar} disabled={!valido}>
                Continuar <ArrowRight size={15} />
              </BotonPrincipal>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {!libre && (
        <div className="flex justify-end">
          <BotonPrincipal onClick={onContinuar}>
            Continuar <ArrowRight size={15} />
          </BotonPrincipal>
        </div>
      )}
    </div>
  );
}

/** Valor recomendado al elegir cada tipo de oferta. */
const VALOR_INICIAL: Record<Oferta['tipo'], number> = {
  descuento: 5,
  parcialidades: 3,
  condonacion: 100,
  prorroga: 15,
  beneficio: 0,
  ninguna: 0,
};

const OPCIONES_OFERTA: { t: Oferta['tipo']; titulo: string; detalle: string; icono: React.ReactNode }[] = [
  { t: 'parcialidades', titulo: 'Parcialidades sin recargo', detalle: 'Divide el saldo. Funciona con quien no puede pagar todo.', icono: <Layers size={18} /> },
  { t: 'descuento', titulo: 'Descuento por pronto pago', detalle: 'Un porcentaje si liquida dentro de las fechas.', icono: <Percent size={18} /> },
  { t: 'condonacion', titulo: 'Perdonar intereses', detalle: 'Quita los intereses moratorios si liquida el saldo.', icono: <ShieldCheck size={18} /> },
  { t: 'prorroga', titulo: 'Días extra sin recargo', detalle: 'Más plazo para pagar, sin penalización.', icono: <CalendarClock size={18} /> },
  { t: 'beneficio', titulo: 'Crear un beneficio', detalle: 'Escribe el tuyo: envío gratis, precio congelado…', icono: <Gift size={18} /> },
  { t: 'ninguna', titulo: 'Solo recordatorio', detalle: 'Sin oferta. Aprovecha la fecha para recordar.', icono: <BellRing size={18} /> },
];

const IDEAS_BENEFICIO = [
  'envío gratis en su próximo pedido',
  'mantener su precio actual todo el próximo trimestre',
  'prioridad en sus próximas entregas',
  'ampliar su línea de crédito al liquidar',
];

/** Rango, unidad y consejo para las ofertas con número. */
const AJUSTE: Partial<Record<Oferta['tipo'], { min: number; max: number; paso: number; sufijo: string; consejo: (v: number) => string }>> = {
  descuento: {
    min: 1, max: 20, paso: 1, sufijo: '% de descuento',
    consejo: (v) => (v > 10 ? 'Un descuento alto se vuelve costumbre: el cliente aprende a esperar la campaña.' : 'Entre 3% y 7% suele bastar para que adelanten el pago.'),
  },
  parcialidades: {
    min: 2, max: 12, paso: 1, sufijo: 'parcialidades',
    consejo: (v) => (v > 6 ? 'Muchas parcialidades alargan la cobranza. Considera un máximo de 6.' : 'De 2 a 4 parcialidades es lo que mejor se cumple.'),
  },
  condonacion: {
    min: 25, max: 100, paso: 25, sufijo: '% de intereses perdonados',
    consejo: (v) => (v >= 100 ? 'Perdonar todos los intereses cuesta poco y elimina la objeción más común para liquidar.' : 'Un perdón parcial ayuda si los intereses ya son una parte grande del saldo.'),
  },
  prorroga: {
    min: 5, max: 30, paso: 5, sufijo: 'días extra',
    consejo: (v) => (v > 15 ? 'Un plazo largo pierde urgencia. Acompáñalo de un recordatorio a la mitad.' : 'De 7 a 15 días da aire sin que el pago se olvide.'),
  },
};

function PasoOferta({
  oferta,
  onTipo,
  onValor,
  onTexto,
  onContinuar,
}: {
  oferta: Oferta;
  onTipo: (t: Oferta['tipo']) => void;
  onValor: (v: number) => void;
  onTexto: (t: string) => void;
  onContinuar: () => void;
}) {
  const reduce = useReducedMotion();
  const ajuste = AJUSTE[oferta.tipo];
  const textoListo = oferta.tipo !== 'beneficio' || !!oferta.texto?.trim();
  return (
    <div className="space-y-6">
      <div role="radiogroup" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {OPCIONES_OFERTA.map((o) => (
          <OpcionCard
            key={o.t}
            vertical
            grupo="oferta"
            activa={oferta.tipo === o.t}
            icono={o.icono}
            titulo={o.titulo}
            detalle={o.detalle}
            onClick={() => onTipo(o.t)}
          />
        ))}
      </div>
      <AnimatePresence initial={false} mode="wait">
        {ajuste && (
          <motion.div
            key={oferta.tipo}
            initial={reduce ? false : { opacity: 0, y: 12, filter: 'blur(4px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
            transition={SPRING}
            className="flex flex-col sm:flex-row sm:items-center gap-5 sm:gap-8 rounded-[26px] p-6 bg-white/55 border border-white/80 ring-1 ring-brand-ink/[0.05]"
          >
            <Stepper
              valor={oferta.valor}
              min={ajuste.min}
              max={ajuste.max}
              paso={ajuste.paso}
              sufijo={ajuste.sufijo}
              onChange={onValor}
            />
            <p className="text-[13px] text-brand-ink/55 leading-relaxed sm:flex-1">{ajuste.consejo(oferta.valor)}</p>
          </motion.div>
        )}
        {oferta.tipo === 'beneficio' && (
          <motion.div
            key="beneficio"
            initial={reduce ? false : { opacity: 0, y: 12, filter: 'blur(4px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
            transition={SPRING}
            className="rounded-[26px] p-5 sm:p-6 bg-white/55 border border-white/80 ring-1 ring-brand-ink/[0.05] space-y-4"
          >
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-ink/45">
                ¿Qué gana tu cliente si paga en estas fechas?
              </span>
              <input
                autoFocus
                value={oferta.texto ?? ''}
                maxLength={80}
                onChange={(e) => onTexto(e.target.value)}
                placeholder="Ej. envío gratis en su próximo pedido"
                className="mt-2 w-full rounded-2xl bg-white/80 border border-white ring-1 ring-brand-ink/10 px-4 py-3 text-[15px] font-semibold text-brand-ink placeholder:font-normal placeholder:text-brand-ink/35 outline-none focus:ring-2 focus:ring-brand-gold/70 transition-shadow"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              {IDEAS_BENEFICIO.map((idea) => (
                <button
                  key={idea}
                  type="button"
                  onClick={() => onTexto(idea)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/70 ${
                    oferta.texto === idea
                      ? 'bg-brand-ink text-white'
                      : 'bg-white/60 text-brand-ink/65 ring-1 ring-brand-ink/[0.08] hover:bg-white hover:text-brand-ink'
                  }`}
                >
                  <Plus size={12} /> {idea.charAt(0).toUpperCase() + idea.slice(1)}
                </button>
              ))}
            </div>
            <p className="text-[12.5px] text-brand-ink/50 leading-relaxed">
              {oferta.texto?.trim() ? (
                <>
                  En el mensaje se lee: «…puede liquidar su saldo con{' '}
                  <span className="font-semibold text-brand-ink">{oferta.texto.trim()}</span>».
                </>
              ) : (
                'Escríbelo como se leería en el mensaje: «…puede liquidar su saldo con ___».'
              )}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
      {oferta.tipo !== 'ninguna' && (
        <div className="flex items-center justify-end gap-3">
          {!textoListo && <span className="text-[12px] text-brand-ink/45">Escribe el beneficio para continuar</span>}
          <BotonPrincipal onClick={onContinuar} disabled={!textoListo}>
            Continuar <ArrowRight size={15} />
          </BotonPrincipal>
        </div>
      )}
    </div>
  );
}

function PasoClientes({
  cfg,
  objetivo,
  modo,
  onModo,
  onClientes,
  onContinuar,
}: {
  cfg: CampanaConfig;
  objetivo: Objetivo;
  modo: 'sugeridos' | 'todos' | 'elegir' | null;
  onModo: (m: 'sugeridos' | 'todos' | 'elegir') => void;
  onClientes: (ids: string[]) => void;
  onContinuar: () => void;
}) {
  const reduce = useReducedMotion();
  const { cartera } = useCobranza();
  const abiertas = cartera.filter((c) => !c.saldada);
  const [buscar, setBuscar] = React.useState('');
  const nSug = sugeridos(abiertas, objetivo).length;
  const nTodos = abiertas.filter((c) => !bloqueo(c)).length;
  const visibles = abiertas.filter((c) => c.cliente.toLowerCase().includes(buscar.toLowerCase()));
  const monto = montoDe(abiertas, cfg.clientes);
  const criterio =
    objetivo === 'contactos'
      ? 'Todos los que tienen contacto registrado.'
      : objetivo === 'adelantar'
        ? 'Facturas por vencer, sin historial de esperar descuentos.'
        : objetivo === 'cierre'
          ? 'Todo lo vencido, sin historial de esperar descuentos.'
          : 'Más de 15 días vencidos, sin promesa vigente ni historial de esperar descuentos.';

  const alternar = (id: string) =>
    onClientes(cfg.clientes.includes(id) ? cfg.clientes.filter((x) => x !== id) : [...cfg.clientes, id]);

  return (
    <div className="space-y-5">
      <div role="radiogroup" className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <OpcionCard
          vertical grupo="clientes"
          activa={modo === 'sugeridos'}
          icono={<Sparkles size={18} />}
          titulo={`Sugeridos · ${nSug}`}
          detalle={criterio}
          onClick={() => onModo('sugeridos')}
        />
        <OpcionCard
          vertical grupo="clientes"
          activa={modo === 'todos'}
          icono={<Users size={18} />}
          titulo={`Todos · ${nTodos}`}
          detalle="Cualquiera con contacto de finanzas y sin disputa."
          onClick={() => onModo('todos')}
        />
        <OpcionCard
          vertical grupo="clientes"
          activa={modo === 'elegir'}
          icono={<ListChecks size={18} />}
          titulo="Elegir uno por uno"
          detalle="Tú decides a quién le llega."
          onClick={() => onModo('elegir')}
        />
      </div>

      <AnimatePresence initial={false}>
        {modo === 'elegir' && (
          <motion.div
            initial={reduce ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
            transition={SPRING_SUAVE}
            className="overflow-hidden"
          >
            <div className="rounded-[22px] bg-white/55 border border-white/80 ring-1 ring-brand-ink/[0.05] overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-brand-ink/[0.06]">
                <Search size={14} className="text-brand-ink/35" />
                <input
                  value={buscar}
                  onChange={(e) => setBuscar(e.target.value)}
                  placeholder="Buscar cliente"
                  aria-label="Buscar cliente"
                  className="flex-1 bg-transparent text-[13.5px] text-brand-ink placeholder:text-brand-ink/35 outline-none"
                />
                <span className="text-[12px] text-brand-ink/45 tabular-nums">{cfg.clientes.length} elegidos</span>
              </div>
              <ul className="max-h-[300px] overflow-y-auto divide-y divide-brand-ink/[0.05]">
                {visibles.map((c) => {
                  const motivo = bloqueo(c);
                  const marcado = cfg.clientes.includes(c.id);
                  const espera = c.comportamiento.esperaDescuentos;
                  return (
                    <li key={c.id}>
                      <label
                        className={`flex items-center gap-3 px-4 py-3 transition-colors ${motivo ? 'opacity-45 cursor-not-allowed' : 'cursor-pointer hover:bg-white/70'}`}
                      >
                        <input
                          type="checkbox"
                          checked={marcado}
                          disabled={!!motivo}
                          onChange={() => alternar(c.id)}
                          className="w-4 h-4 accent-[#06B6D4]"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="text-[13.5px] font-semibold text-brand-ink">{c.cliente}</span>
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md border ${SEGMENTOS[c.segmento].chip}`}>
                              {SEGMENTOS[c.segmento].nombre}
                            </span>
                            {espera && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-rose-50 text-rose-700">
                                <AlertTriangle size={10} /> Espera descuentos
                              </span>
                            )}
                          </span>
                          <span className="block text-[12px] text-brand-ink/45 mt-0.5">
                            {fmt(saldoDe(c))} · {c.dias > 0 ? `${c.dias} días vencida` : `vence en ${-c.dias} días`}
                            {motivo && ` · ${motivo}`}
                          </span>
                        </span>
                      </label>
                    </li>
                  );
                })}
                {!visibles.length && <li className="px-4 py-8 text-center text-[13px] text-brand-ink/45">Ningún cliente coincide.</li>}
              </ul>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {modo && (
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={SPRING}
          className="flex flex-col sm:flex-row sm:items-center gap-3"
        >
          <p className="text-[13px] text-brand-ink/60 sm:mr-auto">
            <span className="font-semibold text-brand-ink tabular-nums">{cfg.clientes.length}</span>{' '}
            {cfg.clientes.length === 1 ? 'cliente' : 'clientes'} ·{' '}
            <span className="font-semibold text-brand-ink tabular-nums">{fmt(monto)}</span> por cobrar
          </p>
          <BotonPrincipal onClick={onContinuar} disabled={!cfg.clientes.length}>
            Continuar <ArrowRight size={15} />
          </BotonPrincipal>
        </motion.div>
      )}
    </div>
  );
}

// ── Piezas chicas ─────────────────────────────────────────────────────

function VistaMensaje({ canal, texto, para, aprobada }: { canal: 'WhatsApp' | 'Correo'; texto: string; para?: string; aprobada: boolean }) {
  const reduce = useReducedMotion();
  return (
    <div className="rounded-[26px] p-5 bg-gradient-to-br from-white/70 to-white/40 border border-white/80 ring-1 ring-brand-ink/[0.05]">
      <div className="flex items-center justify-between gap-3 mb-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-ink/45">
          Así le llega{para ? ` a ${para}` : ''}
        </span>
        <span className={`text-[11px] font-semibold ${aprobada ? 'text-emerald-700' : 'text-amber-700'}`}>
          {aprobada ? 'Plantilla aprobada' : 'Plantilla en revisión'}
        </span>
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={canal}
          initial={reduce ? false : { opacity: 0, y: 10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }}
          transition={SPRING}
        >
          {canal === 'WhatsApp' ? (
            <div className="max-w-[440px] rounded-[20px] rounded-tl-md bg-white px-4 py-3 shadow-[0_6px_20px_-10px_rgba(17,24,39,0.3)]">
              <p className="text-[13.5px] text-brand-ink/85 leading-relaxed">{texto}</p>
              <span className="block text-right text-[10px] text-brand-ink/35 mt-1">10:30</span>
            </div>
          ) : (
            <div className="rounded-[18px] bg-white px-5 py-4 shadow-[0_6px_20px_-10px_rgba(17,24,39,0.3)]">
              <div className="text-[11px] text-brand-ink/40 border-b border-brand-ink/[0.06] pb-2 mb-2">
                Para: tesorería{para ? ` · ${para}` : ''}
              </div>
              <p className="text-[13.5px] text-brand-ink/85 leading-relaxed">{texto}</p>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/** A quién le llega exactamente (y a quién no, con el motivo). */
function Destinatarios({ elegidos }: { elegidos: ReturnType<typeof useCobranza>['cartera'] }) {
  const [abierto, setAbierto] = React.useState(false);
  const noLlega = elegidos.filter((c) => !c.contactable || bloqueo(c));
  const llega = elegidos.filter((c) => !noLlega.includes(c));
  if (!elegidos.length) return null;
  return (
    <div className="rounded-[22px] bg-white/60 border border-white/80 ring-1 ring-brand-ink/[0.05]">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        className="w-full flex items-center justify-between gap-3 px-5 py-3.5 text-left"
      >
        <span className="text-[13px] font-semibold text-brand-ink">
          Le llega a {llega.length} {llega.length === 1 ? 'cliente' : 'clientes'}
          {noLlega.length > 0 && <span className="font-normal text-amber-700"> · {noLlega.length} no la recibirán</span>}
        </span>
        <span className="text-[12px] font-semibold text-cyan-700">{abierto ? 'Ocultar' : 'Ver la lista'}</span>
      </button>
      <AnimatePresence initial={false}>
        {abierto && (
          <motion.ul
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={SPRING_SUAVE}
            className="overflow-hidden border-t border-brand-ink/[0.06] max-h-[260px] overflow-y-auto"
          >
            {[...llega, ...noLlega].map((c) => {
              const motivo = !c.contactable ? (c.motivo ?? 'Contacto en pausa') : bloqueo(c);
              return (
                <li key={c.id} className="flex items-center justify-between gap-3 px-5 py-2 text-[12.5px]">
                  <span className={motivo ? 'text-brand-ink/45' : 'text-brand-ink'}>{c.cliente}</span>
                  <span className={`text-right ${motivo ? 'text-amber-700' : 'text-brand-ink/50'}`}>
                    {motivo ?? `${c.finanzas?.nombre ?? ''} · ${c.finanzas?.telefono ?? ''}`}
                  </span>
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

function Cifra({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="min-w-0 rounded-[22px] px-4 sm:px-5 py-4 bg-white/60 border border-white/80 ring-1 ring-brand-ink/[0.05]">
      <div className="text-[12px] text-brand-ink/50">{label}</div>
      <div className="text-xl sm:text-3xl font-semibold tracking-tight text-brand-ink tabular-nums mt-1 truncate" title={valor}>
        {valor}
      </div>
    </div>
  );
}

function Aviso({ tono, icono, children }: { tono: 'info' | 'alerta' | 'riesgo'; icono: React.ReactNode; children: React.ReactNode }) {
  const estilo =
    tono === 'info'
      ? 'bg-brand-gold/10 text-cyan-800'
      : tono === 'alerta'
        ? 'bg-amber-500/10 text-amber-800'
        : 'bg-rose-500/10 text-rose-800';
  return (
    <li className={`flex items-start gap-2.5 rounded-2xl px-4 py-3 text-[13px] leading-relaxed ${estilo}`}>
      <span className="mt-0.5 shrink-0">{icono}</span>
      <span>{children}</span>
    </li>
  );
}
