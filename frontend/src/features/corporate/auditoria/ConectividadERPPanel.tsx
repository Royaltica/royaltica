import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Webhook,
  FolderDown,
  ArrowUpRight,
  FolderSync,
  RefreshCw,
  Activity,
  Database,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Loader2,
  BookOpen,
  Play,
  Plus,
} from 'lucide-react';
import { WebhookERPService, type WebhookEvent } from '../../../services/mockServices.ts';
import { MOCK_INVOICES } from '../../../types.ts';

const CURRENCY_FORMATTER = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
});

// ─── ConectividadERPPanel (unified Webhooks + Sync + Outbound) ───────────────
type OutboundERPEvent = {
  id: string;
  invoiceId: string;
  provider: string;
  amount: number;
  date: string;           // ISO date of the event
  tipo: 'aprobada' | 'pagada_caja' | 'pagada_factoraje' | 'rechazada';
  asientoContable: string; // e.g. "DB: Proveedores / CR: Banco"
  cuentaDB: string;
  cuentaCR: string;
  syncStatus: 'pendiente' | 'sincronizado' | 'error';
  syncedAt?: string;
  erpPolicyId?: string;
};

function buildOutboundEvents(): OutboundERPEvent[] {
  const out: OutboundERPEvent[] = [];
  let seq = 1;
  MOCK_INVOICES.forEach(inv => {
    // Approved (audited) → generates CxP registration event
    if (inv.status === 'audited' || inv.status === 'approved') {
      out.push({
        id: `OUT-${String(seq++).padStart(4, '0')}`,
        invoiceId: inv.id,
        provider: inv.provider,
        amount: inv.amount,
        date: inv.date,
        tipo: 'aprobada',
        asientoContable: 'DB: Proveedores · CR: CxP por Pagar',
        cuentaDB: '2010 Proveedores',
        cuentaCR: '2110 CxP',
        syncStatus: 'sincronizado',
        syncedAt: new Date(new Date(inv.date).getTime() + 86400000).toISOString(),
        erpPolicyId: `POL-${inv.id.replace('FAC-', '')}`,
      });
    }
    // Paid → generates liquidation event
    if (inv.status === 'paid') {
      const isCash = inv.paymentRoute === 'cash';
      out.push({
        id: `OUT-${String(seq++).padStart(4, '0')}`,
        invoiceId: inv.id,
        provider: inv.provider,
        amount: inv.paidAmount || inv.amount,
        date: inv.date,
        tipo: isCash ? 'pagada_caja' : 'pagada_factoraje',
        asientoContable: isCash
          ? 'DB: CxP por Pagar · CR: Bancos'
          : 'DB: CxP por Pagar · CR: Factoraje · CR: Gasto Financiero',
        cuentaDB: '2110 CxP',
        cuentaCR: isCash ? '1020 Bancos (SPEI)' : '2150 Factoraje + 5200 Gasto Fin.',
        syncStatus: seq % 7 === 0 ? 'pendiente' : 'sincronizado',
        syncedAt: seq % 7 === 0 ? undefined : new Date(new Date(inv.date).getTime() + 172800000).toISOString(),
        erpPolicyId: seq % 7 === 0 ? undefined : `POL-LIQ-${inv.id.replace('FAC-', '')}`,
      });
    }
  });
  // Sort by date descending
  out.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return out;
}

