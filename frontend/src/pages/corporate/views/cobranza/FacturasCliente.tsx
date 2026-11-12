import React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Ban, Check, Loader2, RotateCcw } from 'lucide-react';
import { CURRENCY_FORMATTER } from '../../../../utils/format.ts';
import { api, type Receivable } from '../../../../services/apiClient.ts';
import { useCobranza, type CuentaViva } from './store.tsx';
import { SPRING } from './campanasUi.tsx';
import { useConfirmar, Vacio } from './vidrio.tsx';

/**
 * Todas las facturas de un cliente, en una lista sencilla, con un checador
 * manual: tocar el círculo marca la factura como pagada (o la regresa a
 * pendiente). Cada cambio pide confirmación y queda en la bitácora.
 */

const fmt = (n: number) => CURRENCY_FORMATTER.format(n);
const hoyIso = () => new Date().toISOString().slice(0, 10);
const DIA = 86_400_000;

type Estado = 'pendiente' | 'pagada' | 'cancelada';
type Fila = {
  id: string;
  dbId?: string;
  folio: string;
  total: number;
  /** Para mostrar ("12 oct 2026"). */
  emision: string;
  /** Para ordenar (ISO, o el índice en datos de ejemplo). */
  orden: string;
  /** Días respecto al vencimiento (positivo = vencida). Null = sin vencimiento. */
  dias: number | null;
  pagada: string | null;
  estado: Estado;
};
type Vista = 'por_cobrar' | 'pagadas' | 'todas';

const desdeApi = (r: Receivable): Fila => ({
  id: r.id,
  dbId: r.id,
  folio: r.folio ?? r.cfdiUuid.slice(0, 8),
  total: r.total,
  emision: fechaCorta(r.date.slice(0, 10)),
  orden: r.date,
  dias: r.dueDate ? Math.round((Date.parse(hoyIso()) - Date.parse(r.dueDate.slice(0, 10))) / DIA) : null,
  pagada: r.paidDate?.slice(0, 10) ?? null,
  estado: r.status === 'PAID' ? 'pagada' : r.status === 'REJECTED' ? 'cancelada' : 'pendiente',
});

const fechaCorta = (iso: string | null) => {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'][m - 1]} ${y}`;
};

