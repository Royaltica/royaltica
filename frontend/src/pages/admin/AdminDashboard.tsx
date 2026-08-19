import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, LogOut, ChevronRight, FileText, X, Plus, ChevronLeft, Activity, Loader2, DollarSign, Crown, Users, Server, Gauge, Handshake, HeartPulse } from 'lucide-react';
import type { User as FirebaseUser } from 'firebase/auth';
import { api, isRealId, type AdminOrg, type AdminActivity, type AdminCostByFeature, type AdminOrgCost } from '../../services/apiClient.ts';
import { NotificationBell } from '../../components/NotificationBell.tsx';
import { SidebarLink } from '../../components/SidebarLink.tsx';
import { LeadsAdminPanel } from '../../features/admin/LeadsAdminPanel.tsx';

// ─── Admin Dashboard (Royáltica CEO Portal) ──────────────────────────────────
const MOCK_TENANTS = [
  { id: 'T-001', name: 'Grupo Industrial Monterrey SA de CV', rfc: 'GIM901215AB3', plan: 'Enterprise', status: 'active' as const, invoicesProcessed: 1247, lastActive: '2026-06-12T08:30:00', monthlyVolume: 18_500_000, users: 12, healthScore: 97 },
  { id: 'T-002', name: 'Distribuidora Nacional MX', rfc: 'DNM880430QR7', plan: 'Business', status: 'active' as const, invoicesProcessed: 583, lastActive: '2026-06-11T17:45:00', monthlyVolume: 6_200_000, users: 5, healthScore: 84 },
  { id: 'T-003', name: 'Alimentos del Pacífico SA', rfc: 'APS950612KL0', plan: 'Starter', status: 'trial' as const, invoicesProcessed: 42, lastActive: '2026-06-10T12:00:00', monthlyVolume: 890_000, users: 2, healthScore: 71 },
  { id: 'T-004', name: 'Constructora Vanguardia', rfc: 'CVA070823MN5', plan: 'Enterprise', status: 'active' as const, invoicesProcessed: 2104, lastActive: '2026-06-12T09:15:00', monthlyVolume: 32_400_000, users: 18, healthScore: 93 },
  { id: 'T-005', name: 'Farmacéuticos del Bajío', rfc: 'FDB110517PQ2', plan: 'Business', status: 'suspended' as const, invoicesProcessed: 0, lastActive: '2026-05-28T10:00:00', monthlyVolume: 0, users: 7, healthScore: 0 },
];

/** Forma de un cliente en el panel admin (mock y real comparten esta forma). */
type AdminTenant = {
  id: string; name: string; rfc: string; plan: string;
  status: 'active' | 'trial' | 'suspended';
  invoicesProcessed: number; lastActive: string; monthlyVolume: number;
  users: number; healthScore: number;
};

/** Mapea una organización real del backend al shape que usa el panel. */
const mapOrgToTenant = (o: AdminOrg): AdminTenant => ({
  id: o.id,
  name: o.name,
  rfc: o.rfc,
  plan: o.plan === 'ENTERPRISE' ? 'Enterprise' : o.plan === 'PRO' ? 'Business' : 'Starter',
  status: o.deleted || !o.isActive ? 'suspended' : 'active',
  invoicesProcessed: o.counts.invoices,
  lastActive: o.createdAt,
  monthlyVolume: o.amount,
  users: o.counts.users,
  // "Salud" no tiene backend de monitoreo aún: se deriva del estado/actividad.
  healthScore: o.deleted || !o.isActive ? 0 : o.counts.invoices > 0 ? 95 : 75,
});

/** Traduce el código de acción de la bitácora a una frase legible en español. */
const ACTIVITY_LABELS: Record<string, string> = {
  ORG_SETTINGS_UPDATED: 'Actualizó la configuración de la organización',
  ORG_CREATED: 'Creó una organización',
  PAYMENT_CREATED: 'Creó un pago',
  PAYMENT_STATUS_CHANGED: 'Cambió el estatus de un pago',
  INVOICE_CREATED: 'Registró una factura',
  INVOICE_STATUS_CHANGED: 'Cambió el estatus de una factura',
  INVOICE_AUDITED: 'Auditó una factura',
  SUPPLIER_APPROVED: 'Aprobó un proveedor',
  SUPPLIER_CREATED: 'Dio de alta un proveedor',
  USER_INVITED: 'Invitó a un usuario',
  FACTORAJE_DISBURSED: 'Dispersó un factoraje',
  ERP_SYNC: 'Sincronizó con el ERP',
};
const activityLabel = (action: string): string =>
  ACTIVITY_LABELS[action] ?? action.replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase());
