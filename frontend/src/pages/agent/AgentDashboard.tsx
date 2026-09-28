import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'motion/react';
import {
  LogOut, Phone, Mail, MessageCircle, Clock, CheckCircle2, XCircle,
  AlertTriangle, Loader2, User as UserIcon, ChevronRight,
} from 'lucide-react';
import type { User as FirebaseUser } from 'firebase/auth';
import { api, type AgentAccountItem, type AgentAccountStatus } from '../../services/apiClient.ts';

/**
 * Pantalla ultra-simplificada del perfil Agente/Ejecutivo (spec "Mejoras
 * V1", sección 2 — "Diseño UX para la Eficiencia Operativa"). A propósito
 * NO reutiliza el shell del portal corporativo (sin sidebar, sin pestañas,
 * sin menú de configuración): solo lo que el spec pide —
 *   - Identidad del cliente y saldo.
 *   - Motor de contactabilidad por zona horaria (FR-01): si se puede
 *     contactar AHORA o por qué no (fuera de horario, blackout, opt-out).
 *   - Canal de respuesta prioritario.
 * Reduce tiempo de capacitación y error humano; la complejidad analítica
 * (KPIs, buckets, simulaciones) vive en el portal de Supervisor/Admin.
 */

const CHANNEL_LABEL: Record<string, string> = {
  WHATSAPP: 'WhatsApp',
  EMAIL: 'Correo',
  SMS: 'SMS',
  PHONE: 'Llamada',
};

const CHANNEL_ICON: Record<string, React.ElementType> = {
  WHATSAPP: MessageCircle,
  EMAIL: Mail,
  SMS: MessageCircle,
  PHONE: Phone,
};

const BLOCKED_REASON_LABEL: Record<string, string> = {
  DO_NOT_CONTACT: 'Cliente pidió no ser contactado',
  OUTSIDE_HOURS: 'Fuera del horario permitido',
  BLACKOUT_DATE: 'Hoy es fecha bloqueada (feriado/acuerdo)',
};

const STATUS_OPTIONS: { value: AgentAccountStatus; label: string }[] = [
  { value: 'CONTACTED', label: 'Contactado' },
  { value: 'NO_ANSWER', label: 'No contestó' },
  { value: 'PROMISE_TO_PAY', label: 'Promesa de pago' },
  { value: 'DISPUTE', label: 'Disputa / aclaración' },
  { value: 'ESCALATE_TO_SUPERVISOR', label: 'Escalar a supervisor' },
];

function money(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency }).format(amount);
  } catch {
    return `$${amount.toLocaleString('es-MX', { minimumFractionDigits: 2 })} ${currency}`;
  }
}

