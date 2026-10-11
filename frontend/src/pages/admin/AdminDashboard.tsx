import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, LogOut, LogIn, ChevronRight, FileText, X, Plus, ChevronLeft, Activity, Loader2, DollarSign, Crown, Users, Server, Gauge, Handshake, HeartPulse } from 'lucide-react';
import type { User as FirebaseUser } from 'firebase/auth';
import { api, isRealId, type AdminOrg, type AdminActivity, type AdminCostByFeature, type AdminOrgCost, type AdminCollectionEngineHealth, type AdminRemindersCost, type AdminLoginEvent, type AdminHealthHistory } from '../../services/apiClient.ts';
import { NotificationBell } from '../../components/NotificationBell.tsx';
import { SidebarLink } from '../../components/SidebarLink.tsx';
import { LeadsAdminPanel } from '../../features/admin/LeadsAdminPanel.tsx';

// ─── Admin Dashboard (Royáltica CEO Portal) ──────────────────────────────────
const EMPTY_SEATS = { admin: 0, supervisor: 0, agente: 0 };
const EMPTY_SEAT_LIMITS = { admin: null, supervisor: null, agente: null };
const MOCK_TENANTS = [
  { id: 'T-001', name: 'Grupo Industrial Monterrey SA de CV', rfc: 'GIM901215AB3', plan: 'Enterprise', status: 'active' as const, invoicesProcessed: 1247, customerSince: '2024-02-03T08:30:00', monthlyVolume: 18_500_000, users: 12, healthScore: 97, seatPackage: null, product: null, seats: EMPTY_SEATS, seatLimits: EMPTY_SEAT_LIMITS, remindersSent: 312, remindersCostMxn: 18.42, lastLoginAt: '2026-10-09T14:20:00', totalCostMxn: 142.10, revenueMxn: 4999, marginMxn: 4856.90, subscriptionStatus: 'active' },
  { id: 'T-002', name: 'Distribuidora Nacional MX', rfc: 'DNM880430QR7', plan: 'Business', status: 'active' as const, invoicesProcessed: 583, customerSince: '2024-09-18T17:45:00', monthlyVolume: 6_200_000, users: 5, healthScore: 84, seatPackage: null, product: null, seats: EMPTY_SEATS, seatLimits: EMPTY_SEAT_LIMITS, remindersSent: 97, remindersCostMxn: 5.73, lastLoginAt: '2026-10-08T09:05:00', totalCostMxn: 61.20, revenueMxn: 1499, marginMxn: 1437.80, subscriptionStatus: 'active' },
  { id: 'T-003', name: 'Alimentos del Pacífico SA', rfc: 'APS950612KL0', plan: 'Starter', status: 'trial' as const, invoicesProcessed: 42, customerSince: '2026-05-20T12:00:00', monthlyVolume: 890_000, users: 2, healthScore: 71, seatPackage: null, product: null, seats: EMPTY_SEATS, seatLimits: EMPTY_SEAT_LIMITS, remindersSent: 6, remindersCostMxn: 0.35, lastLoginAt: null, totalCostMxn: 4.10, revenueMxn: 0, marginMxn: -4.10, subscriptionStatus: 'trialing' },
  { id: 'T-004', name: 'Constructora Vanguardia', rfc: 'CVA070823MN5', plan: 'Enterprise', status: 'active' as const, invoicesProcessed: 2104, customerSince: '2023-11-02T09:15:00', monthlyVolume: 32_400_000, users: 18, healthScore: 93, seatPackage: null, product: null, seats: EMPTY_SEATS, seatLimits: EMPTY_SEAT_LIMITS, remindersSent: 540, remindersCostMxn: 31.86, lastLoginAt: '2026-10-10T07:40:00', totalCostMxn: 238.50, revenueMxn: 4999, marginMxn: 4760.50, subscriptionStatus: 'active' },
  { id: 'T-005', name: 'Farmacéuticos del Bajío', rfc: 'FDB110517PQ2', plan: 'Business', status: 'suspended' as const, invoicesProcessed: 0, customerSince: '2025-01-14T10:00:00', monthlyVolume: 0, users: 7, healthScore: 0, seatPackage: null, product: null, seats: EMPTY_SEATS, seatLimits: EMPTY_SEAT_LIMITS, remindersSent: 0, remindersCostMxn: 0, lastLoginAt: '2026-05-30T16:00:00', totalCostMxn: 0, revenueMxn: 0, marginMxn: 0, subscriptionStatus: 'canceled' },
];

