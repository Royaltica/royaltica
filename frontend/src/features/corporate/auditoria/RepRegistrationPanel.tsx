import React from 'react';
import { FileText, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { api, isRealId } from '../../../services/apiClient.ts';
import { Invoice } from '../../../types.ts';

const CURRENCY_FORMATTER = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
});

export function RepRegistrationPanel() {
  const [invoices, setInvoices] = React.useState<Invoice[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [inputs, setInputs] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState<string | null>(null);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try { setInvoices(await api.getInvoices({ status: 'PAID', limit: 200 })); }
    catch { setInvoices([]); }
    finally { setLoading(false); }
  }, []);
  React.useEffect(() => { load(); }, [load]);

  const pendientes = invoices.filter(i => i.paymentType === 'PPD' && i.repStatus === 'PENDING' && isRealId(i.id));

  const register = async (id: string) => {
    const uuid = (inputs[id] || '').trim();
    if (!uuid) return;
    setBusy(id); setErr(null); setMsg(null);
    try {
      await api.registerRep(id, uuid);
      setMsg('REP registrado correctamente.');
      setInputs(p => ({ ...p, [id]: '' }));
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'No se pudo registrar el REP.');
    } finally { setBusy(null); }
  };

  return (
    <div className="editorial-card space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center"><FileText size={18} className="text-orange-600" /></div>
        <div>
          <h4 className="text-sm font-bold text-brand-ink">Complementos de Pago (REP) pendientes</h4>
          <p className="text-[9px] text-brand-ink/40 font-serif">Facturas PPD pagadas que requieren el UUID del REP emitido en tu PAC/ERP.</p>
        </div>
      </div>
      {loading ? (
        <p className="text-[11px] text-brand-ink/40 font-serif flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Cargando...</p>
      ) : pendientes.length === 0 ? (
        <p className="text-[11px] text-green-700 font-serif flex items-center gap-2"><CheckCircle2 size={14} /> No hay REP pendientes. Todas las facturas PPD pagadas están al día.</p>
      ) : (
        <div className="space-y-2">
          {pendientes.map(inv => (
            <div key={inv.id} className="flex flex-wrap items-center gap-3 p-3 rounded-xl bg-white border border-brand-sand/40">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold text-brand-ink truncate">{inv.provider}</p>
                <p className="text-[9px] font-mono text-brand-ink/40">{CURRENCY_FORMATTER.format(inv.amount)} · pagada {inv.paidDate || inv.date}</p>
              </div>
              <input value={inputs[inv.id] || ''} onChange={e => setInputs(p => ({ ...p, [inv.id]: e.target.value }))}
                placeholder="UUID del REP (folio fiscal)"
                className="px-3 py-2 bg-white border border-brand-sand rounded-lg text-[11px] font-mono focus:outline-none focus:border-brand-gold w-72" />
              <button onClick={() => register(inv.id)} disabled={busy === inv.id}
                className="px-4 py-2 bg-brand-ink text-brand-paper rounded-lg text-[8px] font-bold uppercase tracking-widest hover:bg-brand-gold hover:text-brand-ink transition-all disabled:opacity-50">
                {busy === inv.id ? '...' : 'Registrar REP'}
              </button>
            </div>
          ))}
        </div>
      )}
      {msg && <p className="text-[10px] font-bold text-green-700 flex items-center gap-1.5"><CheckCircle2 size={12} /> {msg}</p>}
      {err && <p className="text-[10px] font-bold text-red-600 flex items-center gap-1.5"><AlertTriangle size={12} /> {err}</p>}
    </div>
  );
}
