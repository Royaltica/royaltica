import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Clock,
  Database,
  FileInput,
  Loader2,
  Pause,
  Play,
  ShieldCheck,
  UploadCloud,
  XCircle,
} from 'lucide-react';
import {
  api,
  type AiActionItem,
  type BankReviewQueue,
  type CollectionCommandCenter,
  type ExternalSyncStatus,
  type OrgReadiness,
  type ProductionReadiness,
} from '../../../services/apiClient.ts';

type Section = 'onboarding' | 'collections' | 'integrations' | 'bank' | 'ai' | 'hardening';

const sections: { id: Section; label: string }[] = [
  { id: 'onboarding', label: 'Onboarding' },
  { id: 'collections', label: 'Cobranza' },
  { id: 'integrations', label: 'Integraciones' },
  { id: 'bank', label: 'Conciliación' },
  { id: 'ai', label: 'AI Inbox' },
  { id: 'hardening', label: 'Hardening' },
];

export function GrowthOpsView() {
  const [section, setSection] = React.useState<Section>('onboarding');

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase font-bold tracking-[0.24em] text-brand-ink/40">
            Growth Ops
          </p>
          <h2 className="text-3xl font-serif text-brand-ink mt-1">Crecimiento del producto</h2>
          <p className="text-sm text-brand-ink/50 max-w-2xl mt-2">
            Superficie operativa para convertir capacidades técnicas en onboarding, cobranza,
            integraciones, conciliación, AI controlada y seguridad de producción.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              className={`px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest border transition-colors ${
                section === s.id
                  ? 'bg-brand-ink text-brand-paper border-brand-ink'
                  : 'bg-white text-brand-ink/60 border-brand-sand hover:text-brand-ink'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {section === 'onboarding' && <OnboardingPanel />}
      {section === 'collections' && <CollectionsCommandPanel />}
      {section === 'integrations' && <IntegrationWizardPanel />}
      {section === 'bank' && <BankReconciliationPanel />}
      {section === 'ai' && <AiActionsPanel />}
      {section === 'hardening' && <HardeningPanel />}
    </div>
  );
}

function OnboardingPanel() {
  const { data, isLoading: loading } = useQuery<OrgReadiness>({
    queryKey: ['orgReadiness'],
    queryFn: () => api.getOrgReadiness(),
  });

  if (loading) return <LoadingCard label="Calculando checklist de tenant..." />;
  if (!data) return <EmptyCard label="No se pudo cargar el checklist." />;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-5">
      <ScorePanel title="Tenant listo" percent={data.percent} done={`${data.completed}/${data.total}`} />
      <div className="editorial-card space-y-3">
        {data.items.map((item) => (
          <ChecklistRow key={item.key} ok={item.status} label={item.label} detail={item.detail} />
        ))}
      </div>
    </div>
  );
}

function CollectionsCommandPanel() {
  const queryClient = useQueryClient();
  const [busy, setBusy] = React.useState<string | null>(null);

  const { data } = useQuery<CollectionCommandCenter | null>({
    queryKey: ['collectionCommandCenter'],
    queryFn: () => api.getCollectionCommandCenter(),
  });

  const act = async (id: string, action: 'pause' | 'resume' | 'cancel') => {
    setBusy(id);
    try {
      if (action === 'pause') await api.pauseCollectionRun(id);
      if (action === 'resume') await api.resumeCollectionRun(id);
      if (action === 'cancel') await api.cancelCollectionRun(id);
      await queryClient.invalidateQueries({ queryKey: ['collectionCommandCenter'] });
    } finally {
      setBusy(null);
    }
  };

  if (!data) return <LoadingCard label="Cargando command center de cobranza..." />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MiniMetric label="Runs" value={data.total} />
        <MiniMetric label="Activos" value={data.active} />
        <MiniMetric label="Escalados" value={data.escalated} />
        <MiniMetric label="Requieren humano" value={data.needsHuman} danger={data.needsHuman > 0} />
      </div>
      <div className="space-y-3">
        {data.items.length === 0 ? (
          <EmptyCard label="No hay secuencias de cobranza activas todavía." />
        ) : (
          data.items.map((item) => (
            <div key={item.id} className="editorial-card !p-5 flex flex-col lg:flex-row lg:items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`w-2 h-2 rounded-full ${item.needsHuman ? 'bg-red-500' : 'bg-emerald-500'}`} />
                  <p className="text-sm font-bold text-brand-ink truncate">
                    {item.invoice.customer?.name ?? 'Cliente sin nombre'} · {item.invoice.folio ?? item.invoice.id.slice(0, 8)}
                  </p>
                  <span className="text-[9px] uppercase font-bold tracking-widest text-brand-ink/40">
                    {item.status}
                  </span>
                </div>
                <p className="text-xs text-brand-ink/50 mt-1">
                  Paso {item.currentStepOrder} · {item.daysOverdue} día(s) vencida · {item.policy.name}
                </p>
              </div>
              <p className="text-sm font-bold text-brand-ink">
                {new Intl.NumberFormat('en-CA', { style: 'currency', currency: item.invoice.currency }).format(item.invoice.total)}
              </p>
              <div className="flex gap-2">
                <IconButton title="Pausar" disabled={busy === item.id} onClick={() => act(item.id, 'pause')} icon={<Pause size={14} />} />
                <IconButton title="Reanudar" disabled={busy === item.id} onClick={() => act(item.id, 'resume')} icon={<Play size={14} />} />
                <IconButton title="Cancelar" disabled={busy === item.id} onClick={() => act(item.id, 'cancel')} icon={<XCircle size={14} />} />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function IntegrationWizardPanel() {
  const [status, setStatus] = React.useState<ExternalSyncStatus | null>(null);
  const [provider, setProvider] = React.useState('generic-csv');
  const [baseUrl, setBaseUrl] = React.useState('');
  const [authHeader, setAuthHeader] = React.useState('');
  const [entity, setEntity] = React.useState<'CUSTOMER' | 'RECEIVABLE'>('CUSTOMER');
  const [mapping, setMapping] = React.useState('{}');
  const [file, setFile] = React.useState<File | null>(null);
  const [message, setMessage] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    const [s, settings] = await Promise.all([api.getExternalSyncStatus(), api.getSettings()]);
    setStatus(s);
    setProvider(settings.externalSyncProvider ?? 'generic-csv');
    setBaseUrl(settings.externalSyncRestBaseUrl ?? '');
    setAuthHeader(settings.externalSyncRestAuthHeader ?? '');
    const m = await api.getFieldMapping(entity);
    setMapping(JSON.stringify(m.mapping, null, 2));
  }, [entity]);

  React.useEffect(() => { void load(); }, [load]);

  const save = async () => {
    setBusy(true); setMessage('');
    try {
      await api.updateSettings({
        externalSyncProvider: provider,
        externalSyncRestBaseUrl: baseUrl || null,
        externalSyncRestAuthHeader: authHeader || null,
      });
      await api.setFieldMapping(entity, JSON.parse(mapping) as Record<string, string>);
      setMessage('Integración guardada.');
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'No se pudo guardar.');
    } finally {
      setBusy(false);
    }
  };

  const runImport = async () => {
    setBusy(true); setMessage('');
    try {
      const result = entity === 'CUSTOMER'
        ? await api.syncExternalCustomers(file ?? undefined)
        : await api.syncExternalReceivables(file ?? undefined);
      setMessage(result.message);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'No se pudo importar.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-5">
      <div className="editorial-card space-y-4">
        <HeaderIcon icon={<Database size={18} />} title="Integration Wizard" subtitle={status?.message ?? 'Carga CSV o REST configurable.'} />
        <Field label="Conector">
          <select className={inputCls} value={provider} onChange={(e) => setProvider(e.target.value)}>
            <option value="generic-csv">CSV universal</option>
            <option value="generic-rest">REST configurable</option>
          </select>
        </Field>
        <Field label="REST base URL">
          <input className={inputCls} value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://api.sistema.com" />
        </Field>
        <Field label="REST auth header">
          <input className={inputCls} value={authHeader} onChange={(e) => setAuthHeader(e.target.value)} placeholder="Bearer ..." />
        </Field>
        <button className={primaryBtn} disabled={busy} onClick={save}>
          {busy ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Guardar configuración
        </button>
      </div>

      <div className="editorial-card space-y-4">
        <div className="flex flex-wrap gap-2">
          {(['CUSTOMER', 'RECEIVABLE'] as const).map((e) => (
            <button key={e} className={`${smallBtn} ${entity === e ? 'bg-brand-ink text-brand-paper' : 'bg-white'}`} onClick={() => setEntity(e)}>
              {e === 'CUSTOMER' ? 'Clientes' : 'Facturas CxC'}
            </button>
          ))}
        </div>
        <Field label="Mapeo JSON">
          <textarea className={`${inputCls} min-h-48 font-mono text-xs`} value={mapping} onChange={(e) => setMapping(e.target.value)} />
        </Field>
        <Field label="Archivo CSV opcional">
          <input type="file" accept=".csv,text/csv" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-xs" />
        </Field>
        <button className={primaryBtn} disabled={busy} onClick={runImport}>
          {busy ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14} />} Importar {entity === 'CUSTOMER' ? 'clientes' : 'facturas'}
        </button>
        {message && <p className="text-xs text-brand-ink/60">{message}</p>}
      </div>
    </div>
  );
}

function BankReconciliationPanel() {
  const queryClient = useQueryClient();
  const [file, setFile] = React.useState<File | null>(null);
  const [bankName, setBankName] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const { data: queue } = useQuery<BankReviewQueue | null>({
    queryKey: ['bankReviewQueue'],
    queryFn: () => api.getBankReviewQueue(),
  });

  const reload = () => queryClient.invalidateQueries({ queryKey: ['bankReviewQueue'] });

  const upload = async () => {
    if (!file) return;
    setBusy(true); setMessage('');
    try {
      const res = await api.importBankStatement(file, bankName || undefined);
      setMessage(`Importadas ${res.imported}, auto-match ${res.autoMatched}, ambiguas ${res.ambiguous}.`);
      setFile(null);
      await reload();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'No se pudo importar.');
    } finally {
      setBusy(false);
    }
  };

  const confirm = async (id: string, invoiceId?: string | null) => {
    setBusy(true);
    try {
      await api.confirmBankMatch(id, invoiceId ?? undefined);
      await reload();
    } finally {
      setBusy(false);
    }
  };

  const reject = async (id: string) => {
    setBusy(true);
    try {
      await api.rejectBankMatch(id);
      await reload();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="editorial-card flex flex-col lg:flex-row gap-4 lg:items-end">
        <Field label="Banco">
          <input className={inputCls} value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="RBC / TD / Scotiabank" />
        </Field>
        <Field label="CSV estado de cuenta">
          <input type="file" accept=".csv,text/csv" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-xs" />
        </Field>
        <button className={primaryBtn} disabled={busy || !file} onClick={upload}>
          {busy ? <Loader2 size={14} className="animate-spin" /> : <FileInput size={14} />} Importar y conciliar
        </button>
      </div>
      {message && <p className="text-xs text-brand-ink/60">{message}</p>}
      {queue && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MiniMetric label="Revisión" value={queue.total} />
          <MiniMetric label="Auto-match" value={queue.autoMatched} />
          <MiniMetric label="Ambiguas" value={queue.ambiguous} danger={queue.ambiguous > 0} />
          <MiniMetric label="Sin match" value={queue.unmatched} danger={queue.unmatched > 0} />
        </div>
      )}
      <div className="space-y-3">
        {queue?.items.length ? queue.items.map((tx) => (
          <div key={tx.id} className="editorial-card !p-5 flex flex-col lg:flex-row lg:items-center gap-4">
            <div className="flex-1">
              <p className="text-sm font-bold text-brand-ink">{tx.description}</p>
              <p className="text-xs text-brand-ink/50">{new Date(tx.transactionDate).toLocaleDateString()} · {tx.matchStatus} · confianza {tx.matchConfidence === null ? '-' : `${Math.round(tx.matchConfidence * 100)}%`}</p>
            </div>
            <p className="text-sm font-bold text-brand-ink">{new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(tx.amount)}</p>
            <div className="flex gap-2">
              <button disabled={busy || !tx.matchedInvoiceId} onClick={() => confirm(tx.id, tx.matchedInvoiceId)} className={smallBtn}>Confirmar</button>
              <button disabled={busy} onClick={() => reject(tx.id)} className={smallBtn}>Rechazar</button>
            </div>
          </div>
        )) : <EmptyCard label="No hay transacciones bancarias pendientes de revisión." />}
      </div>
    </div>
  );
}

function AiActionsPanel() {
  const { data: items, isLoading } = useQuery<AiActionItem[]>({
    queryKey: ['aiActionsInbox'],
    queryFn: async () => (await api.getAiActionsInbox()).items,
  });

  if (isLoading) return <LoadingCard label="Cargando decisiones de IA..." />;
  if (!items || items.length === 0) return <EmptyCard label="Aún no hay decisiones de IA registradas en cobranza." />;

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.id} className="editorial-card !p-5">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-gold/15 flex items-center justify-center text-brand-gold">
              <Bot size={16} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-brand-ink">{item.action}</p>
              <p className="text-xs text-brand-ink/50 mt-1">{item.aiReasoning ?? item.reason ?? 'Sin razonamiento capturado.'}</p>
              <p className="text-[10px] uppercase font-bold tracking-widest text-brand-ink/30 mt-3">
                {new Date(item.createdAt).toLocaleString()} · {item.channel ?? 'sin canal'} · {item.tone ?? 'sin tono'}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function HardeningPanel() {
  const { data } = useQuery<ProductionReadiness | null>({
    queryKey: ['productionReadiness'],
    queryFn: () => api.getProductionReadiness(),
  });

  if (!data) return <LoadingCard label="Revisando hardening de producción..." />;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-5">
      <ScorePanel title="Production readiness" percent={data.percent} done={`${data.passed}/${data.total}`} />
      <div className="editorial-card space-y-3">
        {data.items.map((item) => (
          <ChecklistRow key={item.key} ok={item.status} label={item.label} detail={item.detail} />
        ))}
      </div>
    </div>
  );
}

function ScorePanel({ title, percent, done }: { title: string; percent: number; done: string }) {
  return (
    <div className="editorial-card flex flex-col justify-between min-h-48">
      <div>
        <p className="text-[10px] uppercase font-bold tracking-widest text-brand-ink/40">{title}</p>
        <p className="text-5xl font-serif text-brand-ink mt-3">{percent}%</p>
      </div>
      <p className="text-xs text-brand-ink/50">{done} checks completos</p>
    </div>
  );
}

function ChecklistRow({ ok, label, detail }: { key?: string; ok: boolean; label: string; detail: string }) {
  return (
    <div className="flex items-start gap-3 bg-white border border-brand-sand rounded-xl p-4">
      {ok ? <CheckCircle2 size={18} className="text-emerald-600 mt-0.5" /> : <AlertTriangle size={18} className="text-amber-600 mt-0.5" />}
      <div>
        <p className="text-sm font-bold text-brand-ink">{label}</p>
        <p className="text-xs text-brand-ink/50 mt-1">{detail}</p>
      </div>
    </div>
  );
}

function MiniMetric({ label, value, danger = false }: { label: string; value: number; danger?: boolean }) {
  return (
    <div className={`editorial-card !p-4 ${danger ? '!border-red-200 !bg-red-50' : ''}`}>
      <p className="text-[10px] uppercase font-bold tracking-widest text-brand-ink/40">{label}</p>
      <p className={`text-2xl font-serif mt-1 ${danger ? 'text-red-600' : 'text-brand-ink'}`}>{value}</p>
    </div>
  );
}

function HeaderIcon({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-10 h-10 rounded-xl bg-brand-gold/15 flex items-center justify-center text-brand-gold">
        {icon}
      </div>
      <div>
        <h3 className="text-lg font-serif text-brand-ink">{title}</h3>
        <p className="text-xs text-brand-ink/50">{subtitle}</p>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex-1 min-w-0">
      <label className="text-[9px] uppercase font-bold tracking-widest text-brand-ink/40 block mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function LoadingCard({ label }: { label: string }) {
  return (
    <div className="editorial-card flex items-center gap-3 text-brand-ink/50">
      <Loader2 size={18} className="animate-spin" /> <span className="text-sm">{label}</span>
    </div>
  );
}

function EmptyCard({ label }: { label: string }) {
  return (
    <div className="editorial-card text-center py-10 text-sm text-brand-ink/50">
      <Clock size={22} className="mx-auto mb-2 opacity-40" />
      {label}
    </div>
  );
}

function IconButton({ icon, title, onClick, disabled }: { icon: React.ReactNode; title: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" title={title} disabled={disabled} onClick={onClick} className="w-9 h-9 rounded-lg border border-brand-sand bg-white flex items-center justify-center text-brand-ink/60 hover:text-brand-ink hover:border-brand-gold disabled:opacity-40">
      {icon}
    </button>
  );
}

const inputCls = 'w-full px-4 py-3 bg-white border border-brand-sand rounded-xl text-sm focus:outline-none focus:border-brand-gold';
const primaryBtn = 'inline-flex items-center justify-center gap-2 px-5 py-3 bg-brand-ink text-brand-paper rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-brand-gold hover:text-brand-ink transition-colors disabled:opacity-40';
const smallBtn = 'px-3 py-2 rounded-lg border border-brand-sand text-[10px] font-bold uppercase tracking-widest text-brand-ink/70 hover:text-brand-ink hover:border-brand-gold disabled:opacity-40';
