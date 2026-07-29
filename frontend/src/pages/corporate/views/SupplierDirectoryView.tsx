import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldCheck, CheckCircle2, Zap, ChevronRight, Search, FileText, X, Plus, AlertTriangle, ListChecks, Ban } from 'lucide-react';
import { MOCK_SUPPLIERS, type Invoice, type Supplier } from '../../../types.ts';
import { CURRENCY_FORMATTER, getPriorityInfo, getSupplierChecklist } from '../../../utils/format.ts';
import { StatusBadge } from '../../../components/StatusBadge.tsx';
import { SupplierSatBadge, DetailItem, InvoiceDetailModal } from './PendingInvoicesView.tsx';

export interface DocumentFile {
  id: string;
  name: string;
  type: string;
  date: string;
}


export function DocumentManagerModal({ 
  title, 
  onClose, 
  initialDocuments 
}: { 
  title: string; 
  onClose: () => void; 
  initialDocuments: DocumentFile[] 
}) {
  const [docs, setDocs] = useState<DocumentFile[]>(initialDocuments);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const handleDelete = (id: string) => {
    setDocs(prev => prev.filter(d => d.id !== id));
    setConfirmDelete(null);
  };

  const handleUpload = () => {
    const newDoc: DocumentFile = {
      id: Math.random().toString(36).substr(2, 9),
      name: `DOCUMENTO_CARGADO_${docs.length + 1}.pdf`,
      type: 'application/pdf',
      date: new Date().toISOString().split('T')[0]
    };
    setDocs(prev => [...prev, newDoc]);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-brand-ink/40 backdrop-blur-md">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-brand-bone w-full max-w-2xl rounded-[2.5rem] shadow-2xl border border-brand-sand/50 overflow-hidden"
      >
        <div className="p-8 border-b border-brand-sand/30 flex justify-between items-center bg-white/50">
          <div>
            <span className="label-caps !text-brand-gold">Gestión de Archivos</span>
            <h3 className="text-2xl text-brand-ink">{title}</h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-brand-sand/20 rounded-full transition-colors">
            <X className="w-6 h-6 text-brand-ink/40" />
          </button>
        </div>

        <div className="p-8 max-h-[60vh] overflow-y-auto space-y-6">
          {/* Upload Area */}
          <div 
            onClick={handleUpload}
            className="border-2 border-dashed border-brand-sand/50 rounded-[1.5rem] p-10 flex flex-col items-center justify-center gap-3 hover:border-brand-gold/50 hover:bg-brand-gold/5 transition-all cursor-pointer group"
          >
            <div className="w-12 h-12 rounded-full bg-brand-gold/10 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Plus className="w-6 h-6 text-brand-gold" />
            </div>
            <p className="text-sm font-medium text-brand-ink/60">Haz click para cargar nuevos documentos PDF</p>
            <p className="text-[10px] uppercase tracking-widest text-brand-ink/40">Tamaño máximo 10MB</p>
          </div>

          {/* Docs List */}
          <div className="grid grid-cols-1 gap-3">
            {docs.map(doc => (
              <div key={doc.id} className="group relative bg-white border border-brand-sand/30 p-4 rounded-2xl flex items-center justify-between hover:shadow-md transition-all">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-brand-bone rounded-xl flex items-center justify-center">
                    <FileText className="w-5 h-5 text-brand-gold" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-brand-ink">{doc.name}</p>
                    <p className="text-[10px] text-brand-ink/40 uppercase tracking-tighter">{doc.date} • PDF Document</p>
                  </div>
                </div>

                {confirmDelete === doc.id ? (
                  <div className="flex items-center gap-2 bg-red-50 p-1 px-2 rounded-lg border border-red-100 animate-in fade-in zoom-in duration-200">
                    <span className="text-[10px] font-bold text-red-600 uppercase">¿Seguro?</span>
                    <button 
                      onClick={() => handleDelete(doc.id)}
                      className="px-2 py-1 bg-red-600 text-white text-[10px] font-bold rounded hover:bg-red-700 transition-colors"
                    >
                      CONTINUAR
                    </button>
                    <button 
                      onClick={() => setConfirmDelete(null)}
                      className="px-2 py-1 bg-gray-200 text-gray-600 text-[10px] font-bold rounded hover:bg-gray-300 transition-colors"
                    >
                      CANCELAR
                    </button>
                  </div>
                ) : (
                  <button 
                    onClick={() => setConfirmDelete(doc.id)}
                    className="p-2 text-brand-ink/20 hover:text-red-500 hover:bg-red-50 rounded-full transition-all opacity-0 group-hover:opacity-100"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export function SupplierChecklistBadge({ supplier }: { supplier: Supplier }) {
  const { passed, total } = getSupplierChecklist(supplier);
  const complete = total > 0 && passed === total;
  const color = total === 0 ? 'bg-brand-sand/40 text-brand-ink/40 border-brand-sand'
    : complete ? 'bg-green-100 text-green-700 border-green-300'
    : passed === 0 ? 'bg-red-100 text-red-600 border-red-300'
    : 'bg-yellow-100 text-yellow-700 border-yellow-300';

  return (
    <span title="Factores de cumplimiento (RFC, 69-B, aprobación) + documentos KYC validados sobre el total del expediente."
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[8px] uppercase font-bold tracking-widest border ${color}`}>
      {complete ? <CheckCircle2 size={10} /> : <ListChecks size={10} />}
      {passed}/{total} verificados
    </span>
  );
}


export function SupplierDirectoryView({
  invoices, 
  onAuditRequest,
  initialSupplierName,
  initialPriorityFilter
}: { 
  invoices: Invoice[], 
  onAuditRequest: (inv: Invoice) => void,
  initialSupplierName?: string | null,
  initialPriorityFilter?: string | null
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);
  const [invoiceSearchTerm, setInvoiceSearchTerm] = useState('');
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState<'all' | 'pending' | 'paid'>('all');
  const [invoicePriorityFilter, setInvoicePriorityFilter] = useState<string>('all');

  useEffect(() => {
    if (initialSupplierName) {
      const supplier = MOCK_SUPPLIERS.find(s => s.name === initialSupplierName);
      if (supplier) {
        setSelectedSupplier(supplier);
      }
    }
    if (initialPriorityFilter) {
      setInvoicePriorityFilter(initialPriorityFilter);
      setInvoiceStatusFilter('pending'); // Priority navigation implies looking for pending invoices
    }
  }, [initialSupplierName, initialPriorityFilter]);

  const filteredSuppliers = MOCK_SUPPLIERS.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         s.rfc.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || s.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const getPendingCount = (providerId: string) => {
    return invoices.filter(inv => inv.providerId === providerId && inv.status === 'pending').length;
  };

  const supplierInvoices = selectedSupplier 
    ? invoices.filter(inv => inv.providerId === selectedSupplier.id)
        .filter(inv => {
          const matchesSearch = inv.id.toLowerCase().includes(invoiceSearchTerm.toLowerCase());
          const matchesStatus = invoiceStatusFilter === 'all' || inv.status === invoiceStatusFilter;
          
          let matchesPriority = true;
          if (invoicePriorityFilter !== 'all' && inv.status === 'pending') {
            const priority = getPriorityInfo(inv.date).label;
            matchesPriority = priority === invoicePriorityFilter;
          }

          return matchesSearch && matchesStatus && matchesPriority;
        })
    : [];

  return (
    <div className="flex flex-col pb-12">
      <div className="grid grid-cols-12 gap-6">
        <div className={`${selectedSupplier ? 'col-span-12 lg:col-span-4' : 'col-span-12'} flex flex-col transition-all duration-500`}>
          <header className="mb-4 flex-shrink-0">
            <span className="label-caps mb-2 block">Directorio Global</span>
            <h2 className="text-4xl mb-4 font-serif text-brand-ink">Proveedores</h2>
            <div className="flex gap-3 max-w-2xl">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 opacity-30 text-brand-ink" size={16} />
                <input 
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Buscar por Nombre o RFC..."
                  className="w-full pl-10 pr-4 py-2.5 bg-brand-cream border border-brand-sand rounded-xl text-sm focus:outline-none focus:border-brand-gold shadow-sm"
                />
              </div>
              <select 
                value={selectedCategory}
                onChange={e => setSelectedCategory(e.target.value)}
                className="px-4 py-2.5 bg-brand-cream border border-brand-sand rounded-xl text-[10px] uppercase font-bold tracking-[0.2em] shadow-sm cursor-pointer outline-none focus:border-brand-gold"
              >
                <option value="all">Todas las Categorías</option>
                {Array.from(new Set(MOCK_SUPPLIERS.map(s => s.category))).sort().map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </header>

          <div className="editorial-card !p-0 overflow-hidden shadow-xl shadow-brand-sand/30 flex flex-col border border-brand-sand/50">
            <div className="scrollbar-thin scrollbar-thumb-brand-sand scrollbar-track-transparent">
              <table className="w-full text-left border-separate border-spacing-0">
                <thead className="bg-brand-sand/10 border-b border-brand-sand sticky top-0 z-10 backdrop-blur-md">
                  <tr>
                    <th className="px-6 py-3 label-caps !opacity-40 border-b border-brand-sand">Proveedor</th>
                    <th className="px-6 py-3 label-caps !opacity-40 border-b border-brand-sand">RFC</th>
                    <th className="px-6 py-3 text-right label-caps !opacity-40 border-b border-brand-sand">Pendientes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-sand/20">
                  {filteredSuppliers.map(s => (
                    <tr 
                      key={s.id} 
                      onClick={() => setSelectedSupplier(s)}
                      className={`hover:bg-brand-gold/5 cursor-pointer transition-all duration-200 ${selectedSupplier?.id === s.id ? 'bg-brand-gold/10' : ''}`}
                    >
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-brand-ink">{s.name}</p>
                          {s.sat69b?.listed && (
                            <span title={`RFC en lista 69-B del SAT (${s.sat69b.status}).`}
                              className="text-[7px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200 inline-flex items-center gap-0.5">
                              <AlertTriangle size={8} /> 69-B
                            </span>
                          )}
                        </div>
                        <p className="text-[9px] text-brand-ink/40 uppercase font-serif">{s.category}</p>
                      </td>
                      <td className="px-6 py-3 text-[11px] font-mono tracking-tighter opacity-70">{s.rfc}</td>
                      <td className="px-6 py-3 text-right font-bold text-xs text-brand-ink">
                        <span className={`px-2 py-1 rounded-lg ${getPendingCount(s.id) > 0 ? 'bg-brand-gold/20 text-brand-ink' : 'bg-brand-sand/20 opacity-30 text-brand-ink'}`}>
                          {getPendingCount(s.id)}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {filteredSuppliers.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-6 py-12 text-center text-xs opacity-40 font-serif">
                        No se encontraron proveedores que coincidan con la búsqueda.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>


        {selectedSupplier && (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="col-span-12 lg:col-span-8 flex flex-col"
          >
            <div className="editorial-card !bg-brand-cream !p-8 shadow-2xl shadow-brand-sand/40 flex flex-col border border-brand-gold/30">
              <div className="flex-shrink-0 flex justify-between items-start mb-8">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <span className="label-caps">Detalle Estratégico</span>
                    <span className="px-3 py-1 bg-brand-gold/20 rounded-full text-[8px] uppercase font-bold tracking-widest text-brand-ink border border-brand-gold/30">
                      ID: {selectedSupplier.id}
                    </span>
                    <SupplierChecklistBadge supplier={selectedSupplier} />
                    <SupplierSatBadge supplier={selectedSupplier} />
                  </div>
                  <h3 className="text-5xl text-brand-ink leading-none font-serif">{selectedSupplier.name}</h3>
                  <div className="grid grid-cols-2 gap-x-12 gap-y-6 pt-4">
                    <DetailItem label="Entidad Legal" value={selectedSupplier.legalName} />
                    <DetailItem label="Registro Federal (RFC)" value={selectedSupplier.rfc} />
                    <DetailItem label="Operación Principal" value={selectedSupplier.activity} />
                    <DetailItem label="Antigüedad en Relación" value={`${selectedSupplier.seniorityYears} años certificados`} />
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedSupplier(null)}
                  className="opacity-20 hover:opacity-100 transition-all p-3 bg-brand-ink text-brand-paper rounded-full flex-shrink-0 hover:rotate-90"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-10 pr-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="label-caps !opacity-20">Expediente de Cumplimiento</h4>
                    <span className="text-[9px] uppercase font-bold text-green-600 flex items-center gap-1">
                      <ShieldCheck size={10} /> Validado por Royáltica IA
                    </span>
                  </div>
                  <div className="flex gap-3 flex-wrap">
                    {selectedSupplier.documents.map((doc, i) => (
                      <div key={i} className="glass-pill !bg-white border-brand-sand/40 text-[9px] uppercase font-bold text-brand-ink flex items-center gap-2 shadow-sm">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500" /> {doc.type}
                      </div>
                    ))}
                  </div>
                  {selectedSupplier.sat69b && (
                    <div className={`mt-2 p-4 rounded-2xl border ${selectedSupplier.sat69b.listed ? 'bg-red-50 border-red-200' : 'bg-white border-brand-sand/40'}`}>
                      <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-brand-ink/40 mb-3">Verificación SAT del proveedor</p>
                      <div className="space-y-2.5">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center text-white flex-shrink-0 ${selectedSupplier.sat69b.rfcValid ? 'bg-green-500' : 'bg-amber-400'}`}>
                            {selectedSupplier.sat69b.rfcValid ? <CheckCircle2 size={11} /> : <AlertTriangle size={11} />}
                          </div>
                          <span className="text-[11px] text-brand-ink/70 flex-1"><b>RFC del proveedor:</b> {selectedSupplier.rfc} — {selectedSupplier.sat69b.rfcValid ? 'formato válido y verificado.' : 'formato no válido, revisar.'}</span>
                        </div>
                        <div className="flex items-center gap-2.5">
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center text-white flex-shrink-0 ${selectedSupplier.sat69b.listed ? 'bg-red-500' : 'bg-green-500'}`}>
                            {selectedSupplier.sat69b.listed ? <Ban size={11} /> : <CheckCircle2 size={11} />}
                          </div>
                          <span className="text-[11px] text-brand-ink/70 flex-1">
                            <b>Lista negra 69-B (EFOS):</b> {selectedSupplier.sat69b.listed
                              ? `RFC en la lista con estatus ${selectedSupplier.sat69b.status}. Riesgo fiscal: la deducción de sus facturas podría no ser procedente.`
                              : 'Aprobado. El RFC NO aparece en la lista negra 69-B del SAT.'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-4 pt-8 border-t border-brand-sand/60">
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <h4 className="label-caps !opacity-20">Historial de Transacciones</h4>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-brand-gold uppercase tracking-widest bg-brand-gold/10 px-2 py-0.5 rounded-md">
                          {getPendingCount(selectedSupplier.id)} pendientes
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-30" />
                        <input 
                          type="text"
                          value={invoiceSearchTerm}
                          onChange={(e) => setInvoiceSearchTerm(e.target.value)}
                          placeholder="Buscar factura..."
                          className="w-full pl-8 pr-3 py-2 bg-white border border-brand-sand/30 rounded-xl text-[11px] focus:outline-none focus:border-brand-gold"
                        />
                      </div>
                      <div className="flex gap-1.5">
                        <select 
                          value={invoiceStatusFilter}
                          onChange={(e) => {
                            const val = e.target.value as any;
                            setInvoiceStatusFilter(val);
                            if (val !== 'pending') setInvoicePriorityFilter('all');
                          }}
                          className="px-2 py-2 bg-white border border-brand-sand/30 rounded-xl text-[10px] font-bold uppercase tracking-wider outline-none focus:border-brand-gold cursor-pointer"
                        >
                          <option value="all">General</option>
                          <option value="pending">Por Pagar</option>
                          <option value="paid">Liquidadas</option>
                        </select>
                        {invoiceStatusFilter === 'pending' && (
                          <select 
                            value={invoicePriorityFilter}
                            onChange={(e) => setInvoicePriorityFilter(e.target.value)}
                            className="px-2 py-2 bg-white border border-brand-sand/30 rounded-xl text-[10px] font-bold uppercase tracking-wider outline-none focus:border-brand-gold cursor-pointer"
                          >
                            <option value="all">Prioridad</option>
                            <option value="Óptimo">Óptimo</option>
                            <option value="En Tiempo">En Tiempo</option>
                            <option value="Media Alta">Media Alta</option>
                            <option value="Urgente">Urgente</option>
                          </select>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {supplierInvoices.map(inv => (
                      <div 
                        key={inv.id} 
                        onClick={() => setViewingInvoice(inv)}
                        className={`group p-4 bg-white/40 rounded-[1.5rem] border border-brand-sand/30 flex items-center justify-between hover:bg-white hover:shadow-lg hover:border-brand-gold/20 transition-all cursor-zoom-in`}
                      >
                        <div className="flex items-center gap-5 flex-1 min-w-0">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${inv.status === 'paid' ? 'bg-green-50 text-green-600' : 'bg-brand-gold/10 text-brand-gold'}`}>
                            {inv.status === 'paid' ? <CheckCircle2 size={16} /> : <Zap size={16} />}
                          </div>
                          <div className="flex-1 min-w-0 flex items-center gap-6">
                            <div className="space-y-1 min-w-[80px]">
                               <p className="text-[11px] font-extrabold text-brand-ink tracking-tight">{inv.id}</p>
                               <p className="text-[9px] opacity-40 font-serif">Autorizada</p>
                            </div>
                            
                            {inv.status === 'pending' && (
                              <div className="flex items-center gap-4 flex-1">
                                <div className="hidden md:block">
                                  <p className="text-[8px] uppercase tracking-widest text-brand-ink/30 font-bold mb-0.5">Subida el</p>
                                  <p className="text-[10px] font-medium text-brand-ink/60">{inv.date}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className={`w-2 h-2 rounded-full ${getPriorityInfo(inv.date).color}`} />
                                  <span className={`text-[9px] font-bold uppercase tracking-wider ${getPriorityInfo(inv.date).text}`}>
                                    {getPriorityInfo(inv.date).label}
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="text-right flex items-center gap-8">
                          <div className="space-y-1">
                            <p className="text-xs font-bold text-brand-ink tracking-tighter">{CURRENCY_FORMATTER.format(inv.amount)}</p>
                            <StatusBadge status={inv.status} />
                          </div>
                          {inv.status === 'pending' && (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                onAuditRequest(inv);
                              }}
                              className="px-5 py-2.5 bg-brand-ink text-brand-paper rounded-xl text-[9px] uppercase font-bold tracking-[0.2em] hover:bg-brand-gold transition-all active:scale-95 whitespace-nowrap shadow-md"
                            >
                              Autorizar y auditar
                            </button>
                          )}
                          {inv.status === 'paid' && (
                            <ChevronRight size={14} className="opacity-0 group-hover:opacity-40 transition-all -translate-x-2 group-hover:translate-x-0" />
                          )}
                        </div>
                      </div>
                    ))}
                    {supplierInvoices.length === 0 && (
                      <div className="py-12 text-center text-xs opacity-40 font-serif border border-dashed border-brand-sand/30 rounded-2xl bg-brand-bone/5">
                        No se encontraron facturas con los filtros seleccionados.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      <AnimatePresence>
        {viewingInvoice && (
          <InvoiceDetailModal invoice={viewingInvoice} onClose={() => setViewingInvoice(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}

