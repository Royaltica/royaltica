import React, { useState, useEffect } from 'react';
import { Webhook, Loader2, AlertTriangle } from 'lucide-react';
import { api, type WebhookEndpointItem } from '../../../services/apiClient.ts';

export function WebhooksPanel() {
  const [hooks, setHooks] = useState<WebhookEndpointItem[]>([]);
  const [events, setEvents] = useState<string[]>([]);
  const [url, setUrl] = useState('');
  const [selEvents, setSelEvents] = useState<string[]>([]);
  const [secret, setSecret] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = React.useCallback(() => {
    api.getWebhooks().then(setHooks).catch(() => setHooks([]));
    api.getWebhookEvents().then(setEvents).catch(() => setEvents([]));
  }, []);
  useEffect(() => { load(); }, [load]);

  const toggleEv = (e: string) => setSelEvents(p => p.includes(e) ? p.filter(x => x !== e) : [...p, e]);

  const create = async () => {
    if (!url.trim()) { setErr('La URL es obligatoria.'); return; }
    setBusy(true); setErr(null); setSecret(null);
    try {
      const res = await api.createWebhook({ url: url.trim(), events: selEvents.length ? selEvents : undefined });
      if (res.secret) setSecret(res.secret);
      setUrl(''); setSelEvents([]);
      load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'No se pudo crear el webhook.');
    } finally { setBusy(false); }
  };

  const del = async (id: string) => { try { await api.deleteWebhook(id); load(); } catch { /* ignore */ } };

  return (
    <div className="editorial-card space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center"><Webhook size={18} className="text-purple-600" /></div>
        <div>
          <h3 className="text-lg font-serif text-brand-ink">Webhooks Salientes</h3>
          <p className="text-[10px] text-brand-ink/40 font-serif">Recibe eventos de Royáltica (factura aprobada, pago completado, etc.) en tu sistema.</p>
        </div>
      </div>
      <div className="space-y-2">
        <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://tu-sistema.com/webhooks/royaltica"
          className="w-full px-4 py-3 bg-white border border-brand-sand rounded-xl text-sm focus:outline-none focus:border-brand-gold" />
        {events.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {events.map(ev => (
              <button key={ev} onClick={() => toggleEv(ev)}
                className={`px-2.5 py-1 rounded-lg text-[8px] font-bold tracking-wider transition-all ${selEvents.includes(ev) ? 'bg-purple-600 text-white' : 'bg-white border border-brand-sand text-brand-ink/40 hover:text-brand-ink'}`}>
                {ev}
              </button>
            ))}
            <span className="text-[8px] text-brand-ink/30 self-center ml-1">{selEvents.length === 0 ? '(vacío = todos los eventos)' : ''}</span>
          </div>
        )}
        <div className="flex items-center gap-3">
          <button onClick={create} disabled={busy} className="flex items-center gap-2 px-5 py-2.5 bg-brand-ink text-brand-bone rounded-xl text-[9px] font-bold uppercase tracking-widest hover:bg-brand-gold hover:text-brand-ink transition-all disabled:opacity-50">
            {busy ? <Loader2 size={12} className="animate-spin" /> : <Webhook size={12} />} Registrar
          </button>
          {err && <span className="text-[10px] font-bold text-red-600 flex items-center gap-1.5"><AlertTriangle size={12} /> {err}</span>}
        </div>
        {secret && (
          <div className="p-3 rounded-xl bg-yellow-50 border border-yellow-200">
            <p className="text-[9px] font-bold text-yellow-800 uppercase tracking-widest mb-1">Secret (guárdalo, no se vuelve a mostrar)</p>
            <p className="font-mono text-[11px] text-brand-ink break-all">{secret}</p>
          </div>
        )}
      </div>
      {hooks.length > 0 && (
        <div className="space-y-2">
          {hooks.map(h => (
            <div key={h.id} className="flex items-center justify-between p-3 rounded-xl bg-white border border-brand-sand/40">
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-brand-ink truncate">{h.url}</p>
                <p className="text-[8px] text-brand-ink/40">{h.events.length ? h.events.join(', ') : 'todos los eventos'}</p>
              </div>
              <button onClick={() => del(h.id)} className="px-3 py-1.5 bg-white border border-red-200 text-red-600 rounded-lg text-[8px] font-bold uppercase tracking-widest hover:bg-red-50 transition-all flex-shrink-0">Eliminar</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
