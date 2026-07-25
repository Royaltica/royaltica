import React, { useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  Loader2,
  Mail,
  MessageSquare,
  Phone,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react';
import { api, type LeadRecord } from '../../services/apiClient';

/**
 * Panel de administración de leads capturados en royaltica.com
 * (demo requests + contact form).
 *
 * Requiere JWT con rol SUPERADMIN. Se monta en el AdminDashboard
 * (ver instrucciones al final de docs/CHANGES.md para wire-up).
 */

type LeadType = 'DEMO' | 'CONTACT' | 'ALL';
type LeadStatus =
  | 'NEW'
  | 'CONTACTED'
  | 'QUALIFIED'
  | 'CONVERTED'
  | 'DISCARDED'
  | 'ALL';

const STATUS_LABELS: Record<Exclude<LeadStatus, 'ALL'>, string> = {
  NEW: 'Nuevo',
  CONTACTED: 'Contactado',
  QUALIFIED: 'Calificado',
  CONVERTED: 'Convertido',
  DISCARDED: 'Descartado',
};

const STATUS_COLORS: Record<Exclude<LeadStatus, 'ALL'>, string> = {
  NEW: 'bg-blue-50 text-blue-700 border-blue-200',
  CONTACTED: 'bg-yellow-50 text-yellow-800 border-yellow-200',
  QUALIFIED: 'bg-purple-50 text-purple-700 border-purple-200',
  CONVERTED: 'bg-green-50 text-green-700 border-green-200',
  DISCARDED: 'bg-gray-50 text-gray-600 border-gray-200',
};

export function LeadsAdminPanel() {
  const [type, setType] = useState<LeadType>('ALL');
  const [status, setStatus] = useState<LeadStatus>('ALL');
  const [search, setSearch] = useState('');
  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [summary, setSummary] = useState<{
    total: number;
    byStatus: Record<string, number>;
    byType: Record<string, number>;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<LeadRecord | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [resList, resSum] = await Promise.all([
        api.listLeads({
          type: type === 'ALL' ? undefined : type,
          status: status === 'ALL' ? undefined : status,
          search: search.trim() || undefined,
          limit: 100,
        }),
        api.getLeadsSummary(),
      ]);
      setLeads(resList.data);
      setTotal(resList.total);
      setSummary(resSum);
    } catch (err) {
      console.error('Error cargando leads:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, status]);

  const filteredCount = useMemo(() => leads.length, [leads]);

  const updateStatus = async (
    id: string,
    newStatus: Exclude<LeadStatus, 'ALL'>,
    note?: string,
  ) => {
    setSavingId(id);
    try {
      const updated = await api.updateLeadStatus(id, {
        status: newStatus,
        note,
      });
      setLeads((prev) => prev.map((l) => (l.id === id ? updated : l)));
      if (selected?.id === id) setSelected(updated);
      void load(); // refresca summary
    } finally {
      setSavingId(null);
    }
  };

  const removeLead = async (id: string) => {
    if (!confirm('¿Eliminar este lead? Esta acción es permanente.')) return;
    await api.deleteLead(id);
    setLeads((prev) => prev.filter((l) => l.id !== id));
    if (selected?.id === id) setSelected(null);
    void load();
  };

  return (
    <div className="space-y-6">
      {/* Header + summary */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif text-brand-ink">Leads</h1>
          <p className="text-[11px] text-brand-ink/50 uppercase tracking-widest mt-1">
            Prospectos desde royaltica.com
          </p>
        </div>
        <div className="flex gap-4 text-sm">
          <SummaryPill label="Total" value={summary?.total ?? '—'} />
          <SummaryPill
            label="Nuevos"
            value={summary?.byStatus?.NEW ?? 0}
            tint="blue"
          />
          <SummaryPill
            label="Contactados"
            value={summary?.byStatus?.CONTACTED ?? 0}
            tint="yellow"
          />
          <SummaryPill
            label="Convertidos"
            value={summary?.byStatus?.CONVERTED ?? 0}
            tint="green"
          />
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <FilterPills
          label="Tipo"
          value={type}
          onChange={setType}
          options={[
            { value: 'ALL', label: 'Todos' },
            { value: 'DEMO', label: 'Demo' },
            { value: 'CONTACT', label: 'Contacto' },
          ]}
        />
        <FilterPills
          label="Estado"
          value={status}
          onChange={setStatus}
          options={[
            { value: 'ALL', label: 'Todos' },
            { value: 'NEW', label: 'Nuevo' },
            { value: 'CONTACTED', label: 'Contactado' },
            { value: 'QUALIFIED', label: 'Calificado' },
            { value: 'CONVERTED', label: 'Convertido' },
            { value: 'DISCARDED', label: 'Descartado' },
          ]}
        />
        <div className="relative flex-1 min-w-[220px]">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-ink/40"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load()}
            placeholder="Buscar nombre / empresa / correo…"
            className="w-full pl-9 pr-3 py-2 bg-white border border-brand-sand rounded-lg text-sm focus:outline-none focus:border-brand-gold"
          />
        </div>
        <button
          onClick={() => load()}
          className="flex items-center gap-2 px-4 py-2 bg-brand-ink text-brand-bone rounded-lg text-[10px] uppercase font-bold tracking-widest hover:bg-black transition"
        >
          {loading ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <RefreshCw size={13} />
          )}
          Refrescar
        </button>
      </div>

      {/* Lista + detalle */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-6">
        <div className="border border-brand-sand rounded-2xl bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-brand-sand flex items-center justify-between text-[10px] uppercase tracking-widest text-brand-ink/50">
            <span>Leads</span>
            <span>
              {filteredCount} / {total}
            </span>
          </div>
          <div className="max-h-[70vh] overflow-y-auto">
            {loading && leads.length === 0 ? (
              <div className="p-8 text-center text-sm text-brand-ink/50">
                Cargando…
              </div>
            ) : leads.length === 0 ? (
              <div className="p-8 text-center text-sm text-brand-ink/50">
                No hay leads con estos filtros.
              </div>
            ) : (
              leads.map((lead) => (
                <button
                  key={lead.id}
                  onClick={() => setSelected(lead)}
                  className={`w-full text-left px-4 py-3 border-b border-brand-sand/50 hover:bg-brand-cream/40 transition ${
                    selected?.id === lead.id ? 'bg-brand-cream/60' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {lead.type === 'DEMO' ? (
                          <Calendar size={12} className="text-brand-gold" />
                        ) : (
                          <MessageSquare
                            size={12}
                            className="text-brand-ink/50"
                          />
                        )}
                        <span className="text-sm font-medium text-brand-ink truncate">
                          {lead.name}
                        </span>
                        {lead.company && (
                          <span className="text-xs text-brand-ink/50 truncate">
                            · {lead.company}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-brand-ink/60 mt-0.5 truncate">
                        {lead.email}
                      </div>
                    </div>
                    <span
                      className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border ${
                        STATUS_COLORS[lead.status]
                      }`}
                    >
                      {STATUS_LABELS[lead.status]}
                    </span>
                  </div>
                  <div className="text-[10px] text-brand-ink/40 mt-1">
                    {new Date(lead.createdAt).toLocaleString('es-MX', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="border border-brand-sand rounded-2xl bg-white p-6 min-h-[60vh]">
          {selected ? (
            <LeadDetail
              lead={selected}
              saving={savingId === selected.id}
              onStatusChange={(s, note) => updateStatus(selected.id, s, note)}
              onDelete={() => removeLead(selected.id)}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-center text-sm text-brand-ink/40">
              Selecciona un lead a la izquierda para ver el detalle.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryPill({
  label,
  value,
  tint,
}: {
  label: string;
  value: number | string;
  tint?: 'blue' | 'yellow' | 'green';
}) {
  const color =
    tint === 'blue'
      ? 'text-blue-700'
      : tint === 'yellow'
        ? 'text-yellow-800'
        : tint === 'green'
          ? 'text-green-700'
          : 'text-brand-ink';
  return (
    <div className="text-center">
      <div className={`text-2xl font-serif ${color}`}>{value}</div>
      <div className="text-[9px] uppercase tracking-widest text-brand-ink/50">
        {label}
      </div>
    </div>
  );
}

function FilterPills<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: string }>;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[9px] uppercase tracking-widest text-brand-ink/50">
        {label}
      </span>
      <div className="flex gap-1 bg-brand-cream rounded-lg p-1">
        {options.map((o) => (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-md transition ${
              value === o.value
                ? 'bg-white text-brand-ink shadow-sm'
                : 'text-brand-ink/50 hover:text-brand-ink'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function LeadDetail({
  lead,
  saving,
  onStatusChange,
  onDelete,
}: {
  lead: LeadRecord;
  saving: boolean;
  onStatusChange: (
    status: Exclude<LeadStatus, 'ALL'>,
    note?: string,
  ) => Promise<void> | void;
  onDelete: () => void;
}) {
  const [note, setNote] = useState('');
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-serif text-brand-ink">{lead.name}</h2>
          {lead.company && (
            <p className="text-sm text-brand-ink/60 mt-0.5">{lead.company}</p>
          )}
          {lead.jobTitle && (
            <p className="text-[11px] text-brand-ink/40 uppercase tracking-widest mt-0.5">
              {lead.jobTitle}
            </p>
          )}
        </div>
        <span
          className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded border ${
            STATUS_COLORS[lead.status]
          }`}
        >
          {STATUS_LABELS[lead.status]}
        </span>
      </div>

      <div className="space-y-2 text-sm">
        <a
          href={`mailto:${lead.email}`}
          className="flex items-center gap-2 text-brand-ink hover:text-brand-gold transition"
        >
          <Mail size={14} className="text-brand-ink/40" />
          {lead.email}
        </a>
        {lead.phone && (
          <a
            href={`tel:${lead.phone}`}
            className="flex items-center gap-2 text-brand-ink hover:text-brand-gold transition"
          >
            <Phone size={14} className="text-brand-ink/40" />
            {lead.phone}
          </a>
        )}
        {lead.preferredDate && (
          <div className="flex items-center gap-2 text-brand-ink/70">
            <Calendar size={14} className="text-brand-ink/40" />
            <span>
              Fecha preferida:{' '}
              <strong>
                {new Date(lead.preferredDate).toLocaleDateString('es-MX')}
              </strong>{' '}
              {lead.preferredTime && `· ${lead.preferredTime}`}
            </span>
          </div>
        )}
        {typeof lead.companySize === 'number' && (
          <div className="text-brand-ink/70 text-[13px]">
            Tamaño: <strong>{lead.companySize}+</strong> empleados
          </div>
        )}
        {lead.source && (
          <div className="text-[11px] text-brand-ink/40 truncate">
            Origen: {lead.source}
          </div>
        )}
      </div>

      {lead.subject && (
        <div>
          <div className="text-[10px] uppercase tracking-widest text-brand-ink/40 mb-1">
            Asunto
          </div>
          <div className="text-sm text-brand-ink">{lead.subject}</div>
        </div>
      )}

      {lead.message && (
        <div>
          <div className="text-[10px] uppercase tracking-widest text-brand-ink/40 mb-1">
            Mensaje / Historial
          </div>
          <pre className="text-sm text-brand-ink/80 bg-brand-cream/50 rounded-lg p-3 whitespace-pre-wrap font-sans">
            {lead.message}
          </pre>
        </div>
      )}

      <div className="pt-4 border-t border-brand-sand space-y-3">
        <div className="text-[10px] uppercase tracking-widest text-brand-ink/40">
          Cambiar estado
        </div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Nota interna (opcional) — se agrega al historial…"
          rows={2}
          className="w-full px-3 py-2 bg-white border border-brand-sand rounded-lg text-sm focus:outline-none focus:border-brand-gold resize-none"
        />
        <div className="flex flex-wrap gap-2">
          {(
            ['CONTACTED', 'QUALIFIED', 'CONVERTED', 'DISCARDED'] as const
          ).map((s) => (
            <button
              key={s}
              disabled={saving || lead.status === s}
              onClick={() => {
                onStatusChange(s, note || undefined);
                setNote('');
              }}
              className={`text-[10px] font-bold uppercase tracking-widest px-3 py-2 rounded-lg border transition disabled:opacity-40 disabled:cursor-not-allowed ${
                STATUS_COLORS[s]
              } hover:opacity-80`}
            >
              {saving ? '…' : `Marcar ${STATUS_LABELS[s]}`}
            </button>
          ))}
        </div>
      </div>

      <div className="pt-4 border-t border-brand-sand flex justify-end">
        <button
          onClick={onDelete}
          className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-widest text-red-600 hover:text-red-700 transition"
        >
          <Trash2 size={12} />
          Eliminar lead
        </button>
      </div>
    </div>
  );
}
