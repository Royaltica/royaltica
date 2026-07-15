import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { CreditCard } from 'lucide-react';
import { api, type ProviderPayment } from '../../services/apiClient.ts';

const CURRENCY_FORMATTER = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
});

// Pagos REALES del proveedor (registros de Payment del backend, no derivados).
export function ProviderPaymentsReal() {
  const [payments, setPayments] = useState<ProviderPayment[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.getProviderPayments().then(p => { setPayments(p); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const STATUS: Record<string, { label: string; cls: string }> = {
    SCHEDULED: { label: 'Programado', cls: 'bg-blue-100 text-blue-700' },
    PROCESSING: { label: 'En proceso', cls: 'bg-yellow-100 text-yellow-700' },
    COMPLETED: { label: 'Completado', cls: 'bg-green-100 text-green-700' },
    FAILED: { label: 'Fallido', cls: 'bg-red-100 text-red-600' },
  };

  if (loading) return null;
  if (payments.length === 0) return null;

  return (
    <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-brand-sand/20 overflow-hidden">
      <div className="px-5 py-3 border-b border-brand-sand/10 flex items-center gap-2">
        <CreditCard size={14} className="text-green-600" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-brand-ink/50">Órdenes de pago registradas</span>
        <span className="text-[8px] text-brand-ink/25 ml-auto">{payments.length} pago{payments.length !== 1 ? 's' : ''}</span>
      </div>
      <div className="px-5 py-2 border-b border-brand-sand/10 text-[8px] font-bold uppercase tracking-[.2em] text-brand-ink/30 grid grid-cols-4 gap-4">
        <span>Referencia</span><span>Monto</span><span>Fecha</span><span>Estado</span>
      </div>
      {payments.map((p, i) => (
        <motion.div key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
          className="px-5 py-3 grid grid-cols-4 gap-4 items-center border-b border-brand-sand/5 hover:bg-green-50/20 transition-colors">
          <span className="text-[9px] font-mono text-brand-ink/50">{p.id.slice(0, 8)}…</span>
          <span className="font-serif text-sm text-green-700 font-bold">{CURRENCY_FORMATTER.format(p.totalAmount)}</span>
          <span className="text-[9px] text-brand-ink/40">{(p.scheduledPayDate || p.createdAt).split('T')[0]}</span>
          <span className={`text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full w-fit ${STATUS[p.status]?.cls ?? 'bg-brand-sand/40 text-brand-ink/40'}`}>
            {STATUS[p.status]?.label ?? p.status}
          </span>
        </motion.div>
      ))}
    </div>
  );
}
