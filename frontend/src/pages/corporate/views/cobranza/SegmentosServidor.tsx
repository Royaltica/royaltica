import React from 'react';
import { ChevronDown, RefreshCw } from 'lucide-react';
import { api, type CustomerSegmentId, type PortfolioSegments } from '../../../../services/apiClient.ts';
import { CURRENCY_FORMATTER } from '../../../../utils/format.ts';
import { SEGMENTOS } from './mockV1.ts';

const ORDEN: CustomerSegmentId[] = ['puntual', 'tardio', 'olvidadizo', 'nuevo', 'deterioro', 'moroso', 'disputa'];

const RIESGO: Record<string, string> = {
  SANO: 'Sano',
  ATENCION: 'Atención',
  RIESGO: 'Riesgo',
  INCOBRABLE: 'Incobrable',
  SIN_CALCULAR: 'Sin calcular',
};

/**
 * "Cómo pagan hoy": segmentos calculados en el servidor con el historial real
 * de pagos (GET /receivables/segments). Cada recuadro muestra cuántos clientes
 * y cuánto deben; al abrirlo, cada cliente con el motivo de su segmento.
 * El mismo cálculo dispara el aviso diario cuando un cliente empeora.
 */
export function SegmentosServidor() {
  const [data, setData] = React.useState<PortfolioSegments | null | undefined>(undefined);
  const [abierto, setAbierto] = React.useState<CustomerSegmentId | null>(null);
  const [carga, setCarga] = React.useState(0);

  React.useEffect(() => {
    let vigente = true;
    setData(undefined);
    api
      .getSegments()
      .then((d) => { if (vigente) setData(d); })
      .catch(() => { if (vigente) setData(null); });
    return () => { vigente = false; };
  }, [carga]);

  const encabezado = (
    <div className="flex items-start justify-between gap-3">
      <div>
        <h3 className="text-xl font-serif text-brand-ink">Cómo pagan hoy</h3>
        <p className="text-xs text-brand-ink/55 mt-1 max-w-[70ch] leading-relaxed">
          Calculado con el historial real de pagos de cada cliente. Si alguien pasa a "En deterioro" o "Moroso recurrente", te llega un aviso.
          {data ? ` Actualizado ${new Date(data.generatedAt).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}.` : ''}
        </p>
      </div>
      <button
        type="button"
        onClick={() => setCarga((n) => n + 1)}
        className="inline-flex items-center gap-1.5 rounded-full border border-brand-ink/12 px-3 py-1.5 text-[12px] font-semibold text-brand-ink/70 hover:bg-brand-ink/5"
      >
        <RefreshCw size={12} /> Actualizar
      </button>
    </div>
  );

  if (data === undefined) {
    return (
      <section className="glass rounded-[28px] p-6 space-y-4" aria-label="Cómo pagan hoy">
        {encabezado}
        <p role="status" className="text-sm text-brand-ink/50">Calculando segmentos…</p>
      </section>
    );
  }
  if (data === null) {
    return (
      <section className="glass rounded-[28px] p-6 space-y-4" aria-label="Cómo pagan hoy">
        {encabezado}
        <p role="alert" className="text-sm text-red-700">No se pudieron calcular los segmentos. Intenta actualizar.</p>
      </section>
    );
  }

  const porSegmento = new Map<CustomerSegmentId, PortfolioSegments['segments'][number]>(
    data.segments.map((s) => [s.segment, s] as const),
  );
  const clientes = abierto ? data.customers.filter((c) => c.segment === abierto) : [];
  const total = data.customers.length;

  return (
    <section className="glass rounded-[28px] p-6 space-y-5" aria-label="Cómo pagan hoy">
      {encabezado}

      {total === 0 ? (
        <p className="text-sm text-brand-ink/55">Todavía no hay clientes con facturas para calcular segmentos.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-2.5">
            {ORDEN.map((id) => {
              const s = porSegmento.get(id);
              const n = s?.count ?? 0;
              const seg = SEGMENTOS[id];
              const activo = abierto === id;
              return (
                <button
                  key={id}
                  type="button"
                  disabled={n === 0}
                  aria-expanded={activo}
                  onClick={() => setAbierto(activo ? null : id)}
                  title={seg.trato}
                  className={`text-left rounded-2xl border p-3 transition-colors disabled:opacity-45 disabled:cursor-default ${
                    activo ? 'border-brand-ink/40 bg-white' : 'border-brand-ink/10 bg-white/50 hover:bg-white'
                  }`}
                >
                  <span className="flex items-center gap-1.5 text-[11.5px] font-semibold text-brand-ink/75">
                    <span className={`w-2 h-2 rounded-full ${seg.punto}`} aria-hidden />
                    {s?.name ?? seg.nombre}
                  </span>
                  <span className="block text-2xl font-serif text-brand-ink mt-1.5 leading-none">{n}</span>
                  <span className="block text-[11px] text-brand-ink/50 tabular-nums mt-1">
                    {CURRENCY_FORMATTER.format(s?.outstanding ?? 0)}
                  </span>
                </button>
              );
            })}
          </div>

          {abierto && (
            <div className="rounded-2xl border border-brand-ink/10 bg-white/70">
              <div className="flex items-center justify-between px-4 pt-3">
                <div className="text-[13px] font-semibold text-brand-ink">
                  {SEGMENTOS[abierto].nombre} · {clientes.length} cliente{clientes.length === 1 ? '' : 's'}
                </div>
                <button type="button" onClick={() => setAbierto(null)} className="text-[12px] text-brand-ink/55 inline-flex items-center gap-1">
                  Cerrar <ChevronDown size={13} className="rotate-180" />
                </button>
              </div>
              <p className="px-4 pt-1 text-[11.5px] text-brand-ink/50">{SEGMENTOS[abierto].trato}</p>
              <ul className="divide-y divide-brand-ink/8 mt-2">
                {clientes.map((c) => (
                  <li key={c.id} className="px-4 py-2.5 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[13px] font-semibold text-brand-ink truncate">{c.name}</div>
                      <div className="text-[12px] text-brand-ink/60 leading-relaxed">{c.reason}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[12.5px] font-semibold text-brand-ink tabular-nums">{CURRENCY_FORMATTER.format(c.outstanding)}</div>
                      <div className="text-[11px] text-brand-ink/45">
                        {c.category ?? 'Sin tipo'} · {RIESGO[c.riskTier ?? 'SIN_CALCULAR'] ?? c.riskTier}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {data.byRiskTier.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-[12px] text-brand-ink/60">
              <span className="font-semibold text-brand-ink/70">Por riesgo:</span>
              {data.byRiskTier.map((r) => (
                <span key={r.riskTier} className="rounded-full bg-brand-ink/[0.05] px-2.5 py-1">
                  {RIESGO[r.riskTier] ?? r.riskTier} · {r.count} · {CURRENCY_FORMATTER.format(r.outstanding)}
                </span>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
