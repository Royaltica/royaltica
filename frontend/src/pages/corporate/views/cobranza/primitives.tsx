import React from 'react';
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react';
import { CURRENCY_FORMATTER } from '../../../../utils/format.ts';

// Primitivas visuales compartidas por todas las vistas de Cobranza IA
// (Administrador, Supervisor y Agente). Mismo sistema de movimiento: cada
// animación responde a jerarquía, cambio de estado o retroalimentación.

export const EASE = [0.16, 1, 0.3, 1] as const;

/** Entrada escalonada: ordena la lectura de arriba hacia abajo. */
export function Reveal({
  children,
  delay = 0,
  className = '',
}: {
  // Convención del proyecto: un componente que recibe `key` debe declararla.
  key?: string;
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: reduce ? 0 : delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

export type FigureFormat = 'entero' | 'moneda' | 'porcentaje' | 'dias';

const FORMATTERS: Record<FigureFormat, (v: number) => string> = {
  entero: (v) => String(Math.round(v)),
  moneda: (v) => CURRENCY_FORMATTER.format(Math.round(v)),
  porcentaje: (v) => `${Math.round(v)}%`,
  dias: (v) => `${Math.round(v)}`,
};

/**
 * Cifra que transiciona al cambiar de valor. La animación comunica un
 * cambio de estado real (cambiaste de cuenta, moviste el simulador), no
 * es un adorno de carga: por eso solo corre cuando `value` cambia.
 */
export function Figure({
  value,
  format = 'entero',
  className = '',
}: {
  value: number;
  format?: FigureFormat;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const mv = useMotionValue(value);
  const text = useTransform(mv, FORMATTERS[format]);

  React.useEffect(() => {
    if (reduce) {
      mv.set(value);
      return;
    }
    const controls = animate(mv, value, { duration: 0.5, ease: EASE });
    return () => controls.stop();
  }, [value, reduce, mv]);

  return (
    <motion.span className={`tabular-nums ${className}`}>
      {reduce ? FORMATTERS[format](value) : text}
    </motion.span>
  );
}

/**
 * Barra de proporción. Crece desde cero para que el ojo lea la magnitud
 * relativa antes que el número exacto.
 */
export function Bar({
  value,
  tone = 'ink',
  delay = 0,
}: {
  value: number;
  tone?: 'ink' | 'accent' | 'positivo' | 'negativo';
  delay?: number;
}) {
  const reduce = useReducedMotion();
  const fill = {
    ink: 'bg-brand-ink/70',
    accent: 'bg-brand-gold',
    positivo: 'bg-emerald-600',
    negativo: 'bg-rose-500',
  }[tone];

  return (
    <div className="h-1 bg-brand-ink/8 rounded-full overflow-hidden">
      <motion.div
        className={`h-full rounded-full ${fill}`}
        initial={reduce ? false : { width: 0 }}
        animate={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        transition={{ duration: 0.7, delay: reduce ? 0 : delay, ease: EASE }}
      />
    </div>
  );
}

export function Tag({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-brand-bone border border-brand-ink/10 rounded-lg text-[11px] font-semibold text-brand-ink/70">
      {icon}
      {text}
    </span>
  );
}

/** Encabezado de bloque dentro de una tarjeta. */
export function BlockTitle({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] font-semibold text-brand-ink/40">
      {icon}
      {children}
    </div>
  );
}