export function FacturasCliente({ cuenta: c, avisar }: { cuenta: CuentaViva; avisar: (t: string, o?: { error?: boolean }) => void }) {
  const reduce = useReducedMotion();
  const { cobrarFactura, revertirCobro, cancelarFactura } = useCobranza();
  const { confirmar, nodo } = useConfirmar();
  const real = !!c.dbId;
  const [filas, setFilas] = React.useState<Fila[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [vista, setVista] = React.useState<Vista>('por_cobrar');

  const cargar = React.useCallback(async () => {
    if (!c.dbId) {
      // Ejemplo: las facturas abiertas de la cartera de ejemplo.
      setFilas(
        c.facturas.map((f, i) => ({
          id: `${c.id}-${i}`,
          folio: f.folio,
          total: f.monto - f.pagado,
          emision: f.emision,
          orden: String(i).padStart(4, '0'),
          dias: f.dias,
          pagada: null,
          estado: 'pendiente',
        })),
      );
      return;
    }
    setError(null);
    try {
      const r = await api.getReceivables({ customerId: c.dbId });
      setFilas(r.map(desdeApi));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron traer las facturas.');
    }
  }, [c.dbId, c.id, c.facturas]);
  React.useEffect(() => {
    void cargar();
  }, [cargar]);

  /** En ejemplo, el cambio se refleja solo en pantalla. */
  const local = (id: string, cambio: Partial<Fila>) => setFilas((fs) => fs?.map((f) => (f.id === id ? { ...f, ...cambio } : f)) ?? fs);

  const marcarPagada = (f: Fila) =>
    confirmar({
      titulo: `¿Marcar ${f.folio} como pagada?`,
      accion: 'Marcar pagada',
      mensaje: (
        <>
          {c.cliente} · <b className="text-brand-ink">{fmt(f.total)}</b>. Su plan de cobranza se detiene. Si te equivocas, la regresas a
          pendiente con un toque.
        </>
      ),
      campo: { tipo: 'fecha', etiqueta: 'Fecha en que pagó', requerido: true, inicial: hoyIso(), max: hoyIso() },
      alConfirmar: async (fecha) => {
        if (!f.dbId) {
          local(f.id, { estado: 'pagada', pagada: fecha });
          avisar(`${f.folio} quedó como pagada (ejemplo, no se guarda)`);
          return;
        }
        const err = await cobrarFactura(f.dbId, fecha);
        if (err) return err;
        await cargar();
        avisar(`${f.folio} quedó como pagada`);
      },
    });

  const regresarPendiente = (f: Fila) =>
    confirmar({
      titulo: `¿Regresar ${f.folio} a pendiente?`,
      accion: 'Regresar a pendiente',
      mensaje: 'Vuelve a la cartera por cobrar y su plan sigue donde iba. El motivo queda en la bitácora.',
      campo: { tipo: 'texto', etiqueta: 'Motivo', requerido: true, placeholder: 'Ej. El pago se rechazó en el banco' },
      alConfirmar: async (motivo) => {
        if (!f.dbId) {
          local(f.id, { estado: 'pendiente', pagada: null });
          avisar(`${f.folio} regresó a pendiente (ejemplo)`);
          return;
        }
        const err = await revertirCobro(f.dbId, motivo);
        if (err) return err;
        await cargar();
        avisar(`${f.folio} regresó a pendiente`);
      },
    });

  const cancelar = (f: Fila) =>
    confirmar({
      titulo: `¿Cancelar la factura ${f.folio}?`,
      accion: 'Cancelar factura',
      peligro: true,
      mensaje: 'Sale de la cartera por cobrar y no se puede reactivar. Úsalo si se canceló ante el SAT o se capturó por error.',
      campo: { tipo: 'texto', etiqueta: 'Motivo', requerido: true, placeholder: 'Ej. Se sustituyó por la F-1030' },
      alConfirmar: async (motivo) => {
        if (!f.dbId) {
          local(f.id, { estado: 'cancelada' });
          avisar(`Cancelaste ${f.folio} (ejemplo)`);
          return;
        }
        const err = await cancelarFactura(f.dbId, motivo);
        if (err) return err;
        await cargar();
        avisar(`Cancelaste ${f.folio}`);
      },
    });

  if (error) {
    return (
      <div className="glass-suave rounded-2xl px-4 py-3 text-[12.5px] text-rose-700 flex items-center gap-3">
        {error}
        <button type="button" onClick={() => void cargar()} className="font-semibold underline">
          Reintentar
        </button>
      </div>
    );
  }
  if (!filas) {
    return (
      <div className="flex items-center gap-2 text-[12.5px] text-brand-ink/45 py-6 justify-center">
        <Loader2 size={14} className="animate-spin" /> Cargando facturas…
      </div>
    );
  }

  const porCobrar = filas.filter((f) => f.estado === 'pendiente');
  const pagadas = filas.filter((f) => f.estado === 'pagada');
  const visibles = [...(vista === 'por_cobrar' ? porCobrar : vista === 'pagadas' ? pagadas : filas)].sort((a, b) =>
    b.orden.localeCompare(a.orden),
  );
  const saldo = porCobrar.reduce((s, f) => s + f.total, 0);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mb-3">
        <p className="text-[13px] text-brand-ink/60 mr-auto">
          <b className="text-brand-ink tabular-nums">{fmt(saldo)}</b> por cobrar en {porCobrar.length}{' '}
          {porCobrar.length === 1 ? 'factura' : 'facturas'}
          {pagadas.length > 0 && <span className="text-brand-ink/40"> · {pagadas.length} pagadas</span>}
        </p>
        <div className="flex gap-1" role="tablist" aria-label="Qué facturas ver">
          {(
            [
              ['por_cobrar', 'Por cobrar', porCobrar.length],
              ['pagadas', 'Pagadas', pagadas.length],
              ['todas', 'Todas', filas.length],
            ] as const
          ).map(([id, nombre, n]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={vista === id}
              onClick={() => setVista(id)}
              className={`rounded-full px-3 py-1 text-[12px] font-semibold transition-colors ${
                vista === id ? 'bg-brand-ink text-white' : 'text-brand-ink/50 hover:text-brand-ink hover:bg-white/70'
              }`}
            >
              {nombre} <span className="opacity-60 tabular-nums">{n}</span>
            </button>
          ))}
        </div>
      </div>

      {!real && (
        <p className="text-[11.5px] text-brand-ink/40 mb-2">Datos de ejemplo: puedes probar el checador, pero los cambios no se guardan.</p>
      )}

      {visibles.length === 0 ? (
        <Vacio
          titulo={vista === 'por_cobrar' ? 'Sin facturas por cobrar' : vista === 'pagadas' ? 'Todavía sin pagos registrados' : 'Sin facturas'}
          detalle={vista === 'por_cobrar' ? 'Este cliente está al corriente.' : 'Sube sus facturas en la subpestaña Subir facturas.'}
        />
      ) : (
        <ul className="space-y-1.5">
          <AnimatePresence initial={false}>
            {visibles.map((f) => {
              const pagada = f.estado === 'pagada';
              const cancelada = f.estado === 'cancelada';
              const dias = f.dias;
              const situacion = pagada
                ? { texto: `Pagada el ${fechaCorta(f.pagada)}`, tono: 'text-emerald-700 bg-emerald-500/10' }
                : cancelada
                  ? { texto: 'Cancelada', tono: 'text-brand-ink/45 bg-brand-ink/[0.05]' }
                  : dias === null
                    ? { texto: 'Sin vencimiento', tono: 'text-brand-ink/50 bg-brand-ink/[0.05]' }
                    : dias > 0
                      ? { texto: `${dias} ${dias === 1 ? 'día' : 'días'} vencida`, tono: 'text-rose-700 bg-rose-500/10' }
                      : dias === 0
                        ? { texto: 'Vence hoy', tono: 'text-amber-800 bg-amber-500/12' }
                        : { texto: `Vence en ${-dias} ${dias === -1 ? 'día' : 'días'}`, tono: 'text-cyan-800 bg-brand-gold/10' };
              return (
                <motion.li
                  key={f.id}
                  layout={!reduce}
                  initial={reduce ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={SPRING}
                  className={`group glass-suave rounded-2xl flex items-center gap-3 pl-2.5 pr-3 py-2.5 ${cancelada ? 'opacity-55' : ''}`}
                >
                  {/* Checador */}
                  <button
                    type="button"
                    disabled={cancelada}
                    onClick={() => (pagada ? regresarPendiente(f) : marcarPagada(f))}
                    aria-pressed={pagada}
                    aria-label={pagada ? `${f.folio} pagada. Regresar a pendiente` : `Marcar ${f.folio} como pagada`}
                    title={pagada ? 'Regresar a pendiente' : 'Marcar como pagada'}
                    className={`relative shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/70 disabled:cursor-not-allowed ${
                      pagada
                        ? 'bg-emerald-500 text-white shadow-[0_6px_16px_-6px_rgba(16,185,129,0.7)] hover:bg-emerald-600'
                        : 'bg-white/80 ring-1 ring-brand-ink/15 text-transparent hover:text-emerald-600 hover:ring-emerald-500/60'
                    }`}
                  >
                    <motion.span key={String(pagada)} initial={reduce ? false : { scale: 0.4 }} animate={{ scale: 1 }} transition={SPRING}>
                      <Check size={15} strokeWidth={2.75} />
                    </motion.span>
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className={`text-[13.5px] font-semibold ${pagada ? 'text-brand-ink/55 line-through decoration-brand-ink/25' : 'text-brand-ink'}`}>
                        {f.folio}
                      </span>
                      <span className="text-[12px] text-brand-ink/40">Emitida {f.emision}</span>
                    </div>
                  </div>
                  <span className={`hidden sm:inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold ${situacion.tono}`}>
                    {situacion.texto}
                  </span>
                  <span className={`shrink-0 w-28 text-right text-[13.5px] font-semibold tabular-nums ${pagada ? 'text-brand-ink/45' : 'text-brand-ink'}`}>
                    {fmt(f.total)}
                  </span>
                  <span className="shrink-0 w-8 flex justify-end">
                    {f.estado === 'pendiente' ? (
                      <button
                        type="button"
                        onClick={() => cancelar(f)}
                        aria-label={`Cancelar ${f.folio}`}
                        title="Cancelar factura"
                        className="w-8 h-8 rounded-full flex items-center justify-center text-brand-ink/30 opacity-100 sm:opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:text-rose-600 hover:bg-rose-500/10 transition-all outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/70"
                      >
                        <Ban size={14} />
                      </button>
                    ) : pagada ? (
                      <RotateCcw size={13} className="text-brand-ink/20 mr-2" aria-hidden />
                    ) : null}
                  </span>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
      {nodo}
    </div>
  );
}
