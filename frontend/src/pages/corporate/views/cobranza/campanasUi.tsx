import React from 'react';
import { motion, useReducedMotion, type Transition } from 'motion/react';
import { Check, Minus, PencilLine, Plus } from 'lucide-react';
import type { Campana } from './mockV1.ts';

// Piezas visuales de la pestaña Campañas: vidrio (glassmorphism) sobre la
// paleta Grafito + Cian, con movimiento de resorte suave. Es la prueba de
// estilo para, si convence, llevarlo al resto de la plataforma.

/** Resorte "tipo Apple": rápido al inicio, se asienta sin rebotar de más. */
export const SPRING: Transition = { type: 'spring', stiffness: 380, damping: 34, mass: 0.9 };
export const SPRING_SUAVE: Transition = { type: 'spring', stiffness: 220, damping: 30, mass: 1 };

/** Superficie de vidrio clara (tarjetas sobre el fondo de la página). */
export const GLASS =
  'bg-white/65 backdrop-blur-xl backdrop-saturate-150 border border-white/80 ring-1 ring-brand-ink/[0.06] shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_12px_32px_-16px_rgba(17,24,39,0.18)]';

/** Vidrio más denso para capas flotantes (menús, avisos). */
export const GLASS_FLOTANTE =
  'bg-white/80 backdrop-blur-2xl backdrop-saturate-150 border border-white/90 ring-1 ring-brand-ink/[0.08] shadow-[0_24px_60px_-20px_rgba(17,24,39,0.35)]';

export const ESTADO: Record<Campana['estado'], { punto: string; texto: string; fondo: string }> = {
  Activa: { punto: 'bg-emerald-500', texto: 'text-emerald-700', fondo: 'bg-emerald-500/10' },
  Programada: { punto: 'bg-brand-gold', texto: 'text-cyan-700', fondo: 'bg-brand-gold/10' },
  Pausada: { punto: 'bg-amber-500', texto: 'text-amber-700', fondo: 'bg-amber-500/10' },
  Borrador: { punto: 'bg-brand-ink/35', texto: 'text-brand-ink/60', fondo: 'bg-brand-ink/[0.05]' },
  Finalizada: { punto: 'bg-brand-ink/25', texto: 'text-brand-ink/50', fondo: 'bg-brand-ink/[0.04]' },
};

export function EstadoPill({ estado }: { estado: Campana['estado'] }) {
  const e = ESTADO[estado];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${e.fondo} ${e.texto}`}>
      <span className="relative flex w-1.5 h-1.5">
        {estado === 'Activa' && (
          <span className={`absolute inset-0 rounded-full ${e.punto} opacity-60 animate-ping motion-reduce:hidden`} />
        )}
        <span className={`relative w-1.5 h-1.5 rounded-full ${e.punto}`} />
      </span>
      {estado}
    </span>
  );
}

/**
 * Opción grande de un paso del asistente. Al elegirla aparece el anillo cian
 * con una animación compartida (layoutId), como un control segmentado.
 */
export function OpcionCard({
  activa,
  onClick,
  icono,
  titulo,
  detalle,
  extra,
  grupo,
  disabled,
  vertical = false,
}: {
  key?: string;
  /** Icono arriba y texto debajo: para filas de tres opciones. */
  vertical?: boolean;
  activa: boolean;
  onClick: () => void;
  icono?: React.ReactNode;
  titulo: string;
  detalle?: string;
  extra?: React.ReactNode;
  /** Nombre del grupo para que el anillo viaje entre opciones del mismo paso. */
  grupo: string;
  disabled?: boolean;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.button
      type="button"
      role="radio"
      aria-checked={activa}
      disabled={disabled}
      onClick={onClick}
      whileHover={reduce || disabled ? undefined : { y: -2 }}
      whileTap={reduce || disabled ? undefined : { scale: 0.985 }}
      transition={SPRING}
      className={`group relative flex flex-col justify-start text-left rounded-[22px] p-4 sm:p-5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand-gold/70 disabled:opacity-40 disabled:cursor-not-allowed ${
        activa ? 'bg-white/90' : 'bg-white/45 hover:bg-white/75'
      } border border-white/80 ring-1 ring-brand-ink/[0.06] shadow-[0_1px_0_rgba(255,255,255,0.9)_inset]`}
    >
      {activa && (
        <motion.span
          layoutId={reduce ? undefined : `anillo-${grupo}`}
          transition={SPRING}
          className="absolute inset-0 rounded-[22px] ring-2 ring-brand-gold shadow-[0_10px_30px_-12px_rgba(6,182,212,0.55)] pointer-events-none"
        />
      )}
      <span className={`relative w-full flex items-start ${vertical ? 'flex-col gap-3 pr-7' : 'gap-3.5'}`}>
        {icono && (
          <span
            className={`shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center transition-colors ${
              activa ? 'bg-brand-ink text-brand-gold' : 'bg-brand-ink/[0.05] text-brand-ink/60 group-hover:text-brand-ink'
            }`}
          >
            {icono}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold text-brand-ink leading-snug">{titulo}</span>
          {detalle && <span className="block text-[12.5px] text-brand-ink/55 mt-1 leading-relaxed">{detalle}</span>}
          {extra}
        </span>
        <span
          className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center transition-all duration-300 ${vertical ? 'absolute top-0 right-0' : ''} ${
            activa ? 'bg-brand-gold text-white scale-100' : 'bg-transparent border border-brand-ink/15 scale-90'
          }`}
          aria-hidden
        >
          {activa && <Check size={12} strokeWidth={3} />}
        </span>
      </span>
    </motion.button>
  );
}

