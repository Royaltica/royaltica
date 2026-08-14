import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Cpu, Download, AlertTriangle, FileBarChart, Loader2 } from 'lucide-react';
import { api, type StatementApi } from '../../../services/apiClient.ts';
import { CURRENCY_FORMATTER } from '../../../utils/format.ts';

// Ejemplo de referencia de migracion a TanStack Query: reemplaza el patron
// manual useState+useEffect+fetch por useQuery (lectura) y useMutation
// (escritura), con invalidacion automatica de la lista tras generar un
// nuevo estado. Ver docs/plan-100-funcional.md para el resto de vistas
// pendientes de migrar (mismo patron: 14 archivos usan useEffect+fetch hoy).
export function EstadoResultadosReal() {
  const now = new Date();
  const [month, setMonth] = useState<string>(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  const [revenue, setRevenue] = useState('');
  const [result, setResult] = useState<StatementApi | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const queryClient = useQueryClient();

  const { data: list = [] } = useQuery({
    queryKey: ['statements'],
    queryFn: () => api.getStatements(),
  });

  const generateMutation = useMutation({
    mutationFn: (vars: { month: string; revenue?: number }) =>
      api.generateStatement(vars.month, vars.revenue),
    onSuccess: (r) => {
      setResult(r);
      setErr(null);
      queryClient.invalidateQueries({ queryKey: ['statements'] });
    },
    onError: (e) => {
      setErr(e instanceof Error ? e.message : 'No se pudo generar el estado.');
    },
  });

  const busy = generateMutation.isPending;

  const handleGenerate = () => {
    const rev = revenue.trim() ? Number(revenue.replace(/[^0-9.]/g, '')) : undefined;
    generateMutation.mutate({ month, revenue: rev });
  };

  const handleExport = () => {
    if (!result) return;
    const rows: (string | number)[][] = [
      ['Concepto', 'Monto (MXN)'],
      ['Ingresos', result.revenue],
      ['Costos', -result.costs],
      ['Gastos de operacion (OPEX)', -result.opex],
      ['Utilidad neta', result.netIncome],
    ];
    const csv = rows.map(r => r.join(',')).join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `estado_resultados_${result.period}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const Row = ({ label, value, strong, negative }: { label: string; value: number; strong?: boolean; negative?: boolean }) => (
    <div className={`flex items-center justify-between py-2 ${strong ? 'border-t-2 border-brand-ink/10 mt-1' : 'border-b border-brand-sand/20'}`}>
      <span className={`text-[11px] ${strong ? 'font-bold text-brand-ink uppercase tracking-widest' : 'text-brand-ink/60 font-serif'}`}>{label}</span>
      <span className={`font-mono text-sm ${strong ? 'font-bold' : ''} ${negative ? 'text-red-600' : value < 0 ? 'text-red-600' : 'text-brand-ink'}`}>
        {negative ? '(' + CURRENCY_FORMATTER.format(Math.abs(value)) + ')' : CURRENCY_FORMATTER.format(value)}
      </span>
    </div>
  );

  return (
    <div className="rounded-2xl border border-brand-gold/30 bg-brand-gold/5 p-5 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-brand-gold">
          <FileBarChart size={16} />
          <span className="text-[10px] font-bold uppercase tracking-widest">Estado de Resultados · datos reales</span>
        </div>
        <input type="month" value={month} onChange={e => setMonth(e.target.value)}
          className="px-3 py-2 bg-white border border-brand-sand rounded-xl text-[11px] text-brand-ink focus:outline-none focus:border-brand-gold" />
        <input type="text" inputMode="decimal" value={revenue} onChange={e => setRevenue(e.target.value)} placeholder="Ingresos del periodo (opcional)"
          className="px-3 py-2 bg-white border border-brand-sand rounded-xl text-[11px] text-brand-ink focus:outline-none focus:border-brand-gold w-56" />
        <button onClick={handleGenerate} disabled={busy}
          className="ml-auto flex items-center gap-2 px-4 py-2 bg-brand-ink text-brand-paper rounded-xl text-[9px] font-bold uppercase tracking-widest hover:bg-black transition-all disabled:opacity-50">
          {busy ? <Loader2 size={12} className="animate-spin" /> : <Cpu size={12} />}
          {busy ? 'Generando...' : 'Generar'}
        </button>
        {result && (
          <button onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl text-[9px] font-bold uppercase tracking-widest hover:bg-green-700 transition-all">
            <Download size={12} /> CSV
          </button>
        )}
      </div>
      {err && <p className="text-[10px] font-bold text-red-600 flex items-center gap-1.5"><AlertTriangle size={12} /> {err}</p>}
      {result && (
        <div className="bg-white rounded-xl border border-brand-sand/40 p-4">
          <p className="text-[9px] uppercase font-bold tracking-widest text-brand-ink/40 mb-2">Periodo {result.period}</p>
          <Row label="Ingresos" value={result.revenue} />
          <Row label="Costos" value={result.costs} negative />
          <Row label="Gastos de operación (OPEX)" value={result.opex} negative />
          <Row label="Utilidad neta" value={result.netIncome} strong />
          {result.data?.topSuppliers && result.data.topSuppliers.length > 0 && (
            <div className="mt-3 pt-3 border-t border-brand-sand/20">
              <p className="text-[8px] uppercase font-bold tracking-widest text-brand-ink/30 mb-1.5">Principales egresos por proveedor</p>
              {result.data.topSuppliers.slice(0, 5).map((s, i) => (
                <div key={i} className="flex justify-between text-[10px] py-0.5">
                  <span className="text-brand-ink/60 font-serif truncate">{s.name}</span>
                  <span className="font-mono text-brand-ink/80">{CURRENCY_FORMATTER.format(s.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {list.length > 0 && (
        <div>
          <p className="text-[8px] uppercase font-bold tracking-widest text-brand-ink/30 mb-1.5">Estados generados</p>
          <div className="flex flex-wrap gap-1.5">
            {list.map(s => (
              <button key={s.id} onClick={() => setResult(s)}
                className="px-2.5 py-1 rounded-lg bg-white border border-brand-sand/40 text-[9px] font-bold text-brand-ink/60 hover:border-brand-gold hover:text-brand-ink transition-all">
                {s.period} · {CURRENCY_FORMATTER.format(s.netIncome)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