/** Color del punto según el tipo de acción (alerta/auditoría/normal). */
const activityType = (action: string): 'alert' | 'audit' | 'info' => {
  if (/FAILED|BLOCKED|REJECT|SUSPEND/.test(action)) return 'alert';
  if (/AUDIT/.test(action)) return 'audit';
  return 'info';
};

/** Etiqueta legible de cada servicio que genera costo (cost tracking). */
const FEATURE_LABELS: Record<string, string> = {
  GEMINI_CHAT: 'Asistente IA (Gemini)',
  GEMINI_AUDIT: 'Auditoría IA (Gemini)',
  EMAIL_SENT: 'Correos',
  GCS_UPLOAD: 'Almacenamiento',
  SAT_QUERY: 'Consultas SAT',
  JOB_RUN: 'Tareas programadas',
  FACTORAJE_API: 'API de Factoraje',
  WHATSAPP_SENT: 'WhatsApp',
};
const featureLabel = (f: string): string => FEATURE_LABELS[f] ?? f.replace(/_/g, ' ');
/** Formatea un costo en MXN; si es muy pequeño muestra más decimales. */
const fmtCostMxn = (n: number): string =>
  n === 0 ? '$0.00' : n < 1 ? `$${n.toFixed(4)}` : `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;


type AdminTab = 'overview' | 'clients' | 'health' | 'activity' | 'leads';
const ADMIN_TABS: AdminTab[] = ['overview', 'clients', 'health', 'activity', 'leads'];

export function AdminDashboard({ user, onLogout, onBackToRole }: { user: FirebaseUser, onLogout: () => void, onBackToRole: () => void }) {
  // La pestaña activa vive en la URL (react-router): permite recargar,
  // compartir el link, y usar atrás/adelante del navegador.
  const location = useLocation();
  const navigate = useNavigate();
  const pathTab = location.pathname.slice(1) as AdminTab;
  const adminTab: AdminTab = ADMIN_TABS.includes(pathTab) ? pathTab : 'overview';
  const setAdminTab = React.useCallback(
    (tab: AdminTab) => navigate(`/${tab}`),
    [navigate],
  );
  useEffect(() => {
    if (!ADMIN_TABS.includes(pathTab)) navigate('/overview', { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathTab]);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<AdminTenant | null>(null);

  // Clientes reales del backend (/admin/organizations). Arranca con los mocks
  // como fallback; si la carga falla, la consola sigue mostrando algo.
  const [tenants, setTenants] = useState<AdminTenant[]>(MOCK_TENANTS);
  const loadTenants = React.useCallback(() => {
    return api.adminOrganizations()
      // Se ocultan las organizaciones con soft-delete (deleted) del panel.
      .then(orgs => { const live = orgs.filter(o => !o.deleted); if (live.length) setTenants(live.map(mapOrgToTenant)); })
      .catch(() => { /* sin sesión SUPERADMIN o backend caído: se quedan los mocks */ });
  }, []);
  useEffect(() => { void loadTenants(); }, [loadTenants]);

  // Bitácora de actividad real (/admin/activity). Se carga al entrar a la pestaña.
  const [activity, setActivity] = useState<AdminActivity[] | null>(null);
  useEffect(() => {
    if (adminTab !== 'activity' || activity !== null) return;
    api.adminActivity(40).then(setActivity).catch(() => setActivity([]));
  }, [adminTab, activity]);

  // Costos de operación reales (gasto de Gemini, correos, etc.) — /admin/costs/by-feature.
  const [costs, setCosts] = useState<AdminCostByFeature | null>(null);
  useEffect(() => {
    api.adminCostsByFeature().then(setCosts).catch(() => setCosts({ totalCostMxn: 0, byFeature: [] }));
  }, []);

  // Salud REAL del sistema (health-check del backend + estado del asistente IA).
  type SysService = { name: string; status: 'operational' | 'down'; latency: number | null };
  const [services, setServices] = useState<SysService[]>([]);
  useEffect(() => {
    let alive = true;
    (async () => {
      const t0 = performance.now();
      const health = await api.health().catch(() => null);
      const apiLatency = Math.round(performance.now() - t0);
      const tAi = performance.now();
      const ai = await api.aiStatus().catch(() => ({ available: false }));
      const aiLatency = Math.round(performance.now() - tAi);
      if (!alive) return;
      setServices([
        { name: 'API Royáltica', status: health ? 'operational' : 'down', latency: health ? apiLatency : null },
        { name: 'Base de Datos (PostgreSQL)', status: health?.db === 'ok' ? 'operational' : 'down', latency: null },
        { name: 'Caché (Redis)', status: health?.redis === 'ok' ? 'operational' : 'down', latency: null },
        { name: 'Asistente IA (Gemini · Vertex AI)', status: ai.available ? 'operational' : 'down', latency: ai.available ? aiLatency : null },
      ]);
    })();
    return () => { alive = false; };
  }, []);
  const servicesUp = services.filter(s => s.status === 'operational').length;

  // Costo de operación del cliente seleccionado (/admin/costs/:orgId).
  const [tenantCost, setTenantCost] = useState<AdminOrgCost | null>(null);
  useEffect(() => {
    if (!selectedTenant || !isRealId(selectedTenant.id)) { setTenantCost(null); return; }
    setTenantCost(null);
    api.adminCostForOrg(selectedTenant.id).then(setTenantCost).catch(() => setTenantCost(null));
  }, [selectedTenant]);

  // Onboarding de cliente nuevo (POST /admin/organizations).
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClient, setNewClient] = useState({ name: '', rfc: '', legalName: '', plan: 'PRO' as 'FREE' | 'PRO' | 'ENTERPRISE', adminEmail: '', adminName: '' });
  const [creatingClient, setCreatingClient] = useState(false);
  const [newClientError, setNewClientError] = useState('');
  const [newClientDone, setNewClientDone] = useState<string | null>(null);

  const handleCreateClient = React.useCallback(async () => {
    setNewClientError('');
    const f = newClient;
    if (!f.name.trim() || !f.rfc.trim() || !f.legalName.trim() || !f.adminEmail.trim() || !f.adminName.trim()) {
      setNewClientError('Completa todos los campos.');
      return;
    }
    setCreatingClient(true);
    try {
      const res = await api.adminCreateOrganization({
        name: f.name.trim(), rfc: f.rfc.trim().toUpperCase(), legalName: f.legalName.trim(),
        plan: f.plan, adminEmail: f.adminEmail.trim(), adminName: f.adminName.trim(),
      });
      await loadTenants();
      setNewClientDone(res.admin.email);
      setNewClient({ name: '', rfc: '', legalName: '', plan: 'PRO', adminEmail: '', adminName: '' });
    } catch (e) {
      setNewClientError(e instanceof Error ? e.message : 'No se pudo crear el cliente.');
    } finally {
      setCreatingClient(false);
    }
  }, [newClient, loadTenants]);

  const activeTenants = tenants.filter(t => t.status === 'active');
  const totalVolume = tenants.reduce((s, t) => s + t.monthlyVolume, 0);
  const totalInvoices = tenants.reduce((s, t) => s + t.invoicesProcessed, 0);
  const operationalServices = servicesUp;

  const adminTabs = [
    { key: 'overview' as const, label: 'Resumen', icon: <Gauge size={18} /> },
    { key: 'clients' as const, label: 'Clientes', icon: <Users size={18} /> },
    { key: 'health' as const, label: 'Sistema', icon: <Server size={18} /> },
    { key: 'activity' as const, label: 'Actividad', icon: <Activity size={18} /> },
  ];

  return (
    <div className="flex h-screen bg-brand-bone overflow-hidden">
      <NotificationBell />
      {/* Sidebar */}
      <aside
        className={`${isSidebarCollapsed ? 'w-0' : 'w-56'} bg-brand-ink text-[var(--brand-ink-text)] flex flex-col sticky top-0 h-screen transition-all duration-300 z-50 relative`}
      >
        <button
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className="absolute -right-3 top-8 w-6 h-6 bg-brand-ink border border-brand-sand/20 rounded-full flex items-center justify-center cursor-pointer z-50 hover:bg-brand-gold transition-colors"
        >
          <ChevronRight size={14} className={`transition-transform duration-300 ${isSidebarCollapsed ? '' : 'rotate-180'}`} />
        </button>
        <div className={`flex flex-col h-full overflow-y-auto overflow-x-hidden px-4 pt-6 transition-all duration-300 ${isSidebarCollapsed ? 'opacity-0 invisible pointer-events-none' : 'opacity-100 visible'}`}>
          <div className="flex items-center gap-3 mb-10 px-1">
            <div className="w-9 h-9 bg-brand-gold text-brand-ink rounded-full flex items-center justify-center shadow-lg shadow-brand-gold/30">
              <Crown size={16} />
            </div>
            {!isSidebarCollapsed && (
              <div>
                <h1 className="text-sm font-serif text-brand-paper tracking-wide">Royáltica</h1>
                <p className="text-[8px] uppercase tracking-[0.3em] text-brand-gold font-bold">Admin Console</p>
              </div>
            )}
          </div>
          <nav className="flex-1 space-y-1">
            <SidebarLink icon={<Gauge size={18} />} label="Resumen" active={adminTab === 'overview'} collapsed={isSidebarCollapsed} onClick={() => setAdminTab('overview')} />
            <SidebarLink icon={<Users size={18} />} label="Clientes" active={adminTab === 'clients'} collapsed={isSidebarCollapsed} onClick={() => setAdminTab('clients')} />
            <SidebarLink icon={<Server size={18} />} label="Sistema" active={adminTab === 'health'} collapsed={isSidebarCollapsed} onClick={() => setAdminTab('health')} />
            <SidebarLink icon={<Activity size={18} />} label="Actividad" active={adminTab === 'activity'} collapsed={isSidebarCollapsed} onClick={() => setAdminTab('activity')} />
            <SidebarLink icon={<Handshake size={18} />} label="Leads" active={adminTab === 'leads'} collapsed={isSidebarCollapsed} onClick={() => setAdminTab('leads')} />
          </nav>
          <div className="mt-auto pb-6 space-y-2 border-t border-brand-bone/10 pt-4">
            <button onClick={onBackToRole} className="text-brand-bone/50 hover:text-brand-bone transition-colors flex items-center gap-3 text-[9px] uppercase font-bold tracking-widest w-full cursor-pointer">
              <ChevronLeft size={16} /> {!isSidebarCollapsed && "Cambiar Rol"}
            </button>
            <button onClick={onLogout} className="text-brand-bone/60 hover:text-red-300 transition-colors flex items-center gap-3 text-[9px] uppercase font-bold tracking-widest w-full cursor-pointer">
              <LogOut size={16} /> {!isSidebarCollapsed && "Salir"}
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-8 py-10">
          {/* Header */}
          <div className="flex items-center justify-between mb-10">
            <div>
              <h2 className="text-4xl font-serif text-brand-ink">
                {adminTab === 'overview' ? 'Panel de Control' : adminTab === 'clients' ? 'Gestión de Clientes' : adminTab === 'health' ? 'Salud del Sistema' : adminTab === 'leads' ? 'Leads' : 'Registro de Actividad'}
              </h2>
              <p className="text-sm text-brand-ink/40 mt-1">Royáltica Operations · {user.displayName || 'CEO'}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[10px] uppercase tracking-widest text-brand-ink/40 font-bold">En línea</span>
            </div>
          </div>

          {/* ═══ OVERVIEW TAB ═══ */}
          {adminTab === 'overview' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              {/* KPI Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
                {[
                  { label: 'Clientes Activos', value: activeTenants.length.toString(), sub: `${tenants.length} totales`, icon: <Handshake size={18} />, color: 'bg-blue-500' },
                  { label: 'Facturas Procesadas', value: totalInvoices.toLocaleString(), sub: 'este período', icon: <FileText size={18} />, color: 'bg-brand-gold' },
                  { label: 'Volumen Mensual', value: `$${(totalVolume / 1_000_000).toFixed(1)}M`, sub: 'MXN operados', icon: <DollarSign size={18} />, color: 'bg-green-500' },
                  { label: 'Servicios Activos', value: `${operationalServices}/${services.length || '—'}`, sub: 'health-check en vivo', icon: <HeartPulse size={18} />, color: services.length > 0 && operationalServices === services.length ? 'bg-green-500' : operationalServices === 0 ? 'bg-red-500' : 'bg-yellow-500' },
                ].map((kpi, i) => (
                  <motion.div key={i} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
                    className="editorial-card !p-5 !bg-white border border-brand-sand/20"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className={`w-9 h-9 ${kpi.color} text-white rounded-xl flex items-center justify-center shadow-sm`}>{kpi.icon}</div>
                      <span className="text-[9px] uppercase tracking-widest text-brand-ink/30 font-bold">{kpi.label}</span>
                    </div>
                    <p className="text-3xl font-serif text-brand-ink">{kpi.value}</p>
                    <p className="text-[10px] text-brand-ink/40 mt-1">{kpi.sub}</p>
                  </motion.div>
                ))}
              </div>

              {/* Two-column: Clients summary + System status */}
              <div className="grid lg:grid-cols-5 gap-6">
                {/* Top Clients */}
                <div className="lg:col-span-3 editorial-card !bg-white border border-brand-sand/20">
                  <div className="flex items-center justify-between mb-5">
                    <h3 className="text-lg font-serif text-brand-ink">Clientes Recientes</h3>
                    <button onClick={() => setAdminTab('clients')} className="text-[9px] uppercase tracking-widest text-brand-gold font-bold flex items-center gap-1 cursor-pointer hover:underline">
                      Ver todos <ChevronRight size={12} />
                    </button>
                  </div>
                  <div className="space-y-3">
                    {tenants.slice(0, 4).map(t => (
                      <div key={t.id} className="flex items-center gap-4 px-3 py-2.5 rounded-xl hover:bg-brand-bone/50 transition-colors">
                        <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${t.status === 'active' ? 'bg-green-500' : t.status === 'trial' ? 'bg-yellow-500' : 'bg-red-400'}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-brand-ink truncate">{t.name}</p>
                          <p className="text-[10px] text-brand-ink/40">{t.rfc} · {t.plan}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-serif text-brand-ink">{t.invoicesProcessed.toLocaleString()}</p>
                          <p className="text-[9px] text-brand-ink/30">facturas</p>
                        </div>
                        <div className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${t.healthScore >= 90 ? 'bg-green-50 text-green-700' : t.healthScore >= 70 ? 'bg-yellow-50 text-yellow-700' : 'bg-red-50 text-red-600'}`}>
                          {t.healthScore}%
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* System Health Summary */}
                <div className="lg:col-span-2 editorial-card !bg-white border border-brand-sand/20">
                  <div className="flex items-center justify-between mb-5">
                    <h3 className="text-lg font-serif text-brand-ink">Estado del Sistema</h3>
                    <button onClick={() => setAdminTab('health')} className="text-[9px] uppercase tracking-widest text-brand-gold font-bold flex items-center gap-1 cursor-pointer hover:underline">
                      Detalle <ChevronRight size={12} />
                    </button>
                  </div>
                  <div className="space-y-2.5">
                    {services.length === 0 ? (
                      <div className="flex items-center gap-2 px-3 py-4 text-brand-ink/40"><Loader2 size={14} className="animate-spin" /> <span className="text-xs">Verificando servicios...</span></div>
                    ) : services.map((svc, i) => (
                      <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-brand-bone/50 transition-colors">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${svc.status === 'operational' ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`} />
                        <span className="text-xs text-brand-ink flex-1">{svc.name}</span>
                        <span className={`text-[9px] font-bold uppercase tracking-wider ${svc.status === 'operational' ? 'text-green-600' : 'text-red-600'}`}>
                          {svc.status === 'operational' ? 'OK' : 'Caído'}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 pt-4 border-t border-brand-sand/20">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-brand-ink/40">Servicios operativos</span>
                      <span className="text-sm font-serif text-brand-ink">{services.length > 0 ? `${operationalServices}/${services.length}` : '—'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* ═══ Costos de Operación (gasto real: Gemini, correos, etc.) ═══ */}
              <div className="editorial-card !bg-white border border-brand-sand/20 mt-6">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h3 className="text-lg font-serif text-brand-ink">Costos de Operación</h3>
                    <p className="text-[10px] text-brand-ink/40">Gasto real por servicio · datos en vivo</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-serif text-brand-ink">{costs ? fmtCostMxn(costs.totalCostMxn) : '—'}<span className="text-xs text-brand-ink/40 ml-1">MXN</span></p>
                    <p className="text-[9px] uppercase tracking-widest text-brand-ink/30 font-bold">Total plataforma</p>
                  </div>
                </div>
                {costs === null ? (
                  <div className="flex items-center justify-center py-8 gap-2 text-brand-ink/40"><Loader2 size={14} className="animate-spin" /> <span className="text-xs">Cargando costos...</span></div>
                ) : costs.byFeature.length === 0 ? (
                  <p className="text-center text-xs text-brand-ink/40 py-8">Aún no hay consumo registrado.</p>
                ) : (
                  <div className="space-y-2.5">
                    {costs.byFeature.map(f => {
                      const pct = costs.totalCostMxn > 0 ? (f.estimatedCostMxn / costs.totalCostMxn) * 100 : 0;
                      const isGemini = f.feature.startsWith('GEMINI');
                      return (
                        <div key={f.feature} className="flex items-center gap-4">
                          <div className="w-44 flex-shrink-0">
                            <p className={`text-xs font-medium ${isGemini ? 'text-brand-ink' : 'text-brand-ink/70'}`}>{featureLabel(f.feature)}</p>
                            <p className="text-[9px] text-brand-ink/35">{f.events} evento{f.events !== 1 ? 's' : ''}{f.units > 0 ? ` · ${f.units.toLocaleString('es-MX')} ${isGemini ? 'tokens' : 'u.'}` : ''}</p>
                          </div>
                          <div className="flex-1 h-2 bg-brand-bone rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${isGemini ? 'bg-brand-gold' : 'bg-brand-sand'}`} style={{ width: `${Math.max(pct, f.estimatedCostMxn > 0 ? 4 : 0)}%` }} />
                          </div>
                          <span className="text-xs font-serif text-brand-ink w-20 text-right">{fmtCostMxn(f.estimatedCostMxn)}</span>
                        </div>
                      );
                    })}
                    <p className="text-[9px] text-brand-ink/30 pt-2 border-t border-brand-sand/10">Costos estimados en MXN según el consumo real de cada servicio (tokens de Gemini, correos enviados, almacenamiento). Periodo: histórico completo.</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ═══ CLIENTS TAB ═══ */}
          {adminTab === 'clients' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <div className="flex items-center justify-between mb-5">
                <p className="text-sm text-brand-ink/40">{tenants.length} cliente{tenants.length !== 1 ? 's' : ''} registrado{tenants.length !== 1 ? 's' : ''}</p>
                <button onClick={() => { setShowNewClient(true); setNewClientDone(null); setNewClientError(''); }}
                  className="flex items-center gap-2 bg-brand-ink text-brand-paper text-[10px] uppercase tracking-widest font-bold px-4 py-2.5 rounded-xl hover:bg-brand-ink/80 transition-all cursor-pointer">
                  <Plus size={14} /> Nuevo Cliente
                </button>
              </div>
              <div className="editorial-card !bg-white border border-brand-sand/20 overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-brand-sand/20">
                      {['Estado', 'Cliente', 'RFC', 'Plan', 'Facturas', 'Volumen', 'Usuarios', 'Salud', 'Último Acceso'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-[9px] uppercase tracking-widest text-brand-ink/30 font-bold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tenants.map(t => (
                      <tr key={t.id} onClick={() => setSelectedTenant(selectedTenant?.id === t.id ? null : t)} className="border-b border-brand-sand/10 hover:bg-brand-bone/30 cursor-pointer transition-colors">
                        <td className="px-4 py-3.5">
                          <span className={`inline-flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                            t.status === 'active' ? 'bg-green-50 text-green-700' : t.status === 'trial' ? 'bg-yellow-50 text-yellow-700' : 'bg-red-50 text-red-600'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${t.status === 'active' ? 'bg-green-500' : t.status === 'trial' ? 'bg-yellow-500' : 'bg-red-400'}`} />
                            {t.status === 'active' ? 'Activo' : t.status === 'trial' ? 'Trial' : 'Suspendido'}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-sm font-medium text-brand-ink">{t.name}</td>
                        <td className="px-4 py-3.5 text-xs text-brand-ink/50 font-mono">{t.rfc}</td>
                        <td className="px-4 py-3.5"><span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-brand-bone text-brand-ink/60">{t.plan}</span></td>
                        <td className="px-4 py-3.5 text-sm font-serif text-brand-ink">{t.invoicesProcessed.toLocaleString()}</td>
                        <td className="px-4 py-3.5 text-sm text-brand-ink">${(t.monthlyVolume / 1_000_000).toFixed(1)}M</td>
                        <td className="px-4 py-3.5 text-sm text-brand-ink/60">{t.users}</td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-brand-sand/20 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${t.healthScore >= 90 ? 'bg-green-500' : t.healthScore >= 70 ? 'bg-yellow-500' : 'bg-red-400'}`} style={{ width: `${t.healthScore}%` }} />
                            </div>
                            <span className="text-[10px] text-brand-ink/50">{t.healthScore}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-[10px] text-brand-ink/40">{new Date(t.lastActive).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Selected tenant detail */}
              <AnimatePresence>
                {selectedTenant && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                    <div className="mt-6 editorial-card !bg-white border border-brand-gold/20">
                      <div className="flex items-center justify-between mb-5">
                        <div>
                          <h3 className="text-xl font-serif text-brand-ink">{selectedTenant.name}</h3>
                          <p className="text-[10px] text-brand-ink/40 mt-0.5">{selectedTenant.rfc} · ID: {selectedTenant.id}</p>
                        </div>
                        <button onClick={() => setSelectedTenant(null)} className="p-2 hover:bg-brand-bone rounded-full cursor-pointer"><X size={16} className="text-brand-ink/40" /></button>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                          { label: 'Plan', value: selectedTenant.plan },
                          { label: 'Usuarios', value: selectedTenant.users.toString() },
                          { label: 'Facturas', value: selectedTenant.invoicesProcessed.toLocaleString() },
                          { label: 'Volumen Mensual', value: `$${(selectedTenant.monthlyVolume / 1_000_000).toFixed(1)}M MXN` },
                        ].map((item, i) => (
                          <div key={i} className="bg-brand-bone/50 rounded-xl p-3">
                            <p className="text-[9px] uppercase tracking-widest text-brand-ink/30 font-bold mb-1">{item.label}</p>
                            <p className="text-lg font-serif text-brand-ink">{item.value}</p>
                          </div>
                        ))}
                      </div>

                      {/* Costo de operación de este cliente (gasto real por servicio) */}
                      <div className="mt-5 pt-5 border-t border-brand-sand/15">
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-[9px] uppercase tracking-widest text-brand-ink/30 font-bold">Costo de Operación · este cliente</p>
                          {tenantCost && <p className="text-sm font-serif text-brand-ink">{fmtCostMxn(tenantCost.totalCostMxn)} <span className="text-[10px] text-brand-ink/40">MXN</span></p>}
                        </div>
                        {!tenantCost || tenantCost.byFeature.length === 0 ? (
                          <p className="text-[11px] text-brand-ink/40">Sin consumo registrado para este cliente.</p>
                        ) : (
                          <div className="space-y-2">
                            {tenantCost.byFeature.map(f => {
                              const isGemini = f.feature.startsWith('GEMINI');
                              return (
                                <div key={f.feature} className="flex items-center justify-between text-xs">
                                  <span className="flex items-center gap-2">
                                    <span className={`w-1.5 h-1.5 rounded-full ${isGemini ? 'bg-brand-gold' : 'bg-brand-sand'}`} />
                                    <span className={isGemini ? 'text-brand-ink font-medium' : 'text-brand-ink/70'}>{featureLabel(f.feature)}</span>
                                    <span className="text-[9px] text-brand-ink/30">· {f.events} evento{f.events !== 1 ? 's' : ''}</span>
                                  </span>
                                  <span className="font-serif text-brand-ink">{fmtCostMxn(f.estimatedCostMxn)}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {/* ═══ HEALTH TAB ═══ */}
          {adminTab === 'health' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              {services.length === 0 ? (
                <div className="flex items-center justify-center py-16 gap-2 text-brand-ink/40"><Loader2 size={16} className="animate-spin" /> <span className="text-xs">Verificando servicios en vivo...</span></div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-5">
                    <p className="text-sm text-brand-ink/40">{operationalServices} de {services.length} servicios operativos</p>
                    <span className="text-[9px] uppercase tracking-widest text-brand-gold font-bold">Health-check en vivo</span>
                  </div>
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {services.map((svc, i) => (
                      <motion.div key={i} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                        className={`editorial-card !bg-white border ${svc.status === 'operational' ? 'border-green-200' : 'border-red-200'}`}
                      >
                        <div className="flex items-center gap-3 mb-4">
                          <div className={`w-3 h-3 rounded-full ${svc.status === 'operational' ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`} />
                          <h4 className="text-sm font-medium text-brand-ink flex-1">{svc.name}</h4>
                          <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                            svc.status === 'operational' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                          }`}>
                            {svc.status === 'operational' ? 'Operativo' : 'Caído'}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-brand-bone/50 rounded-lg p-2.5">
                            <p className="text-[8px] uppercase tracking-widest text-brand-ink/30 font-bold">Estado</p>
                            <p className={`text-lg font-serif ${svc.status === 'operational' ? 'text-green-700' : 'text-red-600'}`}>{svc.status === 'operational' ? 'En línea' : 'Caído'}</p>
                          </div>
                          <div className="bg-brand-bone/50 rounded-lg p-2.5">
                            <p className="text-[8px] uppercase tracking-widest text-brand-ink/30 font-bold">Latencia</p>
                            <p className={`text-lg font-serif ${svc.latency === null ? 'text-brand-ink/30' : svc.latency <= 200 ? 'text-green-700' : svc.latency <= 1000 ? 'text-yellow-700' : 'text-red-600'}`}>
                              {svc.latency === null ? '—' : `${svc.latency}ms`}
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                  <p className="text-[10px] text-brand-ink/30 mt-5">Estado verificado en vivo contra el backend (health-check de base de datos, caché y asistente de IA). La latencia es el tiempo de respuesta medido al cargar esta vista.</p>
                </>
              )}
            </motion.div>
          )}

          {/* ═══ ACTIVITY TAB ═══ */}
          {adminTab === 'activity' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <div className="editorial-card !bg-white border border-brand-sand/20">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-lg font-serif text-brand-ink">Registro de Eventos</h3>
                  <span className="text-[9px] uppercase tracking-widest text-brand-gold font-bold">En vivo</span>
                </div>
                {activity === null ? (
                  <div className="flex items-center justify-center py-12 gap-2 text-brand-ink/40">
                    <Loader2 size={16} className="animate-spin" /> <span className="text-xs">Cargando bitácora...</span>
                  </div>
                ) : activity.length === 0 ? (
                  <p className="text-center text-xs text-brand-ink/40 py-12">Aún no hay actividad registrada en la plataforma.</p>
                ) : (
                  <div className="space-y-0">
                    {activity.map(log => {
                      const d = new Date(log.createdAt);
                      const time = d.toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
                      const type = activityType(log.action);
                      return (
                        <div key={log.id} className="flex items-start gap-4 px-3 py-3 border-b border-brand-sand/10 last:border-0">
                          <span className="text-[10px] text-brand-ink/30 font-mono w-24 flex-shrink-0 pt-0.5">{time}</span>
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${
                            type === 'alert' ? 'bg-red-500' : type === 'audit' ? 'bg-blue-500' : 'bg-green-400'
                          }`} />
                          <p className="text-xs text-brand-ink/70 leading-relaxed">
                            <span className="font-medium text-brand-ink">{log.user}</span>
                            <span className="text-brand-ink/40"> · {log.organization}</span> — {activityLabel(log.action)}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ═══ LEADS TAB ═══ */}
          {adminTab === 'leads' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <LeadsAdminPanel />
            </motion.div>
          )}
        </div>
      </main>

      {/* Modal: alta de cliente nuevo (onboarding) */}
      <AnimatePresence>
        {showNewClient && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-brand-ink/40 backdrop-blur-sm flex items-center justify-center p-6"
            onClick={() => setShowNewClient(false)}>
            <motion.div initial={{ scale: 0.96, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 10 }}
              onClick={e => e.stopPropagation()}
              className="bg-brand-paper rounded-3xl w-full max-w-lg p-8 shadow-2xl border border-brand-sand/30 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-2xl font-serif text-brand-ink">Nuevo Cliente</h3>
                  <p className="text-[11px] text-brand-ink/40 mt-0.5">Crea la organización y su primer administrador</p>
                </div>
                <button onClick={() => setShowNewClient(false)} className="p-2 hover:bg-brand-bone rounded-full cursor-pointer"><X size={18} className="text-brand-ink/40" /></button>
              </div>

              {newClientDone ? (
                <div className="text-center py-8">
                  <div className="w-14 h-14 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4"><CheckCircle2 size={28} className="text-green-600" /></div>
                  <p className="text-lg font-serif text-brand-ink">Cliente creado</p>
                  <p className="text-sm text-brand-ink/50 mt-1">Su administrador es <span className="font-medium text-brand-ink">{newClientDone}</span>. Ya puede entrar a su portal corporativo.</p>
                  <button onClick={() => { setShowNewClient(false); setNewClientDone(null); }}
                    className="mt-6 bg-brand-ink text-brand-paper text-[10px] uppercase tracking-widest font-bold px-6 py-2.5 rounded-xl hover:bg-brand-ink/80 transition-all cursor-pointer">Listo</button>
                </div>
              ) : (
                <div className="space-y-4">
                  {[
                    { key: 'name' as const, label: 'Nombre comercial', placeholder: 'Distribuidora del Centro', type: 'text' },
                    { key: 'legalName' as const, label: 'Razón social', placeholder: 'Distribuidora del Centro SA de CV', type: 'text' },
                    { key: 'rfc' as const, label: 'RFC', placeholder: 'DCE240101AA1', type: 'text' },
                    { key: 'adminName' as const, label: 'Nombre del administrador', placeholder: 'María López', type: 'text' },
                    { key: 'adminEmail' as const, label: 'Correo del administrador', placeholder: 'maria@distribuidora.mx', type: 'email' },
                  ].map(f => (
                    <div key={f.key}>
                      <label className="text-[9px] uppercase tracking-widest text-brand-ink/40 font-bold">{f.label}</label>
                      <input type={f.type} value={newClient[f.key]}
                        onChange={e => setNewClient(p => ({ ...p, [f.key]: e.target.value }))}
                        placeholder={f.placeholder}
                        className="w-full mt-1.5 bg-white border border-brand-sand/30 rounded-xl px-3.5 py-2.5 text-sm text-brand-ink outline-none focus:border-brand-gold/50 transition-colors" />
                    </div>
                  ))}
                  <div>
                    <label className="text-[9px] uppercase tracking-widest text-brand-ink/40 font-bold">Plan</label>
                    <div className="flex gap-2 mt-1.5">
                      {(['FREE', 'PRO', 'ENTERPRISE'] as const).map(p => (
                        <button key={p} onClick={() => setNewClient(prev => ({ ...prev, plan: p }))}
                          className={`flex-1 text-[10px] uppercase tracking-wider font-bold py-2.5 rounded-xl border transition-all cursor-pointer ${
                            newClient.plan === p ? 'bg-brand-ink text-brand-paper border-brand-ink' : 'bg-white text-brand-ink/50 border-brand-sand/30 hover:border-brand-gold/40'
                          }`}>{p === 'PRO' ? 'Business' : p === 'ENTERPRISE' ? 'Enterprise' : 'Starter'}</button>
                      ))}
                    </div>
                  </div>

                  {newClientError && <p className="text-[11px] text-red-500 bg-red-50 rounded-lg px-3 py-2">{newClientError}</p>}

                  <button onClick={handleCreateClient} disabled={creatingClient}
                    className="w-full mt-2 bg-brand-ink text-brand-paper text-[10px] uppercase tracking-widest font-bold py-3 rounded-xl hover:bg-brand-ink/80 transition-all cursor-pointer disabled:opacity-40 flex items-center justify-center gap-2">
                    {creatingClient ? <><Loader2 size={14} className="animate-spin" /> Creando...</> : <>Crear Cliente</>}
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

