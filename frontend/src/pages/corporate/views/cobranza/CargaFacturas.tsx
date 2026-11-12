import React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  ArrowRight,
  Check,
  CircleSlash,
  FileText,
  FileUp,
  Loader2,
  RotateCcw,
  Sparkles,
  UploadCloud,
  UserCheck,
  X,
} from 'lucide-react';
import { CURRENCY_FORMATTER } from '../../../../utils/format.ts';
import {
  api,
  type FilaRevisionCfdi,
  type ResultadoCargaCfdi,
  type RevisionCfdi,
} from '../../../../services/apiClient.ts';
import { useCobranza } from './store.tsx';
import { saldoDe } from './mockV1.ts';
import { SPRING, SPRING_SUAVE } from './campanasUi.tsx';
import { BTN_PRI, BTN_SEC } from './clientes.tsx';
import { Subpestanas, useConfirmar } from './vidrio.tsx';

/**
 * Subir facturas (XML o ZIP del ERP/SAT). El backend lee cada CFDI y lo liga
 * a su cliente por RFC o, si no, por nombre. Antes de guardar se revisa:
 * lo que empató solo, lo que necesita que elijas cliente y lo que no se carga.
 */

const fmt = (n: number) => CURRENCY_FORMATTER.format(n);
type Fase = 'elegir' | 'revisando' | 'revisar' | 'guardando' | 'listo';
type FiltroRev = 'todas' | 'listas' | 'revisar' | 'fuera';

