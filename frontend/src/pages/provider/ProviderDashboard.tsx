import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShieldCheck, CheckCircle2, AlertCircle, Zap, LogOut, ChevronRight, User, Search, Clock,
  FileText, BarChart3, CreditCard, X, Send, Calendar, Settings, Database, UploadCloud,
  AlertTriangle, MessageSquare, Loader2, Bell, Info, Ban, Paperclip, Eye, Trash2, HelpCircle,
} from 'lucide-react';
import type { User as FirebaseUser } from 'firebase/auth';
import { MOCK_INVOICES, type Invoice, type Supplier } from '../../types.ts';
import { api, type FactorajeItem } from '../../services/apiClient.ts';
import { ClarificationService, SupplierMessageService } from '../../services/mockServices.ts';
import { CURRENCY_FORMATTER } from '../../utils/format.ts';
import { NotificationBell } from '../../components/NotificationBell.tsx';
import { SidebarLink } from '../../components/SidebarLink.tsx';
import { ProviderPaymentsReal } from '../../features/provider/ProviderPaymentsReal.tsx';
import { ProviderFactorajeView } from '../../features/provider/ProviderFactorajeView.tsx';
import { InvoiceDetailModal } from '../corporate/views/PendingInvoicesView.tsx';

export function ProviderDashboard({ user, supplier, onLogout, onBackToRole }: { user: FirebaseUser, supplier: Supplier, onLogout: () => void, onBackToRole: () => void }) {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'invoices' | 'payments' | 'factoraje' | 'profile' | 'settings'>('dashboard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => window.innerWidth < 900);

  // Facturas del proveedor: reales del backend (Portal del Proveedor) si hay
  // sesión; si no, las de ejemplo filtradas por proveedor (degradación elegante).
  const [invoices, setInvoices] = useState<Invoice[]>(
    () => MOCK_INVOICES.filter(inv => inv.providerId === supplier.id),
  );
  useEffect(() => {
    // El proveedor entró por login único, así que su JWT es la sesión activa.
    api
      .getProviderInvoices()
      .then(real => { if (real.length) setInvoices(real); })
      .catch(err => console.warn('No se pudieron cargar facturas del proveedor:', err.message));
  }, []);

  // Solicitudes de factoraje (anticipo) reales del proveedor (Portal del Proveedor).
  const [factorajeReqs, setFactorajeReqs] = useState<FactorajeItem[]>([]);
  const loadFactoraje = React.useCallback(() => {
    return api.getProviderFactoraje().then(setFactorajeReqs).catch(() => { /* sin sesión real: lista vacía */ });
  }, []);
  useEffect(() => { void loadFactoraje(); }, [loadFactoraje]);
  const [factorajeMsg, setFactorajeMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const handleRequestFactoraje = React.useCallback(async (invoiceId: string, amount?: number) => {
    setFactorajeMsg(null);
    try {
      await api.requestProviderFactoraje(invoiceId, amount);
      await loadFactoraje();
      setFactorajeMsg({ ok: true, text: 'Solicitud de anticipo enviada. El corporativo la revisará.' });
    } catch (e) {
      setFactorajeMsg({ ok: false, text: e instanceof Error ? e.message : 'No se pudo solicitar el anticipo.' });
    }
  }, [loadFactoraje]);
  const paid = invoices.filter(i => i.status === 'paid');
  const pending = invoices.filter(i => i.status === 'pending');
  const inAudit = invoices.filter(i => i.status === 'audited' || i.status === 'approved');
  const totalOwed = [...pending, ...inAudit].reduce((s, i) => s + i.amount, 0);
  const totalPaid = paid.reduce((s, i) => s + i.amount, 0);

  // #1 Human-readable status helper
  const getHumanStatus = (inv: Invoice) => {
    if (inv.status === 'paid') return { label: 'Pagada', desc: 'Tu pago fue procesado', color: 'bg-green-50 text-green-700 border-green-200', icon: <CheckCircle2 size={12} className="text-green-500" /> };
    if (inv.status === 'rejected') return { label: 'Requiere acción', desc: 'Hay un problema con esta factura', color: 'bg-red-50 text-red-600 border-red-200', icon: <AlertCircle size={12} className="text-red-500" /> };
    if (inv.forensicStatus === 'BLOCKED') return { label: 'Detenida', desc: 'El corporativo la detuvo — revisa el detalle', color: 'bg-red-50 text-red-600 border-red-200', icon: <Ban size={12} className="text-red-500" /> };
    if (inv.forensicStatus === 'DISCREPANCY') return { label: 'Necesita aclaración', desc: 'Se encontró una diferencia — sube tu respaldo', color: 'bg-amber-50 text-amber-700 border-amber-200', icon: <AlertTriangle size={12} className="text-amber-500" /> };
    if (inv.forensicStatus === 'VALIDATED' && (inv.signatures || 0) >= 2) return { label: 'Aprobada para pago', desc: inv.scheduledPayDate ? `Pago programado: ${inv.scheduledPayDate}` : 'Esperando programación de pago', color: 'bg-blue-50 text-blue-700 border-blue-200', icon: <Calendar size={12} className="text-blue-500" /> };
    if (inv.forensicStatus === 'VALIDATED') return { label: 'En autorización', desc: `Firmas: ${inv.signatures || 0}/2 — falta aprobación gerencial`, color: 'bg-purple-50 text-purple-700 border-purple-200', icon: <ShieldCheck size={12} className="text-purple-500" /> };
    if (inv.status === 'audited') return { label: 'En revisión', desc: 'El corporativo está validando tu factura', color: 'bg-blue-50 text-blue-600 border-blue-200', icon: <Search size={12} className="text-blue-500" /> };
    return { label: 'Recibida', desc: 'Tu factura entró al sistema — será revisada pronto', color: 'bg-brand-bone text-brand-ink/60 border-brand-sand/40', icon: <Clock size={12} className="text-brand-ink/40" /> };
  };

  // #2 Notifications
  const notifications = React.useMemo(() => {
    const notifs: { id: string; icon: React.ReactNode; text: string; time: string; type: 'success' | 'warning' | 'info' | 'offer' }[] = [];
    invoices.forEach(inv => {
      if (inv.status === 'paid') notifs.push({ id: inv.id, icon: <CheckCircle2 size={14} className="text-green-500" />, text: `Factura ${inv.id} pagada — ${CURRENCY_FORMATTER.format(inv.amount)}`, time: inv.paidDate || inv.date, type: 'success' });
      if (inv.forensicStatus === 'DISCREPANCY') notifs.push({ id: inv.id + '-d', icon: <AlertTriangle size={14} className="text-amber-500" />, text: `${inv.id} necesita aclaración — revisa el detalle`, time: inv.date, type: 'warning' });
      if (inv.forensicStatus === 'BLOCKED') notifs.push({ id: inv.id + '-b', icon: <Ban size={14} className="text-red-500" />, text: `${inv.id} detenida por auditoría — contacta al corporativo`, time: inv.date, type: 'warning' });
      if (inv.forensicStatus === 'VALIDATED' && (inv.signatures || 0) >= 2) notifs.push({ id: inv.id + '-v', icon: <Calendar size={14} className="text-blue-500" />, text: `${inv.id} aprobada para pago${inv.scheduledPayDate ? ` el ${inv.scheduledPayDate}` : ''}`, time: inv.date, type: 'info' });
    });
    // Factoring offer
    if (pending.length > 0) {
      const bestCandidate = pending.sort((a, b) => b.amount - a.amount)[0];
      notifs.push({ id: 'offer-1', icon: <Zap size={14} className="text-brand-gold" />, text: `Anticipa ${CURRENCY_FORMATTER.format(bestCandidate.amount * 0.965)} de ${bestCandidate.id} hoy`, time: 'Ahora', type: 'offer' });
    }
    return notifs.slice(0, 6);
  }, [invoices]);

  // Next payment
  const nextPayment = React.useMemo(() => {
    const approved = invoices.filter(i => i.forensicStatus === 'VALIDATED' && (i.signatures || 0) >= 2 && i.status !== 'paid');
    if (approved.length === 0) return null;
    const total = approved.reduce((s, i) => s + i.amount, 0);
    const dates = approved.map(i => i.scheduledPayDate || '2024-05-15').sort();
    return { amount: total, date: dates[0], count: approved.length };
  }, [invoices]);

  // #10 Inline factoring calculator
  const calcAnticipo = (amount: number, rate: number = 3.5) => {
    const cost = amount * (rate / 100);
    return { net: amount - cost, cost, rate };
  };

  // #11 Profile state — datos bancarios reales del proveedor (persisten en backend)
  const [profileClabe, setProfileClabe] = useState(supplier.clabe ?? '');
  const [profileBank, setProfileBank] = useState(supplier.bankName ?? '');
  const [profileEditing, setProfileEditing] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ ok: boolean; text: string } | null>(null);
  // Si las facturas/perfil reales llegan después, sembrar la CLABE/banco.
  useEffect(() => {
    if (supplier.clabe) setProfileClabe(supplier.clabe);
    if (supplier.bankName) setProfileBank(supplier.bankName);
  }, [supplier.clabe, supplier.bankName]);

  const handleSaveBank = React.useCallback(async () => {
    setProfileMsg(null);
    if (profileClabe && profileClabe.length !== 18) {
      setProfileMsg({ ok: false, text: 'La CLABE debe tener 18 dígitos.' });
      return;
    }
    setProfileSaving(true);
    try {
      await api.updateProviderProfile({ clabeInterbancaria: profileClabe || undefined, bankName: profileBank || undefined });
      setProfileEditing(false);
      setProfileMsg({ ok: true, text: 'Datos bancarios actualizados.' });
    } catch (e) {
      setProfileMsg({ ok: false, text: e instanceof Error ? e.message : 'No se pudieron guardar los datos.' });
    } finally {
      setProfileSaving(false);
    }
  }, [profileClabe, profileBank]);

  // Capital (patrimonio) state — editable from settings
  const CATEGORY_MULTIPLIER_PROV: Record<string, number> = {
    'Logística': 1.4, 'Suministros': 1.2, 'Servicios TI': 1.6, 'Mantenimiento': 1.0,
    'Marketing': 0.9, 'Consultoría': 1.3, 'Seguridad': 1.1, 'RH': 0.8, 'Legal': 1.5, 'Insumos': 1.0
  };
  const defaultCapital = Math.round(supplier.seniorityYears * 180000 * (CATEGORY_MULTIPLIER_PROV[supplier.category] ?? 1));
  const [capitalAmount, setCapitalAmount] = useState(defaultCapital);
  const [capitalEditing, setCapitalEditing] = useState(false);
  const [capitalInput, setCapitalInput] = useState(String(defaultCapital));

  // Documentos KYC reales del proveedor (Portal del Proveedor / GCS).
  const KYC_TYPES = [
    { type: 'CONSTANCIA_SF', name: 'Constancia de Situación Fiscal' },
    { type: 'OPINION_32D', name: 'Opinión de Cumplimiento SAT' },
    { type: 'COMPROBANTE_DOMICILIO', name: 'Comprobante de Domicilio' },
    { type: 'ACTA_CONSTITUTIVA', name: 'Acta Constitutiva' },
    { type: 'IDENTIFICACION', name: 'Identificación del Representante' },
    { type: 'PODER_NOTARIAL', name: 'Poder Notarial' },
  ] as const;
  const [kycDocs, setKycDocs] = useState<import('../../services/apiClient.ts').ProviderDocument[]>([]);
  const loadKyc = React.useCallback(() => {
    api.getProviderDocuments().then(setKycDocs).catch(() => { /* sin sesión: lista vacía */ });
  }, []);
  useEffect(() => { void loadKyc(); }, [loadKyc]);
  const [confirmDeleteDocId, setConfirmDeleteDocId] = useState<string | null>(null);
  const [kycBusy, setKycBusy] = useState<string | null>(null);
  const [kycMsg, setKycMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const kycFileRef = useRef<HTMLInputElement>(null);
  const kycPendingType = useRef<string | null>(null);
  const pickKycFile = (type: string) => { kycPendingType.current = type; kycFileRef.current?.click(); };
  const onKycFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; const type = kycPendingType.current;
    e.target.value = '';
    if (!file || !type) return;
    setKycBusy(type); setKycMsg(null);
    try {
      await api.uploadProviderDocument(type, file);
      await loadKyc();
      setKycMsg({ ok: true, text: 'Documento subido correctamente.' });
    } catch (err) {
      setKycMsg({ ok: false, text: err instanceof Error ? err.message : 'No se pudo subir el documento.' });
    } finally {
      setKycBusy(null);
    }
  };
  const deleteKyc = async (docId: string) => {
    setConfirmDeleteDocId(null);
    await api.deleteProviderDocument(docId).catch(() => {});
    loadKyc();
  };

  // #8 Dispute state
  const [disputeInvoiceId, setDisputeInvoiceId] = useState<string | null>(null);
  const [disputeMessage, setDisputeMessage] = useState('');
  const [disputeSent, setDisputeSent] = useState(false);
  const [disputeFileName, setDisputeFileName] = useState<string | null>(null);
  const [disputeFileType, setDisputeFileType] = useState<string | null>(null);

  // #12 Support chat
  const [showSupport, setShowSupport] = useState(false);
  const [supportMsg, setSupportMsg] = useState('');
  const [supportSent, setSupportSent] = useState(false);

  return (
    <div className="h-screen w-full bg-brand-bone flex overflow-hidden">
      <NotificationBell />
      {/* Sidebar */}
      <aside className={`${isSidebarCollapsed ? 'w-0' : 'w-56'} bg-brand-ink text-[var(--brand-ink-text)] flex flex-col sticky top-0 h-screen transition-all duration-300 z-50 relative`}>
        <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className="absolute -right-4 top-12 bg-brand-gold text-[var(--brand-gold-text)] p-1.5 rounded-full shadow-lg hover:scale-110 transition-all cursor-pointer z-[70] border-2 border-brand-ink">
          <ChevronRight size={14} className={`transition-transform duration-300 ${isSidebarCollapsed ? '' : 'rotate-180'}`} />
        </button>

        <div className={`flex flex-col h-full overflow-y-auto overflow-x-hidden px-4 pt-6 transition-all duration-300 ${isSidebarCollapsed ? 'opacity-0 invisible pointer-events-none' : 'opacity-100 visible'}`}>
          <div className="mb-10 overflow-hidden whitespace-nowrap flex-shrink-0">
            <button onClick={onBackToRole} className="text-left cursor-pointer group flex items-center gap-3">
               <div className="w-8 h-8 flex-shrink-0 bg-brand-bone rounded flex items-center justify-center shadow-inner">
                  <span className="font-serif font-bold text-brand-ink leading-none text-sm">P</span>
               </div>
              {!isSidebarCollapsed && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <span className="label-caps mb-0.5 block !opacity-40 !text-[7px]">Portal Proveedor</span>
                  <h1 className="text-lg font-serif tracking-widest leading-none truncate w-32">{supplier.name}</h1>
                </motion.div>
              )}
            </button>
          </div>

          <nav className="flex-1 space-y-1.5">
            <SidebarLink icon={<BarChart3 size={18} />} label="Inicio" active={activeTab === 'dashboard'} collapsed={isSidebarCollapsed} onClick={() => setActiveTab('dashboard')} />
            <SidebarLink icon={<FileText size={18} />} label="Facturas" active={activeTab === 'invoices'} collapsed={isSidebarCollapsed} onClick={() => setActiveTab('invoices')} />
            <SidebarLink icon={<CreditCard size={18} />} label="Pagos" active={activeTab === 'payments'} collapsed={isSidebarCollapsed} onClick={() => setActiveTab('payments')} />
            <SidebarLink icon={<Zap size={18} />} label="Anticipo" active={activeTab === 'factoraje'} collapsed={isSidebarCollapsed} onClick={() => setActiveTab('factoraje')} />
            <SidebarLink icon={<User size={18} />} label="Mi Perfil" active={activeTab === 'profile'} collapsed={isSidebarCollapsed} onClick={() => setActiveTab('profile')} />
            <SidebarLink icon={<Settings size={18} />} label="Configuración" active={activeTab === 'settings'} collapsed={isSidebarCollapsed} onClick={() => setActiveTab('settings')} />
          </nav>

          <div className="mt-auto py-6 border-t border-brand-paper/10 space-y-3">
            <button onClick={() => setShowSupport(true)} className={`opacity-40 hover:opacity-100 transition-opacity flex items-center ${isSidebarCollapsed ? 'justify-center' : 'gap-3'} text-[9px] uppercase font-bold tracking-widest w-full`}>
              <HelpCircle size={16} /> {!isSidebarCollapsed && "Ayuda"}
            </button>
            <button onClick={onLogout} className={`opacity-40 hover:opacity-100 transition-opacity flex items-center ${isSidebarCollapsed ? 'justify-center' : 'gap-3'} text-[9px] uppercase font-bold tracking-widest w-full`}>
              <LogOut size={16} /> {!isSidebarCollapsed && "Salir"}
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col p-8 overflow-y-auto bg-brand-bone min-h-0">
        <AnimatePresence mode="wait">

          {/* ═══════════ DASHBOARD / INICIO ═══════════ */}
          {activeTab === 'dashboard' && (
            <motion.div key="dash" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6 pb-12">
              {/* Greeting */}
              <div>
                <p className="text-[10px] uppercase tracking-[.2em] text-brand-ink/30 font-bold">Portal Proveedor</p>
                <h2 className="text-3xl font-serif text-brand-ink mt-1">Buenos días, {supplier.name.split(' ')[0]}</h2>
              </div>

              {/* #2 Hero: Total Owed */}
              <div className="grid grid-cols-12 gap-5">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="col-span-7 bg-gradient-to-br from-brand-ink to-brand-ink/90 rounded-3xl p-8 text-brand-paper relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-40 h-40 bg-brand-gold/5 rounded-full -translate-y-20 translate-x-20 blur-3xl" />
                  <div className="relative z-10">
                    <p className="text-[9px] uppercase tracking-[.2em] text-brand-gold font-bold mb-1">Total por cobrar</p>
                    <p className="text-5xl font-serif text-brand-paper tracking-tight">{CURRENCY_FORMATTER.format(totalOwed)}</p>
                    <p className="text-[10px] text-brand-paper/40 mt-2">{pending.length + inAudit.length} facturas en proceso · {paid.length} pagadas ({CURRENCY_FORMATTER.format(totalPaid)})</p>
                    <div className="flex gap-3 mt-5">
                      <div className="px-4 py-2 rounded-xl bg-brand-paper/10 border border-brand-paper/10">
                        <p className="text-[8px] uppercase tracking-wider text-brand-paper/40">Pendientes</p>
                        <p className="font-serif text-lg text-brand-paper">{pending.length}</p>
                      </div>
                      <div className="px-4 py-2 rounded-xl bg-brand-paper/10 border border-brand-paper/10">
                        <p className="text-[8px] uppercase tracking-wider text-brand-paper/40">En revisión</p>
                        <p className="font-serif text-lg text-brand-paper">{inAudit.length}</p>
                      </div>
                      <div className="px-4 py-2 rounded-xl bg-green-500/10 border border-green-500/20">
                        <p className="text-[8px] uppercase tracking-wider text-green-400">Pagadas</p>
                        <p className="font-serif text-lg text-green-400">{paid.length}</p>
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* Next payment */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="col-span-5 bg-white/70 backdrop-blur-sm rounded-3xl border border-brand-sand/20 p-7 flex flex-col justify-between">
                  {nextPayment ? (
                    <>
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <Calendar size={16} className="text-blue-500" />
                          <p className="text-[9px] uppercase tracking-[.2em] font-bold text-brand-ink/40">Próximo pago estimado</p>
                        </div>
                        <p className="font-serif text-3xl text-brand-ink">{CURRENCY_FORMATTER.format(nextPayment.amount)}</p>
                        <p className="text-sm text-brand-ink/40 mt-1">{nextPayment.count} factura{nextPayment.count > 1 ? 's' : ''} aprobada{nextPayment.count > 1 ? 's' : ''}</p>
                      </div>
                      <div className="flex items-center gap-2 mt-4 px-3 py-2 bg-blue-50 rounded-xl border border-blue-100">
                        <Clock size={12} className="text-blue-500" />
                        <span className="text-[10px] font-bold text-blue-700">Estimado: {nextPayment.date}</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                      <Clock size={24} className="text-brand-ink/15 mb-3" />
                      <p className="text-[10px] text-brand-ink/30 font-bold uppercase tracking-wider">Sin pagos programados</p>
                      <p className="text-[9px] text-brand-ink/20 mt-1">Las facturas aprobadas aparecerán aquí</p>
                    </div>
                  )}
                </motion.div>
              </div>

              {/* #2 Notifications */}
              <div className="bg-white/60 backdrop-blur-sm rounded-2xl border border-brand-sand/20 overflow-hidden">
                <div className="px-5 py-3 border-b border-brand-sand/10 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bell size={14} className="text-brand-gold" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-brand-ink/50">Actividad reciente</span>
                  </div>
                  <span className="text-[8px] text-brand-ink/20 uppercase tracking-wider">{notifications.length} avisos</span>
                </div>
                <div className="divide-y divide-brand-sand/10">
                  {notifications.map((n, i) => (
                    <motion.div key={n.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                      className={`px-5 py-3 flex items-center gap-3 hover:bg-brand-bone/30 transition-colors cursor-pointer ${n.type === 'offer' ? 'bg-brand-gold/5' : ''}`}>
                      <div className="flex-shrink-0">{n.icon}</div>
                      <p className="text-[10px] text-brand-ink/70 flex-1">{n.text}</p>
                      <span className="text-[8px] text-brand-ink/25 flex-shrink-0">{n.time === 'Ahora' ? 'Ahora' : n.time}</span>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Quick factoring CTA */}
              {pending.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                  className="bg-gradient-to-r from-brand-gold/10 to-brand-gold/5 rounded-2xl p-5 border border-brand-gold/20 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-brand-gold flex items-center justify-center flex-shrink-0">
                      <Zap size={18} className="text-white" />
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-brand-ink">¿Necesitas cobrar antes?</p>
                      <p className="text-[9px] text-brand-ink/50">Anticipa hasta {CURRENCY_FORMATTER.format(totalOwed * 0.965)} de tus facturas pendientes hoy</p>
                    </div>
                  </div>
                  <button onClick={() => setActiveTab('factoraje')} className="px-5 py-2.5 bg-brand-gold text-white rounded-xl text-[9px] font-bold uppercase tracking-wider hover:bg-brand-gold/80 transition-all">
                    Solicitar Anticipo
                  </button>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* ═══════════ FACTURAS ═══════════ */}
          {activeTab === 'invoices' && (
            <motion.div key="inv" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-5 pb-12">
              <ProviderInvoicesViewNew invoices={invoices} getHumanStatus={getHumanStatus} calcAnticipo={calcAnticipo} onDispute={(id) => setDisputeInvoiceId(id)} onFactoraje={() => setActiveTab('factoraje')} />
            </motion.div>
          )}

          {/* ═══════════ PAYMENTS HISTORY ═══════════ */}
          {activeTab === 'payments' && (
            <motion.div key="pay" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-5 pb-12">
              <div>
                <p className="text-[10px] uppercase tracking-[.2em] text-brand-ink/30 font-bold">Historial</p>
                <h2 className="text-3xl font-serif text-brand-ink mt-1">Pagos Recibidos</h2>
                <p className="text-sm text-brand-ink/40 mt-1">Todas las transferencias que has recibido del corporativo.</p>
              </div>

              <ProviderPaymentsReal />

              <div className="grid grid-cols-3 gap-4">
                <div className="bg-green-50/60 rounded-2xl p-5 border border-green-200">
                  <p className="text-[8px] uppercase tracking-[.2em] font-bold text-green-700/50">Total recibido</p>
                  <p className="font-serif text-2xl text-green-700 mt-1">{CURRENCY_FORMATTER.format(totalPaid)}</p>
                  <p className="text-[9px] text-green-600/40">{paid.length} pagos</p>
                </div>
                <div className="bg-white/60 rounded-2xl p-5 border border-brand-sand/20">
                  <p className="text-[8px] uppercase tracking-[.2em] font-bold text-brand-ink/30">Pago promedio</p>
                  <p className="font-serif text-2xl text-brand-ink mt-1">{CURRENCY_FORMATTER.format(paid.length > 0 ? totalPaid / paid.length : 0)}</p>
                  <p className="text-[9px] text-brand-ink/25">por factura</p>
                </div>
                <div className="bg-white/60 rounded-2xl p-5 border border-brand-sand/20">
                  <p className="text-[8px] uppercase tracking-[.2em] font-bold text-brand-ink/30">Ruta más usada</p>
                  <p className="font-serif text-2xl text-brand-ink mt-1">{paid.filter(i => i.paymentRoute === 'cash').length >= paid.filter(i => i.paymentRoute === 'fintech').length ? 'SPEI' : 'Factoraje'}</p>
                  <p className="text-[9px] text-brand-ink/25">transferencia directa</p>
                </div>
              </div>

              <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-brand-sand/20 overflow-hidden">
                <div className="px-5 py-3 border-b border-brand-sand/10 text-[8px] font-bold uppercase tracking-[.2em] text-brand-ink/30 grid grid-cols-6 gap-4">
                  <span>Factura</span><span>Descripción</span><span>Monto</span><span>Fecha pago</span><span>Ruta</span><span>Referencia</span>
                </div>
                {paid.length === 0 ? (
                  <div className="px-5 py-12 text-center text-brand-ink/25 text-sm">Aún no tienes pagos recibidos.</div>
                ) : paid.map((inv, i) => (
                  <motion.div key={inv.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                    className="px-5 py-3 grid grid-cols-6 gap-4 items-center border-b border-brand-sand/5 hover:bg-green-50/20 transition-colors">
                    <span className="text-[10px] font-bold text-brand-ink">{inv.id}</span>
                    <span className="text-[9px] text-brand-ink/50 truncate">{inv.description}</span>
                    <span className="font-serif text-sm text-green-700 font-bold">{CURRENCY_FORMATTER.format(inv.amount)}</span>
                    <span className="text-[9px] text-brand-ink/40">{inv.paidDate || inv.date}</span>
                    <span className={`text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full w-fit ${inv.paymentRoute === 'fintech' ? 'bg-brand-gold/10 text-brand-gold' : 'bg-teal-50 text-teal-600'}`}>
                      {inv.paymentRoute === 'fintech' ? 'Factoraje' : 'SPEI'}
                    </span>
                    <span className="text-[8px] font-mono text-brand-ink/30">REF-{inv.poNumber}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* ═══════════ FACTORAJE / ANTICIPO ═══════════ */}
          {activeTab === 'factoraje' && (
            <motion.div key="fac" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex-1 flex flex-col min-h-0 overflow-y-auto scrollbar-hide pb-12">
              <ProviderFactorajeView supplier={supplier} invoices={invoices} capitalAmount={capitalAmount} requests={factorajeReqs} onRequest={handleRequestFactoraje} message={factorajeMsg} />
            </motion.div>
          )}

          {/* ═══════════ MI PERFIL ═══════════ */}
          {activeTab === 'profile' && (
            <motion.div key="prof" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6 pb-12 max-w-3xl">
              <div>
                <p className="text-[10px] uppercase tracking-[.2em] text-brand-ink/30 font-bold">Configuración</p>
                <h2 className="text-3xl font-serif text-brand-ink mt-1">Mi Perfil</h2>
                <p className="text-sm text-brand-ink/40 mt-1">Tus datos fiscales y bancarios. Mantenlos actualizados para evitar retrasos en pagos.</p>
              </div>

              {/* Company Info */}
              <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-brand-sand/20 p-6 space-y-4">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-brand-ink/40">Datos Fiscales</h3>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: 'Razón Social', value: supplier.legalName },
                    { label: 'RFC', value: supplier.rfc },
                    { label: 'Giro', value: supplier.activity },
                    { label: 'Categoría', value: supplier.category },
                    { label: 'Antigüedad', value: `${supplier.seniorityYears} años` },
                    { label: 'Contacto', value: supplier.contact },
                  ].map(f => (
                    <div key={f.label} className="space-y-1">
                      <p className="text-[8px] uppercase tracking-[.2em] text-brand-ink/30 font-bold">{f.label}</p>
                      <p className="text-sm text-brand-ink font-medium">{f.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bank Info */}
              <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-brand-sand/20 p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-[10px] font-bold uppercase tracking-wider text-brand-ink/40">Datos Bancarios</h3>
                  <button onClick={() => setProfileEditing(!profileEditing)} className="text-[9px] font-bold text-brand-gold uppercase tracking-wider hover:underline">
                    {profileEditing ? 'Cancelar' : 'Editar'}
                  </button>
                </div>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <p className="text-[8px] uppercase tracking-[.2em] text-brand-ink/30 font-bold">CLABE Interbancaria</p>
                    {profileEditing ? (
                      <input value={profileClabe} onChange={e => setProfileClabe(e.target.value.replace(/\D/g, '').slice(0, 18))}
                        placeholder="18 dígitos"
                        className="w-full px-4 py-2.5 bg-white border border-brand-sand rounded-xl text-sm font-mono outline-none focus:border-brand-gold" />
                    ) : (
                      <p className="text-sm font-mono text-brand-ink">{profileClabe || <span className="text-brand-ink/30 not-italic">Sin CLABE registrada</span>}</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <p className="text-[8px] uppercase tracking-[.2em] text-brand-ink/30 font-bold">Banco</p>
                    {profileEditing ? (
                      <input value={profileBank} onChange={e => setProfileBank(e.target.value.slice(0, 80))}
                        placeholder="Ej. BBVA Bancomer"
                        className="w-full px-4 py-2.5 bg-white border border-brand-sand rounded-xl text-sm outline-none focus:border-brand-gold" />
                    ) : (
                      <p className="text-sm text-brand-ink">{profileBank || <span className="text-brand-ink/30">Sin banco registrado</span>}</p>
                    )}
                  </div>
                </div>
                {profileMsg && (
                  <p className={`text-[11px] rounded-lg px-3 py-2 ${profileMsg.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>{profileMsg.text}</p>
                )}
                {profileEditing && (
                  <button onClick={handleSaveBank} disabled={profileSaving}
                    className="px-5 py-2 bg-brand-gold text-white rounded-xl text-[9px] font-bold uppercase tracking-wider disabled:opacity-40 inline-flex items-center gap-1.5">
                    {profileSaving ? <><Loader2 size={12} className="animate-spin" /> Guardando</> : 'Guardar Cambios'}
                  </button>
                )}
              </div>

              {/* Verificación SAT del proveedor (69-B + RFC) */}
              {supplier.sat69b && (
                <div className={`rounded-2xl border p-6 space-y-4 ${supplier.sat69b.listed ? 'bg-red-50 border-red-200' : 'bg-white/70 backdrop-blur-sm border-brand-sand/20'}`}>
                  <div className="flex items-center justify-between">
                    <h3 className="text-[10px] font-bold uppercase tracking-wider text-brand-ink/40">Verificación ante el SAT</h3>
                    <span className={`text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${supplier.sat69b.listed ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                      {supplier.sat69b.listed ? <><AlertTriangle size={9} /> Atención</> : <><ShieldCheck size={9} /> Verificado</>}
                    </span>
                  </div>
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white flex-shrink-0 ${supplier.sat69b.rfcValid ? 'bg-green-500' : 'bg-amber-400'}`}>
                        {supplier.sat69b.rfcValid ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
                      </div>
                      <span className="text-[11px] text-brand-ink/70"><b>RFC:</b> {supplier.rfc} — {supplier.sat69b.rfcValid ? 'formato válido y verificado.' : 'formato no válido.'}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white flex-shrink-0 ${supplier.sat69b.listed ? 'bg-red-500' : 'bg-green-500'}`}>
                        {supplier.sat69b.listed ? <Ban size={12} /> : <CheckCircle2 size={12} />}
                      </div>
                      <span className="text-[11px] text-brand-ink/70">
                        <b>Lista negra 69-B (EFOS):</b> {supplier.sat69b.listed
                          ? `Tu RFC aparece en la lista con estatus ${supplier.sat69b.status}. Regulariza tu situación ante el SAT para no afectar la deducibilidad de tus facturas.`
                          : 'Aprobado. Tu RFC NO aparece en la lista negra 69-B del SAT.'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Documents (KYC reales — Portal del Proveedor) */}
              <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-brand-sand/20 p-6 space-y-4">
                <input ref={kycFileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={onKycFilePicked} />
                <div className="flex items-center justify-between">
                  <h3 className="text-[10px] font-bold uppercase tracking-wider text-brand-ink/40">Documentos KYC</h3>
                  <span className="text-[8px] text-brand-ink/30">{kycDocs.length}/{KYC_TYPES.length} documentos cargados</span>
                </div>
                {kycMsg && (
                  <p className={`text-[11px] rounded-lg px-3 py-2 ${kycMsg.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>{kycMsg.text}</p>
                )}
                <div className="space-y-2">
                  {KYC_TYPES.map(({ type, name }) => {
                    const doc = kycDocs.find(d => d.type === type);
                    const uploaded = !!doc;
                    const statusLabel = doc?.status === 'VALIDATED' ? 'Validado' : doc?.status === 'EXPIRED' ? 'Vencido' : uploaded ? 'En revisión' : 'Pendiente';
                    const statusCls = doc?.status === 'VALIDATED' ? 'bg-green-50 text-green-600' : doc?.status === 'EXPIRED' ? 'bg-red-50 text-red-600' : uploaded ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600';
                    return (
                      <div key={type} className="flex items-center justify-between py-3 px-4 rounded-xl bg-brand-bone/30 hover:bg-brand-bone/50 transition-colors">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <FileText size={14} className={uploaded ? 'text-green-500' : 'text-brand-ink/20'} />
                          <div className="min-w-0">
                            <span className="text-[10px] text-brand-ink/70 block">{name}</span>
                            {doc?.fileName && <span className="text-[8px] text-brand-ink/30 font-mono">{doc.fileName}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={`text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${statusCls}`}>{statusLabel}</span>
                          {uploaded && doc ? (
                            confirmDeleteDocId === doc.id ? (
                              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-1.5">
                                <span className="text-[8px] text-red-600 font-medium">¿Eliminar?</span>
                                <button onClick={() => deleteKyc(doc.id)} className="text-[8px] font-bold text-white bg-red-500 hover:bg-red-600 rounded-lg px-2.5 py-1 uppercase tracking-wider cursor-pointer transition-colors">Aceptar</button>
                                <button onClick={() => setConfirmDeleteDocId(null)} className="text-[8px] font-bold text-red-400 hover:text-red-600 uppercase tracking-wider cursor-pointer">Cancelar</button>
                              </div>
                            ) : (
                              <button onClick={() => setConfirmDeleteDocId(doc.id)} className="text-[8px] font-bold text-red-400 uppercase tracking-wider hover:underline flex items-center gap-1 cursor-pointer">
                                <Trash2 size={10} /> Eliminar
                              </button>
                            )
                          ) : (
                            <button onClick={() => pickKycFile(type)} disabled={kycBusy === type}
                              className="text-[8px] font-bold text-brand-gold uppercase tracking-wider hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-40">
                              {kycBusy === type ? <><Loader2 size={10} className="animate-spin" /> Subiendo</> : <><UploadCloud size={10} /> Subir</>}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="text-[9px] text-brand-ink/30">PDF, JPG o PNG · máx 10 MB por archivo.</p>
              </div>
            </motion.div>
          )}

          {activeTab === 'settings' && (
            <motion.div key="settings" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6 pb-12 max-w-3xl">
              <div>
                <p className="text-[10px] uppercase tracking-[.2em] text-brand-ink/30 font-bold">Ajustes</p>
                <h2 className="text-3xl font-serif text-brand-ink mt-1">Configuración</h2>
                <p className="text-sm text-brand-ink/40 mt-1">Administra tu capital y parámetros financieros.</p>
              </div>

              <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-brand-sand/20 p-6 space-y-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-[10px] font-bold uppercase tracking-wider text-brand-ink/40">Capital</h3>
                  {!capitalEditing && (
                    <button onClick={() => { setCapitalEditing(true); setCapitalInput(String(capitalAmount)); }}
                      className="text-[9px] font-bold text-brand-gold uppercase tracking-wider hover:underline cursor-pointer">
                      Editar
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-brand-ink/40">El valor de tu capital se usa para calcular tu salud de liquidez y determinar tu elegibilidad para factoraje.</p>
                {capitalEditing ? (
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <p className="text-[8px] uppercase tracking-[.2em] text-brand-ink/30 font-bold">Monto de Capital (MXN)</p>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-brand-ink/40 font-bold">$</span>
                        <input value={capitalInput} onChange={e => setCapitalInput(e.target.value.replace(/[^\d]/g, ''))}
                          className="flex-1 px-4 py-2.5 bg-white border border-brand-sand rounded-xl text-sm font-mono outline-none focus:border-brand-gold"
                          placeholder="Ej: 2500000" />
                      </div>
                      {capitalInput && (
                        <p className="text-[9px] text-brand-ink/40 mt-1">
                          {CURRENCY_FORMATTER.format(Number(capitalInput))}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => {
                        const val = Number(capitalInput);
                        if (val > 0) { setCapitalAmount(val); setCapitalEditing(false); }
                      }} className="px-5 py-2 bg-brand-gold text-white rounded-xl text-[9px] font-bold uppercase tracking-wider cursor-pointer hover:bg-brand-gold/90 transition-colors">
                        Guardar
                      </button>
                      <button onClick={() => setCapitalEditing(false)}
                        className="px-5 py-2 bg-brand-sand/30 text-brand-ink/50 rounded-xl text-[9px] font-bold uppercase tracking-wider cursor-pointer hover:bg-brand-sand/50 transition-colors">
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-end gap-6">
                    <div className="space-y-1">
                      <p className="text-[8px] uppercase tracking-[.2em] text-brand-ink/30 font-bold">Capital Actual</p>
                      <p className="text-2xl font-serif text-brand-ink">{CURRENCY_FORMATTER.format(capitalAmount)}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[8px] uppercase tracking-[.2em] text-brand-ink/30 font-bold">Fuente</p>
                      <p className="text-sm text-brand-ink/60">Declarado por proveedor</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-brand-bone/30 rounded-2xl p-5 flex items-start gap-3">
                <Info size={16} className="text-brand-ink/30 flex-shrink-0 mt-0.5" />
                <p className="text-[10px] text-brand-ink/40 leading-relaxed">
                  Tu capital es un dato declarativo que impacta tu análisis de liquidez y la elegibilidad para productos de factoraje. Mantenlo actualizado para obtener mejores condiciones de financiamiento.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* #8 Dispute Modal */}
      <AnimatePresence>
        {disputeInvoiceId && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-brand-ink/40 backdrop-blur-sm flex items-center justify-center p-6"
            onClick={() => { setDisputeInvoiceId(null); setDisputeSent(false); setDisputeMessage(''); setDisputeFileName(null); setDisputeFileType(null); }}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              onClick={e => e.stopPropagation()} className="bg-white rounded-3xl p-8 w-full max-w-md space-y-5 shadow-2xl">
              {disputeSent ? (
                <div className="text-center space-y-3 py-6">
                  <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mx-auto"><CheckCircle2 size={28} className="text-green-500" /></div>
                  <h3 className="text-xl font-serif text-brand-ink">Aclaración enviada</h3>
                  <p className="text-sm text-brand-ink/50">El corporativo revisará tu respuesta y actualizará el estado de la factura.</p>
                  {disputeFileName && <p className="text-[9px] text-brand-ink/30 flex items-center gap-1 justify-center"><Paperclip size={10} /> {disputeFileName}</p>}
                  <button onClick={() => { setDisputeInvoiceId(null); setDisputeSent(false); setDisputeMessage(''); setDisputeFileName(null); setDisputeFileType(null); }}
                    className="px-6 py-2.5 bg-brand-ink text-brand-paper rounded-xl text-[10px] font-bold uppercase tracking-wider">Cerrar</button>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-serif text-brand-ink">Aclarar Factura {disputeInvoiceId}</h3>
                    <button onClick={() => { setDisputeInvoiceId(null); setDisputeFileName(null); setDisputeFileType(null); }}><X size={18} className="text-brand-ink/30" /></button>
                  </div>
                  {(() => {
                    const inv = invoices.find(i => i.id === disputeInvoiceId);
                    return inv?.auditAnalysis ? (
                      <div className="px-4 py-3 bg-amber-50 rounded-xl border border-amber-200">
                        <p className="text-[9px] font-bold text-amber-700 uppercase tracking-wider mb-1">Motivo del hallazgo</p>
                        <p className="text-[10px] text-amber-800">{inv.auditAnalysis}</p>
                        {inv.forensicSolution && <p className="text-[9px] text-amber-600 mt-1 italic">{inv.forensicSolution}</p>}
                      </div>
                    ) : null;
                  })()}
                  <p className="text-[10px] text-brand-ink/50">Explica la situación y adjunta el documento de respaldo. El equipo de auditoría revisará tu respuesta.</p>
                  <textarea value={disputeMessage} onChange={e => setDisputeMessage(e.target.value)} rows={4} placeholder="Escribe tu aclaración aquí..."
                    className="w-full px-4 py-3 bg-brand-bone border border-brand-sand rounded-xl text-sm outline-none focus:border-brand-gold resize-none" />
                  <label className={`flex items-center gap-3 px-4 py-3 rounded-xl border border-dashed cursor-pointer transition-all ${disputeFileName ? 'bg-green-50 border-green-300' : 'bg-brand-bone/50 border-brand-sand hover:border-brand-gold'}`}>
                    <input type="file" accept=".xml,.pdf,.png,.jpg,.xlsx" className="hidden" onChange={e => {
                      const f = e.target.files?.[0];
                      if (f) { setDisputeFileName(f.name); setDisputeFileType(f.type); }
                    }} />
                    {disputeFileName ? (
                      <>
                        <CheckCircle2 size={18} className="text-green-500" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-bold text-green-700 truncate">{disputeFileName}</p>
                          <p className="text-[8px] text-green-500">Archivo adjunto listo</p>
                        </div>
                        <button onClick={e => { e.preventDefault(); setDisputeFileName(null); setDisputeFileType(null); }}><X size={14} className="text-green-400" /></button>
                      </>
                    ) : (
                      <>
                        <UploadCloud size={18} className="text-brand-ink/30" />
                        <div>
                          <p className="text-[10px] font-bold text-brand-ink/50">Adjuntar archivo (XML, PDF, imagen)</p>
                          <p className="text-[8px] text-brand-ink/25">Haz clic para seleccionar</p>
                        </div>
                      </>
                    )}
                  </label>
                  <button onClick={() => {
                    ClarificationService.submit(disputeInvoiceId, supplier.id, supplier.name, disputeMessage.trim(), disputeFileName, disputeFileType);
                    setDisputeSent(true);
                  }} disabled={!disputeMessage.trim()}
                    className="w-full py-3 bg-brand-gold text-white rounded-xl text-[10px] font-bold uppercase tracking-wider hover:bg-brand-gold/80 transition-all disabled:opacity-30 flex items-center justify-center gap-2">
                    <Send size={12} /> Enviar Aclaración
                  </button>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* #12 Support Chat — now uses SupplierMessageService */}
      <AnimatePresence>
        {showSupport && (
          <motion.div initial={{ opacity: 0, y: 30, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 30, scale: 0.95 }}
            className="fixed bottom-24 right-8 w-[380px] bg-white rounded-3xl border border-brand-sand/30 shadow-2xl z-[150] overflow-hidden flex flex-col" style={{ maxHeight: '70vh' }}>
            <div className="px-5 py-4 bg-brand-ink text-brand-paper flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <MessageSquare size={16} className="text-brand-gold" />
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider block">Mensajes al Corporativo</span>
                  <span className="text-[8px] text-brand-paper/40">Conversación con tu cliente</span>
                </div>
              </div>
              <button onClick={() => { setShowSupport(false); setSupportMsg(''); }}><X size={14} className="text-brand-paper/40" /></button>
            </div>

            {/* Message history */}
            {(() => {
              const chatMsgs = SupplierMessageService.getBySupplier(supplier.id);
              return (
                <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ minHeight: 100, maxHeight: '40vh' }}>
                  {chatMsgs.length === 0 && (
                    <div className="text-center py-6">
                      <MessageSquare size={24} className="text-brand-ink/10 mx-auto mb-2" />
                      <p className="text-[10px] text-brand-ink/30">No hay mensajes todavía. Escribe al corporativo.</p>
                    </div>
                  )}
                  {chatMsgs.map(msg => (
                    <div key={msg.id} className={`flex ${msg.from === 'supplier' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 ${
                        msg.from === 'supplier'
                          ? 'bg-brand-ink text-brand-paper rounded-br-md'
                          : 'bg-brand-bone text-brand-ink border border-brand-sand/30 rounded-bl-md'
                      }`}>
                        <p className="text-[10px] leading-relaxed">{msg.text}</p>
                        <p className={`text-[7px] mt-1.5 ${msg.from === 'supplier' ? 'text-brand-paper/40' : 'text-brand-ink/25'}`}>
                          {msg.from === 'corporate' ? '🏢 Corporativo · ' : ''}{new Date(msg.date).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })} {new Date(msg.date).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* Compose area */}
            <div className="p-4 border-t border-brand-sand/20 flex-shrink-0 space-y-3">
              {supportSent ? (
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-2">
                  <CheckCircle2 size={20} className="text-green-500 mx-auto mb-1" />
                  <p className="text-[10px] font-bold text-brand-ink">Mensaje enviado</p>
                  <button onClick={() => setSupportSent(false)} className="text-[8px] text-brand-gold underline mt-1">Enviar otro</button>
                </motion.div>
              ) : (
                <>
                  {SupplierMessageService.getBySupplier(supplier.id).length === 0 && (
                    <div className="flex gap-1.5 flex-wrap">
                      {['¿Cuándo me pagan?', '¿Cómo subo factura?', 'Aclaración de monto'].map(q => (
                        <button key={q} onClick={() => setSupportMsg(q)}
                          className="px-2.5 py-1 bg-brand-bone rounded-full text-[8px] text-brand-ink/40 border border-brand-sand/20 hover:border-brand-gold/30 transition-all">{q}</button>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <textarea value={supportMsg} onChange={e => setSupportMsg(e.target.value)} rows={2} placeholder="Escribe tu mensaje..."
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && supportMsg.trim()) { e.preventDefault(); SupplierMessageService.send(supplier.id, supplier.name, 'supplier', supportMsg.trim()); setSupportMsg(''); setSupportSent(true); setTimeout(() => setSupportSent(false), 2000); } }}
                      className="flex-1 px-3 py-2 bg-brand-bone border border-brand-sand/30 rounded-xl text-[10px] outline-none focus:border-brand-gold resize-none" />
                    <button onClick={() => { if (supportMsg.trim()) { SupplierMessageService.send(supplier.id, supplier.name, 'supplier', supportMsg.trim()); setSupportMsg(''); setSupportSent(true); setTimeout(() => setSupportSent(false), 2000); } }} disabled={!supportMsg.trim()}
                      className="w-10 h-10 bg-brand-ink text-brand-paper rounded-xl flex items-center justify-center disabled:opacity-30 hover:bg-brand-gold hover:text-brand-ink transition-all flex-shrink-0">
                      <Send size={14} />
                    </button>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {!showSupport && (
        <button onClick={() => setShowSupport(true)}
          className="fixed bottom-8 right-8 w-12 h-12 rounded-2xl bg-brand-ink text-brand-paper shadow-lg flex items-center justify-center z-[100] hover:bg-brand-gold hover:text-brand-ink transition-all">
          <MessageSquare size={18} />
          {SupplierMessageService.getBySupplier(supplier.id).filter(m => m.from === 'corporate' && !m.read).length > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[7px] font-bold text-white flex items-center justify-center">
              {SupplierMessageService.getBySupplier(supplier.id).filter(m => m.from === 'corporate' && !m.read).length}
            </span>
          )}
        </button>
      )}
    </div>
  );
}


// ─── Provider Invoices View (New) ──────────────────────────────────────────────
export function ProviderInvoicesViewNew({ invoices, getHumanStatus, calcAnticipo, onDispute, onFactoraje }: {
  invoices: Invoice[];
  getHumanStatus: (inv: Invoice) => { label: string; desc: string; color: string; icon: React.ReactNode };
  calcAnticipo: (amount: number, rate?: number) => { net: number; cost: number; rate: number };
  onDispute: (id: string) => void;
  onFactoraje: () => void;
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'paid' | 'issues'>('all');

  const filtered = invoices.filter(inv => {
    const matchSearch = inv.id.toLowerCase().includes(searchTerm.toLowerCase()) || inv.description.toLowerCase().includes(searchTerm.toLowerCase());
    if (filter === 'pending') return matchSearch && inv.status !== 'paid' && inv.status !== 'rejected';
    if (filter === 'paid') return matchSearch && inv.status === 'paid';
    if (filter === 'issues') return matchSearch && (inv.forensicStatus === 'DISCREPANCY' || inv.forensicStatus === 'BLOCKED');
    return matchSearch;
  });

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[.2em] text-brand-ink/30 font-bold">Documentos</p>
          <h2 className="text-3xl font-serif text-brand-ink mt-1">Mis Facturas</h2>
        </div>
        <button onClick={() => setIsImporting(true)}
          className="px-5 py-2.5 bg-brand-ink text-brand-paper rounded-xl text-[9px] uppercase font-bold tracking-wider hover:bg-brand-gold hover:text-brand-ink transition-all flex items-center gap-2">
          <UploadCloud size={13} /> Subir Factura
        </button>
      </div>

      {/* Filters + Search */}
      <div className="flex items-center gap-3">
        <div className="flex gap-1 bg-white/50 p-1 rounded-xl border border-brand-sand/20">
          {[
            { id: 'all' as const, label: 'Todas', count: invoices.length },
            { id: 'pending' as const, label: 'Pendientes', count: invoices.filter(i => i.status !== 'paid' && i.status !== 'rejected').length },
            { id: 'paid' as const, label: 'Pagadas', count: invoices.filter(i => i.status === 'paid').length },
            { id: 'issues' as const, label: 'Con problema', count: invoices.filter(i => i.forensicStatus === 'DISCREPANCY' || i.forensicStatus === 'BLOCKED').length },
          ].map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 rounded-lg text-[8px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                filter === f.id ? 'bg-brand-ink text-brand-paper shadow-sm' : 'text-brand-ink/40 hover:text-brand-ink'
              }`}>
              {f.label} <span className={`${filter === f.id ? 'text-brand-gold' : 'text-brand-ink/20'}`}>{f.count}</span>
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-ink/25" size={14} />
          <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Buscar folio o descripción..."
            className="w-full pl-9 pr-4 py-2 bg-white/70 border border-brand-sand/20 rounded-xl text-[10px] outline-none focus:border-brand-gold" />
        </div>
      </div>

      {/* Invoice Cards */}
      <div className="space-y-2">
        {filtered.map((inv, i) => {
          const status = getHumanStatus(inv);
          const anticipo = inv.status !== 'paid' ? calcAnticipo(inv.amount) : null;
          const needsAction = inv.forensicStatus === 'DISCREPANCY' || inv.forensicStatus === 'BLOCKED';

          return (
            <motion.div key={inv.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
              className={`bg-white/70 backdrop-blur-sm rounded-2xl border p-4 hover:shadow-md transition-all ${needsAction ? 'border-amber-200 bg-amber-50/20' : 'border-brand-sand/20'}`}>
              <div className="flex items-center gap-4">
                {/* Status icon */}
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  inv.status === 'paid' ? 'bg-green-50' : needsAction ? 'bg-amber-50' : 'bg-brand-bone'
                }`}>
                  {status.icon}
                </div>

                {/* Main info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-brand-ink cursor-pointer hover:text-brand-gold transition-colors" onClick={() => setViewingInvoice(inv)}>{inv.id}</span>
                    <span className={`text-[7px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${status.color}`}>{status.label}</span>
                    {inv.satStatus && (
                      <span className={`text-[7px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${
                        inv.satStatus === 'Vigente' ? 'bg-teal-50 text-teal-600' : inv.satStatus === 'Cancelado' ? 'bg-red-50 text-red-600' : 'bg-brand-bone text-brand-ink/30'
                      }`}>SAT: {inv.satStatus}</span>
                    )}
                  </div>
                  <p className="text-[10px] text-brand-ink/40 mt-0.5">{status.desc}</p>
                  <p className="text-[9px] text-brand-ink/25 mt-0.5">{inv.description} · {inv.date}</p>
                </div>

                {/* Amount */}
                <div className="text-right flex-shrink-0">
                  <p className={`font-serif text-lg ${inv.status === 'paid' ? 'text-green-700' : 'text-brand-ink'}`}>{CURRENCY_FORMATTER.format(inv.amount)}</p>
                  {/* #10 Inline calculator */}
                  {anticipo && inv.status !== 'paid' && !needsAction && (
                    <p className="text-[8px] text-brand-gold cursor-pointer hover:underline" onClick={onFactoraje}>
                      Anticipa {CURRENCY_FORMATTER.format(anticipo.net)} hoy
                    </p>
                  )}
                </div>

                {/* #6 Payment date or action */}
                <div className="flex-shrink-0 w-28 text-right">
                  {inv.status === 'paid' ? (
                    <div>
                      <p className="text-[8px] uppercase tracking-wider text-green-600 font-bold">Pagada</p>
                      <p className="text-[9px] text-brand-ink/30">{inv.paidDate || inv.date}</p>
                    </div>
                  ) : inv.scheduledPayDate ? (
                    <div>
                      <p className="text-[8px] uppercase tracking-wider text-blue-600 font-bold">Pago est.</p>
                      <p className="text-[9px] text-blue-500">{inv.scheduledPayDate}</p>
                    </div>
                  ) : needsAction ? (
                    (() => {
                      const myClar = ClarificationService.getByInvoice(inv.id);
                      const latest = myClar[0];
                      if (latest) {
                        return (
                          <div className="text-right">
                            <span className={`px-2 py-1 rounded-lg text-[7px] font-bold uppercase tracking-wider inline-flex items-center gap-1 ${
                              latest.status === 'pending' ? 'bg-amber-100 text-amber-600' :
                              latest.status === 'accepted' ? 'bg-green-100 text-green-700' :
                              latest.status === 'rejected' ? 'bg-red-100 text-red-600' :
                              'bg-blue-100 text-blue-600'
                            }`}>
                              {latest.status === 'pending' ? <><Clock size={8} /> Enviada</> :
                               latest.status === 'accepted' ? <><CheckCircle2 size={8} /> Aceptada</> :
                               latest.status === 'rejected' ? <><X size={8} /> Rechazada</> :
                               <><Eye size={8} /> Revisada</>}
                            </span>
                            {latest.status === 'rejected' && (
                              <button onClick={() => onDispute(inv.id)}
                                className="mt-1 block text-[7px] text-red-500 hover:underline font-bold">Re-aclarar</button>
                            )}
                          </div>
                        );
                      }
                      return (
                        <button onClick={() => onDispute(inv.id)}
                          className="px-3 py-1.5 bg-amber-100 text-amber-700 rounded-lg text-[8px] font-bold uppercase tracking-wider hover:bg-amber-200 transition-all">
                          Aclarar
                        </button>
                      );
                    })()
                  ) : (
                    <p className="text-[8px] text-brand-ink/20 uppercase tracking-wider">En proceso</p>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center py-16 text-brand-ink/25">
            <FileText size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No hay facturas en esta categoría.</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {viewingInvoice && <InvoiceDetailModal invoice={viewingInvoice} onClose={() => setViewingInvoice(null)} />}
        {isImporting && <ImportInvoicesModal onClose={() => setIsImporting(false)} />}
      </AnimatePresence>
    </div>
  );
}


export function ImportInvoicesModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timer1 = setTimeout(() => setStep(1), 1500);
    const timer2 = setTimeout(() => setStep(2), 3000);
    const timer3 = setTimeout(() => setStep(3), 4500);
    const timer4 = setTimeout(() => onClose(), 6000);
    return () => { clearTimeout(timer1); clearTimeout(timer2); clearTimeout(timer3); clearTimeout(timer4); };
  }, [onClose]);

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-brand-ink/80 backdrop-blur-md"
    >
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }}
        className="max-w-sm w-full bg-brand-paper rounded-[2rem] p-10 space-y-8 shadow-2xl flex flex-col items-center text-center relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-2 bg-brand-gold" />
        <div className="w-16 h-16 rounded-full bg-brand-bone flex items-center justify-center shadow-inner relative overflow-hidden">
           {step < 3 ? (
             <motion.div 
               animate={{ rotate: 360 }} 
               transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
             >
               <Database size={24} className="text-brand-ink/40" />
             </motion.div>
           ) : (
             <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
               <CheckCircle2 size={28} className="text-brand-gold" />
             </motion.div>
           )}
        </div>
        
        <div>
          <h3 className="text-xl font-serif text-brand-ink mb-2">
            {step === 0 && "Iniciando Conexión..."}
            {step === 1 && "Conectando al ERP..."}
            {step === 2 && "Sincronizando Facturas..."}
            {step === 3 && "¡Sincronización Exitosa!"}
          </h3>
          <p className="text-[10px] uppercase tracking-widest font-bold opacity-40">
            {step < 3 ? "Por favor espera" : "Facturas importadas al corporativo"}
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}


export function SchedulePaymentModal({ onClose }: { onClose: () => void }) {
  const [date, setDate] = useState('');
  const [isScheduling, setIsScheduling] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSchedule = () => {
    if (!date) return;
    setIsScheduling(true);
    setTimeout(() => {
      setIsScheduling(false);
      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 2000);
    }, 1500);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-brand-ink/80 backdrop-blur-md"
    >
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }}
        className="max-w-sm w-full bg-brand-paper rounded-[2rem] p-10 space-y-8 shadow-2xl relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-2 bg-brand-gold" />
        
        <header className="flex justify-between items-start">
          <div className="space-y-2">
            <span className="label-caps !text-brand-gold">Programación</span>
            <h3 className="text-2xl text-brand-ink">Programar Pago</h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-brand-bone rounded-full transition-colors opacity-30 hover:opacity-100">
            <X size={20} />
          </button>
        </header>

        {success ? (
          <div className="flex flex-col items-center py-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-brand-bone flex items-center justify-center">
              <CheckCircle2 size={32} className="text-brand-gold" />
            </div>
            <h4 className="text-xl font-serif text-brand-ink">Pago Programado</h4>
            <p className="text-sm opacity-60">Las facturas han sido agendadas exitosamente.</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold tracking-widest opacity-40 block">Fecha de Pago</label>
              <input 
                type="date" 
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full px-4 py-3 bg-brand-bone border border-brand-sand rounded-xl focus:outline-none focus:border-brand-gold text-sm"
              />
            </div>
            
            <button 
              onClick={handleSchedule}
              disabled={!date || isScheduling}
              className="w-full py-4 bg-brand-ink text-brand-paper rounded-xl text-[10px] uppercase font-bold tracking-[0.2em] hover:bg-brand-gold hover:text-brand-ink transition-all disabled:opacity-50 flex justify-center items-center gap-2"
            >
              {isScheduling ? <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }} className="w-4 h-4 border-2 border-brand-paper/30 border-t-brand-paper rounded-full" /> : "Confirmar Programación"}
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
