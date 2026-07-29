import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShieldCheck, CheckCircle2, AlertCircle, Zap, Cpu, LogOut, ChevronRight, Search, FileText,
  BarChart3, CreditCard, X, History, Calculator, ArrowRightLeft, Shield, Scale,
} from 'lucide-react';
import {
  Cell, ResponsiveContainer, Tooltip as RechartsTooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { type Invoice } from '../../../types.ts';
import { CURRENCY_FORMATTER, getPriorityInfo, isInvoiceFullyValidated, getAIRecommendation } from '../../../utils/format.ts';

const FINTECH_MONTHLY_MOCK = [
  { mes: 'Nov', monto: 42000 },
  { mes: 'Dic', monto: 78500 },
  { mes: 'Ene', monto: 31200 },
  { mes: 'Feb', monto: 95400 },
  { mes: 'Mar', monto: 61000 },
  { mes: 'Abr', monto: 0 }, // current month placeholder, filled dynamically
];


export function FintechPaymentModal({ fintechTotal, totalBudget, onClose }: { fintechTotal: number; totalBudget: number; onClose: () => void }) {
  const [showPayForm, setShowPayForm] = React.useState(false);
  const [paid, setPaid] = React.useState(false);
  const [form, setForm] = React.useState({ clabe: '', banco: '', referencia: '', concepto: 'Liquidación Factoraje Royáltica' });

  const monthlyData = FINTECH_MONTHLY_MOCK.map((d, i) => i === 5 ? { ...d, monto: fintechTotal } : d);
  const maxMonth = Math.max(...monthlyData.map(d => d.monto));

  // Budget pressure: how much of remaining budget would fintech consume
  const budgetUsedByFintech = fintechTotal;
  const budgetPressure = Math.min((budgetUsedByFintech / totalBudget) * 100, 100);
  const shouldDefer = budgetPressure > 15;

  const handlePay = () => {
    if (!form.clabe || form.clabe.length !== 18 || !form.banco) return;
    setPaid(true);
    setTimeout(onClose, 2200);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-brand-ink/80 backdrop-blur-md"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0, y: 24 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.92, opacity: 0, y: 24 }}
        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
        className="w-full max-w-2xl bg-brand-paper rounded-[2.5rem] overflow-hidden shadow-2xl relative"
        onClick={e => e.stopPropagation()}
      >
        {/* Gold top bar */}
        <div className="absolute top-0 left-0 w-full h-1.5 bg-brand-gold" />

        <div className="p-10 space-y-8">
          {/* Header */}
          <div className="flex justify-between items-start">
            <div>
              <span className="label-caps !text-brand-gold !text-[9px]">Factoraje · Saldo Pendiente</span>
              <h2 className="text-3xl font-serif text-brand-ink mt-1">Pago a Fintech</h2>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-brand-bone rounded-full transition-colors opacity-30 hover:opacity-100">
              <LogOut size={20} className="rotate-90" />
            </button>
          </div>

          {/* Amount + Pay button row */}
          <div className="bg-brand-ink rounded-[2rem] p-8 flex items-center justify-between gap-6">
            <div>
              <p className="text-[9px] uppercase tracking-widest text-brand-paper/40 mb-1">Monto Total a Liquidar</p>
              <p className="text-4xl font-serif text-brand-gold">{CURRENCY_FORMATTER.format(fintechTotal)}</p>
              <p className="text-[9px] text-brand-paper/40 mt-1 uppercase tracking-wider">Vence en 14 días · Factoraje Pool</p>
            </div>
            {!paid ? (
              <button
                onClick={() => setShowPayForm(v => !v)}
                className="flex-shrink-0 bg-brand-gold text-brand-ink px-7 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-gold/90 transition-all shadow-md"
              >
                Proceder al Pago
              </button>
            ) : (
              <div className="flex items-center gap-2 text-green-400">
                <CheckCircle2 size={22} />
                <span className="text-[11px] font-bold uppercase tracking-wider">Pago enviado</span>
              </div>
            )}
          </div>

          {/* Payment Form (collapsed by default) */}
          <AnimatePresence>
            {showPayForm && !paid && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden"
              >
                <div className="bg-brand-bone rounded-[2rem] p-8 space-y-5 border border-brand-sand/60">
                  <p className="label-caps !text-brand-ink/40 !text-[9px]">Datos de Transferencia SPEI</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label className="text-[9px] uppercase tracking-widest text-brand-ink/40 font-bold block mb-1">CLABE Interbancaria (18 dígitos)</label>
                      <input
                        type="text"
                        maxLength={18}
                        value={form.clabe}
                        onChange={e => setForm(f => ({ ...f, clabe: e.target.value.replace(/\D/g,'') }))}
                        placeholder="000000000000000000"
                        className="w-full bg-white border border-brand-sand/60 rounded-xl px-4 py-3 text-sm font-mono text-brand-ink placeholder:text-brand-ink/20 focus:outline-none focus:border-brand-gold transition-colors"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] uppercase tracking-widest text-brand-ink/40 font-bold block mb-1">Banco Destinatario</label>
                      <input
                        type="text"
                        value={form.banco}
                        onChange={e => setForm(f => ({ ...f, banco: e.target.value }))}
                        placeholder="Ej. BBVA, Banamex…"
                        className="w-full bg-white border border-brand-sand/60 rounded-xl px-4 py-3 text-sm text-brand-ink placeholder:text-brand-ink/20 focus:outline-none focus:border-brand-gold transition-colors"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] uppercase tracking-widest text-brand-ink/40 font-bold block mb-1">Referencia</label>
                      <input
                        type="text"
                        value={form.referencia}
                        onChange={e => setForm(f => ({ ...f, referencia: e.target.value }))}
                        placeholder="Núm. de referencia"
                        className="w-full bg-white border border-brand-sand/60 rounded-xl px-4 py-3 text-sm text-brand-ink placeholder:text-brand-ink/20 focus:outline-none focus:border-brand-gold transition-colors"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="text-[9px] uppercase tracking-widest text-brand-ink/40 font-bold block mb-1">Concepto</label>
                      <input
                        type="text"
                        value={form.concepto}
                        onChange={e => setForm(f => ({ ...f, concepto: e.target.value }))}
                        className="w-full bg-white border border-brand-sand/60 rounded-xl px-4 py-3 text-sm text-brand-ink focus:outline-none focus:border-brand-gold transition-colors"
                      />
                    </div>
                  </div>
                  <button
                    onClick={handlePay}
                    disabled={form.clabe.length !== 18 || !form.banco}
                    className="w-full bg-brand-ink text-brand-paper py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-ink/90 transition-all disabled:opacity-30 disabled:cursor-not-allowed mt-2"
                  >
                    Confirmar y Enviar Pago · {CURRENCY_FORMATTER.format(fintechTotal)}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Monthly usage chart */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-base font-serif text-brand-ink">Uso Fintech — Últimos 6 Meses</h3>
                <p className="text-[9px] uppercase tracking-widest text-brand-ink/30">Montos financiados vía factoraje</p>
              </div>
              <Zap size={16} className="text-brand-gold opacity-60" />
            </div>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData} barSize={28} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E6D5B8" vertical={false} />
                  <XAxis dataKey="mes" tick={{ fontSize: 10, fill: '#1A1A1A', opacity: 0.4, fontFamily: 'Inter' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: '#1A1A1A', opacity: 0.3, fontFamily: 'Inter' }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                  <RechartsTooltip
                    formatter={(v: number) => [CURRENCY_FORMATTER.format(v), 'Monto Fintech']}
                    contentStyle={{ borderRadius: '12px', border: '1px solid #E6D5B8', fontSize: '11px', fontFamily: 'Inter' }}
                  />
                  <Bar dataKey="monto" radius={[6, 6, 0, 0]}>
                    {monthlyData.map((_, i) => (
                      <Cell key={i} fill={i === 5 ? '#D4AF37' : '#1A1A1A'} fillOpacity={i === 5 ? 1 : 0.18} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Budget pressure bar */}
          <div className={`rounded-[1.5rem] p-6 border ${shouldDefer ? 'bg-orange-50/60 border-orange-200' : 'bg-green-50/60 border-green-200'}`}>
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2">
                {shouldDefer
                  ? <AlertCircle size={15} className="text-orange-500" />
                  : <CheckCircle2 size={15} className="text-green-600" />}
                <span className="text-[9px] uppercase tracking-widest font-bold text-brand-ink/60">Presión Presupuestaria · Fintech</span>
              </div>
              <span className={`text-[11px] font-bold ${shouldDefer ? 'text-orange-600' : 'text-green-700'}`}>
                {budgetPressure.toFixed(1)}% del presupuesto total
              </span>
            </div>
            <div className="w-full bg-brand-sand/40 rounded-full h-2.5 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${budgetPressure}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className={`h-full rounded-full ${shouldDefer ? 'bg-orange-400' : 'bg-green-500'}`}
              />
            </div>
            <p className={`text-[10px] mt-3 leading-relaxed ${shouldDefer ? 'text-orange-700' : 'text-green-700'}`}>
              {shouldDefer
                ? `El factoraje representa el ${budgetPressure.toFixed(1)}% de tu presupuesto anual. Considera diferir pagos no urgentes para mantener liquidez operativa.`
                : `El uso actual de factoraje está dentro de parámetros saludables (${budgetPressure.toFixed(1)}%). Puedes proceder al pago sin comprometer el presupuesto.`}
            </p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export function FinancingView({ invoices, routePayment, totalBudget }: { invoices: Invoice[], routePayment: (id: string, route: 'cash' | 'fintech') => void, totalBudget: number }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('all');
  // ─── New: Factoraje Simulator ───
  const [showSimulator, setShowSimulator] = useState(false);
  const [simTasa, setSimTasa] = useState(3.5);
  const [simDays, setSimDays] = useState(30);
  const [simAmount, setSimAmount] = useState(500000);
  // ─── New: Route Comparator ───
  const [showComparator, setShowComparator] = useState(false);
  const [comparatorAmount, setComparatorAmount] = useState(300000);
  // ─── New: Gerencial Approval Tracking ───
  const [pendingApprovals, setPendingApprovals] = useState<{invoiceId: string; amount: number; status: 'pending' | 'approved' | 'rejected'; date: string}[]>([]);
  // ─── New: Factoraje Request Status ───
  const [factorajeRequests, setFactorajeRequests] = useState<{id: string; invoiceId: string; provider: string; amount: number; status: 'enviada' | 'en_revision' | 'aprobada' | 'fondos_recibidos'; date: string}[]>([
    { id: 'FR-001', invoiceId: 'FAC-2024-0891', provider: 'Logística Global SA', amount: 245000, status: 'fondos_recibidos', date: '2024-03-15' },
    { id: 'FR-002', invoiceId: 'FAC-2024-0934', provider: 'TechParts MX', amount: 180000, status: 'aprobada', date: '2024-03-22' },
    { id: 'FR-003', invoiceId: 'FAC-2024-1002', provider: 'Industrias del Norte', amount: 520000, status: 'en_revision', date: '2024-04-01' },
  ]);
  // ─── New: View Mode ───
  const [viewMode, setViewMode] = useState<'routing' | 'simulator' | 'history'>('routing');
  const [showSolicitudes, setShowSolicitudes] = useState(false);

  // ─── Fintech Usage History (mock data) ───
  const fintechHistory = [
    { mes: 'Nov', operaciones: 3, monto: 420000 },
    { mes: 'Dic', operaciones: 5, monto: 680000 },
    { mes: 'Ene', operaciones: 2, monto: 310000 },
    { mes: 'Feb', operaciones: 7, monto: 890000 },
    { mes: 'Mar', operaciones: 4, monto: 560000 },
    { mes: 'Abr', operaciones: 6, monto: 745000 },
  ];

  const GERENCIAL_THRESHOLD = 500000; // Montos > $500k requieren aprobación gerencial

  const eligibleInvoices = invoices.filter(inv => {
    const isNotPaid = inv.status !== 'paid' && inv.status !== 'rejected';
    const matchesSearch = inv.id.toLowerCase().includes(searchTerm.toLowerCase()) || inv.provider.toLowerCase().includes(searchTerm.toLowerCase());
    const priority = getPriorityInfo(inv.date);
    const matchesPriority = priorityFilter === 'all' || priority.label === priorityFilter;
    return isInvoiceFullyValidated(inv) && isNotPaid && matchesSearch && matchesPriority;
  });

  // Factoraje cost calculation
  const calcFactorajeCost = (amount: number, tasa: number, days: number) => {
    const dailyRate = tasa / 100 / 360;
    const cost = amount * dailyRate * days;
    const netAmount = amount - cost;
    return { cost, netAmount, effectiveRate: (cost / amount) * 100 };
  };

  const simResult = calcFactorajeCost(simAmount, simTasa, simDays);

  // Route payment with gerencial check
  const handleRoutePayment = (id: string, route: 'cash' | 'fintech') => {
    const inv = invoices.find(i => i.id === id);
    if (inv && route === 'fintech' && inv.amount > GERENCIAL_THRESHOLD) {
      setPendingApprovals(prev => [...prev, { invoiceId: id, amount: inv.amount, status: 'pending', date: new Date().toISOString() }]);
      // Add to factoraje requests
      setFactorajeRequests(prev => [...prev, { id: `FR-${String(prev.length + 4).padStart(3, '0')}`, invoiceId: id, provider: inv.provider, amount: inv.amount, status: 'enviada', date: new Date().toISOString().split('T')[0] }]);
      return;
    }
    if (route === 'fintech') {
      setFactorajeRequests(prev => [...prev, { id: `FR-${String(prev.length + 4).padStart(3, '0')}`, invoiceId: id, provider: inv?.provider || '', amount: inv?.amount || 0, status: 'aprobada', date: new Date().toISOString().split('T')[0] }]);
    }
    routePayment(id, route);
  };

  const FACTORAJE_STATUS_CONFIG: Record<string, { label: string; badge: string; icon: string }> = {
    'enviada': { label: 'Enviada', badge: 'bg-blue-100 text-blue-700 border-blue-200', icon: '📤' },
    'en_revision': { label: 'En Revisión', badge: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: '🔍' },
    'aprobada': { label: 'Aprobada', badge: 'bg-green-100 text-green-700 border-green-200', icon: '✅' },
    'fondos_recibidos': { label: 'Fondos Recibidos', badge: 'bg-teal-100 text-teal-700 border-teal-200', icon: '💰' },
  };

  return (
    <div className="flex flex-col pb-12">
      {/* Header with view mode tabs */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="p-2.5 bg-brand-gold/10 rounded-xl shadow-sm">
            <Zap size={20} className="text-brand-gold" />
          </div>
          <h2 className="text-2xl font-serif text-brand-ink">Factoraje Estratégico</h2>
        </div>

        <div className="flex gap-2 p-1 bg-brand-bone border border-brand-sand/30 rounded-2xl">
          {([
            { id: 'routing', label: 'Routing', icon: <ArrowRightLeft size={12} /> },
            { id: 'simulator', label: 'Simulador', icon: <Calculator size={12} /> },
            { id: 'history', label: 'Historial', icon: <History size={12} /> },
          ] as const).map(tab => (
            <button key={tab.id} onClick={() => setViewMode(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${
                viewMode === tab.id ? 'bg-brand-ink text-brand-bone shadow-lg' : 'text-brand-ink/40 hover:text-brand-ink'
              }`}
            >{tab.icon}{tab.label}</button>
          ))}
        </div>
      </div>

      {/* ═══ VIEW: Routing (original + enhancements) ═══ */}
      {viewMode === 'routing' && (
        <>
          {/* Search and Filters */}
          <div className="flex flex-wrap gap-2 mb-4">
            <div className="relative flex-1 md:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 opacity-30 text-brand-ink" size={14} />
              <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Buscar por ID o Proveedor..."
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-brand-sand/50 rounded-xl text-[11px] focus:outline-none focus:border-brand-gold shadow-sm" />
            </div>
            <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}
              className="px-4 py-2.5 bg-white border border-brand-sand/50 rounded-xl text-[10px] uppercase font-bold tracking-wider shadow-sm cursor-pointer outline-none focus:border-brand-gold">
              <option value="all">Prioridad: Todas</option>
              <option value="Baja">Baja</option>
              <option value="Media">Media</option>
              <option value="Media Alta">Media Alta</option>
              <option value="Urgente">Urgente</option>
            </select>
            <button onClick={() => setShowComparator(!showComparator)}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-brand-ink text-brand-bone rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-brand-ink/90 transition-all">
              <Scale size={14} /> Comparar Rutas
            </button>
          </div>

          {/* ─── Route Comparator Panel ─── */}
          <AnimatePresence>
            {showComparator && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden mb-4">
                <div className="editorial-card !p-6 space-y-4 border-brand-gold/30">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-brand-ink flex items-center gap-2"><Scale size={16} className="text-brand-gold" /> Comparador de Rutas de Pago</h3>
                    <button onClick={() => setShowComparator(false)} className="p-1 hover:bg-brand-bone rounded-lg"><X size={14} /></button>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] uppercase font-bold tracking-widest text-brand-ink/40">Monto:</span>
                    <input type="number" value={comparatorAmount} onChange={e => setComparatorAmount(Number(e.target.value))}
                      className="px-3 py-2 border border-brand-sand/50 rounded-xl text-sm font-serif w-48 focus:outline-none focus:border-brand-gold" />
                  </div>
                  <div className="overflow-x-auto rounded-xl border border-brand-sand/20">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-brand-bone/50">
                        <tr>
                          {['Ruta', 'Costo', 'Tiempo de Liquidación', 'Monto Neto', 'Requiere Aprobación'].map(h => (
                            <th key={h} className="px-4 py-3 text-[9px] uppercase tracking-widest font-bold text-brand-ink/40">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-brand-sand/10">
                        {(() => {
                          const factCost = calcFactorajeCost(comparatorAmount, 3.5, 30);
                          return [
                            { route: 'Caja Propia', cost: '$0', time: '1-2 días hábiles', net: CURRENCY_FORMATTER.format(comparatorAmount), approval: comparatorAmount > GERENCIAL_THRESHOLD ? 'Sí (Gerencial)' : 'No', highlight: comparatorAmount <= 200000 },
                            { route: 'Fintech (Factoraje)', cost: CURRENCY_FORMATTER.format(factCost.cost), time: '24-48 horas', net: CURRENCY_FORMATTER.format(factCost.netAmount), approval: comparatorAmount > GERENCIAL_THRESHOLD ? 'Sí (Gerencial)' : 'No', highlight: comparatorAmount > 200000 && comparatorAmount <= 500000 },
                            { route: 'Financiamiento Externo', cost: CURRENCY_FORMATTER.format(comparatorAmount * 0.06), time: '5-10 días hábiles', net: CURRENCY_FORMATTER.format(comparatorAmount * 0.94), approval: 'Sí (CEO + Gerencial)', highlight: comparatorAmount > 500000 },
                          ].map(r => (
                            <tr key={r.route} className={`transition-colors ${r.highlight ? 'bg-brand-gold/5' : 'hover:bg-white'}`}>
                              <td className="px-4 py-3 font-bold text-brand-ink flex items-center gap-2">
                                {r.highlight && <span className="w-2 h-2 bg-brand-gold rounded-full" />}
                                {r.route}
                              </td>
                              <td className="px-4 py-3 font-serif">{r.cost}</td>
                              <td className="px-4 py-3">{r.time}</td>
                              <td className="px-4 py-3 font-serif font-bold">{r.net}</td>
                              <td className="px-4 py-3">
                                <span className={`px-2 py-1 rounded-full text-[8px] font-bold ${r.approval === 'No' ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700'}`}>{r.approval}</span>
                              </td>
                            </tr>
                          ));
                        })()}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-[9px] text-brand-ink/30 font-sans">* La ruta recomendada se resalta con el indicador dorado. Montos &gt; {CURRENCY_FORMATTER.format(GERENCIAL_THRESHOLD)} requieren aprobación gerencial.</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ─── Pending Gerencial Approvals Banner ─── */}
          {pendingApprovals.filter(a => a.status === 'pending').length > 0 && (
            <div className="mb-4 p-4 bg-orange-50 border border-orange-200 rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Shield size={18} className="text-orange-600" />
                <div>
                  <p className="text-sm font-bold text-orange-800">{pendingApprovals.filter(a => a.status === 'pending').length} factura(s) pendientes de aprobación gerencial</p>
                  <p className="text-[10px] text-orange-600">Montos superiores a {CURRENCY_FORMATTER.format(GERENCIAL_THRESHOLD)} requieren autorización</p>
                </div>
              </div>
              <div className="flex gap-2">
                {pendingApprovals.filter(a => a.status === 'pending').map(a => (
                  <div key={a.invoiceId} className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-orange-700">{a.invoiceId} ({CURRENCY_FORMATTER.format(a.amount)})</span>
                    <button onClick={() => {
                      setPendingApprovals(prev => prev.map(p => p.invoiceId === a.invoiceId ? { ...p, status: 'approved' } : p));
                      setFactorajeRequests(prev => prev.map(r => r.invoiceId === a.invoiceId ? { ...r, status: 'en_revision' } : r));
                      routePayment(a.invoiceId, 'fintech');
                    }} className="px-3 py-1 bg-green-600 text-white rounded-lg text-[9px] font-bold uppercase hover:bg-green-700 transition-all">Aprobar</button>
                    <button onClick={() => setPendingApprovals(prev => prev.map(p => p.invoiceId === a.invoiceId ? { ...p, status: 'rejected' } : p))}
                      className="px-3 py-1 bg-red-100 text-red-700 rounded-lg text-[9px] font-bold uppercase hover:bg-red-200 transition-all">Rechazar</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Invoice Cards Grid */}
          <div className="border border-brand-sand/40 rounded-[2.5rem] bg-brand-bone/10 flex flex-col shadow-inner backdrop-blur-sm mb-6">
            {eligibleInvoices.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center p-12 opacity-30">
                <ShieldCheck size={48} className="mb-4 opacity-10" />
                <p className="font-serif text-2xl text-brand-ink">Bandeja Vacía</p>
                <p className="text-[10px] uppercase font-bold tracking-[0.2em] mt-2">Sólo las facturas auditadas al 100% aparecen aquí.</p>
              </div>
            ) : (
              <div className="p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-2">
                  {eligibleInvoices.map(inv => {
                    const rec = getAIRecommendation(inv, totalBudget);
                    const priorityInfo = getPriorityInfo(inv.date);
                    const needsGerencial = inv.amount > GERENCIAL_THRESHOLD;

                    return (
                      <motion.div key={inv.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                        className="editorial-card !p-0 overflow-hidden flex flex-col group hover:shadow-xl transition-all duration-500 border-brand-sand/30 bg-white/95">
                        <div className="p-6 space-y-4">
                          <div className="flex justify-between items-start">
                            <div className="space-y-1 flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                {(() => {
                                  const s = inv.signatures || 0;
                                  const pct = s >= 2 ? 100 : s === 1 ? 90 : 80;
                                  return <span className={`px-1.5 py-0.5 text-[7px] font-black uppercase tracking-widest rounded border ${pct === 100 ? 'bg-green-50 text-green-600 border-green-100' : 'bg-yellow-50 text-yellow-600 border-yellow-100'}`}>{pct}% Auditada</span>;
                                })()}
                                <div className={`w-1.5 h-1.5 rounded-full ${priorityInfo.color}`} />
                                <span className={`text-[8px] font-bold uppercase tracking-widest ${priorityInfo.text}`}>{priorityInfo.label}</span>
                                {needsGerencial && <span className="px-1.5 py-0.5 bg-orange-50 text-orange-600 text-[7px] font-black uppercase tracking-widest rounded border border-orange-100">Req. Gerencial</span>}
                              </div>
                              <h3 className="text-xl font-serif text-brand-ink leading-tight">{inv.id}</h3>
                              <p className="text-[9px] text-brand-ink/40 font-bold uppercase tracking-widest truncate max-w-[140px]">{inv.provider}</p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="text-xl font-bold text-brand-ink tracking-tighter">{CURRENCY_FORMATTER.format(inv.amount)}</p>
                              <p className="text-[8px] opacity-30 font-bold uppercase mt-0.5">{inv.date}</p>
                            </div>
                          </div>

                          <div className={`p-4 rounded-2xl border flex items-start gap-4 transition-all ${rec.strategy === 'fintech' ? 'bg-brand-ink text-brand-paper border-brand-ink shadow-md translate-y-[-2px]' : 'bg-brand-gold/5 border-brand-gold/20'}`}>
                            <div className={`mt-0.5 p-2 rounded-lg flex-shrink-0 ${rec.strategy === 'fintech' ? 'bg-brand-gold text-brand-ink' : 'bg-brand-ink text-brand-paper'}`}>
                              <Cpu size={14} />
                            </div>
                            <div className="min-h-[44px] flex flex-col justify-center">
                              <p className="text-[8px] uppercase font-black tracking-widest mb-1.5 leading-none">{rec.label}</p>
                              <p className="text-[11px] font-serif leading-relaxed opacity-80">{inv.aiRecommendation || rec.reason}</p>
                            </div>
                          </div>
                        </div>

                        <div className="bg-brand-bone/30 border-t border-brand-sand/10 p-3 flex gap-2">
                          <button onClick={() => handleRoutePayment(inv.id, 'cash')}
                            className={`flex-1 py-3.5 rounded-xl text-[9px] uppercase font-black tracking-widest transition-all ${rec.strategy === 'cash' ? 'bg-brand-gold text-brand-ink shadow-sm' : 'bg-white border border-brand-sand/40 text-brand-ink/30 hover:text-brand-ink'}`}>
                            Caja Propia
                          </button>
                          <button onClick={() => handleRoutePayment(inv.id, 'fintech')}
                            className={`flex-1 py-3.5 rounded-xl text-[9px] uppercase font-black tracking-widest transition-all ${rec.strategy === 'fintech' ? 'bg-brand-gold text-brand-ink shadow-sm' : 'bg-brand-ink text-brand-paper hover:bg-brand-ink/90'}`}>
                            {needsGerencial ? '🔒 Factoraje (Gerencial)' : 'Factoraje'}
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Factoraje Request Status - Toggle Button */}
          {factorajeRequests.length > 0 && !showSolicitudes && (
            <div className="mb-6">
              <button onClick={() => setShowSolicitudes(true)}
                className="flex items-center gap-3 px-6 py-4 bg-white border border-brand-sand/40 rounded-2xl hover:border-brand-gold hover:shadow-lg transition-all w-full group">
                <div className="p-2 bg-brand-gold/10 rounded-xl group-hover:bg-brand-gold/20 transition-all">
                  <CreditCard size={16} className="text-brand-gold" />
                </div>
                <div className="text-left flex-1">
                  <p className="text-sm font-bold text-brand-ink">Estado de Solicitudes de Factoraje</p>
                  <p className="text-[9px] text-brand-ink/40 uppercase tracking-wider">{factorajeRequests.length} solicitudes activas</p>
                </div>
                <ChevronRight size={16} className="text-brand-ink/20 group-hover:text-brand-gold transition-all" />
              </button>
            </div>
          )}

          {/* Factoraje Request Status - Full Panel */}
          <AnimatePresence>
            {showSolicitudes && factorajeRequests.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="fixed inset-0 z-50 flex items-center justify-center p-8 bg-brand-ink/30 backdrop-blur-md">
                <div className="bg-brand-bone rounded-[2rem] shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col border border-brand-sand/50 overflow-hidden">
                  <div className="px-8 py-6 bg-white border-b border-brand-sand/20 flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-brand-gold/10 rounded-xl">
                        <CreditCard size={18} className="text-brand-gold" />
                      </div>
                      <div>
                        <p className="text-lg font-bold font-serif text-brand-ink">Estado de Solicitudes de Factoraje</p>
                        <p className="text-[9px] text-brand-ink/40 uppercase tracking-wider">{factorajeRequests.length} solicitudes registradas</p>
                      </div>
                    </div>
                    <button onClick={() => setShowSolicitudes(false)} className="p-2 hover:bg-brand-bone rounded-xl transition-all">
                      <X size={18} className="text-brand-ink/40" />
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-brand-bone/50 sticky top-0 backdrop-blur-md">
                        <tr>
                          {['ID', 'Factura', 'Proveedor', 'Monto', 'Estado', 'Fecha'].map(h => (
                            <th key={h} className="px-6 py-4 text-[9px] uppercase tracking-widest font-bold text-brand-ink/40">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-brand-sand/10">
                        {factorajeRequests.map(req => {
                          const st = FACTORAJE_STATUS_CONFIG[req.status];
                          return (
                            <tr key={req.id} className="hover:bg-brand-gold/5 transition-colors">
                              <td className="px-6 py-4 font-mono font-bold text-brand-ink">{req.id}</td>
                              <td className="px-6 py-4 font-mono text-brand-ink/60">{req.invoiceId}</td>
                              <td className="px-6 py-4">{req.provider}</td>
                              <td className="px-6 py-4 font-serif font-bold">{CURRENCY_FORMATTER.format(req.amount)}</td>
                              <td className="px-6 py-4">
                                <span className={`px-2.5 py-1 rounded-full text-[8px] font-bold uppercase tracking-wider border ${st.badge}`}>
                                  {st.icon} {st.label}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-brand-ink/40">{req.date}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      {/* ═══ VIEW: Simulador de Factoraje ═══ */}
      {viewMode === 'simulator' && (
        <div className="flex-1 overflow-y-auto space-y-6 pb-8">
          {/* Simulator Card */}
          <div className="editorial-card !p-8 space-y-6 border-brand-gold/30">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2.5 bg-brand-gold/10 rounded-xl"><Calculator size={20} className="text-brand-gold" /></div>
              <div>
                <h3 className="text-xl font-serif text-brand-ink">Simulador de Costo de Factoraje</h3>
                <p className="text-[10px] text-brand-ink/40 uppercase tracking-widest">Calcula el costo real antes de solicitar</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold tracking-widest text-brand-ink/40">Monto de Factura</label>
                <input type="number" value={simAmount} onChange={e => setSimAmount(Number(e.target.value))}
                  className="w-full px-4 py-3 border border-brand-sand/50 rounded-xl text-lg font-serif focus:outline-none focus:border-brand-gold" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold tracking-widest text-brand-ink/40">Tasa Anual (%)</label>
                <input type="number" step="0.1" value={simTasa} onChange={e => setSimTasa(Number(e.target.value))}
                  className="w-full px-4 py-3 border border-brand-sand/50 rounded-xl text-lg font-serif focus:outline-none focus:border-brand-gold" />
                <input type="range" min="1" max="12" step="0.1" value={simTasa} onChange={e => setSimTasa(Number(e.target.value))}
                  className="w-full accent-brand-gold" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold tracking-widest text-brand-ink/40">Plazo (días)</label>
                <input type="number" value={simDays} onChange={e => setSimDays(Number(e.target.value))}
                  className="w-full px-4 py-3 border border-brand-sand/50 rounded-xl text-lg font-serif focus:outline-none focus:border-brand-gold" />
                <div className="flex gap-2">
                  {[15, 30, 45, 60, 90].map(d => (
                    <button key={d} onClick={() => setSimDays(d)} className={`px-3 py-1 rounded-lg text-[9px] font-bold transition-all ${simDays === d ? 'bg-brand-ink text-brand-bone' : 'bg-brand-bone text-brand-ink/40 hover:text-brand-ink'}`}>{d}d</button>
                  ))}
                </div>
              </div>
            </div>

            {/* Results */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-brand-sand/20">
              <div className="bg-red-50 rounded-2xl p-6 border border-red-100 text-center">
                <p className="text-[9px] uppercase font-bold tracking-widest text-red-400 mb-1">Costo del Factoraje</p>
                <p className="text-3xl font-serif text-red-600">{CURRENCY_FORMATTER.format(simResult.cost)}</p>
                <p className="text-[10px] text-red-400 mt-1">{simResult.effectiveRate.toFixed(3)}% efectivo</p>
              </div>
              <div className="bg-green-50 rounded-2xl p-6 border border-green-100 text-center">
                <p className="text-[9px] uppercase font-bold tracking-widest text-green-400 mb-1">Monto Neto a Recibir</p>
                <p className="text-3xl font-serif text-green-700">{CURRENCY_FORMATTER.format(simResult.netAmount)}</p>
                <p className="text-[10px] text-green-400 mt-1">Depósito en 24-48 hrs</p>
              </div>
              <div className="bg-brand-gold/10 rounded-2xl p-6 border border-brand-gold/20 text-center">
                <p className="text-[9px] uppercase font-bold tracking-widest text-brand-gold/60 mb-1">Tasa Diaria</p>
                <p className="text-3xl font-serif text-brand-ink">{(simTasa / 360).toFixed(4)}%</p>
                <p className="text-[10px] text-brand-ink/40 mt-1">{CURRENCY_FORMATTER.format(simResult.cost / simDays)} / día</p>
              </div>
            </div>

            {simAmount > GERENCIAL_THRESHOLD && (
              <div className="flex items-center gap-3 px-5 py-3 bg-orange-50 border border-orange-200 rounded-2xl">
                <Shield size={16} className="text-orange-600" />
                <p className="text-[11px] text-orange-700">Este monto supera el umbral de {CURRENCY_FORMATTER.format(GERENCIAL_THRESHOLD)} y requerirá <strong>aprobación gerencial</strong> antes de procesarse.</p>
              </div>
            )}
          </div>

          {/* Route Comparator integrated */}
          <div className="editorial-card !p-6 space-y-4">
            <h3 className="text-sm font-bold text-brand-ink flex items-center gap-2"><Scale size={16} className="text-brand-gold" /> Comparación de Rutas para {CURRENCY_FORMATTER.format(simAmount)}</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { label: 'Caja Propia', cost: 0, time: '1-2 días', color: 'bg-green-50 border-green-200', textColor: 'text-green-700' },
                { label: 'Factoraje', cost: simResult.cost, time: '24-48 hrs', color: 'bg-brand-gold/10 border-brand-gold/30', textColor: 'text-brand-ink' },
                { label: 'Financiamiento Externo', cost: simAmount * 0.06, time: '5-10 días', color: 'bg-red-50 border-red-200', textColor: 'text-red-700' },
              ].map(r => (
                <div key={r.label} className={`rounded-2xl p-5 border ${r.color} space-y-2`}>
                  <p className="text-[9px] uppercase font-bold tracking-widest text-brand-ink/40">{r.label}</p>
                  <p className={`text-2xl font-serif ${r.textColor}`}>-{CURRENCY_FORMATTER.format(r.cost)}</p>
                  <p className="text-[10px] text-brand-ink/40">Liquidación: {r.time}</p>
                  <p className="text-sm font-bold font-serif text-brand-ink">Neto: {CURRENCY_FORMATTER.format(simAmount - r.cost)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══ VIEW: Historial Fintech ═══ */}
      {viewMode === 'history' && (
        <div className="flex-1 overflow-y-auto space-y-6 pb-8">
          {/* Monthly Usage Chart */}
          <div className="editorial-card !p-6 space-y-4">
            <h3 className="text-sm font-bold text-brand-ink flex items-center gap-2"><BarChart3 size={16} className="text-brand-gold" /> Uso Mensual de Fintech</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={fintechHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e0d8" />
                  <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                  <RechartsTooltip formatter={(value: number) => CURRENCY_FORMATTER.format(value)} />
                  <Bar dataKey="monto" fill="#c9a84c" radius={[8, 8, 0, 0]} name="Monto Factoraje" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-3 gap-4 pt-2">
              <div className="text-center">
                <p className="text-2xl font-serif text-brand-ink">{fintechHistory.reduce((s, m) => s + m.operaciones, 0)}</p>
                <p className="text-[9px] uppercase tracking-widest text-brand-ink/40 font-bold">Operaciones Totales</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-serif text-brand-ink">{CURRENCY_FORMATTER.format(fintechHistory.reduce((s, m) => s + m.monto, 0))}</p>
                <p className="text-[9px] uppercase tracking-widest text-brand-ink/40 font-bold">Monto Total</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-serif text-brand-ink">{CURRENCY_FORMATTER.format(Math.round(fintechHistory.reduce((s, m) => s + m.monto, 0) / fintechHistory.length))}</p>
                <p className="text-[9px] uppercase tracking-widest text-brand-ink/40 font-bold">Promedio Mensual</p>
              </div>
            </div>
          </div>

          {/* Operations per month detail */}
          <div className="editorial-card !p-6 space-y-4">
            <h3 className="text-sm font-bold text-brand-ink flex items-center gap-2"><History size={16} className="text-brand-gold" /> Detalle por Mes</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {fintechHistory.map(m => (
                <div key={m.mes} className="bg-white rounded-2xl p-4 border border-brand-sand/30 space-y-2 hover:shadow-md transition-all">
                  <p className="text-[10px] uppercase font-bold tracking-widest text-brand-ink/40">{m.mes}</p>
                  <p className="text-xl font-serif text-brand-ink">{CURRENCY_FORMATTER.format(m.monto)}</p>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-brand-gold/10 text-brand-gold text-[9px] font-bold rounded-full">{m.operaciones} ops</span>
                    <span className="text-[9px] text-brand-ink/30">prom. {CURRENCY_FORMATTER.format(Math.round(m.monto / m.operaciones))}/op</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Factoraje Requests History */}
          <div className="editorial-card !p-0 overflow-hidden border-brand-sand/40">
            <div className="px-6 py-4 bg-white border-b border-brand-sand/20">
              <p className="text-sm font-bold text-brand-ink flex items-center gap-2"><FileText size={14} className="text-brand-gold" /> Historial de Solicitudes</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-brand-bone/50">
                  <tr>
                    {['ID', 'Factura', 'Proveedor', 'Monto', 'Estado', 'Fecha'].map(h => (
                      <th key={h} className="px-4 py-3 text-[9px] uppercase tracking-widest font-bold text-brand-ink/40">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-sand/10">
                  {factorajeRequests.map(req => {
                    const st = FACTORAJE_STATUS_CONFIG[req.status];
                    return (
                      <tr key={req.id} className="hover:bg-brand-gold/5 transition-colors">
                        <td className="px-4 py-3 font-mono font-bold">{req.id}</td>
                        <td className="px-4 py-3 font-mono text-brand-ink/60">{req.invoiceId}</td>
                        <td className="px-4 py-3">{req.provider}</td>
                        <td className="px-4 py-3 font-serif font-bold">{CURRENCY_FORMATTER.format(req.amount)}</td>
                        <td className="px-4 py-3"><span className={`px-2.5 py-1 rounded-full text-[8px] font-bold uppercase tracking-wider border ${st.badge}`}>{st.icon} {st.label}</span></td>
                        <td className="px-4 py-3 text-brand-ink/40">{req.date}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
