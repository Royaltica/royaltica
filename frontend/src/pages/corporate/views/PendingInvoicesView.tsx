import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShieldCheck, CheckCircle2, LogOut, ChevronRight, Search, Clock, FileText, X, Send,
  Calendar, AlertTriangle, MessageSquare, StickyNote, History, Ban, Paperclip, DollarSign,
  Eye, RefreshCw, Shield,
} from 'lucide-react';
import { MOCK_SUPPLIERS, type Invoice, type Supplier } from '../../../types.ts';
import { api } from '../../../services/apiClient.ts';
import { ClarificationService, SupplierMessageService } from '../../../services/mockServices.ts';
import { CURRENCY_FORMATTER, getPriorityInfo, getComplianceChecks, type ComplianceCheckStatus } from '../../../utils/format.ts';
import { SchedulePaymentModal } from '../../provider/ProviderDashboard.tsx';

/**
 * Badge de riesgo fiscal por factura: CFDI cancelado ante el SAT (único
 * chequeo que es propiedad de la factura). La verificación 69-B es del
 * proveedor y se muestra en su expediente, no aquí. No renderiza nada si el
 * CFDI está vigente, para no ensuciar las filas sanas.
 */
export function SatRiskBadges({ inv }: { inv: Invoice }) {
  if (inv.satStatus !== 'Cancelado') return null;
  return (
    <span title="El SAT reporta este CFDI como cancelado."
      className="text-[7px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-red-600 text-white">
      SAT: CANCELADA
    </span>
  );
}


/**
 * Badge de verificación SAT a nivel PROVEEDOR: RFC en lista negra 69-B
 * (EFOS/EDOS) y validez del RFC. Se calcula una vez por proveedor (su RFC no
 * cambia), no por factura. `compact` muestra solo el estado crítico.
 */
export function SupplierSatBadge({ supplier, compact }: { supplier: Supplier; compact?: boolean }) {
  const sat = supplier.sat69b;
  if (!sat) return null;
  if (sat.listed) {
    return (
      <span title={`RFC en lista 69-B del SAT (${sat.status}). Riesgo fiscal: la deducción de sus facturas podría no ser procedente.`}
        className="text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200 inline-flex items-center gap-1">
        <AlertTriangle size={9} /> Lista 69-B · {sat.status === 'DEFINITIVO' ? 'Definitivo' : 'Presunto'}
      </span>
    );
  }
  if (compact) return null;
  return (
    <span title="RFC con formato válido y fuera de la lista negra 69-B del SAT."
      className="text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200 inline-flex items-center gap-1">
      <ShieldCheck size={9} /> SAT verificado
    </span>
  );
}


const COMPLIANCE_STYLES: Record<ComplianceCheckStatus, { ring: string; dot: string; icon: React.ReactNode; tag: string }> = {
  ok: { ring: 'border-green-200 bg-green-50/60', dot: 'bg-green-500 text-white', icon: <CheckCircle2 size={12} />, tag: 'text-green-700' },
  fail: { ring: 'border-red-200 bg-red-50', dot: 'bg-red-500 text-white', icon: <Ban size={12} />, tag: 'text-red-700' },
  warn: { ring: 'border-amber-200 bg-amber-50', dot: 'bg-amber-400 text-white', icon: <AlertTriangle size={12} />, tag: 'text-amber-700' },
  pending: { ring: 'border-brand-sand/40 bg-brand-bone/50', dot: 'bg-brand-sand/50 text-brand-ink/40', icon: <Clock size={12} />, tag: 'text-brand-ink/40' },
};

/**
 * Mini-ventana con el detalle de verificación de una factura. En validadas
 * muestra el CFDI verificado ante el SAT; en pendientes añade la sección de
 * auditoría documental que explica qué discrepancia no está aprobando.
 * Reutiliza los datos reales del backend (satStatus por consulta SOAP).
 */