export function CargaFacturas({ onVerClientes }: { onVerClientes?: () => void }) {
  const reduce = useReducedMotion();
  const { cartera, fuente, recargarCartera } = useCobranza();
  const ejemplo = fuente !== 'real';
  const { confirmar, nodo } = useConfirmar();
  const [fase, setFase] = React.useState<Fase>('elegir');
  const [archivos, setArchivos] = React.useState<File[]>([]);
  const [revision, setRevision] = React.useState<RevisionCfdi | null>(null);
  // uuid → cliente elegido (id) o null (omitir). Parte del empate automático.
  const [asignado, setAsignado] = React.useState<Record<string, string | null>>({});
  const [filtro, setFiltro] = React.useState<FiltroRev>('todas');
  const [resultado, setResultado] = React.useState<ResultadoCargaCfdi | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [arrastrando, setArrastrando] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const clientes = React.useMemo(
    () =>
      cartera
        .map((c) => ({ id: ejemplo ? c.id : c.dbId ?? c.id, nombre: c.cliente, rfc: c.datos?.rfc ?? '' }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    [cartera, ejemplo],
  );
  const nombreDe = (id: string) => clientes.find((c) => c.id === id)?.nombre ?? 'Cliente';

  const agregar = (lista: FileList | File[]) => {
    const validos = [...lista].filter((f) => /\.(xml|zip)$/i.test(f.name));
    const ignorados = [...lista].length - validos.length;
    setError(ignorados ? `${ignorados} ${ignorados === 1 ? 'archivo no es' : 'archivos no son'} XML ni ZIP y se ignoraron.` : null);
    setArchivos((prev) => {
      const ya = new Set(prev.map((f) => `${f.name}-${f.size}`));
      return [...prev, ...validos.filter((f) => !ya.has(`${f.name}-${f.size}`))];
    });
  };

  const revisar = async () => {
    setFase('revisando');
    setError(null);
    try {
      const r = ejemplo ? simularRevision(archivos, cartera) : await api.previewReceivablesCfdi(archivos);
      const inicial: Record<string, string | null> = {};
      r.filas.forEach((f) => {
        if (f.uuid && f.cliente) inicial[f.uuid] = f.cliente.id;
      });
      setRevision(r);
      setAsignado(inicial);
      setFiltro(r.resumen.sinMatch ? 'revisar' : 'todas');
      setFase('revisar');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pudimos leer las facturas.');
      setFase('elegir');
    }
  };

  const filas = revision?.filas ?? [];
  const cargables = filas.filter((f) => f.uuid && (f.estado === 'por_rfc' || f.estado === 'por_nombre' || f.estado === 'sin_match'));
  const aCargar = cargables.filter((f) => asignado[f.uuid!]);
  const pendientes = cargables.filter((f) => f.estado === 'sin_match' && asignado[f.uuid!] === undefined);
  const clientesDestino = new Set(aCargar.map((f) => asignado[f.uuid!]));
  const montoACargar = aCargar.reduce((s, f) => s + (f.total ?? 0), 0);
  const rfcsNuevos = aCargar.filter((f) => f.actualizaRfc || (f.estado === 'sin_match' && f.rfcReceptor)).length;

  const visibles = filas.filter((f) =>
    filtro === 'todas'
      ? true
      : filtro === 'listas'
        ? (f.estado === 'por_rfc' || f.estado === 'por_nombre') && !!asignado[f.uuid!]
        : filtro === 'revisar'
          ? f.estado === 'sin_match' || (!!f.uuid && asignado[f.uuid] === null)
          : f.estado === 'duplicada' || f.estado === 'error',
  );

  const guardar = () =>
    confirmar({
      titulo: `¿Cargar ${aCargar.length} ${aCargar.length === 1 ? 'factura' : 'facturas'}?`,
      accion: `Cargar ${aCargar.length}`,
      mensaje: (
        <div className="space-y-2">
          <p>
            Se agregan <b className="text-brand-ink">{fmt(montoACargar)}</b> por cobrar a{' '}
            <b className="text-brand-ink">{clientesDestino.size}</b> {clientesDestino.size === 1 ? 'cliente' : 'clientes'}. Su plan de cobranza se
            calcula con los días de crédito de cada cliente.
          </p>
          {pendientes.length > 0 && (
            <p className="text-amber-800">
              {pendientes.length} {pendientes.length === 1 ? 'factura queda' : 'facturas quedan'} sin cliente y no se cargan.
            </p>
          )}
          {ejemplo && <p className="text-brand-ink/50">Estás en datos de ejemplo: es una simulación, no se guarda nada.</p>}
        </div>
      ),
      alConfirmar: async () => {
        setFase('guardando');
        const envio: Record<string, string | null> = {};
        cargables.forEach((f) => (envio[f.uuid!] = asignado[f.uuid!] ?? null));
        try {
          const r = ejemplo
            ? { total: filas.length, creadas: aCargar.length, clientes: clientesDestino.size, rfcActualizados: rfcsNuevos, omitidas: [] }
            : await api.confirmReceivablesCfdi(archivos, envio);
          if (!ejemplo) await recargarCartera();
          setResultado(r);
          setFase('listo');
        } catch (e) {
          setFase('revisar');
          return e instanceof Error ? e.message : 'No se pudieron cargar.';
        }
      },
    });

  const reiniciar = () => {
    setArchivos([]);
    setRevision(null);
    setAsignado({});
    setResultado(null);
    setError(null);
    setFase('elegir');
  };

  return (
    <div className="space-y-4">
      <AnimatePresence mode="wait" initial={false}>
        {/* ── 1 · Elegir archivos ── */}
        {(fase === 'elegir' || fase === 'revisando') && (
          <motion.div
            key="elegir"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
            transition={SPRING_SUAVE}
            className="glass rounded-[28px] p-5 sm:p-7"
          >
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setArrastrando(true);
              }}
              onDragLeave={() => setArrastrando(false)}
              onDrop={(e) => {
                e.preventDefault();
                setArrastrando(false);
                agregar(e.dataTransfer.files);
              }}
              className={`relative rounded-[24px] border-2 border-dashed px-6 py-10 sm:py-14 text-center transition-colors ${
                arrastrando ? 'border-brand-gold bg-brand-gold/[0.07]' : 'border-brand-ink/12 bg-white/30'
              }`}
            >
              <motion.span
                animate={reduce ? undefined : { y: arrastrando ? -6 : 0, scale: arrastrando ? 1.08 : 1 }}
                transition={SPRING}
                className="mx-auto w-14 h-14 rounded-2xl bg-brand-ink text-brand-gold flex items-center justify-center shadow-[0_14px_30px_-12px_rgba(17,24,39,0.6)]"
              >
                <UploadCloud size={24} />
              </motion.span>
              <p className="text-lg font-semibold text-brand-ink tracking-tight mt-5">
                {arrastrando ? 'Suelta tus facturas aquí' : 'Arrastra tus facturas aquí'}
              </p>
              <p className="text-[13px] text-brand-ink/50 mt-1 max-w-[52ch] mx-auto leading-relaxed">
                XML sueltos o un ZIP con todo el mes. Leemos el RFC y el nombre del cliente de cada factura y la ligamos sola. Antes
                de guardar, revisas.
              </p>
              <button type="button" onClick={() => inputRef.current?.click()} className={BTN_SEC + ' mt-5 !px-4 !py-2 !text-[12.5px]'}>
                <FileUp size={13} /> Elegir archivos
              </button>
              <input
                ref={inputRef}
                type="file"
                multiple
                accept=".xml,.zip,text/xml,application/zip"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) agregar(e.target.files);
                  e.target.value = '';
                }}
              />
            </div>

            <AnimatePresence initial={false}>
              {archivos.length > 0 && (
                <motion.div
                  initial={reduce ? false : { opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={SPRING_SUAVE}
                  className="overflow-hidden"
                >
                  <div className="flex flex-wrap gap-2 pt-5">
                    {archivos.slice(0, 12).map((f) => (
                      <span key={`${f.name}-${f.size}`} className="glass-suave inline-flex items-center gap-1.5 rounded-full pl-3 pr-1.5 py-1 text-[12px] text-brand-ink/70">
                        <FileText size={12} className="text-brand-ink/40" />
                        <span className="max-w-[180px] truncate">{f.name}</span>
                        <button
                          type="button"
                          aria-label={`Quitar ${f.name}`}
                          onClick={() => setArchivos((a) => a.filter((x) => x !== f))}
                          className="w-5 h-5 rounded-full flex items-center justify-center text-brand-ink/40 hover:text-brand-ink hover:bg-white"
                        >
                          <X size={11} />
                        </button>
                      </span>
                    ))}
                    {archivos.length > 12 && <span className="text-[12px] text-brand-ink/45 self-center">y {archivos.length - 12} más</span>}
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-3 mt-5">
                    <span className="text-[12.5px] text-brand-ink/50 mr-auto">
                      {archivos.length} {archivos.length === 1 ? 'archivo' : 'archivos'} ·{' '}
                      {(archivos.reduce((s, f) => s + f.size, 0) / 1024 / 1024).toFixed(1)} MB
                    </span>
                    <button type="button" onClick={() => setArchivos([])} className={BTN_SEC + ' !py-2.5 !px-4'}>
                      Quitar todo
                    </button>
                    <button type="button" onClick={() => void revisar()} disabled={fase === 'revisando'} className={BTN_PRI}>
                      {fase === 'revisando' ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                      {fase === 'revisando' ? 'Leyendo facturas…' : 'Revisar facturas'}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            {error && <p className="mt-4 text-[12.5px] text-amber-800 bg-amber-500/10 rounded-2xl px-4 py-2.5">{error}</p>}
            {ejemplo && (
              <p className="mt-4 text-[12px] text-brand-ink/45">
                Estás viendo datos de ejemplo: la revisión se simula con tu cartera de ejemplo y no se guarda nada.
              </p>
            )}
          </motion.div>
        )}

        {/* ── 2 · Revisar ── */}
        {(fase === 'revisar' || fase === 'guardando') && revision && (
          <motion.div
            key="revisar"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
            transition={SPRING_SUAVE}
            className="space-y-4"
          >
            {/* Resumen */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Resumen n={revision.resumen.porRfc} titulo="Ligadas por RFC" tono="ok" />
              <Resumen n={revision.resumen.porNombre} titulo="Ligadas por nombre" tono="ok" nota="se guarda su RFC" />
              <Resumen n={revision.resumen.sinMatch} titulo="Elige el cliente" tono={revision.resumen.sinMatch ? 'alerta' : 'neutro'} />
              <Resumen
                n={revision.resumen.duplicadas + revision.resumen.errores}
                titulo="No se cargan"
                tono="neutro"
                nota={revision.resumen.duplicadas ? `${revision.resumen.duplicadas} ya estaban` : undefined}
              />
            </div>

            <div className="glass rounded-[28px] overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 px-5 sm:px-6 pt-5 pb-4">
                <Subpestanas
                  grupo="revision-cfdi"
                  etiqueta="Filtrar la revisión"
                  valor={filtro}
                  onChange={setFiltro}
                  opciones={[
                    { id: 'todas', nombre: 'Todas', n: filas.length },
                    { id: 'listas', nombre: 'Listas', n: revision.resumen.porRfc + revision.resumen.porNombre },
                    { id: 'revisar', nombre: 'Por revisar', n: pendientes.length, alerta: true },
                    { id: 'fuera', nombre: 'No se cargan', n: revision.resumen.duplicadas + revision.resumen.errores },
                  ]}
                />
                <button type="button" onClick={reiniciar} className={BTN_SEC}>
                  <RotateCcw size={12} /> Empezar de nuevo
                </button>
              </div>
              <ul className="max-h-[520px] overflow-y-auto px-3 sm:px-4 pb-4 space-y-2">
                <AnimatePresence initial={false}>
                  {visibles.map((f, i) => (
                    <FilaRevision
                      key={f.uuid ?? `${f.archivo}-${i}`}
                      f={f}
                      clientes={clientes}
                      asignado={f.uuid ? asignado[f.uuid] : undefined}
                      nombreDe={nombreDe}
                      onAsignar={(id) => f.uuid && setAsignado((a) => ({ ...a, [f.uuid!]: id }))}
                    />
                  ))}
                </AnimatePresence>
                {!visibles.length && (
                  <li className="text-center text-[13px] text-brand-ink/45 py-10">
                    {filtro === 'revisar' ? 'Nada por revisar. Todo quedó ligado a su cliente.' : 'No hay facturas en este grupo.'}
                  </li>
                )}
              </ul>

              {/* Barra de acción */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 sm:px-6 py-4 border-t border-white/70 bg-white/45">
                <p className="text-[13px] text-brand-ink/60 sm:mr-auto">
                  <b className="text-brand-ink tabular-nums">{aCargar.length}</b> {aCargar.length === 1 ? 'factura' : 'facturas'} ·{' '}
                  <b className="text-brand-ink tabular-nums">{fmt(montoACargar)}</b> a {clientesDestino.size}{' '}
                  {clientesDestino.size === 1 ? 'cliente' : 'clientes'}
                  {pendientes.length > 0 && <span className="text-amber-700"> · {pendientes.length} sin cliente</span>}
                </p>
                <button type="button" onClick={guardar} disabled={!aCargar.length || fase === 'guardando'} className={BTN_PRI}>
                  {fase === 'guardando' ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  Cargar {aCargar.length} {aCargar.length === 1 ? 'factura' : 'facturas'}
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── 3 · Listo ── */}
        {fase === 'listo' && resultado && (
          <motion.div
            key="listo"
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={SPRING_SUAVE}
            className="glass rounded-[28px] p-6 sm:p-8 text-center"
          >
            <motion.span
              initial={reduce ? false : { scale: 0.4, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ ...SPRING, delay: 0.1 }}
              className="mx-auto w-14 h-14 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-[0_14px_30px_-10px_rgba(16,185,129,0.7)]"
            >
              <Check size={26} strokeWidth={2.5} />
            </motion.span>
            <h3 className="text-2xl text-brand-ink tracking-tight mt-5">
              {resultado.creadas} {resultado.creadas === 1 ? 'factura cargada' : 'facturas cargadas'}
            </h3>
            <p className="text-[13.5px] text-brand-ink/55 mt-1">
              En {resultado.clientes} {resultado.clientes === 1 ? 'cliente' : 'clientes'}
              {resultado.rfcActualizados > 0 && ` · ${resultado.rfcActualizados} ${resultado.rfcActualizados === 1 ? 'RFC actualizado' : 'RFC actualizados'}`}
              {ejemplo && ' · simulación con datos de ejemplo'}
            </p>
            {resultado.omitidas.length > 0 && (
              <div className="glass-suave rounded-2xl text-left mt-5 max-w-lg mx-auto px-4 py-3">
                <p className="text-[12px] font-semibold text-brand-ink/70">{resultado.omitidas.length} no se cargaron</p>
                <ul className="mt-1.5 space-y-1 max-h-40 overflow-y-auto">
                  {resultado.omitidas.map((o) => (
                    <li key={o.archivo} className="text-[12px] text-brand-ink/50">
                      <span className="text-brand-ink/70">{o.archivo}</span> · {o.motivo}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex flex-wrap justify-center gap-2 mt-6">
              <button type="button" onClick={reiniciar} className={BTN_SEC + ' !py-2.5 !px-4'}>
                <FileUp size={13} /> Subir más facturas
              </button>
              {onVerClientes && (
                <button type="button" onClick={onVerClientes} className={BTN_PRI}>
                  Ver clientes <ArrowRight size={14} />
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {nodo}
    </div>
  );
}

// ── Piezas ─────────────────────────────────────────────────────────────

function Resumen({ n, titulo, nota, tono }: { n: number; titulo: string; nota?: string; tono: 'ok' | 'alerta' | 'neutro' }) {
  const color = tono === 'ok' ? 'text-emerald-700' : tono === 'alerta' ? 'text-amber-700' : 'text-brand-ink/60';
  return (
    <div className="glass rounded-[22px] px-4 py-4">
      <div className={`text-[26px] font-semibold tracking-tight tabular-nums leading-none ${color}`}>{n}</div>
      <div className="text-[12.5px] text-brand-ink/65 mt-2">{titulo}</div>
      {nota && <div className="text-[11px] text-brand-ink/40 mt-0.5">{nota}</div>}
    </div>
  );
}

function FilaRevision({
  f,
  clientes,
  asignado,
  nombreDe,
  onAsignar,
}: {
  key?: string;
  f: FilaRevisionCfdi;
  clientes: { id: string; nombre: string; rfc: string }[];
  /** id elegido, null = omitida, undefined = sin decidir. */
  asignado: string | null | undefined;
  nombreDe: (id: string) => string;
  onAsignar: (id: string | null) => void;
}) {
  const reduce = useReducedMotion();
  const [cambiando, setCambiando] = React.useState(false);
  const fuera = f.estado === 'duplicada' || f.estado === 'error';
  const listo = !!asignado;
  const icono = fuera ? (
    <CircleSlash size={15} />
  ) : listo ? (
    <Check size={15} strokeWidth={2.5} />
  ) : asignado === null ? (
    <X size={15} />
  ) : (
    <UserCheck size={15} />
  );
  const tonoIcono = fuera
    ? 'bg-brand-ink/[0.05] text-brand-ink/35'
    : listo
      ? 'bg-emerald-500/12 text-emerald-700'
      : asignado === null
        ? 'bg-brand-ink/[0.05] text-brand-ink/40'
        : 'bg-amber-500/15 text-amber-700';

  return (
    <motion.li
      layout={!reduce}
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={SPRING}
      className={`glass-suave rounded-[20px] px-4 py-3.5 flex flex-col md:flex-row md:items-center gap-3 ${fuera ? 'opacity-70' : ''}`}
    >
      <div className="flex items-start gap-3 min-w-0 md:flex-1">
        <span className={`mt-0.5 shrink-0 w-8 h-8 rounded-xl flex items-center justify-center ${tonoIcono}`}>{icono}</span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-[14px] font-semibold text-brand-ink">{f.folio ?? f.archivo}</span>
            {f.total !== undefined && <span className="text-[13px] font-semibold text-brand-ink/80 tabular-nums">{fmt(f.total)}</span>}
            {f.fecha && <span className="text-[12px] text-brand-ink/40">{f.fecha}</span>}
            {f.metodoPago && <span className="text-[10.5px] font-semibold text-brand-ink/45 bg-brand-ink/[0.05] rounded-md px-1.5 py-0.5">{f.metodoPago}</span>}
          </div>
          <div className="text-[12px] text-brand-ink/50 truncate mt-0.5">
            {f.nombreReceptor ?? 'Sin nombre'} {f.rfcReceptor && <span className="font-mono text-[11px]">· {f.rfcReceptor}</span>}
          </div>
          {fuera && <div className="text-[12px] text-brand-ink/50 mt-0.5">{f.motivo}</div>}
        </div>
      </div>

      {!fuera && (
        <div className="md:w-[46%] flex flex-col items-stretch md:items-end gap-2">
          {listo && !cambiando ? (
            <div className="flex flex-wrap items-center gap-2 md:justify-end">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 ring-1 ring-brand-ink/[0.08] pl-2.5 pr-3 py-1 text-[12.5px] font-semibold text-brand-ink max-w-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                <span className="truncate">{nombreDe(asignado!)}</span>
              </span>
              <span className="text-[11px] text-brand-ink/40">
                {f.estado === 'por_rfc' && asignado === f.cliente?.id
                  ? 'por RFC'
                  : f.estado === 'por_nombre' && asignado === f.cliente?.id
                    ? f.actualizaRfc
                      ? 'por nombre · se guarda su RFC'
                      : 'por nombre'
                    : 'elegido por ti'}
              </span>
              <button type="button" onClick={() => setCambiando(true)} className="text-[12px] font-semibold text-brand-ink/45 hover:text-cyan-700">
                Cambiar
              </button>
            </div>
          ) : (
            <>
              {!!f.sugerencias?.length && !cambiando && (
                <div className="flex flex-wrap gap-1.5 md:justify-end">
                  <span className="text-[11px] text-brand-ink/40 self-center">¿Es…?</span>
                  {f.sugerencias.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => onAsignar(s.id)}
                      className="inline-flex items-center gap-1.5 rounded-full bg-white/75 ring-1 ring-brand-ink/10 hover:ring-brand-gold hover:bg-white px-3 py-1 text-[12px] font-semibold text-brand-ink transition-colors"
                    >
                      {s.nombre} <span className="text-brand-ink/40 tabular-nums">{s.parecido}%</span>
                    </button>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2 md:justify-end">
                <select
                  value={asignado ?? ''}
                  onChange={(e) => {
                    onAsignar(e.target.value || null);
                    setCambiando(false);
                  }}
                  aria-label={`Cliente de ${f.folio ?? f.archivo}`}
                  className="glass-campo rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold text-brand-ink outline-none max-w-[260px]"
                >
                  <option value="">{asignado === null ? 'Omitida' : 'Elegir cliente…'}</option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                      {c.rfc ? ` · ${c.rfc}` : ''}
                    </option>
                  ))}
                </select>
                {asignado !== null && (
                  <button type="button" onClick={() => onAsignar(null)} className="text-[12px] font-semibold text-brand-ink/45 hover:text-rose-600">
                    Omitir
                  </button>
                )}
                {cambiando && (
                  <button type="button" onClick={() => setCambiando(false)} className="text-[12px] font-semibold text-brand-ink/45 hover:text-brand-ink">
                    Listo
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </motion.li>
  );
}

/**
 * Datos de ejemplo: arma una revisión creíble con la cartera de ejemplo para
 * poder probar el flujo sin cuenta real. No toca el servidor.
 */
function simularRevision(archivos: File[], cartera: ReturnType<typeof useCobranza>['cartera']): RevisionCfdi {
  const n = Math.max(archivos.length, 6);
  const filas: FilaRevisionCfdi[] = Array.from({ length: n }, (_, i) => {
    const c = cartera[i % cartera.length];
    const uuid = `EJEMPLO-${String(i + 1).padStart(4, '0')}-${Date.now().toString(36)}`;
    const base = {
      archivo: archivos[i]?.name ?? `factura-${i + 1}.xml`,
      uuid,
      folio: `F-${3100 + i}`,
      total: Math.round(saldoDe(c) / 2 / 100) * 100 || 25_000,
      moneda: 'MXN',
      fecha: '2026-10-0' + ((i % 9) + 1),
      metodoPago: (i % 3 ? 'PPD' : 'PUE') as 'PPD' | 'PUE',
      rfcReceptor: c.datos?.rfc ?? `EJE0${i}0101AB${i % 10}`,
      nombreReceptor: `${c.cliente} S.A. de C.V.`,
      sugerencias: [] as FilaRevisionCfdi['sugerencias'],
    };
    const tipo = i % 6;
    if (tipo === 3) {
      return {
        ...base,
        estado: 'sin_match' as const,
        nombreReceptor: `${c.cliente.split(' ')[0]} Comercial`,
        cliente: null,
        sugerencias: [{ id: c.id, nombre: c.cliente, rfc: c.datos?.rfc ?? '', parecido: 67 }],
      };
    }
    if (tipo === 5) return { ...base, estado: 'duplicada' as const, motivo: `Ya está registrada en ${c.cliente}.` };
    return {
      ...base,
      estado: tipo === 1 ? ('por_nombre' as const) : ('por_rfc' as const),
      cliente: { id: c.id, nombre: c.cliente, rfc: c.datos?.rfc ?? '' },
      actualizaRfc: tipo === 1,
    };
  });
  const cuenta = (e: FilaRevisionCfdi['estado']) => filas.filter((f) => f.estado === e).length;
  return {
    total: filas.length,
    resumen: { porRfc: cuenta('por_rfc'), porNombre: cuenta('por_nombre'), sinMatch: cuenta('sin_match'), duplicadas: cuenta('duplicada'), errores: cuenta('error') },
    filas,
  };
}
