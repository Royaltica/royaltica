import React, { useState } from 'react';
import { FileText, FolderArchive, AlertTriangle, Loader2, Scale, FileSpreadsheet } from 'lucide-react';
import { api } from '../../../services/apiClient.ts';

export function CsvExportsBar() {
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const run = async (kind: 'invoices' | 'suppliers' | 'payments') => {
    setBusy(kind); setErr(null);
    try {
      if (kind === 'invoices') await api.exportInvoicesCsv();
      else if (kind === 'suppliers') await api.exportSuppliersCsv();
      else await api.exportPaymentsCsv();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'No se pudo exportar.');
    } finally {
      setBusy(null);
    }
  };

  const items: { kind: 'invoices' | 'suppliers' | 'payments'; label: string; icon: React.ReactNode }[] = [
    { kind: 'invoices', label: 'Facturas (CSV)', icon: <FileText size={16} /> },
    { kind: 'suppliers', label: 'Proveedores (CSV)', icon: <FolderArchive size={16} /> },
    { kind: 'payments', label: 'Pagos (CSV)', icon: <Scale size={16} /> },
  ];

  return (
    <div className="rounded-2xl border border-green-200 bg-green-50/50 p-5 space-y-3">
      <div className="flex items-center gap-2 text-green-700">
        <FileSpreadsheet size={16} />
        <span className="text-[10px] font-bold uppercase tracking-widest">Exportar a CSV · datos reales</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {items.map(it => (
          <button key={it.kind} onClick={() => run(it.kind)} disabled={busy !== null}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-green-200 rounded-xl text-[10px] font-bold uppercase tracking-widest text-brand-ink hover:border-green-500 hover:bg-green-50 transition-all disabled:opacity-50">
            {busy === it.kind ? <Loader2 size={14} className="animate-spin" /> : it.icon}
            {it.label}
          </button>
        ))}
      </div>
      {err && <p className="text-[10px] font-bold text-red-600 flex items-center gap-1.5"><AlertTriangle size={12} /> {err}</p>}
      <p className="text-[9px] text-brand-ink/40 font-serif">Descarga el catálogo completo del backend en formato CSV (UTF-8), listo para Excel o tu ERP.</p>
    </div>
  );
}

