import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { AlertTriangle, ArrowDownRight, ArrowUpRight, ChevronDown, Download, Hourglass, MessageCircleOff, RefreshCw, TrendingDown, TrendingUp, Wrench } from 'lucide-react';
import { CURRENCY_FORMATTER } from '../../../../utils/format.ts';
import {
  api,
  type PortfolioCustomerRow,
  type PortfolioReportData,
  type PortfolioReportList,
  type PortfolioReportRecord,
  type PortfolioStrategies,
  type PortfolioStrategyStat,
  type ReportFrequency,
  type RiskTier,
} from '../../../../services/apiClient.ts';
import { EASE, Figure } from './primitives.tsx';

/**
 * Análisis del periodo (pasos 1-3): lo que cambió en la cartera contra el
 * periodo anterior, calculado con código (sin IA todavía). Lee el reporte
 * guardado del backend; un administrador puede generarlo al momento.
 */

const FRECUENCIAS: { value: ReportFrequency; label: string }[] = [
  { value: 'QUINCENAL', label: 'Quincenal' },
  { value: 'MENSUAL', label: 'Mensual' },
  { value: 'BIMESTRAL', label: 'Bimestral' },
];

/** Colores semánticos de riesgo: los mismos en barra, leyenda y etiquetas. */
const TIERS: { key: RiskTier; label: string; bar: string; text: string; pill: string }[] = [
  { key: 'SANO', label: 'Sanos', bar: 'bg-emerald-500', text: 'text-emerald-700', pill: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15' },
  { key: 'ATENCION', label: 'Atención', bar: 'bg-amber-400', text: 'text-amber-700', pill: 'bg-amber-50 text-amber-800 ring-amber-600/20' },
  { key: 'RIESGO', label: 'Riesgo', bar: 'bg-orange-500', text: 'text-orange-700', pill: 'bg-orange-50 text-orange-800 ring-orange-600/20' },
  { key: 'INCOBRABLE', label: 'Incobrables', bar: 'bg-rose-600', text: 'text-rose-700', pill: 'bg-rose-50 text-rose-700 ring-rose-600/20' },
];
const TIER_BY_KEY = Object.fromEntries(TIERS.map((t) => [t.key, t])) as Record<RiskTier, (typeof TIERS)[number]>;
const TIER_LABEL: Record<RiskTier, string> = { SANO: 'Sano', ATENCION: 'Atención', RIESGO: 'Riesgo', INCOBRABLE: 'Incobrable' };

const UMBRAL_INCOBRABLE = 200;
const LISTA_VISIBLE = 5;

const money = (n: number) => CURRENCY_FORMATTER.format(Math.round(n));
const pctTxt = (n: number | null) => (n == null ? '—' : `${n}%`);

export function AnalisisPeriodoPanel({ puedeGenerar }: { puedeGenerar: boolean }) {
  const [lista, setLista] = React.useState<PortfolioReportList | null>(null);
  const [reporte, setReporte] = React.useState<PortfolioReportRecord | null>(null);
  const [cargando, setCargando] = React.useState(true);
  const [generando, setGenerando] = React.useState<'hoy' | 'cerrado' | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const cargar = React.useCallback(async (id?: string) => {
    setCargando(true);
    setError(null);
    try {
      const l = await api.listPortfolioReports();
      setLista(l);
      const elegido = id ?? l.reports[0]?.id;
      setReporte(elegido ? await api.getPortfolioReport(elegido) : null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar el análisis.');
    } finally {
      setCargando(false);
    }
  }, []);

  React.useEffect(() => {
    void cargar();
  }, [cargar]);

  const generar = async (current: boolean) => {
    setGenerando(current ? 'hoy' : 'cerrado');
    setError(null);
    try {
      const r = await api.generatePortfolioReport({ frequency: lista?.frequency, current });
      await cargar(r.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo generar el análisis.');
    } finally {
      setGenerando(null);
    }
  };

  const cambiarFrecuencia = async (f: ReportFrequency) => {
    setLista((l) => (l ? { ...l, frequency: f } : l));
    try {
      await api.setPortfolioReportFrequency(f);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar la frecuencia.');
    }
  };

  const d = reporte?.data;
  const cur = d?.totals.current;
  const prev = d?.totals.previous;

  return (
    <div className="space-y-5">
      {/* ── Banda principal: periodo, controles y las 4 cifras ── */}
      <section className="relative overflow-hidden rounded-3xl bg-brand-ink text-white">
        {/* Rejilla sutil de fondo: textura de "tablero", no decoración de color. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              'linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)',
            backgroundSize: '44px 44px',
            maskImage: 'linear-gradient(to bottom, black, transparent 85%)',
          }}
        />
        <div className="relative px-6 sm:px-8 pt-7 pb-6">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[12px] text-white/55">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-brand-gold" />
                Análisis de cartera
              </div>
              <div className="mt-2 flex items-center gap-3 flex-wrap">
                <h2 className="font-serif text-3xl sm:text-4xl leading-tight capitalize text-white">
                  {d ? d.period.label : cargando ? 'Cargando…' : 'Sin análisis todavía'}
                </h2>
                {lista && lista.reports.length > 1 && (
                  <label className="relative">
                    <span className="sr-only">Cambiar de periodo</span>
                    <select
                      value={reporte?.id ?? ''}
                      onChange={(e) => void cargar(e.target.value)}
                      className="appearance-none pl-3 pr-8 py-1.5 rounded-lg bg-white/8 ring-1 ring-white/15 text-[12px] font-semibold text-white outline-none focus-visible:ring-brand-gold cursor-pointer"
                    >
                      {lista.reports.map((r) => (
                        <option key={r.id} value={r.id} className="text-brand-ink">
                          {r.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/60 pointer-events-none" />
                  </label>
                )}
              </div>
              {d && (
                <p className="mt-1.5 text-[13px] text-white/55">
                  Comparado contra <span className="text-white/80 capitalize">{d.previousPeriod.label}</span> ·{' '}
                  {d.customers.length} clientes analizados ·{' '}
                  <button
                    type="button"
                    onClick={() => exportarAnalisis(d)}
                    className="inline-flex items-center gap-1 font-semibold text-white/75 hover:text-white underline underline-offset-2"
                  >
                    <Download size={12} /> Exportar CSV
                  </button>
                </p>
              )}
            </div>

            {puedeGenerar && lista && (
              <div className="grid grid-cols-2 sm:flex sm:flex-wrap sm:items-center gap-2">
                <div role="radiogroup" aria-label="Frecuencia del análisis" className="col-span-2 grid grid-cols-3 sm:flex p-1 rounded-xl bg-white/6 ring-1 ring-white/10">
                  {FRECUENCIAS.map((f) => {
                    const activo = lista.frequency === f.value;
                    return (
                      <button
                        key={f.value}
                        role="radio"
                        aria-checked={activo}
                        onClick={() => void cambiarFrecuencia(f.value)}
                        className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand-gold ${
                          activo ? 'bg-white text-brand-ink' : 'text-white/60 hover:text-white'
                        }`}
                      >
                        {f.label}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => void generar(true)}
                  disabled={generando !== null}
                  className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl ring-1 ring-white/15 text-[12px] font-semibold text-white/85 hover:bg-white/8 disabled:opacity-50 outline-none focus-visible:ring-brand-gold transition-colors"
                >
                  <RefreshCw size={13} className={generando === 'hoy' ? 'animate-spin' : ''} />
                  Al día de hoy
                </button>
                <button
                  onClick={() => void generar(false)}
                  disabled={generando !== null}
                  className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-brand-gold text-brand-ink text-[12px] font-semibold hover:brightness-110 disabled:opacity-50 outline-none focus-visible:ring-2 focus-visible:ring-white transition"
                >
                  {generando === 'cerrado' && <RefreshCw size={13} className="animate-spin" />}
                  Último periodo cerrado
                </button>
              </div>
            )}
          </div>

          {cur && prev && (
            // gap-px sobre fondo claro = divisores de 1px que funcionan con 1, 2 o 4 columnas.
            <div className="mt-7 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px rounded-2xl overflow-hidden bg-white/10 ring-1 ring-white/10 [&>*]:bg-[#151c2c]">
              <HeroKpi
                label="Vencido al cierre"
                value={cur.overdueAmount}
                format="moneda"
                nota={`${pctTxt(cur.overduePct)} del saldo abierto`}
                delta={cur.overdueAmount - prev.overdueAmount}
                deltaTxt={money(Math.abs(cur.overdueAmount - prev.overdueAmount))}
                menosEsMejor
              />
              <HeroKpi
                label="Cobrado en el periodo"
                value={cur.collectedAmount}
                format="moneda"
                nota={`${cur.collectedCount} factura(s) cobradas`}
                delta={cur.collectedAmount - prev.collectedAmount}
                deltaTxt={money(Math.abs(cur.collectedAmount - prev.collectedAmount))}
              />
              <HeroKpi
                label="Pagado a tiempo"
                value={cur.paidOnTimePct}
                format="porcentaje"
                nota={cur.avgPaymentDelayDays != null ? `${cur.avgPaymentDelayDays} días de atraso promedio` : 'Sin pagos en el periodo'}
                delta={(cur.paidOnTimePct ?? 0) - (prev.paidOnTimePct ?? 0)}
                deltaTxt={`${Math.abs((cur.paidOnTimePct ?? 0) - (prev.paidOnTimePct ?? 0))} pts`}
                sinComparar={cur.paidOnTimePct == null || prev.paidOnTimePct == null}
              />
              <HeroKpi
                label="Contestaron WhatsApp"
                value={cur.responseRatePct}
                format="porcentaje"
                nota={`${cur.customersResponded} de ${cur.customersMessaged} clientes`}
                delta={(cur.responseRatePct ?? 0) - (prev.responseRatePct ?? 0)}
                deltaTxt={`${Math.abs((cur.responseRatePct ?? 0) - (prev.responseRatePct ?? 0))} pts`}
                sinComparar={cur.responseRatePct == null || prev.responseRatePct == null}
              />
            </div>
          )}
        </div>
      </section>

      {error && (
        <div role="alert" className="flex items-start gap-2.5 px-4 py-3 rounded-2xl bg-rose-50 ring-1 ring-rose-200 text-sm text-rose-700">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {!cargando && !d && !error && (
        <div className="rounded-3xl glass px-8 py-14 text-center">
          <p className="font-serif text-2xl text-brand-ink">Aún no hay análisis de cartera</p>
          <p className="text-sm text-brand-ink/55 mt-2 max-w-md mx-auto">
            Se genera solo al cerrar cada periodo{lista ? ` (${lista.frequency.toLowerCase()})` : ''}.
            {puedeGenerar ? ' También puedes generarlo ahora con los botones de arriba.' : ''}
          </p>
        </div>
      )}

      {d && cur && prev && (
        <>
          {/* ── Riesgo y movimiento: dos tarjetas gemelas ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Tarjeta titulo="Riesgo de la cartera" subtitulo={`${cur.customersWithBalance} clientes con saldo`}>
              <BarraApilada
                partes={TIERS.map((t) => ({ key: t.key, label: t.label, valor: cur.distribution[t.key], clase: t.bar }))}
              />
              <div className="mt-5 grid grid-cols-2 gap-3">
                {TIERS.map((t) => (
                  <Celda
                    key={t.key}
                    label={t.label}
                    marca={t.bar}
                    valor={cur.distribution[t.key]}
                    tonoNumero={t.text}
                    pie={<Delta valor={cur.distribution[t.key] - prev.distribution[t.key]} menosEsMejor={t.key !== 'SANO'} />}
                  />
                ))}
              </div>
            </Tarjeta>

            <Tarjeta titulo="Movimiento del periodo" subtitulo="Cada cliente contra su periodo anterior">
              {(() => {
                const total = d.customers.length;
                const partes = [
                  { key: 'MEJORO', label: 'Mejoraron', valor: d.trendCounts.MEJORO, clase: 'bg-emerald-500', num: 'text-emerald-700' },
                  { key: 'EMPEORO', label: 'Empeoraron', valor: d.trendCounts.EMPEORO, clase: 'bg-rose-500', num: 'text-rose-600' },
                  { key: 'ESTABLE', label: 'Sin cambio', valor: d.trendCounts.ESTABLE + d.trendCounts.SIN_ACTIVIDAD, clase: 'bg-brand-ink/35', num: 'text-brand-ink' },
                  { key: 'NUEVO', label: 'Nuevos', valor: d.trendCounts.NUEVO, clase: 'bg-brand-gold', num: 'text-brand-ink' },
                ];
                return (
                  <>
                    <BarraApilada partes={partes} />
                    <div className="mt-5 grid grid-cols-2 gap-3">
                      {partes.map((p) => (
                        <Celda
                          key={p.key}
                          label={p.label}
                          marca={p.clase}
                          valor={p.valor}
                          tonoNumero={p.num}
                          pie={
                            <div className="text-[11px] text-brand-ink/45 tabular-nums">
                              {total > 0 ? Math.round((p.valor / total) * 100) : 0}% de los clientes
                            </div>
                          }
                        />
                      ))}
                    </div>
                  </>
                );
              })()}
            </Tarjeta>
          </div>

          {/* ── Quién se mueve: 2×2 ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <ListaClientes
              icon={<Hourglass size={15} />}
              titulo="Se están volviendo incobrables"
              acento="text-rose-600 bg-rose-50"
              vacio="Nadie cerca del umbral de incobrable."
              filas={d.becomingUncollectible}
              render={(r) => (
                <>
                  <div className="mt-2 flex items-center gap-3">
                    <div className="flex-1 h-1.5 rounded-full bg-brand-ink/8 overflow-hidden" title={`${r.current.maxDaysOverdue} de ${UMBRAL_INCOBRABLE} días`}>
                      <div
                        className={`h-full rounded-full ${r.current.maxDaysOverdue >= 150 ? 'bg-rose-500' : 'bg-orange-400'}`}
                        style={{ width: `${Math.min(100, (r.current.maxDaysOverdue / UMBRAL_INCOBRABLE) * 100)}%` }}
                      />
                    </div>
                    <span className="text-[11px] tabular-nums text-brand-ink/50 whitespace-nowrap">
                      faltan {r.daysToUncollectible ?? '—'} días
                    </span>
                  </div>
                  <p className="mt-1 text-[12px] text-brand-ink/55">
                    {r.current.maxDaysOverdue} días de atraso · {money(r.current.overdueAmount)} vencidos
                  </p>
                </>
              )}
            />
            <ListaClientes
              icon={<MessageCircleOff size={15} />}
              titulo="Deben y no contestan"
              acento="text-brand-ink bg-brand-bone"
              vacio="Todos a los que les escribimos contestaron."
              filas={d.nonResponders}
              render={(r) => (
                <p className="mt-1 text-[12px] text-brand-ink/55">
                  {r.current.messagesSent} mensaje(s) sin respuesta · {money(r.current.overdueAmount)} vencidos
                </p>
              )}
            />
            <ListaClientes
              icon={<ArrowDownRight size={15} />}
              titulo="Empeoraron"
              acento="text-rose-600 bg-rose-50"
              vacio="Nadie empeoró en este periodo."
              filas={d.worsened}
              render={(r) => <Motivos motivos={r.trendReasons} />}
            />
            <ListaClientes
              icon={<ArrowUpRight size={15} />}
              titulo="Mejoraron"
              acento="text-emerald-700 bg-emerald-50"
              vacio="Nadie mejoró en este periodo."
              filas={d.improved}
              render={(r) => <Motivos motivos={r.trendReasons} />}
            />
          </div>

          {/* ── Estrategias: qué está cobrando y qué no ── */}
          <Estrategias datos={d.strategies} />

          {/* ── Por tipo de cliente: franja simétrica ── */}
          {d.segments.length > 0 && (
            <Tarjeta titulo="Por tipo de cliente" subtitulo="Cómo paga cada grupo y en qué nivel del plan termina pagando" sinPadding>
              <div
                className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 divide-white/70 border-t border-brand-ink/8 lg:[grid-template-columns:var(--cols)]"
                style={{ ['--cols' as string]: `repeat(${d.segments.length}, minmax(0, 1fr))` }}
              >
                {d.segments.map((s, i) => (
                  <div key={s.key} className={`p-6 ${i > 0 ? 'lg:border-l lg:border-brand-ink/8' : ''} ${i % 2 === 1 ? 'sm:border-l sm:border-brand-ink/8' : ''}`}>
                    <div className="text-[13px] font-semibold text-brand-ink">{s.label}</div>
                    <div className="flex items-baseline gap-1.5 mt-2">
                      <span className="font-serif text-4xl text-brand-ink">
                        <Figure value={s.customers} />
                      </span>
                      <span className="text-[12px] text-brand-ink/45">clientes</span>
                    </div>
                    <dl className="mt-4 space-y-2 text-[12px]">
                      <Dato label="Vencido" valor={money(s.overdueAmount)} />
                      <Dato label="A tiempo" valor={pctTxt(s.paidOnTimePct)} />
                      <Dato label="Atraso prom." valor={s.avgPaymentDelayDays == null ? '—' : `${s.avgPaymentDelayDays} días`} />
                      <Dato label="Crédito típico" valor={s.medianCreditDays == null ? '—' : `${s.medianCreditDays} días`} />
                    </dl>
                    <div className="mt-4 pt-3 border-t border-dashed border-brand-ink/10">
                      <div className="text-[11px] text-brand-ink/45">Pagan tras el nivel</div>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {Object.keys(s.paidAfterLevel).length === 0 ? (
                          <span className="text-[12px] text-brand-ink/35">Sin pagos en el periodo</span>
                        ) : (
                          Object.entries(s.paidAfterLevel).map(([k, v]) => (
                            <span key={k} className="px-2 py-0.5 rounded-md bg-brand-cream text-[11px] font-semibold text-brand-ink/75 ring-1 ring-brand-gold/25">
                              {k === 'SIN_MENSAJE' ? 'Sin mensaje' : k} · {v}
                            </span>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Tarjeta>
          )}

          {/* ── Datos a corregir ── */}
          <Tarjeta
            titulo="Datos a corregir"
            subtitulo={d.dataQuality.length === 0 ? 'Todo en orden' : `${d.dataQuality.reduce((n, q) => n + q.count, 0)} registros por revisar`}
            icon={<Wrench size={15} />}
          >
            {d.dataQuality.length === 0 ? (
              <p className="text-sm text-brand-ink/50">No encontramos datos incompletos ni raros.</p>
            ) : (
              <ul className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {d.dataQuality.map((q) => (
                  <li
                    key={q.code}
                    className="flex gap-3 p-4 rounded-2xl bg-brand-bone ring-1 ring-brand-ink/6 lg:[&:last-child:nth-child(odd)]:col-span-2"
                  >
                    <span
                      className={`mt-0.5 shrink-0 px-1.5 py-0.5 h-fit rounded-md text-[10px] font-bold ${
                        q.severity === 'ALTA'
                          ? 'bg-rose-100 text-rose-700'
                          : q.severity === 'MEDIA'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-brand-ink/8 text-brand-ink/60'
                      }`}
                    >
                      {q.severity === 'ALTA' ? 'Alta' : q.severity === 'MEDIA' ? 'Media' : 'Baja'}
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-brand-ink">
                        {q.title} <span className="font-normal text-brand-ink/45 tabular-nums">· {q.count}</span>
                      </div>
                      <p className="text-[12px] text-brand-ink/60 mt-0.5">{q.fix}</p>
                      <p className="text-[11px] text-brand-ink/40 mt-1.5 truncate" title={q.samples.map((s) => s.label).join(' · ')}>
                        {q.samples.map((s) => s.label).join(' · ')}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Tarjeta>

          <p className="text-[11px] text-brand-ink/40 text-center">
            Cifras calculadas con tus datos, sin IA. Las recomendaciones de crédito y la lectura de la IA llegan en el siguiente paso.
          </p>
        </>
      )}
    </div>
  );
}

// ── Piezas ───────────────────────────────────────────────────────────────

function HeroKpi({
  label,
  value,
  format,
  nota,
  delta,
  deltaTxt,
  menosEsMejor = false,
  sinComparar = false,
}: {
  label: string;
  value: number | null;
  format: 'moneda' | 'porcentaje';
  nota: string;
  delta: number;
  deltaTxt: string;
  menosEsMejor?: boolean;
  sinComparar?: boolean;
}) {
  const bueno = menosEsMejor ? delta < 0 : delta > 0;
  return (
    <div className="px-5 py-5">
      <div className="text-[12px] text-white/55">{label}</div>
      <div className="mt-1.5 font-serif text-2xl sm:text-[28px] leading-none text-white">
        {value == null ? '—' : <Figure value={value} format={format} />}
      </div>
      <div className="mt-2 text-[11px] text-white/45 truncate">{nota}</div>
      <div className="mt-3">
        {sinComparar || delta === 0 ? (
          <span className="inline-flex px-2 py-0.5 rounded-md bg-white/6 text-[11px] text-white/50">
            {sinComparar ? 'Sin dato anterior' : 'Igual que antes'}
          </span>
        ) : (
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold ${
              bueno ? 'bg-emerald-400/12 text-emerald-300' : 'bg-rose-400/12 text-rose-300'
            }`}
          >
            {delta > 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {deltaTxt}
          </span>
        )}
      </div>
    </div>
  );
}

function Tarjeta({
  titulo,
  subtitulo,
  icon,
  sinPadding = false,
  children,
}: {
  titulo: string;
  subtitulo?: string;
  icon?: React.ReactNode;
  sinPadding?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl glass flex flex-col">
      <header
        className={`flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1 sm:gap-3 ${sinPadding ? 'px-6 pt-5 pb-4' : 'px-6 pt-5'}`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {icon && <span className="text-brand-ink/50">{icon}</span>}
          <h3 className="text-[15px] font-semibold text-brand-ink">{titulo}</h3>
        </div>
        {subtitulo && <span className="text-[12px] text-brand-ink/45 sm:text-right">{subtitulo}</span>}
      </header>
      <div className={sinPadding ? '' : 'px-6 pb-6 pt-4 flex-1'}>{children}</div>
    </section>
  );
}

/**
 * Barra apilada: proporción real de cada parte. Es la única animación de la
 * vista — crece una vez al llegar el reporte para que se lea la magnitud.
 */
function BarraApilada({ partes }: { partes: { key: string; label: string; valor: number; clase: string }[] }) {
  const reduce = useReducedMotion();
  const total = partes.reduce((n, p) => n + p.valor, 0);
  const visibles = partes.filter((p) => p.valor > 0);
  return (
    <div
      role="img"
      aria-label={partes.map((p) => `${p.label}: ${p.valor}`).join(', ')}
      className="flex h-2.5 rounded-full overflow-hidden gap-[3px] bg-brand-ink/6"
    >
      {total > 0 &&
        visibles.map((p, i) => (
          <motion.div
            key={p.key}
            className={`h-full ${p.clase} ${i === 0 ? 'rounded-l-full' : ''} ${i === visibles.length - 1 ? 'rounded-r-full' : ''}`}
            initial={reduce ? false : { width: 0 }}
            animate={{ width: `${(p.valor / total) * 100}%` }}
            transition={{ duration: 0.9, delay: reduce ? 0 : 0.15 + i * 0.07, ease: EASE }}
            title={`${p.label}: ${p.valor}`}
          />
        ))}
    </div>
  );
}

/** Celda gemela de las tarjetas de riesgo y movimiento. */
function Celda({
  label,
  marca,
  valor,
  tonoNumero,
  pie,
}: {
  // Convención del proyecto: un componente que recibe `key` debe declararla.
  key?: string;
  label: string;
  marca: string;
  valor: number;
  tonoNumero: string;
  pie: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-brand-bone ring-1 ring-brand-ink/6 px-4 py-3.5">
      <div className="flex items-center gap-2 text-[12px] text-brand-ink/60">
        <span className={`w-2 h-2 rounded-[3px] ${marca}`} />
        {label}
      </div>
      <div className={`font-serif text-[34px] leading-none mt-2 ${tonoNumero}`}>
        <Figure value={valor} />
      </div>
      <div className="mt-2">{pie}</div>
    </div>
  );
}

function Delta({ valor, menosEsMejor }: { valor: number; menosEsMejor: boolean }) {
  if (valor === 0) return <div className="text-[11px] text-brand-ink/40">Igual que antes</div>;
  const bueno = menosEsMejor ? valor < 0 : valor > 0;
  return (
    <div className={`flex items-center gap-0.5 text-[11px] font-semibold tabular-nums ${bueno ? 'text-emerald-700' : 'text-rose-600'}`}>
      {valor > 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
      {Math.abs(valor)} vs antes
    </div>
  );
}

function ListaClientes({
  icon,
  titulo,
  acento,
  vacio,
  filas,
  render,
}: {
  icon: React.ReactNode;
  titulo: string;
  acento: string;
  vacio: string;
  filas: PortfolioCustomerRow[];
  render: (r: PortfolioCustomerRow) => React.ReactNode;
}) {
  const [todos, setTodos] = React.useState(false);
  const visibles = todos ? filas : filas.slice(0, LISTA_VISIBLE);
  return (
    <section className="rounded-3xl glass flex flex-col">
      <header className="flex items-center justify-between gap-3 px-6 pt-5 pb-3">
        <div className="flex items-center gap-2.5">
          <span className={`grid place-items-center w-8 h-8 rounded-xl ${acento}`}>{icon}</span>
          <h3 className="text-[15px] font-semibold text-brand-ink">{titulo}</h3>
        </div>
        <span className="min-w-7 px-2 py-0.5 rounded-full bg-brand-bone ring-1 ring-brand-ink/8 text-[12px] font-semibold text-brand-ink/70 text-center tabular-nums">
          {filas.length}
        </span>
      </header>
      {filas.length === 0 ? (
        <div className="flex-1 grid place-items-center px-6 pb-8 pt-4 min-h-40">
          <div className="text-center">
            <span className="mx-auto grid place-items-center w-10 h-10 rounded-full bg-brand-bone ring-1 ring-brand-ink/8 text-brand-ink/35">
              {icon}
            </span>
            <p className="mt-3 text-sm text-brand-ink/50">{vacio}</p>
          </div>
        </div>
      ) : (
        <>
          <ul className="px-3 pb-3 flex-1">
            {visibles.map((r) => (
              <li key={r.customerId} className="px-3 py-3 rounded-2xl hover:bg-white/70 transition-colors">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-brand-ink truncate">{r.name}</span>
                  <TierCambio desde={r.previousTier} hasta={r.tier} />
                </div>
                {render(r)}
              </li>
            ))}
          </ul>
          {filas.length > LISTA_VISIBLE && (
            <button
              onClick={() => setTodos((v) => !v)}
              className="mx-6 mb-5 -mt-1 text-[12px] font-semibold text-brand-ink/55 hover:text-brand-ink text-left outline-none focus-visible:underline"
            >
              {todos ? 'Ver menos' : `Ver los ${filas.length}`}
            </button>
          )}
        </>
      )}
    </section>
  );
}

function TierCambio({ desde, hasta }: { desde: RiskTier | null; hasta: RiskTier }) {
  const pill = (t: RiskTier) => (
    <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ring-1 ${TIER_BY_KEY[t].pill}`}>{TIER_LABEL[t]}</span>
  );
  if (!desde || desde === hasta) return pill(hasta);
  return (
    <span className="flex items-center gap-1 shrink-0">
      <span className="text-[11px] text-brand-ink/40 line-through decoration-brand-ink/25">{TIER_LABEL[desde]}</span>
      <span className="text-brand-ink/30 text-[11px]">→</span>
      {pill(hasta)}
    </span>
  );
}

/** Motivos de la tendencia. El cambio de categoría ya se ve en la etiqueta. */
function Motivos({ motivos }: { motivos: string[] }) {
  const resto = motivos.filter((m) => !m.startsWith('Pasó de '));
  if (resto.length === 0) return null;
  return (
    <ul className="mt-1 space-y-0.5">
      {resto.map((m) => (
        <li key={m} className="text-[12px] text-brand-ink/55 leading-snug">
          {m}
        </li>
      ))}
    </ul>
  );
}

function Dato({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-brand-ink/50">{label}</dt>
      <dd className="font-semibold text-brand-ink tabular-nums">{valor}</dd>
    </div>
  );
}

// ── Estrategias ──────────────────────────────────────────────────────────

/**
 * Muestra de cómo se verá la sección mientras todavía no salen mensajes de
 * WhatsApp en el periodo. Siempre marcada como "Ejemplo".
 */
const ESTRATEGIAS_EJEMPLO: PortfolioStrategies = {
  replyWindowHours: 72,
  payWindowDays: 14,
  minSample: 3,
  totalSends: 0,
  working: [
    { key: 'N3', label: 'Nivel 3 · Vence en 3 días', sends: 124, responded: 71, paid: 86, responseRatePct: 57, paidRatePct: 69, avgDaysToPay: 3.2 },
    { key: 'N4', label: 'Nivel 4 · Vence hoy', sends: 96, responded: 52, paid: 58, responseRatePct: 54, paidRatePct: 60, avgDaysToPay: 1.8 },
  ],
  notWorking: [
    { key: 'B', label: 'Etapa B · Seguimiento (7 días después)', sends: 41, responded: 9, paid: 5, responseRatePct: 22, paidRatePct: 12, avgDaysToPay: 9.4 },
    { key: 'N1', label: 'Nivel 1 · Aviso preventivo (14 días antes)', sends: 63, responded: 12, paid: 12, responseRatePct: 19, paidRatePct: 19, avgDaysToPay: 11 },
  ],
  lowSample: [],
};

function Estrategias({ datos }: { datos?: PortfolioStrategies }) {
  const ejemplo = !datos || datos.totalSends === 0;
  const e = ejemplo ? ESTRATEGIAS_EJEMPLO : datos;
  return (
    <section className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-1 px-1">
        <div className="flex items-center gap-2.5">
          <h3 className="text-[15px] font-semibold text-brand-ink">Estrategias</h3>
          {ejemplo && (
            <span className="px-2 py-0.5 rounded-md bg-brand-cream ring-1 ring-brand-gold/25 text-[11px] font-semibold text-brand-ink/70">
              Ejemplo
            </span>
          )}
        </div>
        <p className="text-[12px] text-brand-ink/45">
          {ejemplo
            ? 'Así se verá cuando empiecen a salir mensajes en el periodo.'
            : `${e.totalSends} mensajes enviados · cuenta si pagó en ${e.payWindowDays} días o contestó en ${e.replyWindowHours} h`}
        </p>
      </div>
      <div className={`grid grid-cols-1 lg:grid-cols-2 gap-5 ${ejemplo ? 'opacity-60' : ''}`}>
        <ColumnaEstrategias
          titulo="Lo que sí funciona"
          icon={<TrendingUp size={15} />}
          acento="text-emerald-700 bg-emerald-50"
          positivo
          filas={e.working}
          vacio="Todavía ninguna estrategia cobra en la mitad de sus envíos."
        />
        <ColumnaEstrategias
          titulo="Lo que no funciona"
          icon={<TrendingDown size={15} />}
          acento="text-rose-600 bg-rose-50"
          positivo={false}
          filas={e.notWorking}
          vacio="Ninguna estrategia está por debajo de la mitad."
        />
      </div>
      {!ejemplo && e.lowSample.length > 0 && (
        <p className="px-1 text-[12px] text-brand-ink/45">
          Con pocos envíos para concluir (menos de {e.minSample}):{' '}
          {e.lowSample.map((s) => `${s.label} (${s.sends})`).join(' · ')}
        </p>
      )}
    </section>
  );
}

function ColumnaEstrategias({
  titulo,
  icon,
  acento,
  positivo,
  filas,
  vacio,
}: {
  titulo: string;
  icon: React.ReactNode;
  acento: string;
  positivo: boolean;
  filas: PortfolioStrategyStat[];
  vacio: string;
}) {
  return (
    <section className="rounded-3xl glass flex flex-col">
      <header className="flex items-center justify-between gap-3 px-6 pt-5 pb-3">
        <div className="flex items-center gap-2.5">
          <span className={`grid place-items-center w-8 h-8 rounded-xl ${acento}`}>{icon}</span>
          <h3 className="text-[15px] font-semibold text-brand-ink">{titulo}</h3>
        </div>
        <span className="text-[11px] text-brand-ink/45">% de envíos que terminaron en pago</span>
      </header>
      {filas.length === 0 ? (
        <div className="flex-1 grid place-items-center px-6 pb-8 pt-4 min-h-32">
          <p className="text-sm text-brand-ink/50 text-center">{vacio}</p>
        </div>
      ) : (
        <ul className="px-6 pb-5 divide-y divide-white/70">
          {filas.map((s) => (
            <li key={s.key} className="py-3.5">
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-sm font-semibold text-brand-ink">{s.label}</span>
                <span className={`font-serif text-2xl tabular-nums shrink-0 ${positivo ? 'text-emerald-700' : 'text-rose-600'}`}>
                  {s.paidRatePct == null ? '—' : <Figure value={s.paidRatePct} format="porcentaje" />}
                </span>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-brand-ink/8 overflow-hidden">
                <div
                  className={`h-full rounded-full ${positivo ? 'bg-emerald-500' : 'bg-rose-500'}`}
                  style={{ width: `${Math.min(100, s.paidRatePct ?? 0)}%` }}
                />
              </div>
              <p className="mt-1.5 text-[12px] text-brand-ink/50 tabular-nums">
                {s.sends} envíos · {pctTxt(s.responseRatePct)} contestó
                {s.avgDaysToPay != null ? ` · pagan en ${s.avgDaysToPay} días promedio` : ''}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Descarga el análisis por cliente (lo que se ve en pantalla) en CSV. */
function exportarAnalisis(d: PortfolioReportData) {
  const esc = (v: unknown) => {
    const t = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const filas = [
    ['Cliente', 'Tipo', 'Riesgo', 'Riesgo anterior', 'Tendencia', 'Saldo abierto', 'Vencido', 'Días máx. vencida', '% a tiempo', 'Respondió', 'Motivos'],
    ...d.customers.map((c) => [
      c.name,
      c.segment,
      c.tier,
      c.previousTier ?? '',
      c.trend,
      c.current.openAmount,
      c.current.overdueAmount,
      c.current.maxDaysOverdue,
      c.current.punctualityPct ?? '',
      c.current.responded ? 'Sí' : 'No',
      c.trendReasons.join(' | '),
    ]),
  ];
  const blob = new Blob(['\uFEFF' + filas.map((f) => f.map(esc).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `analisis-${d.period.from.slice(0, 10)}-a-${d.period.to.slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
