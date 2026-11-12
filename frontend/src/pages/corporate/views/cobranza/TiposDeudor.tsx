import React from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleOff,
  CloudUpload,
  FileDown,
  FileSpreadsheet,
  HandCoins,
  Loader2,
  Plus,
  RotateCcw,
  Scale,
  Search,
  SearchX,
  Sparkles,
  Workflow,
  X,
} from 'lucide-react';
import { SPRING, SPRING_SUAVE, BotonPrincipal, BotonSecundario } from './campanasUi.tsx';
import { Subpestanas } from './vidrio.tsx';
import { useCobranza, type CuentaViva, type TiposDeudorEstado } from './store.tsx';
import { CAUSAS, TIPOS_DEUDOR, tipoDeudor, type CausaDeudor, type TipoDeudor } from './catalogoDeudores.ts';

// Tipos de deudor: el análisis de la consultoría dice qué tipo de deudor es
// cada cliente; aquí se importa, se revisa el empate y se activan los tipos.
// Por ahora todo pasa en pantalla: el backend hará el análisis y el empate.

// ── Piezas compartidas ────────────────────────────────────────────────

const ICONO_CAUSA: Record<CausaDeudor, typeof HandCoins> = {
  nopuede: HandCoins,
  noquiere: CircleOff,
  friccion: Workflow,
  desacuerdo: Scale,
  riesgo: SearchX,
};

export function IconoCausa({ causa, size = 'md' }: { causa: CausaDeudor; size?: 'sm' | 'md' | 'lg' }) {
  const Icono = ICONO_CAUSA[causa];
  const c = CAUSAS[causa].color;
  const caja = size === 'lg' ? 'w-14 h-14 rounded-[20px]' : size === 'sm' ? 'w-8 h-8 rounded-xl' : 'w-11 h-11 rounded-2xl';
  return (
    <span
      className={`${caja} shrink-0 flex items-center justify-center`}
      style={{ background: `linear-gradient(145deg, rgb(${c} / 0.2), rgb(${c} / 0.06))`, color: `rgb(${c})`, boxShadow: `inset 0 0 0 1px rgb(${c} / 0.22)` }}
    >
      <Icono size={size === 'lg' ? 24 : size === 'sm' ? 15 : 19} />
    </span>
  );
}

export function ChipCausa({ causa }: { causa: CausaDeudor }) {
  const c = CAUSAS[causa].color;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
      style={{ background: `rgb(${c} / 0.1)`, color: `rgb(${c})` }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: `rgb(${c})` }} />
      {CAUSAS[causa].nombre}
    </span>
  );
}

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\b(s\.?a\.?|de|c\.?v\.?|sapi|s\.? de r\.?l\.?|rl)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

// ── Empate (simulado en el navegador mientras llega el backend) ───────

type Confianza = 'alta' | 'revisar';
type Fila = { cuentaId: string | null; nombre: string; tipo: string | null; confianza: Confianza };

/** Tipo sugerido según cómo ha pagado (mientras no hay archivo real). */
const POR_SEGMENTO: Record<CuentaViva['segmento'], { tipo: string; confianza: Confianza } | null> = {
  puntual: { tipo: 'corporativo-con-plazos-impuestos-b2b', confianza: 'revisar' },
  tardio: { tipo: 'burocratico-b2b', confianza: 'alta' },
  olvidadizo: { tipo: 'desorganizado-b2b', confianza: 'alta' },
  deterioro: { tipo: 'dependiente-de-su-cobranza-b2b', confianza: 'revisar' },
  moroso: { tipo: 'priorizador-b2b', confianza: 'alta' },
  disputa: { tipo: 'disputador-b2b', confianza: 'alta' },
  nuevo: null,
};

/** Tipo de deudor que le corresponde por su historial de pagos (antes de importar el análisis). */
export function tipoSugerido(c: CuentaViva): string | null {
  return c.comportamiento.esperaDescuentos ? 'intencional-b2b' : (POR_SEGMENTO[c.segmento]?.tipo ?? null);
}

function empateDeEjemplo(cartera: CuentaViva[]): Fila[] {
  return cartera.map((c) => {
    const s = c.comportamiento.esperaDescuentos ? { tipo: 'intencional-b2b', confianza: 'revisar' as const } : POR_SEGMENTO[c.segmento];
    return { cuentaId: c.id, nombre: c.cliente, tipo: s?.tipo ?? null, confianza: s?.confianza ?? 'revisar' };
  });
}

/** Lee un CSV sencillo: columnas de cliente (o RFC) y tipo de deudor. */
function empateDeCsv(texto: string, cartera: CuentaViva[]): Fila[] | null {
  const lineas = texto.split(/\r?\n/).filter((l) => l.trim());
  if (lineas.length < 2) return null;
  const sep = (lineas[0].match(/;/g)?.length ?? 0) > (lineas[0].match(/,/g)?.length ?? 0) ? ';' : ',';
  const partir = (l: string) => l.split(sep).map((x) => x.trim().replace(/^"|"$/g, ''));
  const cab = partir(lineas[0]).map(fold);
  const iNombre = cab.findIndex((h) => /cliente|nombre|razon/.test(h));
  const iRfc = cab.findIndex((h) => h === 'rfc');
  const iTipo = cab.findIndex((h) => /tipo|deudor|segmento|perfil/.test(h));
  if (iTipo < 0 || (iNombre < 0 && iRfc < 0)) return null;
  return lineas.slice(1).map((l) => {
    const col = partir(l);
    const nombre = col[iNombre] ?? col[iRfc] ?? '';
    const rfc = iRfc >= 0 ? col[iRfc]?.toUpperCase() : '';
    const porRfc = rfc ? cartera.find((c) => c.datos?.rfc?.toUpperCase() === rfc) : undefined;
    const n = fold(nombre);
    const porNombre = !porRfc && n ? cartera.find((c) => fold(c.cliente) === n) ?? cartera.find((c) => fold(c.cliente).includes(n) || n.includes(fold(c.cliente))) : undefined;
    const cuenta = porRfc ?? porNombre;
    const t = fold(col[iTipo] ?? '');
    const tipo =
      TIPOS_DEUDOR.find((x) => fold(x.name) === t && x.seg === 'B2B') ??
      TIPOS_DEUDOR.find((x) => fold(x.name) === t) ??
      TIPOS_DEUDOR.find((x) => t && (fold(x.name).includes(t) || t.includes(fold(x.name))));
    const exacto = !!porRfc || (!!porNombre && fold(porNombre.cliente) === n);
    return {
      cuentaId: cuenta?.id ?? null,
      nombre: cuenta?.cliente ?? nombre,
      tipo: tipo?.id ?? null,
      confianza: cuenta && tipo && exacto ? 'alta' : 'revisar',
    };
  });
}

