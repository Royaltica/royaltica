import { useState } from 'react';
import { motion } from 'motion/react';
import { Zap, Loader2, Activity } from 'lucide-react';
import { isRealId, type FactorajeItem } from '../../services/apiClient.ts';
import { Invoice, Supplier } from '../../types.ts';

const CURRENCY_FORMATTER = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
});

export function ProviderFactorajeView({ supplier, invoices, capitalAmount, requests, onRequest, message }: {
  supplier: Supplier; invoices: Invoice[]; capitalAmount: number;
  requests: FactorajeItem[];
  onRequest: (invoiceId: string, amount?: number) => Promise<void>;
  message: { ok: boolean; text: string } | null;
}) {
  const patrimony = capitalAmount;

  // Estado de la solicitud en curso (para deshabilitar el botón mientras se envía).
  const [requesting, setRequesting] = useState<string | null>(null);
  const doRequest = async (invoiceId: string) => {
    setRequesting(invoiceId);
    await onRequest(invoiceId);
    setRequesting(null);
  };
  // Facturas APROBADAS sin solicitud de anticipo activa = elegibles.
  const activeReqInvoiceIds = new Set(
    requests.filter(r => r.status === 'PENDING' || r.status === 'APPROVED' || r.status === 'DISBURSED').map(r => r.invoiceId),
  );
  const eligible = invoices.filter(i => i.status === 'approved' && isRealId(i.id) && !activeReqInvoiceIds.has(i.id));
  const FACTORAJE_STATUS: Record<FactorajeItem['status'], { label: string; cls: string }> = {
    PENDING: { label: 'Pendiente', cls: 'bg-amber-50 text-amber-700' },
    APPROVED: { label: 'Aprobada', cls: 'bg-blue-50 text-blue-700' },
    DISBURSED: { label: 'Dispersada', cls: 'bg-green-50 text-green-700' },
    REJECTED: { label: 'Rechazada', cls: 'bg-red-50 text-red-600' },
  };

  const paid = invoices.filter(i => i.status === 'paid');
  const pending = invoices.filter(i => i.status !== 'paid');

  const totalPaid = paid.reduce((s, i) => s + i.amount, 0);
  const totalPending = pending.reduce((s, i) => s + i.amount, 0);
  const totalReceivable = totalPaid + totalPending;

  // Average payment days: mock calculation based on invoice date distance from reference
  const refDate = new Date('2024-04-27');
  const avgPayDays = paid.length > 0
    ? Math.round(paid.reduce((s, inv) => {
        const invDate = new Date(inv.date);
        const diff = Math.abs(refDate.getTime() - invDate.getTime()) / (1000 * 60 * 60 * 24);
        return s + Math.min(diff, 60);
      }, 0) / paid.length)
    : 28;

  // Liquidity health: how much of patrimony is covered vs outstanding receivables
  const liquidityRatio = patrimony > 0 ? Math.min(((patrimony - totalPending) / patrimony) * 100, 100) : 0;
  const healthScore = Math.max(liquidityRatio, 0);
  const healthLabel = healthScore >= 70 ? 'Saludable' : healthScore >= 40 ? 'Moderada' : 'Comprometida';
  const healthColor = healthScore >= 70 ? 'bg-green-500' : healthScore >= 40 ? 'bg-yellow-400' : 'bg-red-500';
  const healthTextColor = healthScore >= 70 ? 'text-green-700' : healthScore >= 40 ? 'text-yellow-700' : 'text-red-700';
  const healthBg = healthScore >= 70 ? 'bg-green-50/60 border-green-200' : healthScore >= 40 ? 'bg-yellow-50/60 border-yellow-200' : 'bg-red-50/60 border-red-200';
  const recommendFactoraje = healthScore < 65 || avgPayDays > 25;

  // Monthly receivables trend — derived from actual invoice dates
  const MONTHS_MAP: Record<string, { label: string; start: Date; end: Date }> = {
    'Nov': { label: 'Nov', start: new Date('2023-11-01'), end: new Date('2023-11-30') },
    'Dic': { label: 'Dic', start: new Date('2023-12-01'), end: new Date('2023-12-31') },
    'Ene': { label: 'Ene', start: new Date('2024-01-01'), end: new Date('2024-01-31') },
    'Feb': { label: 'Feb', start: new Date('2024-02-01'), end: new Date('2024-02-29') },
    'Mar': { label: 'Mar', start: new Date('2024-03-01'), end: new Date('2024-03-31') },
    'Abr': { label: 'Abr', start: new Date('2024-04-01'), end: new Date('2024-04-30') },
  };
  const monthlyData = Object.values(MONTHS_MAP).map(({ label, start, end }) => {
    const monthInvoices = invoices.filter(inv => {
      const d = new Date(inv.date);
      return d >= start && d <= end;
    });
    const cobrado = monthInvoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.amount, 0);
    const pendiente = monthInvoices.filter(i => i.status !== 'paid' && i.status !== 'rejected').reduce((s, i) => s + i.amount, 0);
    return { mes: label, cobrado, pendiente };
  });

  return (
    <div className="space-y-10">
      {/* Header */}
      <div>
        <span className="label-caps !text-brand-gold !text-[9px]">Análisis Financiero</span>
        <h2 className="text-4xl font-bold text-brand-ink tracking-tight mt-1">Factoraje & Liquidez</h2>
        <p className="text-sm text-brand-ink/40 mt-1">Salud financiera basada en tu capital y cuentas por cobrar.</p>
      </div>

      {/* ═══ Solicitar anticipo (factoraje real) ═══ */}
      <div className="editorial-card !p-7 space-y-5 border border-brand-gold/20">
        <div className="flex items-center justify-between">
          <div>
            <span className="label-caps !text-brand-gold !text-[9px]">Liquidez Anticipada</span>
            <h3 className="text-xl font-serif text-brand-ink mt-1">Solicitar Anticipo</h3>
          </div>
          <Zap size={20} className="text-brand-gold" />
        </div>

        {message && (
          <div className={`text-[11px] rounded-xl px-4 py-2.5 ${message.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>{message.text}</div>
        )}

        {/* Facturas elegibles (aprobadas, sin solicitud activa) */}
        <div>
          <p className="text-[9px] uppercase tracking-widest text-brand-ink/30 font-bold mb-2">Facturas elegibles · aprobadas</p>
          {eligible.length === 0 ? (
            <p className="text-[11px] text-brand-ink/40 bg-brand-bone/40 rounded-xl px-4 py-3">No tienes facturas aprobadas disponibles para anticipo en este momento. El factoraje solo aplica a facturas ya autorizadas por el corporativo.</p>
          ) : (
            <div className="space-y-2">
              {eligible.map(inv => (
                <div key={inv.id} className="flex items-center gap-4 bg-white/70 rounded-xl px-4 py-3 border border-brand-sand/20">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-brand-ink truncate">{inv.poNumber || inv.cfdiUUID?.slice(0, 8) || inv.id}</p>
                    <p className="text-[10px] text-brand-ink/40">{CURRENCY_FORMATTER.format(inv.amount)} · anticipa ~{CURRENCY_FORMATTER.format(inv.amount * 0.965)}</p>
                  </div>
                  <button onClick={() => doRequest(inv.id)} disabled={requesting === inv.id}
                    className="px-4 py-2 bg-brand-gold text-white rounded-xl text-[9px] font-bold uppercase tracking-wider hover:bg-brand-gold/80 transition-all disabled:opacity-40 flex items-center gap-1.5">
                    {requesting === inv.id ? <><Loader2 size={12} className="animate-spin" /> Enviando</> : 'Solicitar'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Mis solicitudes (reales del backend) */}
        {requests.length > 0 && (
          <div>
            <p className="text-[9px] uppercase tracking-widest text-brand-ink/30 font-bold mb-2">Mis solicitudes</p>
            <div className="space-y-2">
              {requests.map(r => (
                <div key={r.id} className="flex items-center gap-4 bg-white/50 rounded-xl px-4 py-3 border border-brand-sand/15">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-brand-ink truncate">Factura {r.invoiceFolio}</p>
                    <p className="text-[10px] text-brand-ink/40">Solicitado {CURRENCY_FORMATTER.format(r.requestedAmount)} · neto {CURRENCY_FORMATTER.format(r.netAmount)} (comisión {CURRENCY_FORMATTER.format(r.fee)})</p>
                  </div>
                  <span className={`text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${FACTORAJE_STATUS[r.status].cls}`}>{FACTORAJE_STATUS[r.status].label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="editorial-card !p-8 space-y-3">
          <span className="label-caps !opacity-40 !text-[9px]">Capital</span>
          <p className="text-3xl font-serif text-brand-ink">{CURRENCY_FORMATTER.format(patrimony)}</p>
          <p className="text-[9px] uppercase tracking-wider text-brand-ink/30">{supplier.seniorityYears} años de operación</p>
        </div>
        <div className="editorial-card !p-8 space-y-3">
          <span className="label-caps !opacity-40 !text-[9px]">Por Cobrar (Pendiente)</span>
          <p className="text-3xl font-serif text-orange-600">{CURRENCY_FORMATTER.format(totalPending)}</p>
          <p className="text-[9px] uppercase tracking-wider text-brand-ink/30">{pending.length} factura{pending.length !== 1 ? 's' : ''} en proceso</p>
        </div>
        <div className="editorial-card !p-8 space-y-3">
          <span className="label-caps !opacity-40 !text-[9px]">Plazo Promedio de Pago</span>
          <p className="text-3xl font-serif text-brand-ink">{avgPayDays} días</p>
          <p className="text-[9px] uppercase tracking-wider text-brand-ink/30">{totalPaid > 0 ? `${paid.length} facturas liquidadas` : 'Sin histórico pagado'}</p>
        </div>
      </div>

      {/* Liquidity health bar */}
      <div className={`rounded-[2rem] p-8 border ${healthBg} space-y-5`}>
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Activity size={16} className={healthTextColor} />
            <span className="text-[9px] uppercase tracking-widest font-bold text-brand-ink/60">Barra de Salud de Liquidez</span>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-sm font-black font-serif ${healthTextColor}`}>{healthScore.toFixed(0)}%</span>
            <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${healthTextColor} ${healthBg} border`}>{healthLabel}</span>
          </div>
        </div>

        {/* Bar */}
        <div className="space-y-2">
          <div className="w-full bg-brand-sand/40 rounded-full h-4 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${healthScore}%` }}
              transition={{ duration: 1, ease: 'easeOut', delay: 0.2 }}
              className={`h-full rounded-full ${healthColor} shadow-inner`}
            />
          </div>
          <div className="flex justify-between text-[9px] text-brand-ink/30 uppercase tracking-wider">
            <span>Comprometida</span>
            <span>Moderada</span>
            <span>Saludable</span>
          </div>
        </div>

        {/* Breakdown */}
        <div className="grid grid-cols-2 gap-4 pt-2">
          <div className="bg-white/60 rounded-2xl p-4 space-y-1">
            <p className="text-[9px] uppercase tracking-wider text-brand-ink/40 font-bold">Capital Base</p>
            <p className="font-serif text-lg text-brand-ink">{CURRENCY_FORMATTER.format(patrimony)}</p>
          </div>
          <div className="bg-white/60 rounded-2xl p-4 space-y-1">
            <p className="text-[9px] uppercase tracking-wider text-brand-ink/40 font-bold">C × C Pendiente</p>
            <p className="font-serif text-lg text-orange-600">{CURRENCY_FORMATTER.format(totalPending)}</p>
          </div>
        </div>

        <p className={`text-[11px] leading-relaxed ${healthTextColor}`}>
          {healthScore >= 70
            ? `Tu liquidez es sólida. Tu capital cubre con holgura tus cuentas por cobrar. No es urgente usar factoraje, aunque puede acelerar tu flujo de efectivo.`
            : healthScore >= 40
            ? `Liquidez moderada. Tienes ${CURRENCY_FORMATTER.format(totalPending)} pendientes de cobrar que presionan tu capital. Considera factoraje para las facturas de mayor monto.`
            : `Liquidez comprometida. Las cuentas por cobrar representan una proporción alta de tu capital. Se recomienda activar factoraje para mantener operación sin interrupciones.`}
        </p>
      </div>

      {/* Avg payment term detail */}
      <div className="bg-white/40 backdrop-blur-md rounded-[2rem] p-8 border border-brand-sand/30 space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-xl font-serif text-brand-ink">Plazo de Cobro Histórico</h3>
            <p className="text-[9px] uppercase tracking-widest text-brand-ink/30 mt-0.5">Días promedio que tarda Royáltica en liquidarte</p>
          </div>
          <div className={`px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-wider ${avgPayDays <= 20 ? 'bg-green-100 text-green-700' : avgPayDays <= 35 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
            {avgPayDays <= 20 ? 'Óptimo' : avgPayDays <= 35 ? 'Aceptable' : 'Demorado'}
          </div>
        </div>

        <div className="flex items-end gap-4">
          <div className="text-6xl font-serif text-brand-ink">{avgPayDays}</div>
          <div className="pb-2 space-y-0.5">
            <p className="text-sm font-bold text-brand-ink/60">días promedio</p>
            <p className="text-[9px] uppercase tracking-wider text-brand-ink/30">de emisión a liquidación</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Mejor plazo registrado', value: `${Math.max(avgPayDays - 8, 7)} días`, color: 'text-green-700' },
            { label: 'Plazo promedio', value: `${avgPayDays} días`, color: 'text-brand-ink' },
            { label: 'Peor plazo registrado', value: `${avgPayDays + 12} días`, color: 'text-red-600' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-brand-bone/60 rounded-2xl p-4 space-y-1">
              <p className="text-[8px] uppercase tracking-wider text-brand-ink/30 font-bold">{label}</p>
              <p className={`font-serif text-base ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Factoraje recommendation banner */}
      {recommendFactoraje && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-brand-ink rounded-[2rem] p-8 text-brand-paper space-y-4 relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-brand-gold" />
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-brand-gold rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
              <Zap size={18} className="text-brand-ink" />
            </div>
            <div className="space-y-1">
              <span className="label-caps !text-brand-gold !text-[9px]">Recomendación Royáltica</span>
              <h4 className="text-xl font-serif text-brand-paper">Activa Factoraje para mejorar tu liquidez</h4>
              <p className="text-[11px] text-brand-paper/60 leading-relaxed max-w-lg">
                Con un plazo promedio de {avgPayDays} días y {CURRENCY_FORMATTER.format(totalPending)} en cuentas por cobrar, puedes adelantar el cobro de tus facturas aprobadas a través de factoraje. Sin costo de adhesión para proveedores calificados.
              </p>
            </div>
          </div>
          <div className="flex gap-3 pl-14">
            <button className="px-6 py-3 bg-brand-gold text-brand-ink rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-gold/90 transition-all">
              Solicitar Factoraje
            </button>
            <button className="px-6 py-3 border border-brand-paper/20 text-brand-paper/60 rounded-xl text-[10px] font-black uppercase tracking-widest hover:border-brand-paper/40 transition-all">
              Más Información
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
