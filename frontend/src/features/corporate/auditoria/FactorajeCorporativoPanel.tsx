import React from 'react';
import { DollarSign, RefreshCw, CheckCircle2, AlertTriangle, HelpCircle, Loader2 } from 'lucide-react';
import { api, type CorpFactoraje } from '../../../services/apiClient.ts';

const CURRENCY_FORMATTER = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
});

// El corporativo revisa las solicitudes que mandan los proveedores y las
// aprueba / rechaza / desembolsa. El desembolso opera en modo manual mientras
// no haya API de factoraje externa configurada.
export function FactorajeCorporativoPanel() {
  const [requests, setRequests] = React.useState<CorpFactoraje[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const [msg, setMsg] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try { setRequests(await api.getFactoraje()); }
    catch { setRequests([]); }
    finally { setLoading(false); }
  }, []);
  React.useEffect(() => { load(); }, [load]);

  const act = async (id: string, action: 'approve' | 'reject' | 'disburse') => {
    setBusy(id); setErr(null); setMsg(null);
    try {
      if (action === 'approve') { await api.approveFactoraje(id); setMsg('Solicitud aprobada.'); }
      else if (action === 'disburse') { await api.disburseFactoraje(id); setMsg('Anticipo marcado como desembolsado.'); }
      else {
        const reason = window.prompt('Motivo del rechazo:') || '';
        if (!reason.trim()) { setBusy(null); return; }
        await api.rejectFactoraje(id, reason.trim()); setMsg('Solicitud rechazada.');
      }
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'No se pudo completar la acción.');
    } finally {
      setBusy(null);
    }
  };

  const STATUS: Record<CorpFactoraje['status'], { label: string; cls: string }> = {
    PENDING: { label: 'Pendiente', cls: 'bg-yellow-100 text-yellow-700' },
    APPROVED: { label: 'Aprobada', cls: 'bg-blue-100 text-blue-700' },
    DISBURSED: { label: 'Desembolsada', cls: 'bg-green-100 text-green-700' },
    REJECTED: { label: 'Rechazada', cls: 'bg-red-100 text-red-600' },
  };

  const pending = requests.filter(r => r.status === 'PENDING').length;
  const approved = requests.filter(r => r.status === 'APPROVED').length;
  const disbursedAmount = requests.filter(r => r.status === 'DISBURSED').reduce((s, r) => s + r.netAmount, 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-brand-gold/15 flex items-center justify-center">
            <DollarSign size={18} className="text-brand-gold" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-brand-ink">Solicitudes de Anticipo (Factoraje)</h4>
            <p className="text-[9px] text-brand-ink/40 font-serif">Revisa, aprueba, rechaza o desembolsa los anticipos solicitados por tus proveedores.</p>
          </div>
        </div>
        <button onClick={load} className="px-3 py-2 bg-white border border-brand-sand rounded-xl text-[9px] font-bold uppercase tracking-widest text-brand-ink/50 hover:text-brand-ink hover:border-brand-gold transition-all flex items-center gap-1.5">
          <RefreshCw size={12} /> Actualizar
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="p-4 rounded-2xl border border-yellow-200 bg-yellow-50 text-center">
          <p className="text-2xl font-bold font-serif text-yellow-700">{pending}</p>
          <p className="text-[8px] uppercase font-bold tracking-widest text-yellow-600 mt-1">Pendientes</p>
        </div>
        <div className="p-4 rounded-2xl border border-blue-200 bg-blue-50 text-center">
          <p className="text-2xl font-bold font-serif text-blue-700">{approved}</p>
          <p className="text-[8px] uppercase font-bold tracking-widest text-blue-600 mt-1">Aprobadas</p>
        </div>
        <div className="p-4 rounded-2xl border border-green-200 bg-green-50 text-center">
          <p className="text-lg font-bold font-serif text-green-700">{CURRENCY_FORMATTER.format(disbursedAmount)}</p>
          <p className="text-[8px] uppercase font-bold tracking-widest text-green-600 mt-1">Desembolsado</p>
        </div>
      </div>

      {msg && <p className="text-[10px] font-bold text-green-700 flex items-center gap-1.5"><CheckCircle2 size={12} /> {msg}</p>}
      {err && <p className="text-[10px] font-bold text-red-600 flex items-center gap-1.5"><AlertTriangle size={12} /> {err}</p>}

      <div className="editorial-card !p-0 overflow-hidden border border-brand-sand/50">
        {loading ? (
          <p className="px-6 py-8 text-center text-[11px] text-brand-ink/40 font-serif flex items-center justify-center gap-2"><Loader2 size={14} className="animate-spin" /> Cargando solicitudes...</p>
        ) : requests.length === 0 ? (
          <p className="px-6 py-8 text-center text-[11px] text-brand-ink/40 font-serif">No hay solicitudes de factoraje registradas.</p>
        ) : (
          <table className="w-full text-left">
            <thead className="bg-brand-sand/10">
              <tr>
                <th className="px-5 py-3 text-[8px] uppercase tracking-widest font-bold text-brand-ink/40">Proveedor / Factura</th>
                <th className="px-5 py-3 text-[8px] uppercase tracking-widest font-bold text-brand-ink/40 text-right">Solicitado</th>
                <th className="px-5 py-3 text-[8px] uppercase tracking-widest font-bold text-brand-ink/40 text-right">Comisión</th>
                <th className="px-5 py-3 text-[8px] uppercase tracking-widest font-bold text-brand-ink/40 text-right">Neto</th>
                <th className="px-5 py-3 text-[8px] uppercase tracking-widest font-bold text-brand-ink/40 text-center">Estado</th>
                <th className="px-5 py-3 text-[8px] uppercase tracking-widest font-bold text-brand-ink/40 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-sand/10">
              {requests.map(r => (
                <tr key={r.id} className="hover:bg-brand-gold/5 transition-colors">
                  <td className="px-5 py-4">
                    <p className="font-bold text-brand-ink text-[12px]">{r.supplierName}</p>
                    <p className="text-[9px] font-mono text-brand-ink/40">Factura {r.invoiceFolio}</p>
                  </td>
                  <td className="px-5 py-4 text-right font-serif font-bold text-brand-ink">{CURRENCY_FORMATTER.format(r.requestedAmount)}</td>
                  <td className="px-5 py-4 text-right font-mono text-red-600 text-[12px]">{CURRENCY_FORMATTER.format(r.fee)}</td>
                  <td className="px-5 py-4 text-right font-mono text-green-700 text-[12px] font-bold">{CURRENCY_FORMATTER.format(r.netAmount)}</td>
                  <td className="px-5 py-4 text-center">
                    <span className={`text-[8px] font-bold px-2 py-0.5 rounded-full ${STATUS[r.status].cls}`}>{STATUS[r.status].label}</span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex gap-1.5 justify-end">
                      {r.status === 'PENDING' && (
                        <>
                          <button onClick={() => act(r.id, 'approve')} disabled={busy === r.id}
                            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-[8px] font-bold uppercase tracking-widest hover:bg-blue-700 transition-all disabled:opacity-50">
                            {busy === r.id ? '...' : 'Aprobar'}
                          </button>
                          <button onClick={() => act(r.id, 'reject')} disabled={busy === r.id}
                            className="px-3 py-1.5 bg-white border border-red-200 text-red-600 rounded-lg text-[8px] font-bold uppercase tracking-widest hover:bg-red-50 transition-all disabled:opacity-50">
                            Rechazar
                          </button>
                        </>
                      )}
                      {r.status === 'APPROVED' && (
                        <>
                          <button onClick={() => act(r.id, 'disburse')} disabled={busy === r.id}
                            className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-[8px] font-bold uppercase tracking-widest hover:bg-green-700 transition-all disabled:opacity-50"
                            title="Marca el anticipo como desembolsado (modo manual — sin API externa)">
                            {busy === r.id ? '...' : 'Desembolsar'}
                          </button>
                          <button onClick={() => act(r.id, 'reject')} disabled={busy === r.id}
                            className="px-3 py-1.5 bg-white border border-red-200 text-red-600 rounded-lg text-[8px] font-bold uppercase tracking-widest hover:bg-red-50 transition-all disabled:opacity-50">
                            Rechazar
                          </button>
                        </>
                      )}
                      {(r.status === 'DISBURSED' || r.status === 'REJECTED') && (
                        <span className="text-[9px] text-brand-ink/30 font-serif italic">Sin acciones</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <p className="text-[9px] text-brand-ink/40 font-serif flex items-center gap-1.5">
        <HelpCircle size={11} /> El desembolso opera en modo manual. Cuando conectes la API de tu proveedor de factoraje, el mismo botón ejecutará el desembolso automático.
      </p>
    </div>
  );
}