export function AgentDashboard({
  user,
  onLogout,
}: {
  user: FirebaseUser;
  onLogout: () => void;
}) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<AgentAccountItem | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['agent-my-accounts'],
    queryFn: () => api.getMyAgentAccounts(),
    refetchInterval: 60_000, // la contactabilidad cambia con la hora; se refresca sola
  });

  const items = data?.items ?? [];

  return (
    <div className="min-h-screen bg-brand-paper flex flex-col">
      <header className="bg-brand-ink text-white px-4 py-3 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-2">
          <UserIcon size={20} className="opacity-70" />
          <div>
            <p className="text-sm font-semibold leading-tight">{user.displayName || 'Agente'}</p>
            <p className="text-xs opacity-60 leading-tight">Mis cuentas asignadas</p>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="p-2 rounded-lg hover:bg-white/10 transition-colors"
          aria-label="Cerrar sesión"
        >
          <LogOut size={18} />
        </button>
      </header>

      {data && (
        <div className="px-4 py-3 bg-white border-b border-brand-sand/60 flex gap-4 text-sm">
          <span className="text-brand-ink/70">
            <strong className="text-brand-ink">{data.total}</strong> cuentas asignadas
          </span>
          <span className="text-green-700">
            <strong>{data.contactableNow}</strong> contactables ahora
          </span>
        </div>
      )}

      <main className="flex-1 p-4 space-y-3 max-w-lg mx-auto w-full">
        {isLoading && (
          <div className="flex items-center justify-center py-16 text-brand-ink/50">
            <Loader2 className="animate-spin" size={28} />
          </div>
        )}

        {isError && (
          <div className="bg-red-50 text-red-700 rounded-xl p-4 text-sm">
            No se pudieron cargar tus cuentas. <button onClick={() => refetch()} className="underline font-medium">Reintentar</button>
          </div>
        )}

        {!isLoading && !isError && items.length === 0 && (
          <div className="text-center py-16 text-brand-ink/50">
            <p className="font-medium">No tienes cuentas asignadas todavía.</p>
            <p className="text-sm mt-1">Tu supervisor te las va a ir asignando.</p>
          </div>
        )}

        {items.map((item) => {
          const ChannelIcon = item.priorityChannel ? CHANNEL_ICON[item.priorityChannel] : MessageCircle;
          return (
            <button
              key={item.customerId}
              onClick={() => setSelected(item)}
              className="w-full text-left bg-white rounded-2xl p-4 shadow-sm border border-brand-sand/50 hover:border-brand-ink/30 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-brand-ink truncate">{item.name}</p>
                  <p className="text-2xl font-bold text-brand-ink mt-0.5">
                    {money(item.balance, item.currency)}
                  </p>
                  <p className="text-xs text-brand-ink/50 mt-0.5">
                    {item.invoiceCount} factura{item.invoiceCount !== 1 ? 's' : ''} · {item.daysOverdue} día{item.daysOverdue !== 1 ? 's' : ''} de atraso
                  </p>
                </div>
                <ChevronRight size={18} className="text-brand-ink/30 shrink-0 mt-1" />
              </div>

              <div className="flex items-center gap-2 mt-3 flex-wrap">
                {item.canContactNow ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-1 rounded-full">
                    <CheckCircle2 size={13} /> Puedes contactar ahora
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 px-2 py-1 rounded-full">
                    <XCircle size={13} /> {item.blockedReason ? BLOCKED_REASON_LABEL[item.blockedReason] : 'No contactable'}
                  </span>
                )}
                {item.priorityChannel && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-brand-ink/70 bg-brand-sand/40 px-2 py-1 rounded-full">
                    <ChannelIcon size={13} /> {CHANNEL_LABEL[item.priorityChannel] ?? item.priorityChannel}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </main>

      <AnimatePresence>
        {selected && (
          <AccountActionSheet
            item={selected}
            onClose={() => setSelected(null)}
            onStatusSaved={() => {
              setSelected(null);
              queryClient.invalidateQueries({ queryKey: ['agent-my-accounts'] });
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function AccountActionSheet({
  item,
  onClose,
  onStatusSaved,
}: {
  item: AgentAccountItem;
  onClose: () => void;
  onStatusSaved: () => void;
}) {
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState<AgentAccountStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (status: AgentAccountStatus) => {
    setSaving(status);
    setError(null);
    try {
      await api.updateAgentAccountStatus(item.customerId, status, note.trim() || undefined);
      onStatusSaved();
    } catch {
      setError('No se pudo guardar. Intenta de nuevo.');
      setSaving(null);
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/40 z-20"
      />
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl z-30 p-5 max-w-lg mx-auto shadow-2xl max-h-[85vh] overflow-y-auto"
      >
        <div className="w-10 h-1 bg-brand-sand rounded-full mx-auto mb-4" />
        <h2 className="font-bold text-lg text-brand-ink">{item.name}</h2>
        <p className="text-brand-ink/60 text-sm">{money(item.balance, item.currency)} · {item.daysOverdue} días de atraso</p>

        <div className="flex gap-2 mt-4">
          {item.phone && (
            <a href={`tel:${item.phone}`} className="flex-1 flex items-center justify-center gap-1.5 bg-brand-sand/40 rounded-xl py-2.5 text-sm font-medium text-brand-ink">
              <Phone size={15} /> Llamar
            </a>
          )}
          {item.phone && (
            <a
              href={`https://wa.me/${item.phone.replace('+', '')}`}
              target="_blank"
              rel="noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 bg-green-50 text-green-700 rounded-xl py-2.5 text-sm font-medium"
            >
              <MessageCircle size={15} /> WhatsApp
            </a>
          )}
          {item.email && (
            <a href={`mailto:${item.email}`} className="flex-1 flex items-center justify-center gap-1.5 bg-brand-sand/40 rounded-xl py-2.5 text-sm font-medium text-brand-ink">
              <Mail size={15} /> Correo
            </a>
          )}
        </div>

        {!item.canContactNow && item.blockedReason && (
          <div className="mt-3 flex items-center gap-2 text-amber-700 bg-amber-50 rounded-xl px-3 py-2 text-xs">
            <AlertTriangle size={14} className="shrink-0" />
            {BLOCKED_REASON_LABEL[item.blockedReason]}
          </div>
        )}

        <p className="text-sm font-medium text-brand-ink mt-5 mb-2">¿Qué pasó en este contacto?</p>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Nota (opcional)"
          rows={2}
          className="w-full border border-brand-sand rounded-xl px-3 py-2 text-sm mb-3 resize-none"
        />
        <div className="grid grid-cols-1 gap-2">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              disabled={saving !== null}
              onClick={() => handleSave(opt.value)}
              className="flex items-center justify-between border border-brand-sand rounded-xl px-4 py-3 text-sm font-medium text-brand-ink hover:bg-brand-paper transition-colors disabled:opacity-50"
            >
              {opt.label}
              {saving === opt.value ? <Loader2 size={15} className="animate-spin" /> : <Clock size={14} className="opacity-30" />}
            </button>
          ))}
        </div>
        {error && <p className="text-red-600 text-xs mt-2">{error}</p>}
      </motion.div>
    </>
  );
}
