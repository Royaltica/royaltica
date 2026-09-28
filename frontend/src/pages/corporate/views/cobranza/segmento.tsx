import React from 'react';
import { ArrowRight, UserCog } from 'lucide-react';
import { CURRENCY_FORMATTER } from '../../../../utils/format.ts';
import { Reveal, BlockTitle, Figure } from './primitives.tsx';
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
 * Resumen de segmentos (Administrador y Supervisor): cuántos clientes hay en
 * cada uno, quién cambió de segmento y cambio manual con motivo.
 */
export function SegmentosPanel() {
  const { cartera, cambiarSegmento, cambiosSegmento } = useCobranza();
  const [sel, setSel] = React.useState<Segmento | null>(null);
  const [editando, setEditando] = React.useState<string | null>(null);
  const [nuevo, setNuevo] = React.useState<Segmento>('olvidadizo');
  const [motivo, setMotivo] = React.useState('');

  // Quién cambió de segmento: comparado contra hace 3 facturas.
  const movimientos = cartera
    .map((c) => ({ c, antes: diagnosticoAnterior(c).segmento }))
    .filter(({ c, antes }) => antes !== c.diagnostico.segmento && c.historial.length > 3);

  const lista = cartera.filter((c) => !sel || c.segmento === sel);

  const guardar = (id: string) => {
    if (!motivo.trim()) return;
    cambiarSegmento(id, nuevo, motivo.trim());
    setEditando(null);
    setMotivo('');
  };

  return (
    <div className="space-y-5">
      <Reveal>
        <p className="text-sm text-brand-ink/55 max-w-[70ch] leading-relaxed">
          Cada cliente se clasifica solo con su historial de pagos de los últimos 12 meses (puntualidad,
          días de atraso, tendencia y promesas cumplidas). El segmento decide su plan: calendario, tono,
          canal y a qué campañas entra. Se recalcula con cada pago.
        </p>
      </Reveal>

      {/* Distribución */}
      <Reveal delay={0.04}>
        <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-2.5">
          {ORDEN.map((id) => {
            const s = SEGMENTOS[id];
            const suyas = cartera.filter((c) => c.segmento === id);
            const activo = sel === id;
            return (
              <button
                key={id}
                onClick={() => setSel(activo ? null : id)}
                className={`text-left rounded-2xl border px-4 py-3 transition-colors ${
                  activo ? 'border-brand-gold/60 bg-brand-cream' : 'border-brand-ink/10 bg-brand-paper hover:bg-brand-bone'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${s.punto}`} />
                  <span className="text-[11px] font-semibold text-brand-ink/70">{s.nombre}</span>
                </span>
                <span className="block text-2xl font-serif text-brand-ink mt-1">
                  <Figure value={suyas.length} />
                </span>
                <span className="block text-[11px] text-brand-ink/45 tabular-nums">
                  {CURRENCY_FORMATTER.format(suyas.reduce((a, c) => a + saldoDe(c), 0))}
                </span>
              </button>
            );
          })}
        </div>
      </Reveal>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Clientes */}
        <Reveal delay={0.08} className="lg:col-span-3">
          <div className="bg-brand-paper border border-brand-ink/10 rounded-3xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-brand-ink/8">
              <BlockTitle>{sel ? SEGMENTOS[sel].nombre : 'Todos los clientes'}</BlockTitle>
              {sel && <p className="text-[11px] text-brand-ink/45 max-w-[36ch] text-right">{SEGMENTOS[sel].trato}</p>}
            </div>
            <div className="divide-y divide-brand-ink/6">
              {lista.map((c) => (
                <div key={c.id} className="px-6 py-3.5">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-brand-ink">{c.cliente}</div>
                      <div className="text-[11px] text-brand-ink/50 mt-0.5 leading-relaxed">
                        {c.segmentoManual ? `Cambiado a mano: ${c.segmentoManual.motivo}` : c.diagnostico.porque}
                      </div>
                    </div>
                    <SegmentoChip cuenta={c} alinear="derecha" />
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
                        {ORDEN.map((s) => (
                          <option key={s} value={s}>
                            {SEGMENTOS[s].nombre}
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
            </div>
          </div>
        </Reveal>

        {/* Cambios */}
        <Reveal delay={0.12} className="lg:col-span-2 space-y-5">
          <div className="bg-brand-paper border border-brand-ink/10 rounded-3xl p-6">
            <BlockTitle>Cambiaron de segmento</BlockTitle>
            <ul className="mt-3 space-y-3">
              {movimientos.map(({ c, antes }) => (
                <li key={c.id}>
                  <div className="text-sm font-semibold text-brand-ink">{c.cliente}</div>
                  <div className="flex items-center gap-1.5 mt-1 text-[11px]">
                    <span className="text-brand-ink/45">{SEGMENTOS[antes].nombre}</span>
                    <ArrowRight size={11} className="text-brand-ink/30" />
                    <span className="font-semibold text-brand-ink/75">{SEGMENTOS[c.diagnostico.segmento].nombre}</span>
                  </div>
                </li>
              ))}
              {movimientos.length === 0 && <li className="text-sm text-brand-ink/45">Nadie cambió este mes.</li>}
            </ul>
          </div>
          <div className="bg-brand-paper border border-brand-ink/10 rounded-3xl p-6">
            <BlockTitle>Cambios manuales</BlockTitle>
            <ul className="mt-3 space-y-3">
              {cambiosSegmento.map((m, i) => (
                <li key={i} className="text-[12px]">
                  <div className="font-semibold text-brand-ink">{m.cliente}</div>
                  <div className="text-brand-ink/55">
                    {SEGMENTOS[m.de].nombre} → {SEGMENTOS[m.a].nombre} · {m.hora}
                  </div>
                  <div className="text-brand-ink/45 italic">{m.motivo}</div>
                </li>
              ))}
              {cambiosSegmento.length === 0 && (
                <li className="text-sm text-brand-ink/45">Sin cambios manuales. Todo el segmento sale del historial.</li>
              )}
            </ul>
          </div>
        </Reveal>
      </div>
    </div>
  );
}