function formatoCsv(cartera: CuentaViva[]) {
  const filas = ['cliente,rfc,tipo_deudor', ...cartera.map((c) => `"${c.cliente}",${c.datos?.rfc ?? ''},`)];
  const blob = new Blob([filas.join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'formato-tipos-de-deudor.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

// ── Asistente ─────────────────────────────────────────────────────────

type Paso = 'subir' | 'revisar' | 'tipos' | 'listo';
const PASOS: { id: Paso; nombre: string; pregunta: string }[] = [
  { id: 'subir', nombre: 'Análisis', pregunta: 'Sube el análisis de tu cartera' },
  { id: 'revisar', nombre: 'Empate', pregunta: 'Revisa a quién le tocó qué' },
  { id: 'tipos', nombre: 'Tipos', pregunta: 'Tus tipos de deudor' },
  { id: 'listo', nombre: 'Listo', pregunta: 'Listo' },
];

export function AsistenteTiposDeudor({ onCerrar, onVerPlantillas }: { onCerrar: () => void; onVerPlantillas?: () => void }) {
  const reduce = useReducedMotion();
  const { cartera, tiposDeudor, guardarTiposDeudor } = useCobranza();
  const [paso, setPaso] = React.useState(0);
  const [alcanzado, setAlcanzado] = React.useState(0);
  const [dir, setDir] = React.useState(1);
  const [archivo, setArchivo] = React.useState<string | null>(null);
  const [analizando, setAnalizando] = React.useState(false);
  const [filas, setFilas] = React.useState<Fila[]>([]);
  const [apagados, setApagados] = React.useState<Set<string>>(new Set());
  const [extra, setExtra] = React.useState<string[]>([]);
  const actual = PASOS[paso].id;

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar();
    window.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [onCerrar]);

  const ir = (n: number) => {
    setDir(n > paso ? 1 : -1);
    setPaso(n);
    setAlcanzado((a) => Math.max(a, n));
  };

  const analizar = async (nombre: string, leer: () => Promise<Fila[]>) => {
    setArchivo(nombre);
    setAnalizando(true);
    ir(1);
    const [r] = await Promise.all([leer(), new Promise((ok) => setTimeout(ok, reduce ? 0 : 2400))]);
    setFilas(r);
    setApagados(new Set());
    setExtra([]);
    setAnalizando(false);
  };

  const subir = (f: File) =>
    void analizar(f.name, async () => {
      if (/\.csv$/i.test(f.name)) {
        const r = empateDeCsv(await f.text(), cartera);
        if (r) return r;
      }
      return empateDeEjemplo(cartera);
    });

  // Tipos que salieron del análisis (más los que se agregaron a mano).
  const conteo = new Map<string, number>();
  filas.forEach((f) => f.tipo && conteo.set(f.tipo, (conteo.get(f.tipo) ?? 0) + 1));
  const detectados = [...new Set([...conteo.keys(), ...extra])]
    .map((id) => tipoDeudor(id)!)
    .filter(Boolean)
    .sort((a, b) => (conteo.get(b.id) ?? 0) - (conteo.get(a.id) ?? 0));
  const activos = detectados.filter((t) => !apagados.has(t.id));
  const conCuenta = filas.filter((f) => f.cuentaId && f.tipo && !apagados.has(f.tipo));

  const guardar = () => {
    const e: TiposDeudorEstado = {
      activos: activos.map((t) => t.id),
      asignaciones: Object.fromEntries(conCuenta.map((f) => [f.cuentaId!, f.tipo!])),
      archivo: archivo ?? 'análisis',
      fecha: new Date().toISOString(),
    };
    guardarTiposDeudor(e);
    ir(3);
  };

  const variantes = {
    entra: (d: number) => (reduce ? { opacity: 0 } : { opacity: 0, y: d > 0 ? 32 : -22 }),
    centro: { opacity: 1, y: 0 },
    sale: (d: number) => (reduce ? { opacity: 0 } : { opacity: 0, y: d > 0 ? -18 : 26 }),
  };

  return createPortal(
    <div className="font-royaltica fixed inset-0 z-[80]" role="presentation">
      <motion.div
        className="absolute inset-0 bg-brand-ink/35 backdrop-blur-md"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: reduce ? 0 : 0.35 }}
        onClick={onCerrar}
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="tipos-titulo"
        className="absolute inset-x-3 top-3 bottom-3 sm:inset-x-6 sm:top-[4vh] sm:bottom-[4vh] mx-auto max-w-[1120px] rounded-[32px] overflow-hidden flex flex-col bg-[#F8FAFC]/85 backdrop-blur-3xl backdrop-saturate-150 border border-white/80 shadow-[0_50px_120px_-30px_rgba(17,24,39,0.55)]"
        initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 28 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        style={{ willChange: 'transform, opacity' }}
        transition={reduce ? { duration: 0 } : SPRING_SUAVE}
      >
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-24 w-[520px] h-[520px] rounded-full bg-amber-200/35 blur-[110px]" />
          <div className="absolute -bottom-48 -left-32 w-[520px] h-[520px] rounded-full bg-cyan-200/40 blur-[120px]" />
        </div>

        {/* Barra superior: el camino de pasos */}
        <header className="relative flex items-center gap-4 px-5 sm:px-8 pt-5 sm:pt-6 pb-4">
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-ink/45">Tipos de deudor</div>
            <h2 id="tipos-titulo" className="text-xl sm:text-2xl text-brand-ink mt-0.5 truncate">
              {tiposDeudor && paso === 0 ? 'Vuelve a importar tu análisis' : 'Dale a cada cliente el trato que le funciona'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="w-10 h-10 rounded-full flex items-center justify-center bg-white/70 hover:bg-white border border-white ring-1 ring-brand-ink/10 text-brand-ink/70 hover:text-brand-ink transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/70"
          >
            <X size={18} />
          </button>
        </header>

        <nav aria-label="Pasos" className="relative px-5 sm:px-8">
          <ol className="flex items-center gap-2">
            {PASOS.map((p, i) => {
              const hecho = i < paso || (i === 3 && paso === 3);
              const aqui = i === paso;
              const puede = i <= alcanzado && paso !== 3 && i !== 3 && !analizando;
              return (
                <li key={p.id} className="flex items-center gap-2 flex-1 min-w-0 last:flex-none">
                  <button
                    type="button"
                    disabled={!puede}
                    onClick={() => ir(i)}
                    className="group flex items-center gap-2 min-w-0 outline-none disabled:cursor-default"
                  >
                    <span
                      className={`relative w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-[11px] font-bold transition-colors ${
                        hecho ? 'bg-brand-gold text-brand-ink' : aqui ? 'bg-brand-ink text-white' : 'bg-white/70 text-brand-ink/35 ring-1 ring-brand-ink/10'
                      }`}
                    >
                      {hecho ? <Check size={13} strokeWidth={3} /> : i + 1}
                      {aqui && !reduce && (
                        <motion.span layoutId="paso-tipos" transition={SPRING} className="absolute -inset-1 rounded-full ring-2 ring-brand-gold/40" />
                      )}
                    </span>
                    <span className={`hidden sm:inline text-[12.5px] font-semibold truncate ${aqui ? 'text-brand-ink' : 'text-brand-ink/45 group-enabled:group-hover:text-brand-ink'}`}>
                      {p.nombre}
                    </span>
                  </button>
                  {i < PASOS.length - 1 && (
                    <span className="flex-1 h-[2px] rounded-full bg-brand-ink/[0.08] overflow-hidden">
                      <motion.span
                        className="block h-full bg-gradient-to-r from-brand-gold to-cyan-300"
                        initial={false}
                        animate={{ width: i < paso ? '100%' : '0%' }}
                        transition={SPRING_SUAVE}
                      />
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>

        {/* Cuerpo */}
        <div className="relative flex-1 min-h-0 overflow-y-auto px-5 sm:px-8 pt-6 pb-4">
          <AnimatePresence mode="wait" custom={dir} initial={false}>
            <motion.section
              key={analizando ? 'analizando' : actual}
              custom={dir}
              variants={variantes}
              initial="entra"
              animate="centro"
              exit="sale"
              transition={reduce ? { duration: 0 } : SPRING_SUAVE}
            >
              {analizando ? (
                <Analizando total={cartera.length} archivo={archivo ?? ''} />
              ) : (
                <>
                  {actual !== 'listo' && (
                    <div className="flex items-baseline gap-3 mb-6">
                      <span className="text-[12px] font-semibold text-cyan-700 tabular-nums">{String(paso + 1).padStart(2, '0')}</span>
                      <h3 className="text-2xl sm:text-[28px] text-brand-ink leading-tight">{PASOS[paso].pregunta}</h3>
                    </div>
                  )}
                  {actual === 'subir' && (
                    <PasoSubir
                      onArchivo={subir}
                      onEjemplo={() => void analizar('análisis de ejemplo', async () => empateDeEjemplo(cartera))}
                      onFormato={() => formatoCsv(cartera)}
                    />
                  )}
                  {actual === 'revisar' && <PasoRevisar filas={filas} onCambiar={setFilas} />}
                  {actual === 'tipos' && (
                    <PasoTipos
                      detectados={detectados}
                      conteo={conteo}
                      apagados={apagados}
                      onAlternar={(id) =>
                        setApagados((s) => {
                          const n = new Set(s);
                          if (n.has(id)) n.delete(id);
                          else n.add(id);
                          return n;
                        })
                      }
                      onAgregar={(id) => setExtra((e) => (e.includes(id) ? e : [...e, id]))}
                    />
                  )}
                  {actual === 'listo' && (
                    <PasoListo
                      tipos={activos}
                      clientes={conCuenta.length}
                      onVerPlantillas={
                        onVerPlantillas
                          ? () => {
                              onCerrar();
                              onVerPlantillas();
                            }
                          : undefined
                      }
                      onCerrar={onCerrar}
                    />
                  )}
                </>
              )}
            </motion.section>
          </AnimatePresence>
        </div>

        {/* Pie: atrás / siguiente */}
        {!analizando && (actual === 'revisar' || actual === 'tipos') && (
          <footer className="relative flex items-center gap-3 px-5 sm:px-8 py-4 border-t border-white/70 bg-white/40">
            <BotonSecundario onClick={() => ir(paso - 1)}>
              <ArrowLeft size={15} /> Atrás
            </BotonSecundario>
            <span className="flex-1 text-[12px] text-brand-ink/45 text-center hidden sm:block">
              {actual === 'revisar'
                ? `${filas.filter((f) => f.cuentaId && f.tipo).length} de ${filas.length} clientes con tipo`
                : `${activos.length} ${activos.length === 1 ? 'tipo activo' : 'tipos activos'} · ${conCuenta.length} clientes`}
            </span>
            {actual === 'revisar' ? (
              <BotonPrincipal onClick={() => ir(2)} disabled={!filas.some((f) => f.tipo)}>
                Ver tipos <ArrowRight size={15} />
              </BotonPrincipal>
            ) : (
              <BotonPrincipal onClick={guardar} disabled={!activos.length}>
                Activar {activos.length} {activos.length === 1 ? 'tipo' : 'tipos'} <Check size={15} />
              </BotonPrincipal>
            )}
          </footer>
        )}
      </motion.div>
    </div>,
    document.body,
  );
}

// ── Paso 1 · Subir ────────────────────────────────────────────────────

function PasoSubir({ onArchivo, onEjemplo, onFormato }: { onArchivo: (f: File) => void; onEjemplo: () => void; onFormato: () => void }) {
  const reduce = useReducedMotion();
  const [encima, setEncima] = React.useState(false);
  const input = React.useRef<HTMLInputElement>(null);
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] gap-6">
      <motion.button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setEncima(true);
        }}
        onDragLeave={() => setEncima(false)}
        onDrop={(e) => {
          e.preventDefault();
          setEncima(false);
          const f = e.dataTransfer.files[0];
          if (f) onArchivo(f);
        }}
        animate={{ scale: encima && !reduce ? 1.015 : 1 }}
        transition={SPRING}
        className={`relative min-h-[300px] rounded-[28px] border-2 border-dashed flex flex-col items-center justify-center text-center px-8 py-10 outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/70 transition-colors ${
          encima ? 'border-cyan-400 bg-cyan-50/70' : 'border-brand-ink/15 bg-white/50 hover:bg-white/75 hover:border-brand-ink/25'
        }`}
      >
        <motion.span
          animate={reduce ? undefined : { y: [0, -6, 0] }}
          transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
          className="w-16 h-16 rounded-[22px] bg-brand-ink text-brand-gold flex items-center justify-center shadow-[0_18px_40px_-16px_rgba(17,24,39,0.7)]"
        >
          <CloudUpload size={28} />
        </motion.span>
        <p className="text-[17px] font-semibold text-brand-ink mt-5">Arrastra aquí el archivo del análisis</p>
        <p className="text-[13px] text-brand-ink/50 mt-1.5 max-w-[40ch] leading-relaxed">
          El que te entregó la consultoría: cada cliente con su tipo de deudor. CSV o Excel.
        </p>
        <span className="mt-5 inline-flex items-center gap-2 rounded-full bg-white ring-1 ring-brand-ink/10 px-4 py-2 text-[12.5px] font-semibold text-brand-ink/70">
          <FileSpreadsheet size={14} /> Elegir archivo
        </span>
        <input
          ref={input}
          type="file"
          accept=".csv,.xlsx,.xls"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onArchivo(f);
            e.target.value = '';
          }}
        />
      </motion.button>

      <div className="space-y-3">
        <div className="glass rounded-[24px] p-5">
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-brand-ink/40">Cómo funciona</div>
          <ol className="mt-3 space-y-3">
            {[
              ['La consultoría analiza tu cartera', 'y te dice qué tipo de deudor es cada cliente.'],
              ['Lo subes aquí', 'y lo empatamos con tus clientes por RFC o nombre.'],
              ['Cada cliente recibe su trato', 'con plantillas hechas para su tipo.'],
            ].map(([t, d], i) => (
              <li key={t} className="flex gap-3">
                <span className="w-6 h-6 shrink-0 rounded-full bg-brand-ink/[0.06] text-[11px] font-bold text-brand-ink/55 flex items-center justify-center">{i + 1}</span>
                <p className="text-[12.5px] leading-snug text-brand-ink/55">
                  <span className="font-semibold text-brand-ink">{t}</span> {d}
                </p>
              </li>
            ))}
          </ol>
        </div>
        <button
          type="button"
          onClick={onEjemplo}
          className="w-full flex items-center gap-3 rounded-[22px] bg-gradient-to-r from-cyan-500/12 to-amber-400/10 ring-1 ring-cyan-500/20 px-4 py-3.5 text-left hover:from-cyan-500/18 transition-colors"
        >
          <Sparkles size={17} className="text-cyan-700 shrink-0" />
          <span className="min-w-0">
            <span className="block text-[13px] font-semibold text-brand-ink">Probar con un ejemplo</span>
            <span className="block text-[11.5px] text-brand-ink/50">Usa tu cartera para ver cómo queda</span>
          </span>
        </button>
        <button
          type="button"
          onClick={onFormato}
          className="w-full flex items-center gap-3 rounded-[22px] bg-white/55 ring-1 ring-brand-ink/[0.07] px-4 py-3.5 text-left hover:bg-white/80 transition-colors"
        >
          <FileDown size={17} className="text-brand-ink/50 shrink-0" />
          <span className="min-w-0">
            <span className="block text-[13px] font-semibold text-brand-ink">Descargar formato</span>
            <span className="block text-[11.5px] text-brand-ink/50">Tus clientes listos para que les pongan su tipo</span>
          </span>
        </button>
      </div>
    </div>
  );
}

function Analizando({ total, archivo }: { total: number; archivo: string }) {
  const reduce = useReducedMotion();
  const [n, setN] = React.useState(0);
  React.useEffect(() => {
    const ts = [700, 1500, 2200].map((ms, i) => setTimeout(() => setN(i + 1), reduce ? 0 : ms));
    return () => ts.forEach(clearTimeout);
  }, [reduce]);
  const lineas = [`Leyendo ${archivo}`, `Empatando con tus ${total} clientes`, 'Identificando tipos de deudor'];
  return (
    <div className="min-h-[420px] flex flex-col items-center justify-center text-center">
      <div className="relative w-24 h-24">
        <motion.span
          className="absolute inset-0 rounded-full border-[3px] border-brand-ink/[0.06] border-t-brand-gold"
          animate={reduce ? undefined : { rotate: 360 }}
          transition={{ duration: 1.1, repeat: Infinity, ease: 'linear' }}
        />
        <span className="absolute inset-3 rounded-full bg-brand-ink text-brand-gold flex items-center justify-center">
          <Search size={26} />
        </span>
      </div>
      <ul className="mt-8 space-y-2.5 text-left">
        {lineas.map((l, i) => (
          <motion.li
            key={l}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: i <= n ? 1 : 0.3, x: 0 }}
            transition={{ delay: reduce ? 0 : i * 0.15 }}
            className="flex items-center gap-2.5 text-[14px] text-brand-ink/70"
          >
            <span className={`w-5 h-5 rounded-full flex items-center justify-center ${i < n ? 'bg-emerald-500 text-white' : 'bg-brand-ink/[0.06]'}`}>
              {i < n ? <Check size={12} strokeWidth={3} /> : i === n ? <Loader2 size={12} className="animate-spin text-brand-ink/40" /> : null}
            </span>
            {l}
          </motion.li>
        ))}
      </ul>
    </div>
  );
}

