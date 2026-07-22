import React from 'react';
import {
  DollarSign,
  AlertTriangle,
  Clock,
  TrendingUp,
  CheckCircle2,
  Scale,
  Users,
  FileText,
  Send,
  Loader2,
  Ban,
  Search,
  Upload,
  RefreshCw,
  Award,
  ShieldAlert,
  Repeat,
  Gauge,
} from 'lucide-react';
import {
  api,
  type CxcCustomer,
  type Receivable,
  type ReceivablesAging,
  type ReceivablesRatios,
  type CashConversionCycle,
  type ReminderEffectiveness,
  type RankedCustomer,
  type AtRiskCustomer,
} from '../../../services/apiClient.ts';

const CURRENCY_FORMATTER = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
});

const BUCKET_COLOR: Record<string, string> = {
  current: 'bg-emerald-500',
  d1_30: 'bg-amber-400',
  d31_60: 'bg-orange-500',
  d61_90: 'bg-red-500',
  d90_plus: 'bg-red-800',
};

/** Semáforo de una factura por cobrar según su vencimiento. */
function receivableLight(r: Receivable): { color: string; dot: string; ring: string; label: string; days: number } {
  const ref = r.dueDate ?? r.date;
  const days = Math.floor((Date.now() - new Date(ref).getTime()) / 86_400_000);
  if (days > 0) return { color: 'text-red-600', dot: 'bg-red-500', ring: '#ef4444', label: `Vencida ${days}d`, days };
  if (days >= -7) return { color: 'text-amber-600', dot: 'bg-amber-400', ring: '#f59e0b', label: `Vence en ${Math.abs(days)}d`, days };
  return { color: 'text-emerald-600', dot: 'bg-emerald-500', ring: '#10b981', label: 'Vigente', days };
}

/**
 * Semáforo visual como anillo de progreso alrededor de la inicial del cliente.
 * El anillo se "llena" conforme se acerca y pasa el vencimiento: vacío/verde
 * (lejos), medio/ámbar (≤7 días), lleno/rojo (vencida). De un vistazo, sin leer.
 */
function RiskRing({ days, ring, initial }: { days: number; ring: string; initial: string }) {
  // Progreso 0→1 mapeando una ventana de -30 días (vigente) a +30 (muy vencida).
  const progress = Math.max(0.08, Math.min(1, (days + 30) / 60));
  const R = 16;
  const C = 2 * Math.PI * R;
  return (
    <span className="relative inline-flex items-center justify-center" style={{ width: 40, height: 40 }}>
      <svg width="40" height="40" className="-rotate-90">
        <circle cx="20" cy="20" r={R} fill="none" stroke="currentColor" strokeWidth="3" className="text-brand-sand/50" />
        <circle
          cx="20" cy="20" r={R} fill="none" stroke={ring} strokeWidth="3" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={C * (1 - progress)}
          style={{ transition: 'stroke-dashoffset .4s ease' }}
        />
      </svg>
      <span className="absolute text-[11px] font-bold text-brand-ink">{initial}</span>
    </span>
  );
}

/**
 * Cuentas por Cobrar (CxC): la empresa le factura y cobra a sus clientes.
 * Espejo invertido de Facturas por Pagar (CxP), con el mismo motor de
 * factura (Invoice.direction=RECEIVABLE) y el agente de cobranza automático
 * (WhatsApp + correo, ver JobsService.receivableReminders en el backend).
 */