/** Forma de un cliente en el panel admin (mock y real comparten esta forma). */
type AdminTenant = {
  id: string; name: string; rfc: string; plan: string;
  status: 'active' | 'trial' | 'suspended';
  // Fecha de alta del cliente ("antigüedad", pedida por Paolo) — NO es
  // "último acceso": no hay tracking de sesiones/último login todavía.
  invoicesProcessed: number; customerSince: string; monthlyVolume: number;
  users: number; healthScore: number;
  // Recordatorios de cobranza enviados (histórico) — pedido por Paolo.
  remindersSent: number;
  // Costo SOLO de recordatorios, aislado del resto de correos/WhatsApp.
  remindersCostMxn: number;
  // Último login REAL de cualquier usuario de la organización (null = nadie ha entrado).
  lastLoginAt: string | null;
  // Costo operativo TOTAL (todos los features, no solo recordatorios).
  totalCostMxn: number;
  // Ingreso mensual aproximado según el plan (NO es el monto real de Stripe).
  revenueMxn: number;
  // revenueMxn - totalCostMxn.
  marginMxn: number;
  subscriptionStatus: string | null;
  // ── Licencias de CxC (punto 5 de José: supervisión multi-cliente) ──
  seatPackage: string | null;
  product: string | null;
  seats: { admin: number; supervisor: number; agente: number };
  seatLimits: { admin: number | null; supervisor: number | null; agente: number | null };
};

/** Mapea una organización real del backend al shape que usa el panel. */
const mapOrgToTenant = (o: AdminOrg): AdminTenant => ({
  id: o.id,
  name: o.name,
  rfc: o.rfc,
  plan: o.plan === 'ENTERPRISE' ? 'Enterprise' : o.plan === 'PRO' ? 'Business' : 'Starter',
  status: o.deleted || !o.isActive ? 'suspended' : 'active',
  invoicesProcessed: o.counts.invoices,
  customerSince: o.createdAt,
  monthlyVolume: o.amount,
  users: o.counts.users,
  // "Salud" real, calculada en backend a partir de señales reales (pagos
  // fallidos, facturas vencidas, inactividad) — ver common/health-score.ts.
  healthScore: o.healthScore,
  remindersSent: o.remindersSent,
  remindersCostMxn: o.remindersCostMxn,
  lastLoginAt: o.lastLoginAt,
  totalCostMxn: o.totalCostMxn,
  revenueMxn: o.revenueMxn,
  marginMxn: o.marginMxn,
  subscriptionStatus: o.subscriptionStatus,
  seatPackage: o.seatPackage ?? null,
  product: o.product ?? null,
  seats: o.seats ?? { admin: 0, supervisor: 0, agente: 0 },
  seatLimits: o.seatLimits ?? { admin: null, supervisor: null, agente: null },
});

const SEAT_PACKAGE_LABELS: Record<string, string> = {
  PAQUETE_1: 'Paquete 1 (3/3/3)',
  PAQUETE_2: 'Paquete 2 (4/4/4)',
  PAQUETE_3: 'Paquete 3 (5/5/5)',
};

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
  LOGIN_SUCCESS: 'Inició sesión',
  LOGIN_2FA_PENDING: 'Inició sesión (pendiente 2FA)',
  LOGIN_2FA_COMPLETED: 'Completó verificación 2FA',
  SUPERADMIN_IMPERSONATION_STARTED: 'Entró como este cliente (superadmin)',
  COLLECTION_SEQUENCE_STEP_SENT: 'Envió un recordatorio de cobranza',
  COLLECTION_SEQUENCE_STEP_SKIPPED: 'Omitió un paso de cobranza',
  COLLECTION_SEQUENCE_ESCALATED: 'Escaló cobranza a un humano',
  SUPERADMIN_ORG_UPDATED: 'Superadmin cambió plan/paquete/producto de un cliente',
  SUPERADMIN_ORG_DELETED: 'Superadmin eliminó (soft-delete) un cliente',
  SUPERADMIN_ALERT_SENT: 'Se mandó una alerta crítica proactiva al equipo',
};
const activityLabel = (action: string): string =>
  ACTIVITY_LABELS[action] ?? action.replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase());
