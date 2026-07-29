import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShieldCheck, Building2, CheckCircle2, ChevronRight, Search, FileText, X, FileSearch,
  Calendar, UploadCloud, FolderArchive, Download, FolderSync, AlertTriangle, ChevronLeft,
  FileBarChart, History, Paperclip, Scale, FolderDown, AlertOctagon,
} from 'lucide-react';
import { MOCK_SUPPLIERS, type Invoice, type Supplier } from '../../../types.ts';
import { CURRENCY_FORMATTER } from '../../../utils/format.ts';
import { EstadoResultadosReal } from './EstadoResultadosReal.tsx';
import { CsvExportsBar } from './CsvExportsBar.tsx';

// ─── Historial / Archivo Corporativo ────────────────────────────────────────

export function HistorialView({ invoices }: { invoices: Invoice[] }) {
  const [activeSection, setActiveSection] = useState<'facturas' | 'proveedores' | 'estados' | 'descargas'>('facturas');
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [supplierDetailTab, setSupplierDetailTab] = useState<'facturas' | 'expediente'>('facturas');
  const [searchTerm, setSearchTerm] = useState('');
  const [monthFrom, setMonthFrom] = useState('');
  const [monthTo, setMonthTo] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [estadosSub, setEstadosSub] = useState<'resultados' | 'balance' | 'razones' | 'diot'>('resultados');
  const [estadosFrom, setEstadosFrom] = useState('2024-01');
  const [estadosTo, setEstadosTo] = useState('2024-12');
  const [diotMonth, setDiotMonth] = useState('2024-04');
  const lastClickedRef = React.useRef<string | null>(null);

  const paidInvoices = React.useMemo(() =>
    invoices.filter(i => i.status === 'paid').sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [invoices]
  );

  const filteredPaidInvoices = React.useMemo(() => {
    let result = paidInvoices;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(i => i.id.toLowerCase().includes(term) || i.provider.toLowerCase().includes(term) || i.description.toLowerCase().includes(term));
    }
    if (monthFrom) {
      const from = new Date(monthFrom + '-01');
      result = result.filter(i => new Date(i.date) >= from);
    }
    if (monthTo) {
      const to = new Date(monthTo + '-01');
      to.setMonth(to.getMonth() + 1);
      result = result.filter(i => new Date(i.date) < to);
    }
    return result;
  }, [paidInvoices, searchTerm, monthFrom, monthTo]);

  const supplierInvoiceMap = React.useMemo(() => {
    const map: Record<string, Invoice[]> = {};
    paidInvoices.forEach(inv => {
      if (!map[inv.provider]) map[inv.provider] = [];
      map[inv.provider].push(inv);
    });
    return map;
  }, [paidInvoices]);

  const suppliersWithHistory = React.useMemo(() =>
    MOCK_SUPPLIERS.filter(s => (supplierInvoiceMap[s.name]?.length || 0) > 0),
    [supplierInvoiceMap]
  );

  const handleToggle = (id: string, e: React.MouseEvent, list?: Invoice[]) => {
    e.stopPropagation();
    if (e.shiftKey && lastClickedRef.current && list) {
      const ids = list.map(i => i.id);
      const startIdx = ids.indexOf(lastClickedRef.current);
      const endIdx = ids.indexOf(id);
      if (startIdx !== -1 && endIdx !== -1) {
        const [from, to] = startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
        const rangeIds = ids.slice(from, to + 1);
        setSelectedIds(prev => {
          const next = new Set(prev);
          rangeIds.forEach(rid => next.add(rid));
          return next;
        });
        lastClickedRef.current = id;
        return;
      }
    }
    lastClickedRef.current = id;
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredPaidInvoices.map(i => i.id)));
    }
    setSelectAll(!selectAll);
  };

  const handleDownloadSelected = () => {
    const count = selectedIds.size;
    alert(`Descargando ${count} archivo${count !== 1 ? 's' : ''} seleccionado${count !== 1 ? 's' : ''}...\n\n(En producción, esto generaría un ZIP con los CFDIs y documentos de soporte)`);
  };

  const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

  const estadosFilteredInvoices = React.useMemo(() => {
    let result = paidInvoices;
    if (estadosFrom) {
      const from = new Date(estadosFrom + '-01');
      result = result.filter(i => new Date(i.date) >= from);
    }
    if (estadosTo) {
      const to = new Date(estadosTo + '-01');
      to.setMonth(to.getMonth() + 1);
      result = result.filter(i => new Date(i.date) < to);
    }
    return result;
  }, [paidInvoices, estadosFrom, estadosTo]);

  const financialData = React.useMemo(() => {
    const from = estadosFrom ? new Date(estadosFrom + '-01') : new Date('2024-01-01');
    const to = estadosTo ? new Date(estadosTo + '-01') : new Date('2024-12-01');
    const periods: { period: string; month: number; year: number }[] = [];
    const cursor = new Date(from);
    while (cursor <= to) {
      periods.push({ period: `${MONTH_NAMES[cursor.getMonth()]} ${cursor.getFullYear()}`, month: cursor.getMonth(), year: cursor.getFullYear() });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return periods.map(p => {
      const mInvoices = estadosFilteredInvoices.filter(i => {
        const d = new Date(i.date);
        return d.getMonth() === p.month && d.getFullYear() === p.year;
      });
      const revenue = mInvoices.reduce((s, i) => s + i.amount, 0);
      return {
        period: p.period,
        ingresos: revenue * 1.35,
        costoVentas: revenue * 0.62,
        gastosOp: revenue * 0.18,
        utilidadBruta: revenue * 0.73,
        utilidadOp: revenue * 0.55,
        utilidadNeta: revenue * 0.41,
        activosTotales: revenue * 3.2,
        pasivosTotales: revenue * 1.4,
        capitalContable: revenue * 1.8,
        activoCirculante: revenue * 1.9,
        pasivoCirculante: revenue * 0.8,
        inventarios: revenue * 0.5,
      };
    });
  }, [estadosFilteredInvoices, estadosFrom, estadosTo]);

  const diotMonthInvoices = React.useMemo(() => {
    if (!diotMonth) return paidInvoices;
    const from = new Date(diotMonth + '-01');
    const to = new Date(diotMonth + '-01');
    to.setMonth(to.getMonth() + 1);
    return paidInvoices.filter(i => { const d = new Date(i.date); return d >= from && d < to; });
  }, [paidInvoices, diotMonth]);

  const diotData = React.useMemo(() =>
    MOCK_SUPPLIERS.slice(0, 12).map(s => {
      const sInvs = diotMonthInvoices.filter(i => i.provider === s.name);
      const total = sInvs.reduce((sum, i) => sum + i.amount, 0);
      const iva16 = total * 0.16;
      return {
        rfc: s.rfc,
        name: s.name,
        tipoTercero: '04' as const,
        tipOp: '85' as const,
        valorActos16: total,
        iva16,
        ivaRetenido: total > 200000 ? total * 0.0267 : 0,
        totalOps: sInvs.length,
      };
    }).filter(d => d.totalOps > 0),
    [diotMonthInvoices]
  );

  const sections = [
    { id: 'facturas' as const, label: 'Facturas Pagadas', icon: <FileText size={14} /> },
    { id: 'proveedores' as const, label: 'Proveedores', icon: <Building2 size={14} /> },
    { id: 'estados' as const, label: 'Estados Financieros', icon: <FileBarChart size={14} /> },
    { id: 'descargas' as const, label: 'Centro de Descargas', icon: <Download size={14} /> },
  ];

  return (
    <div className="space-y-8 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <span className="label-caps !text-brand-gold">Archivo Corporativo</span>
          <h2 className="text-4xl text-brand-ink font-serif mt-1">Historial</h2>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-200 rounded-full">
            <ShieldCheck size={14} className="text-green-600" />
            <span className="text-[9px] text-green-700 font-bold uppercase tracking-widest">Registros Inmutables</span>
          </div>
          <div className="text-right">
            <p className="text-[9px] text-brand-ink/30 uppercase tracking-widest font-bold">{paidInvoices.length} registros</p>
            <p className="text-[9px] text-brand-ink/30">{CURRENCY_FORMATTER.format(paidInvoices.reduce((s, i) => s + i.amount, 0))} total</p>
          </div>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {sections.map(s => (
          <button key={s.id}
            onClick={() => { setActiveSection(s.id); setSelectedIds(new Set()); setSelectAll(false); setSelectedSupplier(null); }}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all cursor-pointer ${
              activeSection === s.id ? 'bg-brand-ink text-brand-paper shadow-md' : 'bg-white border border-brand-sand text-brand-ink/50 hover:border-brand-gold hover:text-brand-ink'
            }`}
          >
            {s.icon} {s.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* ═══ TAB 1: Facturas Pagadas ═══ */}
        {activeSection === 'facturas' && (
          <motion.div key="facturas" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-ink/30" />
                <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Buscar por ID, proveedor o descripción..."
                  className="w-full pl-11 pr-4 py-3 bg-white border border-brand-sand rounded-xl text-sm focus:outline-none focus:border-brand-gold" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] text-brand-ink/40 font-bold uppercase tracking-widest">Desde</span>
                <input type="month" value={monthFrom} onChange={e => setMonthFrom(e.target.value)}
                  className="px-3 py-2.5 bg-white border border-brand-sand rounded-xl text-[11px] text-brand-ink focus:outline-none focus:border-brand-gold" />
                <span className="text-[9px] text-brand-ink/40 font-bold uppercase tracking-widest">Hasta</span>
                <input type="month" value={monthTo} onChange={e => setMonthTo(e.target.value)}
                  className="px-3 py-2.5 bg-white border border-brand-sand rounded-xl text-[11px] text-brand-ink focus:outline-none focus:border-brand-gold" />
                {(monthFrom || monthTo) && (
                  <button onClick={() => { setMonthFrom(''); setMonthTo(''); }}
                    className="p-2 hover:bg-brand-sand/30 rounded-lg transition-colors cursor-pointer" title="Limpiar filtro">
                    <X size={14} className="text-brand-ink/40" />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={handleSelectAll}
                  className="px-4 py-2 bg-white border border-brand-sand rounded-xl text-[9px] font-bold uppercase tracking-widest hover:border-brand-gold transition-all cursor-pointer">
                  {selectAll ? 'Deseleccionar' : 'Seleccionar Todo'}
                </button>
                {selectedIds.size > 0 && (
                  <motion.button initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                    onClick={handleDownloadSelected}
                    className="px-4 py-2 bg-brand-gold text-brand-ink rounded-xl text-[9px] font-bold uppercase tracking-widest hover:bg-brand-gold/90 transition-all cursor-pointer flex items-center gap-2">
                    <Download size={12} /> {selectedIds.size} archivo{selectedIds.size !== 1 ? 's' : ''}
                  </motion.button>
                )}
              </div>
              <span className="text-[8px] text-brand-ink/30 italic">Tip: Shift + click para seleccionar un rango</span>
            </div>

            <div className="editorial-card !p-0 overflow-hidden">
              <div className="grid grid-cols-[40px_1fr_1fr_1fr_120px_100px_80px] gap-4 px-6 py-3 border-b border-brand-sand/30 bg-brand-bone/50">
                <div />
                <span className="text-[8px] uppercase tracking-widest font-bold text-brand-ink/30">Factura</span>
                <span className="text-[8px] uppercase tracking-widest font-bold text-brand-ink/30">Proveedor</span>
                <span className="text-[8px] uppercase tracking-widest font-bold text-brand-ink/30">Descripción</span>
                <span className="text-[8px] uppercase tracking-widest font-bold text-brand-ink/30 text-right">Monto</span>
                <span className="text-[8px] uppercase tracking-widest font-bold text-brand-ink/30">Fecha Pago</span>
                <span className="text-[8px] uppercase tracking-widest font-bold text-brand-ink/30">Tipo</span>
              </div>
              <div className="max-h-[500px] overflow-y-auto">
                {filteredPaidInvoices.length === 0 ? (
                  <div className="py-16 text-center">
                    <FileSearch size={32} className="mx-auto text-brand-ink/10 mb-3" />
                    <p className="text-sm text-brand-ink/30">No se encontraron facturas pagadas</p>
                  </div>
                ) : filteredPaidInvoices.map(inv => (
                  <div key={inv.id}
                    className={`grid grid-cols-[40px_1fr_1fr_1fr_120px_100px_80px] gap-4 px-6 py-4 border-b border-brand-sand/10 hover:bg-brand-gold/5 transition-colors ${
                      selectedIds.has(inv.id) ? 'bg-brand-gold/10' : ''
                    }`}
                  >
                    <div className="flex items-center justify-center">
                      <div onClick={e => handleToggle(inv.id, e, filteredPaidInvoices)}
                        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all cursor-pointer ${
                          selectedIds.has(inv.id) ? 'bg-brand-gold border-brand-gold' : 'border-brand-sand hover:border-brand-gold'
                        }`}>
                        {selectedIds.has(inv.id) && <CheckCircle2 size={12} className="text-white" />}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-brand-ink">{inv.id}</p>
                      <p className="text-[9px] text-brand-ink/40">{inv.cfdiUUID ? inv.cfdiUUID.slice(0, 18) + '...' : 'UUID pendiente'}</p>
                    </div>
                    <p className="text-xs text-brand-ink/70 truncate">{inv.provider}</p>
                    <p className="text-[10px] text-brand-ink/50 truncate">{inv.description}</p>
                    <p className="text-xs font-bold text-brand-ink text-right">{CURRENCY_FORMATTER.format(inv.amount)}</p>
                    <p className="text-[10px] text-brand-ink/50">{inv.paidDate || inv.date}</p>
                    <span className={`text-[8px] font-bold uppercase tracking-wider px-2 py-1 rounded-full text-center ${
                      inv.paymentType === 'PPD' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'
                    }`}>{inv.paymentType || 'PUE'}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* ═══ TAB 2: Proveedores (Historial + Expedientes) ═══ */}
        {activeSection === 'proveedores' && (
          <motion.div key="proveedores" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
            {!selectedSupplier ? (
              <>
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="relative flex-1 min-w-[240px]">
                    <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-ink/30" />
                    <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                      placeholder="Buscar proveedor o RFC..."
                      className="w-full pl-11 pr-4 py-3 bg-white border border-brand-sand rounded-xl text-sm focus:outline-none focus:border-brand-gold" />
                  </div>
                  <button onClick={() => {
                    const content = `Expedientes Royáltica\nGenerado: ${new Date().toLocaleDateString('es-MX')}\n\nProveedores: ${MOCK_SUPPLIERS.length}\nDocumentos por proveedor: 6\n\n[En producción se generaría un ZIP real con JSZip.]`;
                    const blob = new Blob([content], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a'); a.href = url; a.download = 'Expedientes_Royaltica.txt';
                    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
                  }} className="flex items-center gap-2 px-4 py-3 bg-brand-ink text-brand-bone rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-brand-gold hover:text-brand-ink transition-all cursor-pointer flex-shrink-0">
                    <FolderDown size={14} /> Descargar Expedientes
                  </button>
                </div>

                {(() => {
                  const docExpiryMap: Record<string, { doc: string; daysLeft: number }[]> = {
                    'PROV-001': [{ doc: 'Opinión 32D', daysLeft: 8 }, { doc: 'Contrato Maestro', daysLeft: 45 }],
                    'PROV-003': [{ doc: 'Opinión 32D', daysLeft: 3 }],
                    'PROV-005': [{ doc: 'Identificación Vigente', daysLeft: 12 }],
                    'PROV-007': [{ doc: 'Comprobante de Domicilio', daysLeft: 5 }],
                    'PROV-009': [{ doc: 'Registro IMSS', daysLeft: 18 }, { doc: 'Opinión 32D', daysLeft: 9 }],
                    'PROV-011': [{ doc: 'Acta Constitutiva (actualización)', daysLeft: 22 }],
                  };
                  const allExpiring = Object.entries(docExpiryMap).flatMap(([id, docs]) => {
                    const s = MOCK_SUPPLIERS.find(sup => sup.id === id);
                    return docs.filter(d => d.daysLeft <= 15).map(d => ({ ...d, supplier: s?.name || id, supplierId: id }));
                  }).sort((a, b) => a.daysLeft - b.daysLeft);

                  return (
                    <>
                      {allExpiring.length > 0 && (
                        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-5 space-y-3">
                          <div className="flex items-center gap-2">
                            <AlertOctagon size={18} className="text-orange-600" />
                            <p className="text-sm font-bold text-orange-800">{allExpiring.length} documento(s) próximos a vencer</p>
                          </div>
                          <div className="space-y-2">
                            {allExpiring.map((d, i) => (
                              <div key={i} className="flex items-center justify-between bg-white/60 rounded-xl px-4 py-2.5 cursor-pointer hover:bg-white transition-colors"
                                onClick={() => {
                                  const sup = MOCK_SUPPLIERS.find(s => s.id === d.supplierId);
                                  if (sup) { setSelectedSupplier(sup); setSupplierDetailTab('expediente'); }
                                }}>
                                <div>
                                  <p className="text-[11px] font-bold text-orange-800">{d.supplier}</p>
                                  <p className="text-[9px] text-orange-600">{d.doc} — vence en {d.daysLeft} día{d.daysLeft !== 1 ? 's' : ''}</p>
                                </div>
                                <span className={`px-2.5 py-1 rounded-full text-[8px] font-bold flex-shrink-0 ${d.daysLeft <= 5 ? 'bg-red-100 text-red-700' : d.daysLeft <= 10 ? 'bg-orange-100 text-orange-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                  {d.daysLeft <= 5 ? 'Urgente' : d.daysLeft <= 10 ? 'Próximo' : 'Atención'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {MOCK_SUPPLIERS
                          .filter(s => !searchTerm || s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.rfc.toLowerCase().includes(searchTerm.toLowerCase()))
                          .map(supplier => {
                            const sInvoices = supplierInvoiceMap[supplier.name] || [];
                            const total = sInvoices.reduce((s, i) => s + i.amount, 0);
                            const expiringDocs = docExpiryMap[supplier.id] || [];
                            const urgentDocs = expiringDocs.filter(d => d.daysLeft <= 15);
                            return (
                              <motion.div key={supplier.id} whileHover={{ y: -2 }}
                                onClick={() => { setSelectedSupplier(supplier); setSupplierDetailTab('facturas'); setSelectedIds(new Set()); setSelectAll(false); }}
                                className={`editorial-card !p-6 cursor-pointer hover:border-brand-gold transition-all group ${urgentDocs.length > 0 ? 'border-orange-200' : ''}`}
                              >
                                <div className="flex items-start justify-between mb-4">
                                  <div className="w-10 h-10 bg-brand-bone rounded-xl flex items-center justify-center">
                                    <FolderSync size={20} className="text-brand-gold" />
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {urgentDocs.length > 0 && (
                                      <span className={`px-2 py-0.5 text-[8px] font-bold rounded-full ${urgentDocs.some(d => d.daysLeft <= 5) ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                                        {urgentDocs.length} doc. por vencer
                                      </span>
                                    )}
                                    <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all text-brand-gold" />
                                  </div>
                                </div>
                                <h4 className="font-bold text-brand-ink text-sm mb-0.5 truncate">{supplier.name}</h4>
                                <p className="text-[9px] font-mono text-brand-ink/40 mb-2">RFC: {supplier.rfc}</p>
                                {urgentDocs.length > 0 && (
                                  <div className="mb-3 space-y-1">
                                    {urgentDocs.map((d, i) => (
                                      <div key={i} className="flex items-center gap-1.5">
                                        <AlertTriangle size={9} className={d.daysLeft <= 5 ? 'text-red-500' : 'text-orange-400'} />
                                        <span className="text-[8px] text-orange-600">{d.doc} — {d.daysLeft}d</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                <div className="flex items-center justify-between pt-3 border-t border-brand-sand/30">
                                  <div>
                                    <p className="text-[8px] uppercase tracking-widest text-brand-ink/30 font-bold">Facturas Pagadas</p>
                                    <p className="text-lg font-serif text-brand-ink">{sInvoices.length}</p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-[8px] uppercase tracking-widest text-brand-ink/30 font-bold">Total</p>
                                    <p className="text-sm font-bold text-brand-gold">{sInvoices.length > 0 ? CURRENCY_FORMATTER.format(total) : '—'}</p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-[8px] uppercase tracking-widest text-brand-ink/30 font-bold">Archivos</p>
                                    <p className="text-sm font-bold text-brand-ink">06</p>
                                  </div>
                                </div>
                              </motion.div>
                            );
                          })}
                      </div>
                    </>
                  );
                })()}
              </>
            ) : (
              <>
                <div className="flex items-center gap-4">
                  <button onClick={() => setSelectedSupplier(null)} className="p-2 hover:bg-brand-sand/30 rounded-full transition-colors cursor-pointer">
                    <ChevronLeft size={20} className="text-brand-ink" />
                  </button>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-gold bg-brand-gold/10 px-3 py-1 rounded-full">Expediente Digital</span>
                      <span className="text-[10px] font-mono text-brand-ink/40">{selectedSupplier.rfc}</span>
                    </div>
                    <h3 className="text-2xl font-serif text-brand-ink">{selectedSupplier.name}</h3>
                    <p className="text-[10px] text-brand-ink/40">{selectedSupplier.category} · {selectedSupplier.seniorityYears} años · {selectedSupplier.legalName}</p>
                  </div>
                  {supplierDetailTab === 'facturas' && (
                    <div className="flex items-center gap-2">
                      <button onClick={() => {
                        const sInvs = supplierInvoiceMap[selectedSupplier.name] || [];
                        if (selectAll) { setSelectedIds(new Set()); } else { setSelectedIds(new Set(sInvs.map(i => i.id))); }
                        setSelectAll(!selectAll);
                      }}
                        className="px-4 py-2 bg-white border border-brand-sand rounded-xl text-[9px] font-bold uppercase tracking-widest hover:border-brand-gold transition-all cursor-pointer">
                        {selectAll ? 'Deseleccionar' : 'Seleccionar Todo'}
                      </button>
                      {selectedIds.size > 0 && (
                        <button onClick={handleDownloadSelected}
                          className="px-4 py-2 bg-brand-gold text-brand-ink rounded-xl text-[9px] font-bold uppercase tracking-widest hover:bg-brand-gold/90 transition-all cursor-pointer flex items-center gap-2">
                          <Download size={12} /> {selectedIds.size}
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-4 gap-4">
                  {[
                    { label: 'Total Pagado', value: CURRENCY_FORMATTER.format((supplierInvoiceMap[selectedSupplier.name] || []).reduce((s, i) => s + i.amount, 0)) },
                    { label: 'Facturas', value: String((supplierInvoiceMap[selectedSupplier.name] || []).length) },
                    { label: 'Última Factura', value: (supplierInvoiceMap[selectedSupplier.name] || [])[0]?.date || '—' },
                    { label: 'Documentos', value: '6 archivos' },
                  ].map(kpi => (
                    <div key={kpi.label} className="editorial-card !p-5 text-center">
                      <p className="text-[8px] uppercase tracking-widest text-brand-ink/30 font-bold mb-1">{kpi.label}</p>
                      <p className="text-lg font-serif text-brand-ink">{kpi.value}</p>
                    </div>
                  ))}
                </div>

                {/* Sub-tabs: Facturas vs Expediente */}
                <div className="flex gap-1 border-b border-brand-sand/30">
                  {([
                    { id: 'facturas' as const, label: 'Historial de Facturas', icon: <FileText size={12} /> },
                    { id: 'expediente' as const, label: 'Expediente / Documentos', icon: <FolderArchive size={12} /> },
                  ]).map(tab => (
                    <button key={tab.id} onClick={() => setSupplierDetailTab(tab.id)}
                      className={`flex items-center gap-2 px-5 py-3 text-[10px] font-bold uppercase tracking-widest transition-all cursor-pointer border-b-2 ${
                        supplierDetailTab === tab.id ? 'border-brand-gold text-brand-ink' : 'border-transparent text-brand-ink/30 hover:text-brand-ink'
                      }`}>
                      {tab.icon} {tab.label}
                    </button>
                  ))}
                </div>

                {supplierDetailTab === 'facturas' && (
                  <div className="editorial-card !p-0 overflow-hidden">
                    <div className="max-h-[400px] overflow-y-auto">
                      {(supplierInvoiceMap[selectedSupplier.name] || []).length === 0 ? (
                        <div className="py-16 text-center">
                          <FileSearch size={32} className="mx-auto text-brand-ink/10 mb-3" />
                          <p className="text-sm text-brand-ink/30">Sin facturas pagadas registradas</p>
                        </div>
                      ) : (supplierInvoiceMap[selectedSupplier.name] || []).map(inv => (
                        <div key={inv.id}
                          className={`flex items-center gap-4 px-6 py-4 border-b border-brand-sand/10 hover:bg-brand-gold/5 transition-colors ${selectedIds.has(inv.id) ? 'bg-brand-gold/10' : ''}`}
                        >
                          <div onClick={e => handleToggle(inv.id, e)}
                            className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all cursor-pointer ${
                              selectedIds.has(inv.id) ? 'bg-brand-gold border-brand-gold' : 'border-brand-sand hover:border-brand-gold'
                            }`}>
                            {selectedIds.has(inv.id) && <CheckCircle2 size={12} className="text-white" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-brand-ink">{inv.id}</span>
                              <span className={`text-[7px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${inv.paymentType === 'PPD' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'}`}>{inv.paymentType || 'PUE'}</span>
                              {inv.forensicStatus === 'VALIDATED' && <span className="text-[7px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-green-50 text-green-600">Validada</span>}
                            </div>
                            <p className="text-[10px] text-brand-ink/40 truncate">{inv.description}</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-sm font-bold text-brand-ink">{CURRENCY_FORMATTER.format(inv.amount)}</p>
                            <p className="text-[9px] text-brand-ink/40">{inv.paidDate || inv.date}</p>
                          </div>
                          <button onClick={e => { e.stopPropagation(); alert(`Descargando CFDI de ${inv.id}...`); }}
                            className="p-2 hover:bg-brand-sand/30 rounded-lg transition-colors cursor-pointer flex-shrink-0">
                            <Download size={14} className="text-brand-ink/30" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {supplierDetailTab === 'expediente' && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {[
                        { name: 'Acta Constitutiva.pdf', type: 'Legal', date: '2024-01-15' },
                        { name: 'Opinion_32D_Positiva.pdf', type: 'Fiscal', date: '2024-04-10' },
                        { name: 'Identificacion_Vigente.pdf', type: 'Identificación', date: '2023-11-20' },
                        { name: 'Comprobante_Domicilio.pdf', type: 'Dirección', date: '2024-03-05' },
                        { name: 'Contrato_Maestro_Final.pdf', type: 'Contrato', date: '2024-02-12' },
                        { name: 'Registro_Patronal_IMSS.pdf', type: 'Laboral', date: '2024-01-22' },
                      ].map((file, i) => (
                        <div key={i} className="flex items-center gap-4 p-4 rounded-2xl bg-white border border-brand-sand/20 hover:border-brand-gold transition-colors group cursor-pointer">
                          <div className="w-12 h-12 rounded-2xl bg-brand-gold/5 flex items-center justify-center text-brand-gold group-hover:bg-brand-gold group-hover:text-white transition-colors">
                            <FileText size={20} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-bold text-brand-ink truncate mb-0.5">{file.name}</p>
                            <div className="flex items-center gap-2">
                              <span className="text-[8px] uppercase font-black text-brand-ink/20 tracking-widest">{file.type}</span>
                              <span className="text-[8px] text-brand-ink/40 font-serif">Cap: {file.date}</span>
                            </div>
                          </div>
                          <Download size={14} className="opacity-0 group-hover:opacity-40 flex-shrink-0" />
                        </div>
                      ))}
                    </div>
                    <button className="flex items-center gap-3 px-6 py-3.5 bg-brand-ink text-brand-bone rounded-2xl text-[10px] uppercase font-bold tracking-widest hover:bg-brand-gold hover:text-brand-ink transition-all cursor-pointer">
                      <UploadCloud size={16} /> Cargar Nuevo Documento
                    </button>
                  </div>
                )}
              </>
            )}
          </motion.div>
        )}

        {/* ═══ TAB 3: Estados Financieros + DIOT ═══ */}
        {activeSection === 'estados' && (
          <motion.div key="estados" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
            <div className="flex gap-2 flex-wrap">
              {([
                { id: 'resultados' as const, label: 'Estado de Resultados' },
                { id: 'razones' as const, label: 'Razones Financieras' },
                { id: 'diot' as const, label: 'DIOT' },
              ]).map(sub => (
                <button key={sub.id} onClick={() => setEstadosSub(sub.id)}
                  className={`px-5 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all cursor-pointer ${
                    estadosSub === sub.id ? 'bg-brand-gold text-brand-ink shadow-sm' : 'bg-white border border-brand-sand text-brand-ink/40 hover:text-brand-ink hover:border-brand-gold'
                  }`}>
                  {sub.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-4 flex-wrap editorial-card !py-4 !px-6 !bg-white/60">
              <Calendar size={16} className="text-brand-gold" />
              <span className="text-[9px] text-brand-ink/40 font-bold uppercase tracking-widest">Periodo</span>
              <div className="flex items-center gap-2">
                <input type="month" value={estadosFrom} onChange={e => setEstadosFrom(e.target.value)}
                  className="px-3 py-2 bg-white border border-brand-sand rounded-xl text-[11px] text-brand-ink focus:outline-none focus:border-brand-gold" />
                <span className="text-[9px] text-brand-ink/30 font-bold">—</span>
                <input type="month" value={estadosTo} onChange={e => setEstadosTo(e.target.value)}
                  className="px-3 py-2 bg-white border border-brand-sand rounded-xl text-[11px] text-brand-ink focus:outline-none focus:border-brand-gold" />
              </div>
              <div className="flex gap-1.5 ml-auto">
                {[
                  { label: 'Q1', from: '2024-01', to: '2024-03' },
                  { label: 'Q2', from: '2024-04', to: '2024-06' },
                  { label: 'Q3', from: '2024-07', to: '2024-09' },
                  { label: 'Q4', from: '2024-10', to: '2024-12' },
                  { label: 'Año', from: '2024-01', to: '2024-12' },
                ].map(preset => (
                  <button key={preset.label} onClick={() => { setEstadosFrom(preset.from); setEstadosTo(preset.to); }}
                    className={`px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all cursor-pointer ${
                      estadosFrom === preset.from && estadosTo === preset.to
                        ? 'bg-brand-ink text-brand-paper'
                        : 'bg-brand-sand/30 text-brand-ink/40 hover:text-brand-ink hover:bg-brand-sand/50'
                    }`}>
                    {preset.label}
                  </button>
                ))}
              </div>
              <span className="text-[9px] text-brand-ink/30">{financialData.length} periodo{financialData.length !== 1 ? 's' : ''} · {estadosFilteredInvoices.length} facturas</span>
            </div>

            {estadosSub === 'resultados' && (
              <div className="editorial-card space-y-6">
                <EstadoResultadosReal />
                <div className="flex items-center justify-between">
                  <div>
                    <span className="label-caps !text-brand-gold">Proyección estimada</span>
                    <h3 className="text-2xl font-serif text-brand-ink">Estado de Resultados (histórico)</h3>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b-2 border-brand-ink/10">
                        <th className="text-left py-3 text-[9px] uppercase tracking-widest font-bold text-brand-ink/30">Concepto</th>
                        {financialData.map(d => <th key={d.period} className="text-right py-3 text-[9px] uppercase tracking-widest font-bold text-brand-ink/30">{d.period}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { label: 'Ingresos Netos', key: 'ingresos' as const, bold: true },
                        { label: 'Costo de Ventas', key: 'costoVentas' as const, bold: false },
                        { label: 'Utilidad Bruta', key: 'utilidadBruta' as const, bold: true },
                        { label: 'Gastos de Operación', key: 'gastosOp' as const, bold: false },
                        { label: 'Utilidad Operativa', key: 'utilidadOp' as const, bold: true },
                        { label: 'Utilidad Neta', key: 'utilidadNeta' as const, bold: true },
                      ].map(row => (
                        <tr key={row.label} className={`border-b border-brand-sand/20 ${row.bold ? 'bg-brand-bone/50' : ''}`}>
                          <td className={`py-3 ${row.bold ? 'font-bold text-brand-ink' : 'text-brand-ink/60 pl-4'} text-xs`}>{row.label}</td>
                          {financialData.map(d => (
                            <td key={d.period} className={`text-right py-3 ${row.bold ? 'font-bold text-brand-ink' : 'text-brand-ink/60'} text-xs`}>
                              {CURRENCY_FORMATTER.format(d[row.key])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {estadosSub === 'razones' && (
              <div className="editorial-card space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="label-caps !text-brand-gold">Análisis</span>
                    <h3 className="text-2xl font-serif text-brand-ink">Razones Financieras</h3>
                  </div>
                  <button onClick={() => alert('Descargando Razones Financieras (XLSX)...')} className="px-4 py-2 bg-brand-ink text-brand-paper rounded-xl text-[9px] font-bold uppercase tracking-widest hover:bg-black transition-all cursor-pointer flex items-center gap-2">
                    <Download size={12} /> Exportar
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b-2 border-brand-ink/10">
                        <th className="text-left py-3 text-[9px] uppercase tracking-widest font-bold text-brand-ink/30">Razón</th>
                        <th className="text-left py-3 text-[9px] uppercase tracking-widest font-bold text-brand-ink/30">Fórmula</th>
                        {financialData.map(d => <th key={d.period} className="text-right py-3 text-[9px] uppercase tracking-widest font-bold text-brand-ink/30">{d.period}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { label: 'Razón Circulante', formula: 'AC / PC', calc: (d: typeof financialData[0]) => (d.activoCirculante / d.pasivoCirculante).toFixed(2) },
                        { label: 'Prueba del Ácido', formula: '(AC - Inv) / PC', calc: (d: typeof financialData[0]) => ((d.activoCirculante - d.inventarios) / d.pasivoCirculante).toFixed(2) },
                        { label: 'Endeudamiento', formula: 'PT / AT', calc: (d: typeof financialData[0]) => ((d.pasivosTotales / d.activosTotales) * 100).toFixed(1) + '%' },
                        { label: 'Apalancamiento', formula: 'PT / CC', calc: (d: typeof financialData[0]) => (d.pasivosTotales / d.capitalContable).toFixed(2) },
                        { label: 'Margen Bruto', formula: 'UB / Ingresos', calc: (d: typeof financialData[0]) => ((d.utilidadBruta / d.ingresos) * 100).toFixed(1) + '%' },
                        { label: 'Margen Operativo', formula: 'UO / Ingresos', calc: (d: typeof financialData[0]) => ((d.utilidadOp / d.ingresos) * 100).toFixed(1) + '%' },
                        { label: 'Margen Neto', formula: 'UN / Ingresos', calc: (d: typeof financialData[0]) => ((d.utilidadNeta / d.ingresos) * 100).toFixed(1) + '%' },
                        { label: 'ROA', formula: 'UN / AT', calc: (d: typeof financialData[0]) => ((d.utilidadNeta / d.activosTotales) * 100).toFixed(1) + '%' },
                        { label: 'ROE', formula: 'UN / CC', calc: (d: typeof financialData[0]) => ((d.utilidadNeta / d.capitalContable) * 100).toFixed(1) + '%' },
                      ].map(row => (
                        <tr key={row.label} className="border-b border-brand-sand/20 hover:bg-brand-bone/50 transition-colors">
                          <td className="py-3 text-xs font-bold text-brand-ink">{row.label}</td>
                          <td className="py-3 text-[10px] text-brand-ink/40 font-mono">{row.formula}</td>
                          {financialData.map(d => (
                            <td key={d.period} className="text-right py-3 text-xs font-bold text-brand-ink">{row.calc(d)}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {estadosSub === 'diot' && (
              <div className="space-y-6">
                <div className="editorial-card !py-4 !px-6 !bg-white/60 flex items-center gap-4 flex-wrap">
                  <Calendar size={16} className="text-purple-500" />
                  <span className="text-[9px] text-brand-ink/40 font-bold uppercase tracking-widest">Mes de declaración</span>
                  <input type="month" value={diotMonth} onChange={e => setDiotMonth(e.target.value)}
                    className="px-3 py-2 bg-white border border-brand-sand rounded-xl text-[11px] text-brand-ink focus:outline-none focus:border-purple-400" />
                  <div className="flex gap-1.5">
                    {MONTH_NAMES.map((m, mi) => {
                      const val = `2024-${String(mi + 1).padStart(2, '0')}`;
                      return (
                        <button key={m} onClick={() => setDiotMonth(val)}
                          className={`w-8 h-8 rounded-lg text-[8px] font-bold uppercase transition-all cursor-pointer ${
                            diotMonth === val ? 'bg-purple-600 text-white shadow-sm' : 'bg-brand-sand/30 text-brand-ink/30 hover:text-brand-ink hover:bg-brand-sand/50'
                          }`}>
                          {m.slice(0, 3)}
                        </button>
                      );
                    })}
                  </div>
                  <span className="text-[9px] text-brand-ink/30 ml-auto">{diotMonthInvoices.length} facturas en el mes</span>
                </div>

                <div className="editorial-card space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="label-caps !text-brand-gold">Declaración Mensual SAT</span>
                    <h3 className="text-2xl font-serif text-brand-ink">DIOT — {diotMonth ? `${MONTH_NAMES[parseInt(diotMonth.split('-')[1]) - 1]} ${diotMonth.split('-')[0]}` : 'Selecciona un mes'}</h3>
                    <p className="text-[10px] text-brand-ink/40 mt-1">Declaración Informativa de Operaciones con Terceros (Art. 32 LIVA) — presentación mensual</p>
                  </div>
                  <button onClick={() => {
                    const header = '6|1||04|' ;
                    const lines = diotData.map(d =>
                      `6|1|${d.rfc}|04|85|${d.name}||||${Math.round(d.valorActos16)}|${Math.round(d.iva16)}|||||${Math.round(d.ivaRetenido)}|||||||||||`
                    );
                    const content = [header, ...lines].join('\n');
                    const blob = new Blob([content], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const monthLabel = diotMonth.replace('-', '_');
                    const a = document.createElement('a'); a.href = url; a.download = `DIOT_A29_${monthLabel}.txt`;
                    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
                  }} className="px-4 py-2 bg-brand-ink text-brand-paper rounded-xl text-[9px] font-bold uppercase tracking-widest hover:bg-black transition-all cursor-pointer flex items-center gap-2">
                    <Download size={12} /> Exportar TXT (A29)
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-purple-50 border border-purple-200 rounded-2xl p-5 text-center">
                    <p className="text-[8px] uppercase tracking-widest text-purple-500 font-bold mb-1">Proveedores Declarados</p>
                    <p className="text-3xl font-serif text-purple-700">{diotData.length}</p>
                  </div>
                  <div className="bg-purple-50 border border-purple-200 rounded-2xl p-5 text-center">
                    <p className="text-[8px] uppercase tracking-widest text-purple-500 font-bold mb-1">Total Operaciones</p>
                    <p className="text-3xl font-serif text-purple-700">{CURRENCY_FORMATTER.format(diotData.reduce((s, d) => s + d.valorActos16, 0))}</p>
                  </div>
                  <div className="bg-purple-50 border border-purple-200 rounded-2xl p-5 text-center">
                    <p className="text-[8px] uppercase tracking-widest text-purple-500 font-bold mb-1">IVA Trasladado 16%</p>
                    <p className="text-3xl font-serif text-purple-700">{CURRENCY_FORMATTER.format(diotData.reduce((s, d) => s + d.iva16, 0))}</p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b-2 border-brand-ink/10">
                        <th className="text-left py-3 text-[9px] uppercase tracking-widest font-bold text-brand-ink/30">RFC</th>
                        <th className="text-left py-3 text-[9px] uppercase tracking-widest font-bold text-brand-ink/30">Proveedor</th>
                        <th className="text-center py-3 text-[9px] uppercase tracking-widest font-bold text-brand-ink/30">Ops</th>
                        <th className="text-right py-3 text-[9px] uppercase tracking-widest font-bold text-brand-ink/30">Valor Actos 16%</th>
                        <th className="text-right py-3 text-[9px] uppercase tracking-widest font-bold text-brand-ink/30">IVA 16%</th>
                        <th className="text-right py-3 text-[9px] uppercase tracking-widest font-bold text-brand-ink/30">IVA Ret.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {diotData.map(row => (
                        <tr key={row.rfc} className="border-b border-brand-sand/20 hover:bg-brand-bone/50 transition-colors">
                          <td className="py-3 text-[10px] font-mono text-brand-ink/60">{row.rfc}</td>
                          <td className="py-3 text-xs text-brand-ink truncate max-w-[200px]">{row.name}</td>
                          <td className="py-3 text-xs text-brand-ink text-center font-bold">{row.totalOps}</td>
                          <td className="py-3 text-xs text-brand-ink text-right">{CURRENCY_FORMATTER.format(row.valorActos16)}</td>
                          <td className="py-3 text-xs text-brand-ink text-right">{CURRENCY_FORMATTER.format(row.iva16)}</td>
                          <td className="py-3 text-xs text-brand-ink text-right">{row.ivaRetenido > 0 ? CURRENCY_FORMATTER.format(row.ivaRetenido) : '—'}</td>
                        </tr>
                      ))}
                      <tr className="bg-brand-ink/5 font-bold">
                        <td colSpan={2} className="py-3 text-xs text-brand-ink pl-4">Total</td>
                        <td className="py-3 text-xs text-brand-ink text-center">{diotData.reduce((s, d) => s + d.totalOps, 0)}</td>
                        <td className="py-3 text-xs text-brand-ink text-right">{CURRENCY_FORMATTER.format(diotData.reduce((s, d) => s + d.valorActos16, 0))}</td>
                        <td className="py-3 text-xs text-brand-ink text-right">{CURRENCY_FORMATTER.format(diotData.reduce((s, d) => s + d.iva16, 0))}</td>
                        <td className="py-3 text-xs text-brand-ink text-right">{CURRENCY_FORMATTER.format(diotData.reduce((s, d) => s + d.ivaRetenido, 0))}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
              </div>
            )}
          </motion.div>
        )}

        {/* ═══ TAB 4: Centro de Descargas ═══ */}
        {activeSection === 'descargas' && (
          <motion.div key="descargas" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
            {/* Exportaciones CSV reales (datos del backend) */}
            <CsvExportsBar />
            <p className="text-sm text-brand-ink/50">Selecciona categorías de documentos para generar un paquete descargable.</p>

            {(() => {
              const categories = [
                { id: 'cfdi', label: 'CFDIs (XML + PDF)', icon: <FileText size={20} />, count: paidInvoices.length, desc: 'Comprobantes fiscales digitales' },
                { id: 'soporte', label: 'Documentos de Soporte', icon: <Paperclip size={20} />, count: Math.floor(paidInvoices.length * 0.7), desc: 'Órdenes de compra, contratos, remisiones' },
                { id: 'audit', label: 'Reportes de Auditoría', icon: <ShieldCheck size={20} />, count: paidInvoices.filter(i => i.forensicStatus).length, desc: 'Resultados de AI Triple Match' },
                { id: 'estados', label: 'Estados Financieros', icon: <FileBarChart size={20} />, count: 4, desc: 'Estado de resultados, balance, razones (por trimestre)' },
                { id: 'diot', label: 'DIOT (Layout A29)', icon: <Scale size={20} />, count: 1, desc: 'Declaración Informativa de Operaciones con Terceros' },
                { id: 'bitacora', label: 'Bitácora de Operaciones', icon: <History size={20} />, count: 1, desc: 'Log inmutable de todas las operaciones' },
                { id: 'expedientes', label: 'Expedientes de Proveedores', icon: <FolderArchive size={20} />, count: MOCK_SUPPLIERS.length, desc: 'Actas, 32D, contratos, identificaciones' },
                { id: 'fiscal', label: 'Paquete Fiscal Completo', icon: <FolderDown size={20} />, count: 1, desc: 'Todo lo anterior en un solo ZIP para auditoría' },
              ];
              return (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {categories.map(cat => {
                    const isSelected = selectedIds.has(cat.id);
                    return (
                      <div key={cat.id} onClick={e => handleToggle(cat.id, e)}
                        className={`editorial-card !p-6 cursor-pointer transition-all hover:border-brand-gold ${isSelected ? 'border-brand-gold bg-brand-gold/5 shadow-md' : ''}`}>
                        <div className="flex items-start justify-between mb-4">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isSelected ? 'bg-brand-gold text-brand-ink' : 'bg-brand-sand/50 text-brand-ink/40'} transition-all`}>
                            {cat.icon}
                          </div>
                          <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-brand-gold border-brand-gold' : 'border-brand-sand'}`}>
                            {isSelected && <CheckCircle2 size={14} className="text-white" />}
                          </div>
                        </div>
                        <h4 className="font-bold text-brand-ink text-sm mb-1">{cat.label}</h4>
                        <p className="text-[10px] text-brand-ink/40 mb-3">{cat.desc}</p>
                        <span className="text-[9px] font-bold text-brand-gold uppercase tracking-widest">{cat.count} archivo{cat.count !== 1 ? 's' : ''}</span>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            <div className="flex items-center justify-between editorial-card !p-6 bg-brand-ink !text-brand-paper !border-brand-ink">
              <div>
                <p className="text-sm font-bold text-brand-bone">{selectedIds.size} categoría{selectedIds.size !== 1 ? 's' : ''} seleccionada{selectedIds.size !== 1 ? 's' : ''}</p>
                <p className="text-[10px] text-brand-bone/40">Se generará un archivo ZIP con toda la documentación</p>
              </div>
              <button
                onClick={() => { if (selectedIds.size > 0) alert(`Generando paquete con ${selectedIds.size} categoría(s)...\n\n(En producción, esto crearía un ZIP descargable)`); }}
                disabled={selectedIds.size === 0}
                className="px-6 py-3 bg-brand-gold text-brand-ink rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-brand-gold/90 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2">
                <Download size={14} /> Generar Paquete
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

