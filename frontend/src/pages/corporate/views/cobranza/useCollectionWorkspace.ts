import React from 'react';
import { api } from '../../../../services/apiClient.ts';
import { EMPTY_WORKSPACE, type CollectionWorkspace } from '../../../../services/collectionWorkspace.ts';

type Change = (current: CollectionWorkspace) => Partial<Omit<CollectionWorkspace, 'revision'>>;

/** No escribe defaults al montar. Cada cambio espera la confirmación del servidor. */
export function useCollectionWorkspace() {
  const [data, setData] = React.useState<CollectionWorkspace>(EMPTY_WORKSPACE);
  const [ready, setReady] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const current = React.useRef<CollectionWorkspace | null>(null);
  const queue = React.useRef<Promise<unknown>>(Promise.resolve());
  const mounted = React.useRef(true);
  const generation = React.useRef(0);
  const load = React.useCallback(async () => {
    const request = ++generation.current;
    current.current = null; setReady(false);
    try {
      const value = await api.getCollectionWorkspace();
      if (!mounted.current || request !== generation.current) return;
      current.current = value; setData(value); setReady(true); setError(null);
    } catch {
      if (mounted.current && request === generation.current) { setError('No se pudieron cargar tus datos de cobranza. Recarga para volver a intentar.'); setReady(false); }
    }
  }, []);
  React.useEffect(() => { mounted.current = true; void load(); return () => { mounted.current = false; current.current = null; }; }, [load]);
  const update = React.useCallback((change: Change): Promise<void> => {
    const task = queue.current.then(async () => {
      if (!current.current) throw new Error('Recarga tus datos de cobranza antes de guardar.');
      setBusy(true);
      try {
        const value = await api.updateCollectionWorkspace({ ...change(current.current), revision: current.current.revision });
        if (!mounted.current) return;
        current.current = value; setData(value); setError(null);
      } catch (e) {
        // Un conflicto o una respuesta perdida exige releer antes de otro cambio.
        current.current = null;
        if (mounted.current) { setReady(false); setError(e instanceof Error ? e.message : 'No se pudo guardar. Recarga para volver a intentar.'); }
        throw e;
      } finally { if (mounted.current) setBusy(false); }
    });
    queue.current = task.catch(() => undefined);
    return task;
  }, []);
  return { data, ready, error, busy, update, reload: load };
}