export function ComplianceDetailModal({ inv, onClose }: { inv: Invoice; onClose: () => void }) {
  const checks = getComplianceChecks(inv);
  const hasIssue = inv.forensicStatus === 'BLOCKED' || inv.forensicStatus === 'DISCREPANCY';
  return (
    <motion.div key="compliance-modal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[120] flex items-center justify-center p-6 bg-brand-ink/60 backdrop-blur-sm"
      onClick={onClose}>
      <motion.div initial={{ scale: 0.92, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 20 }}
        className="bg-brand-paper rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-brand-sand/30"
        onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-5 border-b border-brand-sand/30 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${hasIssue ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
              <ShieldCheck size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-brand-ink" style={{ fontFamily: '"Playfair Display", serif' }}>
                Verificación de Cumplimiento SAT
              </h3>
              <p className="text-[11px] text-brand-ink/50 mt-0.5">{inv.id} · {inv.provider}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-brand-sand/30 transition-colors text-brand-ink/40">
            <X size={16} />
          </button>
        </div>

        {/* Verificaciones SAT */}
        <div className="p-5 space-y-3 max-h-[60vh] overflow-y-auto scrollbar-custom">
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-brand-ink/40">Verificaciones en tiempo real</p>
          {checks.map((c, i) => {
            const s = COMPLIANCE_STYLES[c.status];
            return (
              <div key={i} className={`p-3 rounded-xl border ${s.ring}`}>
                <div className="flex items-center gap-2.5 mb-1">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${s.dot}`}>{s.icon}</div>
                  <span className="text-xs font-bold text-brand-ink flex-1">{c.label}</span>
                  <span className={`text-[8px] font-black uppercase tracking-wider ${s.tag}`}>
                    {c.status === 'ok' ? 'Aprobado' : c.status === 'fail' ? 'Rechazado' : c.status === 'warn' ? 'Revisar' : 'Pendiente'}
                  </span>
                </div>
                <p className="text-[11px] text-brand-ink/60 leading-relaxed pl-[34px]">{c.detail}</p>
              </div>
            );
          })}

          {/* Detalle documental / forense (lo que no está aprobando) */}
          {hasIssue && (
            <>
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-brand-ink/40 pt-2">Auditoría documental</p>
              <div className="p-3 rounded-xl border border-red-200 bg-red-50">
                <div className="flex items-center gap-2.5 mb-1">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 bg-red-500 text-white">
                    <FileText size={12} />
                  </div>
                  <span className="text-xs font-bold text-brand-ink flex-1">
                    {inv.forensicStatus === 'BLOCKED' ? 'Factura bloqueada' : 'Discrepancia detectada'}
                  </span>
                </div>
                <p className="text-[11px] text-brand-ink/70 leading-relaxed pl-[34px]">
                  {inv.auditAnalysis || 'Se detectó una inconsistencia en la validación documental (orden de compra, precios o integridad).'}
                </p>
              </div>
              {inv.forensicSolution && (
                <div className="p-3 bg-brand-ink rounded-xl text-brand-paper">
                  <p className="text-[9px] font-bold text-brand-gold mb-1 uppercase tracking-wider">Acción requerida</p>
                  <p className="text-[11px] opacity-80 leading-relaxed">{inv.forensicSolution}</p>
                </div>
              )}
            </>
          )}

          {inv.satVerifiedAt && (
            <p className="text-[9px] text-brand-ink/30 pt-1 flex items-center gap-1">
              <Clock size={9} /> Última verificación SAT: {new Date(inv.satVerifiedAt).toLocaleString('es-MX')}
            </p>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}


export function PendingInvoicesView({ invoices, totalBudget, onAuditRequest, onBatchProcess, onUpdateInvoice }: { invoices: Invoice[], totalBudget: number, onAuditRequest: (inv: Invoice) => void, onBatchProcess?: (ids: string[]) => Promise<void>, onUpdateInvoice?: (id: string, updates: Partial<Invoice>) => void }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragMode, setDragMode] = useState<'select' | 'deselect'>('select');
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);
  const [showScheduler, setShowScheduler] = useState(false);
  const [viewMode, setViewMode] = useState<'pending' | 'paid' | 'calendar'>('pending');
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [showCashSimulator, setShowCashSimulator] = useState(false);
  const [partialPayInvoice, setPartialPayInvoice] = useState<string | null>(null);
  const [partialAmount, setPartialAmount] = useState('');
  const [reviewClarInvoiceId, setReviewClarInvoiceId] = useState<string | null>(null);
  const [msgInvoice, setMsgInvoice] = useState<Invoice | null>(null);
  const [msgText, setMsgText] = useState('');
  const [msgSent, setMsgSent] = useState(false);
  const [, setClarTick] = useState(0);
  const [, setMsgTick] = useState(0);

  useEffect(() => {
    const cb = () => setClarTick(t => t + 1);
    ClarificationService.subscribe(cb);
    return () => ClarificationService.unsubscribe(cb);
  }, []);

  useEffect(() => {
    const cb = () => setMsgTick(t => t + 1);
    SupplierMessageService.subscribe(cb);
    return () => SupplierMessageService.unsubscribe(cb);
  }, []);

  // Pre-built message templates
  const getMessageTemplates = (inv: Invoice) => {
    const templates: { label: string; text: string }[] = [];
    if (inv.forensicStatus === 'DISCREPANCY') {
      templates.push({
        label: 'Solicitar aclaración',
        text: `Estimado proveedor, la factura ${inv.id} por ${CURRENCY_FORMATTER.format(inv.amount)} presenta una discrepancia en la auditoría: "${inv.auditAnalysis || 'Hallazgo pendiente de detalle'}". Favor de enviar la documentación de soporte o aclaración correspondiente a través de su portal (Facturas → Aclarar). Quedo atento.`
      });
    }
    if (inv.forensicStatus === 'BLOCKED') {
      templates.push({
        label: 'Factura bloqueada',
        text: `Estimado proveedor, la factura ${inv.id} fue bloqueada por el siguiente motivo: "${inv.auditAnalysis || 'Documento duplicado o irregular'}". Por favor revise y envíe la factura corregida o la documentación que aclare la situación. Sin este paso no es posible procesar el pago.`
      });
    }
    templates.push({
      label: 'Solicitar XML/PDF',
      text: `Estimado proveedor, requerimos el archivo XML y/o PDF de la factura ${inv.id} por ${CURRENCY_FORMATTER.format(inv.amount)} para completar la validación fiscal. Favor de subirlo en su portal en la sección de Facturas. Gracias.`
    });
    templates.push({
      label: 'Confirmar datos bancarios',
      text: `Estimado proveedor, antes de procesar el pago de la factura ${inv.id} por ${CURRENCY_FORMATTER.format(inv.amount)}, necesitamos confirmar que sus datos bancarios (CLABE) estén actualizados en su perfil del portal. Favor de verificar y confirmar. Saludos.`
    });
    templates.push({
      label: 'Solicitar nota de crédito',
      text: `Estimado proveedor, se requiere una nota de crédito asociada a la factura ${inv.id} para ajustar la diferencia detectada. Favor de emitirla y subirla como aclaración en su portal. Quedamos atentos.`
    });
    return templates;
  };

  useEffect(() => {
    const handleGlobalMouseUp = () => setIsDragging(false);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, []);

  const pendingInvoices = invoices
    .filter(inv => inv.status === 'pending')
    .filter(inv => {
      const matchesSearch = inv.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           inv.provider.toLowerCase().includes(searchTerm.toLowerCase());
      const priority = getPriorityInfo(inv.date).label;
      const matchesPriority = priorityFilter === 'all' || priority === priorityFilter;
      return matchesSearch && matchesPriority;
    })
    .sort((a, b) => {
      const aClar = ClarificationService.hasClari(a.id) ? 1 : 0;
      const bClar = ClarificationService.hasClari(b.id) ? 1 : 0;
      if (aClar !== bClar) return bClar - aClar; // clarified first
      return getPriorityInfo(b.date).score - getPriorityInfo(a.date).score;
    });

  const pendingClarCount = pendingInvoices.filter(inv => ClarificationService.hasClari(inv.id)).length;

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(new Set(pendingInvoices.map(i => i.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelect = (id: string, checked: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleRowMouseDown = (id: string, e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    const mode = selectedIds.has(id) ? 'deselect' : 'select';
    setDragMode(mode);
    handleSelect(id, mode === 'select');
    e.preventDefault();
  };

  const handleRowMouseEnter = (id: string) => {
    if (isDragging) {
      handleSelect(id, dragMode === 'select');
    }
  };

  const handleBatch = async () => {
    if (!onBatchProcess) return;
    setIsProcessing(true);
    await onBatchProcess(Array.from(selectedIds));
    setSelectedIds(new Set());
    setIsProcessing(false);
  };

  return (
    <div className="flex flex-col pb-12">
       <header className="mb-6 flex-shrink-0">
          <span className="label-caps mb-2 block">Tesorería Central</span>
          <h2 className="text-4xl mb-4 font-serif text-brand-ink">Facturas por Pagar</h2>
          <div className="flex gap-3 max-w-2xl">
            {selectedIds.size > 0 && (
              <div className="flex gap-2">
                <button
                  onClick={() => setShowScheduler(true)}
                  className="px-6 py-2.5 bg-brand-ink text-brand-paper rounded-xl text-[10px] uppercase font-bold tracking-[0.2em] shadow-sm hover:scale-105 transition-transform flex items-center gap-2 whitespace-nowrap"
                >
                  <Calendar size={14} /> Programar Pago ({selectedIds.size})
                </button>
                <button 
                  onClick={handleBatch}
                  disabled={isProcessing}
                  className="px-6 py-2.5 bg-brand-gold text-brand-ink rounded-xl text-[10px] uppercase font-bold tracking-[0.2em] shadow-sm hover:scale-105 transition-transform flex items-center gap-2 whitespace-nowrap"
                >
                  {isProcessing ? (
                    <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }} className="w-3 h-3 border-2 border-brand-ink/30 border-t-brand-ink rounded-full" />
                  ) : <CheckCircle2 size={14} />}
                  Validar y Pagar ({selectedIds.size})
                </button>
                <button 
                  onClick={() => setSelectedIds(new Set())}
                  disabled={isProcessing}
                  className="px-4 py-2.5 bg-brand-sand/30 text-brand-ink rounded-xl text-[10px] uppercase font-bold tracking-[0.2em] hover:bg-brand-sand transition-colors"
                >
                  Cancelar
                </button>
              </div>
            )}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 opacity-30 text-brand-ink" size={16} />
              <input 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Buscar por ID o Proveedor..."
                className="w-full pl-10 pr-4 py-2.5 bg-brand-cream border border-brand-sand rounded-xl text-sm focus:outline-none focus:border-brand-gold shadow-sm"
              />
            </div>
            <select 
              value={priorityFilter}
              onChange={e => setPriorityFilter(e.target.value)}
              className="px-4 py-2.5 bg-brand-cream border border-brand-sand rounded-xl text-[10px] uppercase font-bold tracking-[0.2em] shadow-sm cursor-pointer outline-none focus:border-brand-gold"
            >
              <option value="all">Todas las Prioridades</option>
              <option value="Baja">Baja</option>
              <option value="Media">Media</option>
              <option value="Media Alta">Media Alta</option>
              <option value="Urgente">Urgente</option>
            </select>
          </div>

          {/* View mode tabs + Cash Simulator toggle */}
          <div className="flex items-center justify-between mt-4">
            <div className="bg-brand-bone/80 p-1 rounded-full border border-brand-sand/50 shadow-sm flex gap-1">
              {([['pending', 'Pendientes'], ['paid', 'Pagadas'], ['calendar', 'Calendario']] as const).map(([mode, label]) => (
                <button key={mode} onClick={() => setViewMode(mode)}
                  className={`px-5 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all ${viewMode === mode ? 'bg-brand-ink text-brand-bone shadow-md' : 'text-brand-ink/40 hover:text-brand-ink'}`}>
                  {label}
                </button>
              ))}
            </div>
            <button onClick={() => setShowCashSimulator(!showCashSimulator)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border ${showCashSimulator ? 'bg-brand-gold text-brand-ink border-brand-gold' : 'bg-white border-brand-sand/40 text-brand-ink/50 hover:border-brand-gold'}`}>
              <DollarSign size={12} /> Simulador de Caja
            </button>
          </div>
       </header>

       {/* ─── Cash Impact Simulator ─── */}
       <AnimatePresence>
         {showCashSimulator && selectedIds.size > 0 && (
           <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
             className="mb-4 flex-shrink-0 overflow-hidden">
             <div className="editorial-card !p-5 border-brand-gold/30 bg-brand-gold/5 space-y-3">
               <div className="flex items-center gap-2">
                 <DollarSign size={16} className="text-brand-gold" />
                 <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-ink/60">Simulador de Impacto en Caja</span>
               </div>
               {(() => {
                 const selected = pendingInvoices.filter(i => selectedIds.has(i.id));
                 const selectedTotal = selected.reduce((s, i) => s + i.amount, 0);
                 const currentCash = totalBudget * 0.6; // mock current treasury
                 const afterPayment = currentCash - selectedTotal;
                 const allPending = invoices.filter(i => i.status === 'pending').reduce((s, i) => s + i.amount, 0);
                 const remainingPending = allPending - selectedTotal;
                 const daysOfCoverage = afterPayment > 0 ? Math.round(afterPayment / (allPending / 30)) : 0;
                 const isRisky = afterPayment < currentCash * 0.2;
                 return (
                   <div className="grid grid-cols-4 gap-4">
                     <div className="space-y-1">
                       <p className="text-[9px] uppercase tracking-wider text-brand-ink/30">Caja Actual</p>
                       <p className="text-lg font-serif text-brand-ink">{CURRENCY_FORMATTER.format(currentCash)}</p>
                     </div>
                     <div className="space-y-1">
                       <p className="text-[9px] uppercase tracking-wider text-brand-ink/30">Pago Seleccionado</p>
                       <p className="text-lg font-serif text-red-600">-{CURRENCY_FORMATTER.format(selectedTotal)}</p>
                     </div>
                     <div className="space-y-1">
                       <p className="text-[9px] uppercase tracking-wider text-brand-ink/30">Caja Después</p>
                       <p className={`text-lg font-serif ${isRisky ? 'text-red-600' : 'text-green-600'}`}>{CURRENCY_FORMATTER.format(Math.max(afterPayment, 0))}</p>
                       {isRisky && <p className="text-[8px] text-red-500 font-bold">⚠️ Liquidez baja</p>}
                     </div>
                     <div className="space-y-1">
                       <p className="text-[9px] uppercase tracking-wider text-brand-ink/30">Cobertura</p>
                       <p className="text-lg font-serif text-brand-ink">{daysOfCoverage} días</p>
                       <p className="text-[8px] text-brand-ink/30">para cubrir pendientes restantes</p>
                     </div>
                   </div>
                 );
               })()}
             </div>
           </motion.div>
         )}
       </AnimatePresence>

       {/* ─── Calendar View ─── */}
       {viewMode === 'calendar' && (
         <div className="editorial-card !p-6 space-y-4">
           <p className="text-[10px] uppercase tracking-widest font-bold text-brand-ink/30">Calendario de pagos · Abril-Mayo 2024</p>
           <div className="grid grid-cols-7 gap-2">
             {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d => (
               <div key={d} className="text-center text-[8px] uppercase tracking-widest font-bold text-brand-ink/20 py-1">{d}</div>
             ))}
             {Array.from({ length: 35 }, (_, i) => {
               const day = i - 1; // April starts on Tuesday (offset 1)
               const dateNum = day + 1;
               const isValidDay = dateNum >= 1 && dateNum <= 30;
               const dateStr = isValidDay ? `2024-04-${String(dateNum).padStart(2, '0')}` : '';
               const dayInvoices = isValidDay ? invoices.filter(inv =>
                 (inv.status !== 'paid' && inv.status !== 'rejected' && inv.date === dateStr) ||
                 (inv.scheduledPayDate === dateStr)
               ) : [];
               const paidToday = isValidDay ? invoices.filter(inv => inv.paidDate === dateStr) : [];
               const total = dayInvoices.reduce((s, inv) => s + inv.amount, 0);
               const hasItems = dayInvoices.length > 0 || paidToday.length > 0;
               return (
                 <div key={i} className={`rounded-xl p-2 min-h-[70px] border transition-all ${
                   isValidDay ? (hasItems ? 'border-brand-gold/30 bg-brand-gold/5' : 'border-brand-sand/20 bg-white/30') : 'border-transparent opacity-20'
                 }`}>
                   {isValidDay && (
                     <>
                       <p className={`text-[10px] font-bold ${hasItems ? 'text-brand-ink' : 'text-brand-ink/20'}`}>{dateNum}</p>
                       {dayInvoices.slice(0, 2).map(inv => (
                         <div key={inv.id} className="mt-1 px-1.5 py-0.5 bg-orange-100 rounded text-[6px] text-orange-700 font-bold truncate">{inv.id}</div>
                       ))}
                       {paidToday.slice(0, 1).map(inv => (
                         <div key={inv.id} className="mt-1 px-1.5 py-0.5 bg-green-100 rounded text-[6px] text-green-700 font-bold truncate">✓ {inv.id}</div>
                       ))}
                       {dayInvoices.length > 2 && <p className="text-[6px] text-brand-ink/30 mt-0.5">+{dayInvoices.length - 2} más</p>}
                       {total > 0 && <p className="text-[7px] font-bold text-brand-gold mt-1">${(total / 1000).toFixed(0)}k</p>}
                     </>
                   )}
                 </div>
               );
             })}
           </div>
           <div className="flex gap-4 pt-2">
             <div className="flex items-center gap-2"><div className="w-3 h-2 bg-orange-100 rounded" /><span className="text-[8px] text-brand-ink/40">Pendiente</span></div>
             <div className="flex items-center gap-2"><div className="w-3 h-2 bg-green-100 rounded" /><span className="text-[8px] text-brand-ink/40">Pagada</span></div>
           </div>
         </div>
       )}

       {/* ─── Paid History View ─── */}
       {viewMode === 'paid' && (
         <div className="editorial-card !p-0 overflow-hidden shadow-xl shadow-brand-sand/30 flex flex-col border border-brand-sand/50">
           <div className="scrollbar-thin scrollbar-thumb-brand-sand">
             <table className="w-full text-left border-separate border-spacing-0">
               <thead className="bg-brand-sand/10 border-b border-brand-sand sticky top-0 z-10 backdrop-blur-md">
                 <tr>
                   <th className="px-6 py-4 label-caps !opacity-40 border-b border-brand-sand">Factura</th>
                   <th className="px-6 py-4 label-caps !opacity-40 border-b border-brand-sand">Proveedor</th>
                   <th className="px-6 py-4 label-caps !opacity-40 border-b border-brand-sand">Monto</th>
                   <th className="px-6 py-4 label-caps !opacity-40 border-b border-brand-sand">Método</th>
                   <th className="px-6 py-4 label-caps !opacity-40 border-b border-brand-sand">Score</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-brand-sand/20">
                 {invoices.filter(i => i.status === 'paid').sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(inv => (
                   <tr key={inv.id} className="hover:bg-green-50/30 transition-all">
                     <td className="px-6 py-4"><span className="text-sm font-bold text-brand-ink">{inv.id}</span><br/><span className="text-[9px] text-brand-ink/30">{inv.date}</span></td>
                     <td className="px-6 py-4 text-sm text-brand-ink/70">{inv.provider}</td>
                     <td className="px-6 py-4 font-bold text-brand-ink">
                       {CURRENCY_FORMATTER.format(inv.paidAmount || inv.amount)}
                       {inv.paidAmount && inv.paidAmount < inv.amount && <span className="text-[8px] text-orange-500 ml-1">(parcial)</span>}
                     </td>
                     <td className="px-6 py-4"><span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded-full ${inv.paymentRoute === 'fintech' ? 'bg-brand-gold/20 text-brand-gold' : 'bg-green-100 text-green-700'}`}>{inv.paymentRoute || 'cash'}</span></td>
                     <td className="px-6 py-4"><span className="text-sm font-serif text-brand-ink">{inv.auditScore || '—'}</span></td>
                   </tr>
                 ))}
                 {invoices.filter(i => i.status === 'paid').length === 0 && (
                   <tr><td colSpan={5} className="px-6 py-12 text-center text-brand-ink/30 text-sm">Sin pagos realizados.</td></tr>
                 )}
               </tbody>
             </table>
           </div>
         </div>
       )}

       {/* ─── Pending View (Original Table) ─── */}
       {viewMode === 'pending' && (
       <div className="space-y-4">
       <div className="editorial-card !p-0 overflow-hidden shadow-xl shadow-brand-sand/30 flex flex-col border border-brand-sand/50">
          <div className="scrollbar-thin scrollbar-thumb-brand-sand scrollbar-track-transparent">
            <table className="w-full text-left border-separate border-spacing-0">
              <thead className="bg-brand-sand/10 border-b border-brand-sand sticky top-0 z-10 backdrop-blur-md">
                <tr>
                  <th className="px-6 py-4 w-12 border-b border-brand-sand">
                    <input
                      type="checkbox"
                      className="accent-brand-gold w-4 h-4 cursor-pointer"
                      checked={pendingInvoices.length > 0 && selectedIds.size === pendingInvoices.length}
                      onChange={handleSelectAll}
                    />
                  </th>
                  <th className="px-6 py-4 label-caps !opacity-40 border-b border-brand-sand">Prioridad</th>
                  <th className="px-6 py-4 label-caps !opacity-40 border-b border-brand-sand">Detalle Factura</th>
                  <th className="px-6 py-4 label-caps !opacity-40 border-b border-brand-sand">Monto</th>
                  <th className="px-6 py-4 label-caps !opacity-40 border-b border-brand-sand">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-sand/20">
                {pendingInvoices.map(inv => {
                  const priority = getPriorityInfo(inv.date);
                  const hasClar = ClarificationService.hasClari(inv.id);
                  const clarList = hasClar ? ClarificationService.getByInvoice(inv.id) : [];
                  const latestClar = clarList[0];
                  return (
                    <tr
                      key={inv.id}
                      className={`hover:bg-brand-gold/5 transition-all group select-none ${hasClar ? 'bg-amber-50/50' : ''}`}
                      onMouseDown={(e) => handleRowMouseDown(inv.id, e)}
                      onMouseEnter={() => handleRowMouseEnter(inv.id)}
                    >
                      <td className="px-6 py-4">
                        <input 
                          type="checkbox" 
                          className="accent-brand-gold w-4 h-4 cursor-pointer"
                          checked={selectedIds.has(inv.id)}
                          onChange={e => handleSelect(inv.id, e.target.checked)}
                        />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                           <div className={`w-3 h-3 rounded-full ${priority.color} shadow-sm shadow-brand-sand`} />
                           <span className={`text-[10px] font-bold uppercase tracking-wider ${priority.text}`}>
                             {priority.label}
                           </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div 
                          className="flex flex-col cursor-pointer hover:opacity-70 transition-opacity"
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => { e.stopPropagation(); setViewingInvoice(inv); }}
                        >
                           <div className="flex items-center gap-2">
                             <span className="text-sm font-bold text-brand-ink hover:underline">{inv.id}</span>
                             <SatRiskBadges inv={inv} />
                           </div>
                           <span className="text-[10px] text-brand-ink/40 uppercase font-serif">{inv.provider}</span>
                           <span className="text-[9px] opacity-30 mt-1">Subida el: {inv.date}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-bold text-brand-ink tracking-tight">
                          {CURRENCY_FORMATTER.format(inv.amount)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col items-end gap-1.5">
                          <div className="flex gap-1.5">
                            <button
                              onMouseDown={e => e.stopPropagation()}
                              onClick={() => onAuditRequest(inv)}
                              className="px-3 py-1.5 bg-brand-ink text-brand-paper rounded-lg text-[8px] uppercase font-bold tracking-widest hover:bg-brand-gold hover:text-brand-ink transition-all"
                            >
                              Validar
                            </button>
                          </div>
                          {/* Note button */}
                          <button
                            onMouseDown={e => e.stopPropagation()}
                            onClick={(e) => { e.stopPropagation(); setEditingNote(editingNote === inv.id ? null : inv.id); setNoteText(inv.notes || ''); }}
                            className={`flex items-center gap-1 text-[7px] uppercase tracking-widest transition-all ${inv.notes ? 'text-brand-gold font-bold' : 'text-brand-ink/20 hover:text-brand-ink/50'}`}
                          >
                            <StickyNote size={8} /> {inv.notes ? 'Nota ✓' : '+ Nota'}
                          </button>
                          {/* Note editor */}
                          {editingNote === inv.id && (
                            <div className="flex gap-1 items-center w-full" onMouseDown={e => e.stopPropagation()}>
                              <input
                                value={noteText}
                                onChange={e => setNoteText(e.target.value)}
                                placeholder="Nota interna..."
                                className="flex-1 px-2 py-1 border border-brand-sand/40 rounded-lg text-[9px] outline-none focus:border-brand-gold"
                                onKeyDown={e => {
                                  if (e.key === 'Enter' && onUpdateInvoice) {
                                    onUpdateInvoice(inv.id, { notes: noteText });
                                    setEditingNote(null);
                                  }
                                }}
                              />
                              <button onClick={() => { if (onUpdateInvoice) { onUpdateInvoice(inv.id, { notes: noteText }); setEditingNote(null); } }}
                                className="px-2 py-1 bg-brand-gold text-brand-ink rounded-lg text-[8px] font-bold">✓</button>
                            </div>
                          )}
                          {inv.notes && editingNote !== inv.id && (
                            <p className="text-[7px] text-brand-ink/30 max-w-[140px] truncate" title={inv.notes}>📝 {inv.notes}</p>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {pendingInvoices.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-xs opacity-40 font-serif">
                       No hay facturas pendientes con los criterios seleccionados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
       </div>
       </div>
       )}

       <AnimatePresence>
         {viewingInvoice && (
           <InvoiceDetailModal invoice={viewingInvoice} onClose={() => setViewingInvoice(null)} />
         )}
         {showScheduler && (
           <SchedulePaymentModal
             onClose={() => {
               setShowScheduler(false);
               setSelectedIds(new Set());
             }}
           />
         )}
         {reviewClarInvoiceId && (() => {
           const inv = invoices.find(i => i.id === reviewClarInvoiceId);
           const clars = ClarificationService.getByInvoice(reviewClarInvoiceId);
           if (!inv || clars.length === 0) return null;
           return (
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
               className="fixed inset-0 z-[200] bg-brand-ink/40 backdrop-blur-sm flex items-center justify-center p-6"
               onClick={() => setReviewClarInvoiceId(null)}>
               <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
                 onClick={e => e.stopPropagation()} className="bg-white rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col" style={{ maxHeight: '85vh' }}>
                 {/* Header */}
                 <div className="px-7 py-5 bg-brand-ink text-brand-paper flex items-center justify-between flex-shrink-0">
                   <div>
                     <p className="text-[11px] font-bold flex items-center gap-2">
                       <MessageSquare size={14} className="text-amber-400" />
                       Aclaración — {inv.id}
                     </p>
                     <p className="text-[9px] text-brand-paper/40">{inv.provider} · {CURRENCY_FORMATTER.format(inv.amount)}</p>
                   </div>
                   <button onClick={() => setReviewClarInvoiceId(null)}><X size={16} className="text-brand-paper/40 hover:text-brand-paper" /></button>
                 </div>

                 <div className="flex-1 overflow-y-auto">
                   {/* Original issue */}
                   {inv.auditAnalysis && (
                     <div className="px-7 py-4 bg-red-50 border-b border-red-100">
                       <p className="text-[8px] font-bold text-red-700 uppercase tracking-wider mb-1">Hallazgo Original de Auditoría</p>
                       <p className="text-[10px] text-red-800">{inv.auditAnalysis}</p>
                       {inv.forensicSolution && <p className="text-[9px] text-red-600 mt-1 italic">Solución: {inv.forensicSolution}</p>}
                     </div>
                   )}

                   {/* Clarifications timeline */}
                   <div className="px-7 py-5 space-y-4">
                     <p className="text-[8px] font-bold text-brand-ink/40 uppercase tracking-wider">Aclaraciones del Proveedor</p>
                     {clars.map(clar => (
                       <div key={clar.id} className="border border-brand-sand/30 rounded-2xl overflow-hidden">
                         <div className="px-5 py-3 bg-brand-bone/50 flex items-center justify-between">
                           <div className="flex items-center gap-2">
                             <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${clar.supplierName}`} alt="" className="w-6 h-6 rounded-lg" />
                             <div>
                               <p className="text-[10px] font-bold text-brand-ink">{clar.supplierName}</p>
                               <p className="text-[7px] text-brand-ink/30">
                                 {new Date(clar.date).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })} · {new Date(clar.date).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                               </p>
                             </div>
                           </div>
                           <span className={`px-2 py-0.5 rounded-full text-[7px] font-bold uppercase tracking-wider ${
                             clar.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                             clar.status === 'accepted' ? 'bg-green-100 text-green-700' :
                             clar.status === 'rejected' ? 'bg-red-100 text-red-700' :
                             'bg-blue-100 text-blue-700'
                           }`}>{clar.status === 'pending' ? 'Pendiente' : clar.status === 'accepted' ? 'Aceptada' : clar.status === 'rejected' ? 'Rechazada' : 'Revisada'}</span>
                         </div>
                         <div className="px-5 py-4 space-y-3">
                           <p className="text-[10px] text-brand-ink/70 leading-relaxed">{clar.message}</p>
                           {clar.fileName && (
                             <div className="flex items-center gap-2 px-3 py-2 bg-brand-bone rounded-xl border border-brand-sand/20">
                               <div className="w-8 h-8 rounded-lg bg-brand-gold/10 flex items-center justify-center flex-shrink-0">
                                 {clar.fileName.endsWith('.pdf') ? <FileText size={14} className="text-red-500" /> :
                                  clar.fileName.endsWith('.xml') ? <FileText size={14} className="text-blue-500" /> :
                                  <Paperclip size={14} className="text-brand-ink/40" />}
                               </div>
                               <div className="flex-1 min-w-0">
                                 <p className="text-[9px] font-bold text-brand-ink truncate">{clar.fileName}</p>
                                 <p className="text-[7px] text-brand-ink/30">{clar.fileType || 'Documento adjunto'}</p>
                               </div>
                               <button className="px-2 py-1 bg-brand-ink/5 rounded-lg text-[7px] font-bold text-brand-ink/50 hover:bg-brand-ink/10 transition-all flex items-center gap-1">
                                 <Eye size={8} /> Ver
                               </button>
                             </div>
                           )}
                         </div>
                       </div>
                     ))}
                   </div>
                 </div>

                 {/* Action buttons */}
                 <div className="px-7 py-4 border-t border-brand-sand/20 flex gap-3 flex-shrink-0">
                   <button onClick={() => {
                     clars.forEach(c => { if (c.status === 'pending') ClarificationService.updateStatus(c.id, 'accepted'); });
                     const s = MOCK_SUPPLIERS.find(x => x.id === inv.providerId);
                     if (s) SupplierMessageService.send(s.id, s.name, 'corporate', `La aclaración para la factura ${inv.id} fue aceptada. La factura será re-procesada para validación. Gracias por su respuesta.`);
                     setReviewClarInvoiceId(null);
                   }}
                     className="flex-1 py-3 bg-green-600 text-white rounded-xl text-[9px] font-bold uppercase tracking-wider hover:bg-green-700 transition-all flex items-center justify-center gap-2">
                     <CheckCircle2 size={12} /> Aceptar Aclaración
                   </button>
                   <button onClick={() => {
                     onAuditRequest(inv);
                     setReviewClarInvoiceId(null);
                   }}
                     className="flex-1 py-3 bg-brand-ink text-brand-paper rounded-xl text-[9px] font-bold uppercase tracking-wider hover:bg-brand-gold hover:text-brand-ink transition-all flex items-center justify-center gap-2">
                     <RefreshCw size={12} /> Re-auditar con IA
                   </button>
                   <button onClick={() => {
                     clars.forEach(c => { if (c.status === 'pending') ClarificationService.updateStatus(c.id, 'rejected', 'Documentación insuficiente'); });
                     // Auto-notify supplier
                     const s = MOCK_SUPPLIERS.find(x => x.id === inv.providerId);
                     if (s) SupplierMessageService.send(s.id, s.name, 'corporate', `La aclaración para la factura ${inv.id} fue rechazada. Motivo: documentación insuficiente. Favor de enviar nuevamente la documentación correcta a través de su portal (Facturas → Aclarar).`);
                     setReviewClarInvoiceId(null);
                   }}
                     className="py-3 px-5 bg-red-50 text-red-600 border border-red-200 rounded-xl text-[9px] font-bold uppercase tracking-wider hover:bg-red-100 transition-all flex items-center justify-center gap-2">
                     <X size={12} /> Rechazar
                   </button>
                 </div>
               </motion.div>
             </motion.div>
           );
         })()}
         {msgInvoice && (() => {
           const supplier = MOCK_SUPPLIERS.find(s => s.id === msgInvoice.providerId);
           if (!supplier) return null;
           const convo = SupplierMessageService.getBySupplier(supplier.id);
           const templates = getMessageTemplates(msgInvoice);
           return (
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
               className="fixed inset-0 z-[200] bg-brand-ink/40 backdrop-blur-sm flex items-center justify-center p-6"
               onClick={() => setMsgInvoice(null)}>
               <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
                 onClick={e => e.stopPropagation()} className="bg-white rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col" style={{ maxHeight: '88vh' }}>
                 {/* Header */}
                 <div className="px-7 py-4 bg-brand-ink text-brand-paper flex items-center justify-between flex-shrink-0">
                   <div className="flex items-center gap-3">
                     <div className="w-9 h-9 rounded-xl bg-brand-gold/20 flex items-center justify-center">
                       <Send size={14} className="text-brand-gold" />
                     </div>
                     <div>
                       <p className="text-[11px] font-bold">Mensaje a {supplier.name}</p>
                       <p className="text-[8px] text-brand-paper/40">Re: Factura {msgInvoice.id} · {CURRENCY_FORMATTER.format(msgInvoice.amount)}</p>
                     </div>
                   </div>
                   <button onClick={() => setMsgInvoice(null)}><X size={16} className="text-brand-paper/40 hover:text-brand-paper" /></button>
                 </div>

                 {/* Conversation history */}
                 <div className="flex-1 overflow-y-auto" style={{ minHeight: 120 }}>
                   {convo.length > 0 && (
                     <div className="p-5 space-y-2.5 border-b border-brand-sand/20">
                       <p className="text-[8px] font-bold text-brand-ink/30 uppercase tracking-wider">Historial de conversación</p>
                       {convo.slice(-6).map(msg => (
                         <div key={msg.id} className={`flex ${msg.from === 'corporate' ? 'justify-end' : 'justify-start'}`}>
                           <div className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 ${
                             msg.from === 'corporate'
                               ? 'bg-brand-ink text-brand-paper rounded-br-md'
                               : 'bg-brand-bone text-brand-ink border border-brand-sand/20 rounded-bl-md'
                           }`}>
                             <div className="flex items-center gap-2 mb-0.5">
                               <span className={`text-[7px] font-bold uppercase tracking-wider ${msg.from === 'corporate' ? 'text-brand-gold' : 'text-brand-ink/30'}`}>
                                 {msg.from === 'corporate' ? '🏢 Corporativo' : `📦 ${supplier.name.split(' ')[0]}`}
                               </span>
                             </div>
                             <p className="text-[10px] leading-relaxed">{msg.text}</p>
                             <p className={`text-[7px] mt-1 ${msg.from === 'corporate' ? 'text-brand-paper/30' : 'text-brand-ink/20'}`}>
                               {new Date(msg.date).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })} · {new Date(msg.date).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                             </p>
                           </div>
                         </div>
                       ))}
                     </div>
                   )}

                   {/* Templates */}
                   {!msgSent && (
                     <div className="px-5 py-4 space-y-3">
                       <p className="text-[8px] font-bold text-brand-ink/30 uppercase tracking-wider">Mensajes predeterminados — clic para usar</p>
                       <div className="grid grid-cols-1 gap-2">
                         {templates.map((t, i) => (
                           <button key={i} onClick={() => setMsgText(t.text)}
                             className={`text-left px-4 py-3 rounded-xl border transition-all ${msgText === t.text ? 'border-brand-gold bg-brand-gold/5 ring-1 ring-brand-gold/30' : 'border-brand-sand/20 hover:border-brand-gold/40 hover:bg-brand-bone/50'}`}>
                             <p className="text-[9px] font-bold text-brand-ink flex items-center gap-1.5">
                               {i === 0 && msgInvoice.forensicStatus === 'DISCREPANCY' ? <AlertTriangle size={10} className="text-amber-500" /> :
                                i === 0 && msgInvoice.forensicStatus === 'BLOCKED' ? <Shield size={10} className="text-red-500" /> :
                                <FileText size={10} className="text-brand-ink/30" />}
                               {t.label}
                             </p>
                             <p className="text-[8px] text-brand-ink/40 mt-1 leading-relaxed line-clamp-2">{t.text.slice(0, 120)}…</p>
                           </button>
                         ))}
                       </div>
                     </div>
                   )}

                   {/* Sent confirmation */}
                   {msgSent && (
                     <div className="px-5 py-8 text-center space-y-3">
                       <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mx-auto">
                         <CheckCircle2 size={28} className="text-green-500" />
                       </div>
                       <h3 className="text-lg font-serif text-brand-ink">Mensaje enviado</h3>
                       <p className="text-[10px] text-brand-ink/40">El proveedor verá este mensaje en su portal y podrá responder o subir la aclaración directamente.</p>
                     </div>
                   )}
                 </div>

                 {/* Compose area */}
                 {!msgSent && (
                   <div className="p-5 border-t border-brand-sand/20 flex-shrink-0 space-y-3">
                     <textarea value={msgText} onChange={e => setMsgText(e.target.value)} rows={3}
                       placeholder="Escribe un mensaje o selecciona una plantilla..."
                       className="w-full px-4 py-3 bg-brand-bone border border-brand-sand/30 rounded-xl text-[10px] outline-none focus:border-brand-gold resize-none leading-relaxed" />
                     <div className="flex gap-2">
                       <button onClick={() => setMsgInvoice(null)}
                         className="px-5 py-2.5 border border-brand-sand/30 text-brand-ink/50 rounded-xl text-[9px] font-bold uppercase tracking-wider hover:bg-brand-bone transition-all">
                         Cancelar
                       </button>
                       <button onClick={() => {
                         if (msgText.trim()) {
                           SupplierMessageService.send(supplier.id, supplier.name, 'corporate', msgText.trim());
                           setMsgSent(true);
                         }
                       }} disabled={!msgText.trim()}
                         className="flex-1 py-2.5 bg-brand-ink text-brand-paper rounded-xl text-[9px] font-bold uppercase tracking-wider hover:bg-brand-gold hover:text-brand-ink transition-all disabled:opacity-30 flex items-center justify-center gap-2">
                         <Send size={11} /> Enviar al Proveedor
                       </button>
                     </div>
                   </div>
                 )}
                 {msgSent && (
                   <div className="p-4 border-t border-brand-sand/20 flex-shrink-0">
                     <button onClick={() => setMsgInvoice(null)}
                       className="w-full py-2.5 bg-brand-ink text-brand-paper rounded-xl text-[9px] font-bold uppercase tracking-wider">
                       Cerrar
                     </button>
                   </div>
                 )}
               </motion.div>
             </motion.div>
           );
         })()}
       </AnimatePresence>
    </div>
  );
}


export function InvoiceDetailModal({ invoice, onClose }: { invoice: Invoice, onClose: () => void }) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-brand-ink/80 backdrop-blur-md"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="max-w-md w-full bg-brand-paper rounded-[3rem] p-12 space-y-10 shadow-2xl relative overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="absolute top-0 left-0 w-full h-2 bg-brand-gold" />
        
        <header className="flex justify-between items-start">
          <div className="space-y-2">
            <span className="label-caps !text-brand-gold">
              {invoice.status === 'paid' ? 'Comprobante de Pago' : 'Detalles de Factura'}
            </span>
            <h3 className="text-3xl text-brand-ink">{invoice.id}</h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-brand-bone rounded-full transition-colors opacity-30 hover:opacity-100">
            <LogOut size={20} className="rotate-90" />
          </button>
        </header>

        <div className="space-y-8">
          <div className="grid grid-cols-2 gap-8">
            <DetailItem label={invoice.status === 'paid' ? "Monto Liquidado" : "Monto"} value={CURRENCY_FORMATTER.format(invoice.amount)} />
            <DetailItem label={invoice.status === 'paid' ? "Fecha de Pago" : "Fecha de Emisión"} value={invoice.date} />
            <DetailItem label="Orden de Compra" value={`PO-${invoice.poNumber}`} />
            <DetailItem label="Estatus Actual" value={invoice.status === 'paid' ? 'Liquidadas' : (invoice.status === 'audited' ? 'Auditada' : 'Pendiente')} />
            <DetailItem label="Tipo de Pago" value={invoice.paymentType || 'PUE'} />
            <DetailItem label="Forma de Pago" value={invoice.paymentMethod || '03 - Transferencia'} />
            <DetailItem label="Uso de CFDI" value={invoice.cfdiUse || 'G03 - Gastos en general'} />
          </div>

          <div className="p-6 bg-brand-bone rounded-3xl border border-brand-sand/50 space-y-4">
            <h4 className="label-caps !opacity-40">Documentos de Respaldo</h4>
            <div className="space-y-3">
              <DocumentLink label="Factura PDF" />
              <DocumentLink label="Certificado XML Timbrado" />
              {invoice.status === 'paid' && <DocumentLink label="SPEI / Comprobante Bancario" />}
              <DocumentLink label="Dictamen de Auditoría Triple Match" />
            </div>
          </div>
        </div>

        <div className="pt-6 flex justify-center">
          <div className="flex items-center gap-3 text-green-600">
            <ShieldCheck size={18} />
            <span className="text-[10px] uppercase font-extrabold tracking-[0.2em]">Transacción Protegida e Inmutable</span>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}


export function DocumentLink({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-between group cursor-pointer hover:bg-white p-2 rounded-xl transition-all">
      <span className="text-[10px] font-serif text-brand-ink/60">{label}</span>
      <ChevronRight size={12} className="opacity-0 group-hover:opacity-40 transition-opacity" />
    </div>
  );
}



export function DetailItem({ label, value }: { label: string, value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase font-bold tracking-wider opacity-30">{label}</p>
      <p className="text-xs font-serif text-brand-ink/80">{value}</p>
    </div>
  );
}

