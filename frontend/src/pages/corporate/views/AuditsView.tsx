import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShieldCheck, CheckCircle2, Cpu, LogOut, Search, Clock, FileText, X, Send, AlertTriangle,
  MessageSquare, Play, Loader2, History, Info, Paperclip, RefreshCw,
} from 'lucide-react';
import { auth } from '../../../lib/firebase.ts';
import { MOCK_SUPPLIERS, type Invoice } from '../../../types.ts';
import { api, isRealId } from '../../../services/apiClient.ts';
import { auditInvoice, batchAuditInvoices, type ForensicAuditResult } from '../../../services/geminiService.ts';
import { AuthorizerService, ClarificationService, SupplierMessageService } from '../../../services/mockServices.ts';
import { CURRENCY_FORMATTER, getPriorityInfo, isInvoiceFullyValidated } from '../../../utils/format.ts';
import type { DocumentFile } from './SupplierDirectoryView.tsx';
import { SatRiskBadges, ComplianceDetailModal } from './PendingInvoicesView.tsx';

export function AuditsView({
  selectedInvoice,
  setSelectedInvoice,
  isAuditing,
  auditResult,
  startAudit,
  routePayment,
  invoices,
  onUpdateInvoice,
  setViewingDocs,
  onTabChange,
  onApproveWithAnimation
}: {
  selectedInvoice: Invoice | null,
  setSelectedInvoice: (i: Invoice | null) => void,
  isAuditing: boolean,
  auditResult: ForensicAuditResult | null,
  startAudit: (i: Invoice) => void,
  routePayment: (id: string, route: 'cash' | 'fintech') => void,
  invoices: Invoice[],
  onUpdateInvoice: (id: string, updates: Partial<Invoice>) => void,
  setViewingDocs: (data: { title: string, docs: DocumentFile[] } | null) => void,
  onTabChange?: (tab: 'dashboard' | 'suppliers' | 'audits' | 'pending_invoices' | 'financing' | 'settings' | 'fiscal_audit') => void,
  onApproveWithAnimation?: (inv: Invoice) => void
}) {
  const [showAuthStatus, setShowAuthStatus] = useState<string | null>(null);
  const [complianceInv, setComplianceInv] = useState<Invoice | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('all');

  const [missingSearchTerm, setMissingSearchTerm] = useState('');
  const [missingPriorityFilter, setMissingPriorityFilter] = useState('all');

  // ─── Batch Audit State ───
  const [isBatchAuditing, setIsBatchAuditing] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ completed: 0, total: 0 });
  const [batchResults, setBatchResults] = useState<{ validated: number; discrepancy: number; blocked: number } | null>(null);

  const [auditSubTab, setAuditSubTab] = useState<'validated' | 'pending'>('validated');
  const [rejectClarInvoice, setRejectClarInvoice] = useState<Invoice | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [pendingMsgInvoice, setPendingMsgInvoice] = useState<Invoice | null>(null);
  const [pendingMsgText, setPendingMsgText] = useState('');
  const [pendingMsgSent, setPendingMsgSent] = useState(false);
  const [, setAuditClarTick] = useState(0);
  const [, setAuditMsgTick] = useState(0);
  useEffect(() => {
    const cb = () => setAuditClarTick(t => t + 1);
    ClarificationService.subscribe(cb);
    return () => ClarificationService.unsubscribe(cb);
  }, []);
  useEffect(() => {
    const cb = () => setAuditMsgTick(t => t + 1);
    SupplierMessageService.subscribe(cb);
    return () => SupplierMessageService.unsubscribe(cb);
  }, []);

  const pendingForBatch = invoices.filter(i => i.status === 'pending' && !i.auditScore);

  const startBatchAudit = async () => {
    if (pendingForBatch.length === 0) return;
    setIsBatchAuditing(true);
    setBatchProgress({ completed: 0, total: pendingForBatch.length });
    setBatchResults(null);

    const stats = { validated: 0, discrepancy: 0, blocked: 0 };

    await batchAuditInvoices(
      pendingForBatch,
      invoices,
      MOCK_SUPPLIERS,
      (completed, total, current, result) => {
        setBatchProgress({ completed, total });
        if (result.status === 'VALIDATED') stats.validated++;
        else if (result.status === 'DISCREPANCY') stats.discrepancy++;
        else stats.blocked++;

        onUpdateInvoice(current.id, {
          status: result.status === 'VALIDATED' ? 'audited' : current.status,
          auditScore: result.score,
          auditAnalysis: result.analysis,
          forensicStatus: result.status,
          forensicSolution: result.solution,
          signatures: result.status === 'VALIDATED' ? 1 : 0,
          satStatus: result.satResult?.estado as any || 'Pendiente',
          satVerifiedAt: new Date().toISOString(),
        });
      }
    );

    setBatchResults({ ...stats });
    setIsBatchAuditing(false);
  };

  // NOTE: Auto-transition to financing removed — invoices stay in validation view until manually moved

  // Invoices currently being audited or already audited (the "queue")
  const auditingInvoices = invoices.filter(inv => {
    const isFullyApproved = inv.status === 'approved' || inv.status === 'paid';
    const isInAuditProcess = (inv.status === 'audited' || (inv.auditScore && inv.auditScore > 0) || inv.id === selectedInvoice?.id);
    const isSearchMatch = (inv.id.toLowerCase().includes(searchTerm.toLowerCase()) || inv.provider.toLowerCase().includes(searchTerm.toLowerCase()));
    const isPriorityMatch = (priorityFilter === 'all' || getPriorityInfo(inv.date).label === priorityFilter);
    
    // EXCLUDE if fully approved OR if it has a discrepancy (those move to pending)
    const hasDiscrepancy = inv.forensicStatus === 'DISCREPANCY' || inv.forensicStatus === 'BLOCKED';
    return !isFullyApproved && isInAuditProcess && isSearchMatch && isPriorityMatch && !hasDiscrepancy;
  });

  // Real pending invoices (discrepancies detected by AI or blocked)
  const forensicPendingInvoices = invoices.filter(inv => {
    const hasDiscrepancy = inv.forensicStatus === 'DISCREPANCY' || inv.forensicStatus === 'BLOCKED';
    const matchesSearch = inv.id.toLowerCase().includes(missingSearchTerm.toLowerCase()) || inv.provider.toLowerCase().includes(missingSearchTerm.toLowerCase());
    const matchesPriority = missingPriorityFilter === 'all' || getPriorityInfo(inv.date).label === missingPriorityFilter;
    return hasDiscrepancy && matchesSearch && matchesPriority;
  });

  const allPendingInvoices = [...forensicPendingInvoices];

  // Auto-start audit when an invoice is selected (only once per invoice)
  const lastAutoAuditedRef = React.useRef<string | null>(null);
  useEffect(() => {
    if (selectedInvoice && !isAuditing && selectedInvoice.status === 'pending' && lastAutoAuditedRef.current !== selectedInvoice.id) {
      lastAutoAuditedRef.current = selectedInvoice.id;
      startAudit(selectedInvoice);
    }
  }, [selectedInvoice?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col pb-12">
      <header className="mb-6 flex-shrink-0 flex justify-between items-start text-brand-ink">
        <div>
          <span className="label-caps mb-2 block">Protocolo de Control Inmutable</span>
          <h2 className="text-4xl mb-4 font-serif">Centro de Validación AI</h2>
          <p className="text-sm opacity-40 max-w-2xl font-serif">
            Las facturas en proceso de validación aparecen aquí. Motor Triple Match automatizado.
          </p>
        </div>
        <div className="flex gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 opacity-30" size={14} />
            <input 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Buscar Factura..."
              className="pl-9 pr-4 py-2 bg-brand-cream border border-brand-sand rounded-xl text-xs focus:outline-none focus:border-brand-gold shadow-sm"
            />
          </div>
          <select 
            value={priorityFilter}
            onChange={e => setPriorityFilter(e.target.value)}
            className="px-4 py-2 bg-brand-cream border border-brand-sand rounded-xl text-[9px] uppercase font-bold tracking-wider shadow-sm cursor-pointer outline-none focus:border-brand-gold"
          >
            <option value="all">Filtro Prioridad</option>
            <option value="Baja">Baja</option>
            <option value="Media">Media</option>
            <option value="Media Alta">Media Alta</option>
            <option value="Urgente">Urgente</option>
          </select>
        </div>
      </header>

      {/* ─── Batch Audit Panel ─── */}
      {(pendingForBatch.length > 0 || isBatchAuditing || batchResults) && (
        <div className="mb-6 flex-shrink-0">
          <div className={`editorial-card !p-5 space-y-4 transition-all ${isBatchAuditing ? 'border-brand-gold/50 bg-brand-gold/5' : batchResults ? 'border-green-300 bg-green-50/30' : 'border-brand-sand/40'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isBatchAuditing ? 'bg-brand-gold/20' : batchResults ? 'bg-green-100' : 'bg-brand-bone'}`}>
                  {isBatchAuditing ? <Loader2 size={18} className="text-brand-gold animate-spin" /> : batchResults ? <CheckCircle2 size={18} className="text-green-600" /> : <Cpu size={18} className="text-brand-ink/40" />}
                </div>
                <div>
                  <p className="text-sm font-bold text-brand-ink">
                    {isBatchAuditing ? `Auditando ${batchProgress.completed}/${batchProgress.total} facturas...` : batchResults ? 'Auditoría batch completada' : `${pendingForBatch.length} facturas pendientes de auditar`}
                  </p>
                  <p className="text-[9px] uppercase tracking-widest text-brand-ink/40">
                    {isBatchAuditing ? 'Motor de reglas + IA para anomalías' : batchResults ? `✅ ${batchResults.validated} validadas · ⚠️ ${batchResults.discrepancy} discrepancias · 🚫 ${batchResults.blocked} bloqueadas` : 'Motor híbrido: código determinista + IA para dictámenes'}
                  </p>
                </div>
              </div>
              {!isBatchAuditing && !batchResults && (
                <button
                  onClick={startBatchAudit}
                  className="flex items-center gap-2 px-5 py-2.5 bg-brand-ink text-brand-bone text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-brand-gold hover:text-brand-ink transition-all shadow-md"
                >
                  <Play size={12} /> Auditar Todas
                </button>
              )}
              {batchResults && (
                <button
                  onClick={() => setBatchResults(null)}
                  className="text-[9px] font-bold uppercase tracking-widest text-brand-ink/30 hover:text-brand-ink transition-all px-3 py-1.5 border border-brand-sand/30 rounded-xl"
                >
                  Cerrar
                </button>
              )}
            </div>
            {isBatchAuditing && (
              <div className="space-y-2">
                <div className="w-full bg-brand-sand/30 rounded-full h-2.5 overflow-hidden">
                  <motion.div
                    className="h-full bg-brand-gold rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${batchProgress.total > 0 ? (batchProgress.completed / batchProgress.total) * 100 : 0}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
                <p className="text-[9px] text-brand-ink/30 text-right">{Math.round(batchProgress.total > 0 ? (batchProgress.completed / batchProgress.total) * 100 : 0)}% completado</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Sub-tab toggle ─── */}
      <div className="flex items-center gap-1 mb-6 bg-brand-bone/60 p-1 rounded-xl w-fit border border-brand-sand/30">
        {[
          { key: 'validated' as const, label: 'Facturas Validadas', count: auditingInvoices.length, icon: <CheckCircle2 size={13} /> },
          { key: 'pending' as const, label: 'Facturas Pendientes', count: allPendingInvoices.length, icon: <AlertTriangle size={13} /> },
        ].map(tab => (
          <button key={tab.key} onClick={() => setAuditSubTab(tab.key)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold transition-all ${
              auditSubTab === tab.key
                ? 'bg-brand-ink text-brand-bone shadow-md'
                : 'text-brand-ink/40 hover:text-brand-ink/70 hover:bg-white/50'
            }`}>
            {tab.icon}
            {tab.label}
            {tab.count > 0 && (
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-black ${
                auditSubTab === tab.key
                  ? tab.key === 'pending' ? 'bg-red-500 text-white' : 'bg-brand-gold text-brand-ink'
                  : tab.key === 'pending' && tab.count > 0 ? 'bg-red-100 text-red-600' : 'bg-brand-sand/40 text-brand-ink/40'
              }`}>{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* ═══════════════════ VALIDATED TAB ═══════════════════ */}
      {auditSubTab === 'validated' && (
        <>
          {/* ─── Validation Animation Overlay ─── */}
          <AnimatePresence>
            {isAuditing && selectedInvoice && (
              <motion.div key="audit-overlay" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4, ease: 'easeOut' }} className="mb-4">
                <div className="relative overflow-hidden rounded-2xl border border-brand-gold/30 bg-gradient-to-r from-brand-cream via-brand-gold/5 to-brand-cream p-6 shadow-lg shadow-brand-gold/10">
                  <motion.div className="absolute inset-0 bg-gradient-to-r from-transparent via-brand-gold/10 to-transparent"
                    animate={{ x: ['-100%', '200%'] }} transition={{ repeat: Infinity, duration: 2.5, ease: 'linear' }} />
                  <div className="relative z-10 flex items-center gap-6">
                    <div className="relative flex-shrink-0">
                      <motion.div className="w-16 h-16 rounded-full border-[3px] border-brand-gold/20 border-t-brand-gold"
                        animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }} />
                      <div className="absolute inset-0 flex items-center justify-center"><ShieldCheck size={24} className="text-brand-gold" /></div>
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-3">
                        <h3 className="text-lg font-serif text-brand-ink">Validando {selectedInvoice.id}</h3>
                        <motion.span className="text-[9px] px-3 py-1 rounded-full bg-brand-gold/20 text-brand-gold font-bold uppercase tracking-widest"
                          animate={{ opacity: [1, 0.4, 1] }} transition={{ repeat: Infinity, duration: 1.5 }}>En proceso</motion.span>
                      </div>
                      <p className="text-xs text-brand-ink/50">{selectedInvoice.provider} · {CURRENCY_FORMATTER.format(selectedInvoice.amount)}</p>
                      <div className="flex items-center gap-2">
                        {['Integridad', 'OC Match', 'SAT', 'Precios IA', 'Veredicto'].map((step, idx) => (
                          <motion.div key={step} className="px-3 py-1.5 rounded-lg bg-white/60 border border-brand-sand/30"
                            initial={{ opacity: 0.3 }} animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 2, delay: idx * 0.5 }}>
                            <span className="text-[8px] font-bold uppercase tracking-wider text-brand-ink/60">{step}</span>
                          </motion.div>
                        ))}
                      </div>
                      <div className="w-full h-1.5 bg-brand-sand/20 rounded-full overflow-hidden">
                        <motion.div className="h-full bg-gradient-to-r from-brand-gold to-brand-gold/60 rounded-full"
                          initial={{ width: '5%' }} animate={{ width: '85%' }} transition={{ duration: 4, ease: 'easeOut' }} />
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {auditingInvoices.length === 0 && !isBatchAuditing ? (
            <div className="editorial-card !p-20 text-center flex flex-col items-center justify-center space-y-6 border-dashed border-brand-sand shadow-none opacity-60">
              <div className="w-20 h-20 bg-brand-sand/20 rounded-full flex items-center justify-center text-brand-ink/40"><ShieldCheck size={40} /></div>
              <div className="space-y-2">
                <h3 className="text-2xl font-serif text-brand-ink">Sin facturas validadas</h3>
                <p className="text-sm text-brand-ink/40 max-w-xs mx-auto">Las facturas aparecerán aquí una vez que se procesen con el motor de validación.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {auditingInvoices.map(inv => {
                const isCurrent = inv.id === selectedInvoice?.id;
                const isProcessing = isCurrent && isAuditing;
                const priority = getPriorityInfo(inv.date);
                const sigs = inv.signatures || 0;
                const isFullyValidated = isInvoiceFullyValidated(inv);

                return (
                  <motion.div key={inv.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    className={`editorial-card !p-0 overflow-hidden border transition-all ${
                      isFullyValidated ? 'border-green-200 bg-green-50/20' :
                      inv.forensicStatus === 'VALIDATED' ? 'border-brand-sand/50' :
                      'border-brand-sand/30'
                    }`}>
                    {/* Card header */}
                    <div className="flex items-center justify-between px-5 py-4 border-b border-brand-sand/20">
                      <div className="flex items-center gap-4">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-brand-ink">{inv.id}</span>
                            <span className={`text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${
                              isFullyValidated ? 'bg-green-600 text-white' :
                              inv.forensicStatus === 'VALIDATED' ? 'bg-yellow-100 text-yellow-800 border border-yellow-300' :
                              'bg-brand-bone text-brand-ink/30 border border-brand-sand/30'
                            }`}>
                              {isFullyValidated ? 'VALIDADA' : inv.forensicStatus === 'VALIDATED' ? 'PARCIAL' : 'EN PROCESO'}
                            </span>
                            <SatRiskBadges inv={inv} />
                          </div>
                          <span className="text-[10px] text-brand-ink/40 font-serif mt-0.5">{inv.provider}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-5">
                        <span className="text-base font-bold text-brand-ink">{CURRENCY_FORMATTER.format(inv.amount)}</span>
                        <div className="flex items-center gap-1.5">
                          <div className={`w-1.5 h-1.5 rounded-full ${priority.color}`} />
                          <span className={`text-[9px] font-bold uppercase tracking-wider ${priority.text}`}>{priority.label}</span>
                        </div>
                      </div>
                    </div>

                    {/* Triple Match — expanded horizontal layout */}
                    <div className="px-5 py-4">
                      {isProcessing ? (
                        <div className="flex items-center gap-3 py-2">
                          <motion.div className="w-5 h-5 rounded-full border-2 border-brand-gold/20 border-t-brand-gold"
                            animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }} />
                          <span className="text-xs font-bold text-brand-ink/50">Ejecutando Triple Match...</span>
                        </div>
                      ) : (
                        <div className="grid grid-cols-4 gap-3">
                          {[
                            { label: 'Orden de Compra', sub: 'Integridad documental', ok: inv.forensicStatus !== 'BLOCKED', fail: inv.forensicStatus === 'BLOCKED',
                              onClick: () => setViewingDocs({ title: `Integridad y OC - ${inv.id}`, docs: [{ id: 'po-1', name: `PO_${inv.poNumber}.pdf`, date: inv.date, type: 'application/pdf' }] }) },
                            { label: 'Precio IA', sub: 'Estabilidad y contratos', ok: inv.forensicStatus === 'VALIDATED' || !inv.forensicStatus, warn: inv.forensicStatus === 'DISCREPANCY',
                              onClick: () => setViewingDocs({ title: `Precios - ${inv.provider}`, docs: [{ id: 'hist-1', name: 'PRECIOS_CONTRATO.pdf', date: inv.date, type: 'application/pdf' }] }) },
                            { label: 'Estatus SAT', sub: inv.satStatus || 'Pendiente', ok: inv.satStatus === 'Vigente', fail: inv.satStatus === 'Cancelado', warn: inv.satStatus === 'No Encontrado', pending: !inv.satStatus || inv.satStatus === 'Pendiente',
                              onClick: () => setComplianceInv(inv) },
                            { label: 'Firmas', sub: `${sigs} de 2 autorizaciones`, ok: sigs >= 2, warn: sigs === 1,
                              onClick: () => setShowAuthStatus(inv.id) },
                          ].map((check, ci) => (
                            <button key={ci} onClick={check.onClick}
                              className={`p-3 rounded-xl border text-left transition-all ${
                                check.fail ? 'bg-red-50 border-red-200 hover:border-red-300' :
                                check.ok ? 'bg-green-50/60 border-green-200 hover:border-green-300' :
                                check.warn ? 'bg-amber-50 border-amber-200 hover:border-amber-300' :
                                'bg-brand-bone/50 border-brand-sand/30 hover:border-brand-sand/50'
                              } ${check.onClick ? 'cursor-pointer' : 'cursor-default'}`}>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[9px] font-bold text-brand-ink/70">{check.label}</span>
                                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold ${
                                  check.fail ? 'bg-red-500 text-white' :
                                  check.ok ? 'bg-green-500 text-white' :
                                  check.warn ? 'bg-amber-400 text-white' :
                                  'bg-brand-sand/40 text-brand-ink/30'
                                }`}>
                                  {check.fail ? '✗' : check.ok ? '✓' : check.warn ? '!' : '—'}
                                </div>
                              </div>
                              <span className="text-[8px] text-brand-ink/40">{check.sub}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Verdict message */}
                    {!isProcessing && (
                      <div className={`mx-5 mb-4 px-4 py-3 rounded-xl text-xs leading-relaxed ${
                        isFullyValidated ? 'bg-green-50 border border-green-200 text-green-800' :
                        inv.forensicStatus === 'VALIDATED' ? 'bg-yellow-50 border border-yellow-200 text-yellow-900' :
                        'bg-brand-bone border border-brand-sand/30 text-brand-ink/60'
                      }`}>
                        <div className="flex items-start gap-2.5">
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                            isFullyValidated ? 'bg-green-500 text-white' :
                            inv.forensicStatus === 'VALIDATED' ? 'bg-yellow-500 text-white' :
                            'bg-brand-sand text-white'
                          }`}>
                            {isFullyValidated ? <CheckCircle2 size={10} /> : inv.forensicStatus === 'VALIDATED' ? <AlertTriangle size={10} /> : <Clock size={10} />}
                          </div>
                          <div className="flex-1">
                            <p className="font-serif text-[11px] font-medium">
                              {isFullyValidated
                                ? `Factura validada correctamente. Triple Match completo: orden de compra verificada, precios consistentes con contrato vigente, CFDI ${inv.satStatus || 'verificado'} ante el SAT${inv.cfdiUUID ? ` (UUID ${inv.cfdiUUID.slice(0, 8)}…)` : ''}. ${sigs} de 2 firmas de autorización obtenidas.`
                                : inv.forensicStatus === 'VALIDATED' && sigs < 2
                                ? `Validación parcial: Triple Match aprobado — orden de compra coincide, precios dentro de rango, CFDI ${inv.satStatus || 'pendiente'} ante SAT. Pendiente: ${2 - sigs} firma${2 - sigs > 1 ? 's' : ''} de autorización para completar el proceso.`
                                : inv.forensicStatus === 'VALIDATED' && inv.satStatus !== 'Vigente'
                                ? `Validación parcial: OC y precios verificados. Estatus SAT: ${inv.satStatus || 'pendiente de consulta'}. Se requiere confirmación del CFDI para completar la validación.`
                                : inv.auditAnalysis || 'Factura en proceso de validación.'}
                            </p>
                            {inv.auditAnalysis && isFullyValidated && (
                              <p className="text-[10px] opacity-50 mt-1 italic">{inv.auditAnalysis}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ═══════════════════ PENDING TAB ═══════════════════ */}
      {auditSubTab === 'pending' && (
        <>
          {/* Search & filter */}
          <div className="flex gap-3 mb-5">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 opacity-30 text-brand-ink" size={14} />
              <input value={missingSearchTerm} onChange={e => setMissingSearchTerm(e.target.value)}
                placeholder="Buscar factura pendiente..."
                className="w-full pl-9 pr-4 py-2.5 bg-white border border-brand-sand rounded-xl text-xs focus:outline-none focus:border-brand-gold shadow-sm" />
            </div>
            <select value={missingPriorityFilter} onChange={e => setMissingPriorityFilter(e.target.value)}
              className="px-4 py-2.5 bg-white border border-brand-sand rounded-xl text-[10px] uppercase font-bold tracking-wider shadow-sm cursor-pointer outline-none focus:border-brand-gold">
              <option value="all">Todas las prioridades</option>
              <option value="Baja">Baja</option>
              <option value="Media">Media Alta</option>
              <option value="Urgente">Urgente</option>
            </select>
          </div>

          {allPendingInvoices.length === 0 ? (
            <div className="editorial-card !p-20 text-center flex flex-col items-center justify-center space-y-6 border-dashed border-brand-sand shadow-none opacity-60">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center text-green-500"><ShieldCheck size={40} /></div>
              <div className="space-y-2">
                <h3 className="text-2xl font-serif text-brand-ink">Sin inconsistencias</h3>
                <p className="text-sm text-brand-ink/40 max-w-xs mx-auto">Todas las facturas pasaron la validación correctamente.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {allPendingInvoices.map(inv => {
                const priority = getPriorityInfo(inv.date);
                const supplier = MOCK_SUPPLIERS.find(s => s.id === inv.providerId);
                const discrepancyMsg = `Estimado ${supplier?.name || 'proveedor'},\n\nLa factura ${inv.id} por ${CURRENCY_FORMATTER.format(inv.amount)} presenta la siguiente incidencia:\n\n${inv.auditAnalysis || 'Discrepancia detectada.'}\n\nAcción requerida: ${inv.forensicSolution || 'Enviar documentación de soporte.'}\n\nFavor de subir la aclaración correspondiente en su portal (Facturas → Aclarar).`;

                return (
                  <motion.div key={inv.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    className="editorial-card !p-0 overflow-hidden border border-red-200/60 bg-white">

                    {/* Header */}
                    <div className="flex items-center justify-between px-5 py-4 border-b border-brand-sand/20 bg-brand-bone/30">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${inv.forensicStatus === 'BLOCKED' ? 'bg-red-100' : 'bg-amber-100'}`}>
                          <AlertTriangle size={16} className={inv.forensicStatus === 'BLOCKED' ? 'text-red-500' : 'text-amber-500'} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-brand-ink">{inv.id}</span>
                            <button onClick={() => setComplianceInv(inv)} title="Ver detalle de la incidencia y verificación SAT"
                              className={`text-[8px] font-bold px-2 py-0.5 rounded-md inline-flex items-center gap-1 transition-all hover:brightness-95 hover:ring-1 cursor-pointer ${inv.forensicStatus === 'BLOCKED' ? 'bg-red-100 text-red-600 hover:ring-red-300' : 'bg-amber-100 text-amber-700 hover:ring-amber-300'}`}>
                              {inv.forensicStatus === 'BLOCKED' ? 'BLOQUEADA' : 'DISCREPANCIA'}
                              <Info size={9} />
                            </button>
                            <SatRiskBadges inv={inv} />
                            {ClarificationService.hasClari(inv.id) && (() => {
                              const cl = ClarificationService.getByInvoice(inv.id)[0];
                              return cl?.status === 'pending' ? (
                                <span className="text-[7px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-md font-bold animate-pulse">ACLARACIÓN RECIBIDA</span>
                              ) : cl?.status === 'accepted' ? (
                                <span className="text-[7px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-md font-bold">ACLARADA</span>
                              ) : null;
                            })()}
                          </div>
                          <span className="text-[10px] text-brand-ink/40 font-serif">{inv.provider}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-right">
                        <span className="text-base font-bold text-brand-ink">{CURRENCY_FORMATTER.format(inv.amount)}</span>
                        <div className="flex items-center gap-1.5">
                          <div className={`w-1.5 h-1.5 rounded-full ${priority.color}`} />
                          <span className={`text-[9px] font-bold uppercase tracking-wider ${priority.text}`}>{priority.label}</span>
                        </div>
                      </div>
                    </div>

                    {/* Body — two columns */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 lg:divide-x divide-brand-sand/20">
                      {/* Left: Incidencia + Acción */}
                      <div className="p-5 space-y-3">
                        <div>
                          <p className="text-[9px] font-bold uppercase tracking-widest text-red-500 mb-2 flex items-center gap-1.5">
                            <AlertTriangle size={10} /> Incidencia Detectada
                          </p>
                          <p className="text-xs text-brand-ink/80 leading-relaxed">{inv.auditAnalysis}</p>
                        </div>
                        {inv.forensicSolution && (
                          <div className="p-3 bg-brand-ink rounded-xl text-brand-paper">
                            <p className="text-[9px] font-bold text-brand-gold mb-1">Acción Requerida</p>
                            <p className="text-[10px] opacity-80 leading-relaxed">{inv.forensicSolution}</p>
                          </div>
                        )}

                        {/* Clarification panel */}
                        {ClarificationService.hasClari(inv.id) && (() => {
                          const cl = ClarificationService.getByInvoice(inv.id)[0];
                          if (!cl) return null;
                          return (
                            <div className={`p-4 rounded-xl border space-y-3 ${cl.status === 'pending' ? 'bg-amber-50 border-amber-200' : cl.status === 'accepted' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                              <div className="flex items-center justify-between">
                                <p className={`text-[9px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${cl.status === 'pending' ? 'text-amber-700' : cl.status === 'accepted' ? 'text-green-700' : 'text-red-600'}`}>
                                  <MessageSquare size={10} />
                                  {cl.status === 'pending' ? 'Aclaración Recibida' : cl.status === 'accepted' ? 'Aclaración Aceptada' : 'Aclaración Rechazada'}
                                </p>
                                <span className="text-[8px] text-brand-ink/30">{new Date(cl.date).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}</span>
                              </div>
                              <p className="text-xs text-brand-ink/60 leading-relaxed">{cl.message}</p>
                              {cl.fileName && (
                                <button onClick={() => setViewingDocs({ title: `Aclaración - ${inv.id}`, docs: [{ id: `clar-${cl.id}`, name: cl.fileName!, date: cl.date, type: cl.fileType || 'application/pdf' }] })}
                                  className="flex items-center gap-1.5 text-[10px] text-brand-gold hover:text-brand-ink transition-colors">
                                  <Paperclip size={10} /> <span className="underline underline-offset-2">{cl.fileName}</span>
                                </button>
                              )}
                              {cl.status === 'pending' && (
                                <div className="flex gap-2 pt-1">
                                  <button onClick={() => {
                                    ClarificationService.updateStatus(cl.id, 'accepted');
                                    if (supplier) SupplierMessageService.send(supplier.id, supplier.name, 'corporate', `La aclaración para la factura ${inv.id} fue aceptada. La factura será re-validada. Gracias.`);
                                    onUpdateInvoice(inv.id, {
                                      supportDocUrl: cl.fileName || 'aclaracion_aceptada',
                                      changeLog: [...(inv.changeLog || []), { timestamp: new Date().toISOString(), user: 'Auditor', action: 'Aclaración aceptada', from: inv.forensicStatus || 'DISCREPANCY', to: 'PENDING_REAUDIT', reason: cl.message }]
                                    });
                                  }}
                                    className="flex-1 py-2 bg-green-600 text-white rounded-lg text-[9px] font-bold uppercase tracking-wider hover:bg-green-700 transition-all flex items-center justify-center gap-1.5">
                                    <CheckCircle2 size={10} /> Aceptar
                                  </button>
                                  <button onClick={() => setRejectClarInvoice(inv)}
                                    className="flex-1 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg text-[9px] font-bold uppercase tracking-wider hover:bg-red-100 transition-all">
                                    Rechazar
                                  </button>
                                </div>
                              )}
                              {cl.status === 'accepted' && (
                                <button onClick={() => { setSelectedInvoice(inv); startAudit(inv); }}
                                  disabled={isAuditing}
                                  className="w-full py-2.5 bg-brand-ink text-white rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-brand-gold hover:text-brand-ink transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                                  <RefreshCw size={12} /> Re-validar con IA
                                </button>
                              )}
                            </div>
                          );
                        })()}
                      </div>

                      {/* Right: Mensaje al proveedor + acciones */}
                      <div className="p-5 space-y-3 bg-brand-bone/20">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-brand-ink/40 flex items-center gap-1.5">
                          <Send size={10} /> Mensaje al Proveedor
                        </p>
                        <div className="p-3 bg-white rounded-xl border border-brand-sand/30 text-[10px] text-brand-ink/60 leading-relaxed whitespace-pre-wrap max-h-[160px] overflow-y-auto scrollbar-thin scrollbar-thumb-brand-sand/30">
                          {discrepancyMsg}
                        </div>
                        <button onClick={() => {
                          if (supplier) {
                            SupplierMessageService.send(supplier.id, supplier.name, 'corporate', discrepancyMsg);
                            setPendingMsgInvoice(inv);
                            setPendingMsgSent(true);
                            setTimeout(() => setPendingMsgSent(false), 3000);
                          }
                        }}
                          className="w-full py-2.5 bg-brand-ink text-white rounded-xl text-[10px] font-bold uppercase tracking-wider hover:bg-brand-gold hover:text-brand-ink transition-all flex items-center justify-center gap-2">
                          <Send size={12} /> Enviar Solicitud al Proveedor
                        </button>
                        {pendingMsgSent && pendingMsgInvoice?.id === inv.id && (
                          <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 text-green-600 text-[10px] font-bold">
                            <CheckCircle2 size={12} /> Mensaje enviado al portal del proveedor
                          </motion.div>
                        )}

                        <div className="border-t border-brand-sand/20 pt-3 flex gap-2">
                          <button onClick={() => {
                            const reason = window.prompt('Motivo de rechazo:\n1) XML inválido\n2) OC no encontrada\n3) Monto incorrecto\n4) Proveedor no autorizado\n5) Otro', '');
                            if (reason !== null && reason.trim()) {
                              const REASONS: Record<string, string> = { '1': 'XML inválido', '2': 'OC no encontrada', '3': 'Monto incorrecto', '4': 'Proveedor no autorizado' };
                              onUpdateInvoice(inv.id, { status: 'rejected', rejectionReason: REASONS[reason.trim()] || reason.trim(),
                                changeLog: [...(inv.changeLog || []), { timestamp: new Date().toISOString(), user: 'Auditor', action: 'Rechazada', from: inv.status, to: 'rejected', reason: REASONS[reason.trim()] || reason.trim() }]
                              });
                            }
                          }}
                            className="flex-1 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg text-[9px] font-bold uppercase tracking-wider hover:bg-red-100 transition-all">
                            Rechazar Factura
                          </button>
                          <button onClick={() => setViewingDocs({ title: `Respaldo - ${inv.id}`, docs: [] })}
                            className="flex-1 py-2 bg-white border border-brand-sand/40 rounded-lg text-[9px] font-bold uppercase tracking-wider text-brand-ink/60 hover:border-brand-gold transition-all flex items-center justify-center gap-1">
                            <Paperclip size={10} /> Adjuntar
                          </button>
                        </div>

                        {/* Change log */}
                        {inv.changeLog && inv.changeLog.length > 0 && (
                          <div className="p-2.5 bg-brand-bone/60 rounded-lg space-y-1">
                            <p className="text-[8px] font-bold uppercase tracking-widest text-brand-ink/30 flex items-center gap-1"><History size={9} /> Historial</p>
                            {inv.changeLog.slice(-3).map((log, li) => (
                              <p key={li} className="text-[8px] text-brand-ink/50">
                                <span className="font-bold">{log.user}</span> · {log.action}{log.reason ? ` — ${log.reason}` : ''} · <span className="opacity-40">{new Date(log.timestamp).toLocaleDateString('es-MX')}</span>
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </>
      )}

      <AnimatePresence>
        {complianceInv && (
          <ComplianceDetailModal
            inv={complianceInv}
            onClose={() => setComplianceInv(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAuthStatus && (
          <AuthorizationStatusModal
            onClose={() => setShowAuthStatus(null)}
            authorizations={(() => {
              const inv = invoices.find(i => i.id === showAuthStatus);
              const sigs = inv?.signatures || 0;
              const isGlobal = inv?.paymentType === 'PPD' || (inv?.amount || 0) >= 200000;
              const needsCeo = AuthorizerService.requiresCeoAuth(inv?.amount || 0, isGlobal);
              const ceo = AuthorizerService.getCeo();
              const standard = AuthorizerService.getStandard();

              if (needsCeo && ceo) {
                return [{ name: ceo.name, role: ceo.cargo, status: sigs >= 1 ? 'approved' : 'pending', dateSent: inv?.date || '', email: ceo.email, isCeo: true }];
              }
              if (standard.length > 0) {
                return standard.slice(0, 2).map((a, idx) => ({
                  name: a.name, role: a.cargo, status: sigs > idx ? 'approved' : 'pending', dateSent: inv?.date || '', email: a.email
                }));
              }
              return [{ name: 'Sin autorizador asignado', role: 'Automático', status: 'approved', dateSent: inv?.date || '' }];
            })()}
            invoiceId={showAuthStatus}
            onResend={(authItem) => {
              const inv = invoices.find(i => i.id === showAuthStatus);
              if (inv && authItem.email) {
                const priority = getPriorityInfo(inv.date).label;
                const subject = encodeURIComponent(`URGENTE: Aprobar Factura ${inv.id} - ${inv.provider}`);
                const body = encodeURIComponent(
                  `REQUERIMIENTO DE AUTORIZACIÓN\n\n` +
                  `Estimado ${authItem.name},\n\n` +
                  `Se solicita su aprobación para el pago de la siguiente factura auditada:\n\n` +
                  `• Factura: ${inv.id}\n` +
                  `• Proveedor: ${inv.provider}\n` +
                  `• Monto: ${CURRENCY_FORMATTER.format(inv.amount)}\n` +
                  `• Prioridad: ${priority}\n\n` +
                  `--------------------------------------------------\n` +
                  `[ CLICK AQUÍ PARA APROBAR PAGO ]\n` +
                  `--------------------------------------------------\n\n` +
                  `Atentamente,\nControl de Tesorería - Royáltica IA`
                );
                window.location.href = `mailto:${authItem.email}?subject=${subject}&body=${body}`;
              }
            }}
            onSign={() => {
              const inv = invoices.find(i => i.id === showAuthStatus);
              if (inv) {
                const currentSigs = inv.signatures || 0;
                const nextSigs = Math.min(2, currentSigs + 1);
                // Si llegamos a 2 firmas, nos aseguramos de que el estatus sea 'audited' para que dispare el movimiento
                onUpdateInvoice(inv.id, {
                  signatures: nextSigs,
                  status: nextSigs >= 2 ? 'audited' : inv.status
                });
                // Persiste la firma en el backend: asegura que la factura esté
                // AUDITED y registra la firma. El backend la aprueba sola al
                // alcanzar el número de autorizadores configurado. Cada usuario
                // firma una vez (2+ firmas requieren usuarios distintos).
                // Fire-and-forget + guarda de UUID: nunca rompe la UI local.
                if (isRealId(inv.id)) {
                  (async () => {
                    try {
                      await api.auditInvoice(inv.id).catch(() => {});
                      await api.signInvoice(inv.id);
                    } catch (err) {
                      console.warn('No se pudo persistir la firma:', (err as Error).message);
                    }
                  })();
                }
              }
            }}
          />
        )}
      </AnimatePresence>

      {/* Rejection reason modal */}
      <AnimatePresence>
        {rejectClarInvoice && (() => {
          const inv = rejectClarInvoice;
          const cl = ClarificationService.getByInvoice(inv.id).find(c => c.status === 'pending');
          const supplier = MOCK_SUPPLIERS.find(s => s.id === inv.providerId);
          return (
            <motion.div key="reject-clar-modal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[120] flex items-center justify-center p-6 bg-brand-ink/60 backdrop-blur-sm"
              onClick={() => { setRejectClarInvoice(null); setRejectReason(''); }}>
              <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
                className="bg-brand-paper rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-brand-sand/30"
                onClick={e => e.stopPropagation()}>
                <div className="p-5 border-b border-brand-sand/30">
                  <h3 className="text-base font-bold text-red-600 flex items-center gap-2" style={{ fontFamily: '"Playfair Display", serif' }}>
                    <AlertTriangle size={18} /> Rechazar Aclaración
                  </h3>
                  <p className="text-xs text-brand-ink/50 mt-1">{inv.id} — {supplier?.name || '---'}</p>
                </div>
                <div className="p-5 space-y-4">
                  {cl && (
                    <div className="p-3 bg-brand-bone rounded-xl border border-brand-sand/30">
                      <p className="text-[10px] font-bold uppercase text-brand-ink/40 tracking-wider mb-1">Aclaración del proveedor</p>
                      <p className="text-xs text-brand-ink/70">{cl.message}</p>
                      {cl.fileName && <p className="text-[10px] text-brand-gold mt-1 flex items-center gap-1"><FileText size={10} />{cl.fileName}</p>}
                    </div>
                  )}
                  <div>
                    <label className="text-xs font-bold text-brand-ink/60 block mb-2">Motivo del rechazo</label>
                    <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Explique por qué se rechaza y qué debe corregir el proveedor..."
                      className="w-full p-3 border border-brand-sand/30 rounded-xl text-xs bg-white/50 focus:border-red-400 focus:ring-1 focus:ring-red-300/30 transition-all resize-none" rows={4} />
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => { setRejectClarInvoice(null); setRejectReason(''); }}
                      className="flex-1 py-2.5 border border-brand-sand/40 rounded-xl text-xs font-bold text-brand-ink/60 hover:bg-brand-sand/20 transition-all">
                      Cancelar
                    </button>
                    <button disabled={!rejectReason.trim()} onClick={() => {
                      if (cl && supplier) {
                        ClarificationService.updateStatus(cl.id, 'rejected', rejectReason.trim());
                        SupplierMessageService.send(supplier.id, supplier.name, 'corporate', `La aclaración para la factura ${inv.id} fue rechazada.\n\nMotivo: ${rejectReason.trim()}\n\nFavor de corregir y re-enviar la aclaración en su portal.`);
                      }
                      setRejectClarInvoice(null);
                      setRejectReason('');
                    }} className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-700 transition-all disabled:opacity-30 flex items-center justify-center gap-2">
                      <X size={14} /> Rechazar y Enviar
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}


export function AuthorizationStatusModal({ 
  onClose, 
  authorizations,
  invoiceId,
  onSign,
  onResend
}: { 
  onClose: () => void, 
  authorizations: any[],
  invoiceId: string,
  onSign?: () => void,
  onResend?: (auth: any) => void
}) {
  const isFullyApproved = authorizations.every(a => a.status === 'approved');

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-brand-ink/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.95, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 10 }}
        className="max-w-md w-full bg-brand-paper rounded-[2.5rem] p-10 shadow-2xl relative overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="absolute top-0 left-0 w-full h-1.5 bg-brand-gold" />
        
        <header className="flex justify-between items-start mb-10">
          <div className="space-y-1">
            <span className="label-caps !text-brand-gold">Control de Firmas</span>
            <h3 className="text-2xl font-serif text-brand-ink">Estatus de Autorización</h3>
            <p className="text-[9px] uppercase tracking-widest text-brand-ink/30 font-bold">Expediente: {invoiceId}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-brand-bone rounded-full transition-colors opacity-30 hover:opacity-100">
            <LogOut size={18} className="rotate-90" />
          </button>
        </header>

        <div className="space-y-6">
          {authorizations.map((auth, idx) => (
            <div key={idx} className="flex items-center justify-between p-5 bg-brand-bone rounded-[1.5rem] border border-brand-sand/30">
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${auth.status === 'approved' ? 'bg-green-50 border-green-200 text-green-600' : 'bg-brand-paper border-brand-sand/50 text-brand-ink/20'}`}>
                  {auth.status === 'approved' ? <CheckCircle2 size={20} /> : <Clock size={18} />}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold text-brand-ink">{auth.name}</p>
                    <span className="text-[8px] uppercase tracking-tighter px-1.5 py-0.5 bg-brand-ink/5 rounded-md text-brand-ink/40 font-bold">{auth.role}</span>
                    {auth.isCeo && <span className="text-[7px] font-bold bg-brand-gold/20 text-brand-gold px-1.5 py-0.5 rounded-full uppercase tracking-wider">CEO · Pago Global</span>}
                  </div>
                  <p className="text-[10px] text-brand-ink/40 font-serif">Enviado: {auth.dateSent}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                {auth.status === 'approved' ? (
                  <span className="text-[9px] uppercase font-bold text-green-600 tracking-widest">Confirmado</span>
                ) : (
                  <div className="flex items-center gap-3">
                    <span className="text-[9px] uppercase font-bold text-brand-gold tracking-widest animate-pulse">Pendiente</span>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        onResend?.(auth);
                      }}
                      className="flex items-center gap-1.5 px-2 py-1 bg-brand-gold/10 text-brand-gold rounded-lg hover:bg-brand-gold hover:text-brand-ink transition-all group/resend"
                    >
                      <Send size={10} className="group-hover/resend:translate-x-0.5 group-hover/resend:-translate-y-0.5 transition-transform" />
                      <span className="text-[8px] font-black uppercase tracking-tighter">Reenviar</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 pt-8 border-t border-brand-sand/50 space-y-3">
          {!isFullyApproved && onSign && (
            <button 
              onClick={() => {
                onSign();
                onClose();
              }}
              className="w-full btn-primary !bg-brand-gold !text-brand-ink flex items-center justify-center gap-3 group relative overflow-hidden"
            >
              <ShieldCheck size={18} />
              <span>Autorizar como Tesorería</span>
            </button>
          )}

          <button 
            onClick={() => {
              // Simulación de reenvío
              onClose();
            }}
            className="w-full btn-primary !bg-brand-ink flex items-center justify-center gap-3 group relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-red-600/10 -translate-x-full group-hover:translate-x-0 transition-transform duration-500" />
            <span className="relative z-10">Reenviar Notificaciones</span>
            <span className="relative z-10 px-2 py-0.5 bg-red-600 text-[8px] rounded uppercase tracking-tighter">Recordatorio</span>
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export function AuditLogItem({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
      <span className="text-[9px] opacity-60 uppercase tracking-widest">{label}</span>
    </div>
  );
}

