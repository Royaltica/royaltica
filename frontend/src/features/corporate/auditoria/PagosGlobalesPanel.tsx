import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, CheckCircle2, AlertTriangle, ChevronRight } from 'lucide-react';
import { BankTxService, type BankTransaction } from '../../../services/mockServices.ts';

const CURRENCY_FORMATTER = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
});

// ─── PagosGlobalesPanel ───────────────────────────────────────────────────────
export function PagosGlobalesPanel() {
  const [txs, setTxs] = React.useState<BankTransaction[]>(BankTxService.getTransactions());
  const [expanded, setExpanded] = React.useState<string | null>(null);
  const [acting, setActing] = React.useState<string | null>(null);
  const [showForm, setShowForm] = React.useState(false);
  // New payment form state
  const [formTxId, setFormTxId] = React.useState('');
  const [formTotal, setFormTotal] = React.useState('');
  const [formDesc, setFormDesc] = React.useState('');
  const [formAllocs, setFormAllocs] = React.useState<{cfdi: string; prov: string; amount: string}[]>([
    {cfdi: '', prov: '', amount: ''}
  ]);

  React.useEffect(() => {
    BankTxService.subscribe(setTxs);
    return () => BankTxService.unsubscribe(setTxs);
  }, []);

  const TX_STATUS: Record<BankTransaction['status'], {label: string; badge: string}> = {
    pending_allocation: { label: 'Pendiente',      badge: 'bg-yellow-100 text-yellow-700' },
    pending_approval:   { label: 'Pend. Aprobación',badge: 'bg-orange-100 text-orange-700' },
    confirmed:          { label: 'Confirmado ✓',   badge: 'bg-green-100 text-green-700' },
    rejected:           { label: 'Rechazado',      badge: 'bg-red-100 text-red-700' },
  };

  const handleConfirm = (id: string) => {
    setActing(id);
    setTimeout(() => { BankTxService.confirmCharge(id); setActing(null); }, 1000);
  };
  const handleCFO = (id: string) => {
    setActing(id + '_cfo');
    setTimeout(() => { BankTxService.approveCFO(id); setActing(null); }, 800);
  };

  const formAllocTotal = formAllocs.reduce((s, a) => s + (parseFloat(a.amount) || 0), 0);
  const formTotalNum   = parseFloat(formTotal) || 0;
  const formValid      = formTxId && formTotalNum > 0 && Math.abs(formAllocTotal - formTotalNum) < 0.01 && formAllocs.every(a => a.cfdi && a.prov && parseFloat(a.amount) > 0);

  const handleSubmitForm = () => {
    if (!formValid) return;
    BankTxService.addTransaction({
      bank_tx_id: formTxId, total_amount: formTotalNum, description: formDesc, date: new Date().toISOString().slice(0,10),
      status: formTotalNum > 250000 ? 'pending_approval' : 'pending_allocation',
      requires_cfo_approval: formTotalNum > 250000, cfo_approved: false, logged: false,
      allocations: formAllocs.map(a => ({ cfdi_uuid: a.cfdi, provider_id: 'PROV-NEW', provider_name: a.prov, amount: parseFloat(a.amount) }))
    });
    setShowForm(false); setFormTxId(''); setFormTotal(''); setFormDesc('');
    setFormAllocs([{cfdi:'',prov:'',amount:''}]);
  };

  const totalPending   = txs.filter(t => t.status !== 'confirmed').reduce((s,t) => s+t.total_amount, 0);
  const totalConfirmed = txs.filter(t => t.status === 'confirmed').reduce((s,t) => s+t.total_amount, 0);

  return (
    <div className="space-y-6">
      {/* Stats + Actions */}
      <div className="flex flex-col md:flex-row gap-4 items-start justify-between">
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total Transacciones', val: txs.length,             color: 'text-brand-ink',  bg: 'bg-white border-brand-sand/30' },
            { label: 'Monto Pendiente',     val: CURRENCY_FORMATTER.format(totalPending),  color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200' },
            { label: 'Monto Confirmado',    val: CURRENCY_FORMATTER.format(totalConfirmed),color: 'text-green-600',  bg: 'bg-green-50 border-green-200' },
          ].map(s => (
            <div key={s.label} className={`p-4 rounded-2xl border ${s.bg} text-center`}>
              <p className={`text-base font-bold font-serif ${s.color}`}>{s.val}</p>
              <p className="text-[9px] uppercase font-bold tracking-widest text-brand-ink/40 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
        <button onClick={() => setShowForm(f => !f)} className="flex items-center gap-2 px-5 py-3 bg-brand-gold text-brand-ink rounded-xl text-[10px] font-bold uppercase tracking-widest hover:scale-105 transition-all shadow-sm">
          <Plus size={14}/> Nuevo Pago Global
        </button>
      </div>

      {/* New Payment Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{opacity:0,y:-8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-8}}
            className="editorial-card border border-brand-gold/30 space-y-4">
            <p className="text-sm font-bold text-brand-ink flex items-center gap-2"><Plus size={14}/> Nueva Orden de Pago Global</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input value={formTxId} onChange={e=>setFormTxId(e.target.value)} placeholder="Bank TX ID (ej. BANAMEX-2024-...)" className="px-4 py-2.5 border border-brand-sand rounded-xl text-xs focus:outline-none focus:border-brand-gold"/>
              <input value={formTotal} onChange={e=>setFormTotal(e.target.value)} type="number" placeholder="Monto Total Egreso Bancario" className="px-4 py-2.5 border border-brand-sand rounded-xl text-xs focus:outline-none focus:border-brand-gold"/>
              <input value={formDesc} onChange={e=>setFormDesc(e.target.value)} placeholder="Descripción" className="px-4 py-2.5 border border-brand-sand rounded-xl text-xs focus:outline-none focus:border-brand-gold"/>
            </div>
            <div className="space-y-2">
              <p className="label-caps text-brand-ink/40">Asignaciones CFDI</p>
              {formAllocs.map((a, i) => (
                <div key={i} className="grid grid-cols-3 gap-2">
                  <input value={a.cfdi} onChange={e=>{const n=[...formAllocs];n[i]={...n[i],cfdi:e.target.value};setFormAllocs(n);}} placeholder="CFDI UUID" className="px-3 py-2 border border-brand-sand rounded-xl text-xs focus:outline-none focus:border-brand-gold"/>
                  <input value={a.prov} onChange={e=>{const n=[...formAllocs];n[i]={...n[i],prov:e.target.value};setFormAllocs(n);}} placeholder="Proveedor" className="px-3 py-2 border border-brand-sand rounded-xl text-xs focus:outline-none focus:border-brand-gold"/>
                  <input value={a.amount} onChange={e=>{const n=[...formAllocs];n[i]={...n[i],amount:e.target.value};setFormAllocs(n);}} type="number" placeholder="Monto" className="px-3 py-2 border border-brand-sand rounded-xl text-xs focus:outline-none focus:border-brand-gold"/>
                </div>
              ))}
              <button onClick={()=>setFormAllocs(p=>[...p,{cfdi:'',prov:'',amount:''}])} className="text-[9px] font-bold text-brand-gold hover:underline uppercase tracking-widest">+ Agregar CFDI</button>
            </div>
            {/* Validation bar */}
            {formTotalNum > 0 && (
              <div className={`flex items-center gap-3 p-3 rounded-xl border text-xs font-bold ${Math.abs(formAllocTotal-formTotalNum)<0.01 ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                {Math.abs(formAllocTotal-formTotalNum)<0.01 ? <CheckCircle2 size={14}/> : <AlertTriangle size={14}/>}
                Asignado: {CURRENCY_FORMATTER.format(formAllocTotal)} / Total: {CURRENCY_FORMATTER.format(formTotalNum)}
                {Math.abs(formAllocTotal-formTotalNum)>0.01 && <span className="ml-auto">Diferencia: {CURRENCY_FORMATTER.format(Math.abs(formAllocTotal-formTotalNum))}</span>}
              </div>
            )}
            {formTotalNum > 250000 && (
              <div className="flex items-center gap-2 p-3 bg-orange-50 border border-orange-200 rounded-xl text-xs text-orange-700 font-bold">
                <AlertTriangle size={14}/> Monto {'>'} $250,000 MXN — Se enviará Actionable Card al CFO para aprobación antes de liberar layout bancario.
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={handleSubmitForm} disabled={!formValid} className="px-6 py-2.5 bg-brand-ink text-brand-bone rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-brand-gold hover:text-brand-ink transition-all disabled:opacity-40">Crear Orden</button>
              <button onClick={()=>setShowForm(false)} className="px-6 py-2.5 bg-brand-sand/30 text-brand-ink rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-brand-sand transition-all">Cancelar</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Collapsible Tree */}
      <div className="editorial-card !p-0 overflow-hidden shadow-xl shadow-brand-sand/30 border border-brand-sand/50">
        <div className="px-6 py-3 bg-white/50 border-b border-brand-sand/20 flex items-center justify-between">
          <p className="text-sm font-bold text-brand-ink">Árbol de Transacciones Bancarias → CFDIs</p>
          <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"/><span className="text-[9px] font-bold text-brand-ink/40 uppercase tracking-wider">En vivo</span></div>
        </div>
        <div className="divide-y divide-brand-sand/20">
          {txs.map(tx => {
            const isOpen = expanded === tx.id;
            const allocSum = tx.allocations.reduce((s,a)=>s+a.amount, 0);
            const sumOk    = Math.abs(allocSum - tx.total_amount) < 0.01;
            const st = TX_STATUS[tx.status];
            const needsCFO = tx.requires_cfo_approval && !tx.cfo_approved;
            return (
              <div key={tx.id}>
                {/* Parent Row */}
                <div className="flex items-center gap-4 px-6 py-4 hover:bg-brand-gold/5 transition-all cursor-pointer group" onClick={()=>setExpanded(isOpen ? null : tx.id)}>
                  <div className={`transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}><ChevronRight size={16} className="text-brand-ink/30 group-hover:text-brand-gold"/></div>
                  <div className="flex-1 grid grid-cols-4 gap-4 items-center">
                    <div>
                      <p className="text-[10px] font-bold font-mono text-brand-ink">{tx.bank_tx_id}</p>
                      <p className="text-[9px] text-brand-ink/30 font-serif">{tx.date}</p>
                    </div>
                    <p className="text-[11px] text-brand-ink/60 truncate">{tx.description}</p>
                    <p className="text-sm font-bold font-serif text-brand-ink">{CURRENCY_FORMATTER.format(tx.total_amount)}</p>
                    <div className="flex items-center gap-2 justify-end">
                      {!sumOk && <span className="text-[8px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold">⚠ Suma difiere</span>}
                      <span className={`text-[8px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full ${st.badge}`}>{st.label}</span>
                      <span className="text-[9px] text-brand-ink/30">{tx.allocations.length} CFDIs</span>
                    </div>
                  </div>
                </div>
                {/* CFO Approval Card */}
                {needsCFO && (
                  <div className="mx-6 mb-3 flex items-center gap-3 p-3 bg-orange-50 border border-orange-200 rounded-xl">
                    <AlertTriangle size={14} className="text-orange-600 flex-shrink-0"/>
                    <p className="text-[10px] text-orange-700 font-bold flex-1">Requiere aprobación CFO — Pago mayor a $250,000 MXN. Layout bancario bloqueado.</p>
                    <button onClick={()=>handleCFO(tx.id)} disabled={acting===tx.id+'_cfo'} className="px-4 py-2 bg-orange-600 text-white rounded-lg text-[9px] font-bold uppercase tracking-widest hover:bg-orange-700 transition-all disabled:opacity-50">
                      {acting===tx.id+'_cfo' ? '...' : 'Aprobar como CFO'}
                    </button>
                  </div>
                )}
                {/* Children CFDIs */}
                <AnimatePresence>
                  {isOpen && (
                    <motion.div initial={{height:0,opacity:0}} animate={{height:'auto',opacity:1}} exit={{height:0,opacity:0}} className="overflow-hidden bg-brand-bone/40">
                      <div className="ml-10 mr-6 mb-3 divide-y divide-brand-sand/10 rounded-2xl overflow-hidden border border-brand-sand/20">
                        {tx.allocations.map((alloc,i) => (
                          <div key={i} className="flex items-center gap-4 px-5 py-3 bg-white/60 hover:bg-brand-gold/5 transition-all">
                            <div className="w-px h-4 bg-brand-sand/40"/>
                            <div className="flex-1 grid grid-cols-3 gap-4">
                              <div><p className="text-[10px] font-bold text-brand-ink">{alloc.provider_name}</p><p className="text-[9px] text-brand-ink/30 font-mono">{alloc.provider_id}</p></div>
                              <span className="text-[9px] font-mono text-brand-ink/50 bg-brand-sand/20 px-2 py-0.5 rounded-lg self-center">{alloc.cfdi_uuid}</span>
                              <p className="text-sm font-bold font-serif text-brand-ink text-right">{CURRENCY_FORMATTER.format(alloc.amount)}</p>
                            </div>
                          </div>
                        ))}
                        {/* Confirm Button */}
                        {tx.status !== 'confirmed' && sumOk && !needsCFO && (
                          <div className="px-5 py-3 bg-white/60 flex justify-end">
                            <button onClick={()=>handleConfirm(tx.id)} disabled={acting===tx.id} className="flex items-center gap-2 px-5 py-2 bg-brand-ink text-brand-bone rounded-xl text-[9px] font-bold uppercase tracking-widest hover:bg-brand-gold hover:text-brand-ink transition-all disabled:opacity-50">
                              {acting===tx.id ? <motion.div animate={{rotate:360}} transition={{repeat:Infinity,duration:1,ease:'linear'}} className="w-3 h-3 border-2 border-brand-ink/30 border-t-brand-ink rounded-full"/> : <CheckCircle2 size={12}/>}
                              {acting===tx.id ? 'Procesando...' : 'Confirmar Cargo Bancario'}
                            </button>
                          </div>
                        )}
                        {tx.status === 'confirmed' && tx.logged && (
                          <div className="px-5 py-2 bg-green-50 text-green-700 text-[9px] font-bold flex items-center gap-2">
                            <CheckCircle2 size={12}/> Cargo confirmado · {tx.allocations.length} logs inyectados al Ledger Maestro y expedientes de proveedores
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
        <div className="px-6 py-3 bg-brand-bone/50 border-t border-brand-sand/20">
          <p className="text-[8px] text-brand-ink/30 font-serif">* Regla estricta: Si suma de asignaciones ≠ egreso bancario total, la orden es rechazada. Pagos {'>'} $250,000 MXN requieren Actionable Card al CFO.</p>
        </div>
      </div>
    </div>
  );
}