/** Color del punto según el tipo de acción (alerta/auditoría/normal). */
const activityType = (action: string): 'alert' | 'audit' | 'info' => {
  if (/FAILED|BLOCKED|REJECT|SUSPEND|SUPERADMIN_ALERT_SENT/.test(action)) return 'alert';
  if (/AUDIT|^SUPERADMIN_ORG_/.test(action)) return 'audit';
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

export function AdminDashboard({ user, onLogout, onBackToRole, onImpersonate }: { user: FirebaseUser, onLogout: () => void, onBackToRole: () => void, onImpersonate?: (orgId: string) => Promise<void> }) {
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

  // Búsqueda y filtros de la tabla de Clientes (pedido por Paolo/José).
  const [clientSearch, setClientSearch] = useState('');
  const [clientPlanFilter, setClientPlanFilter] = useState<'all' | string>('all');
  const [clientStatusFilter, setClientStatusFilter] = useState<'all' | AdminTenant['status']>('all');

  // Clientes reales del backend (/admin/organizations). Arranca con los mocks
  // como fallback; si la carga falla, la consola sigue mostrando algo.
  const [tenants, setTenants] = useState<AdminTenant[]>(MOCK_TENANTS);
  const filteredTenants = React.useMemo(() => {
    const q = clientSearch.trim().toLowerCase();
    return tenants.filter(t =>
      (clientPlanFilter === 'all' || t.plan === clientPlanFilter) &&
      (clientStatusFilter === 'all' || t.status === clientStatusFilter) &&
      (q === '' || t.name.toLowerCase().includes(q) || t.rfc.toLowerCase().includes(q)),
    );
  }, [tenants, clientSearch, clientPlanFilter, clientStatusFilter]);
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

  // Historial de accesos (quién entró y cuándo) — vista filtrada aparte de la
  // bitácora general, pedida explícitamente por Paolo.
  const [activityView, setActivityView] = useState<'all' | 'access'>('all');
  const [loginHistory, setLoginHistory] = useState<AdminLoginEvent[] | null>(null);
  useEffect(() => {
    if (adminTab !== 'activity' || activityView !== 'access' || loginHistory !== null) return;
    api.adminLoginHistory(60).then(setLoginHistory).catch(() => setLoginHistory([]));
  }, [adminTab, activityView, loginHistory]);

  // Costos de operación reales (gasto de Gemini, correos, etc.) — /admin/costs/by-feature.
  const [costs, setCosts] = useState<AdminCostByFeature | null>(null);
  useEffect(() => {
    api.adminCostsByFeature().then(setCosts).catch(() => setCosts({ totalCostMxn: 0, byFeature: [] }));
  }, []);

  // Costo aislado de recordatorios de cobranza (separado del resto de
  // correos/WhatsApp) — pedido explícito de Paolo.
  const [remindersCost, setRemindersCost] = useState<AdminRemindersCost | null>(null);
  useEffect(() => {
    api.adminRemindersCostGlobal().then(setRemindersCost).catch(() => setRemindersCost(null));
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

  // Salud específica del agente de recordatorios de cobranza — distinto del
  // health-check general: aquí se responde "¿se quedó trabado o falló la
  // última corrida?", pedido explícito de Paolo.
  const [engineHealth, setEngineHealth] = useState<AdminCollectionEngineHealth | null>(null);
  useEffect(() => {
    api.adminCollectionEngineHealth().then(setEngineHealth).catch(() => setEngineHealth(null));
  }, []);

  // Histórico REAL de latencia/uptime (snapshots cada 10 min desde el
  // backend) — antes "Salud del Sistema" solo medía en el momento de abrir
  // el dashboard, sin ninguna tendencia ni % de uptime a lo largo del tiempo.
  const [healthHistory, setHealthHistory] = useState<AdminHealthHistory | null>(null);
  useEffect(() => {
    api.adminHealthHistory(24).then(setHealthHistory).catch(() => setHealthHistory(null));
  }, []);

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

  // Asignar paquete de licencias / producto (CXP|CXC) a un cliente — punto 5
  // de José: supervisión multi-cliente desde el panel superadmin.
  const [savingSeat, setSavingSeat] = useState(false);
  const assignSeatPackage = React.useCallback(async (orgId: string, seatPackage: 'PAQUETE_1' | 'PAQUETE_2' | 'PAQUETE_3') => {
    setSavingSeat(true);
    try {
      await api.adminUpdateOrganization(orgId, { seatPackage });
      await loadTenants();
      setSelectedTenant(prev => {
        if (!prev || prev.id !== orgId) return prev;
        const refreshed = tenants.find(t => t.id === orgId);
        return refreshed ?? prev;
      });
    } finally {
      setSavingSeat(false);
    }
  }, [loadTenants, tenants]);
  const assignProduct = React.useCallback(async (orgId: string, product: 'CXP' | 'CXC') => {
    setSavingSeat(true);
    try {
      await api.adminUpdateOrganization(orgId, { product });
      await loadTenants();
    } finally {
      setSavingSeat(false);
    }
  }, [loadTenants]);

  // "Entrar como este cliente" — punto 7 de José: el SUPERADMIN entra al
  // portal real del admin de la organización (queda auditado en backend).
  const [impersonatingOrgId, setImpersonatingOrgId] = useState<string | null>(null);
  const [impersonateError, setImpersonateError] = useState<string | null>(null);
  const handleImpersonate = React.useCallback(async (orgId: string) => {
    if (!onImpersonate) return;
    setImpersonatingOrgId(orgId);
    setImpersonateError(null);
    try {
      await onImpersonate(orgId);
    } catch (e) {
      setImpersonateError(e instanceof Error ? e.message : 'No se pudo entrar como este cliente.');
    } finally {
      setImpersonatingOrgId(null);
    }
  }, [onImpersonate]);

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

              {/* Accesos directos — saltar a una acción común sin navegar por pestañas */}
              <div className="flex flex-wrap items-center gap-3 mb-10">
                {[
                  { label: 'Nuevo Cliente', icon: <Plus size={14} />, onClick: () => { setAdminTab('clients'); setShowNewClient(true); setNewClientDone(null); setNewClientError(''); } },
                  { label: 'Ver Clientes', icon: <Users size={14} />, onClick: () => setAdminTab('clients') },
                  { label: 'Salud del Sistema', icon: <Server size={14} />, onClick: () => setAdminTab('health') },
                  { label: 'Historial de Accesos', icon: <LogIn size={14} />, onClick: () => { setAdminTab('activity'); setActivityView('access'); } },
                  { label: 'Registro de Eventos', icon: <Activity size={14} />, onClick: () => { setAdminTab('activity'); setActivityView('all'); } },
                ].map((shortcut, i) => (
                  <button key={i} onClick={shortcut.onClick}
                    className="flex items-center gap-2 bg-white border border-brand-sand/20 text-brand-ink text-[10px] uppercase tracking-widest font-bold px-4 py-2.5 rounded-xl hover:border-brand-gold/40 hover:bg-brand-bone/40 transition-all cursor-pointer">
                    {shortcut.icon} {shortcut.label}
                  </button>
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
                    {engineHealth && (
                      <div className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-brand-bone/50 transition-colors">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${engineHealth.status === 'ok' ? 'bg-green-500' : engineHealth.status === 'unknown' ? 'bg-brand-sand/40' : 'bg-red-500 animate-pulse'}`} />
                        <span className="text-xs text-brand-ink flex-1">Agente de Recordatorios</span>
                        <span className={`text-[9px] font-bold uppercase tracking-wider ${engineHealth.status === 'ok' ? 'text-green-600' : engineHealth.status === 'unknown' ? 'text-brand-ink/40' : 'text-red-600'}`}>
                          {engineHealth.status === 'ok' ? 'OK' : engineHealth.status === 'stuck' ? 'Trabado' : engineHealth.status === 'failed' ? 'Falló' : 'Sin datos'}
                        </span>
                      </div>
                    )}
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
                    {remindersCost && remindersCost.events > 0 && (
                      <div className="flex items-center justify-between bg-brand-bone/50 rounded-xl px-4 py-2.5 mt-1">
                        <div>
                          <p className="text-xs font-medium text-brand-ink">Solo Recordatorios de Cobranza</p>
                          <p className="text-[9px] text-brand-ink/35">{remindersCost.events} enviado{remindersCost.events !== 1 ? 's' : ''} · incluido dentro de Correos + WhatsApp arriba, aislado aquí</p>
                        </div>
                        <span className="text-sm font-serif text-brand-ink">{fmtCostMxn(remindersCost.estimatedCostMxn)} <span className="text-[10px] text-brand-ink/40">MXN</span></span>
                      </div>
                    )}
                    {tenants.length > 0 && (() => {
                      const totalRevenue = tenants.reduce((sum, t) => sum + t.revenueMxn, 0);
                      const totalCost = tenants.reduce((sum, t) => sum + t.totalCostMxn, 0);
                      const totalMargin = totalRevenue - totalCost;
                      return (
                        <div className="flex items-center justify-between bg-brand-bone/50 rounded-xl px-4 py-2.5 mt-1">
                          <div>
                            <p className="text-xs font-medium text-brand-ink">Margen Estimado de la Plataforma</p>
                            <p className="text-[9px] text-brand-ink/35">Ingreso aproximado por plan ({fmtCostMxn(totalRevenue)} MXN) − costo operativo total ({fmtCostMxn(totalCost)} MXN) · aproximación, no es el estado de cuenta real de Stripe</p>
                          </div>
                          <span className={`text-sm font-serif ${totalMargin >= 0 ? 'text-green-700' : 'text-red-600'}`}>{totalMargin >= 0 ? '+' : ''}{fmtCostMxn(totalMargin)} <span className="text-[10px] text-brand-ink/40">MXN</span></span>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ═══ CLIENTS TAB ═══ */}
          {adminTab === 'clients' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <div className="flex items-center justify-between mb-5">
                <p className="text-sm text-brand-ink/40">
                  {filteredTenants.length === tenants.length
                    ? `${filteredTenants.length} cliente${filteredTenants.length !== 1 ? 's' : ''} registrado${filteredTenants.length !== 1 ? 's' : ''}`
                    : `${filteredTenants.length} de ${tenants.length} cliente${tenants.length !== 1 ? 's' : ''}`}
                </p>
                <button onClick={() => { setShowNewClient(true); setNewClientDone(null); setNewClientError(''); }}
                  className="flex items-center gap-2 bg-brand-ink text-brand-paper text-[10px] uppercase tracking-widest font-bold px-4 py-2.5 rounded-xl hover:bg-brand-ink/80 transition-all cursor-pointer">
                  <Plus size={14} /> Nuevo Cliente
                </button>
              </div>

              {/* Búsqueda y filtros */}
              <div className="flex items-center gap-3 mb-4 flex-wrap">
                <input
                  type="text"
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  placeholder="Buscar por nombre o RFC..."
                  className="flex-1 min-w-[200px] text-sm bg-white border border-brand-sand/20 rounded-xl px-4 py-2.5 placeholder:text-brand-ink/30 focus:outline-none focus:border-brand-gold/40"
                />
                <select
                  value={clientPlanFilter}
                  onChange={(e) => setClientPlanFilter(e.target.value)}
                  className="text-xs bg-white border border-brand-sand/20 rounded-xl px-3 py-2.5 text-brand-ink/70 focus:outline-none focus:border-brand-gold/40 cursor-pointer"
                >
                  <option value="all">Todos los planes</option>
                  <option value="Starter">Starter</option>
                  <option value="Business">Business</option>
                  <option value="Enterprise">Enterprise</option>
                </select>
                <select
                  value={clientStatusFilter}
                  onChange={(e) => setClientStatusFilter(e.target.value as 'all' | AdminTenant['status'])}
                  className="text-xs bg-white border border-brand-sand/20 rounded-xl px-3 py-2.5 text-brand-ink/70 focus:outline-none focus:border-brand-gold/40 cursor-pointer"
                >
                  <option value="all">Todos los estados</option>
                  <option value="active">Activo</option>
                  <option value="trial">Trial</option>
                  <option value="suspended">Suspendido</option>
                </select>
                {(clientSearch || clientPlanFilter !== 'all' || clientStatusFilter !== 'all') && (
                  <button
                    onClick={() => { setClientSearch(''); setClientPlanFilter('all'); setClientStatusFilter('all'); }}
                    className="text-[10px] uppercase tracking-widest font-bold text-brand-ink/40 hover:text-brand-ink px-2 cursor-pointer"
                  >
                    Limpiar
                  </button>
                )}
              </div>
              <div className="editorial-card !bg-white border border-brand-sand/20 overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-brand-sand/20">
                      {['Estado', 'Cliente', 'RFC', 'Plan', 'Facturas', 'Volumen', 'Usuarios', 'Salud', 'Recordatorios', 'Margen', 'Último Acceso', 'Cliente Desde'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-[9px] uppercase tracking-widest text-brand-ink/30 font-bold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTenants.map(t => (
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
                        <td className="px-4 py-3.5 text-sm text-brand-ink/60">{t.remindersSent.toLocaleString('es-MX')}</td>
                        <td className={`px-4 py-3.5 text-sm font-medium ${t.marginMxn >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                          {t.marginMxn >= 0 ? '+' : ''}{fmtCostMxn(t.marginMxn)}
                        </td>
                        <td className="px-4 py-3.5 text-[10px] text-brand-ink/40">{t.lastLoginAt ? new Date(t.lastLoginAt).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '— nunca —'}</td>
                        <td className="px-4 py-3.5 text-[10px] text-brand-ink/40">{new Date(t.customerSince).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
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
                        <div className="flex items-center gap-2">
                          {onImpersonate && (
                            <button
                              onClick={() => handleImpersonate(selectedTenant.id)}
                              disabled={impersonatingOrgId === selectedTenant.id}
                              className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-3 py-2 rounded-lg bg-brand-ink text-brand-paper hover:bg-brand-ink/90 transition-all cursor-pointer disabled:opacity-50"
                            >
                              {impersonatingOrgId === selectedTenant.id ? <Loader2 size={13} className="animate-spin" /> : <LogIn size={13} />}
                              Entrar como este cliente
                            </button>
                          )}
                          <button onClick={() => setSelectedTenant(null)} className="p-2 hover:bg-brand-bone rounded-full cursor-pointer"><X size={16} className="text-brand-ink/40" /></button>
                        </div>
                      </div>
                      {impersonateError && (
                        <p className="text-[11px] text-red-600 -mt-3 mb-4">{impersonateError}</p>
                      )}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                          { label: 'Plan', value: selectedTenant.plan },
                          { label: 'Usuarios', value: selectedTenant.users.toString() },
                          { label: 'Facturas', value: selectedTenant.invoicesProcessed.toLocaleString() },
                          { label: 'Volumen Mensual', value: `$${(selectedTenant.monthlyVolume / 1_000_000).toFixed(1)}M MXN` },
                          { label: 'Recordatorios Enviados', value: selectedTenant.remindersSent.toLocaleString('es-MX') },
                          { label: 'Costo de Recordatorios', value: `${fmtCostMxn(selectedTenant.remindersCostMxn)} MXN` },
                          { label: 'Costo Operativo Total', value: `${fmtCostMxn(selectedTenant.totalCostMxn)} MXN` },
                          { label: 'Ingreso Estimado', value: `${fmtCostMxn(selectedTenant.revenueMxn)} MXN/mes` },
                          { label: 'Margen Estimado', value: `${selectedTenant.marginMxn >= 0 ? '+' : ''}${fmtCostMxn(selectedTenant.marginMxn)} MXN` },
                          { label: 'Último Acceso', value: selectedTenant.lastLoginAt ? new Date(selectedTenant.lastLoginAt).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Nunca' },
                          { label: 'Cliente Desde', value: new Date(selectedTenant.customerSince).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) },
                        ].map((item, i) => (
                          <div key={i} className="bg-brand-bone/50 rounded-xl p-3">
                            <p className="text-[9px] uppercase tracking-widest text-brand-ink/30 font-bold mb-1">{item.label}</p>
                            <p className="text-lg font-serif text-brand-ink">{item.value}</p>
                          </div>
                        ))}
                      </div>

                      {/* Licencias de CxC: paquete, producto y uso de subasientos */}
                      <div className="mt-5 pt-5 border-t border-brand-sand/15">
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-[9px] uppercase tracking-widest text-brand-ink/30 font-bold">Licencias de Cobranza (CxC)</p>
                          {selectedTenant.seatPackage && (
                            <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-brand-bone text-brand-ink/60">
                              {SEAT_PACKAGE_LABELS[selectedTenant.seatPackage] ?? selectedTenant.seatPackage}
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-3 gap-3 mb-4">
                          {(['admin', 'supervisor', 'agente'] as const).map(bucket => {
                            const used = selectedTenant.seats[bucket];
                            const limit = selectedTenant.seatLimits[bucket];
                            const pct = limit ? Math.min(100, (used / limit) * 100) : 0;
                            return (
                              <div key={bucket} className="bg-brand-bone/50 rounded-xl p-3">
                                <p className="text-[8px] uppercase tracking-widest text-brand-ink/30 font-bold mb-1">{bucket === 'admin' ? 'Administrador' : bucket === 'supervisor' ? 'Supervisor' : 'Agente'}</p>
                                <p className="text-lg font-serif text-brand-ink">{used}<span className="text-xs text-brand-ink/40">/{limit ?? '∞'}</span></p>
                                {limit !== null && (
                                  <div className="w-full h-1.5 bg-brand-sand/20 rounded-full overflow-hidden mt-1.5">
                                    <div className={`h-full rounded-full ${pct >= 100 ? 'bg-red-500' : pct >= 75 ? 'bg-yellow-500' : 'bg-green-500'}`} style={{ width: `${pct}%` }} />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[9px] uppercase tracking-widest text-brand-ink/30 font-bold mr-1">Paquete:</span>
                          {(['PAQUETE_1', 'PAQUETE_2', 'PAQUETE_3'] as const).map(pkg => (
                            <button key={pkg} disabled={savingSeat} onClick={() => assignSeatPackage(selectedTenant.id, pkg)}
                              className={`text-[9px] uppercase tracking-wider font-bold px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer disabled:opacity-40 ${
                                selectedTenant.seatPackage === pkg ? 'bg-brand-ink text-brand-paper border-brand-ink' : 'bg-white text-brand-ink/50 border-brand-sand/30 hover:border-brand-gold/40'
                              }`}>{SEAT_PACKAGE_LABELS[pkg]}</button>
                          ))}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-3">
                          <span className="text-[9px] uppercase tracking-widest text-brand-ink/30 font-bold mr-1">Producto:</span>
                          {(['CXP', 'CXC'] as const).map(prod => (
                            <button key={prod} disabled={savingSeat} onClick={() => assignProduct(selectedTenant.id, prod)}
                              className={`text-[9px] uppercase tracking-wider font-bold px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer disabled:opacity-40 ${
                                selectedTenant.product === prod ? 'bg-brand-ink text-brand-paper border-brand-ink' : 'bg-white text-brand-ink/50 border-brand-sand/30 hover:border-brand-gold/40'
                              }`}>{prod === 'CXP' ? 'Cuentas por Pagar' : 'Cuentas por Cobrar'}</button>
                          ))}
                          {!selectedTenant.product && <span className="text-[9px] text-brand-ink/30">Sin asignar — ve todo (legacy)</span>}
                        </div>
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
              {/* Agente de recordatorios de cobranza — distinto del health-check
                  general: responde "¿se trabó o falló la última corrida?" */}
              <div className={`editorial-card !bg-white border mb-5 ${
                engineHealth === null ? 'border-brand-sand/20' : engineHealth.status === 'ok' ? 'border-green-200' : engineHealth.status === 'unknown' ? 'border-brand-sand/20' : 'border-red-200'
              }`}>
                <div className="flex items-center gap-3 mb-1">
                  <div className={`w-3 h-3 rounded-full ${
                    engineHealth === null ? 'bg-brand-sand/40' : engineHealth.status === 'ok' ? 'bg-green-500' : engineHealth.status === 'unknown' ? 'bg-brand-sand/40' : 'bg-red-500 animate-pulse'
                  }`} />
                  <h4 className="text-sm font-medium text-brand-ink flex-1">Agente de Recordatorios (motor de cobranza)</h4>
                  <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    engineHealth === null ? 'bg-brand-bone text-brand-ink/40' :
                    engineHealth.status === 'ok' ? 'bg-green-50 text-green-700' :
                    engineHealth.status === 'stuck' ? 'bg-red-50 text-red-700' :
                    engineHealth.status === 'failed' ? 'bg-red-50 text-red-700' :
                    'bg-yellow-50 text-yellow-700'
                  }`}>
                    {engineHealth === null ? 'Cargando…' :
                      engineHealth.status === 'ok' ? 'Operativo' :
                      engineHealth.status === 'stuck' ? 'Trabado' :
                      engineHealth.status === 'failed' ? 'Falló' : 'Sin datos aún'}
                  </span>
                </div>
                <p className="text-[11px] text-brand-ink/40 pl-6">
                  {engineHealth === null ? 'Verificando última corrida...' :
                    engineHealth.status === 'unknown' ? 'Todavía no hay registro de ninguna corrida.' :
                    `Última corrida: ${new Date(engineHealth.lastRunAt!).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}` +
                    ` (hace ${engineHealth.hoursSinceLastRun}h)` +
                    (engineHealth.status === 'stuck' ? ' — lleva más de 26h sin correr exitosamente.' :
                     engineHealth.status === 'failed' ? ' — la última corrida falló.' : '.')
                  }
                </p>
              </div>
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

              {/* ═══ Histórico de latencia/uptime (NO es solo el snapshot de arriba) ═══ */}
              <div className="editorial-card !bg-white border border-brand-sand/20 mt-6">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h3 className="text-lg font-serif text-brand-ink">Histórico de Latencia / Uptime</h3>
                    <p className="text-[10px] text-brand-ink/40">Muestras cada 10 minutos · últimas {healthHistory?.windowHours ?? 24}h</p>
                  </div>
                  <span className="text-[9px] uppercase tracking-widest text-brand-ink/30 font-bold">
                    {healthHistory ? `${healthHistory.samples.length} muestra${healthHistory.samples.length !== 1 ? 's' : ''}` : 'Cargando...'}
                  </span>
                </div>
                {healthHistory === null ? (
                  <div className="flex items-center justify-center py-8 gap-2 text-brand-ink/40"><Loader2 size={14} className="animate-spin" /> <span className="text-xs">Cargando histórico...</span></div>
                ) : healthHistory.samples.length === 0 ? (
                  <p className="text-center text-xs text-brand-ink/40 py-8">Aún no hay muestras — el snapshot corre cada 10 minutos, vuelve a revisar en un rato.</p>
                ) : (
                  <div className="grid md:grid-cols-2 gap-5">
                    {([
                      { label: 'Base de Datos (PostgreSQL)', uptime: healthHistory.uptimePct.db, latency: healthHistory.avgLatencyMs.db },
                      { label: 'Caché (Redis)', uptime: healthHistory.uptimePct.redis, latency: healthHistory.avgLatencyMs.redis },
                    ]).map((row) => (
                      <div key={row.label} className="bg-brand-bone/50 rounded-xl p-4">
                        <p className="text-xs font-medium text-brand-ink mb-3">{row.label}</p>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <p className="text-[8px] uppercase tracking-widest text-brand-ink/30 font-bold">Uptime</p>
                            <p className={`text-xl font-serif ${row.uptime >= 99 ? 'text-green-700' : row.uptime >= 95 ? 'text-yellow-700' : 'text-red-600'}`}>{row.uptime}%</p>
                          </div>
                          <div>
                            <p className="text-[8px] uppercase tracking-widest text-brand-ink/30 font-bold">Latencia Promedio</p>
                            <p className="text-xl font-serif text-brand-ink">{row.latency === null ? '—' : `${row.latency}ms`}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-[10px] text-brand-ink/30 mt-5">A diferencia del health-check en vivo de arriba (medido al abrir esta vista), esto es un histórico real: JobsService mide y guarda una muestra cada 10 minutos, y aquí se calcula el % de uptime y la latencia promedio sobre esa ventana de tiempo.</p>
              </div>
            </motion.div>
          )}

          {/* ═══ ACTIVITY TAB ═══ */}
          {adminTab === 'activity' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <div className="editorial-card !bg-white border border-brand-sand/20">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-lg font-serif text-brand-ink">{activityView === 'access' ? 'Historial de Accesos' : 'Registro de Eventos'}</h3>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center bg-brand-bone rounded-lg p-0.5">
                      {([['all', 'Todo'], ['access', 'Solo Accesos']] as const).map(([key, label]) => (
                        <button key={key} onClick={() => setActivityView(key)}
                          className={`text-[9px] uppercase tracking-wider font-bold px-3 py-1.5 rounded-md transition-all cursor-pointer ${
                            activityView === key ? 'bg-brand-ink text-brand-paper' : 'text-brand-ink/50 hover:text-brand-ink'
                          }`}>{label}</button>
                      ))}
                    </div>
                    <span className="text-[9px] uppercase tracking-widest text-brand-gold font-bold">En vivo</span>
                  </div>
                </div>
                {activityView === 'all' ? (
                  activity === null ? (
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
                  )
                ) : (
                  loginHistory === null ? (
                    <div className="flex items-center justify-center py-12 gap-2 text-brand-ink/40">
                      <Loader2 size={16} className="animate-spin" /> <span className="text-xs">Cargando historial de accesos...</span>
                    </div>
                  ) : loginHistory.length === 0 ? (
                    <p className="text-center text-xs text-brand-ink/40 py-12">Aún no hay accesos registrados.</p>
                  ) : (
                    <div className="space-y-0">
                      {loginHistory.map(ev => {
                        const d = new Date(ev.createdAt);
                        const time = d.toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
                        const isImpersonation = ev.action === 'SUPERADMIN_IMPERSONATION_STARTED';
                        return (
                          <div key={ev.id} className="flex items-start gap-4 px-3 py-3 border-b border-brand-sand/10 last:border-0">
                            <span className="text-[10px] text-brand-ink/30 font-mono w-24 flex-shrink-0 pt-0.5">{time}</span>
                            <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${isImpersonation ? 'bg-brand-gold' : 'bg-green-400'}`} />
                            <p className="text-xs text-brand-ink/70 leading-relaxed flex-1">
                              <span className="font-medium text-brand-ink">{ev.user}</span>
                              {ev.userEmail && <span className="text-brand-ink/30"> ({ev.userEmail})</span>}
                              <span className="text-brand-ink/40"> · {ev.organization}</span> — {activityLabel(ev.action)}
                              {ev.ipAddress && <span className="text-[9px] text-brand-ink/30"> · IP {ev.ipAddress}</span>}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )
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

