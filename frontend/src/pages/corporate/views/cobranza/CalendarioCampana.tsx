import React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { HOY, OCASIONES } from './mockV1.ts';
import { SPRING, SPRING_SUAVE } from './campanasUi.tsx';

// Calendario de rango para campañas con fecha personalizada. Sigue el estilo
// de la pestaña: vidrio claro, tinta + cian, resortes suaves. Se elige el
// inicio y luego el fin; las fechas fuertes del año quedan marcadas.

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MESES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const DIAS_SEMANA = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const DIAS_NOMBRE = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];

// ── Fechas como texto ISO (YYYY-MM-DD), en UTC para no depender de la zona ──
const aIso = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const partes = (iso: string) => ({ y: Number(iso.slice(0, 4)), m: Number(iso.slice(5, 7)) - 1, d: Number(iso.slice(8, 10)) });
const aUtc = (iso: string) => {
  const p = partes(iso);
  return Date.UTC(p.y, p.m, p.d);
};
const desdeUtc = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const sumarDias = (iso: string, n: number) => desdeUtc(aUtc(iso) + n * 86_400_000);
const diasEnMes = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
/** Lunes = 0 … domingo = 6. */
const diaSemana = (iso: string) => (new Date(aUtc(iso)).getUTCDay() + 6) % 7;
const diasEntre = (a: string, b: string) => Math.round((aUtc(b) - aUtc(a)) / 86_400_000);

/** "lun 28 sep" */
export const fechaLarga = (iso: string) => {
  const p = partes(iso);
  return `${DIAS_NOMBRE[diaSemana(iso)]} ${p.d} ${MESES_CORTO[p.m]}`;
};

/** Fechas fuertes del año, para marcarlas en el calendario. */
const FUERTES = OCASIONES.filter((o) => o.id !== 'personalizada' && o.id !== 'contacto');
const fuerteDe = (iso: string) => FUERTES.find((o) => iso >= o.inicio && iso <= o.fin);

type Mes = { y: number; m: number };
const mesDe = (iso: string): Mes => ({ y: partes(iso).y, m: partes(iso).m });
const moverMes = ({ y, m }: Mes, n: number): Mes => {
  const t = y * 12 + m + n;
  return { y: Math.floor(t / 12), m: ((t % 12) + 12) % 12 };
};
const indiceMes = ({ y, m }: Mes) => y * 12 + m;

function atajos(): { id: string; nombre: string; inicio: string; fin: string }[] {
  const p = partes(HOY);
  const finMes = aIso(p.y, p.m, diasEnMes(p.y, p.m));
  const domingo = sumarDias(HOY, 6 - diaSemana(HOY));
  const quincena = p.d < 15 ? aIso(p.y, p.m, 15) : finMes;
  return [
    { id: 'hoy', nombre: 'Solo hoy', inicio: HOY, fin: HOY },
    { id: 'semana', nombre: 'Esta semana', inicio: HOY, fin: domingo },
    { id: '7', nombre: 'Próximos 7 días', inicio: HOY, fin: sumarDias(HOY, 6) },
    { id: 'quincena', nombre: 'Hasta la quincena', inicio: HOY, fin: quincena },
    { id: '30', nombre: '30 días', inicio: HOY, fin: sumarDias(HOY, 29) },
  ].filter((a, i, arr) => arr.findIndex((b) => b.inicio === a.inicio && b.fin === a.fin) === i);
}

