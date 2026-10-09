import React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { CalendarClock, ChevronDown, Scale, UserCog } from 'lucide-react';
import { CURRENCY_FORMATTER } from '../../../../utils/format.ts';
import { EASE, Reveal, BlockTitle, Figure, Bar, Tag } from './primitives.tsx';
import { SEGMENTOS, diagnosticoAnterior, saldoDe, type Segmento } from './mockV1.ts';
import { useCobranza, type CuentaViva } from './store.tsx';

/**
 * Etiqueta de segmento. Al pasar el cursor (o enfocar con teclado) explica
 * por qué el cliente está ahí y cómo se le cobra. Si un supervisor lo cambió
 * a mano, lo dice y muestra su motivo.
 */
export function SegmentoChip({ cuenta, alinear = 'izquierda' }: { cuenta: CuentaViva; alinear?: 'izquierda' | 'derecha' }) {
  const seg = SEGMENTOS[cuenta.segmento];
  return (
    <span className="relative group inline-flex" tabIndex={0}>
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-semibold whitespace-nowrap ${seg.chip}`}>
        {seg.nombre}
        {cuenta.segmentoManual && <UserCog size={10} aria-label="Cambiado a mano" />}
      </span>
      <span
        role="tooltip"
        className={`pointer-events-none absolute top-full mt-1.5 z-30 w-72 rounded-2xl border border-brand-ink/10 bg-brand-paper shadow-lg px-4 py-3 text-left opacity-0 translate-y-1 transition duration-150 group-hover:opacity-100 group-hover:translate-y-0 group-focus:opacity-100 group-focus:translate-y-0 ${
          alinear === 'derecha' ? 'right-0' : 'left-0'
        }`}
      >
        <span className="block text-[12px] font-semibold text-brand-ink">{seg.nombre}</span>
        <span className="block text-[12px] text-brand-ink/65 leading-relaxed mt-1">
          {cuenta.segmentoManual
            ? `Cambiado a mano por supervisor: ${cuenta.segmentoManual.motivo}`
            : cuenta.diagnostico.porque}
        </span>
        <span className="block text-[11px] text-brand-ink/45 leading-relaxed mt-2 pt-2 border-t border-brand-ink/8">{seg.trato}</span>
      </span>
    </span>
  );
}

const ORDEN: Segmento[] = ['puntual', 'tardio', 'olvidadizo', 'nuevo', 'deterioro', 'moroso', 'disputa'];

/**
 * Segmentos (Administrador y Supervisor): un recuadro por segmento con su
 * trato; al darle clic se abre la lista de sus clientes con el porqué y la
 * opción de cambiarlo a mano (con motivo obligatorio).
 */
export function SegmentosPanel() {
  const reduce = useReducedMotion();
  const { cartera, cambiosSegmento } = useCobranza();
  // Varios recuadros pueden estar abiertos a la vez.
  const [abiertos, setAbiertos] = React.useState<Set<Segmento>>(new Set());
  const alternar = (id: Segmento) =>
    setAbiertos((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="space-y-5">
      <Reveal>
        <p className="text-sm text-brand-ink/55 max-w-[70ch] leading-relaxed">
          Cada cliente se clasifica solo con su historial de pagos de los últimos 12 meses. El
          segmento decide su plan: calendario, tono y a qué campañas entra. Da clic en un segmento
          para ver sus clientes y por qué están ahí.
        </p>
      </Reveal>

      {/* items-start: abrir un recuadro no estira al de al lado */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        {ORDEN.map((id, i) => {
          const s = SEGMENTOS[id];
          const suyas = cartera.filter((c) => c.segmento === id);
          const aTiempo = suyas.length ? Math.round((suyas.reduce((a, c) => a + c.diagnostico.aTiempo, 0) / suyas.length) * 100) : 0;
          const entraron = cartera.filter(
            (c) => c.diagnostico.segmento === id && c.historial.length > 3 && diagnosticoAnterior(c).segmento !== id,
          );
          const abierto = abiertos.has(id);
          return (
            <Reveal key={id} delay={0.04 + i * 0.04}>
              <div
                className={`bg-brand-paper border rounded-3xl overflow-hidden transition-colors ${
                  abierto ? 'border-brand-gold/60 shadow-sm' : 'border-brand-ink/10 hover:border-brand-ink/20'
                }`}
              >
                <button onClick={() => alternar(id)} aria-expanded={abierto} className="w-full text-left p-6 space-y-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h4 className="flex items-center gap-2 text-xl font-serif text-brand-ink">
                        <span className={`w-2 h-2 rounded-full ${s.punto}`} />
                        {s.nombre}
                      </h4>
                      <p className="text-xs text-brand-ink/50 mt-1.5 leading-relaxed max-w-[40ch]">{s.trato}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-3xl font-serif text-brand-ink leading-none">
                        <Figure value={suyas.length} />
                      </div>
                      <div className="text-[10px] uppercase tracking-[0.14em] text-brand-ink/35 mt-1.5">clientes</div>
                      <div className="text-[11px] text-brand-ink/50 tabular-nums mt-1">
                        {CURRENCY_FORMATTER.format(suyas.reduce((a, c) => a + saldoDe(c), 0))}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Tag icon={<CalendarClock size={11} />} text={s.calendario} />
                    {s.tono !== '—' && <Tag icon={<Scale size={11} />} text={`Tono ${s.tono}`} />}
                  </div>

                  {id === 'nuevo' ? (
                    <p className="text-[12px] text-brand-ink/45">Sin historial de pagos todavía.</p>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <Bar value={aTiempo} tone="accent" delay={0.2 + i * 0.04} />
                      </div>
                      <span className="text-sm font-semibold text-brand-ink tabular-nums shrink-0">
                        <Figure value={aTiempo} format="porcentaje" /> pagado a tiempo
                      </span>
                    </div>
                  )}

                  {entraron.length > 0 && (
                    <p className="text-[11px] text-brand-ink/55">
                      Entraron este mes: <span className="font-semibold text-brand-ink/75">{entraron.map((c) => c.cliente).join(', ')}</span>
                    </p>
                  )}

                  <span className="flex items-center gap-1 text-[12px] font-semibold text-brand-ink/55">
                    {abierto ? 'Ocultar clientes' : `Ver ${suyas.length === 1 ? 'el cliente' : `los ${suyas.length} clientes`}`}
                    <ChevronDown size={14} className={`transition-transform duration-200 ${abierto ? 'rotate-180' : ''}`} />
                  </span>
                </button>

                <AnimatePresence initial={false}>
                  {abierto && (
                    <motion.div
                      initial={reduce ? false : { height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={reduce ? undefined : { height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: EASE }}
                      className="overflow-hidden border-t border-brand-ink/8"
                    >
                      <ClientesSegmento lista={suyas} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </Reveal>
          );
        })}
      </div>

      {cambiosSegmento.length > 0 && (
        <Reveal>
          <div className="bg-brand-paper border border-brand-ink/10 rounded-3xl px-6 py-4">
            <BlockTitle>Cambios manuales</BlockTitle>
            <ul className="mt-2 space-y-1 text-[12px] text-brand-ink/60">
              {cambiosSegmento.map((m, i) => (
                <li key={i}>
                  {m.cliente}: {SEGMENTOS[m.de].nombre} → {SEGMENTOS[m.a].nombre} · {m.hora} · <span className="italic">{m.motivo}</span>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      )}
    </div>
  );
}

/** Clientes de un segmento, con su porqué y el cambio manual (motivo obligatorio). */
function ClientesSegmento({ lista }: { lista: CuentaViva[] }) {
  const { cambiarSegmento } = useCobranza();
  const [editando, setEditando] = React.useState<string | null>(null);
  const [nuevo, setNuevo] = React.useState<Segmento>('olvidadizo');
  const [motivo, setMotivo] = React.useState('');

  const guardar = (id: string) => {
    if (!motivo.trim()) return;
    cambiarSegmento(id, nuevo, motivo.trim());
    setEditando(null);
    setMotivo('');
  };

  if (!lista.length) return <p className="px-6 py-4 text-sm text-brand-ink/45">Ningún cliente en este segmento.</p>;

  return (
    <ul className="divide-y divide-brand-ink/6">
      {lista.map((c) => (
        <li key={c.id} className="px-6 py-3.5">
          <div className="flex flex-wrap items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-brand-ink">
                {c.cliente}
                {c.saldada && <span className="ml-2 audit-badge bg-emerald-50 text-emerald-700">Saldada</span>}
                {c.comportamiento.esperaDescuentos && (
                  <span className="ml-2 audit-badge bg-rose-50 text-rose-700">Espera descuentos</span>
                )}
              </div>
              <div className="text-[11px] text-brand-ink/40 mt-0.5">
                {CURRENCY_FORMATTER.format(saldoDe(c))} por cobrar · {c.agente}
              </div>
              <div className="text-[12px] text-brand-ink/60 mt-1 leading-relaxed">
                {c.segmentoManual ? `Cambiado a mano: ${c.segmentoManual.motivo}` : c.diagnostico.porque}
              </div>
            </div>
            {editando !== c.id && (
              <button
                onClick={() => {
                  setEditando(c.id);
                  setNuevo(c.segmento);
                }}
                className="text-[11px] font-semibold text-brand-ink/50 hover:text-brand-ink"
              >
                Cambiar
              </button>
            )}
          </div>
          {editando === c.id && (
            <div className="mt-2.5 flex flex-wrap gap-2">
              <select
                value={nuevo}
                onChange={(e) => setNuevo(e.target.value as Segmento)}
                className="px-3 py-2 rounded-xl border border-brand-ink/12 bg-brand-bone/50 text-[12px] font-semibold outline-none focus:border-brand-gold/60"
              >
                {ORDEN.map((x) => (
                  <option key={x} value={x}>
                    {SEGMENTOS[x].nombre}
                  </option>
                ))}
              </select>
              <input
                autoFocus
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Motivo (obligatorio)"
                className="flex-1 min-w-[160px] px-3 py-2 rounded-xl border border-brand-ink/12 bg-brand-bone/50 text-[12px] outline-none focus:border-brand-gold/60"
              />
              <button
                onClick={() => guardar(c.id)}
                disabled={!motivo.trim()}
                className="px-3 py-2 rounded-xl bg-brand-ink text-brand-paper text-[12px] font-semibold disabled:opacity-40"
              >
                Guardar
              </button>
              {c.segmentoManual && (
                <button
                  onClick={() => {
                    cambiarSegmento(c.id, null, '');
                    setEditando(null);
                  }}
                  className="px-3 py-2 rounded-xl border border-brand-ink/12 text-[12px] font-semibold text-brand-ink/60"
                >
                  Volver al calculado
                </button>
              )}
              <button onClick={() => setEditando(null)} className="px-2 text-[12px] text-brand-ink/45">
                Cancelar
              </button>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
