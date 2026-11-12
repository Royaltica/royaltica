import React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { SPRING, SPRING_SUAVE } from './campanasUi.tsx';
import { BTN_PRI, BTN_SEC, CONTROL, ETIQUETA, Ventana } from './clientes.tsx';

// Piezas compartidas del lenguaje de vidrio de Cobranza IA: subpestañas,
// confirmaciones y estados vacíos. Lo de Campañas, llevado a todo el módulo.

// ── Subpestañas ───────────────────────────────────────────────────────

export type OpcionSub<T extends string> = { id: T; nombre: string; n?: number; icono?: React.ReactNode; alerta?: boolean };

/**
 * Control segmentado de vidrio para dividir una pestaña en partes y no
 * mostrar todo a la vez. El resaltado viaja entre opciones (layoutId).
 */
export function Subpestanas<T extends string>({
  opciones,
  valor,
  onChange,
  grupo,
  etiqueta,
}: {
  opciones: OpcionSub<T>[];
  valor: T;
  onChange: (v: T) => void;
  /** Nombre único para la animación del resaltado. */
  grupo: string;
  etiqueta: string;
}) {
  const reduce = useReducedMotion();
  return (
    <div
      role="tablist"
      aria-label={etiqueta}
      className="glass inline-flex max-w-full items-center gap-0.5 rounded-full p-1 overflow-x-auto [scrollbar-width:none]"
    >
      {opciones.map((o) => {
        const activa = o.id === valor;
        return (
          <button
            key={o.id}
            type="button"
            role="tab"
            aria-selected={activa}
            onClick={() => onChange(o.id)}
            className={`relative shrink-0 inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[12.5px] font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand-gold/70 ${
              activa ? 'text-white' : 'text-brand-ink/55 hover:text-brand-ink'
            }`}
          >
            {activa && (
              <motion.span
                layoutId={reduce ? undefined : `sub-${grupo}`}
                transition={SPRING}
                className="absolute inset-0 rounded-full bg-brand-ink shadow-[0_8px_22px_-10px_rgba(17,24,39,0.7)]"
              />
            )}
            {o.icono && <span className={`relative ${activa ? 'text-brand-gold' : ''}`}>{o.icono}</span>}
            <span className="relative">{o.nombre}</span>
            {o.n !== undefined && (
              <span
                className={`relative tabular-nums text-[11px] rounded-full px-1.5 min-w-[20px] text-center ${
                  activa ? 'bg-white/15 text-white/85' : o.alerta && o.n > 0 ? 'bg-amber-500/15 text-amber-800' : 'bg-brand-ink/[0.06] text-brand-ink/50'
                }`}
              >
                {o.n}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Contenido de una subpestaña: entra suave al cambiar. */
export function PanelSub({ id, children }: { id: string; children: React.ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={id}
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
        transition={reduce ? { duration: 0 } : SPRING_SUAVE}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

/** Encabezado de sección: título corto, ayuda opcional y acciones a la derecha. */
export function EncabezadoSeccion({
  titulo,
  detalle,
  children,
}: {
  titulo: string;
  detalle?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
      <div className="min-w-0">
        <h3 className="text-xl text-brand-ink tracking-tight">{titulo}</h3>
        {detalle && <p className="text-[13px] text-brand-ink/50 mt-0.5 max-w-[70ch] leading-relaxed">{detalle}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

/** Estado vacío amable: qué pasa y qué hacer. */
export function Vacio({ icono, titulo, detalle, children }: { icono?: React.ReactNode; titulo: string; detalle?: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center text-center px-6 py-12">
      {icono && <span className="w-12 h-12 rounded-2xl bg-brand-ink/[0.05] text-brand-ink/45 flex items-center justify-center">{icono}</span>}
      <p className="text-[15px] font-semibold text-brand-ink mt-4">{titulo}</p>
      {detalle && <p className="text-[13px] text-brand-ink/50 mt-1 max-w-[46ch] leading-relaxed">{detalle}</p>}
      {children && <div className="mt-5">{children}</div>}
    </div>
  );
}

// ── Confirmación ──────────────────────────────────────────────────────

export type PedidoConfirmacion = {
  titulo: string;
  mensaje?: React.ReactNode;
  /** Texto del botón que ejecuta la acción. */
  accion: string;
  /** Rojo: eliminar, cancelar o algo que no se deshace fácil. */
  peligro?: boolean;
  /** Pide un dato antes de confirmar (motivo, fecha, referencia). */
  campo?: { tipo: 'texto' | 'fecha'; etiqueta: string; requerido?: boolean; placeholder?: string; inicial?: string; max?: string };
  /** Lo que se hace al confirmar. Si regresa un texto, es un error y la ventana sigue abierta. */
  alConfirmar: (valor: string) => Promise<string | null | void> | string | null | void;
};

/**
 * Confirmación antes de cualquier acción importante (editar, eliminar,
 * marcar como pagada…). Uso: `const { confirmar, nodo } = useConfirmar()`;
 * llama `confirmar({...})` y pinta `nodo` una vez en el componente.
 */
export function useConfirmar() {
  const [pedido, setPedido] = React.useState<PedidoConfirmacion | null>(null);
  const confirmar = React.useCallback((p: PedidoConfirmacion) => setPedido(p), []);
  const nodo = pedido ? <DialogoConfirmar pedido={pedido} onCerrar={() => setPedido(null)} /> : null;
  return { confirmar, nodo };
}

function DialogoConfirmar({ pedido: p, onCerrar }: { pedido: PedidoConfirmacion; onCerrar: () => void }) {
  const reduce = useReducedMotion();
  const [valor, setValor] = React.useState(p.campo?.inicial ?? '');
  const [ocupado, setOcupado] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const falta = !!p.campo?.requerido && !valor.trim();

  const ejecutar = async () => {
    if (falta || ocupado) return;
    setOcupado(true);
    setError(null);
    try {
      const err = await p.alConfirmar(valor.trim());
      if (typeof err === 'string' && err) {
        setError(err);
        return;
      }
      onCerrar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo completar.');
    } finally {
      setOcupado(false);
    }
  };

  return (
    <Ventana titulo={p.titulo} onCerrar={onCerrar} ancho="max-w-md">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void ejecutar();
        }}
        className="space-y-4"
      >
        {p.peligro && (
          <motion.span
            initial={reduce ? false : { scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={SPRING}
            className="w-11 h-11 rounded-2xl bg-rose-500/10 text-rose-600 flex items-center justify-center"
          >
            <AlertTriangle size={18} />
          </motion.span>
        )}
        {p.mensaje && <div className="text-[13px] text-brand-ink/65 leading-relaxed">{p.mensaje}</div>}
        {p.campo && (
          <label className="block">
            <span className={ETIQUETA}>
              {p.campo.etiqueta}
              {p.campo.requerido ? ' *' : ''}
            </span>
            <input
              autoFocus
              type={p.campo.tipo === 'fecha' ? 'date' : 'text'}
              className={CONTROL + ' mt-1.5'}
              value={valor}
              max={p.campo.max}
              placeholder={p.campo.placeholder}
              onChange={(e) => setValor(e.target.value)}
            />
          </label>
        )}
        {error && <p className="text-[12.5px] text-rose-700 bg-rose-500/10 rounded-2xl px-3.5 py-2.5">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" autoFocus={!p.campo} onClick={onCerrar} className={BTN_SEC + ' !py-2.5 !px-4 !text-[12.5px]'}>
            Volver
          </button>
          <button
            type="submit"
            disabled={falta || ocupado}
            className={p.peligro ? BTN_PRI + ' !bg-rose-600 hover:!bg-rose-700 !shadow-[0_10px_30px_-12px_rgba(225,29,72,0.6)]' : BTN_PRI}
          >
            {ocupado && <Loader2 size={13} className="animate-spin" />} {p.accion}
          </button>
        </div>
      </form>
    </Ventana>
  );
}
