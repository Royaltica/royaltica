import React from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { AlertTriangle, CheckCircle2, Clock, FileText, Loader2, ShieldCheck } from 'lucide-react';
import { api, type CustomerPortalInvoice } from '../../services/apiClient.ts';
import { getCurrencyFormatter, getDateFormatter } from '../../utils/locale.ts';

/**
 * Portal de autoservicio SIN CUENTA para clientes deudores (Tradespace,
 * Canadá): página pública, standalone (NO usa el chrome interno de la app:
 * el deudor es un tercero externo, no un usuario del sistema). Solo lectura
 * de sus facturas pendientes + botón "ya pagué" (queda a verificación
 * humana, no cambia el estatus real de la factura).
 *
 * Se llega por /portal-cliente/:token, un enlace emitido por
 * CustomerPortalService.issuePortalLink en el backend. Un token
 * inválido/vencido devuelve 404/410; ambos se muestran igual como "enlace
 * no disponible" para no filtrar información sobre el estado del token.
 */

function riskTone(daysOverdue: number): { ring: string; label: string } {
  if (daysOverdue <= 0) return { ring: '#10b981', label: 'Al corriente' };
  if (daysOverdue <= 30) return { ring: '#f59e0b', label: `Vencida ${daysOverdue}d` };
  return { ring: '#ef4444', label: `Vencida ${daysOverdue}d` };
}

interface InvoiceRowProps {
  invoice: CustomerPortalInvoice;
  currency: string;
  locale: string;
  onMarkPaid: (id: string) => void | Promise<void>;
  onPromise: (id: string) => void | Promise<void>;
  onDispute: (id: string) => void | Promise<void>;
  marking: boolean;
}

