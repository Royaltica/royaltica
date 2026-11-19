import React from 'react';
import { api, type OrgSettings } from '../../../../services/apiClient.ts';

type Section = 'collectionCompany' | 'collectionNotifications';
export function useCollectionSettings<K extends Section>(section: K) {
  const [data, setData] = React.useState<OrgSettings[K] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [attempt, setAttempt] = React.useState(0);
  React.useEffect(() => {
    let active = true;
    setData(null); setError(null);
    api.getSettings().then((value) => { if (active) setData(value[section]); })
      .catch(() => { if (active) setError('No se pudo cargar la configuración.'); });
    return () => { active = false; };
  }, [section, attempt]);
  const save = async () => {
    if (!data || busy) return false;
    setBusy(true); setError(null);
    try {
      const result = await api.updateSettings({ [section]: data });
      setData(result[section]); return true;
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar la configuración.'); return false; }
    finally { setBusy(false); }
  };
  return { data, setData, error, busy, save, retry: () => setAttempt((n) => n + 1) };
}