export function ConectividadERPPanel() {
  const [view, setView] = React.useState<'entrantes' | 'salientes' | 'jobs'>('entrantes');

  // ─── Webhooks State (inbound) ───
  const [events, setEvents] = React.useState<WebhookEvent[]>(WebhookERPService.getEvents());
  const [acting, setActing] = React.useState<string | null>(null);
  const [retrying, setRetrying] = React.useState<Record<string, { attempts: number; maxAttempts: number; status: 'retrying' | 'success' | 'failed' }>>({});
  const [autoRetry, setAutoRetry] = React.useState(true);

  // ─── Outbound State ───
  const [outboundEvents, setOutboundEvents] = React.useState<OutboundERPEvent[]>(() => buildOutboundEvents());
  const [outboundFilter, setOutboundFilter] = React.useState<'todos' | 'aprobada' | 'pagada_caja' | 'pagada_factoraje' | 'rechazada' | 'pendiente'>('todos');
  const [syncingOutbound, setSyncingOutbound] = React.useState<string | null>(null);

  // ─── Sync Jobs State ───
  const [syncJobs, setSyncJobs] = React.useState([
    { id: 'SYNC-001', type: 'Saldos de Balance', source: 'Aspel COI', target: 'Royáltica BG', schedule: 'Diario 06:00', lastRun: '2024-04-26 06:00', status: 'success' as const, records: 48, duration: '12s' },
    { id: 'SYNC-002', type: 'Pólizas del Día', source: 'Aspel COI', target: 'Royáltica ER', schedule: 'Diario 06:05', lastRun: '2024-04-26 06:05', status: 'success' as const, records: 23, duration: '8s' },
    { id: 'SYNC-003', type: 'Cuentas por Cobrar', source: 'Aspel SAE', target: 'Royáltica BG', schedule: 'Cada 4 hrs', lastRun: '2024-04-26 10:00', status: 'success' as const, records: 156, duration: '18s' },
    { id: 'SYNC-004', type: 'Nómina Acumulada', source: 'Aspel NOI', target: 'Royáltica ER', schedule: 'Quincenal', lastRun: '2024-04-15 08:00', status: 'success' as const, records: 89, duration: '6s' },
    { id: 'SYNC-005', type: 'Activos Fijos', source: 'Aspel COI', target: 'Royáltica BG', schedule: 'Mensual', lastRun: '2024-04-01 07:00', status: 'partial' as const, records: 87, duration: '22s' },
  ]);
  const [syncing, setSyncing] = React.useState<string | null>(null);
  const [showNewJob, setShowNewJob] = React.useState(false);

  React.useEffect(() => {
    WebhookERPService.subscribe(setEvents);
    return () => WebhookERPService.unsubscribe(setEvents);
  }, []);

  const handleSimulate = () => {
    const ev = WebhookERPService.simulateWebhook();
    setTimeout(() => { WebhookERPService.processReconciliation(ev.id); }, 2000);
  };

  const handleManualSync = (id: string) => {
    setActing(id);
    setTimeout(() => { WebhookERPService.processReconciliation(id); setActing(null); }, 500);
  };

  const handleRetry = (id: string) => {
    const maxAttempts = 3;
    setRetrying(prev => ({ ...prev, [id]: { attempts: 1, maxAttempts, status: 'retrying' } }));
    const attemptRetry = (attempt: number) => {
      const delay = Math.pow(2, attempt) * 500;
      setTimeout(() => {
        const success = Math.random() > 0.3;
        if (success || attempt >= maxAttempts) {
          if (success) { WebhookERPService.processReconciliation(id); setRetrying(prev => ({ ...prev, [id]: { attempts: attempt, maxAttempts, status: 'success' } })); }
          else { setRetrying(prev => ({ ...prev, [id]: { attempts: attempt, maxAttempts, status: 'failed' } })); }
        } else { setRetrying(prev => ({ ...prev, [id]: { attempts: attempt + 1, maxAttempts, status: 'retrying' } })); attemptRetry(attempt + 1); }
      }, delay);
    };
    attemptRetry(1);
  };

  React.useEffect(() => {
    if (!autoRetry) return;
    events.filter(ev => ev.status === 'pending_match').forEach(ev => {
      if (!retrying[ev.id]) { setTimeout(() => handleRetry(ev.id), 5000); }
    });
  }, [events, autoRetry]);

  const runSync = (id: string) => {
    setSyncing(id);
    setTimeout(() => {
      setSyncJobs(prev => prev.map(j => j.id === id ? { ...j, lastRun: new Date().toLocaleString('es-MX'), status: 'success' as const, records: j.records + Math.floor(Math.random() * 10) } : j));
      setSyncing(null);
    }, 2500);
  };

  const runAll = () => {
    setSyncing('all');
    setTimeout(() => {
      setSyncJobs(prev => prev.map(j => ({ ...j, lastRun: new Date().toLocaleString('es-MX'), status: 'success' as const })));
      setSyncing(null);
    }, 4000);
  };

  // Sync a single outbound event to ERP
  const handleSyncOutbound = (eventId: string) => {
    setSyncingOutbound(eventId);
    setTimeout(() => {
      setOutboundEvents(prev => prev.map(e => e.id === eventId ? {
        ...e,
        syncStatus: 'sincronizado' as const,
        syncedAt: new Date().toISOString(),
        erpPolicyId: `POL-SYNC-${e.invoiceId.replace('FAC-', '')}`,
      } : e));
      setSyncingOutbound(null);
    }, 1500);
  };

  // Sync all pending outbound events
  const handleSyncAllOutbound = () => {
    setSyncingOutbound('all');
    setTimeout(() => {
      setOutboundEvents(prev => prev.map(e => e.syncStatus === 'pendiente' ? {
        ...e,
        syncStatus: 'sincronizado' as const,
        syncedAt: new Date().toISOString(),
        erpPolicyId: `POL-SYNC-${e.invoiceId.replace('FAC-', '')}`,
      } : e));
      setSyncingOutbound(null);
    }, 3000);
  };

  const STATUS_CONFIG: Record<WebhookEvent['status'], { label: string; badge: string }> = {
    pending_match:   { label: 'Buscando Match', badge: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
    matched_syncing: { label: 'Conectando API...', badge: 'bg-blue-100 text-blue-700 border-blue-200' },
    synced:          { label: 'Sincronizado', badge: 'bg-teal-100 text-teal-700 border-teal-200' },
  };

  const OUTBOUND_TIPO_CONFIG: Record<OutboundERPEvent['tipo'], { icon: string; label: string; badge: string; color: string }> = {
    aprobada:          { icon: '✅', label: 'Factura Aprobada', badge: 'bg-green-50 text-green-700 border-green-200', color: 'text-green-600' },
    pagada_caja:       { icon: '💳', label: 'Pagada — Caja Propia', badge: 'bg-blue-50 text-blue-700 border-blue-200', color: 'text-blue-600' },
    pagada_factoraje:  { icon: '🏦', label: 'Pagada — Factoraje', badge: 'bg-purple-50 text-purple-700 border-purple-200', color: 'text-purple-600' },
    rechazada:         { icon: '❌', label: 'Rechazada', badge: 'bg-red-50 text-red-700 border-red-200', color: 'text-red-600' },
  };

  const pendingWebhooks = events.filter(e => e.status === 'pending_match').length;
  const syncedWebhooks = events.filter(e => e.status === 'synced').length;
  const pendingOutbound = outboundEvents.filter(e => e.syncStatus === 'pendiente').length;
  const syncedOutbound = outboundEvents.filter(e => e.syncStatus === 'sincronizado').length;

  // Group outbound events by day
  const filteredOutbound = outboundEvents.filter(e => {
    if (outboundFilter === 'todos') return true;
    if (outboundFilter === 'pendiente') return e.syncStatus === 'pendiente';
    return e.tipo === outboundFilter;
  });
  const outboundByDay: Record<string, OutboundERPEvent[]> = {};
  filteredOutbound.forEach(ev => {
    const dayKey = ev.date.slice(0, 10); // YYYY-MM-DD
    if (!outboundByDay[dayKey]) outboundByDay[dayKey] = [];
    outboundByDay[dayKey].push(ev);
  });
  const sortedDays = Object.keys(outboundByDay).sort((a, b) => b.localeCompare(a));

  const formatDayLabel = (dateStr: string) => {
    const d = new Date(dateStr + 'T12:00:00');
    const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return `${dayNames[d.getDay()]} ${d.getDate()} ${monthNames[d.getMonth()]} ${d.getFullYear()}`;
  };

  return (
    <div className="space-y-6">
      {/* ─── Unified Header ─── */}
      <div className="bg-white p-6 rounded-2xl border border-brand-sand/30 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-600 flex-shrink-0">
              <Webhook size={22} />
            </div>
            <div>
              <h4 className="text-base font-bold text-brand-ink">Conectividad ERP</h4>
              <p className="text-[9px] text-brand-ink/40 uppercase tracking-widest">Eventos entrantes y salientes · Sincronización bidireccional · Aspel COI / SAE / NOI</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[8px] font-bold text-brand-ink/30 uppercase tracking-wider">Endpoint activo</span>
            </div>
          </div>
        </div>

        {/* KPI strip + view toggle */}
        <div className="flex items-center justify-between">
          <div className="flex gap-5">
            {[
              { label: 'Entrantes', value: events.length, sub: `${pendingWebhooks} pendientes`, color: pendingWebhooks > 0 ? 'text-amber-500' : 'text-green-500' },
              { label: 'Salientes', value: outboundEvents.length, sub: `${pendingOutbound} por sincronizar`, color: pendingOutbound > 0 ? 'text-amber-500' : 'text-green-500' },
              { label: 'Sync OK', value: syncedWebhooks + syncedOutbound, sub: 'registrados en ERP', color: 'text-teal-600' },
              { label: 'Jobs', value: syncJobs.length, sub: `${syncJobs.reduce((s, j) => s + j.records, 0)} registros`, color: 'text-brand-gold' },
              { label: 'Errores 7D', value: 0, sub: 'sin incidentes', color: 'text-green-500' },
            ].map(kpi => (
              <div key={kpi.label} className="text-center">
                <p className={`font-serif text-xl ${kpi.color}`}>{kpi.value}</p>
                <p className="text-[7px] uppercase tracking-[.15em] font-bold text-brand-ink/30">{kpi.label}</p>
                <p className="text-[7px] text-brand-ink/20">{kpi.sub}</p>
              </div>
            ))}
          </div>

          <div className="flex gap-1 bg-brand-bone/60 p-1 rounded-xl">
            {([
              { key: 'entrantes' as const, icon: <FolderDown size={11} />, label: '📥 Del ERP' },
              { key: 'salientes' as const, icon: <ArrowUpRight size={11} />, label: '📤 Al ERP' },
              { key: 'jobs' as const, icon: <FolderSync size={11} />, label: '⚙️ Jobs' },
            ]).map(tab => (
              <button key={tab.key} onClick={() => setView(tab.key)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all ${
                  view === tab.key ? 'bg-brand-ink text-brand-paper shadow-sm' : 'text-brand-ink/40 hover:text-brand-ink'
                }`}>
                {tab.label}
                {tab.key === 'salientes' && pendingOutbound > 0 && (
                  <span className="ml-1 w-4 h-4 rounded-full bg-amber-500 text-white text-[7px] font-bold flex items-center justify-center">{pendingOutbound}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {/* ═══════════ EVENTOS ENTRANTES (📥 Del ERP) ═══════════ */}
        {view === 'entrantes' && (
          <motion.div key="entrantes" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
            {/* Action bar */}
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-brand-ink/40 flex items-center gap-2">
                <FolderDown size={13} className="text-teal-500" />
                Transacciones bancarias que entran al sistema vía webhook para conciliación automática
              </p>
              <div className="flex items-center gap-3">
                <button onClick={() => setAutoRetry(!autoRetry)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[9px] font-bold uppercase tracking-widest transition-all border ${
                    autoRetry ? 'bg-teal-50 border-teal-200 text-teal-700' : 'bg-brand-bone border-brand-sand/30 text-brand-ink/40'
                  }`}>
                  <RefreshCw size={11} className={autoRetry ? 'animate-spin' : ''} style={autoRetry ? {animationDuration: '3s'} : {}} /> Auto-Retry {autoRetry ? 'ON' : 'OFF'}
                </button>
                <button onClick={handleSimulate} className="flex items-center gap-2 px-4 py-2 bg-brand-ink text-brand-bone rounded-xl text-[9px] font-bold uppercase tracking-widest hover:bg-brand-gold hover:text-brand-ink transition-all">
                  <Activity size={12} /> Simular Webhook
                </button>
              </div>
            </div>

            {/* Events table */}
            <div className="editorial-card !p-0 overflow-hidden border border-brand-sand/50">
              <div className="px-6 py-3 bg-white/50 border-b border-brand-sand/20 flex items-center justify-between">
                <p className="text-sm font-bold text-brand-ink flex items-center gap-2"><Database size={13} className="text-brand-gold"/> Feed Transaccional Bancario</p>
                <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"/><span className="text-[8px] font-bold text-brand-ink/40 uppercase tracking-wider">Escuchando</span></div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-separate border-spacing-0 min-w-[800px]">
                  <thead className="bg-brand-sand/10 sticky top-0 z-10">
                    <tr>
                      {['ID / Banco', 'Tx Ref', 'Monto', 'Conciliación', 'Estado'].map(h => (
                        <th key={h} className="px-5 py-3 label-caps !opacity-40 border-b border-brand-sand text-brand-ink">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-sand/20">
                    {events.map(ev => {
                      const st = STATUS_CONFIG[ev.status];
                      return (
                        <tr key={ev.id} className="hover:bg-brand-gold/5 transition-all">
                          <td className="px-5 py-3">
                            <span className="text-[9px] font-bold font-mono text-brand-ink block">{ev.id}</span>
                            <span className="text-[8px] text-brand-ink/30">{ev.bank} · {new Date(ev.date).toLocaleString('es-MX')}</span>
                          </td>
                          <td className="px-5 py-3"><span className="text-[9px] font-mono bg-brand-sand/20 px-2 py-1 rounded-md text-brand-ink/60">{ev.tx_reference}</span></td>
                          <td className="px-5 py-3 text-sm font-bold font-serif text-brand-ink">{CURRENCY_FORMATTER.format(ev.amount)}</td>
                          <td className="px-5 py-3">
                            {ev.status === 'pending_match' ? (
                              <span className="text-[9px] text-brand-ink/40 font-mono flex items-center gap-1"><Activity size={10} className="animate-pulse" /> Buscando...</span>
                            ) : (
                              <div>
                                <p className="text-[10px] font-bold text-brand-ink">{ev.provider_name}</p>
                                <p className="text-[8px] font-mono text-teal-700/70 flex items-center gap-1"><CheckCircle2 size={9} /> {ev.matched_invoice_uuid}</p>
                              </div>
                            )}
                          </td>
                          <td className="px-5 py-3">
                            <span className={`text-[8px] font-bold uppercase tracking-widest px-2 py-1 rounded-full border ${st.badge} flex items-center gap-1 w-fit`}>
                              {ev.status === 'matched_syncing' && <motion.div animate={{rotate:360}} transition={{repeat:Infinity,duration:1,ease:'linear'}} className="w-2 h-2 border border-blue-500/30 border-t-blue-600 rounded-full"/>}
                              {st.label}
                            </span>
                            {ev.erp_policy_id && (
                              <span className="text-[8px] font-mono text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded-md flex items-center gap-1 border border-teal-100 mt-1 w-fit">
                                <FolderSync size={9} /> {ev.erp_policy_id}
                              </span>
                            )}
                            {ev.status === 'pending_match' && (
                              <div className="flex items-center gap-2 mt-1.5">
                                <button onClick={() => handleManualSync(ev.id)} disabled={acting === ev.id} className="text-[8px] uppercase font-bold text-brand-gold hover:underline tracking-widest">
                                  {acting === ev.id ? 'Forzando...' : 'Match Manual'}
                                </button>
                                {retrying[ev.id] ? (
                                  <span className={`text-[8px] font-bold uppercase tracking-widest flex items-center gap-1 ${retrying[ev.id].status === 'retrying' ? 'text-blue-600' : retrying[ev.id].status === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                                    {retrying[ev.id].status === 'retrying' && <><RefreshCw size={8} className="animate-spin" /> {retrying[ev.id].attempts}/{retrying[ev.id].maxAttempts}</>}
                                    {retrying[ev.id].status === 'success' && <><CheckCircle2 size={8} /> OK</>}
                                    {retrying[ev.id].status === 'failed' && <><AlertCircle size={8} /> Fallido</>}
                                  </span>
                                ) : (
                                  <button onClick={() => handleRetry(ev.id)} className="text-[8px] uppercase font-bold text-teal-600 hover:underline tracking-widest flex items-center gap-1">
                                    <RefreshCw size={8} /> Retry
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {events.length === 0 && (
                      <tr><td colSpan={5} className="px-6 py-10 text-center text-brand-ink/30 font-serif text-sm">Esperando transacciones vía Webhook.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {/* ═══════════ EVENTOS SALIENTES (📤 Al ERP) ═══════════ */}
        {view === 'salientes' && (
          <motion.div key="salientes" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
            {/* Description + Actions */}
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-brand-ink/40 flex items-center gap-2">
                <ArrowUpRight size={13} className="text-purple-500" />
                Facturas validadas y pagadas que se envían al ERP para registro contable automático
              </p>
              <div className="flex items-center gap-3">
                {pendingOutbound > 0 && (
                  <button onClick={handleSyncAllOutbound} disabled={syncingOutbound !== null}
                    className="flex items-center gap-2 px-4 py-2 bg-brand-ink text-brand-bone rounded-xl text-[9px] font-bold uppercase tracking-widest hover:bg-brand-gold hover:text-brand-ink transition-all disabled:opacity-50">
                    {syncingOutbound === 'all' ? <Loader2 size={12} className="animate-spin" /> : <FolderSync size={12} />}
                    Sincronizar Todo ({pendingOutbound})
                  </button>
                )}
              </div>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-2 flex-wrap">
              {([
                { key: 'todos' as const, label: 'Todos', count: outboundEvents.length },
                { key: 'aprobada' as const, label: '✅ Aprobadas', count: outboundEvents.filter(e => e.tipo === 'aprobada').length },
                { key: 'pagada_caja' as const, label: '💳 Caja Propia', count: outboundEvents.filter(e => e.tipo === 'pagada_caja').length },
                { key: 'pagada_factoraje' as const, label: '🏦 Factoraje', count: outboundEvents.filter(e => e.tipo === 'pagada_factoraje').length },
                { key: 'pendiente' as const, label: '⏳ Pendientes', count: pendingOutbound },
              ]).map(f => (
                <button key={f.key} onClick={() => setOutboundFilter(f.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[9px] font-bold transition-all border ${
                    outboundFilter === f.key
                      ? 'bg-brand-ink text-brand-paper border-brand-ink shadow-sm'
                      : 'bg-white text-brand-ink/50 border-brand-sand/30 hover:border-brand-ink/20'
                  }`}>
                  {f.label}
                  <span className={`ml-0.5 text-[8px] px-1.5 py-0.5 rounded-full ${
                    outboundFilter === f.key ? 'bg-brand-paper/20 text-brand-paper' : 'bg-brand-sand/30 text-brand-ink/30'
                  }`}>{f.count}</span>
                </button>
              ))}
            </div>

            {/* Summary strip: totals by event type */}
            <div className="grid grid-cols-4 gap-3">
              {([
                { tipo: 'aprobada' as const, label: 'CxP Registradas', desc: 'DB: Proveedores · CR: CxP' },
                { tipo: 'pagada_caja' as const, label: 'Liquidadas Caja', desc: 'DB: CxP · CR: Bancos' },
                { tipo: 'pagada_factoraje' as const, label: 'Liquidadas Factoraje', desc: 'DB: CxP · CR: Factoraje + Gasto' },
                { tipo: 'rechazada' as const, label: 'Rechazadas', desc: 'Cancela CxP en ERP' },
              ]).map(s => {
                const eventsOfType = outboundEvents.filter(e => e.tipo === s.tipo);
                const total = eventsOfType.reduce((sum, e) => sum + e.amount, 0);
                const cfg = OUTBOUND_TIPO_CONFIG[s.tipo];
                return (
                  <div key={s.tipo} className={`rounded-xl border p-3 ${cfg.badge}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-base">{cfg.icon}</span>
                      <span className="text-[8px] font-bold uppercase tracking-wider">{s.label}</span>
                    </div>
                    <p className={`font-serif text-lg ${cfg.color}`}>{CURRENCY_FORMATTER.format(total)}</p>
                    <p className="text-[8px] opacity-60 mt-0.5">{eventsOfType.length} eventos · {s.desc}</p>
                  </div>
                );
              })}
            </div>

            {/* Feed grouped by day */}
            <div className="space-y-4">
              {sortedDays.map(day => {
                const dayEvents = outboundByDay[day];
                const dayTotal = dayEvents.reduce((s, e) => s + e.amount, 0);
                const dayPending = dayEvents.filter(e => e.syncStatus === 'pendiente').length;
                return (
                  <div key={day} className="editorial-card !p-0 overflow-hidden border border-brand-sand/30">
                    {/* Day header */}
                    <div className="px-5 py-3 bg-gradient-to-r from-brand-bone/80 to-white border-b border-brand-sand/20 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-brand-ink/5 flex items-center justify-center">
                          <Calendar size={14} className="text-brand-ink/40" />
                        </div>
                        <div>
                          <p className="text-[11px] font-bold text-brand-ink">{formatDayLabel(day)}</p>
                          <p className="text-[8px] text-brand-ink/30">{dayEvents.length} eventos · {CURRENCY_FORMATTER.format(dayTotal)}</p>
                        </div>
                      </div>
                      {dayPending > 0 && (
                        <span className="text-[8px] font-bold px-2 py-1 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                          {dayPending} pendiente{dayPending > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>

                    {/* Events for this day */}
                    <div className="divide-y divide-brand-sand/10">
                      {dayEvents.map((ev, idx) => {
                        const tipoCfg = OUTBOUND_TIPO_CONFIG[ev.tipo];
                        const isSyncing = syncingOutbound === ev.id || syncingOutbound === 'all';
                        return (
                          <motion.div key={ev.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.03 }}
                            className="px-5 py-3.5 hover:bg-brand-gold/5 transition-all">
                            <div className="flex items-center gap-4">
                              {/* Icon + Type */}
                              <div className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-lg" style={{ background: 'var(--color-brand-bone)' }}>
                                {tipoCfg.icon}
                              </div>

                              {/* Invoice + Provider info */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <span className={`text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${tipoCfg.badge}`}>{tipoCfg.label}</span>
                                  <span className="text-[9px] font-mono text-brand-ink/30">{ev.invoiceId}</span>
                                </div>
                                <p className="text-[10px] font-bold text-brand-ink truncate">{ev.provider}</p>
                              </div>

                              {/* Amount */}
                              <div className="text-right flex-shrink-0 mr-4">
                                <p className={`font-serif text-sm font-bold ${tipoCfg.color}`}>{CURRENCY_FORMATTER.format(ev.amount)}</p>
                              </div>

                              {/* Accounting entry */}
                              <div className="flex-shrink-0 w-52 hidden xl:block">
                                <p className="text-[8px] font-mono text-brand-ink/40 leading-relaxed">
                                  <span className="text-brand-ink/60">DB:</span> {ev.cuentaDB}
                                </p>
                                <p className="text-[8px] font-mono text-brand-ink/40 leading-relaxed">
                                  <span className="text-brand-ink/60">CR:</span> {ev.cuentaCR}
                                </p>
                              </div>

                              {/* Sync status */}
                              <div className="flex-shrink-0 w-32 text-right">
                                {ev.syncStatus === 'sincronizado' ? (
                                  <div>
                                    <span className="text-[8px] font-bold uppercase tracking-widest text-teal-600 flex items-center gap-1 justify-end">
                                      <CheckCircle2 size={10} /> Sincronizado
                                    </span>
                                    {ev.erpPolicyId && (
                                      <span className="text-[7px] font-mono text-teal-600/60 block mt-0.5">{ev.erpPolicyId}</span>
                                    )}
                                  </div>
                                ) : ev.syncStatus === 'error' ? (
                                  <div>
                                    <span className="text-[8px] font-bold uppercase tracking-widest text-red-500 flex items-center gap-1 justify-end">
                                      <AlertCircle size={10} /> Error
                                    </span>
                                    <button onClick={() => handleSyncOutbound(ev.id)} disabled={isSyncing}
                                      className="text-[8px] uppercase font-bold text-brand-gold hover:underline tracking-widest mt-0.5">
                                      Re-intentar
                                    </button>
                                  </div>
                                ) : (
                                  <button onClick={() => handleSyncOutbound(ev.id)} disabled={isSyncing}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-ink text-brand-paper text-[8px] font-bold uppercase tracking-wider rounded-lg hover:bg-brand-gold hover:text-brand-ink transition-all disabled:opacity-50">
                                    {isSyncing ? <Loader2 size={10} className="animate-spin" /> : <ArrowUpRight size={10} />}
                                    {isSyncing ? 'Enviando...' : 'Sincronizar'}
                                  </button>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {filteredOutbound.length === 0 && (
                <div className="text-center py-12">
                  <ArrowUpRight size={32} className="text-brand-ink/10 mx-auto mb-3" />
                  <p className="text-brand-ink/30 font-serif text-sm">No hay eventos para este filtro.</p>
                </div>
              )}
            </div>

            {/* Legend / accounting guide */}
            <div className="bg-gradient-to-br from-brand-ink to-brand-ink/90 rounded-2xl p-5 text-brand-paper">
              <div className="flex items-center gap-2 mb-3">
                <BookOpen size={14} className="text-brand-gold" />
                <h3 className="text-sm font-serif tracking-tight">Guía de Asientos Contables</h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { icon: '✅', title: 'Factura Aprobada → Registra CxP', desc: 'DB: 2010 Proveedores · CR: 2110 Cuentas por Pagar. Se genera al aprobar la auditoría.' },
                  { icon: '💳', title: 'Pagada Caja Propia → Liquida CxP', desc: 'DB: 2110 CxP · CR: 1020 Bancos (SPEI). Se genera al ejecutar el pago directo.' },
                  { icon: '🏦', title: 'Pagada Factoraje → Liquida CxP + Gasto', desc: 'DB: 2110 CxP · CR: 2150 Factoraje + 5200 Gasto Financiero (comisión).' },
                  { icon: '❌', title: 'Rechazada → Cancela CxP', desc: 'Reversa el asiento de CxP. La factura no se procesa para pago en el ERP.' },
                ].map(g => (
                  <div key={g.title} className="flex gap-3">
                    <span className="text-lg flex-shrink-0">{g.icon}</span>
                    <div>
                      <p className="text-[10px] font-bold text-brand-paper/90">{g.title}</p>
                      <p className="text-[8px] text-brand-paper/50 leading-relaxed mt-0.5">{g.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* ═══════════ JOBS PROGRAMADOS ═══════════ */}
        {view === 'jobs' && (
          <motion.div key="jobs" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
            {/* Action bar */}
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-brand-ink/40 flex items-center gap-2">
                <FolderSync size={13} className="text-brand-gold" />
                Sincronización automática programada entre ERP y Royáltica
              </p>
              <div className="flex items-center gap-2">
                <button onClick={runAll} disabled={syncing !== null}
                  className="flex items-center gap-2 px-4 py-2 bg-brand-ink text-brand-paper text-[9px] font-bold uppercase tracking-wider rounded-xl hover:bg-brand-ink/80 transition-all disabled:opacity-50">
                  {syncing === 'all' ? <Loader2 size={11} className="animate-spin" /> : <Play size={11} />} Sincronizar Todo
                </button>
                <button onClick={() => setShowNewJob(!showNewJob)}
                  className="flex items-center gap-2 px-4 py-2 bg-brand-gold/10 text-brand-gold text-[9px] font-bold uppercase tracking-wider rounded-xl hover:bg-brand-gold/20 transition-all">
                  <Plus size={11} /> Nuevo Job
                </button>
              </div>
            </div>

            {/* New Job Form */}
            <AnimatePresence>
              {showNewJob && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                  className="bg-brand-bone/50 rounded-2xl border border-brand-sand/30 p-5 overflow-hidden">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-brand-ink mb-4">Nuevo Job de Sincronización</h4>
                  <div className="grid grid-cols-4 gap-4">
                    {[
                      { label: 'Tipo de datos', options: ['Saldos de Balance', 'Pólizas Contables', 'Cuentas por Cobrar', 'Nómina', 'Activos Fijos', 'Inventarios'] },
                      { label: 'Origen (ERP)', options: ['Aspel COI', 'Aspel SAE', 'Aspel NOI'] },
                      { label: 'Destino', options: ['Royáltica ER', 'Royáltica BG', 'Ambos'] },
                      { label: 'Frecuencia', options: ['Diario', 'Cada 4 horas', 'Cada hora', 'Quincenal', 'Mensual'] },
                    ].map(field => (
                      <div key={field.label}>
                        <label className="text-[8px] uppercase tracking-wider text-brand-ink/40 font-bold block mb-1">{field.label}</label>
                        <select className="w-full text-[10px] px-3 py-2 rounded-xl border border-brand-sand/30 bg-white/80 text-brand-ink">
                          {field.options.map(o => <option key={o}>{o}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-end gap-2 mt-4">
                    <button onClick={() => setShowNewJob(false)} className="px-4 py-2 text-[9px] font-bold uppercase tracking-wider text-brand-ink/40 hover:text-brand-ink">Cancelar</button>
                    <button onClick={() => {
                      setSyncJobs(prev => [...prev, { id: `SYNC-${String(prev.length + 1).padStart(3, '0')}`, type: 'Inventarios', source: 'Aspel SAE', target: 'Royáltica BG', schedule: 'Diario 07:00', lastRun: 'Pendiente', status: 'success', records: 0, duration: '—' }]);
                      setShowNewJob(false);
                    }} className="px-4 py-2 bg-brand-gold text-white text-[9px] font-bold uppercase tracking-wider rounded-xl hover:bg-brand-gold/80 transition-all">
                      Crear Job
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Jobs table */}
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-brand-sand/20 overflow-hidden">
              <div className="px-5 py-2.5 border-b border-brand-sand/10 grid grid-cols-8 gap-3 text-[7px] uppercase tracking-[.2em] font-bold text-brand-ink/30">
                <span>Job</span>
                <span className="col-span-2">Tipo de datos</span>
                <span>Origen → Destino</span>
                <span>Frecuencia</span>
                <span>Última ejecución</span>
                <span>Registros</span>
                <span className="text-right">Acción</span>
              </div>
              {syncJobs.map((job, i) => (
                <motion.div key={job.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}
                  className="px-5 py-3 grid grid-cols-8 gap-3 items-center border-b border-brand-sand/5 last:border-0 hover:bg-brand-bone/20 transition-colors">
                  <span className="text-[8px] font-mono text-brand-ink/30">{job.id}</span>
                  <div className="col-span-2 flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${job.status === 'success' ? 'bg-green-400' : 'bg-amber-400'}`} />
                    <span className="text-[10px] font-bold text-brand-ink">{job.type}</span>
                  </div>
                  <span className="text-[9px] text-brand-ink/50">{job.source} → {job.target}</span>
                  <span className="text-[9px] text-brand-ink/40">{job.schedule}</span>
                  <span className="text-[8px] text-brand-ink/40">{job.lastRun}</span>
                  <div className="flex items-center gap-1">
                    <span className="font-serif text-sm text-brand-ink">{job.records}</span>
                    <span className="text-[7px] text-brand-ink/25 uppercase">reg</span>
                  </div>
                  <div className="text-right">
                    <button onClick={() => runSync(job.id)} disabled={syncing !== null}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-bone text-brand-ink text-[8px] font-bold uppercase tracking-wider rounded-lg hover:bg-brand-sand/40 transition-all disabled:opacity-30">
                      {syncing === job.id || syncing === 'all' ? <Loader2 size={10} className="animate-spin" /> : <Play size={10} />}
                      {syncing === job.id ? 'Sync...' : 'Ejecutar'}
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Architecture footer */}
            <div className="bg-gradient-to-br from-brand-ink to-brand-ink/90 rounded-2xl p-5 text-brand-paper">
              <div className="flex items-center gap-2 mb-3">
                <FolderSync size={14} className="text-brand-gold" />
                <h3 className="text-sm font-serif tracking-tight">Pipeline de Sincronización</h3>
              </div>
              <div className="grid grid-cols-4 gap-4 text-[8px] text-brand-paper/60">
                {[
                  { step: '1', text: 'Pull via ODBC / API REST' },
                  { step: '2', text: 'Mapeo a catálogo NIF' },
                  { step: '3', text: 'Validación y reconciliación' },
                  { step: '4', text: 'Actualización ER / BG' },
                ].map(s => (
                  <div key={s.step} className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-brand-gold/20 text-brand-gold flex items-center justify-center text-[8px] font-bold flex-shrink-0">{s.step}</span>
                    {s.text}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
