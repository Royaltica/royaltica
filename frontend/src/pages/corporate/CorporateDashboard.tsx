import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronRight, BarChart3, Building2, FileText, DollarSign, ShieldCheck, Activity,
  BookOpen, Zap, FolderArchive, Settings, Lock, Server, LogOut, Bot, X, Sparkles,
  ThumbsUp, ThumbsDown, Loader2, Send,
} from 'lucide-react';
import type { User as FirebaseUser } from 'firebase/auth';
import { MOCK_INVOICES, MOCK_SUPPLIERS, type Invoice } from '../../types.ts';
import { api, isRealId } from '../../services/apiClient.ts';
import { runRealAudit, type ForensicAuditResult } from '../../services/auditAdapter.ts';
import { AuthorizerService } from '../../services/mockServices.ts';
import { DEFAULT_BUDGET, isInvoiceFullyValidated, getAIRecommendation } from '../../utils/format.ts';
import { NotificationBell } from '../../components/NotificationBell.tsx';
import { SidebarLink } from '../../components/SidebarLink.tsx';
import { ReceivablesView } from '../../features/corporate/cobranza/ReceivablesView.tsx';
import { DashboardView } from './views/DashboardView.tsx';
import { SupplierDirectoryView, DocumentManagerModal, type DocumentFile } from './views/SupplierDirectoryView.tsx';
import { PendingInvoicesView } from './views/PendingInvoicesView.tsx';
import { AuditsView } from './views/AuditsView.tsx';
import { FinancingView } from './views/FinancingView.tsx';
import { SettingsView } from './views/SettingsView.tsx';
import { FiscalAuditDashboard } from './views/FiscalAuditDashboard.tsx';
import { ContabilidadView } from './views/ContabilidadView.tsx';
import { HistorialView } from './views/HistorialView.tsx';
import { GrowthOpsView } from './views/GrowthOpsView.tsx';
import { useOrgBranding } from '../../hooks/useOrgBranding.ts';

/** Mensaje del chat con el asistente de IA (backend /ai/chat). */
type ChatMessage = { role: 'user' | 'assistant'; content: string };

type CorporateTab = 'dashboard' | 'suppliers' | 'audits' | 'pending_invoices' | 'receivables' | 'growth' | 'financing' | 'settings' | 'fiscal_audit' | 'contabilidad' | 'historial';
const CORPORATE_TABS: CorporateTab[] = ['dashboard', 'suppliers', 'audits', 'pending_invoices', 'receivables', 'growth', 'financing', 'settings', 'fiscal_audit', 'contabilidad', 'historial'];
/** Área de permisos (JWT) que gobierna cada pestaña — ver `canSee` abajo. */
const TAB_AREA: Record<CorporateTab, string> = {
  dashboard: 'dashboard',
  suppliers: 'proveedores',
  pending_invoices: 'finanzas',
  audits: 'finanzas',
  receivables: 'cxc',
  growth: 'cxc',
  fiscal_audit: 'estados',
  contabilidad: 'estados',
  historial: 'estados',
  financing: 'factoraje',
  settings: 'configuracion',
};

