import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, MessageSquare, RefreshCw } from 'lucide-react';
import { api, type WaUnmatched } from '../../services/apiClient';

/**
 * Bandeja de WhatsApp de Royáltica (solo SUPERADMIN): respuestas que no se
 * pudieron atribuir con certeza porque el teléfono no es de ningún cliente o
 * es de clientes de varias organizaciones. Nunca se le asignan solas a nadie.
 */
export function WhatsappAdminPanel() {
  const [items, setItems] = useState<WaUnmatched[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const cargar = useCallback(() => {
    setError(null);
    api
      .adminWaUnmatched()
      .then(setItems)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'No se pudo cargar la bandeja.'));
  }, []);

  useEffect(cargar, [cargar]);

  const resolver = async (id: string, accion: () => Promise<unknown>) => {
    setOcupado(id);
    try {
      await accion();
      setItems((xs) => (xs ?? []).filter((x) => x.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.');
    } finally {
      setOcupado(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-brand-ink">Mensajes sin dueño</h2>
          <p className="text-sm text-brand-ink/60">
            Respuestas de WhatsApp que no se pudieron ligar a un cliente con certeza. Asígnalas al cliente correcto o descártalas.
          </p>
        </div>
        <button
          type="button"
          onClick={cargar}
          className="inline-flex items-center gap-2 rounded-xl border border-brand-ink/15 px-3 py-2 text-sm"
        >
          <RefreshCw size={14} /> Actualizar
        </button>
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {items === null && !error && (
        <p role="status" className="flex items-center gap-2 text-sm text-brand-ink/60">
          <Loader2 size={14} className="animate-spin" /> Cargando…
        </p>
      )}

      {items?.length === 0 && (
        <p className="rounded-xl border border-brand-ink/10 px-4 py-6 text-center text-sm text-brand-ink/60">
          No hay mensajes pendientes.
        </p>
      )}

      <ul className="space-y-3">
        {items?.map((m) => (
          <li key={m.id} className="rounded-2xl border border-brand-ink/10 bg-white p-4">
            <div className="flex items-start gap-3">
              <MessageSquare size={18} className="mt-0.5 text-brand-ink/50" />
              <div className="min-w-0 flex-1">
                <div className="text-xs text-brand-ink/50">
                  {m.from ?? 'Número desconocido'} · {new Date(m.receivedAt).toLocaleString('es-MX')} ·{' '}
                  {m.reason === 'AMBIGUOUS' ? 'El teléfono es de varios clientes' : 'El teléfono no es de ningún cliente'}
                </div>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm text-brand-ink">{m.text}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {m.candidates.map((c) => (
                    <button
                      key={c.customerId}
                      type="button"
                      disabled={ocupado === m.id}
                      onClick={() => void resolver(m.id, () => api.adminWaAssign(m.id, c.customerId))}
                      className="rounded-xl bg-brand-ink px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      Asignar a {c.customerName || 'cliente'} ({c.organizationName || 'organización'})
                    </button>
                  ))}
                  <button
                    type="button"
                    disabled={ocupado === m.id}
                    onClick={() => void resolver(m.id, () => api.adminWaDismiss(m.id))}
                    className="rounded-xl border border-brand-ink/15 px-3 py-1.5 text-xs disabled:opacity-50"
                  >
                    Descartar
                  </button>
                </div>
                {m.reason === 'NO_CANDIDATES' && (
                  <p className="mt-2 text-xs text-brand-ink/50">
                    Si es de un cliente con un teléfono nuevo, pídele a esa organización que lo actualice en su ficha.
                  </p>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