/** Selector numérico grande (porcentaje o parcialidades). */
export function Stepper({
  valor,
  min,
  max,
  sufijo,
  onChange,
  paso = 1,
}: {
  valor: number;
  min: number;
  max: number;
  sufijo: string;
  onChange: (v: number) => void;
  paso?: number;
}) {
  const reduce = useReducedMotion();
  const boton =
    'w-11 h-11 rounded-full flex items-center justify-center bg-white/80 border border-white ring-1 ring-brand-ink/10 text-brand-ink hover:bg-white disabled:opacity-30 transition-colors focus-visible:ring-2 focus-visible:ring-brand-gold/70 outline-none';
  return (
    <div className="flex items-center gap-4">
      <button type="button" aria-label="Menos" className={boton} disabled={valor <= min} onClick={() => onChange(Math.max(min, valor - paso))}>
        <Minus size={16} />
      </button>
      <div className="min-w-[120px] text-center" aria-live="polite">
        <motion.span
          key={valor}
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={SPRING}
          className="inline-block text-5xl font-semibold tracking-tight text-brand-ink tabular-nums"
        >
          {valor}
        </motion.span>
        <span className="block text-[12px] text-brand-ink/50 mt-0.5">{sufijo}</span>
      </div>
      <button type="button" aria-label="Más" className={boton} disabled={valor >= max} onClick={() => onChange(Math.min(max, valor + paso))}>
        <Plus size={16} />
      </button>
    </div>
  );
}

/**
 * Nombre que se edita en su lugar: el lápiz aparece al pasar el cursor (o con
 * foco); doble clic también abre la edición. Enter guarda, Esc cancela.
 */
export function NombreEditable({
  valor,
  onGuardar,
  editando,
  onEditando,
  className = '',
  placeholder = 'Nombre de la campaña',
  max = 60,
}: {
  valor: string;
  onGuardar: (nombre: string) => void;
  editando: boolean;
  onEditando: (v: boolean) => void;
  /** Tamaño y peso del texto; se comparte entre la vista y el campo. */
  className?: string;
  placeholder?: string;
  max?: number;
}) {
  const reduce = useReducedMotion();
  const [borrador, setBorrador] = React.useState(valor);
  const inputRef = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    if (editando) {
      setBorrador(valor);
      requestAnimationFrame(() => inputRef.current?.select());
    }
    // Solo al abrir la edición.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editando]);

  const terminar = (guardar: boolean) => {
    const limpio = borrador.trim().replace(/\s+/g, ' ');
    if (guardar && limpio && limpio !== valor) onGuardar(limpio);
    onEditando(false);
  };

  if (editando) {
    return (
      <motion.span
        initial={reduce ? false : { opacity: 0.6, scale: 0.99 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={SPRING}
        className="relative flex items-center gap-2 min-w-0"
      >
        <input
          ref={inputRef}
          value={borrador}
          maxLength={max}
          placeholder={placeholder}
          aria-label="Nombre de la campaña"
          onChange={(e) => setBorrador(e.target.value)}
          onBlur={() => terminar(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              terminar(true);
            }
            if (e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              terminar(false);
            }
          }}
          className={`min-w-0 w-full rounded-xl bg-white/85 -mx-2 px-2 py-0.5 ring-2 ring-brand-gold/70 shadow-[0_8px_24px_-14px_rgba(6,182,212,0.6)] text-brand-ink placeholder:text-brand-ink/30 outline-none ${className}`}
        />
        <span className="shrink-0 text-[11px] text-brand-ink/35 tabular-nums" aria-hidden>
          {borrador.length}/{max}
        </span>
      </motion.span>
    );
  }

  return (
    <span className="group/nombre flex items-center gap-1.5 min-w-0">
      <span className={`truncate ${className}`} onDoubleClick={() => onEditando(true)} title={valor}>
        {valor}
      </span>
      <button
        type="button"
        onClick={() => onEditando(true)}
        aria-label={`Cambiar nombre de ${valor}`}
        className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-brand-ink/40 hover:text-brand-ink hover:bg-white/80 opacity-60 sm:opacity-0 group-hover/nombre:opacity-100 focus-visible:opacity-100 transition-all outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/70"
      >
        <PencilLine size={14} />
      </button>
    </span>
  );
}

/** Botón principal (tinta) y secundario (vidrio). */
export function BotonPrincipal({
  children,
  onClick,
  disabled,
  title,
  acento = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  /** Cian sobre fondos oscuros. */
  acento?: boolean;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      whileTap={reduce || disabled ? undefined : { scale: 0.97 }}
      transition={SPRING}
      className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-[13px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/70 focus-visible:ring-offset-2 disabled:opacity-35 disabled:cursor-not-allowed transition-colors ${
        acento
          ? 'bg-brand-gold text-brand-ink hover:bg-cyan-400 shadow-[0_10px_30px_-10px_rgba(6,182,212,0.7)]'
          : 'bg-brand-ink text-white hover:bg-black shadow-[0_10px_30px_-12px_rgba(17,24,39,0.6)]'
      }`}
    >
      {children}
    </motion.button>
  );
}

export function BotonSecundario({
  children,
  onClick,
  disabled,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-[13px] font-semibold text-brand-ink/75 bg-white/60 hover:bg-white/90 border border-white ring-1 ring-brand-ink/10 outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/70 disabled:opacity-35 disabled:cursor-not-allowed transition-colors"
    >
      {children}
    </button>
  );
}