export function CalendarioCampana({
  inicio,
  fin,
  onCambio,
}: {
  inicio: string;
  fin: string;
  onCambio: (inicio: string, fin: string) => void;
}) {
  const reduce = useReducedMotion();
  const [editando, setEditando] = React.useState<'inicio' | 'fin'>('inicio');
  const [hover, setHover] = React.useState<string | null>(null);
  const [mes, setMes] = React.useState<Mes>(() => mesDe(inicio < HOY ? HOY : inicio));
  const [dir, setDir] = React.useState(1);
  const [enfocado, setEnfocado] = React.useState<string>(inicio);
  const gridRef = React.useRef<HTMLDivElement>(null);
  const mesMinimo = mesDe(HOY);
  const puedeAtras = indiceMes(mes) > indiceMes(mesMinimo);

  const irMes = (n: number) => {
    setDir(n > 0 ? 1 : -1);
    setMes((m) => moverMes(m, n));
  };

  // Que el mes visible siga al día con foco del teclado.
  const asegurarVisible = (iso: string) => {
    const objetivo = mesDe(iso);
    const i = indiceMes(objetivo);
    const visibleA = indiceMes(mes);
    if (i < visibleA) {
      setDir(-1);
      setMes(objetivo);
    } else if (i > visibleA + 1) {
      setDir(1);
      setMes(moverMes(objetivo, -1));
    }
  };

  const elegir = (iso: string) => {
    if (iso < HOY) return;
    if (editando === 'inicio') {
      onCambio(iso, iso > fin ? iso : fin);
      setEditando('fin');
    } else if (iso < inicio) {
      // Antes del inicio: se toma como nuevo inicio y se sigue eligiendo el fin.
      onCambio(iso, fin < iso ? iso : fin);
    } else {
      onCambio(inicio, iso);
      setEditando('inicio');
    }
    setEnfocado(iso);
    setHover(null);
  };

  const aplicarAtajo = (a: { inicio: string; fin: string }) => {
    onCambio(a.inicio, a.fin);
    setEditando('inicio');
    const objetivo = mesDe(a.inicio);
    setDir(indiceMes(objetivo) >= indiceMes(mes) ? 1 : -1);
    setMes(objetivo);
  };

  const onTecla = (e: React.KeyboardEvent, iso: string) => {
    const pasos: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (!(e.key in pasos)) return;
    e.preventDefault();
    let siguiente = sumarDias(iso, pasos[e.key]);
    if (siguiente < HOY) siguiente = HOY;
    setEnfocado(siguiente);
    asegurarVisible(siguiente);
    if (editando === 'fin') setHover(siguiente);
    requestAnimationFrame(() =>
      gridRef.current?.querySelector<HTMLButtonElement>(`[data-dia="${siguiente}"]`)?.focus({ preventScroll: true }),
    );
  };

  // Rango que se pinta: el real o, mientras se elige el fin, la vista previa.
  const finVisible = editando === 'fin' && hover && hover >= inicio ? hover : fin;
  const dias = diasEntre(inicio, fin) + 1;
  const atajosHoy = React.useMemo(atajos, []);
  const atajoActivo = atajosHoy.find((a) => a.inicio === inicio && a.fin === fin)?.id;

  const variantes = {
    entra: (d: number) => (reduce ? { opacity: 0 } : { opacity: 0, x: d * 28 }),
    centro: { opacity: 1, x: 0 },
    sale: (d: number) => (reduce ? { opacity: 0 } : { opacity: 0, x: d * -28 }),
  };

  return (
    <div className="rounded-[26px] p-4 sm:p-6 bg-white/55 backdrop-blur-xl border border-white/80 ring-1 ring-brand-ink/[0.05] shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_12px_32px_-16px_rgba(17,24,39,0.18)]">
      {/* Inicio · fin: también indican qué extremo se está eligiendo */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-2 sm:gap-3">
        <Extremo etiqueta="Empieza" iso={inicio} activo={editando === 'inicio'} onClick={() => setEditando('inicio')} />
        <div className="flex flex-col items-center justify-center px-1 text-center">
          <span className="text-[20px] font-semibold tracking-tight text-brand-ink tabular-nums leading-none">{dias}</span>
          <span className="text-[11px] text-brand-ink/45 mt-1">{dias === 1 ? 'día' : 'días'}</span>
        </div>
        <Extremo etiqueta="Termina" iso={fin} activo={editando === 'fin'} onClick={() => setEditando('fin')} />
      </div>

      {/* Atajos */}
      <div className="flex gap-2 overflow-x-auto mt-4 -mx-1 px-1 pb-1 [scrollbar-width:none]">
        {atajosHoy.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => aplicarAtajo(a)}
            aria-pressed={atajoActivo === a.id}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/70 ${
              atajoActivo === a.id
                ? 'bg-brand-ink text-white'
                : 'bg-white/60 text-brand-ink/65 ring-1 ring-brand-ink/[0.08] hover:bg-white hover:text-brand-ink'
            }`}
          >
            {a.nombre}
          </button>
        ))}
      </div>

      <p className="text-[12px] text-brand-ink/45 mt-4" aria-live="polite">
        {editando === 'inicio' ? 'Toca el día en que empieza la campaña.' : 'Ahora toca el día en que termina.'}
      </p>

      {/* Meses */}
      <div className="relative mt-3">
        <div className="absolute right-0 -top-1 flex gap-1.5 z-10">
          <BotonMes etiqueta="Mes anterior" disabled={!puedeAtras} onClick={() => irMes(-1)}>
            <ChevronLeft size={16} />
          </BotonMes>
          <BotonMes etiqueta="Mes siguiente" onClick={() => irMes(1)}>
            <ChevronRight size={16} />
          </BotonMes>
        </div>
        <div ref={gridRef} className="overflow-hidden" onMouseLeave={() => setHover(null)}>
          <AnimatePresence mode="popLayout" custom={dir} initial={false}>
            <motion.div
              key={indiceMes(mes)}
              custom={dir}
              variants={variantes}
              initial="entra"
              animate="centro"
              exit="sale"
              transition={reduce ? { duration: 0 } : SPRING_SUAVE}
              className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6"
            >
              {[mes, moverMes(mes, 1)].map((mm, i) => (
                <div key={indiceMes(mm)} className={i === 1 ? 'hidden md:block' : ''}>
                  <MesGrid
                    mes={mm}
                    inicio={inicio}
                    fin={finVisible}
                    previa={editando === 'fin' && !!hover && hover >= inicio && hover !== fin}
                    enfocado={enfocado}
                    onElegir={elegir}
                    onHover={(iso) => editando === 'fin' && setHover(iso)}
                    onTecla={onTecla}
                  />
                </div>
              ))}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Leyenda */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 mt-5 pt-4 border-t border-brand-ink/[0.06] text-[11.5px] text-brand-ink/50">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-gold" /> Hoy
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> Fechas fuertes (Buen Fin, Black Friday, cierre de año)
        </span>
      </div>
    </div>
  );
}

function Extremo({ etiqueta, iso, activo, onClick }: { etiqueta: string; iso: string; activo: boolean; onClick: () => void }) {
  const reduce = useReducedMotion();
  const p = partes(iso);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={`relative min-w-0 text-left rounded-[20px] px-4 py-3 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand-gold/70 border border-white/80 ${
        activo ? 'bg-white/95' : 'bg-white/45 hover:bg-white/75'
      }`}
    >
      {activo && (
        <motion.span
          layoutId={reduce ? undefined : 'calendario-extremo'}
          transition={SPRING}
          className="absolute inset-0 rounded-[20px] ring-2 ring-brand-gold shadow-[0_10px_30px_-14px_rgba(6,182,212,0.55)] pointer-events-none"
        />
      )}
      <span className="relative block text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-ink/45">{etiqueta}</span>
      <span className="relative block text-[15px] sm:text-[17px] font-semibold text-brand-ink mt-0.5 truncate tabular-nums">
        {fechaLarga(iso)}
        <span className="font-normal text-brand-ink/40"> {p.y}</span>
      </span>
    </button>
  );
}

function BotonMes({ etiqueta, disabled, onClick, children }: { etiqueta: string; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={etiqueta}
      disabled={disabled}
      onClick={onClick}
      className="w-8 h-8 rounded-full flex items-center justify-center bg-white/70 border border-white ring-1 ring-brand-ink/10 text-brand-ink/70 hover:bg-white hover:text-brand-ink disabled:opacity-30 disabled:cursor-not-allowed transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/70"
    >
      {children}
    </button>
  );
}

function MesGrid({
  mes,
  inicio,
  fin,
  previa,
  enfocado,
  onElegir,
  onHover,
  onTecla,
}: {
  mes: Mes;
  inicio: string;
  fin: string;
  /** El fin pintado es una vista previa (cursor encima), no el elegido. */
  previa: boolean;
  enfocado: string;
  onElegir: (iso: string) => void;
  onHover: (iso: string) => void;
  onTecla: (e: React.KeyboardEvent, iso: string) => void;
}) {
  const reduce = useReducedMotion();
  const total = diasEnMes(mes.y, mes.m);
  const desfase = diaSemana(aIso(mes.y, mes.m, 1));
  const celdas: (string | null)[] = [
    ...Array.from({ length: desfase }, () => null),
    ...Array.from({ length: total }, (_, i) => aIso(mes.y, mes.m, i + 1)),
  ];
  // El foco con tabulador cae en un solo día por mes (el enfocado, o el primero elegible).
  const tabulable = celdas.includes(enfocado) ? enfocado : celdas.find((c) => c && c >= HOY) ?? null;

  return (
    <div>
      <div className="h-8 flex items-center text-[15px] font-semibold text-brand-ink capitalize">
        {MESES[mes.m]} <span className="ml-1.5 font-normal text-brand-ink/40 tabular-nums">{mes.y}</span>
      </div>
      <div className="grid grid-cols-7 mt-3 mb-1" aria-hidden>
        {DIAS_SEMANA.map((d, i) => (
          <span key={i} className="text-center text-[11px] font-semibold text-brand-ink/35">
            {d}
          </span>
        ))}
      </div>
      <div role="grid" aria-label={`${MESES[mes.m]} ${mes.y}`} className="grid grid-cols-7 gap-y-1">
        {celdas.map((iso, i) => {
          if (!iso) return <span key={`v${i}`} />;
          const pasado = iso < HOY;
          const esInicio = iso === inicio;
          const esFin = iso === fin;
          const dentro = iso > inicio && iso < fin;
          const extremo = esInicio || esFin;
          const col = i % 7;
          const fuerte = fuerteDe(iso);
          const esHoy = iso === HOY;
          const hayRango = fin > inicio;
          // La banda del rango se corta en los bordes de cada semana para leerse por renglón.
          const banda =
            hayRango && (dentro || esInicio || esFin)
              ? `${esInicio || col === 0 || iso.endsWith('-01') ? 'rounded-l-full' : ''} ${esFin || col === 6 || Number(iso.slice(8)) === total ? 'rounded-r-full' : ''}`
              : null;
          return (
            <div key={iso} className="relative h-10 flex items-center justify-center">
              {banda !== null && (
                <span
                  aria-hidden
                  className={`absolute inset-y-1 ${esInicio ? 'left-1/2' : 'left-0'} ${esFin ? 'right-1/2' : 'right-0'} ${banda} ${
                    previa ? 'bg-brand-gold/[0.08]' : 'bg-brand-gold/[0.14]'
                  } transition-colors`}
                />
              )}
              <button
                type="button"
                role="gridcell"
                data-dia={iso}
                tabIndex={iso === tabulable ? 0 : -1}
                disabled={pasado}
                aria-selected={extremo || dentro}
                aria-label={`${fechaLarga(iso)} ${mes.y}${fuerte ? ` · ${fuerte.nombre}` : ''}${esHoy ? ' · hoy' : ''}`}
                title={fuerte?.nombre}
                onClick={() => onElegir(iso)}
                onMouseEnter={() => !pasado && onHover(iso)}
                onKeyDown={(e) => onTecla(e, iso)}
                className={`relative w-10 h-10 rounded-full text-[13.5px] tabular-nums outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand-gold/70 ${
                  pasado
                    ? 'text-brand-ink/20 cursor-not-allowed'
                    : extremo
                      ? 'text-brand-gold font-semibold'
                      : dentro
                        ? 'text-brand-ink font-semibold hover:bg-white/80'
                        : 'text-brand-ink/80 hover:bg-white/80 hover:text-brand-ink'
                }`}
              >
                {extremo && (
                  <motion.span
                    layoutId={reduce ? undefined : esInicio ? 'cal-inicio' : 'cal-fin'}
                    transition={SPRING}
                    className={`absolute inset-0 rounded-full bg-brand-ink shadow-[0_8px_20px_-8px_rgba(17,24,39,0.6)] ${
                      previa && esFin && !esInicio ? 'opacity-70' : ''
                    }`}
                  />
                )}
                <span className="relative">{Number(iso.slice(8))}</span>
                {(esHoy || fuerte) && (
                  <span
                    aria-hidden
                    className={`absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${esHoy ? 'bg-brand-gold' : 'bg-amber-400'}`}
                  />
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