// ── Paso 2 · Revisar el empate ────────────────────────────────────────

function PasoRevisar({ filas, onCambiar }: { filas: Fila[]; onCambiar: (f: Fila[]) => void }) {
  const listos = filas.filter((f) => f.cuentaId && f.tipo && f.confianza === 'alta');
  const revisar = filas.filter((f) => f.cuentaId && (f.confianza === 'revisar' || !f.tipo));
  const sinCliente = filas.filter((f) => !f.cuentaId);
  const [vista, setVista] = React.useState<'revisar' | 'listos' | 'sin'>(revisar.length ? 'revisar' : 'listos');
  const lista = vista === 'revisar' ? revisar : vista === 'listos' ? listos : sinCliente;
  const cambiar = (f: Fila, tipo: string) =>
    onCambiar(filas.map((x) => (x === f ? { ...x, tipo: tipo || null, confianza: tipo ? 'alta' : 'revisar' } : x)));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        <Resumen n={listos.length} titulo="Listos" detalle="tipo seguro" tono="emerald" />
        <Resumen n={revisar.length} titulo="Por revisar" detalle="confirma su tipo" tono="amber" />
        <Resumen n={sinCliente.length} titulo="Sin cliente" detalle="no están en tu cartera" tono="ink" />
      </div>
      <div className="flex flex-wrap items-center gap-3">
      <Subpestanas
        grupo="tipos-revisar"
        etiqueta="Clientes del análisis"
        valor={vista}
        onChange={setVista}
        opciones={[
          { id: 'revisar', nombre: 'Por revisar', n: revisar.length, alerta: true },
          { id: 'listos', nombre: 'Listos', n: listos.length },
          { id: 'sin', nombre: 'Sin cliente', n: sinCliente.length },
        ]}
      />
      {vista === 'revisar' && revisar.some((f) => f.tipo) && (
        <button
          type="button"
          onClick={() => onCambiar(filas.map((x) => (x.cuentaId && x.tipo ? { ...x, confianza: 'alta' } : x)))}
          className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-white/70 ring-1 ring-brand-ink/10 px-4 py-2 text-[12.5px] font-semibold text-brand-ink/70 hover:bg-white hover:text-brand-ink"
        >
          <Check size={13} /> Confirmar las sugerencias
        </button>
      )}
      </div>
      <div className="glass rounded-[24px] divide-y divide-brand-ink/[0.05] overflow-hidden">
        {lista.length === 0 && (
          <p className="px-5 py-10 text-center text-[13px] text-brand-ink/45">
            {vista === 'revisar' ? 'Nada por revisar. Todo empató bien.' : 'No hay clientes aquí.'}
          </p>
        )}
        {lista.map((f, i) => {
          const t = f.tipo ? tipoDeudor(f.tipo) : undefined;
          return (
            <motion.div
              key={`${f.nombre}-${i}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i, 10) * 0.025 }}
              className="flex flex-wrap items-center gap-3 px-5 py-3"
            >
              {t ? <IconoCausa causa={t.causa} size="sm" /> : <span className="w-8 h-8 rounded-xl bg-brand-ink/[0.05]" />}
              <span className="min-w-0 flex-1 text-[13.5px] font-semibold text-brand-ink truncate">{f.nombre}</span>
              {f.cuentaId ? (
                <select
                  value={f.tipo ?? ''}
                  onChange={(e) => cambiar(f, e.target.value)}
                  aria-label={`Tipo de deudor de ${f.nombre}`}
                  className={`glass-campo rounded-full px-3.5 py-2 text-[12.5px] font-semibold outline-none max-w-[260px] ${f.tipo ? 'text-brand-ink' : 'text-amber-700'}`}
                >
                  <option value="">Elige su tipo…</option>
                  {(['B2B', 'B2C'] as const).map((seg) => (
                    <optgroup key={seg} label={seg === 'B2B' ? 'Empresas' : 'Personas'}>
                      {TIPOS_DEUDOR.filter((x) => x.seg === seg).map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              ) : (
                <span className="text-[12px] text-brand-ink/40">Revisa el nombre o RFC en el archivo</span>
              )}
              {f.confianza === 'revisar' && f.tipo && f.cuentaId && (
                <button
                  type="button"
                  onClick={() => cambiar(f, f.tipo!)}
                  className="inline-flex items-center gap-1 rounded-full bg-emerald-600 text-white px-3 py-1.5 text-[12px] font-semibold hover:bg-emerald-700"
                  title="Confirmar este tipo"
                >
                  <Check size={12} strokeWidth={3} /> Sí
                </button>
              )}
              {f.confianza === 'alta' && f.tipo && f.cuentaId && (
                <span className="w-6 h-6 rounded-full bg-emerald-500/12 text-emerald-700 flex items-center justify-center" title="Confirmado">
                  <Check size={13} strokeWidth={3} />
                </span>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function Resumen({ n, titulo, detalle, tono }: { n: number; titulo: string; detalle: string; tono: 'emerald' | 'amber' | 'ink' }) {
  const color = tono === 'emerald' ? 'text-emerald-600' : tono === 'amber' ? 'text-amber-600' : 'text-brand-ink/40';
  return (
    <div className="glass rounded-[22px] px-4 py-4">
      <div className={`text-3xl font-semibold tabular-nums ${color}`}>{n}</div>
      <div className="text-[13px] font-semibold text-brand-ink mt-1">{titulo}</div>
      <div className="text-[11.5px] text-brand-ink/45">{detalle}</div>
    </div>
  );
}

// ── Paso 3 · Tipos ────────────────────────────────────────────────────

function PasoTipos({
  detectados,
  conteo,
  apagados,
  onAlternar,
  onAgregar,
}: {
  detectados: TipoDeudor[];
  conteo: Map<string, number>;
  apagados: Set<string>;
  onAlternar: (id: string) => void;
  onAgregar: (id: string) => void;
}) {
  const [catalogo, setCatalogo] = React.useState(false);
  return (
    <div className="space-y-4">
      <p className="text-[13.5px] text-brand-ink/55 -mt-3 max-w-[64ch]">
        Salieron {detectados.length} tipos en tu cartera. Toca una tarjeta para conocerlo; apágalo si no lo quieres usar.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {detectados.map((t, i) => (
          <TarjetaTipo key={t.id} t={t} n={conteo.get(t.id) ?? 0} activo={!apagados.has(t.id)} onAlternar={() => onAlternar(t.id)} i={i} />
        ))}
        <button
          type="button"
          onClick={() => setCatalogo(true)}
          className="min-h-[212px] rounded-[24px] border-2 border-dashed border-brand-ink/12 flex flex-col items-center justify-center gap-2 text-brand-ink/45 hover:text-brand-ink hover:border-brand-ink/25 hover:bg-white/40 transition-colors"
        >
          <Plus size={20} />
          <span className="text-[13px] font-semibold">Agregar otro tipo</span>
          <span className="text-[11.5px]">De los {TIPOS_DEUDOR.length} del catálogo</span>
        </button>
      </div>
      {catalogo && (
        <CatalogoTipos
          excluir={detectados.map((t) => t.id)}
          onElegir={(id) => {
            onAgregar(id);
            setCatalogo(false);
          }}
          onCerrar={() => setCatalogo(false)}
        />
      )}
    </div>
  );
}

/** Tarjeta que se voltea: al frente el tipo, atrás cómo tratarlo. */
function TarjetaTipo({ t, n, activo, onAlternar, i }: { key?: string; t: TipoDeudor; n: number; activo: boolean; onAlternar: () => void; i: number }) {
  const reduce = useReducedMotion();
  const [vuelta, setVuelta] = React.useState(false);
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 14, scale: 0.97 }}
      animate={{ opacity: activo ? 1 : 0.55, y: 0, scale: 1 }}
      transition={{ ...SPRING_SUAVE, delay: reduce ? 0 : i * 0.05 }}
      className="relative min-h-[212px] [perspective:1200px]"
    >
      <motion.div
        animate={{ rotateY: vuelta ? 180 : 0 }}
        transition={reduce ? { duration: 0 } : SPRING_SUAVE}
        className="relative h-full min-h-[212px] [transform-style:preserve-3d]"
      >
        {/* Frente */}
        <div className="glass absolute inset-0 rounded-[24px] p-5 flex flex-col [backface-visibility:hidden]">
          <div className="flex items-start gap-3">
            <IconoCausa causa={t.causa} />
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-semibold text-brand-ink leading-tight">{t.name}</div>
              <div className="mt-1.5 flex items-center gap-1.5">
                <ChipCausa causa={t.causa} />
              </div>
            </div>
            <Interruptor activo={activo} onClick={onAlternar} etiqueta={`Usar ${t.name}`} />
          </div>
          <p className="text-[12.5px] text-brand-ink/55 leading-relaxed mt-3 line-clamp-2">{t.def}</p>
          <div className="mt-auto pt-3 flex items-center justify-between">
            <span className="text-[12px] text-brand-ink/50">
              <span className="text-[15px] font-semibold text-brand-ink tabular-nums">{n}</span> {n === 1 ? 'cliente' : 'clientes'}
            </span>
            <button type="button" onClick={() => setVuelta(true)} className="text-[12px] font-semibold text-cyan-700 hover:text-cyan-900">
              Cómo tratarlo →
            </button>
          </div>
        </div>
        {/* Reverso */}
        <div className="absolute inset-0 rounded-[24px] p-5 flex flex-col bg-brand-ink text-white [backface-visibility:hidden] [transform:rotateY(180deg)] shadow-[0_20px_40px_-20px_rgba(17,24,39,0.7)]">
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-brand-gold">{t.name}</div>
          <dl className="mt-2.5 space-y-2 text-[12px] leading-snug">
            <div>
              <dt className="text-white/40">Lo que funciona</dt>
              <dd className="text-white/90">{t.pal}</dd>
            </div>
            <div>
              <dt className="text-white/40">Evita</dt>
              <dd className="text-white/75">{t.evi}</dd>
            </div>
          </dl>
          <button type="button" onClick={() => setVuelta(false)} className="mt-auto self-start text-[12px] font-semibold text-white/55 hover:text-white">
            ← Volver
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Interruptor({ activo, onClick, etiqueta }: { activo: boolean; onClick: () => void; etiqueta: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      aria-label={etiqueta}
      onClick={onClick}
      className={`relative w-10 h-6 shrink-0 rounded-full transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/70 ${activo ? 'bg-brand-ink' : 'bg-brand-ink/15'}`}
    >
      <motion.span
        className="absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow"
        animate={{ x: activo ? 16 : 0 }}
        transition={SPRING}
      />
    </button>
  );
}

// ── Paso 4 · Listo ────────────────────────────────────────────────────

function PasoListo({ tipos, clientes, onVerPlantillas, onCerrar }: { tipos: TipoDeudor[]; clientes: number; onVerPlantillas?: () => void; onCerrar: () => void }) {
  const reduce = useReducedMotion();
  return (
    <div className="min-h-[440px] flex flex-col items-center justify-center text-center">
      <motion.span
        initial={reduce ? false : { scale: 0.4, rotate: -20, opacity: 0 }}
        animate={{ scale: 1, rotate: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 16 }}
        className="w-20 h-20 rounded-[26px] bg-gradient-to-br from-brand-gold to-cyan-300 text-brand-ink flex items-center justify-center shadow-[0_24px_50px_-18px_rgba(6,182,212,0.8)]"
      >
        <Check size={36} strokeWidth={3} />
      </motion.span>
      <h3 className="text-[30px] text-brand-ink leading-tight mt-6">Tu cartera ya tiene sus tipos</h3>
      <p className="text-[14px] text-brand-ink/55 mt-2 max-w-[46ch]">
        {tipos.length} {tipos.length === 1 ? 'tipo activo' : 'tipos activos'} para {clientes} {clientes === 1 ? 'cliente' : 'clientes'}. Cada uno ya tiene sus plantillas, antes y después del
        vencimiento.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2 max-w-[640px]">
        {tipos.map((t, i) => (
          <motion.span
            key={t.id}
            initial={reduce ? false : { opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ ...SPRING, delay: reduce ? 0 : 0.25 + i * 0.06 }}
            className="inline-flex items-center gap-2 rounded-full bg-white/80 ring-1 ring-brand-ink/[0.07] pl-1 pr-3.5 py-1 text-[12.5px] font-semibold text-brand-ink/75"
          >
            <IconoCausa causa={t.causa} size="sm" /> {t.name}
          </motion.span>
        ))}
      </div>
      <div className="mt-8 flex flex-wrap justify-center gap-2">
        {onVerPlantillas && (
          <BotonPrincipal onClick={onVerPlantillas}>
            Ver sus plantillas <ArrowRight size={15} />
          </BotonPrincipal>
        )}
        <BotonSecundario onClick={onCerrar}>Terminar</BotonSecundario>
      </div>
    </div>
  );
}

// ── Catálogo completo ─────────────────────────────────────────────────

export function CatalogoTipos({ excluir = [], onElegir, onCerrar }: { excluir?: string[]; onElegir?: (id: string) => void; onCerrar: () => void }) {
  const reduce = useReducedMotion();
  const [seg, setSeg] = React.useState<'B2B' | 'B2C'>('B2B');
  const [q, setQ] = React.useState('');
  const [abierto, setAbierto] = React.useState<string | null>(null);
  const lista = TIPOS_DEUDOR.filter((t) => t.seg === seg && !excluir.includes(t.id) && (!q || fold(`${t.name} ${t.def}`).includes(fold(q))));
  const porCausa = (Object.keys(CAUSAS) as CausaDeudor[]).map((c) => ({ c, tipos: lista.filter((t) => t.causa === c) })).filter((g) => g.tipos.length);
  return createPortal(
    <div className="font-royaltica fixed inset-0 z-[90] flex items-start sm:items-center justify-center p-3 sm:p-6">
      <motion.div className="fixed inset-0 bg-brand-ink/30 backdrop-blur-md" onClick={onCerrar} initial={{ opacity: 0 }} animate={{ opacity: 1 }} />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Catálogo de tipos de deudor"
        initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 14 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={SPRING}
        className="glass-flotante relative w-full max-w-3xl max-h-[86vh] rounded-[28px] overflow-hidden flex flex-col"
      >
        <div className="px-6 pt-6 pb-4 space-y-4 border-b border-brand-ink/[0.06]">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-ink/45">Catálogo</div>
              <h3 className="text-xl text-brand-ink mt-0.5">Los {TIPOS_DEUDOR.length} tipos de deudor</h3>
            </div>
            <button type="button" onClick={onCerrar} aria-label="Cerrar" className="w-9 h-9 rounded-full bg-white/70 ring-1 ring-brand-ink/10 flex items-center justify-center text-brand-ink/60 hover:text-brand-ink">
              <X size={16} />
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Subpestanas
              grupo="catalogo-seg"
              etiqueta="Tipo de cliente"
              valor={seg}
              onChange={setSeg}
              opciones={[
                { id: 'B2B', nombre: 'Empresas', n: TIPOS_DEUDOR.filter((t) => t.seg === 'B2B').length },
                { id: 'B2C', nombre: 'Personas', n: TIPOS_DEUDOR.filter((t) => t.seg === 'B2C').length },
              ]}
            />
            <label className="glass-campo ml-auto flex items-center gap-2 rounded-full px-3.5 py-2 w-full sm:w-60">
              <Search size={14} className="text-brand-ink/35" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar tipo" className="w-full bg-transparent text-[13px] outline-none" />
            </label>
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-5">
          {porCausa.map(({ c, tipos }) => (
            <div key={c}>
              <div className="flex items-center gap-2 mb-2">
                <ChipCausa causa={c} />
                <span className="text-[11.5px] text-brand-ink/40">{CAUSAS[c].frase}</span>
              </div>
              <div className="space-y-1.5">
                {tipos.map((t) => {
                  const abre = abierto === t.id;
                  return (
                    <div key={t.id} className={`rounded-[20px] transition-colors ${abre ? 'bg-white/85 ring-1 ring-brand-ink/[0.07]' : 'hover:bg-white/55'}`}>
                      <div className="flex items-center gap-3 px-3 py-2.5">
                        <button type="button" onClick={() => setAbierto(abre ? null : t.id)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                          <IconoCausa causa={t.causa} size="sm" />
                          <span className="min-w-0">
                            <span className="block text-[13.5px] font-semibold text-brand-ink">{t.name}</span>
                            <span className="block text-[12px] text-brand-ink/50 truncate">{t.def}</span>
                          </span>
                        </button>
                        {onElegir && (
                          <button
                            type="button"
                            onClick={() => onElegir(t.id)}
                            className="shrink-0 inline-flex items-center gap-1 rounded-full bg-brand-ink text-white px-3 py-1.5 text-[11.5px] font-semibold hover:bg-black"
                          >
                            <Plus size={12} /> Agregar
                          </button>
                        )}
                      </div>
                      <AnimatePresence initial={false}>
                        {abre && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3 px-4 pb-4 pt-1 text-[12px] leading-snug">
                              <Dato t="Quién es" d={t.who} />
                              <Dato t="Lo que funciona" d={t.pal} />
                              <Dato t="Evita" d={t.evi} />
                            </dl>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {!porCausa.length && <p className="text-center text-[13px] text-brand-ink/45 py-10">No hay tipos con esa búsqueda.</p>}
        </div>
      </motion.div>
    </div>,
    document.body,
  );
}

function Dato({ t, d }: { t: string; d: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-[0.14em] text-brand-ink/35">{t}</dt>
      <dd className="text-brand-ink/70 mt-0.5">{d}</dd>
    </div>
  );
}

// ── Tarjeta para Segmentos ────────────────────────────────────────────

/** Entrada a los tipos de deudor desde Segmentos: importar o ver lo activo. */
export function TarjetaTiposDeudor({ onVerPlantillas }: { onVerPlantillas?: () => void }) {
  const reduce = useReducedMotion();
  const { tiposDeudor } = useCobranza();
  const [asistente, setAsistente] = React.useState(false);
  const [catalogo, setCatalogo] = React.useState(false);
  const activos = (tiposDeudor?.activos ?? []).map(tipoDeudor).filter(Boolean) as TipoDeudor[];

  return (
    <>
      <div className={`glass relative overflow-hidden rounded-[28px] px-6 sm:px-7 ${tiposDeudor ? 'py-4' : 'py-6'}`}>
        <div aria-hidden className="pointer-events-none absolute -top-20 right-10 w-72 h-72 rounded-full bg-[rgb(var(--acento)/0.18)] blur-[80px]" />
        {!tiposDeudor ? (
          <div className="relative flex flex-col md:flex-row md:items-center gap-6">
            {/* Las cinco causas, como constelación */}
            <div className="relative w-[132px] h-[92px] shrink-0 hidden sm:block" aria-hidden>
              {(Object.keys(CAUSAS) as CausaDeudor[]).map((c, i) => (
                <motion.span
                  key={c}
                  className="absolute"
                  style={{ left: [0, 44, 88, 22, 66][i], top: [8, 0, 10, 50, 48][i] }}
                  animate={reduce ? undefined : { y: [0, i % 2 ? -4 : 4, 0] }}
                  transition={{ duration: 3 + i * 0.4, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <IconoCausa causa={c} size="sm" />
                </motion.span>
              ))}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-ink/45">Tipos de deudor</div>
              <h3 className="text-[22px] text-brand-ink leading-tight mt-1">No todos dejan de pagar por lo mismo</h3>
              <p className="text-[13px] text-brand-ink/55 mt-1.5 max-w-[56ch] leading-relaxed">
                Importa el análisis de la consultoría y cada cliente recibirá mensajes hechos para su tipo.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              <BotonPrincipal onClick={() => setAsistente(true)}>
                <CloudUpload size={15} /> Importar análisis
              </BotonPrincipal>
              <BotonSecundario onClick={() => setCatalogo(true)}>Ver los {TIPOS_DEUDOR.length} tipos</BotonSecundario>
            </div>
          </div>
        ) : (
          <div className="relative flex flex-wrap items-center gap-3">
            <span className="w-11 h-11 shrink-0 rounded-2xl bg-emerald-500/12 text-emerald-700 flex items-center justify-center">
              <Check size={20} strokeWidth={2.5} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-ink/45">Análisis importado</div>
              <h3 className="text-[18px] text-brand-ink leading-tight mt-0.5">
                {activos.length} {activos.length === 1 ? 'tipo de deudor activo' : 'tipos de deudor activos'}
              </h3>
              <p className="text-[12px] text-brand-ink/45 mt-0.5 truncate">
                {tiposDeudor.archivo} · {new Date(tiposDeudor.fecha).toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })}
              </p>
            </div>
            {onVerPlantillas && (
              <BotonPrincipal onClick={onVerPlantillas}>
                Ver plantillas <ArrowRight size={15} />
              </BotonPrincipal>
            )}
            <BotonSecundario onClick={() => setAsistente(true)}>
              <RotateCcw size={14} /> Volver a importar
            </BotonSecundario>
          </div>
        )}
      </div>
      <AnimatePresence>{asistente && <AsistenteTiposDeudor onCerrar={() => setAsistente(false)} onVerPlantillas={onVerPlantillas} />}</AnimatePresence>
      {catalogo && <CatalogoTipos onCerrar={() => setCatalogo(false)} />}
    </>
  );
}
