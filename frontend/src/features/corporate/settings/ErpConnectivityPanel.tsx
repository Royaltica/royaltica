import React, { useState, useEffect } from 'react';
import { Database, Loader2, RefreshCw, CheckCircle2 } from 'lucide-react';
import { api, type ErpStatus } from '../../../services/apiClient.ts';

export function ErpConnectivityPanel() {
  const [status, setStatus] = useState<ErpStatus | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = React.useCallback(() => { api.getErpStatus().then(setStatus).catch(() => setStatus(null)); }, []);
  useEffect(() => { load(); }, [load]);

  const sync = async (kind: 'invoices' | 'suppliers') => {
    setBusy(kind); setMsg(null);
    try { await api.erpSync(kind); setMsg(`Sincronización de ${kind === 'invoices' ? 'facturas' : 'proveedores'} ejecutada (${status?.mode === 'live' ? 'en vivo' : 'modo stub'}).`); }
    catch (e) { setMsg(e instanceof Error ? e.message : 'Error al sincronizar.'); }
    finally { setBusy(null); }
  };

  return (
    <div className="editorial-card space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center"><Database size={18} className="text-blue-600" /></div>
        <div>
          <h3 className="text-lg font-serif text-brand-ink">Conectividad ERP</h3>
          <p className="text-[10px] text-brand-ink/40 font-serif">Sincroniza facturas y proveedores con tu ERP corporativo.</p>
        </div>
      </div>
      {status ? (
        <>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-[10px] text-brand-ink/60">Proveedor: <strong>{status.erpProvider ?? 'ninguno'}</strong></span>
            <span className={`text-[8px] font-bold px-2 py-0.5 rounded-full ${status.mode === 'live' ? 'bg-green-100 text-green-700' : status.mode === 'stub' ? 'bg-yellow-100 text-yellow-700' : 'bg-brand-sand/40 text-brand-ink/40'}`}>
              {status.mode === 'live' ? 'CONECTADO' : status.mode === 'stub' ? 'MODO STUB' : 'SIN ERP'}
            </span>
          </div>
          <p className="text-[10px] text-brand-ink/50 font-serif">{status.message}</p>
          <div className="flex gap-2">
            <button onClick={() => sync('invoices')} disabled={busy !== null || !status.erpProvider} className="flex items-center gap-2 px-4 py-2 bg-white border border-brand-sand rounded-xl text-[9px] font-bold uppercase tracking-widest hover:border-blue-400 transition-all disabled:opacity-40">
              {busy === 'invoices' ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Sincronizar Facturas
            </button>
            <button onClick={() => sync('suppliers')} disabled={busy !== null || !status.erpProvider} className="flex items-center gap-2 px-4 py-2 bg-white border border-brand-sand rounded-xl text-[9px] font-bold uppercase tracking-widest hover:border-blue-400 transition-all disabled:opacity-40">
              {busy === 'suppliers' ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Sincronizar Proveedores
            </button>
          </div>
          {msg && <p className="text-[10px] font-bold text-brand-ink/60 flex items-center gap-1.5"><CheckCircle2 size={12} className="text-green-600" /> {msg}</p>}
          {!status.erpProvider && <p className="text-[9px] text-brand-ink/40 font-serif">Asigna un ERP en la pestaña "Organización" para habilitar la sincronización.</p>}
        </>
      ) : <p className="text-[11px] text-brand-ink/40 font-serif">Cargando estado del ERP...</p>}
    </div>
  );
}
