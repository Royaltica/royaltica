import type { Invoice } from '../types.ts';

export function StatusBadge({ status }: { status: Invoice['status'] }) {
  const styles = {
    pending: 'bg-brand-sand/30 text-brand-ink/60',
    audited: 'bg-green-100 text-green-700',
    approved: 'bg-brand-gold text-brand-ink font-bold',
    paid: 'bg-brand-ink text-brand-paper',
    rejected: 'bg-red-100 text-red-700'
  };
  const labels = {
    pending: 'Pendiente',
    audited: 'Auditada',
    approved: 'Aprobada',
    paid: 'Liquidada',
    rejected: 'Rechazada'
  };
  return <span className={`audit-badge ml-2 ${styles[status]}`}>{labels[status]}</span>;
}
