import React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { CalendarClock, Scale, UserCog } from 'lucide-react';
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
  const { cartera, cambiarSegmento, cambiosSegmento } = useCobranza();
  const [sel, setSel] = React.useState<Segmento | null>(null);
  const [editando, setEditando] = React.useState<string | null>(null);
  const [nuevo, setNuevo] = React.useState<Segmento>('olvidadizo');
  const [motivo, setMotivo] = React.useState('');

  const guardar = (id: string) => {
    if (!motivo.trim()) return;
    cambiarSegmento(id, nuevo, motivo.trim());
    setEditando(null);
    setMotivo('');
  };

  const lista = sel ? cartera.filter((c) => c.segmento === sel) : [];

  return (
    <div className="space-y-5">
      <Reveal>
        <p className="text-sm text-brand-ink/55 max-w-[70ch] leading-relaxed">
          Cada cliente se clasifica solo con su historial de pagos de los últimos 12 meses. El
          segmento decide su plan: calendario, tono y a qué campañas entra. Da clic en un segmento
          para ver sus clientes y por qué están ahí.
        </p>
      </Reveal>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {ORDEN.map((id, i) => {
          const s = SEGMENTOS[id];
          const suyas = cartera.filter((c) => c.segmento === id);
          const aTiempo = suyas.length ? Math.round((suyas.reduce((a, c) => a + c.diagnostico.aTiempo, 0) / suyas.length) * 100) : 0;
          const entraron = cartera.filter(
            (c) => c.diagnostico.segmento === id && c.historial.length > 3 && diagnosticoAnterior(c).segmento !== id,
          );
          const activo = sel === id;
          return (
            <Reveal key={id} delay={0.04 + i * 0.04}>
              <motion.button
                onClick={() => setSel(activo ? null : id)}
                whileHover={reduce ? undefined : { y: -3 }}
                transition={{ duration: 0.25, ease: EASE }}
                aria-expanded={activo}
                className={`w-full text-left bg-brand-paper border rounded-3xl p-6 space-y-5 h-full transition-colors ${
                  activo ? 'border-brand-gold/60 shadow-sm' : 'border-brand-ink/10'
                }`}
              >
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
                  <p className="text-[11px] text-brand-ink/55 pt-3 border-t border-brand-ink/8">
                    Entraron este mes: <span className="font-semibold text-brand-ink/75">{entraron.map((c) => c.cliente).join(', ')}</span>
                  </p>
                )}
              </motion.button>
            </Reveal>
          );
        })}
      </div>

      {/* Lista del segmento seleccionado */}
      <AnimatePresence>
        {sel && (
          <motion.div
            key={sel}
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0 }}
            transition={{ duration: 0.25, ease: EASE }}
            className="bg-brand-paper border border-brand-gold/40 rounded-3xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-brand-ink/8">
              <BlockTitle>{SEGMENTOS[sel].nombre} · {lista.length} {lista.length === 1 ? 'cliente' : 'clientes'}</BlockTitle>
              <button onClick={() => setSel(null)} className="text-[11px] font-semibold text-brand-ink/45 hover:text-brand-ink">
                Cerrar
              </button>
            </div>
            <div className="divide-y divide-brand-ink/6">
              {lista.map((c) => (
                <div key={c.id} className="px-6 py-3.5">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-brand-ink">
                        {c.cliente}
                        <span className="ml-2 font-normal text-[11px] text-brand-ink/40">
                          {CURRENCY_FORMATTER.format(saldoDe(c))} · {c.agente}
                        </span>
                      </div>
                      <div className="text-[12px] text-brand-ink/55 mt-0.5 leading-relaxed">
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
                        Cambiar segmento
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
                        className="flex-1 min-w-[180px] px-3 py-2 rounded-xl border border-brand-ink/12 bg-brand-bone/50 text-[12px] outline-none focus:border-brand-gold/60"
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
                </div>
              ))}
              {lista.length === 0 && <p className="px-6 py-5 text-sm text-brand-ink/45">Ningún cliente en este segmento.</p>}
            </div>
            {cambiosSegmento.length > 0 && (
              <div className="px-6 py-4 border-t border-brand-ink/8 bg-brand-bone/40">
                <div className="text-[10px] uppercase tracking-[0.14em] text-brand-ink/40 mb-1.5">Cambios manuales</div>
                <ul className="space-y-1 text-[12px] text-brand-ink/60">
                  {cambiosSegmento.map((m, i) => (
                    <li key={i}>
                      {m.cliente}: {SEGMENTOS[m.de].nombre} → {SEGMENTOS[m.a].nombre} · {m.hora} · <span className="italic">{m.motivo}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
