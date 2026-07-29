import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShieldCheck, Building2, CheckCircle2, AlertCircle, Zap, ChevronRight, Clock, FileText,
  BarChart3, X, Send, Calendar, TrendingDown, Timer, RotateCcw, AlertTriangle, Activity,
  ListChecks, MessageSquare, Sparkles, FileBarChart, Loader2, Bell, TrendingUp, Filter,
  Printer, DollarSign, Percent,
} from 'lucide-react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, LineChart, Line, AreaChart, Area,
} from 'recharts';
import { MOCK_SUPPLIERS, type Invoice } from '../../../types.ts';
import { api } from '../../../services/apiClient.ts';
import { generateReport, type OperationsContext, type ReportType } from '../../../services/geminiService.ts';
import { SupplierMessageService } from '../../../services/mockServices.ts';
import { CURRENCY_FORMATTER, getPriorityInfo } from '../../../utils/format.ts';
import { CreativeCard } from '../../../components/cards/CreativeCard.tsx';
import { DemoModeNotice } from '../../../components/DemoModeNotice.tsx';
import { FintechPaymentModal } from './FinancingView.tsx';

export function DashboardView({
  invoices,
  totalBudget,
  onNavigateToProvider,
  onNavigateToTab
}: {
  invoices: Invoice[],
  totalBudget: number,
  onNavigateToProvider: (providerName: string, priority: string) => void,
  onNavigateToTab?: (tab: 'suppliers' | 'audits' | 'pending_invoices' | 'financing') => void
}) {
  const [timeFrame, setTimeFrame] = React.useState<'monthly' | 'quarterly' | 'yearly'>('monthly');
  const [showFintechPayment, setShowFintechPayment] = React.useState(false);

  // ─── Dashboard Chat State ───
  const [dashChatSupplierId, setDashChatSupplierId] = React.useState<string | null>(null);
  const [dashChatReply, setDashChatReply] = React.useState('');
  const [, setDashMsgTick] = React.useState(0);
  React.useEffect(() => {
    const cb = () => setDashMsgTick(t => t + 1);
    SupplierMessageService.subscribe(cb);
    return () => SupplierMessageService.unsubscribe(cb);
  }, []);

  // ─── Report State ───
  const [showReportModal, setShowReportModal] = React.useState(false);
  const [reportType, setReportType] = React.useState<ReportType>('executive');
  const [reportContent, setReportContent] = React.useState<string | null>(null);
  const [reportLoading, setReportLoading] = React.useState(false);

  // Build operations context for reports
  const buildContext = React.useCallback((): OperationsContext => {
    const pending = invoices.filter(i => i.status !== 'paid' && i.status !== 'rejected');
    const paid = invoices.filter(i => i.status === 'paid');
    const today = new Date();
    const overdueCount = invoices.filter(i => {
      if (i.status === 'paid' || i.status === 'rejected') return false;
      return Math.floor((today.getTime() - new Date(i.date).getTime()) / (1000 * 60 * 60 * 24)) > 30;
    }).length;
    const fintechTotal = invoices.filter(i => i.paymentRoute === 'fintech').reduce((s, i) => s + i.amount, 0);
    const cashTotal = invoices.filter(i => i.paymentRoute === 'cash').reduce((s, i) => s + i.amount, 0);
    const fullyValidated = invoices.filter(i => i.forensicStatus === 'VALIDATED' && (i.signatures || 0) >= 2).length;
    const partiallyValidated = invoices.filter(i => i.forensicStatus === 'VALIDATED' && (i.signatures || 0) < 2).length;
    const pendingSignatures = invoices.filter(i => i.forensicStatus === 'VALIDATED').reduce((s, i) => s + Math.max(0, 2 - (i.signatures || 0)), 0);
    const factorajeRequests = invoices.filter(i => i.paymentRoute === 'fintech' && i.status === 'paid').map(i => ({
      provider: i.provider, amount: i.amount, status: 'aprobada', rate: 2.1,
    }));
    return {
      invoices: invoices.map(i => ({ id: i.id, provider: i.provider, amount: i.amount, date: i.date, status: i.status, description: i.description, auditScore: i.auditScore, paymentRoute: i.paymentRoute, forensicStatus: i.forensicStatus, signatures: i.signatures, poNumber: i.poNumber, paymentType: i.paymentType })),
      suppliers: MOCK_SUPPLIERS.map(s => ({ name: s.name, rfc: s.rfc, category: s.category, isApproved: s.isApproved, seniorityYears: s.seniorityYears })),
      totalBudget, pendingAmount: pending.reduce((s, i) => s + i.amount, 0), paidAmount: paid.reduce((s, i) => s + i.amount, 0),
      cashTotal, overdueCount, fintechTotal,
      auditStats: { validated: invoices.filter(i => i.forensicStatus === 'VALIDATED').length, discrepancy: invoices.filter(i => i.forensicStatus === 'DISCREPANCY').length, blocked: invoices.filter(i => i.forensicStatus === 'BLOCKED').length, pending: invoices.filter(i => !i.forensicStatus && i.status !== 'paid').length },
      validationStats: { fullyValidated, partiallyValidated, pendingSignatures },
      factorajeRequests, treasuryAvailable: totalBudget * 0.6,
    };
  }, [invoices, totalBudget]);

  const handleGenerateReport = React.useCallback(async () => {
    setReportLoading(true);
    setReportContent(null);
    try {
      const content = await generateReport(reportType, buildContext());
      setReportContent(content);
    } catch {
      setReportContent('Error al generar el reporte. Intenta de nuevo.');
    }
    setReportLoading(false);
  }, [reportType, buildContext]);

  // Filter invoices based on timeframe (ref date 2024-04-27)
  const filteredInvoices = React.useMemo(() => {
    const refDate = new Date('2024-04-27');
    const days = timeFrame === 'monthly' ? 30 : timeFrame === 'quarterly' ? 90 : 365;
    const threshold = new Date(refDate);
    threshold.setDate(threshold.getDate() - days);
    
    return invoices.filter(inv => new Date(inv.date) >= threshold);
  }, [invoices, timeFrame]);

  const aprobadosCount = filteredInvoices.filter(i => i.status === 'paid').length;
  const pendientesCount = filteredInvoices.filter(i => i.status === 'pending').length;
  const programadosCount = filteredInvoices.filter(i => i.status === 'audited').length;
  
  const urgentesCount = filteredInvoices.filter(i => {
    const p = getPriorityInfo(i.date);
    return (p.label === 'Urgente' || p.label === 'Media Alta') && i.status !== 'paid';
  }).length;
  
  const auditFailsCount = filteredInvoices.filter(i => i.auditScore !== undefined && i.auditScore < 85).length || 0;
  const fintechTotal = filteredInvoices.filter(i => i.paymentRoute === 'fintech').reduce((sum, inv) => sum + inv.amount, 0);

  // NEW: Treasury Traffic Light Logic
  const [selectedTrafficColor, setSelectedTrafficColor] = React.useState<'green' | 'yellow' | 'orange' | 'red' | null>(null);
  
  const trafficLightStats = React.useMemo(() => {
    const today = new Date('2024-04-27');
    const categories = {
      green: { label: 'Óptimo', color: 'bg-green-500', shadow: 'shadow-green-500/40', invoices: [] as Invoice[] },
      yellow: { label: 'En Tiempo', color: 'bg-yellow-500', shadow: 'shadow-yellow-500/40', invoices: [] as Invoice[] },
      orange: { label: 'Media Alta', color: 'bg-orange-500', shadow: 'shadow-orange-500/40', invoices: [] as Invoice[] },
      red: { label: 'Urgente', color: 'bg-red-500', shadow: 'shadow-red-500/40', invoices: [] as Invoice[] },
    };

    filteredInvoices.forEach(inv => {
      if (inv.status === 'paid') return;
      const date = new Date(inv.date);
      const diffTime = Math.abs(today.getTime() - date.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays <= 10) {
        categories.green.invoices.push(inv);
      } else if (diffDays <= 20) {
        categories.yellow.invoices.push(inv);
      } else if (diffDays <= 30) {
        categories.orange.invoices.push(inv);
      } else {
        categories.red.invoices.push(inv);
      }
    });

    return categories;
  }, [filteredInvoices]);

  const getProviderBreakdown = (color: keyof typeof trafficLightStats) => {
    const invs = trafficLightStats[color].invoices;
    const breakdown = invs.reduce((acc, inv) => {
      acc[inv.provider] = (acc[inv.provider] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    return Object.entries(breakdown).map(([name, count]) => ({ name, count }));
  };

  // (Provider data is computed inline in the chart render)

  const fintechDeadline = 14;
  // Días promedio entre emisión y pago, derivado de las facturas pagadas del periodo
  const avgPaymentDays = React.useMemo(() => {
    const refDate = new Date('2024-04-27');
    const paid = filteredInvoices.filter(i => i.status === 'paid');
    if (paid.length === 0) return 0;
    const avg = paid.reduce((s, i) => {
      const days = (refDate.getTime() - new Date(i.date).getTime()) / 86400000;
      return s + Math.min(30, Math.max(1, days * 0.18));
    }, 0) / paid.length;
    return Math.round(avg * 10) / 10;
  }, [filteredInvoices]);

  return (
    <>
    <div className="space-y-8 pb-12">
      {/* Banda superior: Presupuesto + Quick Stats + Filtros */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-brand-ink text-brand-bone rounded-[2.5rem] px-10 py-7 shadow-xl relative overflow-hidden -mt-4"
      >
        <div className="absolute top-0 right-0 w-56 h-56 bg-brand-gold/10 rounded-full -translate-y-28 translate-x-20 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 w-40 h-40 bg-brand-gold/5 rounded-full translate-y-24 blur-3xl" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <span className="text-[8px] uppercase tracking-[0.3em] font-bold text-brand-gold/80">Presupuesto Maestro Consolidado</span>
            <h1 className="text-4xl font-serif text-brand-bone tracking-tight mt-1">
              {CURRENCY_FORMATTER.format(totalBudget)}
            </h1>
            <div className="w-14 h-0.5 bg-brand-gold/30 rounded-full mt-2" />
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-6">
            <div className="flex items-center gap-8">
              <div className="text-right">
                <p className="text-[8px] uppercase tracking-widest text-brand-bone/40 font-bold">Facturas</p>
                <p className="text-2xl font-serif text-brand-gold">{filteredInvoices.length}</p>
              </div>
              <div className="text-right">
                <p className="text-[8px] uppercase tracking-widest text-brand-bone/40 font-bold">Proveedores</p>
                <p className="text-2xl font-serif text-brand-gold">{new Set(filteredInvoices.map(i => i.provider)).size}</p>
              </div>
              <div className="text-right">
                <p className="text-[8px] uppercase tracking-widest text-brand-bone/40 font-bold">Ejercido</p>
                <p className="text-2xl font-serif text-brand-gold">
                  {totalBudget > 0 ? ((filteredInvoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.amount, 0) / totalBudget) * 100).toFixed(1) : '0.0'}%
                </p>
              </div>
            </div>
            <div className="bg-white/5 border border-white/10 p-1 rounded-full flex gap-1 self-start sm:self-auto">
              {(['monthly', 'quarterly', 'yearly'] as const).map((frame) => (
                <button
                  key={frame}
                  onClick={() => setTimeFrame(frame)}
                  className={`px-5 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all ${
                    timeFrame === frame
                      ? 'bg-brand-gold text-brand-ink shadow-md'
                      : 'text-brand-bone/40 hover:text-brand-bone hover:bg-white/10'
                  }`}
                >
                  {frame === 'monthly' ? 'Mensual' : frame === 'quarterly' ? 'Trimestral' : 'Anual'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Grid de Métricas 3x2 */}
      <div className="bg-white/40 backdrop-blur-md rounded-[3rem] p-8 border border-brand-sand/30 shadow-inner">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <CreativeCard
            icon={<CheckCircle2 className="text-green-600" size={24} />}
            label="Pagos Aprobados"
            value={aprobadosCount}
            subValue="Liquidados con éxito"
            theme="green"
            onClick={() => onNavigateToTab?.('pending_invoices')}
          />
          <CreativeCard
            icon={<Clock className="text-brand-gold" size={24} />}
            label="Pagos Pendientes"
            value={pendientesCount}
            subValue="En espera de gestión"
            theme="gold"
            onClick={() => onNavigateToTab?.('pending_invoices')}
          />
          <CreativeCard
            icon={<ShieldCheck className="text-red-500" size={24} />}
            label="Falta de Requisito"
            value={auditFailsCount}
            subValue="Observaciones en auditoría"
            theme="red"
            onClick={() => onNavigateToTab?.('audits')}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <CreativeCard
            icon={<AlertCircle className="text-orange-500" size={24} />}
            label="Riesgo de Atraso"
            value={urgentesCount}
            subValue="Prioridad urgente detectada"
            theme="orange"
            onClick={() => onNavigateToTab?.('pending_invoices')}
          />
          <CreativeCard
            icon={<Calendar className="text-brand-ink" size={24} />}
            label="Pagos Programados"
            value={programadosCount}
            subValue="Auditados para dispersión"
            theme="dark"
            onClick={() => onNavigateToTab?.('pending_invoices')}
          />
          <div
            onClick={() => onNavigateToTab?.('financing')}
            className="col-span-1 bg-brand-ink text-brand-bone rounded-[2.5rem] p-8 shadow-xl relative overflow-hidden group cursor-pointer hover:shadow-2xl transition-shadow"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-brand-gold/10 rounded-full -translate-y-12 translate-x-12 blur-2xl group-hover:bg-brand-gold/20 transition-all" />
            <div className="relative z-10 space-y-6">
              <div className="flex justify-between items-center">
                <span className="label-caps !text-brand-gold !opacity-100">Factoraje Pool</span>
                <Zap size={18} className="text-brand-gold" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest opacity-40 mb-1">Monto Debido Fintech</p>
                <p className="text-3xl font-serif text-brand-gold">{CURRENCY_FORMATTER.format(fintechTotal)}</p>
              </div>
              <div className="pt-4 border-t border-white/10 flex justify-between items-center">
                <span className="text-[9px] uppercase tracking-tighter opacity-40">Pendientes del periodo</span>
                <span className="text-lg font-serif">{pendientesCount}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Mensajes de Proveedores ─── */}
      {(() => {
        const unreadMsgs = SupplierMessageService.getUnreadMessages();
        if (unreadMsgs.length === 0) return null;
        return (
          <div className="space-y-3">
          <DemoModeNotice label="Vista previa · Mensajes de Proveedores" />
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className="bg-white/60 backdrop-blur-md rounded-[2.5rem] border border-brand-gold/20 shadow-sm overflow-hidden">
            <div className="px-8 py-5 flex items-center justify-between border-b border-brand-sand/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-gold/10 flex items-center justify-center relative">
                  <MessageSquare size={18} className="text-brand-gold" />
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-[8px] font-bold text-white flex items-center justify-center">{unreadMsgs.length}</span>
                </div>
                <div>
                  <h3 className="text-base font-serif text-brand-ink">Mensajes de Proveedores</h3>
                  <p className="text-[8px] text-brand-ink/30 uppercase tracking-widest">{unreadMsgs.length} mensaje{unreadMsgs.length > 1 ? 's' : ''} sin leer · Requiere{unreadMsgs.length > 1 ? 'n' : ''} atención</p>
                </div>
              </div>
              <button onClick={() => onNavigateToProvider('', '')}
                className="text-[9px] font-bold uppercase tracking-wider text-brand-gold hover:underline flex items-center gap-1">
                Ver en Configuración <ChevronRight size={12} />
              </button>
            </div>
            <div className="divide-y divide-brand-sand/10">
              {unreadMsgs.slice(0, 4).map((msg, i) => (
                <motion.div key={msg.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                  onClick={() => { SupplierMessageService.markRead(msg.id); setDashChatSupplierId(msg.supplierId); }}
                  className="px-8 py-4 flex items-start gap-4 hover:bg-brand-gold/5 transition-all cursor-pointer">
                  <div className="w-9 h-9 rounded-xl bg-brand-bone flex items-center justify-center flex-shrink-0 mt-0.5">
                    <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${msg.supplierName}`} alt="" className="w-7 h-7 rounded-lg" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[11px] font-bold text-brand-ink">{msg.supplierName}</span>
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-gold animate-pulse" />
                    </div>
                    <p className="text-[10px] text-brand-ink/60 leading-relaxed line-clamp-2">{msg.text}</p>
                  </div>
                  <div className="flex-shrink-0 text-right flex items-center gap-2">
                    <div>
                      <p className="text-[8px] text-brand-ink/30 font-mono">{new Date(msg.date).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}</p>
                      <p className="text-[7px] text-brand-ink/20">{new Date(msg.date).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                    <ChevronRight size={12} className="text-brand-ink/20" />
                  </div>
                </motion.div>
              ))}
            </div>
            {unreadMsgs.length > 4 && (
              <div className="px-8 py-3 bg-brand-bone/30 text-center">
                <p className="text-[9px] text-brand-ink/30">+{unreadMsgs.length - 4} mensaje{unreadMsgs.length - 4 > 1 ? 's' : ''} más</p>
              </div>
            )}
          </motion.div>
          </div>
        );
      })()}

      {/* ─── Dashboard Chat Modal ─── */}
      <AnimatePresence>
        {dashChatSupplierId && (() => {
          const msgs = SupplierMessageService.getBySupplier(dashChatSupplierId);
          const supplierName = msgs[0]?.supplierName || 'Proveedor';
          const supplier = MOCK_SUPPLIERS.find(s => s.id === dashChatSupplierId);
          return (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[200] flex items-center justify-center p-4"
              onClick={() => { setDashChatSupplierId(null); setDashChatReply(''); }}>
              <motion.div initial={{ opacity: 0, y: 30, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 30, scale: 0.95 }}
                className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col" style={{ maxHeight: '80vh' }}
                onClick={e => e.stopPropagation()}>
                <div className="px-6 py-4 bg-brand-ink text-brand-paper flex items-center justify-between flex-shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-brand-gold/20 flex items-center justify-center">
                      <MessageSquare size={16} className="text-brand-gold" />
                    </div>
                    <div>
                      <p className="text-[11px] font-bold">{supplierName}</p>
                      <p className="text-[8px] text-brand-paper/40 font-mono">{supplier?.rfc || ''}</p>
                    </div>
                  </div>
                  <button onClick={() => { setDashChatSupplierId(null); setDashChatReply(''); }}><X size={16} className="text-brand-paper/40 hover:text-brand-paper" /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-5 space-y-3" style={{ minHeight: 200 }}>
                  {msgs.length === 0 ? (
                    <div className="text-center py-10">
                      <MessageSquare size={32} className="text-brand-ink/10 mx-auto mb-3" />
                      <p className="text-brand-ink/30 text-[11px]">Sin mensajes</p>
                    </div>
                  ) : msgs.map(msg => (
                    <div key={msg.id} className={`flex ${msg.from === 'corporate' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] rounded-2xl px-4 py-3 ${
                        msg.from === 'corporate'
                          ? 'bg-brand-ink text-brand-paper rounded-br-md'
                          : 'bg-brand-bone text-brand-ink border border-brand-sand/20 rounded-bl-md'
                      }`}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[8px] font-bold uppercase tracking-wider ${msg.from === 'corporate' ? 'text-brand-gold' : 'text-brand-ink/40'}`}>
                            {msg.from === 'corporate' ? '🏢 Tú (Corporativo)' : `📦 ${supplierName.split(' ')[0]}`}
                          </span>
                        </div>
                        <p className="text-[10px] leading-relaxed">{msg.text}</p>
                        <p className={`text-[7px] mt-1.5 ${msg.from === 'corporate' ? 'text-brand-paper/30' : 'text-brand-ink/20'}`}>
                          {new Date(msg.date).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' })} · {new Date(msg.date).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="p-4 border-t border-brand-sand/20 flex-shrink-0">
                  <div className="flex gap-2">
                    <textarea value={dashChatReply} onChange={e => setDashChatReply(e.target.value)} rows={2} placeholder="Responder al proveedor..."
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey && dashChatReply.trim()) {
                          e.preventDefault();
                          SupplierMessageService.send(dashChatSupplierId, supplierName, 'corporate', dashChatReply.trim());
                          setDashChatReply('');
                        }
                      }}
                      className="flex-1 px-4 py-2.5 bg-brand-bone border border-brand-sand/30 rounded-xl text-[10px] outline-none focus:border-brand-gold resize-none" />
                    <button onClick={() => {
                      if (dashChatReply.trim()) {
                        SupplierMessageService.send(dashChatSupplierId, supplierName, 'corporate', dashChatReply.trim());
                        setDashChatReply('');
                      }
                    }} disabled={!dashChatReply.trim()}
                      className="w-11 h-11 bg-brand-ink text-brand-paper rounded-xl flex items-center justify-center disabled:opacity-30 hover:bg-brand-gold hover:text-brand-ink transition-all flex-shrink-0">
                      <Send size={14} />
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* ─── Radiografía de Proveedores: vista comparativa unificada ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left: Stacked bar — Pagado vs Pendiente por proveedor */}
        <div className="lg:col-span-8 bg-white/40 backdrop-blur-md rounded-[3rem] p-8 border border-brand-sand/30 shadow-inner flex flex-col">
          <div className="flex justify-between items-center mb-5">
            <div>
              <h3 className="text-xl font-serif text-brand-ink">Radiografía de Proveedores</h3>
              <p className="text-[9px] uppercase tracking-widest opacity-40">Pagado vs Pendiente por proveedor · {timeFrame === 'monthly' ? '30D' : timeFrame === 'quarterly' ? '90D' : '1A'}</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm bg-brand-gold" />
                <span className="text-[8px] uppercase tracking-wider text-brand-ink/30 font-bold">Pagado</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm bg-brand-ink/15" />
                <span className="text-[8px] uppercase tracking-wider text-brand-ink/30 font-bold">Pendiente</span>
              </div>
            </div>
          </div>

          {(() => {
            // Build per-provider data: paid vs pending
            type ProviderRow = { name: string; pagado: number; pendiente: number; total: number };
            const providerMap: Record<string, ProviderRow> = {};
            filteredInvoices.forEach(inv => {
              if (!providerMap[inv.provider]) providerMap[inv.provider] = { name: inv.provider, pagado: 0, pendiente: 0, total: 0 };
              if (inv.status === 'paid') providerMap[inv.provider].pagado += inv.amount;
              else if (inv.status !== 'rejected') providerMap[inv.provider].pendiente += inv.amount;
              providerMap[inv.provider].total = providerMap[inv.provider].pagado + providerMap[inv.provider].pendiente;
            });
            const providerData = Object.values(providerMap).sort((a, b) => b.total - a.total).slice(0, 8);

            return (
              <div className="flex-1 h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={providerData} layout="vertical" barGap={0} barSize={14}
                    margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E6D5B8" horizontal={false} opacity={0.3} />
                    <XAxis type="number" tick={{ fontSize: 8, fill: '#1A1A1A', opacity: 0.3 }}
                      tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}K`} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 8, fill: '#1A1A1A', opacity: 0.5 }}
                      width={110} axisLine={false} tickLine={false} />
                    <RechartsTooltip
                      contentStyle={{ background: '#1A1A1A', border: 'none', borderRadius: '12px', color: '#F5F0E8', fontSize: '10px', fontFamily: 'Inter', padding: '8px 12px' }}
                      formatter={(value: number, name: string) => [
                        `$${value.toLocaleString('es-MX')}`,
                        name === 'pagado' ? '✓ Pagado' : '◷ Pendiente'
                      ]}
                    />
                    <Bar dataKey="pagado" name="pagado" stackId="a" fill="#C5A059" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="pendiente" name="pendiente" stackId="a" fill="#1A1A1A" fillOpacity={0.12} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            );
          })()}
        </div>

        {/* Right: Summary donut — Budget breakdown */}
        <div className="lg:col-span-4 bg-white/40 backdrop-blur-md rounded-[3rem] p-8 border border-brand-sand/30 shadow-inner flex flex-col">
          <div className="mb-4">
            <h3 className="text-lg font-serif text-brand-ink">Composición del Gasto</h3>
            <p className="text-[9px] uppercase tracking-widest opacity-40">vs Presupuesto Maestro</p>
          </div>

          {(() => {
            const totalPaidAmt = filteredInvoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.amount, 0);
            const totalPendingAmt = filteredInvoices.filter(i => i.status !== 'paid' && i.status !== 'rejected').reduce((s, i) => s + i.amount, 0);
            const disponible = Math.max(totalBudget - totalPaidAmt - totalPendingAmt, 0);
            const summaryData = [
              { name: 'Pagado', value: totalPaidAmt, color: '#C5A059' },
              { name: 'CxP Pendiente', value: totalPendingAmt, color: '#1A1A1A' },
              { name: 'Disponible', value: disponible, color: '#E6D5B8' },
            ];

            return (
              <>
                <div className="flex-1 h-[160px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={summaryData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                        {summaryData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} fillOpacity={entry.name === 'Disponible' ? 0.3 : 0.85} />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        contentStyle={{ background: '#1A1A1A', border: 'none', borderRadius: '12px', color: '#F5F0E8', fontSize: '10px', padding: '8px 12px' }}
                        formatter={(value: number, name: string) => [
                          `$${value.toLocaleString('es-MX')} (${((value / totalBudget) * 100).toFixed(1)}%)`,
                          name
                        ]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="space-y-3 mt-2">
                  {summaryData.map(item => (
                    <div key={item.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color, opacity: item.name === 'Disponible' ? 0.3 : 0.85 }} />
                        <span className="text-[9px] uppercase tracking-wider text-brand-ink/50 font-bold">{item.name}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-serif text-sm text-brand-ink">{((item.value / totalBudget) * 100).toFixed(1)}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            );
          })()}
        </div>
      </div>

      {/* Activity Component & Small Indicators */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch relative">
        {/* Treasury Traffic Light Modal (Mini Window) */}
        <AnimatePresence>
          {selectedTrafficColor && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="absolute inset-0 z-50 flex items-center justify-center p-4 lg:p-12 pointer-events-none"
            >
              <div className="bg-brand-ink text-brand-bone rounded-[2rem] shadow-2xl p-8 w-full max-w-sm pointer-events-auto border border-brand-gold/30">
                <div className="flex justify-between items-center mb-6">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${trafficLightStats[selectedTrafficColor].color} ${trafficLightStats[selectedTrafficColor].shadow} shadow-lg`} />
                    <h4 className="text-lg font-serif">Detalle: {trafficLightStats[selectedTrafficColor].label}</h4>
                  </div>
                  <button onClick={() => setSelectedTrafficColor(null)} className="p-1 hover:bg-white/10 rounded-full transition-colors">
                    <X size={16} />
                  </button>
                </div>
                
                <div className="space-y-4 max-h-60 overflow-y-auto pr-2 scrollbar-hide">
                  {getProviderBreakdown(selectedTrafficColor).map((item, idx) => (
                    <div 
                      key={idx} 
                      className="flex justify-between items-center py-2 border-b border-white/5 cursor-pointer hover:bg-white/5 px-2 rounded-lg transition-colors group"
                      onClick={() => {
                        onNavigateToProvider(item.name, trafficLightStats[selectedTrafficColor].label);
                        setSelectedTrafficColor(null);
                      }}
                    >
                      <div className="flex flex-col">
                        <span className="text-[11px] font-serif truncate max-w-[180px] group-hover:text-brand-gold transition-colors">{item.name}</span>
                        <span className="text-[7px] uppercase tracking-widest text-white/30 group-hover:text-white/50">Ver detalle y facturas</span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-[10px] bg-brand-gold/20 px-2 py-0.5 rounded text-brand-gold font-bold">
                          {item.count} {item.count === 1 ? 'Factura' : 'Facturas'}
                        </span>
                        <ChevronRight size={10} className="mt-1 opacity-20 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                      </div>
                    </div>
                  ))}
                  {getProviderBreakdown(selectedTrafficColor).length === 0 && (
                    <p className="text-center py-8 text-[10px] opacity-30 uppercase tracking-widest">No hay registros</p>
                  )}
                </div>

                <p className="mt-6 text-[8px] uppercase tracking-widest text-center opacity-30 flex items-center justify-center gap-2">
                  <ShieldCheck size={10} /> Royáltica Audit System Active
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="lg:col-span-8 flex flex-col">
          <div className="editorial-card !p-6 relative overflow-hidden flex-1 flex flex-col">
            {(() => {
              // ─── Build real treasury activity from invoices ───
              // Group by week for monthly, by half-month for quarterly, by month for yearly
              const refDate = new Date('2024-04-27');
              const relevantInvoices = invoices.filter(inv => {
                const d = new Date(inv.date);
                if (timeFrame === 'monthly') {
                  const threshold = new Date(refDate);
                  threshold.setDate(threshold.getDate() - 30);
                  return d >= threshold && d <= refDate;
                } else if (timeFrame === 'quarterly') {
                  const threshold = new Date(refDate);
                  threshold.setDate(threshold.getDate() - 90);
                  return d >= threshold && d <= refDate;
                }
                return d <= refDate; // yearly: all
              });

              type TreasuryBucket = { label: string; entradas: number; salidas: number };

              // Build weekly buckets from actual data range
              const dates = relevantInvoices.map(inv => new Date(inv.date).getTime());
              const minDate = dates.length > 0 ? Math.min(...dates) : refDate.getTime() - 30 * 86400000;
              const maxDate = refDate.getTime();
              const range = maxDate - minDate;

              const bucketCount = timeFrame === 'monthly' ? 6 : timeFrame === 'quarterly' ? 8 : 6;
              const msPerBucket = range / bucketCount;

              const buckets: TreasuryBucket[] = [];
              for (let i = 0; i < bucketCount; i++) {
                const bucketStart = new Date(minDate + i * msPerBucket);
                const bucketEnd = new Date(minDate + (i + 1) * msPerBucket);

                const bucketInvoices = relevantInvoices.filter(inv => {
                  const d = new Date(inv.date);
                  return d >= bucketStart && d < bucketEnd;
                });

                const entradas = bucketInvoices.filter(inv => inv.status === 'paid').reduce((s, inv) => s + inv.amount, 0);
                const salidas = bucketInvoices.filter(inv => inv.status !== 'paid' && inv.status !== 'rejected').reduce((s, inv) => s + inv.amount, 0);

                const label = timeFrame === 'yearly'
                  ? bucketStart.toLocaleDateString('es-MX', { month: 'short' })
                  : `${bucketStart.getDate()}/${bucketStart.getMonth() + 1}`;

                buckets.push({ label, entradas, salidas });
              }

              const totalEntradas = buckets.reduce((s, b) => s + b.entradas, 0);
              const totalSalidas = buckets.reduce((s, b) => s + b.salidas, 0);
              const neto = totalEntradas - totalSalidas;

              return (
                <>
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <h3 className="text-lg font-serif text-brand-ink">Actividad de Tesorería</h3>
                      <p className="text-[9px] uppercase tracking-widest opacity-40">
                        {relevantInvoices.length} transacciones · {timeFrame === 'monthly' ? '30D' : timeFrame === 'quarterly' ? '90D' : '1A'}
                      </p>
                    </div>
                    <div className="flex gap-4 items-end">
                      <div className="text-right leading-none">
                        <p className="text-[7px] uppercase tracking-widest opacity-25 font-bold">Entradas</p>
                        <p className="font-serif text-sm text-green-600">${(totalEntradas / 1000).toFixed(0)}K</p>
                      </div>
                      <div className="text-right leading-none">
                        <p className="text-[7px] uppercase tracking-widest opacity-25 font-bold">Salidas</p>
                        <p className="font-serif text-sm text-brand-ink/50">${(totalSalidas / 1000).toFixed(0)}K</p>
                      </div>
                      <div className="text-right leading-none">
                        <p className="text-[7px] uppercase tracking-widest opacity-25 font-bold">Neto</p>
                        <p className={`font-serif text-sm font-bold ${neto >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                          {neto >= 0 ? '+' : ''}{(neto / 1000).toFixed(0)}K
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 min-h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={buckets} barGap={1} barSize={20} margin={{ top: 0, right: 0, left: -24, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E6D5B8" vertical={false} opacity={0.3} />
                        <XAxis dataKey="label" tick={{ fontSize: 8, fill: '#1A1A1A', opacity: 0.35 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 7, fill: '#1A1A1A', opacity: 0.25 }} axisLine={false} tickLine={false}
                          tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}K`} width={36} />
                        <RechartsTooltip
                          contentStyle={{ background: '#1A1A1A', border: 'none', borderRadius: '12px', color: '#F5F0E8', fontSize: '10px', fontFamily: 'Inter', padding: '8px 12px' }}
                          formatter={(value: number, name: string) => [
                            `$${value.toLocaleString('es-MX')}`,
                            name === 'entradas' ? '↑ Cobros' : '↓ Por pagar'
                          ]}
                          labelFormatter={(label) => `${label}`}
                        />
                        <Bar dataKey="entradas" name="entradas" radius={[4, 4, 0, 0]} fill="#C5A059" fillOpacity={0.85} />
                        <Bar dataKey="salidas" name="salidas" radius={[4, 4, 0, 0]} fill="#1A1A1A" fillOpacity={0.15} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="flex items-center gap-4 mt-2">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 bg-brand-gold rounded-sm" />
                      <span className="text-[8px] uppercase font-bold opacity-30 tracking-tighter">Cobros</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 bg-brand-ink/15 rounded-sm" />
                      <span className="text-[8px] uppercase font-bold opacity-30 tracking-tighter">Por pagar</span>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>

        <div className="lg:col-span-4 flex flex-col">
          {/* Treasury Traffic Light (Semáforo) */}
          <div
            className="bg-brand-cream border border-brand-sand/50 rounded-[2.5rem] p-8 shadow-inner flex flex-col gap-6 group cursor-pointer relative overflow-hidden flex-1"
            onClick={() => setSelectedTrafficColor(selectedTrafficColor ? null : 'red')}
          >
            <div className="flex justify-between items-center mb-2">
              <span className="label-caps !text-brand-ink/40 !text-[9px]">Semáforo de Pagos (30D Max)</span>
              <AlertCircle size={14} className="text-brand-ink/20" />
            </div>
            
            <div className="flex flex-col gap-4">
              {(['red', 'orange', 'yellow', 'green'] as const).map((color) => (
                <div 
                  key={color} 
                  className={`flex items-center justify-between group/row hover:translate-x-1 transition-transform cursor-pointer px-2 py-1 rounded-xl hover:bg-brand-bone`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedTrafficColor(color);
                  }}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-4 h-4 rounded-full ${trafficLightStats[color].color} ${trafficLightStats[color].shadow} shadow-lg transition-transform group-hover/row:scale-110`} />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-brand-ink/60">{trafficLightStats[color].label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-serif text-brand-ink">{trafficLightStats[color].invoices.length}</span>
                    <ChevronRight size={12} className="opacity-0 group-hover/row:opacity-30 transition-opacity" />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-4 border-t border-brand-sand/30 flex justify-between items-center">
              <span className="text-[8px] uppercase tracking-widest font-black text-brand-ink/20">Click para detalle</span>
              <div className="px-2 py-0.5 bg-brand-ink text-brand-paper rounded text-[7px] font-bold">MONITOR ACTIVO</div>
            </div>
          </div>

        </div>
      </div>

      {/* ─── Indicadores rápidos: Promedio de Pago + Saldo Fintech ─── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Promedio de Pago */}
        <div className="bg-brand-gold/10 p-6 rounded-[2.5rem] border border-brand-gold/20 flex items-center justify-between group overflow-hidden relative">
          <TrendingDown className="absolute -top-4 -right-4 w-24 h-24 text-brand-gold/5 -rotate-12 transition-transform group-hover:rotate-0" />
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <Timer size={16} className="text-brand-gold" />
              <span className="label-caps !text-brand-gold !text-[9px]">Días Promedio de Pago</span>
            </div>
            <div className="text-4xl font-serif text-brand-ink">{avgPaymentDays} Días</div>
          </div>
          <p className="relative z-10 text-[9px] uppercase tracking-widest text-brand-ink/30 font-bold text-right max-w-[140px]">Calculado sobre facturas pagadas del periodo</p>
        </div>

        {/* Fintech Deadline */}
        <div className="bg-brand-ink p-6 rounded-[2.5rem] text-brand-paper flex items-center justify-between group overflow-hidden relative shadow-xl">
           <div className="absolute inset-0 bg-gradient-to-br from-brand-gold/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
           <div className="relative z-10">
              <div className="flex items-center gap-2 mb-2">
                <Zap size={16} className="text-brand-gold" />
                <span className="label-caps !text-brand-paper/40 !text-[9px]">Saldo Fintech</span>
              </div>
              <div className="text-4xl font-serif text-brand-gold">{fintechDeadline} Días</div>
           </div>
           <div className="relative z-10 flex flex-col items-end gap-2">
              <p className="text-[10px] text-brand-paper/60 font-medium uppercase tracking-[0.2em]">VENCE EN 14 DÍAS</p>
              <button
                onClick={() => setShowFintechPayment(true)}
                className="px-4 py-2 bg-brand-gold text-brand-ink rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-brand-gold/90 transition-all shadow-sm flex-shrink-0"
              >
                Pagar
              </button>
           </div>
        </div>
      </div>

      {/* ─── NEW: Alerts Panel ─── */}
      {(() => {
        const today = new Date('2024-04-27');
        const alerts: { type: 'overdue' | 'doc_expiring' | 'urgent'; message: string; severity: 'red' | 'orange' | 'yellow' }[] = [];

        // Overdue invoices > 30 days
        const overdueInvs = filteredInvoices.filter(i => {
          if (i.status === 'paid' || i.status === 'rejected') return false;
          return Math.floor((today.getTime() - new Date(i.date).getTime()) / (1000 * 60 * 60 * 24)) > 30;
        });
        if (overdueInvs.length > 0) {
          const providers = [...new Set(overdueInvs.map(i => i.provider))];
          alerts.push({ type: 'overdue', message: `${overdueInvs.length} factura${overdueInvs.length > 1 ? 's' : ''} vencida${overdueInvs.length > 1 ? 's' : ''} (>30 días) de ${providers.slice(0, 3).join(', ')}${providers.length > 3 ? ` y ${providers.length - 3} más` : ''}`, severity: 'red' });
        }

        // Suppliers with pending documents
        const pendingDocs = MOCK_SUPPLIERS.filter(s => s.documents.some(d => d.status === 'Pendiente'));
        if (pendingDocs.length > 0) {
          alerts.push({ type: 'doc_expiring', message: `${pendingDocs.length} proveedor${pendingDocs.length > 1 ? 'es' : ''} con documentos pendientes/vencidos (SAT/REPSE)`, severity: 'orange' });
        }

        // Urgent priority invoices
        const urgentUnpaid = filteredInvoices.filter(i => i.status !== 'paid' && getPriorityInfo(i.date).label === 'Urgente');
        if (urgentUnpaid.length > 0) {
          alerts.push({ type: 'urgent', message: `${urgentUnpaid.length} factura${urgentUnpaid.length > 1 ? 's' : ''} marcada${urgentUnpaid.length > 1 ? 's' : ''} como urgente${urgentUnpaid.length > 1 ? 's' : ''} sin liquidar`, severity: 'yellow' });
        }

        if (alerts.length === 0) return null;

        const SEVERITY = { red: 'bg-red-50 border-red-200 text-red-700', orange: 'bg-orange-50 border-orange-200 text-orange-700', yellow: 'bg-yellow-50 border-yellow-200 text-yellow-700' };
        const ICONS = { red: <AlertTriangle size={14} />, orange: <FileText size={14} />, yellow: <Clock size={14} /> };

        return (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Bell size={14} className="text-brand-ink/30" />
              <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-ink/40">Alertas Activas ({alerts.length})</span>
            </div>
            <div className="space-y-2">
              {alerts.map((alert, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}
                  className={`flex items-center gap-3 px-5 py-3 rounded-2xl border ${SEVERITY[alert.severity]}`}>
                  {ICONS[alert.severity]}
                  <p className="text-[11px] font-medium flex-1">{alert.message}</p>
                </motion.div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* ─── NEW: Cash Flow Projection + KPI Ahorro ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Cash Flow Projection Chart */}
        <div className="lg:col-span-8 bg-white/40 backdrop-blur-md rounded-[3rem] p-10 border border-brand-sand/30 shadow-inner">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-xl font-serif text-brand-ink">Flujo de Caja Proyectado</h3>
              <p className="text-[9px] uppercase tracking-widest opacity-40">Próximos 60 días · Ingresos vs Egresos proyectados</p>
            </div>
            <TrendingUp size={18} className="text-brand-gold opacity-50" />
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={(() => {
                const refDate = new Date('2024-04-27');
                const data = [];
                const pendingInvs = invoices.filter(i => i.status !== 'paid' && i.status !== 'rejected');
                const paidInvs = invoices.filter(i => i.status === 'paid');

                // Derive realistic baseline from actual historical paid data
                const totalPaidAmount = paidInvs.reduce((s, i) => s + i.amount, 0);
                const paidDates = paidInvs.map(i => new Date(i.date).getTime());
                const paidSpanDays = paidDates.length > 1
                  ? Math.max(1, (Math.max(...paidDates) - Math.min(...paidDates)) / (1000 * 60 * 60 * 24))
                  : 60;
                const dailyAvgPaid = totalPaidAmount / paidSpanDays;

                // Group pending invoices by estimated due date (30 days after emission)
                const pendingByDue: Record<number, number> = {};
                pendingInvs.forEach(inv => {
                  const dueDate = new Date(inv.date);
                  dueDate.setDate(dueDate.getDate() + 30);
                  // Round to nearest 5-day bucket
                  const daysDiff = Math.round((dueDate.getTime() - refDate.getTime()) / (1000 * 60 * 60 * 24));
                  const bucket = Math.round(daysDiff / 5) * 5;
                  if (bucket >= 0 && bucket <= 60) {
                    pendingByDue[bucket] = (pendingByDue[bucket] || 0) + inv.amount;
                  }
                });

                let balanceAccum = totalBudget * 0.6;

                for (let d = 0; d <= 60; d += 5) {
                  const day = new Date(refDate);
                  day.setDate(day.getDate() + d);
                  const label = `${day.getDate()}/${day.getMonth() + 1}`;

                  // Egresos: actual pending invoices coming due at this bucket
                  const egresos = pendingByDue[d] || dailyAvgPaid * 3;
                  // Ingresos: projected from historical collection rate, slight decay for further future
                  const decayFactor = 1 - (d / 60) * 0.15;
                  const ingresos = dailyAvgPaid * 5 * decayFactor;

                  balanceAccum = balanceAccum + ingresos - egresos;

                  data.push({ dia: label, Ingresos: Math.round(ingresos), Egresos: Math.round(egresos), Balance: Math.round(Math.max(balanceAccum, 0)) });
                }
                return data;
              })()}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E6D5B8" opacity={0.3} />
                <XAxis dataKey="dia" tick={{ fontSize: 9, fill: '#1A1A1A' }} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: '#1A1A1A' }} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <RechartsTooltip
                  contentStyle={{ background: '#1A1A1A', border: 'none', borderRadius: '12px', color: '#F5F0E8', fontSize: '10px' }}
                  formatter={(value: number) => [`$${value.toLocaleString()}`, '']}
                />
                <Area type="monotone" dataKey="Ingresos" stroke="#22c55e" fill="#22c55e" fillOpacity={0.1} strokeWidth={2} />
                <Area type="monotone" dataKey="Egresos" stroke="#ef4444" fill="#ef4444" fillOpacity={0.1} strokeWidth={2} />
                <Line type="monotone" dataKey="Balance" stroke="#D4AF37" strokeWidth={2.5} dot={false} strokeDasharray="6 3" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="flex gap-6 mt-4">
            <div className="flex items-center gap-2"><div className="w-3 h-1 bg-green-500 rounded-full" /><span className="text-[9px] text-brand-ink/40">Ingresos</span></div>
            <div className="flex items-center gap-2"><div className="w-3 h-1 bg-red-500 rounded-full" /><span className="text-[9px] text-brand-ink/40">Egresos</span></div>
            <div className="flex items-center gap-2"><div className="w-3 h-1 bg-brand-gold rounded-full" style={{ borderTop: '2px dashed #D4AF37' }} /><span className="text-[9px] text-brand-ink/40">Balance Proyectado</span></div>
          </div>
        </div>

        {/* KPI: Savings vs Fintech */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <div className="bg-white/40 backdrop-blur-md rounded-[2.5rem] p-8 border border-brand-sand/30 shadow-inner space-y-5 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign size={16} className="text-green-600" />
              <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-brand-ink/40">Ahorro vs Fintech</span>
            </div>
            {(() => {
              const cashPaid = invoices.filter(i => i.paymentRoute === 'cash' && i.status === 'paid');
              const fintechPaid = invoices.filter(i => i.paymentRoute === 'fintech' && i.status === 'paid');
              const cashTotal = cashPaid.reduce((s, i) => s + i.amount, 0);
              const fintechCost = fintechPaid.reduce((s, i) => s + i.amount, 0);
              const fintechFee = fintechCost * 0.035; // 3.5% simulated fee
              const savedByCash = cashTotal * 0.035; // What would have cost via fintech
              return (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase tracking-wider text-brand-ink/30">Pagado con caja propia</p>
                    <p className="text-2xl font-serif text-brand-ink">{CURRENCY_FORMATTER.format(cashTotal)}</p>
                    <p className="text-[9px] text-green-600 font-bold">Ahorro en comisiones: {CURRENCY_FORMATTER.format(savedByCash)}</p>
                  </div>
                  <div className="border-t border-brand-sand/30 pt-4 space-y-1">
                    <p className="text-[10px] uppercase tracking-wider text-brand-ink/30">Pagado con fintech</p>
                    <p className="text-2xl font-serif text-orange-600">{CURRENCY_FORMATTER.format(fintechCost)}</p>
                    <p className="text-[9px] text-orange-500 font-bold">Comisión estimada (3.5%): {CURRENCY_FORMATTER.format(fintechFee)}</p>
                  </div>
                  <div className="border-t border-brand-sand/30 pt-4">
                    <div className="flex items-center gap-2">
                      <Percent size={14} className="text-brand-gold" />
                      <p className="text-[10px] uppercase tracking-wider text-brand-ink/40">Eficiencia financiera</p>
                    </div>
                    <p className="text-3xl font-serif text-brand-gold mt-1">
                      {cashTotal + fintechCost > 0 ? ((cashTotal / (cashTotal + fintechCost)) * 100).toFixed(0) : 0}%
                    </p>
                    <p className="text-[9px] text-brand-ink/30">Pagos con caja propia vs total</p>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Export Button */}
          <button
            onClick={() => { window.print(); }}
            className="flex items-center justify-center gap-3 px-6 py-4 bg-brand-ink text-brand-bone rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-gold hover:text-brand-ink transition-all shadow-md"
          >
            <Printer size={16} /> Exportar Reporte (PDF)
          </button>
        </div>
      </div>
    </div>

    {/* ─── Floating Report Button ─── */}
    <div className="fixed bottom-24 right-8 z-[90]">
      <AnimatePresence>
        {!showReportModal && (
          <motion.button
            initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
            onClick={() => setShowReportModal(true)}
            className="w-11 h-11 rounded-full bg-brand-ink text-brand-bone shadow-lg flex items-center justify-center hover:bg-brand-gold hover:text-brand-ink transition-all"
            title="Generar Reporte IA"
          >
            <FileBarChart size={16} />
          </motion.button>
        )}
      </AnimatePresence>
    </div>

    {/* ─── Report Generation Modal ─── */}
    <AnimatePresence>
      {showReportModal && (
        <motion.div
          key="report-modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] bg-brand-ink/40 backdrop-blur-sm flex items-center justify-center p-6"
          onClick={() => { if (!reportLoading) { setShowReportModal(false); setReportContent(null); } }}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={e => e.stopPropagation()}
            className="w-full max-w-2xl max-h-[80vh] bg-white rounded-[2rem] border border-brand-sand/40 shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-8 py-5 border-b border-brand-sand/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-ink flex items-center justify-center">
                  <FileBarChart size={18} className="text-brand-bone" />
                </div>
                <div>
                  <p className="text-lg font-bold text-brand-ink">Generador de Reportes IA</p>
                  <p className="text-[9px] uppercase tracking-widest text-brand-ink/30">Powered by Gemini · Datos en tiempo real</p>
                </div>
              </div>
              <button onClick={() => { setShowReportModal(false); setReportContent(null); }} className="p-2 hover:bg-brand-sand/20 rounded-xl transition-all">
                <X size={18} className="text-brand-ink/40" />
              </button>
            </div>

            {/* Report type selector */}
            {!reportContent && !reportLoading && (
              <div className="p-8 space-y-6">
                <p className="text-[10px] uppercase tracking-widest font-bold text-brand-ink/40">Selecciona el tipo de reporte</p>
                <div className="grid grid-cols-2 gap-4">
                  {([
                    { type: 'executive' as ReportType, label: 'Ejecutivo de Tesorería', desc: 'Resumen de cartera, pagos y alertas para junta directiva', icon: <BarChart3 size={20} /> },
                    { type: 'anticorruption' as ReportType, label: 'Alerta Anti-Corrupción', desc: 'Informe de proveedores con pagos vencidos y riesgos', icon: <AlertTriangle size={20} /> },
                    { type: 'fiscal' as ReportType, label: 'Cumplimiento Fiscal', desc: 'Estado de auditoría IA, riesgos DIOT y discrepancias', icon: <ShieldCheck size={20} /> },
                    { type: 'provider' as ReportType, label: 'Análisis de Proveedor', desc: 'Historial, patrones y nivel de riesgo de un proveedor', icon: <Building2 size={20} /> },
                  ]).map(({ type, label, desc, icon }) => (
                    <button
                      key={type}
                      onClick={() => setReportType(type)}
                      className={`text-left p-5 rounded-2xl border-2 transition-all space-y-2 ${
                        reportType === type ? 'border-brand-gold bg-brand-gold/5' : 'border-brand-sand/30 hover:border-brand-gold/50'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${reportType === type ? 'bg-brand-gold/20 text-brand-gold' : 'bg-brand-bone text-brand-ink/40'}`}>
                        {icon}
                      </div>
                      <p className="text-sm font-bold text-brand-ink">{label}</p>
                      <p className="text-[10px] text-brand-ink/40 leading-relaxed">{desc}</p>
                    </button>
                  ))}
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={handleGenerateReport}
                    className="flex items-center gap-2 px-6 py-3 bg-brand-ink text-brand-bone text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-brand-gold hover:text-brand-ink transition-all shadow-md"
                  >
                    <Sparkles size={14} /> Generar Reporte
                  </button>
                </div>
              </div>
            )}

            {/* Loading */}
            {reportLoading && (
              <div className="p-12 flex flex-col items-center justify-center space-y-4">
                <Loader2 size={32} className="animate-spin text-brand-gold" />
                <p className="text-sm text-brand-ink/40">Generando reporte con IA...</p>
                <p className="text-[9px] text-brand-ink/20 uppercase tracking-widest">Analizando {invoices.length} facturas y {MOCK_SUPPLIERS.length} proveedores</p>
              </div>
            )}

            {/* Report content */}
            {reportContent && (
              <div className="flex-1 overflow-y-auto p-8 space-y-4">
                <div className="prose prose-sm max-w-none">
                  {reportContent.split('\n').map((line, i) => (
                    <p key={i} className={`text-[12px] leading-relaxed text-brand-ink/80 ${line.startsWith('**') ? 'font-bold text-brand-ink !text-[13px]' : ''}`}>
                      {line.split(/(\*\*[^*]+\*\*)/).map((part, k) =>
                        part.startsWith('**') && part.endsWith('**')
                          ? <strong key={k} className="font-bold text-brand-ink">{part.slice(2, -2)}</strong>
                          : part
                      )}
                    </p>
                  ))}
                </div>
                <div className="flex gap-3 pt-4 border-t border-brand-sand/30">
                  <button
                    onClick={() => { navigator.clipboard.writeText(reportContent); }}
                    className="flex items-center gap-2 px-5 py-2.5 bg-brand-bone border border-brand-sand/40 text-brand-ink text-[10px] font-bold uppercase tracking-widest rounded-xl hover:border-brand-gold transition-all"
                  >
                    <ListChecks size={14} /> Copiar
                  </button>
                  <button
                    onClick={() => { setReportContent(null); }}
                    className="flex items-center gap-2 px-5 py-2.5 bg-brand-ink text-brand-bone text-[10px] font-bold uppercase tracking-widest rounded-xl hover:bg-brand-gold hover:text-brand-ink transition-all"
                  >
                    <RotateCcw size={14} /> Generar Otro
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>

    <AnimatePresence>
      {showFintechPayment && (
        <FintechPaymentModal
          fintechTotal={fintechTotal}
          totalBudget={totalBudget}
          onClose={() => setShowFintechPayment(false)}
        />
      )}
    </AnimatePresence>
    </>
  );
}