const InvoiceRow: React.FC<InvoiceRowProps> = ({
  invoice,
  currency,
  locale,
  onMarkPaid,
  onPromise,
  onDispute,
  marking,
}) => {
  const tone = riskTone(invoice.daysOverdue);
  const money = getCurrencyFormatter(locale, currency);
  const dateFmt = getDateFormatter(locale, { day: '2-digit', month: 'short', year: 'numeric' });
  const claimed = invoice.alreadyClaimedPaid;

  return (
    <div className="bg-white border border-brand-sand rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <span
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ backgroundColor: tone.ring }}
          aria-hidden
        />
        <div className="min-w-0">
          <p className="text-sm font-bold text-brand-ink truncate">
            Factura {invoice.folio ?? invoice.id.slice(0, 8)}
          </p>
          <p className="text-xs text-brand-ink/50">
            Vence {invoice.dueDate ? dateFmt.format(new Date(invoice.dueDate)) : 'sin fecha'} ·{' '}
            <span style={{ color: tone.ring }}>{tone.label}</span>
          </p>
        </div>
      </div>

      <div className="text-right shrink-0">
        <p className="text-base font-bold text-brand-ink">{money.format(invoice.total)}</p>
      </div>

      <div className="shrink-0">
        {claimed ? (
          <span className="inline-flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-widest text-emerald-600 bg-emerald-50 px-3 py-2 rounded-lg">
            <Clock size={12} /> En revisión
          </span>
        ) : (
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              disabled={marking}
              onClick={() => onMarkPaid(invoice.id)}
              className="text-[10px] uppercase font-bold tracking-widest text-brand-ink border border-brand-sand rounded-lg px-3 py-2.5 hover:bg-brand-cream transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {marking ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
              Ya pagué
            </button>
            <button
              type="button"
              disabled={marking}
              onClick={() => onPromise(invoice.id)}
              className="text-[10px] uppercase font-bold tracking-widest text-brand-ink border border-brand-sand rounded-lg px-3 py-2.5 hover:bg-brand-cream transition-colors disabled:opacity-50"
            >
              Prometer pago
            </button>
            <button
              type="button"
              disabled={marking}
              onClick={() => onDispute(invoice.id)}
              className="text-[10px] uppercase font-bold tracking-widest text-red-600 border border-red-100 rounded-lg px-3 py-2.5 hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              Disputar
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export function CustomerPortalPage() {
  const { token } = useParams<{ token: string }>();
  const queryClient = useQueryClient();
  const [notice, setNotice] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [markingId, setMarkingId] = React.useState<string | null>(null);

  const locale = 'en-CA'; // Tradespace opera en Canadá; sin branding propio aún cargado por org aquí.

  const {
    data,
    isLoading: loading,
    error: queryError,
  } = useQuery({
    queryKey: ['customerPortalData', token],
    queryFn: () => api.getCustomerPortalData(token as string),
    enabled: !!token,
    retry: false,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['customerPortalData', token] });

  const markPaidMutation = useMutation({
    mutationFn: (invoiceId: string) => api.markInvoicePaid(token as string, invoiceId),
    onMutate: (invoiceId) => setMarkingId(invoiceId),
    onSuccess: () => void invalidate(),
    onError: (err) =>
      setActionError(err instanceof Error ? err.message : 'No se pudo registrar tu confirmación.'),
    onSettled: () => setMarkingId(null),
  });

  const promiseMutation = useMutation({
    mutationFn: ({
      invoiceId,
      promisedDate,
      note,
    }: {
      invoiceId: string;
      promisedDate: string;
      note: string;
    }) => api.promiseToPay(token as string, invoiceId, { promisedDate, note }),
    onMutate: ({ invoiceId }) => setMarkingId(invoiceId),
    onSuccess: () => setNotice('Gracias. Registramos tu promesa de pago para revisión.'),
    onError: (err) =>
      setActionError(err instanceof Error ? err.message : 'No se pudo registrar la promesa de pago.'),
    onSettled: () => setMarkingId(null),
  });

  const disputeMutation = useMutation({
    mutationFn: ({ invoiceId, reason }: { invoiceId: string; reason: string }) =>
      api.disputePortalInvoice(token as string, invoiceId, { reason }),
    onMutate: ({ invoiceId }) => setMarkingId(invoiceId),
    onSuccess: () => setNotice('Recibimos tu disputa. El equipo la revisará.'),
    onError: (err) =>
      setActionError(err instanceof Error ? err.message : 'No se pudo registrar la disputa.'),
    onSettled: () => setMarkingId(null),
  });

  const handleMarkPaid = (invoiceId: string) => {
    if (!token) return;
    setActionError(null);
    markPaidMutation.mutate(invoiceId);
  };

  const handlePromise = (invoiceId: string) => {
    if (!token) return;
    const promisedDate = window.prompt('Fecha prometida de pago (YYYY-MM-DD):')?.trim();
    if (!promisedDate) return;
    const note = window.prompt('Nota opcional para el equipo de cobranza:')?.trim() ?? '';
    setActionError(null);
    promiseMutation.mutate({ invoiceId, promisedDate, note });
  };

  const handleDispute = (invoiceId: string) => {
    if (!token) return;
    const reason = window.prompt('Cuéntanos brevemente el motivo de la disputa:')?.trim();
    if (!reason) return;
    setActionError(null);
    disputeMutation.mutate({ invoiceId, reason });
  };

  const error =
    actionError ??
    (queryError instanceof Error
      ? queryError.message
      : queryError
        ? 'No pudimos cargar tu información. El enlace puede haber vencido.'
        : null);

  if (!token) {
    return (
      <PortalShell>
        <ErrorState message="Enlace no válido." />
      </PortalShell>
    );
  }

  if (loading) {
    return (
      <PortalShell>
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-brand-ink/50">
          <Loader2 className="animate-spin" size={28} />
          <p className="text-sm">Cargando tu información...</p>
        </div>
      </PortalShell>
    );
  }

  if (queryError || !data) {
    return (
      <PortalShell>
        <ErrorState
          message={
            queryError instanceof Error
              ? queryError.message
              : 'No encontramos información para este enlace.'
          }
        />
      </PortalShell>
    );
  }

  const money = getCurrencyFormatter(locale, data.currency);
  const pending = data.invoices;

  return (
    <PortalShell>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <div>
          <p className="text-[10px] uppercase font-bold tracking-[0.2em] text-brand-ink/40">
            Portal de cuenta
          </p>
          <h1 className="text-2xl font-bold text-brand-ink mt-1">Hola, {data.customer.name}</h1>
          <p className="text-sm text-brand-ink/50 mt-1">
            Aquí puedes ver tus facturas pendientes y confirmarnos si ya pagaste alguna.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-brand-cream border border-brand-sand rounded-xl p-4">
            <p className="text-[10px] uppercase font-bold tracking-widest text-brand-ink/40">
              Total pendiente
            </p>
            <p className="text-xl font-bold text-brand-ink mt-1">{money.format(data.aging.totalPending)}</p>
          </div>
          <div className="bg-red-50 border border-red-100 rounded-xl p-4">
            <p className="text-[10px] uppercase font-bold tracking-widest text-red-500/70">Vencido</p>
            <p className="text-xl font-bold text-red-600 mt-1">{money.format(data.aging.totalOverdue)}</p>
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-[10px] uppercase font-bold tracking-widest text-brand-ink/40 flex items-center gap-1.5">
            <FileText size={12} /> Facturas pendientes ({pending.length})
          </p>

          {pending.length === 0 ? (
            <div className="bg-white border border-brand-sand rounded-xl p-6 text-center text-sm text-brand-ink/50">
              No tienes facturas pendientes. ¡Gracias!
            </div>
          ) : (
            pending.map((inv) => (
              <InvoiceRow
                key={inv.id}
                invoice={inv}
                currency={data.currency}
                locale={locale}
                marking={markingId === inv.id}
                onMarkPaid={handleMarkPaid}
                onPromise={handlePromise}
                onDispute={handleDispute}
              />
            ))
          )}
        </div>

        {error && (
          <p className="text-xs text-red-600 flex items-center gap-1.5">
            <AlertTriangle size={12} /> {error}
          </p>
        )}
        {notice && (
          <p className="text-xs text-emerald-700 flex items-center gap-1.5">
            <CheckCircle2 size={12} /> {notice}
          </p>
        )}
      </motion.div>
    </PortalShell>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="text-center py-16 space-y-3">
      <AlertTriangle className="mx-auto text-brand-ink/30" size={32} />
      <p className="text-sm text-brand-ink/60 max-w-xs mx-auto">{message}</p>
      <p className="text-xs text-brand-ink/40">
        Si crees que esto es un error, contacta a quien te compartió este enlace.
      </p>
    </div>
  );
}

function PortalShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-brand-bone flex flex-col items-center px-4 py-10 sm:py-16">
      <div className="max-w-lg w-full space-y-8">
        <div className="flex items-center justify-center gap-2 text-brand-ink/70">
          <ShieldCheck size={16} className="text-brand-gold" />
          <span className="text-[10px] uppercase font-bold tracking-[0.2em]">Royáltica</span>
        </div>
        <div className="editorial-card !bg-brand-cream shadow-xl shadow-brand-sand/40">{children}</div>
        <p className="text-center text-[10px] text-brand-ink/30 uppercase tracking-widest">
          Conexión segura · Solo lectura de tu cuenta
        </p>
      </div>
    </div>
  );
}
