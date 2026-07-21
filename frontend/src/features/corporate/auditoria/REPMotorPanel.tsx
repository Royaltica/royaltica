import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CreditCard, CheckCircle2, AlertCircle, AlertTriangle, Download } from 'lucide-react';
import { REPMotorService, type PPDInvoice } from '../../../services/mockServices.ts';
import { validateCLABE } from '../../../lib/validators.ts';

const CURRENCY_FORMATTER = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
});

// ─── REPMotorPanel ────────────────────────────────────────────────────────────
export function REPMotorPanel() {
  const [invoices, setInvoices] = React.useState<PPDInvoice[]>(REPMotorService.getInvoices());
  const [acting, setActing] = React.useState<string | null>(null);
  // ─── New: CLABE Validation ───
  const [clabeInput, setClabeInput] = React.useState('');
  const [clabeResult, setClabeResult] = React.useState<{ valid: boolean; bank?: string; error?: string } | null>(null);
  const [showClabeValidator, setShowClabeValidator] = React.useState(false);

  React.useEffect(() => {
    REPMotorService.subscribe(setInvoices);
    return () => REPMotorService.unsubscribe(setInvoices);
  }, []);

  const atRisk = invoices.filter(i => i.days_since_payment >= 5 && i.rep_status === 'pending');
  const stamped = invoices.filter(i => i.rep_status === 'stamped' || i.rep_status === 'risk_extinct');
  const extinct = invoices.filter(i => i.rep_status === 'risk_extinct');

  const REP_STATUS: Record<PPDInvoice['rep_status'], { label: string; badge: string; pill: string }> = {
    pending:      { label: 'Sin REP',         badge: 'bg-red-100 text-red-700',    pill: '🔴' },
    claimed:      { label: 'Reclamado',       badge: 'bg-yellow-100 text-yellow-700', pill: '🟡' },
    received:     { label: 'REP Recibido',    badge: 'bg-blue-100 text-blue-700',  pill: '🔵' },
    stamped:      { label: 'Timbrado',        badge: 'bg-teal-100 text-teal-700',  pill: '🟢' },
    risk_extinct: { label: 'Riesgo Extinto ✓', badge: 'bg-green-100 text-green-700', pill: '✅' },
  };

  const handleAction = (id: string, action: 'claim' | 'stamp') => {
    setActing(id);
    setTimeout(() => {
      if (action === 'claim') REPMotorService.claimREP(id);
      else REPMotorService.stampREP(id);
      setActing(null);
    }, 900);
  };

  return (
    <div className="space-y-6">
      {/* Stats + CLABE Validator Toggle */}
      <div className="flex items-center justify-between">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 flex-1">
          {[
            { label: 'Total PPD',       val: invoices.length,   color: 'text-brand-ink',    bg: 'bg-white border-brand-sand/30' },
            { label: 'En Riesgo (+5d)', val: atRisk.length,     color: 'text-red-600',      bg: 'bg-red-50 border-red-200' },
            { label: 'REPs Timbrados',  val: stamped.length,    color: 'text-teal-600',     bg: 'bg-teal-50 border-teal-200' },
            { label: 'Riesgo Extinto',  val: extinct.length,    color: 'text-green-600',    bg: 'bg-green-50 border-green-200' },
          ].map(s => (
            <div key={s.label} className={`p-4 rounded-2xl border ${s.bg} text-center`}>
              <p className={`text-2xl font-bold font-serif ${s.color}`}>{s.val}</p>
              <p className="text-[9px] uppercase font-bold tracking-widest text-brand-ink/40 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
        <button onClick={() => setShowClabeValidator(!showClabeValidator)}
          className={`ml-4 flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all flex-shrink-0 ${
            showClabeValidator ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100'
          }`}>
          <CreditCard size={14} /> Validar CLABE
        </button>
      </div>

      {/* ─── CLABE Validator ─── */}
      <AnimatePresence>
        {showClabeValidator && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="bg-white rounded-2xl p-6 border border-blue-200 space-y-4 shadow-sm">
              <div className="flex items-center gap-3">
                <CreditCard size={18} className="text-blue-600" />
                <div>
                  <h4 className="text-sm font-bold text-brand-ink">Validador de CLABE Interbancaria</h4>
                  <p className="text-[10px] text-brand-ink/40">Verifica 18 dígitos, código de banco y dígito verificador (módulo 10)</p>
                </div>
              </div>
              <div className="flex gap-3">
                <input
                  value={clabeInput}
                  onChange={e => { setClabeInput(e.target.value.replace(/\D/g, '').slice(0, 18)); setClabeResult(null); }}
                  placeholder="Ingresa la CLABE de 18 dígitos..."
                  maxLength={18}
                  className="flex-1 px-4 py-3 border border-brand-sand/50 rounded-xl text-sm font-mono tracking-widest focus:outline-none focus:border-blue-500"
                />
                <button onClick={() => setClabeResult(validateCLABE(clabeInput))}
                  disabled={clabeInput.length !== 18}
                  className="px-6 py-3 bg-blue-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-blue-700 transition-all disabled:opacity-40">
                  Validar
                </button>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-brand-ink/40">
                <span>Dígitos: {clabeInput.length}/18</span>
                {clabeInput.length > 0 && clabeInput.length < 18 && (
                  <div className="flex-1 bg-brand-sand/20 rounded-full h-1.5 overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${(clabeInput.length / 18) * 100}%` }} />
                  </div>
                )}
              </div>
              {clabeResult && (
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${
                    clabeResult.valid ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                  }`}>
                  {clabeResult.valid ? (
                    <>
                      <CheckCircle2 size={18} className="text-green-600" />
                      <div>
                        <p className="text-sm font-bold text-green-800">CLABE válida</p>
                        <p className="text-[10px] text-green-600">Banco: <strong>{clabeResult.bank}</strong> · Dígito verificador correcto</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <AlertCircle size={18} className="text-red-600" />
                      <div>
                        <p className="text-sm font-bold text-red-800">CLABE inválida</p>
                        <p className="text-[10px] text-red-600">{clabeResult.error}</p>
                      </div>
                    </>
                  )}
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Actionable Cards — En Riesgo */}
      {atRisk.length > 0 && (
        <div className="space-y-3">
          <p className="label-caps !text-red-500 flex items-center gap-1.5"><AlertTriangle size={10}/> Actionable Cards — Requieren Atención</p>
          {atRisk.map(inv => (
            <motion.div key={inv.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-4 p-4 bg-red-50 border border-red-200 rounded-2xl">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded-full uppercase tracking-widest">PPD · {inv.days_since_payment}d sin REP</span>
                </div>
                <p className="text-sm font-bold text-brand-ink">{inv.provider_name}</p>
                <p className="text-[10px] font-mono text-brand-ink/40">{inv.cfdi_uuid} · {CURRENCY_FORMATTER.format(inv.amount)}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleAction(inv.id, 'claim')} disabled={acting === inv.id}
                  className="px-3 py-2 bg-brand-ink text-brand-bone rounded-xl text-[9px] font-bold uppercase tracking-widest hover:bg-red-700 transition-all disabled:opacity-50">
                  {acting === inv.id ? '...' : 'Reclamar REP'}
                </button>
                <button onClick={() => handleAction(inv.id, 'stamp')} disabled={acting === inv.id}
                  className="px-3 py-2 bg-brand-gold text-brand-ink rounded-xl text-[9px] font-bold uppercase tracking-widest hover:scale-105 transition-all disabled:opacity-50">
                  Auto-Timbrar
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Full Table */}
      <div className="editorial-card !p-0 overflow-hidden shadow-xl shadow-brand-sand/30 border border-brand-sand/50">
        <div className="px-6 py-3 bg-white/50 border-b border-brand-sand/20 flex items-center justify-between">
          <p className="text-sm font-bold text-brand-ink">Monitor PPD — Complementos de Pago</p>
          <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"/><span className="text-[9px] font-bold text-brand-ink/40 uppercase tracking-wider">En vivo</span></div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-separate border-spacing-0 min-w-[600px]">
            <thead className="bg-brand-sand/10 sticky top-0 z-10 backdrop-blur-md">
              <tr>
                {['Folio PPD','Proveedor','CFDI UUID','Monto','Días Pago','Estatus REP','Acción'].map(h => (
                  <th key={h} className="px-5 py-3.5 label-caps !opacity-40 border-b border-brand-sand text-brand-ink">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-sand/20">
              {invoices.map(inv => {
                const st = REP_STATUS[inv.rep_status];
                const isAct = acting === inv.id;
                const canClaim = inv.rep_status === 'pending' && inv.days_since_payment >= 5;
                const canStamp = inv.rep_status === 'received' || inv.rep_status === 'claimed';
                return (
                  <tr key={inv.id} className="hover:bg-brand-gold/5 transition-all">
                    <td className="px-5 py-4 text-[10px] font-bold font-mono text-brand-ink">{inv.id}</td>
                    <td className="px-5 py-4"><p className="text-[11px] font-bold text-brand-ink">{inv.provider_name}</p><p className="text-[9px] text-brand-ink/30 font-mono">{inv.provider_id}</p></td>
                    <td className="px-5 py-4"><span className="text-[9px] font-mono bg-brand-sand/20 px-2 py-0.5 rounded-lg text-brand-ink/60">{inv.cfdi_uuid}</span></td>
                    <td className="px-5 py-4 text-sm font-bold font-serif text-brand-ink">{CURRENCY_FORMATTER.format(inv.amount)}</td>
                    <td className="px-5 py-4">
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${inv.days_since_payment >= 5 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{inv.days_since_payment}d</span>
                    </td>
                    <td className="px-5 py-4"><span className={`text-[8px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full ${st.badge}`}>{st.label}</span></td>
                    <td className="px-5 py-4">
                      {inv.rep_xml_url
                        ? <a href={inv.rep_xml_url} className="flex items-center gap-1 text-[9px] font-bold text-teal-600 hover:underline"><Download size={10}/> XML</a>
                        : canClaim ? (
                          <button onClick={() => handleAction(inv.id, 'claim')} disabled={isAct} className="px-3 py-1.5 bg-brand-ink text-brand-bone rounded-lg text-[8px] font-bold uppercase tracking-widest hover:bg-red-700 transition-all disabled:opacity-50">
                            {isAct ? '...' : 'Reclamar'}
                          </button>
                        ) : canStamp ? (
                          <button onClick={() => handleAction(inv.id, 'stamp')} disabled={isAct} className="px-3 py-1.5 bg-brand-gold text-brand-ink rounded-lg text-[8px] font-bold uppercase tracking-widest hover:scale-105 transition-all disabled:opacity-50">
                            {isAct ? '...' : 'Auto-Timbrar'}
                          </button>
                        ) : <span className="text-brand-ink/20 text-[9px]">—</span>
                      }
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-6 py-3 bg-brand-bone/50 border-t border-brand-sand/20">
          <p className="text-[8px] text-brand-ink/30 font-serif">* Worker PPD: Escucha facturas liquidadas en bancos con MetodoPago=PPD. Si +5 días sin REP → Actionable Card. Auto-timbra via Facturama/SATWS al detectar cobro exacto.</p>
        </div>
      </div>
    </div>
  );
}