export function ReceivablesView() {
  const fmt = (n: number) => CURRENCY_FORMATTER.format(n);
  const [customers, setCustomers] = React.useState<CxcCustomer[]>([]);
  const [receivables, setReceivables] = React.useState<Receivable[]>([]);
  const [aging, setAging] = React.useState<ReceivablesAging | null>(null);
  const [ratios, setRatios] = React.useState<ReceivablesRatios | null>(null);
  const [ccc, setCcc] = React.useState<CashConversionCycle | null>(null);
  const [effectiveness, setEffectiveness] = React.useState<ReminderEffectiveness | null>(null);
  const [ranking, setRanking] = React.useState<RankedCustomer[]>([]);
  const [atRisk, setAtRisk] = React.useState<AtRiskCustomer[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [showCustomerForm, setShowCustomerForm] = React.useState(false);
  const [showInvoiceForm, setShowInvoiceForm] = React.useState(false);
  const [importing, setImporting] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);
  // Filtros de la tabla
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('');

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [c, r, a, ra, cc, eff, rank, risk] = await Promise.all([
        api.getCustomers(),
        api.getReceivables(),
        api.getReceivablesAging(),
        api.getReceivablesRatios(),
        api.getCashConversionCycle(),
        api.getReminderEffectiveness(),
        api.getCustomerRanking(),
        api.getAtRiskCustomers(),
      ]);
      setCustomers(c);
      setReceivables(r);
      setAging(a);
      setRatios(ra);
      setCcc(cc);
      setEffectiveness(eff);
      setRanking(rank.customers);
      setAtRisk(risk.customers);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar la información.');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const handleImport = async (file: File) => {
    setImporting(true);
    try {
      const res = await api.bulkImportReceivablesZip(file);
      flash(`Importadas ${res.created} de ${res.total} facturas (${res.skipped} omitidas).`);
      await load();
    } catch (e) {
      flash(e instanceof Error ? e.message : 'No se pudo importar el ZIP.');
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(null), 3500); };

  const handleReminder = async (id: string) => {
    setBusyId(id);
    try {
      const res = await api.sendReceivableReminder(id);
      const channels = [res.whatsappSent && 'WhatsApp', res.emailSent && 'correo'].filter(Boolean);
      flash(channels.length ? `Recordatorio enviado por ${channels.join(' y ')}.` : 'Recordatorio registrado (canales en modo prueba).');
      await load();
    } catch (e) {
      flash(e instanceof Error ? e.message : 'No se pudo enviar el recordatorio.');
    } finally {
      setBusyId(null);
    }
  };

  const handleMarkPaid = async (id: string) => {
    setBusyId(id);
    try {
      await api.updateReceivableStatus(id, 'PAID');
      flash('Factura marcada como cobrada.');
      await load();
    } catch (e) {
      flash(e instanceof Error ? e.message : 'No se pudo actualizar la factura.');
    } finally {
      setBusyId(null);
    }
  };

  const pending = receivables.filter((r) => r.status === 'PENDING');
  const soon = pending.filter((r) => { const d = receivableLight(r).days; return d <= 0 && d >= -7; });
  const soonAmount = soon.reduce((s, r) => s + r.total, 0);

  const buckets = aging
    ? [
        { key: 'current', ...aging.buckets.current },
        { key: 'd1_30', ...aging.buckets.d1_30 },
        { key: 'd31_60', ...aging.buckets.d31_60 },
        { key: 'd61_90', ...aging.buckets.d61_90 },
        { key: 'd90_plus', ...aging.buckets.d90_plus },
      ]
    : [];
  const maxBucket = Math.max(1, ...buckets.map((b) => b.amount));
  const maxCustomer = Math.max(1, ...(aging?.byCustomer ?? []).map((c) => c.amount));

  const atRiskIds = new Set(atRisk.map((c) => c.customerId));
  const filtered = receivables.filter((r) => {
    if (statusFilter && r.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const hay = [r.folio, r.cfdiUuid, r.customer?.name].some((v) => v?.toLowerCase().includes(q));
      if (!hay) return false;
    }
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="animate-spin text-brand-gold" size={28} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-serif text-brand-ink">Cuentas por Cobrar</h2>
          <p className="text-[10px] text-brand-ink/40 font-serif">Cartera de clientes, antigüedad de saldos y agente de cobranza automático.</p>
        </div>
        <div className="flex gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".zip"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImport(f); }}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={importing}
            title="Importa facturas de venta desde un ZIP de CFDI exportado de tu ERP"
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-brand-sand rounded-xl text-[9px] font-bold uppercase tracking-widest text-brand-ink/60 hover:text-brand-ink hover:border-brand-gold transition-all disabled:opacity-50"
          >
            {importing ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />} Importar ZIP (ERP)
          </button>
          <button
            onClick={() => setShowCustomerForm((v) => !v)}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-brand-sand rounded-xl text-[9px] font-bold uppercase tracking-widest text-brand-ink/60 hover:text-brand-ink hover:border-brand-gold transition-all"
          >
            <Users size={13} /> Nuevo cliente
          </button>
          <button
            onClick={() => setShowInvoiceForm((v) => !v)}
            className="flex items-center gap-2 px-4 py-2.5 bg-brand-ink text-brand-bone rounded-xl text-[9px] font-bold uppercase tracking-widest hover:bg-brand-gold hover:text-brand-ink transition-all"
          >
            <FileText size={13} /> Nueva factura
          </button>
        </div>
      </div>

      {msg && <p className="text-[10px] font-bold text-brand-ink bg-brand-gold/15 border border-brand-gold/40 rounded-xl px-4 py-2.5">{msg}</p>}
      {error && <p className="text-[10px] font-bold text-red-600 flex items-center gap-1.5"><AlertTriangle size={12} /> {error}</p>}

      {showCustomerForm && (
        <NewCustomerForm onDone={async () => { setShowCustomerForm(false); await load(); flash('Cliente registrado.'); }} />
      )}
      {showInvoiceForm && (
        <NewReceivableForm customers={customers} onDone={async () => { setShowInvoiceForm(false); await load(); flash('Factura de venta registrada.'); }} />
      )}

      {/* KPIs con semáforo */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiTile icon={<DollarSign size={16} />} label="Total por cobrar" value={fmt(aging?.totals.amount ?? 0)} sub={`${aging?.totals.invoices ?? 0} factura(s)`} tone="ink" />
        <KpiTile icon={<AlertTriangle size={16} />} label="Vencido" value={fmt(aging?.totals.overdue ?? 0)} sub="Requiere cobro" tone="red" />
        <KpiTile icon={<Clock size={16} />} label="Por vencer ≤7d" value={fmt(soonAmount)} sub={`${soon.length} factura(s)`} tone="amber" />
        <KpiTile icon={<TrendingUp size={16} />} label="DSO" value={`${ratios?.dso.value ?? 0} d`} sub="Días de cobro" tone="gold" />
        <KpiTile icon={<CheckCircle2 size={16} />} label="Cobro a tiempo" value={`${ratios?.punctuality.onTimePct ?? 0}%`} sub={`${ratios?.punctuality.settled ?? 0} liquidadas`} tone="green" />
      </div>

      {/* Aging + concentración de cartera */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="editorial-card space-y-4">
          <div className="flex items-center gap-2">
            <Scale size={15} className="text-brand-gold" />
            <h3 className="text-sm font-bold text-brand-ink">Antigüedad de saldos</h3>
          </div>
          <div className="space-y-3">
            {buckets.map((b) => (
              <div key={b.key}>
                <div className="flex justify-between text-[10px] text-brand-ink/50 mb-1">
                  <span>{b.label} · {b.count}</span>
                  <span className="font-bold text-brand-ink">{fmt(b.amount)}</span>
                </div>
                <div className="h-2 rounded-full bg-brand-sand/40 overflow-hidden">
                  <div className={`h-full ${BUCKET_COLOR[b.key]} rounded-full transition-all`} style={{ width: `${(b.amount / maxBucket) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="editorial-card space-y-4">
          <div className="flex items-center gap-2">
            <Users size={15} className="text-brand-gold" />
            <h3 className="text-sm font-bold text-brand-ink">Concentración de cartera</h3>
            {ratios && <span className="ml-auto text-[9px] text-brand-ink/40 font-bold">Top 5: {ratios.customerConcentration.concentrationPct}%</span>}
          </div>
          {(aging?.byCustomer ?? []).length === 0 ? (
            <p className="text-[11px] text-brand-ink/40 font-serif py-6 text-center">Sin saldos por cobrar.</p>
          ) : (
            <div className="space-y-3">
              {(aging?.byCustomer ?? []).slice(0, 5).map((c) => (
                <div key={c.customerId}>
                  <div className="flex justify-between text-[10px] text-brand-ink/50 mb-1">
                    <span className="truncate max-w-[60%]">{c.name}</span>
                    <span className="font-bold text-brand-ink">
                      {fmt(c.amount)}{c.overdue > 0 && <span className="text-red-600"> · {fmt(c.overdue)} vencido</span>}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-brand-sand/40 overflow-hidden">
                    <div className="h-full bg-brand-gold rounded-full" style={{ width: `${(c.amount / maxCustomer) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Indicadores de valor: CCC, efectividad del agente, riesgo */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {ccc && (
          <div className="editorial-card space-y-2">
            <div className="flex items-center gap-2">
              <Repeat size={15} className="text-brand-gold" />
              <h3 className="text-sm font-bold text-brand-ink">Ciclo de conversión de efectivo</h3>
            </div>
            <p className={`text-3xl font-serif font-bold ${ccc.value <= 0 ? 'text-emerald-600' : 'text-amber-600'}`}>{ccc.value} <span className="text-sm">días</span></p>
            <p className="text-[10px] text-brand-ink/50">DSO {ccc.dso}d − DPO {ccc.dpo}d</p>
            <p className="text-[10px] text-brand-ink/40 font-serif leading-snug">{ccc.interpretation}</p>
          </div>
        )}
        {effectiveness && (
          <div className="editorial-card space-y-2">
            <div className="flex items-center gap-2">
              <Gauge size={15} className="text-brand-gold" />
              <h3 className="text-sm font-bold text-brand-ink">Efectividad del agente</h3>
            </div>
            <p className="text-3xl font-serif font-bold text-brand-ink">{effectiveness.reminderCoveragePct}%</p>
            <p className="text-[10px] text-brand-ink/50">de las facturas cobradas recibieron un recordatorio antes de pagarse</p>
            <div className="flex gap-4 pt-1 text-[10px] text-brand-ink/60">
              <span><b className="text-brand-ink">{effectiveness.avgDaysReminderToPayment}d</b> recordatorio→pago</span>
              <span><b className="text-brand-ink">{effectiveness.totalRemindersSent}</b> enviados</span>
            </div>
          </div>
        )}
        <div className="editorial-card space-y-2">
          <div className="flex items-center gap-2">
            <ShieldAlert size={15} className={atRisk.length ? 'text-red-500' : 'text-brand-gold'} />
            <h3 className="text-sm font-bold text-brand-ink">Clientes en riesgo</h3>
            <span className="ml-auto text-[9px] font-bold text-brand-ink/40">{atRisk.length}</span>
          </div>
          {atRisk.length === 0 ? (
            <p className="text-[11px] text-brand-ink/40 font-serif py-3">Ningún cliente en riesgo. 👍</p>
          ) : (
            <div className="space-y-2">
              {atRisk.slice(0, 4).map((c) => (
                <div key={c.customerId} className="flex items-start gap-2 p-2 rounded-lg bg-red-50 border border-red-100">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold text-brand-ink truncate">{c.name}</p>
                    <p className="text-[9px] text-red-600/80">{c.reason} · {fmt(c.overdueAmount)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Ranking de clientes por comportamiento de pago */}
      {ranking.length > 0 && (
        <div className="editorial-card space-y-3">
          <div className="flex items-center gap-2">
            <Award size={15} className="text-brand-gold" />
            <h3 className="text-sm font-bold text-brand-ink">Ranking de clientes · quién paga mejor</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[8px] uppercase tracking-widest font-bold text-brand-ink/40">
                  <th className="py-2">#</th>
                  <th className="py-2">Cliente</th>
                  <th className="py-2 text-right">Puntualidad</th>
                  <th className="py-2 text-right">Atraso prom.</th>
                  <th className="py-2 text-right">Volumen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-sand/10">
                {ranking.slice(0, 8).map((c, i) => (
                  <tr key={c.customerId} className="text-[11px]">
                    <td className="py-2 text-brand-ink/40 font-bold">{i + 1}</td>
                    <td className="py-2 font-bold text-brand-ink">{c.name}</td>
                    <td className="py-2 text-right">
                      <span className={`font-bold ${c.onTimePct >= 80 ? 'text-emerald-600' : c.onTimePct >= 50 ? 'text-amber-600' : 'text-red-600'}`}>{c.onTimePct}%</span>
                    </td>
                    <td className="py-2 text-right text-brand-ink/60">{c.avgDelayDays}d</td>
                    <td className="py-2 text-right font-serif text-brand-ink">{fmt(c.volume)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tabla de facturas con semáforo + acciones */}
      <div className="editorial-card !p-0 overflow-hidden border border-brand-sand/50">
        <div className="px-5 py-4 flex flex-wrap items-center gap-3 border-b border-brand-sand/40">
          <FileText size={15} className="text-brand-gold" />
          <h3 className="text-sm font-bold text-brand-ink">Facturas de venta</h3>
          <div className="ml-auto flex items-center gap-2">
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-brand-ink/30" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar folio o cliente…"
                className="pl-7 pr-3 py-1.5 bg-white border border-brand-sand rounded-lg text-[11px] focus:outline-none focus:border-brand-gold w-44"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="py-1.5 px-2 bg-white border border-brand-sand rounded-lg text-[11px] focus:outline-none focus:border-brand-gold"
            >
              <option value="">Todos</option>
              <option value="PENDING">Pendientes</option>
              <option value="PAID">Cobradas</option>
              <option value="REJECTED">Canceladas</option>
            </select>
            {(search || statusFilter) && (
              <button onClick={() => { setSearch(''); setStatusFilter(''); }} className="text-brand-ink/40 hover:text-brand-ink" title="Limpiar filtros">
                <RefreshCw size={12} />
              </button>
            )}
            <span className="text-[9px] text-brand-ink/40 font-bold">{filtered.length}/{receivables.length}</span>
          </div>
        </div>
        {receivables.length === 0 ? (
          <p className="px-6 py-10 text-center text-[11px] text-brand-ink/40 font-serif">Aún no hay facturas por cobrar. Crea un cliente y registra su primera factura.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-brand-sand/10">
                <tr>
                  <th className="px-5 py-3 text-[8px] uppercase tracking-widest font-bold text-brand-ink/40">Estado</th>
                  <th className="px-5 py-3 text-[8px] uppercase tracking-widest font-bold text-brand-ink/40">Folio / Cliente</th>
                  <th className="px-5 py-3 text-[8px] uppercase tracking-widest font-bold text-brand-ink/40 text-right">Total</th>
                  <th className="px-5 py-3 text-[8px] uppercase tracking-widest font-bold text-brand-ink/40">Vence</th>
                  <th className="px-5 py-3 text-[8px] uppercase tracking-widest font-bold text-brand-ink/40">Recordatorio</th>
                  <th className="px-5 py-3 text-[8px] uppercase tracking-widest font-bold text-brand-ink/40 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-sand/10">
                {filtered.map((r) => {
                  const light = receivableLight(r);
                  const paid = r.status === 'PAID';
                  const rejected = r.status === 'REJECTED';
                  const isRisk = r.customer ? atRiskIds.has(r.customer.id) : false;
                  return (
                    <tr key={r.id} className="hover:bg-brand-gold/5 transition-colors">
                      <td className="px-5 py-4">
                        {paid ? (
                          <span className="text-[8px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 inline-flex items-center gap-1"><CheckCircle2 size={10} /> Cobrada</span>
                        ) : rejected ? (
                          <span className="text-[8px] font-bold px-2 py-0.5 rounded-full bg-brand-sand/60 text-brand-ink/50 inline-flex items-center gap-1"><Ban size={10} /> Cancelada</span>
                        ) : (
                          <span className={`text-[10px] font-bold inline-flex items-center gap-1.5 ${light.color}`}>
                            <span className={`w-2 h-2 rounded-full ${light.dot}`} /> {light.label}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          {!paid && !rejected ? (
                            <RiskRing days={light.days} ring={light.ring} initial={(r.customer?.name ?? '?').charAt(0).toUpperCase()} />
                          ) : (
                            <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-brand-sand/40 text-[11px] font-bold text-brand-ink/50">{(r.customer?.name ?? '?').charAt(0).toUpperCase()}</span>
                          )}
                          <div>
                            <p className="font-bold text-brand-ink text-[12px]">{r.folio ?? r.cfdiUuid.slice(0, 8)}</p>
                            <p className="text-[9px] text-brand-ink/40 font-serif flex items-center gap-1">
                              {r.customer?.name ?? '—'}
                              {isRisk && <span className="text-[7px] font-bold text-red-600 bg-red-50 border border-red-200 rounded px-1 py-0.5 inline-flex items-center gap-0.5"><ShieldAlert size={8} /> RIESGO</span>}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right font-serif font-bold text-brand-ink">{fmt(r.total)}</td>
                      <td className="px-5 py-4 text-[11px] text-brand-ink/60">{r.dueDate ? new Date(r.dueDate).toLocaleDateString('es-MX') : '—'}</td>
                      <td className="px-5 py-4 text-[10px] text-brand-ink/40">{r.lastReminderSentAt ? new Date(r.lastReminderSentAt).toLocaleDateString('es-MX') : '—'}</td>
                      <td className="px-5 py-4">
                        <div className="flex gap-1.5 justify-end">
                          {!paid && !rejected && (
                            <>
                              <button
                                onClick={() => handleReminder(r.id)}
                                disabled={busyId === r.id}
                                className="px-3 py-1.5 bg-brand-gold/15 text-brand-ink rounded-lg text-[8px] font-bold uppercase tracking-widest hover:bg-brand-gold/25 transition-all disabled:opacity-50 flex items-center gap-1"
                              >
                                {busyId === r.id ? <Loader2 size={10} className="animate-spin" /> : <Send size={10} />} Recordar
                              </button>
                              <button
                                onClick={() => handleMarkPaid(r.id)}
                                disabled={busyId === r.id}
                                className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-[8px] font-bold uppercase tracking-widest hover:bg-emerald-700 transition-all disabled:opacity-50"
                              >
                                Cobrada
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function KpiTile({ icon, label, value, sub, tone }: { icon: React.ReactNode; label: string; value: string; sub?: string; tone: 'ink' | 'red' | 'amber' | 'gold' | 'green' }) {
  const tones: Record<string, string> = {
    ink: 'bg-brand-ink text-brand-bone border-transparent',
    red: 'bg-red-50 text-red-700 border-red-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    gold: 'bg-white text-brand-ink border-brand-gold/40',
    green: 'bg-green-50 text-green-700 border-green-200',
  };
  const isInk = tone === 'ink';
  return (
    <div className={`p-4 rounded-2xl border ${tones[tone]}`}>
      <div className={`flex items-center gap-1.5 mb-2 ${isInk ? 'text-brand-gold' : ''}`}>
        {icon}
        <span className={`text-[8px] uppercase font-bold tracking-widest ${isInk ? 'text-brand-bone/60' : 'opacity-70'}`}>{label}</span>
      </div>
      <p className="text-lg font-bold font-serif">{value}</p>
      {sub && <p className={`text-[8px] mt-0.5 ${isInk ? 'text-brand-bone/50' : 'opacity-60'}`}>{sub}</p>}
    </div>
  );
}

function NewCustomerForm({ onDone }: { onDone: () => void }) {
  const [f, setF] = React.useState({ name: '', rfc: '', legalName: '', email: '', phone: '', creditLimitDays: '' });
  const [err, setErr] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const submit = async () => {
    setErr(null);
    setSaving(true);
    try {
      await api.createCustomer({
        name: f.name,
        rfc: f.rfc,
        legalName: f.legalName || f.name,
        email: f.email || undefined,
        phone: f.phone || undefined,
        creditLimitDays: f.creditLimitDays ? Number(f.creditLimitDays) : undefined,
      });
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'No se pudo registrar el cliente.');
    } finally {
      setSaving(false);
    }
  };

  const inp = 'px-3 py-2.5 bg-white border border-brand-sand rounded-xl text-sm focus:outline-none focus:border-brand-gold';
  return (
    <div className="editorial-card space-y-3">
      <h4 className="text-sm font-bold text-brand-ink">Registrar cliente</h4>
      <div className="grid md:grid-cols-3 gap-3">
        <input className={inp} placeholder="Nombre comercial" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <input className={inp} placeholder="RFC" value={f.rfc} onChange={(e) => setF({ ...f, rfc: e.target.value })} />
        <input className={inp} placeholder="Razón social" value={f.legalName} onChange={(e) => setF({ ...f, legalName: e.target.value })} />
        <input className={inp} placeholder="Correo (para cobranza)" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        <input className={inp} placeholder="WhatsApp E.164 (+52...)" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
        <input className={inp} placeholder="Días de crédito" value={f.creditLimitDays} onChange={(e) => setF({ ...f, creditLimitDays: e.target.value })} />
      </div>
      {err && <p className="text-[10px] font-bold text-red-600">{err}</p>}
      <button onClick={submit} disabled={saving || !f.name || !f.rfc} className="btn-primary disabled:opacity-50">
        {saving ? 'Guardando…' : 'Guardar cliente'}
      </button>
    </div>
  );
}

function NewReceivableForm({ customers, onDone }: { customers: CxcCustomer[]; onDone: () => void }) {
  const genUuid = () =>
    (crypto as { randomUUID?: () => string }).randomUUID?.() ??
    `${Date.now().toString(16).padStart(8, '0')}-0000-4000-8000-000000000000`;
  const [f, setF] = React.useState({ customerId: '', folio: '', subtotal: '', date: new Date().toISOString().slice(0, 10), dueDate: '' });
  const [err, setErr] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const submit = async () => {
    setErr(null);
    setSaving(true);
    try {
      const sub = Number(f.subtotal);
      const iva = Math.round(sub * 0.16 * 100) / 100;
      // rfcEmisor/rfcReceptor los deriva el backend (RFC de la org y del cliente).
      await api.createReceivable({
        customerId: f.customerId,
        cfdiUuid: genUuid(),
        subtotal: sub,
        iva,
        total: Math.round((sub + iva) * 100) / 100,
        date: f.date,
        dueDate: f.dueDate || undefined,
        folio: f.folio || undefined,
      });
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'No se pudo registrar la factura.');
    } finally {
      setSaving(false);
    }
  };

  const inp = 'px-3 py-2.5 bg-white border border-brand-sand rounded-xl text-sm focus:outline-none focus:border-brand-gold';
  return (
    <div className="editorial-card space-y-3">
      <h4 className="text-sm font-bold text-brand-ink">Registrar factura de venta</h4>
      {customers.length === 0 ? (
        <p className="text-[11px] text-brand-ink/50 font-serif">Primero registra un cliente.</p>
      ) : (
        <>
          <div className="grid md:grid-cols-3 gap-3">
            <select className={inp} value={f.customerId} onChange={(e) => setF({ ...f, customerId: e.target.value })}>
              <option value="">Selecciona cliente…</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input className={inp} placeholder="Folio" value={f.folio} onChange={(e) => setF({ ...f, folio: e.target.value })} />
            <input className={inp} placeholder="Subtotal (sin IVA)" value={f.subtotal} onChange={(e) => setF({ ...f, subtotal: e.target.value })} />
            <label className="text-[9px] text-brand-ink/40 font-bold uppercase tracking-widest flex flex-col gap-1">
              Emisión
              <input type="date" className={inp} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
            </label>
            <label className="text-[9px] text-brand-ink/40 font-bold uppercase tracking-widest flex flex-col gap-1">
              Vencimiento
              <input type="date" className={inp} value={f.dueDate} onChange={(e) => setF({ ...f, dueDate: e.target.value })} />
            </label>
          </div>
          {err && <p className="text-[10px] font-bold text-red-600">{err}</p>}
          <button onClick={submit} disabled={saving || !f.customerId || !f.subtotal} className="btn-primary disabled:opacity-50">
            {saving ? 'Guardando…' : 'Guardar factura'}
          </button>
        </>
      )}
    </div>
  );
}
