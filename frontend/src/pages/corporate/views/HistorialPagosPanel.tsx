import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronRight, X, Download, AlertTriangle, ChevronLeft } from 'lucide-react';
import { api, type PaymentRow } from '../../../services/apiClient.ts';
import { CURRENCY_FORMATTER } from '../../../utils/format.ts';

// ─────────────────────────────────────────────────────────────────────────────
// ─── HistorialPagosPanel ──────────────────────────────────────────────────────
// Historial real de pagos (GET /payments): lista paginada con filtros por
// rango de fechas y ruta, detalle expandible con las facturas (CFDI) de cada
// pago y exportación CSV. Un "pago" agrupa 1..N facturas (pago global).
//
// Migrado a TanStack Query: la lista usa useQuery con un queryKey que
// incluye los filtros (refetch automático al cambiar página/ruta/fechas,
// con cache por combinación), y el detalle expandible es OTRO useQuery por
// fila (enabled solo cuando esa fila está abierta) — reemplaza el dict
// manual `details`/`detailLoading` de antes: TanStack ya cachea cada
// pago consultado, así que reabrir una fila ya vista no vuelve a pedir nada.
export function HistorialPagosPanel() {
  const [page, setPage] = React.useState(1);
  const [dateFrom, setDateFrom] = React.useState('');
  const [dateTo, setDateTo] = React.useState('');
  const [route, setRoute] = React.useState<'' | 'TRANSFER' | 'CREDIT'>('');
  const [expanded, setExpanded] = React.useState<string | null>(null);
  const [exporting, setExporting] = React.useState(false);

  const { data: result, isLoading: loading, error: queryError } = useQuery({
    queryKey: ['payments', { page, route, dateFrom, dateTo }],
    queryFn: () =>
      api.getPayments({
        page,
        limit: 10,
        route: route || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      }),
  });
  const error = queryError instanceof Error ? queryError.message : queryError ? 'No se pudo cargar el historial de pagos.' : null;

  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ['payment', expanded],
    queryFn: () => api.getPayment(expanded as string),
    enabled: expanded !== null,
  });

  const toggleDetail = (id: string) => {
    setExpanded(prev => (prev === id ? null : id));
  };

  const handleExport = async () => {
    setExporting(true);
    try { await api.exportPaymentsCsv(); } catch { /* la descarga falló; el usuario puede reintentar */ }
    setExporting(false);
  };

  const PAY_STATUS: Record<PaymentRow['status'], { label: string; badge: string }> = {
    SCHEDULED:  { label: 'Programado',   badge: 'bg-blue-100 text-blue-700' },
    PROCESSING: { label: 'Procesando',   badge: 'bg-yellow-100 text-yellow-700' },
    COMPLETED:  { label: 'Completado ✓', badge: 'bg-green-100 text-green-700' },
    FAILED:     { label: 'Fallido',      badge: 'bg-red-100 text-red-700' },
  };
  const ROUTE_LABEL: Record<PaymentRow['route'], string> = {
    TRANSFER: 'Transferencia',
    CREDIT: 'Crédito',
  };
  const fmtDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  const rows = result?.data ?? [];
  const meta = result?.meta;
  const pageAmount = rows.reduce((s, p) => s + p.totalAmount, 0);

  const resetFilters = () => { setDateFrom(''); setDateTo(''); setRoute(''); setPage(1); };
  const hasFilters = dateFrom || dateTo || route;

  return (
    <div className="space-y-6">
      {/* Stats + Export */}
      <div className="flex flex-col md:flex-row gap-4 items-start justify-between">
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: 'Pagos registrados', val: meta ? String(meta.total) : '—', color: 'text-brand-ink', bg: 'bg-white border-brand-sand/30' },
            { label: 'Monto (página actual)', val: CURRENCY_FORMATTER.format(pageAmount), color: 'text-green-600', bg: 'bg-green-50 border-green-200' },
          ].map(s => (
            <div key={s.label} className={`p-4 rounded-2xl border ${s.bg} text-center`}>
              <p className={`text-base font-bold font-serif ${s.color}`}>{s.val}</p>
              <p className="text-[9px] uppercase font-bold tracking-widest text-brand-ink/40 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
        <button onClick={handleExport} disabled={exporting}
          className="flex items-center gap-2 px-5 py-3 bg-brand-ink text-brand-bone rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-brand-gold hover:text-brand-ink transition-all shadow-sm disabled:opacity-50">
          <Download size={14}/> {exporting ? 'Exportando…' : 'Exportar CSV'}
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-3 p-4 bg-white border border-brand-sand/30 rounded-2xl">
        <div className="space-y-1">
          <p className="text-[9px] font-bold uppercase tracking-widest text-brand-ink/40">Desde</p>
          <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-brand-sand rounded-xl text-xs focus:outline-none focus:border-brand-gold"/>
        </div>
        <div className="space-y-1">
          <p className="text-[9px] font-bold uppercase tracking-widest text-brand-ink/40">Hasta</p>
          <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-brand-sand rounded-xl text-xs focus:outline-none focus:border-brand-gold"/>
        </div>
        <div className="space-y-1">
          <p className="text-[9px] font-bold uppercase tracking-widest text-brand-ink/40">Ruta</p>
          <select value={route} onChange={e => { setRoute(e.target.value as '' | 'TRANSFER' | 'CREDIT'); setPage(1); }}
            className="px-3 py-2 border border-brand-sand rounded-xl text-xs focus:outline-none focus:border-brand-gold bg-white">
            <option value="">Todas</option>
            <option value="TRANSFER">Transferencia</option>
            <option value="CREDIT">Crédito</option>
          </select>
        </div>
        {hasFilters && (
          <button onClick={resetFilters}
            className="flex items-center gap-1.5 px-4 py-2 text-[9px] font-bold uppercase tracking-widest text-brand-ink/40 hover:text-brand-ink transition-all">
            <X size={12}/> Limpiar filtros
          </button>
        )}
      </div>

      {/* Tabla de pagos */}
      <div className="editorial-card !p-0 overflow-hidden shadow-xl shadow-brand-sand/30 border border-brand-sand/50">
        <div className="px-6 py-3 bg-white/50 border-b border-brand-sand/20 flex items-center justify-between">
          <p className="text-sm font-bold text-brand-ink">Historial de Pagos → Facturas (CFDI)</p>
          <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"/><span className="text-[9px] font-bold text-brand-ink/40 uppercase tracking-wider">Datos reales</span></div>
        </div>

        {error && (
          <div className="px-6 py-4 flex items-center gap-2 text-xs text-red-700 bg-red-50">
            <AlertTriangle size={14}/> {error}
          </div>
        )}
        {loading && !error && (
          <div className="px-6 py-8 flex items-center justify-center gap-3 text-xs text-brand-ink/40">
            <motion.div animate={{rotate:360}} transition={{repeat:Infinity,duration:1,ease:'linear'}} className="w-4 h-4 border-2 border-brand-ink/20 border-t-brand-gold rounded-full"/>
            Cargando historial…
          </div>
        )}
        {!loading && !error && rows.length === 0 && (
          <div className="px-6 py-10 text-center space-y-1">
            <p className="text-sm font-serif text-brand-ink/60">Sin pagos {hasFilters ? 'con estos filtros' : 'registrados todavía'}.</p>
            <p className="text-[10px] text-brand-ink/30">Los pagos que realices desde Facturas por Pagar aparecerán aquí.</p>
          </div>
        )}

        {!loading && !error && rows.length > 0 && (
          <div className="divide-y divide-brand-sand/20">
            {rows.map(p => {
              const isOpen = expanded === p.id;
              const st = PAY_STATUS[p.status];
              // `detail` (del useQuery de arriba) solo corresponde a la fila
              // actualmente expandida — para las demás filas queda undefined.
              const rowDetail = isOpen ? detail : undefined;
              return (
                <div key={p.id}>
                  <div className="flex items-center gap-4 px-6 py-4 hover:bg-brand-gold/5 transition-all cursor-pointer group" onClick={() => toggleDetail(p.id)}>
                    <div className={`transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}><ChevronRight size={16} className="text-brand-ink/30 group-hover:text-brand-gold"/></div>
                    <div className="flex-1 grid grid-cols-2 md:grid-cols-5 gap-4 items-center">
                      <div>
                        <p className="text-[10px] font-bold font-mono text-brand-ink">{p.id.slice(0, 8).toUpperCase()}</p>
                        <p className="text-[9px] text-brand-ink/30 font-serif">{fmtDate(p.createdAt)}</p>
                      </div>
                      <p className="text-[11px] text-brand-ink/60">{ROUTE_LABEL[p.route] ?? p.route}{p.transactionRef ? ` · Ref: ${p.transactionRef}` : ''}</p>
                      <p className="text-sm font-bold font-serif text-brand-ink">{CURRENCY_FORMATTER.format(p.totalAmount)}</p>
                      <p className="text-[10px] text-brand-ink/40">{p.processedAt ? `Procesado ${fmtDate(p.processedAt)}` : p.scheduledDate ? `Programado ${fmtDate(p.scheduledDate)}` : '—'}</p>
                      <div className="flex items-center gap-2 justify-end">
                        <span className={`text-[8px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full ${st.badge}`}>{st.label}</span>
                        <span className="text-[9px] text-brand-ink/30">{p.invoiceCount} {p.invoiceCount === 1 ? 'factura' : 'facturas'}</span>
                      </div>
                    </div>
                  </div>
                  <AnimatePresence>
                    {isOpen && (
                      <motion.div initial={{height:0,opacity:0}} animate={{height:'auto',opacity:1}} exit={{height:0,opacity:0}} className="overflow-hidden bg-brand-bone/40">
                        <div className="ml-10 mr-6 mb-3 divide-y divide-brand-sand/10 rounded-2xl overflow-hidden border border-brand-sand/20">
                          {detailLoading && !rowDetail && (
                            <div className="px-5 py-4 bg-white/60 flex items-center gap-3 text-[10px] text-brand-ink/40">
                              <motion.div animate={{rotate:360}} transition={{repeat:Infinity,duration:1,ease:'linear'}} className="w-3 h-3 border-2 border-brand-ink/20 border-t-brand-gold rounded-full"/>
                              Cargando facturas del pago…
                            </div>
                          )}
                          {rowDetail?.invoices.map(inv => (
                            <div key={inv.id} className="flex items-center gap-4 px-5 py-3 bg-white/60 hover:bg-brand-gold/5 transition-all">
                              <div className="w-px h-4 bg-brand-sand/40"/>
                              <div className="flex-1 grid grid-cols-3 gap-4">
                                <div>
                                  <p className="text-[10px] font-bold text-brand-ink">{inv.supplier?.name ?? 'Proveedor'}</p>
                                  <p className="text-[9px] text-brand-ink/30 font-mono">{inv.folio ? `Folio ${inv.folio}` : inv.id.slice(0, 8)}</p>
                                </div>
                                <span className="text-[9px] font-mono text-brand-ink/50 bg-brand-sand/20 px-2 py-0.5 rounded-lg self-center truncate">{inv.cfdiUuid}</span>
                                <p className="text-sm font-bold font-serif text-brand-ink text-right">{CURRENCY_FORMATTER.format(Number(inv.total))}</p>
                              </div>
                            </div>
                          ))}
                          {rowDetail && (
                            <div className="px-5 py-2 bg-brand-bone/60 text-[9px] text-brand-ink/40 flex items-center justify-between">
                              <span>{rowDetail.creator ? `Creado por ${rowDetail.creator.name}` : ''}{rowDetail.notes ? ` · ${rowDetail.notes}` : ''}</span>
                              <span className="font-bold">{rowDetail.invoices.length} CFDI · {CURRENCY_FORMATTER.format(rowDetail.totalAmount)}</span>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}

        {meta && meta.totalPages > 1 && (
          <div className="px-6 py-3 bg-brand-bone/50 border-t border-brand-sand/20 flex items-center justify-between">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
              className="flex items-center gap-1 px-4 py-2 text-[9px] font-bold uppercase tracking-widest text-brand-ink/60 hover:text-brand-ink disabled:opacity-30 transition-all">
              <ChevronLeft size={12}/> Anterior
            </button>
            <p className="text-[9px] font-bold uppercase tracking-widest text-brand-ink/40">Página {meta.page} de {meta.totalPages}</p>
            <button onClick={() => setPage(p => Math.min(meta.totalPages, p + 1))} disabled={page >= meta.totalPages}
              className="flex items-center gap-1 px-4 py-2 text-[9px] font-bold uppercase tracking-widest text-brand-ink/60 hover:text-brand-ink disabled:opacity-30 transition-all">
              Siguiente <ChevronRight size={12}/>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