export function CorporateDashboard({ user, onLogout, onBackToRole, sessionStartedAt, permissions = [], role = '' }: { user: FirebaseUser, onLogout: () => void, onBackToRole: () => void, sessionStartedAt?: Date, permissions?: string[], role?: string }) {
  // La pestaña activa vive en la URL (react-router), no en useState: permite
  // recargar, compartir el link, y usar atrás/adelante del navegador para
  // moverse entre secciones del portal corporativo.
  const location = useLocation();
  const navigate = useNavigate();
  const pathTab = location.pathname.slice(1) as CorporateTab;
  const activeTab: CorporateTab = CORPORATE_TABS.includes(pathTab) ? pathTab : 'dashboard';
  const setActiveTab = React.useCallback(
    (tab: CorporateTab) => navigate(`/${tab}`),
    [navigate],
  );
  // Filtro de pestañas por permisos del JWT. Admin ve todo; el operativo solo
  // las áreas que se le asignaron al invitarlo (comodín '*' = acceso total).
  const isFullAccess = role === 'CORPORATE_ADMIN' || role === 'SUPERADMIN' || permissions.includes('*');
  const canSee = (area: string) => isFullAccess || permissions.includes(area);

  // Si la URL no corresponde a ninguna pestaña conocida (o el usuario no
  // tiene permiso para verla), redirige a /dashboard en vez de mostrar una
  // pantalla en blanco o dejar una pestaña oculta accesible solo por URL.
  useEffect(() => {
    if (!CORPORATE_TABS.includes(pathTab)) {
      navigate('/dashboard', { replace: true });
      return;
    }
    if (!canSee(TAB_AREA[pathTab]) && pathTab !== 'dashboard') {
      navigate('/dashboard', { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathTab]);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => window.innerWidth < 900);
  // White label (Tradespace): nombre/logo/colores propios del tenant, con
  // fallback al look por defecto de Royáltica.
  const branding = useOrgBranding();

  // ─── Budget State (persisted in localStorage, aislado por usuario/org) ───
  const budgetKey = `royaltica_budget_${user.uid}`;
  const [totalBudget, setTotalBudget] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(`royaltica_budget_${user.uid}`);
      return saved ? Number(saved) : DEFAULT_BUDGET;
    } catch { return DEFAULT_BUDGET; }
  });

  useEffect(() => {
    localStorage.setItem(budgetKey, String(totalBudget));
  }, [totalBudget, budgetKey]);

  const [invoices, setInvoices] = useState<Invoice[]>(MOCK_INVOICES);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditResult, setAuditResult] = useState<ForensicAuditResult | null>(null);
  const [viewingDocs, setViewingDocs] = useState<{ title: string, docs: DocumentFile[] } | null>(null);
  const [navigationContext, setNavigationContext] = useState<{ supplierName: string | null, priorityLabel: string | null }>({ supplierName: null, priorityLabel: null });

  // ─── Carga de datos REALES del backend ───
  // Al montar el portal corporativo, reemplaza las facturas de ejemplo por las
  // reales del backend (vía apiClient, que ya lleva el JWT). Si el backend no
  // responde, se conservan los mocks para que la UI no se rompa.
  useEffect(() => {
    api
      .getInvoices()
      .then((real) => { if (real.length) setInvoices(real); })
      .catch((err) => console.warn('No se pudieron cargar facturas reales:', err.message));
  }, []);

  // Carga los PROVEEDORES reales del backend. Como MOCK_SUPPLIERS se consume
  // por importación directa en muchos componentes, se reemplaza su contenido
  // en sitio y se fuerza un re-render (suppliersVersion). Esto conecta todo el
  // directorio + dropdowns sin tocar la UI, y hace que las búsquedas
  // factura→proveedor (por UUID) empaten correctamente.
  const [, setSuppliersVersion] = useState(0);
  useEffect(() => {
    api
      .getSuppliers()
      .then((real) => {
        if (real.length) {
          MOCK_SUPPLIERS.length = 0;
          MOCK_SUPPLIERS.push(...real);
          setSuppliersVersion((v) => v + 1);
        }
      })
      .catch((err) => console.warn('No se pudieron cargar proveedores reales:', err.message));
  }, []);

  // Carga los autorizadores operativos persistidos en el backend, para que la
  // configuración de autorización (y por ende las firmas requeridas) sobreviva
  // a recargas. Sin tocar la UI: solo siembra AuthorizerService.
  useEffect(() => {
    AuthorizerService.loadFromBackend();
  }, []);

  // ─── Global AI Chat State ───
  const [globalShowChat, setGlobalShowChat] = useState(false);
  const [globalChatMessages, setGlobalChatMessages] = useState<ChatMessage[]>([]);
  const [globalChatInput, setGlobalChatInput] = useState('');
  const [globalChatLoading, setGlobalChatLoading] = useState(false);
  const [globalThinkingStage, setGlobalThinkingStage] = useState(0);
  const globalChatEndRef = useRef<HTMLDivElement>(null);
  // Feedback 👍/👎: calificación dada por índice de mensaje + herramientas que
  // usó cada respuesta (para mandarlas al backend y poder afinar el modelo).
  const [chatFeedback, setChatFeedback] = useState<Record<number, 'UP' | 'DOWN'>>({});
  const chatToolsRef = useRef<Record<number, string[]>>({});
  const CHAT_ERROR_MSG = 'Error al procesar la consulta. Intenta de nuevo.';

  const handleChatFeedback = React.useCallback(async (index: number, rating: 'UP' | 'DOWN') => {
    if (chatFeedback[index]) return; // ya calificado, no repetir
    const answer = globalChatMessages[index]?.content ?? '';
    const question = globalChatMessages[index - 1]?.content ?? '';
    setChatFeedback(prev => ({ ...prev, [index]: rating }));
    try {
      await api.aiFeedback({ rating, question, answer, toolsUsed: chatToolsRef.current[index] ?? [] });
    } catch {
      /* el feedback nunca debe romper la experiencia del chat */
    }
  }, [chatFeedback, globalChatMessages]);

  const handleGlobalChatSend = React.useCallback(async () => {
    if (!globalChatInput.trim() || globalChatLoading) return;
    const userMsg: ChatMessage = { role: 'user', content: globalChatInput.trim() };
    const history = globalChatMessages;
    setGlobalChatMessages(prev => [...prev, userMsg]);
    setGlobalChatInput('');
    setGlobalChatLoading(true);
    setGlobalThinkingStage(0);
    // Placeholder que se va rellenando en vivo con los fragmentos del stream
    // (reemplaza el timer falso de "etapas de pensamiento": ahora hay texto
    // real llegando del backend en cuanto el modelo empieza a responder).
    let placeholderIndex = -1;
    let streamedText = '';
    let usedAnyTool = false;
    try {
      const { reply, toolsUsed } = await api.aiChatStream(userMsg.content, history, {
        onTool: () => {
          usedAnyTool = true;
          setGlobalThinkingStage(prev => Math.min(prev + 1, 3));
        },
        onDelta: (text) => {
          streamedText += text;
          setGlobalChatMessages(prev => {
            if (placeholderIndex === -1) {
              placeholderIndex = prev.length;
              return [...prev, { role: 'assistant' as const, content: streamedText }];
            }
            const next = [...prev];
            next[placeholderIndex] = { role: 'assistant', content: streamedText };
            return next;
          });
        },
      });
      setGlobalChatMessages(prev => {
        const next = [...prev];
        if (placeholderIndex === -1) {
          placeholderIndex = next.length;
          next.push({ role: 'assistant', content: reply });
        } else {
          next[placeholderIndex] = { role: 'assistant', content: reply };
        }
        chatToolsRef.current[placeholderIndex] = toolsUsed ?? [];
        return next;
      });
      void usedAnyTool;
    } catch {
      setGlobalChatMessages(prev => {
        const next = [...prev];
        const msg = { role: 'assistant' as const, content: CHAT_ERROR_MSG };
        if (placeholderIndex === -1) next.push(msg);
        else next[placeholderIndex] = msg;
        return next;
      });
    }
    setGlobalChatLoading(false);
    setGlobalThinkingStage(0);
  }, [globalChatInput, globalChatLoading, globalChatMessages]);

  useEffect(() => {
    globalChatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [globalChatMessages]);

  // Clear audit state when leaving the audits tab
  const handleTabChange = (tab: typeof activeTab) => {
    if (activeTab === 'audits' && tab !== 'audits') {
      setSelectedInvoice(null);
      setIsAuditing(false);
      setAuditResult(null);
    }
    setActiveTab(tab);
  };

  // Auto-deselect and add recommendation if fully validated
  useEffect(() => {
    let changed = false;
    const nextInvoices = invoices.map(inv => {
      if (isInvoiceFullyValidated(inv) && !inv.aiRecommendation) {
        changed = true;
        const recommendation = getAIRecommendation(inv, totalBudget);
        return { ...inv, aiRecommendation: recommendation.reason };
      }
      return inv;
    });

    if (changed) {
      setInvoices(nextInvoices);
    }

    if (selectedInvoice) {
      const current = invoices.find(i => i.id === selectedInvoice.id);
      if (current && isInvoiceFullyValidated(current)) {
        setSelectedInvoice(null);
        setAuditResult(null);
      }
    }
  }, [invoices, selectedInvoice]);

  // Persiste el PAGO en el backend respetando la regla de autorizadores:
  // - 0 autorizadores ⇒ la factura se aprueba automáticamente (audita →
  //   aprueba) y luego se paga (crea pago + procesa + completa ⇒ PAID).
  // - ≥1 autorizadores ⇒ la factura debió aprobarse antes con firmas; aquí
  //   solo se intenta el pago (si no está aprobada, el backend lo rechaza y
  //   se ignora — la UI local no se ve afectada).
  // Fire-and-forget + guarda de UUID: nunca rompe el flujo visual.
  const persistPayment = React.useCallback(async (id: string, route: 'cash' | 'fintech') => {
    if (!isRealId(id)) return;
    try {
      const required = AuthorizerService.getStandard().length;
      if (required === 0) {
        await api.auditInvoice(id).catch(() => {}); // PENDING→AUDITED (no-op si ya)
        await api.updateInvoiceStatus(id, 'APPROVED').catch(() => {}); // →APPROVED
      }
      await api.payInvoice(id, route);
    } catch (err) {
      console.warn('No se pudo persistir el pago:', (err as Error).message);
    }
  }, []);

  const routePayment = (id: string, route: 'cash' | 'fintech') => {
    setInvoices(prev => prev.map(inv => inv.id === id ? { ...inv, paymentRoute: route, status: 'paid' } : inv));
    void persistPayment(id, route);
    if (selectedInvoice?.id === id) {
      setSelectedInvoice(null);
      setAuditResult(null);
    }
  };

  // Persiste un cambio de estatus (hoy: el rechazo de una factura) en el
  // backend. Mismo patrón fire-and-forget + guarda de UUID: la UI no se
  // bloquea ni se rompe si la factura es mock o la transición no aplica.
  // El backend solo permite PENDING/AUDITED/APPROVED → REJECTED.
  const persistStatus = React.useCallback(
    (id: string, updates: Partial<Invoice>) => {
      if (!isRealId(id) || updates.status !== 'rejected') return;
      api
        .updateInvoiceStatus(id, 'REJECTED', updates.rejectionReason)
        .catch((err) => console.warn('No se pudo persistir el rechazo:', err.message));
    },
    [],
  );

  return (
    <div className="h-screen w-full bg-brand-bone flex overflow-hidden">
      <NotificationBell />
      {/* Document Manager Modal */}
      {viewingDocs && (
        <DocumentManagerModal 
          title={viewingDocs.title}
          initialDocuments={viewingDocs.docs}
          onClose={() => setViewingDocs(null)}
        />
      )}
      {/* Sidebar */}
      <aside 
        className={`${isSidebarCollapsed ? 'w-0' : 'w-56'} bg-brand-ink text-[var(--brand-ink-text)] flex flex-col sticky top-0 h-screen transition-all duration-300 z-50 relative`}
      >
        <button 
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className="absolute -right-4 top-12 bg-brand-gold text-[var(--brand-gold-text)] p-1.5 rounded-full shadow-lg hover:scale-110 transition-all cursor-pointer z-[70] border-2 border-brand-ink"
        >
          <ChevronRight size={14} className={`transition-transform duration-300 ${isSidebarCollapsed ? '' : 'rotate-180'}`} />
        </button>

        <div className={`flex flex-col h-full overflow-y-auto overflow-x-hidden px-4 pt-6 transition-all duration-300 ${isSidebarCollapsed ? 'opacity-0 invisible pointer-events-none' : 'opacity-100 visible'}`}>
          <div className="mb-12 overflow-hidden whitespace-nowrap flex-shrink-0">
            <button onClick={onBackToRole} className="text-left cursor-pointer group flex items-center gap-3">
               <div className="w-8 h-8 flex-shrink-0 bg-brand-bone rounded flex items-center justify-center shadow-inner overflow-hidden">
                  {branding.logoUrl ? (
                    <img src={branding.logoUrl} alt={branding.displayName} className="w-full h-full object-contain" />
                  ) : (
                    <span className="font-serif font-bold text-brand-ink leading-none text-sm">{branding.displayName.charAt(0)}</span>
                  )}
               </div>
              {!isSidebarCollapsed && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <span className="label-caps mb-1 block !opacity-40">IA Fintech</span>
                  <h1 className="text-xl font-serif tracking-widest leading-none">{branding.displayName}</h1>
                </motion.div>
              )}
            </button>
          </div>

          <nav className="flex-1 space-y-2">
            {canSee('dashboard') && <SidebarLink icon={<BarChart3 size={18} />} label="Tablero" active={activeTab === 'dashboard'} collapsed={isSidebarCollapsed} onClick={() => handleTabChange('dashboard')} />}
            {canSee('proveedores') && <SidebarLink icon={<Building2 size={18} />} label="Proveedores" active={activeTab === 'suppliers'} collapsed={isSidebarCollapsed} onClick={() => handleTabChange('suppliers')} />}
            {canSee('finanzas') && <SidebarLink icon={<FileText size={18} />} label="F. por pagar" active={activeTab === 'pending_invoices'} collapsed={isSidebarCollapsed} onClick={() => handleTabChange('pending_invoices')} />}
            {canSee('cxc') && <SidebarLink icon={<DollarSign size={18} />} label="F. por cobrar" active={activeTab === 'receivables'} collapsed={isSidebarCollapsed} onClick={() => handleTabChange('receivables')} />}
            {canSee('cxc') && <SidebarLink icon={<Sparkles size={18} />} label="Crecimiento" active={activeTab === 'growth'} collapsed={isSidebarCollapsed} onClick={() => handleTabChange('growth')} />}
            {canSee('finanzas') && <SidebarLink icon={<ShieldCheck size={18} />} label="Validación" active={activeTab === 'audits'} collapsed={isSidebarCollapsed} onClick={() => handleTabChange('audits')} />}
            {canSee('estados') && <SidebarLink icon={<Activity size={18} />} label="Auditoría" active={activeTab === 'fiscal_audit'} collapsed={isSidebarCollapsed} onClick={() => handleTabChange('fiscal_audit')} />}
            {canSee('estados') && <SidebarLink icon={<BookOpen size={18} />} label="Contabilidad" active={activeTab === 'contabilidad'} collapsed={isSidebarCollapsed} onClick={() => handleTabChange('contabilidad')} />}
            {canSee('factoraje') && <SidebarLink icon={<Zap size={18} />} label="Factoraje" active={activeTab === 'financing'} collapsed={isSidebarCollapsed} onClick={() => handleTabChange('financing')} />}
            {canSee('estados') && <SidebarLink icon={<FolderArchive size={18} />} label="Historial" active={activeTab === 'historial'} collapsed={isSidebarCollapsed} onClick={() => handleTabChange('historial')} />}
          </nav>

          <div className="mt-auto py-8 border-t border-brand-paper/10 flex flex-col gap-6">
            {canSee('configuracion') && <SidebarLink icon={<Settings size={18} />} label="Configuración" active={activeTab === 'settings'} collapsed={isSidebarCollapsed} onClick={() => handleTabChange('settings')} />}

            {!isSidebarCollapsed && (
              <div className="px-3 py-3 bg-green-900/20 border border-green-500/20 rounded-2xl space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-[8px] text-green-400 font-bold uppercase tracking-widest">Sesión Segura</span>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck size={9} className="text-green-500/70" />
                    <span className="text-[7px] text-brand-paper/40">2FA Verificado</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Lock size={9} className="text-green-500/70" />
                    <span className="text-[7px] text-brand-paper/40">TLS 256-bit</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Server size={9} className="text-green-500/70" />
                    <span className="text-[7px] text-brand-paper/40">GCP ISO 27001</span>
                  </div>
                </div>
              </div>
            )}
            {isSidebarCollapsed && (
              <div className="flex justify-center" title="Sesión segura · 2FA · TLS · GCP">
                <div className="w-8 h-8 rounded-full bg-green-900/20 border border-green-500/20 flex items-center justify-center">
                  <ShieldCheck size={14} className="text-green-500" />
                </div>
              </div>
            )}

            <div className={`flex items-center ${isSidebarCollapsed ? 'justify-center' : 'gap-3'}`}>
              <div className="w-8 h-8 flex-shrink-0 rounded-full bg-brand-sand overflow-hidden border border-white/20">
                <img src={user.photoURL || "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix"} alt="" className="w-full h-full object-cover" />
              </div>
              {!isSidebarCollapsed && (
                <div className="text-[9px] uppercase font-bold tracking-widest leading-tight truncate">
                  {user.displayName?.split(' ')[0]}
                </div>
              )}
            </div>
            <button
              onClick={onLogout}
              className={`opacity-40 hover:opacity-100 transition-opacity flex items-center ${isSidebarCollapsed ? 'justify-center' : 'gap-3'} text-[9px] uppercase font-bold tracking-widest`}
            >
              <LogOut size={16} /> {!isSidebarCollapsed && "Salir"}
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col p-10 pb-0 overflow-y-auto bg-brand-bone text-[var(--brand-bone-text)] min-h-0">
        <div className="flex-1 flex flex-col min-h-0 pb-0">
          {activeTab === 'dashboard' && (
              <DashboardView
                invoices={invoices}
                totalBudget={totalBudget}
                onNavigateToProvider={(name, priority) => {
                  setNavigationContext({ supplierName: name, priorityLabel: priority });
                  setActiveTab('suppliers');
                }}
                onNavigateToTab={(tab) => handleTabChange(tab)}
              />
          )}

          {activeTab === 'suppliers' && (
              <SupplierDirectoryView
                invoices={invoices}
                onAuditRequest={(inv) => {
                  setSelectedInvoice(inv);
                  setActiveTab('audits');
                }}
                initialSupplierName={navigationContext.supplierName}
                initialPriorityFilter={navigationContext.priorityLabel}
              />
          )}

          {activeTab === 'pending_invoices' && (
              <PendingInvoicesView
                invoices={invoices}
                totalBudget={totalBudget}
                onAuditRequest={(inv) => {
                  setSelectedInvoice(inv);
                  setActiveTab('audits');
                  // AuditsView's useEffect will auto-start the audit
                }}
                onBatchProcess={async (selectedIds) => {
                  const toProcess = invoices.filter(i => selectedIds.includes(i.id));
                  // Switch to Validación tab and process each invoice with animation
                  setActiveTab('audits');
                  for (const inv of toProcess) {
                    setSelectedInvoice(inv);
                    setIsAuditing(true);
                    const [result] = await Promise.all([
                      runRealAudit(inv),
                      new Promise(resolve => setTimeout(resolve, 2500))
                    ]);
                    setAuditResult(result);
                    setIsAuditing(false);
                    setInvoices(prev => prev.map(i => i.id === inv.id ? {
                      ...i,
                      status: result.status === 'VALIDATED' ? 'audited' : i.status,
                      paymentRoute: result.status === 'VALIDATED' ? 'cash' : undefined,
                      auditScore: result.score,
                      auditAnalysis: result.analysis,
                      forensicStatus: result.status,
                      forensicSolution: result.solution,
                      signatures: result.status === 'VALIDATED' ? 2 : 0,
                      satStatus: result.satResult?.estado as any || 'Pendiente',
                      satVerifiedAt: new Date().toISOString(),
                      satCancelable: result.satResult?.esCancelable || undefined,
                    } : i));
                    // Nota: ya no hace falta persistAudit(inv.id) aquí — runRealAudit()
                    // arriba YA corrió y persistió la auditoría real en el backend.
                    // Brief pause between invoices so user sees each result
                    if (toProcess.indexOf(inv) < toProcess.length - 1) {
                      await new Promise(resolve => setTimeout(resolve, 800));
                    }
                  }
                }}
                onUpdateInvoice={(id, updates) => {
                  setInvoices(prev => prev.map(inv => inv.id === id ? { ...inv, ...updates } : inv));
                  persistStatus(id, updates);
                }}
              />
          )}

          {activeTab === 'receivables' && (
              <ReceivablesView />
          )}

          {activeTab === 'growth' && (
              <GrowthOpsView />
          )}

          {activeTab === 'audits' && (
              <AuditsView
                invoices={invoices}
                selectedInvoice={selectedInvoice}
                setSelectedInvoice={setSelectedInvoice}
                isAuditing={isAuditing}
                auditResult={auditResult}
                startAudit={async (inv) => {
                   setIsAuditing(true);
                   // Run audit with minimum 2.5s delay so animation is visible
                   const [result] = await Promise.all([
                     runRealAudit(inv),
                     new Promise(resolve => setTimeout(resolve, 2500))
                   ]);
                   setAuditResult(result);
                   setIsAuditing(false);

                   setInvoices(prev => prev.map(i => i.id === inv.id ? {
                     ...i,
                     status: result.status === 'VALIDATED' ? 'audited' : i.status,
                     auditScore: result.score,
                     auditAnalysis: result.analysis,
                     forensicStatus: result.status,
                     forensicSolution: result.solution,
                     signatures: result.status === 'VALIDATED' ? 1 : 0,
                     satStatus: result.satResult?.estado as any || 'Pendiente',
                     satVerifiedAt: new Date().toISOString(),
                     satCancelable: result.satResult?.esCancelable || undefined,
                   } : i));
                   // runRealAudit() ya persistió la auditoría real en el backend.
                 }}
                routePayment={routePayment}
                onUpdateInvoice={(id, updates) => {
                  setInvoices(prev => prev.map(inv => inv.id === id ? { ...inv, ...updates } : inv));
                  persistStatus(id, updates);
                }}
                setViewingDocs={setViewingDocs}
                onTabChange={handleTabChange}
                onApproveWithAnimation={async (inv) => {
                  // Re-audit the invoice with animation, then approve
                  setSelectedInvoice(inv);
                  setIsAuditing(true);
                  const [result] = await Promise.all([
                    runRealAudit(inv),
                    new Promise(resolve => setTimeout(resolve, 2500))
                  ]);
                  setAuditResult(result);
                  setIsAuditing(false);
                  // Approve with exception regardless of re-audit result
                  setInvoices(prev => prev.map(i => i.id === inv.id ? {
                    ...i,
                    status: 'audited',
                    forensicStatus: 'VALIDATED',
                    auditScore: result.score > 70 ? result.score : 70,
                    auditAnalysis: result.analysis,
                    signatures: 1,
                    supportDocUrl: 'excepcion_manual',
                    satStatus: result.satResult?.estado as any || i.satStatus || 'Pendiente',
                    satVerifiedAt: new Date().toISOString(),
                    changeLog: [...(i.changeLog || []), { timestamp: new Date().toISOString(), user: 'Auditor', action: 'Aprobada con excepción', from: i.forensicStatus, to: 'VALIDATED', reason: 'Aprobación manual con respaldo' }]
                  } : i));
                  // runRealAudit() ya persistió la auditoría real en el backend.
                }}
              />
          )}

          {activeTab === 'financing' && (
              <FinancingView
                invoices={invoices}
                routePayment={routePayment}
                totalBudget={totalBudget}
              />
          )}

          {activeTab === 'settings' && (
              <SettingsView
                totalBudget={totalBudget}
                onBudgetChange={setTotalBudget}
              />
          )}

          {activeTab === 'fiscal_audit' && (
              <FiscalAuditDashboard />
          )}

          {activeTab === 'contabilidad' && (
              <ContabilidadView invoices={invoices} />
          )}

          {activeTab === 'historial' && (
              <HistorialView invoices={invoices} />
          )}
        </div>
      </main>

      {/* ═══ GLOBAL AI CHAT — visible on every tab ═══ */}
      <AnimatePresence>
        {globalShowChat && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-24 right-8 w-[420px] h-[540px] bg-brand-cream/95 backdrop-blur-xl rounded-3xl border border-brand-sand/30 shadow-2xl flex flex-col overflow-hidden z-[100]"
          >
            <div className="px-5 py-4 border-b border-brand-sand/20 bg-brand-ink text-brand-paper flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-brand-gold/20 flex items-center justify-center">
                  <Bot size={16} className="text-brand-gold" />
                </div>
                <div>
                  <h4 className="text-[11px] font-bold uppercase tracking-wider">Asistente Royáltica</h4>
                  <p className="text-[8px] text-brand-paper/40 uppercase tracking-wider">
                    {activeTab === 'contabilidad' ? 'Contabilidad' : activeTab === 'dashboard' ? 'Tablero' : activeTab === 'audits' ? 'Validación' : activeTab === 'pending_invoices' ? 'Tesorería' : activeTab === 'financing' ? 'Factoraje' : activeTab === 'fiscal_audit' ? 'Auditoría' : 'General'} · IA en tiempo real
                  </p>
                </div>
              </div>
              <button onClick={() => setGlobalShowChat(false)} className="text-brand-paper/40 hover:text-brand-paper transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {globalChatMessages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-center px-6">
                  <div className="w-12 h-12 rounded-2xl bg-brand-gold/10 flex items-center justify-center mb-4">
                    <Sparkles size={20} className="text-brand-gold" />
                  </div>
                  <p className="text-[10px] font-bold uppercase tracking-[.2em] text-brand-ink/40 mb-2">Asistente IA Global</p>
                  <p className="text-[9px] text-brand-ink/30 leading-relaxed mb-4">
                    Pregúntame sobre facturas, proveedores, auditorías, presupuesto, contabilidad o cualquier dato de la plataforma.
                  </p>
                  <div className="grid grid-cols-2 gap-2 w-full">
                    {[
                      '¿Cuánto debo a proveedores?',
                      '¿Cuál es mi razón circulante?',
                      'Facturas vencidas',
                      'Resumen de tesorería',
                    ].map((q) => (
                      <button key={q} onClick={() => setGlobalChatInput(q)}
                        className="text-left text-[8px] text-brand-ink/50 bg-white/60 hover:bg-white rounded-xl px-3 py-2.5 border border-brand-sand/20 transition-all hover:border-brand-gold/30">
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {globalChatMessages.map((msg, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-[10px] leading-relaxed ${
                    msg.role === 'user' ? 'bg-brand-ink text-brand-paper' : 'bg-white/80 text-brand-ink border border-brand-sand/20'
                  }`}>
                    {msg.role === 'assistant' ? (
                      <div className="space-y-1.5 [&_strong]:font-bold [&_strong]:text-brand-ink">
                        {msg.content.split('\n').map((line, li) => {
                          if (line.startsWith('**') && line.endsWith('**'))
                            return <p key={li} className="font-bold text-[11px] text-brand-ink mt-1">{line.replace(/\*\*/g, '')}</p>;
                          if (line.startsWith('- ') || line.startsWith('• ') || line.startsWith('  •') || line.startsWith('  -'))
                            return <p key={li} className="pl-2 text-brand-ink/70">{line.replace(/\*\*/g, '').replace(/^[-•]\s*/, '· ')}</p>;
                          if (line.trim() === '') return <div key={li} className="h-1" />;
                          // Negritas **texto** renderizadas como nodos React (nunca innerHTML: la respuesta de la IA no es HTML confiable)
                          return <p key={li} className="text-brand-ink/80">{line.split(/\*\*(.*?)\*\*/g).map((seg, si) => si % 2 === 1 ? <strong key={si}>{seg}</strong> : seg)}</p>;
                        })}
                        {msg.content !== CHAT_ERROR_MSG && (
                          <div className="flex items-center gap-1.5 pt-1.5 mt-1 border-t border-brand-sand/20">
                            {chatFeedback[i] ? (
                              <span className="text-[8px] text-brand-ink/40">
                                {chatFeedback[i] === 'UP' ? '👍 ¡Gracias por tu retroalimentación!' : '👎 Gracias, lo tomaremos en cuenta.'}
                              </span>
                            ) : (
                              <>
                                <span className="text-[8px] text-brand-ink/30">¿Te sirvió?</span>
                                <button onClick={() => handleChatFeedback(i, 'UP')} aria-label="Respuesta útil"
                                  className="w-5 h-5 rounded-md flex items-center justify-center text-brand-ink/40 hover:text-green-600 hover:bg-green-50 transition-all">
                                  <ThumbsUp size={11} />
                                </button>
                                <button onClick={() => handleChatFeedback(i, 'DOWN')} aria-label="Respuesta no útil"
                                  className="w-5 h-5 rounded-md flex items-center justify-center text-brand-ink/40 hover:text-red-500 hover:bg-red-50 transition-all">
                                  <ThumbsDown size={11} />
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    ) : msg.content}
                  </div>
                </motion.div>
              ))}
              {globalChatLoading && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex justify-start">
                  <div className="bg-white/80 border border-brand-sand/20 rounded-2xl px-4 py-3 max-w-[85%]">
                    <div className="flex items-center gap-2">
                      <Loader2 size={12} className="animate-spin text-brand-gold" />
                      <span className="text-[9px] text-brand-ink/50">
                        {globalThinkingStage === 0 && 'Analizando datos...'}
                        {globalThinkingStage === 1 && 'Procesando contexto...'}
                        {globalThinkingStage === 2 && 'Calculando...'}
                        {globalThinkingStage === 3 && 'Generando respuesta...'}
                      </span>
                    </div>
                  </div>
                </motion.div>
              )}
              <div ref={globalChatEndRef} />
            </div>

            <div className="p-3 border-t border-brand-sand/20 bg-white/40 flex-shrink-0">
              <div className="flex items-center gap-2 bg-white rounded-xl border border-brand-sand/20 px-3 py-1.5">
                <input type="text" value={globalChatInput}
                  onChange={e => setGlobalChatInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleGlobalChatSend()}
                  placeholder="Pregunta lo que sea..."
                  className="flex-1 text-[10px] bg-transparent outline-none text-brand-ink placeholder:text-brand-ink/25" />
                <button onClick={handleGlobalChatSend} disabled={!globalChatInput.trim() || globalChatLoading}
                  className="w-7 h-7 rounded-lg bg-brand-ink text-brand-paper flex items-center justify-center disabled:opacity-30 hover:bg-brand-ink/80 transition-all">
                  <Send size={12} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button onClick={() => setGlobalShowChat(prev => !prev)}
        whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
        className={`fixed bottom-8 right-8 w-14 h-14 rounded-2xl shadow-xl flex items-center justify-center z-[100] transition-all duration-300 ${
          globalShowChat ? 'bg-brand-ink text-brand-paper' : 'bg-gradient-to-br from-brand-gold to-brand-gold/80 text-white'
        }`}>
        {globalShowChat ? <X size={20} /> : <Bot size={22} />}
        {!globalShowChat && globalChatMessages.length === 0 && (
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white animate-pulse" />
        )}
      </motion.button>
    </div>
  );
}
