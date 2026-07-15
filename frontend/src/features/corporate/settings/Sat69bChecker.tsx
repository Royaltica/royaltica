import { useState } from 'react';
import { ShieldCheck, Loader2, Search, AlertTriangle } from 'lucide-react';
import { api, type RfcCheck } from '../../../services/apiClient.ts';

export function Sat69bChecker() {
  const [rfc, setRfc] = useState('');
  const [result, setResult] = useState<RfcCheck | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const check = async () => {
    if (!rfc.trim()) return;
    setBusy(true); setErr(null); setResult(null);
    try { setResult(await api.checkRfc(rfc.trim().toUpperCase())); }
    catch (e) { setErr(e instanceof Error ? e.message : 'No se pudo verificar el RFC.'); }
    finally { setBusy(false); }
  };

  const listed = result && (typeof result.list69b === 'object' && result.list69b ? (result.list69b as { listed?: boolean }).listed : Boolean(result.list69b));

  return (
    <div className="editorial-card space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center"><ShieldCheck size={18} className="text-red-600" /></div>
        <div>
          <h3 className="text-lg font-serif text-brand-ink">Verificación de RFC · SAT 69-B</h3>
          <p className="text-[10px] text-brand-ink/40 font-serif">Comprueba si un RFC está activo y si aparece en la lista negra de operaciones inexistentes (EFOS).</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <input value={rfc} onChange={e => setRfc(e.target.value)} placeholder="RFC del proveedor (ej. LAN180423QF1)"
          className="px-4 py-3 bg-white border border-brand-sand rounded-xl text-sm focus:outline-none focus:border-brand-gold w-64 uppercase" />
        <button onClick={check} disabled={busy} className="flex items-center gap-2 px-5 py-3 bg-brand-ink text-brand-bone rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-brand-gold hover:text-brand-ink transition-all disabled:opacity-50">
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />} Verificar
        </button>
      </div>
      {err && <p className="text-[10px] font-bold text-red-600 flex items-center gap-1.5"><AlertTriangle size={12} /> {err}</p>}
      {result && (
        <div className="flex flex-wrap gap-2">
          <span className={`text-[9px] font-bold px-3 py-1.5 rounded-full ${result.active ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
            {result.active ? 'RFC ACTIVO' : 'RFC no activo / desconocido'}
          </span>
          <span className={`text-[9px] font-bold px-3 py-1.5 rounded-full ${listed ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
            {listed ? '⚠ EN LISTA 69-B (EFOS)' : 'Fuera de lista 69-B'}
          </span>
          {result.message && <span className="text-[10px] text-brand-ink/50 self-center font-serif">{result.message}</span>}
        </div>
      )}
    </div>
  );
}
