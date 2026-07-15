import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import ExcelJS from 'exceljs';
import { 
  ShieldCheck, 
  Building2, 
  CheckCircle2, 
  AlertCircle, 
  Zap,
  Cpu,
  LogOut,
  ChevronRight,
  User,
  Search,
  Clock,
  FileText,
  BarChart3,
  CreditCard,
  X,
  Plus,
  FileSearch,
  Send,
  Calendar,
  Layers,
  TrendingDown,
  Timer,
  Settings,
  Database,
  UserPlus,
  UploadCloud,
  Globe,
  FileUp,
  FolderArchive,
  Download,
  FolderSync,
  Paintbrush,
  RotateCcw,
  Save,
  AlertTriangle,
  Mail,
  ChevronLeft,
  Activity,
  BookOpen,
  ListChecks,
  ArrowUpRight,
  Webhook,
  MessageSquare,
  Sparkles,
  Bot,
  FileBarChart,
  Play,
  Loader2,
  Bell,
  TrendingUp,
  Filter,
  StickyNote,
  History,
  Info,
  Ban,
  Paperclip,
  ChevronDown,
  Printer,
  DollarSign,
  Percent,
  Calculator,
  ArrowRightLeft,
  Eye,
  RefreshCw,
  Lock,
  Moon,
  Sun,
  Palette,
  Image,
  Monitor,
  Smartphone,
  Key,
  Shield,
  Wifi,
  WifiOff,
  BarChart2,
  Scale,
  Copy,
  Trash2,
  FolderDown,
  AlertOctagon,
  FileSpreadsheet,
  HelpCircle,
  Crown,
  Users,
  Server,
  Gauge,
  Handshake,
  HeartPulse,
  ThumbsUp,
  ThumbsDown
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line,
  AreaChart,
  Area
} from 'recharts';
import { onAuthStateChanged, User as FirebaseUser, signOut } from 'firebase/auth';
import { auth, signInWithGoogle } from './lib/firebase.ts';
import { MOCK_INVOICES, Invoice, InvoiceChangeLog, MOCK_SUPPLIERS, Supplier } from './types.ts';
import { api, isRealId, type FinancialRatios, type AdminOrg, type AdminActivity, type AdminCostByFeature, type AdminOrgCost, type FactorajeItem, type NotificationItem, type DiotApiResult, type DiotEntryApi, type StatementApi, type ApiUserRow, type CorpFactoraje } from './services/apiClient.ts';
import { auditInvoice, batchAuditInvoices, queryOperations, generateReport, ForensicAuditResult, ChatMessage, OperationsContext, ReportType, queryContabilidad, AccountingContext } from './services/geminiService.ts';
import type { SATVerificationResult } from './services/satService.ts';
import { validateRFC, validateCLABE } from './lib/validators.ts';
import { ErpConnectivityPanel } from './features/corporate/settings/ErpConnectivityPanel.tsx';
import { WebhooksPanel } from './features/corporate/settings/WebhooksPanel.tsx';
import { Sat69bChecker } from './features/corporate/settings/Sat69bChecker.tsx';

const CURRENCY_FORMATTER = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
});

const DEFAULT_BUDGET = 5000000;

// ─── Fiscal Audit Types & DualLoggerService ───────────────────────────────
export interface FiscalAuditEvent {
  id: string;
  provider_id: string;
  provider_name: string;
  event_type: 'REP' | 'DIOT' | 'PAGO_GLOBAL' | 'ERP_SYNC' | 'CFDI_TIMBRADO' | 'PAGO_EFECTUADO';
  cfdi_uuid: string;
  amount: number;
  storage_url: string;
  timestamp: string;
  status: 'Reportado al SAT' | 'Pendiente SAT' | 'Sincronizado ERP' | 'Error';
}

const INITIAL_AUDIT_LEDGER: FiscalAuditEvent[] = [
  { id: 'AUD-001', provider_id: 'PROV-001', provider_name: 'Logística Global SA', event_type: 'CFDI_TIMBRADO', cfdi_uuid: 'A1B2-C3D4-E5F6-G7H8', amount: 85400, storage_url: '/docs/cfdi_A1B2.xml', timestamp: '2024-04-01T09:15:00Z', status: 'Reportado al SAT' },
  { id: 'AUD-002', provider_id: 'PROV-003', provider_name: 'Tech Solutions MX', event_type: 'REP', cfdi_uuid: 'B2C3-D4E5-F6G7-H8I9', amount: 3500, storage_url: '/docs/rep_B2C3.pdf', timestamp: '2024-04-02T11:30:00Z', status: 'Reportado al SAT' },
  { id: 'AUD-003', provider_id: 'PROV-007', provider_name: 'Seguridad Integral MX', event_type: 'PAGO_EFECTUADO', cfdi_uuid: 'C3D4-E5F6-G7H8-I9J0', amount: 45000, storage_url: '/docs/pago_C3D4.pdf', timestamp: '2024-04-18T14:00:00Z', status: 'Sincronizado ERP' },
  { id: 'AUD-004', provider_id: 'PROV-012', provider_name: 'Software & Cloud', event_type: 'DIOT', cfdi_uuid: 'D4E5-F6G7-H8I9-J0K1', amount: 92000, storage_url: '/docs/diot_D4E5.xml', timestamp: '2024-04-25T08:45:00Z', status: 'Pendiente SAT' },
  { id: 'AUD-005', provider_id: 'PROV-002', provider_name: 'Suministros Industriales', event_type: 'ERP_SYNC', cfdi_uuid: 'E5F6-G7H8-I9J0-K1L2', amount: 12000, storage_url: '/docs/erp_E5F6.log', timestamp: '2024-04-25T16:20:00Z', status: 'Sincronizado ERP' },
  { id: 'AUD-006', provider_id: 'PROV-006', provider_name: 'Consultores Asociados', event_type: 'PAGO_GLOBAL', cfdi_uuid: 'F6G7-H8I9-J0K1-L2M3', amount: 25000, storage_url: '/docs/global_F6G7.pdf', timestamp: '2024-04-10T10:00:00Z', status: 'Reportado al SAT' },
];

// Simulated in-memory state for the dual-ledger (real app would use Firestore)
let _auditLedger: FiscalAuditEvent[] = [...INITIAL_AUDIT_LEDGER];
// Provider audit trails keyed by provider_id
let _providerAuditTrails: Record<string, FiscalAuditEvent[]> = {};
INITIAL_AUDIT_LEDGER.forEach(evt => {
  if (!_providerAuditTrails[evt.provider_id]) _providerAuditTrails[evt.provider_id] = [];
  _providerAuditTrails[evt.provider_id].push(evt);
});

// Subscribers so components can react to new events
type AuditSubscriber = (ledger: FiscalAuditEvent[], trails: Record<string, FiscalAuditEvent[]>) => void;
const _auditSubscribers: AuditSubscriber[] = [];

const DualLoggerService = {
  getLedger: () => [..._auditLedger],
  getTrails: () => ({ ..._providerAuditTrails }),
  subscribe: (cb: AuditSubscriber) => { _auditSubscribers.push(cb); },
  unsubscribe: (cb: AuditSubscriber) => {
    const idx = _auditSubscribers.indexOf(cb);
    if (idx !== -1) _auditSubscribers.splice(idx, 1);
  },
  logFiscalEvent: (payload: Omit<FiscalAuditEvent, 'id' | 'timestamp'>) => {
    const newEvent: FiscalAuditEvent = {
      ...payload,
      id: `AUD-${Date.now()}`,
      timestamp: new Date().toISOString(),
    };
    // Transaction A: push to master ledger
    _auditLedger = [newEvent, ..._auditLedger];
    // Transaction B: push to provider_profiles > provider_files_backup
    if (!_providerAuditTrails[payload.provider_id]) _providerAuditTrails[payload.provider_id] = [];
    _providerAuditTrails[payload.provider_id] = [newEvent, ..._providerAuditTrails[payload.provider_id]];
    // Notify all subscribers
    _auditSubscribers.forEach(cb => cb(_auditLedger, _providerAuditTrails));
    return newEvent;
  }
};
// ─────────────────────────────────────────────────────────────────────────────

// ─── Authorizer Service ───────────────────────────────────────────────────────
export interface Authorizer {
  id: string;
  name: string;
  cargo: string;
  email: string;
  type: 'standard' | 'ceo' | 'gerencial';
}

const CEO_KEY = '123';

let _authorizers: Authorizer[] = [
  { id: 'AUTH-CEO', name: 'Director General', cargo: 'CEO', email: 'ceo@royaltica.com', type: 'ceo' },
];

type AuthSubscriber = (list: Authorizer[]) => void;
const _authSubscribers: AuthSubscriber[] = [];
const _notifyAuth = () => _authSubscribers.forEach(cb => cb([..._authorizers]));

const AuthorizerService = {
  getAll: () => [..._authorizers],
  getStandard: () => _authorizers.filter(a => a.type === 'standard'),
  getGerencial: () => _authorizers.filter(a => a.type === 'gerencial'),
  getCeo: () => _authorizers.find(a => a.type === 'ceo') || null,
  subscribe: (cb: AuthSubscriber) => { _authSubscribers.push(cb); },
  unsubscribe: (cb: AuthSubscriber) => {
    const i = _authSubscribers.indexOf(cb);
    if (i !== -1) _authSubscribers.splice(i, 1);
  },
  add: (a: Omit<Authorizer, 'id'>) => {
    const newA = { ...a, id: `AUTH-${Date.now()}` };
    _authorizers = [..._authorizers, newA];
    _notifyAuth();
    AuthorizerService.syncToBackend();
  },
  update: (id: string, updates: Partial<Omit<Authorizer, 'id' | 'type'>>) => {
    _authorizers = _authorizers.map(a => a.id === id ? { ...a, ...updates } : a);
    _notifyAuth();
    AuthorizerService.syncToBackend();
  },
  remove: (id: string) => {
    _authorizers = _authorizers.filter(a => a.id !== id);
    _notifyAuth();
    AuthorizerService.syncToBackend();
  },
  requiresCeoAuth: (amount: number, isGlobalPayment: boolean) => isGlobalPayment && amount >= 200000,

  /**
   * Persiste los autorizadores OPERATIVOS en el backend. Su cantidad define
   * las firmas requeridas para aprobar (0 = aprobación automática). El CEO y
   * los gerenciales no cuentan para esto, así que no se mandan.
   * Fire-and-forget: si el backend no responde, la UI sigue funcionando local.
   */
  syncToBackend: () => {
    const operativos = _authorizers
      .filter(a => a.type === 'standard')
      .map(a => ({ name: a.name, cargo: a.cargo, email: a.email }));
    api
      .updateAuthorizers(operativos)
      .catch(err => console.warn('No se pudieron guardar autorizadores:', err.message));
  },

  /**
   * Carga los autorizadores operativos persistidos en el backend y reemplaza
   * los de tipo 'standard' (conserva CEO/gerenciales locales). Se llama al
   * montar el portal para que la configuración sobreviva a recargas.
   */
  loadFromBackend: async () => {
    try {
      const settings = await api.getSettings();
      const fromApi: Authorizer[] = (settings.authorizers || []).map((a, i) => ({
        id: `AUTH-BK-${i}`,
        name: a.name,
        cargo: a.cargo,
        email: a.email,
        type: 'standard' as const,
      }));
      _authorizers = [..._authorizers.filter(a => a.type !== 'standard'), ...fromApi];
      _notifyAuth();
    } catch (err) {
      console.warn('No se pudieron cargar autorizadores:', (err as Error).message);
    }
  },
};
// ─────────────────────────────────────────────────────────────────────────────

// ─── REP Motor Types ─────────────────────────────────────────────────────────
export interface PPDInvoice {
  id: string;
  provider_id: string;
  provider_name: string;
  cfdi_uuid: string;
  amount: number;
  payment_date: string;
  days_since_payment: number;
  rep_status: 'pending' | 'claimed' | 'received' | 'stamped' | 'risk_extinct';
  rep_xml_url?: string;
  claim_sent_at?: string;
}

// ─── Pagos Globales Types ─────────────────────────────────────────────────────
export interface PaymentAllocation {
  cfdi_uuid: string;
  provider_id: string;
  provider_name: string;
  amount: number;
}
export interface BankTransaction {
  id: string;
  bank_tx_id: string;
  total_amount: number;
  description: string;
  date: string;
  status: 'pending_allocation' | 'pending_approval' | 'confirmed' | 'rejected';
  requires_cfo_approval: boolean;
  cfo_approved?: boolean;
  allocations: PaymentAllocation[];
  logged?: boolean;
}

// ─── In-memory stores ─────────────────────────────────────────────────────────
let _ppdInvoices: PPDInvoice[] = [
  { id: 'PPD-001', provider_id: 'PROV-001', provider_name: 'Logística Global SA',    cfdi_uuid: 'A1B2-C3D4-E5F6', amount: 85400,  payment_date: '2024-04-01', days_since_payment: 9,  rep_status: 'pending' },
  { id: 'PPD-002', provider_id: 'PROV-003', provider_name: 'Tech Solutions MX',      cfdi_uuid: 'B2C3-D4E5-F6G7', amount: 68200,  payment_date: '2024-04-03', days_since_payment: 7,  rep_status: 'claimed', claim_sent_at: '2024-04-08T10:00:00Z' },
  { id: 'PPD-003', provider_id: 'PROV-007', provider_name: 'Seguridad Integral MX',  cfdi_uuid: 'C3D4-E5F6-G7H8', amount: 55000,  payment_date: '2024-04-22', days_since_payment: 2,  rep_status: 'pending' },
  { id: 'PPD-004', provider_id: 'PROV-002', provider_name: 'Suministros Industriales',cfdi_uuid: 'D4E5-F6G7-H8I9', amount: 45000,  payment_date: '2024-04-10', days_since_payment: 0,  rep_status: 'stamped',      rep_xml_url: '/xml/rep_D4E5.xml' },
  { id: 'PPD-005', provider_id: 'PROV-012', provider_name: 'Software & Cloud',       cfdi_uuid: 'E5F6-G7H8-I9J0', amount: 92000,  payment_date: '2024-03-28', days_since_payment: 13, rep_status: 'received' },
  { id: 'PPD-006', provider_id: 'PROV-006', provider_name: 'Consultores Asociados',  cfdi_uuid: 'F6G7-H8I9-J0K1', amount: 45000,  payment_date: '2024-03-20', days_since_payment: 18, rep_status: 'risk_extinct', rep_xml_url: '/xml/rep_F6G7.xml' },
];
let _bankTransactions: BankTransaction[] = [
  {
    id: 'BTX-001', bank_tx_id: 'BANAMEX-2024-04-15-001', total_amount: 312400,
    description: 'Pago global proveedores semana 15', date: '2024-04-15',
    status: 'confirmed', requires_cfo_approval: true, cfo_approved: true, logged: true,
    allocations: [
      { cfdi_uuid: 'FAC-AI-01', provider_id: 'PROV-001', provider_name: 'Logística Global SA',    amount: 157400 },
      { cfdi_uuid: 'FAC-02-C1', provider_id: 'PROV-002', provider_name: 'Suministros Industriales', amount: 98000 },
      { cfdi_uuid: 'FAC-03-C1', provider_id: 'PROV-003', provider_name: 'Tech Solutions MX',       amount: 57000 },
    ]
  },
  {
    id: 'BTX-002', bank_tx_id: 'BBVA-2024-04-18-003', total_amount: 180500,
    description: 'Liquidación semana 16 – servicios', date: '2024-04-18',
    status: 'pending_approval', requires_cfo_approval: false, logged: false,
    allocations: [
      { cfdi_uuid: 'FAC-07-A1', provider_id: 'PROV-007', provider_name: 'Seguridad Integral MX',  amount: 122000 },
      { cfdi_uuid: 'FAC-05-P1', provider_id: 'PROV-005', provider_name: 'Marketing Digital SC',   amount: 58500 },
    ]
  },
  {
    id: 'BTX-003', bank_tx_id: 'SANTANDER-2024-04-20-007', total_amount: 310000,
    description: 'Pago masivo contratos Q2', date: '2024-04-20',
    status: 'pending_approval', requires_cfo_approval: true, cfo_approved: false, logged: false,
    allocations: [
      { cfdi_uuid: 'FAC-06-P1', provider_id: 'PROV-006', provider_name: 'Consultores Asociados',  amount: 155000 },
      { cfdi_uuid: 'FAC-13-P1', provider_id: 'PROV-013', provider_name: 'Construcciones Modernas', amount: 155000 },
    ]
  },
];

type RepSubscriber = (ppd: PPDInvoice[]) => void;
type BankSubscriber = (btx: BankTransaction[]) => void;
const _repSubscribers: RepSubscriber[] = [];
const _bankSubscribers: BankSubscriber[] = [];

const REPMotorService = {
  getInvoices: () => [..._ppdInvoices],
  subscribe: (cb: RepSubscriber) => { _repSubscribers.push(cb); },
  unsubscribe: (cb: RepSubscriber) => { const i = _repSubscribers.indexOf(cb); if (i !== -1) _repSubscribers.splice(i, 1); },
  claimREP: (id: string) => {
    _ppdInvoices = _ppdInvoices.map(inv => inv.id === id ? { ...inv, rep_status: 'claimed' as const, claim_sent_at: new Date().toISOString() } : inv);
    _repSubscribers.forEach(cb => cb([..._ppdInvoices]));
  },
  stampREP: (id: string) => {
    _ppdInvoices = _ppdInvoices.map(inv => {
      if (inv.id !== id) return inv;
      const stamped = { ...inv, rep_status: 'stamped' as const, rep_xml_url: `/xml/rep_${inv.cfdi_uuid.slice(0,4)}.xml` };
      DualLoggerService.logFiscalEvent({ provider_id: inv.provider_id, provider_name: inv.provider_name, event_type: 'REP', cfdi_uuid: inv.cfdi_uuid, amount: inv.amount, storage_url: stamped.rep_xml_url!, status: 'Reportado al SAT' });
      return stamped;
    });
    _repSubscribers.forEach(cb => cb([..._ppdInvoices]));
    setTimeout(() => {
      _ppdInvoices = _ppdInvoices.map(inv => inv.id === id ? { ...inv, rep_status: 'risk_extinct' as const } : inv);
      _repSubscribers.forEach(cb => cb([..._ppdInvoices]));
    }, 2500);
  },
};

const BankTxService = {
  getTransactions: () => [..._bankTransactions],
  subscribe: (cb: BankSubscriber) => { _bankSubscribers.push(cb); },
  unsubscribe: (cb: BankSubscriber) => { const i = _bankSubscribers.indexOf(cb); if (i !== -1) _bankSubscribers.splice(i, 1); },
  approveCFO: (id: string) => {
    _bankTransactions = _bankTransactions.map(t => t.id === id ? { ...t, cfo_approved: true, status: 'pending_allocation' as const } : t);
    _bankSubscribers.forEach(cb => cb([..._bankTransactions]));
  },
  confirmCharge: (id: string) => {
    _bankTransactions = _bankTransactions.map(t => {
      if (t.id !== id) return t;
      const confirmed = { ...t, status: 'confirmed' as const, logged: true };
      t.allocations.forEach(alloc => {
        DualLoggerService.logFiscalEvent({ provider_id: alloc.provider_id, provider_name: alloc.provider_name, event_type: 'PAGO_GLOBAL', cfdi_uuid: alloc.cfdi_uuid, amount: alloc.amount, storage_url: `/docs/pago_global_${t.bank_tx_id}.pdf`, status: 'Reportado al SAT' });
      });
      return confirmed;
    });
    _bankSubscribers.forEach(cb => cb([..._bankTransactions]));
  },
  addTransaction: (tx: Omit<BankTransaction, 'id'>) => {
    const newTx: BankTransaction = { ...tx, id: `BTX-${Date.now()}` };
    _bankTransactions = [newTx, ..._bankTransactions];
    _bankSubscribers.forEach(cb => cb([..._bankTransactions]));
    return newTx;
  }
};
// ─── DIOT Compiler Types (Plantilla SAT 2025) ────────────────────────────────
export interface DiotRow {
  id: string;
  tipo_tercero: '04' | '05' | '15'; // Nacional, Extranjero, Global
  tipo_operacion: '02' | '03' | '06' | '07' | '08' | '85' | '87';
  rfc: string;
  num_id_fiscal?: string;
  nombre_extranjero?: string;
  pais_residencia?: string;
  lugar_jurisdiccion?: string;
  // Valor actos/actividades (campos 8-17)
  valor_frontera_norte: number;
  dev_frontera_norte: number;
  valor_frontera_sur: number;
  dev_frontera_sur: number;
  valor_16: number;
  dev_16: number;
  valor_imp_tangibles_16: number;
  dev_imp_tangibles_16: number;
  valor_imp_intangibles_16: number;
  dev_imp_intangibles_16: number;
  // IVA acreditable (campos 18-27)
  iva_acred_frontera_norte: number;
  iva_acred_prop_frontera_norte: number;
  iva_acred_frontera_sur: number;
  iva_acred_prop_frontera_sur: number;
  iva_acred_16: number;
  iva_acred_prop_16: number;
  iva_acred_imp_tang_16: number;
  iva_acred_prop_imp_tang_16: number;
  iva_acred_imp_intang_16: number;
  iva_acred_prop_imp_intang_16: number;
  // IVA no acreditable (campos 28-46 simplified — 4 groups x 4 fields + 4 extra)
  iva_no_acred: number[];  // 19 values for campos 28-46
  // Campos finales (47-53)
  iva_retenido: number;
  valor_exento_importacion: number;
  valor_exento: number;
  valor_tasa_0: number;
  valor_no_objeto_nacional: number;
  valor_no_objeto_sin_establecimiento: number;
  manifiesto: '01' | '02';
  // Display helpers
  provider_name: string;
}

export interface DiotReport {
  id: string;
  period: string; // "2024-03"
  status: 'draft' | 'generated' | 'submitted';
  generated_date?: string;
  total_providers: number;
  total_base_16: number;
  total_iva_acred: number;
  total_iva_retenido: number;
  rows: DiotRow[];
}

// Helper to build pipe-separated TXT line from DiotRow (54 fields, SAT format)
function diotRowToTxt(row: DiotRow): string {
  const f = [
    row.tipo_tercero,
    row.tipo_operacion,
    row.rfc || '',
    row.num_id_fiscal || '',
    row.nombre_extranjero || '',
    row.pais_residencia || '',
    row.lugar_jurisdiccion || '',
    row.valor_frontera_norte, row.dev_frontera_norte,
    row.valor_frontera_sur, row.dev_frontera_sur,
    row.valor_16, row.dev_16,
    row.valor_imp_tangibles_16, row.dev_imp_tangibles_16,
    row.valor_imp_intangibles_16, row.dev_imp_intangibles_16,
    row.iva_acred_frontera_norte, row.iva_acred_prop_frontera_norte,
    row.iva_acred_frontera_sur, row.iva_acred_prop_frontera_sur,
    row.iva_acred_16, row.iva_acred_prop_16,
    row.iva_acred_imp_tang_16, row.iva_acred_prop_imp_tang_16,
    row.iva_acred_imp_intang_16, row.iva_acred_prop_imp_intang_16,
    ...row.iva_no_acred,
    row.iva_retenido,
    row.valor_exento_importacion,
    row.valor_exento,
    row.valor_tasa_0,
    row.valor_no_objeto_nacional,
    row.valor_no_objeto_sin_establecimiento,
    row.manifiesto,
  ];
  return f.join('|');
}

// ─── Mapeo de datos REALES del backend (DIOT) → filas de la plantilla SAT ───
// El backend agrega las facturas por RFC del tercero y devuelve base + IVA
// acreditable. El resto de campos de la plantilla van en 0 (no aplican para
// operaciones nacionales estándar tomadas del CFDI).
function diotEntriesToRows(entries: DiotEntryApi[]): DiotRow[] {
  return entries.map((e, i) => ({
    id: `${e.rfcTercero}-${i}`,
    tipo_tercero: (e.tipoTercero === '05' ? '05' : e.tipoTercero === '15' ? '15' : '04') as '04' | '05' | '15',
    tipo_operacion: (['02', '03', '06', '07', '08', '85', '87'].includes(e.tipoOperacion) ? e.tipoOperacion : '85') as DiotRow['tipo_operacion'],
    rfc: e.rfcTercero,
    valor_frontera_norte: 0, dev_frontera_norte: 0,
    valor_frontera_sur: 0, dev_frontera_sur: 0,
    valor_16: Math.round(e.baseGravable), dev_16: 0,
    valor_imp_tangibles_16: 0, dev_imp_tangibles_16: 0,
    valor_imp_intangibles_16: 0, dev_imp_intangibles_16: 0,
    iva_acred_frontera_norte: 0, iva_acred_prop_frontera_norte: 0,
    iva_acred_frontera_sur: 0, iva_acred_prop_frontera_sur: 0,
    iva_acred_16: Math.round(e.iva), iva_acred_prop_16: 0,
    iva_acred_imp_tang_16: 0, iva_acred_prop_imp_tang_16: 0,
    iva_acred_imp_intang_16: 0, iva_acred_prop_imp_intang_16: 0,
    iva_no_acred: Array(19).fill(0),
    iva_retenido: 0,
    valor_exento_importacion: 0,
    valor_exento: 0,
    valor_tasa_0: 0,
    valor_no_objeto_nacional: 0,
    valor_no_objeto_sin_establecimiento: 0,
    manifiesto: '01' as const,
    provider_name: e.nombre,
  }));
}

// Convierte el resultado del backend en un DiotReport para la UI/plantilla.
function diotResultToReport(r: DiotApiResult): DiotReport {
  const rows = diotEntriesToRows(r.entries || []);
  const status: DiotReport['status'] = r.submittedAt
    ? 'submitted'
    : rows.length > 0
      ? 'generated'
      : 'draft';
  const genDate = r.generatedAt || r.submittedAt;
  return {
    id: r.id,
    period: r.period,
    status,
    generated_date: genDate ? genDate.split('T')[0] : undefined,
    total_providers: rows.length,
    total_base_16: rows.reduce((s, x) => s + x.valor_16, 0),
    total_iva_acred: rows.reduce((s, x) => s + x.iva_acred_16, 0),
    total_iva_retenido: 0,
    rows,
  };
}

// Generate mock DIOT data from suppliers
function generateMockDiotRows(suppliers: { name: string; rfc: string; id: string }[], month: number): DiotRow[] {
  const seed = month * 7;
  return suppliers.map((s, i) => {
    const base = Math.round((50000 + (i * 23456 + seed * 1111) % 200000));
    const iva16 = Math.round(base * 0.16);
    const ivaRet = i % 3 === 0 ? Math.round(base * 0.04) : 0;
    return {
      id: `DR-${month}-${i}`,
      tipo_tercero: '04' as const,
      tipo_operacion: (i % 2 === 0 ? '03' : '02') as '03' | '02',
      rfc: s.rfc,
      valor_frontera_norte: 0, dev_frontera_norte: 0,
      valor_frontera_sur: 0, dev_frontera_sur: 0,
      valor_16: base, dev_16: 0,
      valor_imp_tangibles_16: 0, dev_imp_tangibles_16: 0,
      valor_imp_intangibles_16: 0, dev_imp_intangibles_16: 0,
      iva_acred_frontera_norte: 0, iva_acred_prop_frontera_norte: 0,
      iva_acred_frontera_sur: 0, iva_acred_prop_frontera_sur: 0,
      iva_acred_16: iva16, iva_acred_prop_16: 0,
      iva_acred_imp_tang_16: 0, iva_acred_prop_imp_tang_16: 0,
      iva_acred_imp_intang_16: 0, iva_acred_prop_imp_intang_16: 0,
      iva_no_acred: Array(19).fill(0),
      iva_retenido: ivaRet,
      valor_exento_importacion: 0,
      valor_exento: i % 4 === 0 ? Math.round(base * 0.1) : 0,
      valor_tasa_0: i % 5 === 0 ? Math.round(base * 0.05) : 0,
      valor_no_objeto_nacional: 0,
      valor_no_objeto_sin_establecimiento: 0,
      manifiesto: '01' as const,
      provider_name: s.name,
    };
  });
}

const DIOT_SUPPLIERS_FOR_MOCK = MOCK_SUPPLIERS.slice(0, 10).map(s => ({ name: s.name, rfc: s.rfc, id: s.id }));

let _diotReports: DiotReport[] = [
  ...[1, 2, 3, 4].map(m => {
    const rows = generateMockDiotRows(DIOT_SUPPLIERS_FOR_MOCK, m);
    const total16 = rows.reduce((s, r) => s + r.valor_16, 0);
    const totalIva = rows.reduce((s, r) => s + r.iva_acred_16, 0);
    const totalRet = rows.reduce((s, r) => s + r.iva_retenido, 0);
    return {
      id: `DIOT-2024-${String(m).padStart(2, '0')}`,
      period: `2024-${String(m).padStart(2, '0')}`,
      status: m <= 2 ? 'submitted' as const : m === 3 ? 'generated' as const : 'draft' as const,
      generated_date: m <= 3 ? `2024-${String(m + 1).padStart(2, '0')}-15` : undefined,
      total_providers: rows.length,
      total_base_16: total16,
      total_iva_acred: totalIva,
      total_iva_retenido: totalRet,
      rows,
    };
  })
];

type DiotSubscriber = (reports: DiotReport[]) => void;
const _diotSubscribers: DiotSubscriber[] = [];

const DiotService = {
  getReports: () => [..._diotReports],
  subscribe: (cb: DiotSubscriber) => { _diotSubscribers.push(cb); },
  unsubscribe: (cb: DiotSubscriber) => { const i = _diotSubscribers.indexOf(cb); if (i !== -1) _diotSubscribers.splice(i, 1); },
  generateLayout: (id: string) => {
    _diotReports = _diotReports.map(rep => {
      if (rep.id !== id) return rep;
      const generated = { ...rep, status: 'generated' as const, generated_date: new Date().toISOString().split('T')[0] };
      generated.rows.forEach(row => {
        DualLoggerService.logFiscalEvent({
          provider_id: row.id, provider_name: row.provider_name, event_type: 'DIOT',
          cfdi_uuid: `DIOT-${rep.period}`, amount: row.valor_16,
          storage_url: `/downloads/DIOT_${rep.period}.txt`, status: 'Reportado al SAT'
        });
      });
      return generated;
    });
    _diotSubscribers.forEach(cb => cb([..._diotReports]));
  }
};

// ─── Webhook & ERP Sync Types ─────────────────────────────────────────────────
export interface WebhookEvent {
  id: string;
  tx_reference: string;
  amount: number;
  date: string;
  bank: string;
  status: 'pending_match' | 'matched_syncing' | 'synced';
  matched_invoice_uuid?: string;
  erp_policy_id?: string;
  provider_id?: string;
  provider_name?: string;
}

let _webhookEvents: WebhookEvent[] = [
  { id: 'WH-001', tx_reference: 'SPEI-20240427-001', amount: 85400, date: '2024-04-27T08:15:00Z', bank: 'BBVA', status: 'pending_match' },
  { id: 'WH-002', tx_reference: 'SPEI-20240427-002', amount: 55000, date: '2024-04-27T09:30:00Z', bank: 'SANTANDER', status: 'pending_match' },
  { id: 'WH-003', tx_reference: 'SPEI-20240426-009', amount: 120000, date: '2024-04-26T14:45:00Z', bank: 'BANAMEX', status: 'synced', matched_invoice_uuid: 'F6G7-H8I9-J0K1', erp_policy_id: 'SAP-POL-89021', provider_id: 'PROV-006', provider_name: 'Consultores Asociados' }
];

type WebhookSubscriber = (events: WebhookEvent[]) => void;
const _webhookSubscribers: WebhookSubscriber[] = [];

const WebhookERPService = {
  getEvents: () => [..._webhookEvents],
  subscribe: (cb: WebhookSubscriber) => { _webhookSubscribers.push(cb); },
  unsubscribe: (cb: WebhookSubscriber) => { const i = _webhookSubscribers.indexOf(cb); if (i !== -1) _webhookSubscribers.splice(i, 1); },
  simulateWebhook: () => {
    const newEvent: WebhookEvent = {
      id: `WH-${Date.now()}`,
      tx_reference: `SPEI-NEW-${Math.floor(Math.random()*10000)}`,
      amount: [45000, 68200, 92000][Math.floor(Math.random() * 3)], // Amounts from _ppdInvoices to force match
      date: new Date().toISOString(),
      bank: ['BANAMEX', 'BBVA', 'SANTANDER'][Math.floor(Math.random() * 3)],
      status: 'pending_match'
    };
    _webhookEvents = [newEvent, ..._webhookEvents];
    _webhookSubscribers.forEach(cb => cb([..._webhookEvents]));
    return newEvent;
  },
  processReconciliation: (id: string) => {
    // 1. Mark as syncing
    _webhookEvents = _webhookEvents.map(evt => evt.id === id ? { ...evt, status: 'matched_syncing' as const } : evt);
    _webhookSubscribers.forEach(cb => cb([..._webhookEvents]));

    // 2. Simulate ERP API Call & 100% Match delay
    setTimeout(() => {
      _webhookEvents = _webhookEvents.map(evt => {
        if (evt.id !== id) return evt;
        // Simulating finding the invoice by amount
        const matchedPPD = _ppdInvoices.find(p => p.amount === evt.amount) || _ppdInvoices[0];
        const policyId = `SAP-POL-${Math.floor(Math.random() * 90000) + 10000}`;
        const syncedEvent = {
          ...evt,
          status: 'synced' as const,
          matched_invoice_uuid: matchedPPD.cfdi_uuid,
          erp_policy_id: policyId,
          provider_id: matchedPPD.provider_id,
          provider_name: matchedPPD.provider_name
        };

        // 3. Inject DualLogger Acuse Dual
        DualLoggerService.logFiscalEvent({
          provider_id: syncedEvent.provider_id!,
          provider_name: syncedEvent.provider_name!,
          event_type: 'ERP_SYNC',
          cfdi_uuid: syncedEvent.matched_invoice_uuid!,
          amount: syncedEvent.amount,
          storage_url: `/erp/poliza_${policyId}.pdf`,
          status: 'Sincronizado ERP'
        });

        return syncedEvent;
      });
      _webhookSubscribers.forEach(cb => cb([..._webhookEvents]));
    }, 1500);
  }
};
// ─────────────────────────────────────────────────────────────────────────────

// ─── Supplier ↔ Corporate Messaging Service ─────────────────────────────────
type SupplierMessage = {
  id: string;
  supplierId: string;
  supplierName: string;
  from: 'supplier' | 'corporate';
  text: string;
  date: string; // ISO string
  read: boolean;
};

type MsgSubscriber = (msgs: SupplierMessage[]) => void;
const _allMessages: SupplierMessage[] = [
  { id: 'MSG-001', supplierId: 'PROV-001', supplierName: 'Logística Global SA', from: 'supplier', text: 'Buenos días, ¿podrían confirmar la fecha de pago de la factura FAC-01-P1? Necesitamos programar nuestro flujo de caja.', date: '2024-04-25T09:15:00', read: false },
  { id: 'MSG-002', supplierId: 'PROV-003', supplierName: 'Tech Solutions MX', from: 'supplier', text: 'Hola, la factura FAC-03-P1 tiene una discrepancia en el monto. El total correcto es $85,200 incluyendo IVA. Adjuntamos el XML corregido.', date: '2024-04-26T14:30:00', read: false },
  { id: 'MSG-003', supplierId: 'PROV-003', supplierName: 'Tech Solutions MX', from: 'corporate', text: 'Recibido, estamos revisando el XML. Te confirmamos en las próximas horas.', date: '2024-04-26T15:45:00', read: true },
  { id: 'MSG-004', supplierId: 'PROV-005', supplierName: 'Mantenimiento Plus', from: 'supplier', text: 'Necesitamos actualizar nuestra cuenta CLABE para futuros pagos. La nueva es 072180004567891234 de Banorte. ¿Qué documentos necesitan?', date: '2024-04-27T10:00:00', read: false },
  { id: 'MSG-005', supplierId: 'PROV-002', supplierName: 'Suministros Industriales', from: 'supplier', text: '¿Ya se procesó el pago de las facturas de marzo? Llevamos 15 días de atraso según nuestros registros.', date: '2024-04-27T11:20:00', read: false },
  { id: 'MSG-006', supplierId: 'PROV-001', supplierName: 'Logística Global SA', from: 'corporate', text: 'Buen día, el pago de FAC-01-P1 está programado para el 30 de abril por SPEI. Saludos.', date: '2024-04-25T11:00:00', read: true },
  { id: 'MSG-007', supplierId: 'PROV-008', supplierName: 'Seguridad Integral', from: 'supplier', text: 'Estamos interesados en el servicio de factoraje. ¿Podrían explicarnos los requisitos y tasas disponibles?', date: '2024-04-26T16:45:00', read: false },
];
const _msgSubscribers: MsgSubscriber[] = [];

const SupplierMessageService = {
  getAll: () => [..._allMessages],
  getBySupplier: (supplierId: string) => _allMessages.filter(m => m.supplierId === supplierId).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
  getUnreadCount: (supplierId?: string) => _allMessages.filter(m => !m.read && m.from === 'supplier' && (supplierId ? m.supplierId === supplierId : true)).length,
  getUnreadMessages: () => _allMessages.filter(m => !m.read && m.from === 'supplier').sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
  send: (supplierId: string, supplierName: string, from: 'supplier' | 'corporate', text: string) => {
    const msg: SupplierMessage = {
      id: `MSG-${Date.now()}`,
      supplierId, supplierName, from, text,
      date: new Date().toISOString(),
      read: false,
    };
    _allMessages.push(msg);
    _msgSubscribers.forEach(cb => cb([..._allMessages]));
    return msg;
  },
  markRead: (supplierId: string) => {
    _allMessages.forEach(m => { if (m.supplierId === supplierId && m.from === 'supplier') m.read = true; });
    _msgSubscribers.forEach(cb => cb([..._allMessages]));
  },
  subscribe: (cb: MsgSubscriber) => { _msgSubscribers.push(cb); },
  unsubscribe: (cb: MsgSubscriber) => { const i = _msgSubscribers.indexOf(cb); if (i !== -1) _msgSubscribers.splice(i, 1); },
};
// ─── Invoice Clarification Service ─────────────────────────────────────────
type InvoiceClarification = {
  id: string;
  invoiceId: string;
  supplierId: string;
  supplierName: string;
  message: string;
  fileName: string | null;
  fileType: string | null;
  date: string;
  status: 'pending' | 'reviewed' | 'accepted' | 'rejected';
  corporateNote?: string;
};
type ClarSubscriber = () => void;
const _allClarifications: InvoiceClarification[] = [
  { id: 'CLAR-001', invoiceId: 'FAC-DISC-001', supplierId: 'PROV-002', supplierName: 'Suministros Industriales', message: 'Buenos días, adjunto nota de crédito por la diferencia de precio. El aumento fue autorizado por contrato el 1 de abril.', fileName: 'Nota_Credito_NC-2024-045.pdf', fileType: 'application/pdf', date: '2024-04-26T10:30:00', status: 'pending' },
];
const _clarSubscribers: ClarSubscriber[] = [];
const ClarificationService = {
  getAll: () => [..._allClarifications],
  getByInvoice: (invoiceId: string) => _allClarifications.filter(c => c.invoiceId === invoiceId).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
  getBySupplier: (supplierId: string) => _allClarifications.filter(c => c.supplierId === supplierId),
  getPending: () => _allClarifications.filter(c => c.status === 'pending'),
  hasClari: (invoiceId: string) => _allClarifications.some(c => c.invoiceId === invoiceId),
  submit: (invoiceId: string, supplierId: string, supplierName: string, message: string, fileName: string | null, fileType: string | null) => {
    const c: InvoiceClarification = { id: `CLAR-${Date.now()}`, invoiceId, supplierId, supplierName, message, fileName, fileType, date: new Date().toISOString(), status: 'pending' };
    _allClarifications.push(c);
    _clarSubscribers.forEach(cb => cb());
    return c;
  },
  updateStatus: (id: string, status: InvoiceClarification['status'], corporateNote?: string) => {
    const c = _allClarifications.find(x => x.id === id);
    if (c) { c.status = status; if (corporateNote) c.corporateNote = corporateNote; }
    _clarSubscribers.forEach(cb => cb());
  },
  subscribe: (cb: ClarSubscriber) => { _clarSubscribers.push(cb); },
  unsubscribe: (cb: ClarSubscriber) => { const i = _clarSubscribers.indexOf(cb); if (i !== -1) _clarSubscribers.splice(i, 1); },
};
// ─────────────────────────────────────────────────────────────────────────────

const getPriorityInfo = (dateStr: string) => {
  const date = new Date(dateStr);
  const today = new Date('2024-04-27'); // Reference date based on current system time
  const diffTime = Math.abs(today.getTime() - date.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays <= 10) return { label: 'Óptimo', color: 'bg-green-500', text: 'text-green-600', bg: 'bg-green-50', score: 1 };
  if (diffDays <= 20) return { label: 'En Tiempo', color: 'bg-yellow-500', text: 'text-yellow-600', bg: 'bg-yellow-50', score: 2 };
  if (diffDays <= 30) return { label: 'Media Alta', color: 'bg-orange-500', text: 'text-orange-600', bg: 'bg-orange-50', score: 3 };
  return { label: 'Urgente', color: 'bg-red-500', text: 'text-red-600', bg: 'bg-red-50', score: 4 };
};

type Role = 'corporate' | 'provider' | 'admin' | null;

const DEMO_CREDENTIALS = {
  corporate: { email: 'director@royaltica.com', password: 'Royal2026!' },
  admin: { email: 'admin@royaltica.com', password: 'Royal2026!' },
};
const DEMO_2FA_CODE = '260626';
const INACTIVITY_TIMEOUT_MS = 20 * 60 * 1000;

function useInactivityLock(isActive: boolean, onLock: () => void) {
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!isActive) return;
    const reset = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(onLock, INACTIVITY_TIMEOUT_MS);
    };
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'] as const;
    events.forEach(e => window.addEventListener(e, reset));
    reset();
    return () => {
      events.forEach(e => window.removeEventListener(e, reset));
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isActive, onLock]);
}

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<Role>(null);
  const [providerSupplier, setProviderSupplier] = useState<Supplier | null>(null);
  const [needs2FA, setNeeds2FA] = useState(false);
  // Token temporal del backend cuando la cuenta tiene 2FA TOTP activo.
  const [pendingTempToken, setPendingTempToken] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [sessionStartedAt] = useState(() => new Date());
  // Permisos/rol reales del JWT (para filtrar pestañas del portal corporativo).
  const [apiPermissions, setApiPermissions] = useState<string[]>([]);
  const [apiRole, setApiRole] = useState<string>('');

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  const handleLock = React.useCallback(() => {
    if (user) setIsLocked(true);
  }, [user]);

  useInactivityLock(!!user && !isLocked && !needs2FA, handleLock);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-brand-paper">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
          className="w-12 h-12 border-2 border-brand-sand border-t-brand-ink rounded-full"
        />
      </div>
    );
  }

  // Login ÚNICO + ruteo por rol: el backend (dev-login por email) devuelve el
  // ROL de la cuenta y la app manda al portal correcto. El admin no se elige,
  // se deduce de la cuenta (queda oculto para los demás). Lanza si el correo no
  // existe, para que la pantalla de login muestre el error.
  const handleLogin = async (email: string) => {
    const login = await api.devLogin(email);
    const apiUser = login.user;
    // 2FA real: si la cuenta lo tiene activo, el backend NO emite sesión
    // hasta validar el código TOTP (pantalla de verificación).
    setPendingTempToken(login.twoFactorRequired ? login.tempToken : null);
    setApiPermissions(apiUser.permissions ?? []);
    setApiRole(apiUser.role);
    setUser({
      uid: apiUser.id,
      displayName: apiUser.name,
      email: apiUser.email,
      photoURL:
        apiUser.avatarUrl ||
        'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix',
    } as FirebaseUser);

    if (apiUser.role === 'PROVIDER') {
      // El proveedor entra directo a su portal (sin 2FA). Carga su perfil real.
      try {
        const supplier = await api.getProviderProfile();
        setProviderSupplier(supplier);
      } catch {
        /* si el perfil falla, el portal cae a datos de ejemplo */
      }
      setNeeds2FA(false);
      setRole('provider');
    } else if (apiUser.role === 'SUPERADMIN') {
      setRole('admin');
      setNeeds2FA(true);
    } else {
      setRole('corporate');
      setNeeds2FA(true);
    }
  };

  const handleUnlock = () => setIsLocked(false);

  // Cierra sesión y vuelve a la pantalla de login (ya no hay selección de rol).
  const handleLogout = () => {
    api.logout();
    signOut(auth);
    setUser(null);
    setRole(null);
    setProviderSupplier(null);
    setNeeds2FA(false);
    setIsLocked(false);
  };

  if (!user) {
    return <LandingPage onLogin={handleLogin} />;
  }

  if (needs2FA) {
    return <TwoFactorScreen
      onVerified={() => { setNeeds2FA(false); setPendingTempToken(null); }}
      onCancel={handleLogout}
      userName={user.displayName || ''}
      verifyCode={pendingTempToken ? async (code: string) => {
        try { await api.complete2fa(pendingTempToken, code); return true; } catch { return false; }
      } : undefined}
    />;
  }

  if (isLocked) {
    return <LockScreen user={user} onUnlock={handleUnlock} onLogout={handleLogout} />;
  }

  if (role === 'provider' && providerSupplier) {
    return <ProviderDashboard user={user} supplier={providerSupplier} onLogout={handleLogout} onBackToRole={handleLogout} />;
  }

  if (role === 'admin') {
    return <AdminDashboard user={user} onLogout={handleLogout} onBackToRole={handleLogout} />;
  }

  if (role === 'corporate') {
    return <CorporateDashboard user={user} onLogout={handleLogout} onBackToRole={handleLogout} sessionStartedAt={sessionStartedAt} permissions={apiPermissions} role={apiRole} />;
  }

  // Fallback de seguridad: sin rol resuelto, de vuelta al login.
  return <LandingPage onLogin={handleLogin} />;
}

const DEMO_PASSWORD = DEMO_CREDENTIALS.corporate.password;

function LandingPage({ onLogin }: { onLogin: (email: string) => Promise<void> }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  // Pantalla de "Solicitar acceso" (el CEO recibe el aviso y da de alta).
  const [showRequest, setShowRequest] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    // Demo: contraseña única para todas las cuentas. La verificación real por
    // usuario es una tarea aparte; el ROL viene de la cuenta en el backend.
    if (password !== DEMO_PASSWORD) {
      setError('Contraseña incorrecta.');
      return;
    }
    setIsLoading(true);
    try {
      await onLogin(email.trim().toLowerCase());
    } catch {
      setError('Cuenta no encontrada o sin acceso. Solicita acceso abajo.');
      setIsLoading(false);
    }
  };

  if (showRequest) {
    return <RequestAccessScreen onBack={() => setShowRequest(false)} />;
  }

  return (
    <div className="min-h-screen bg-brand-bone flex flex-col items-center justify-center p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full text-center space-y-12"
      >
        <div className="space-y-4">
          <span className="label-caps">Orquestación de Capital</span>
          <h1 className="text-7xl text-brand-ink">Royáltica</h1>
          <p className="text-sm text-brand-ink/60 font-serif lowercase tracking-tight px-12">
            "gobernanza, automatización y auditoría inteligente del ciclo de pagos"
          </p>
        </div>

        <div className="editorial-card !bg-brand-cream space-y-6 shadow-2xl shadow-brand-sand/50">
          <div className="flex items-center justify-center gap-2">
            <Shield size={14} className="text-brand-gold" />
            <p className="text-[10px] uppercase tracking-[0.4em] font-bold opacity-30">Acceso Seguro</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 text-left">
            <div>
              <label className="label-caps !opacity-50 mb-2 block text-[9px]">Correo Corporativo</label>
              <div className="relative">
                <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-ink/30" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-3.5 bg-white border border-brand-sand rounded-xl focus:outline-none focus:border-brand-gold text-brand-ink text-sm"
                  placeholder="tu@empresa.com"
                  required
                  autoComplete="email"
                />
              </div>
            </div>
            <div>
              <label className="label-caps !opacity-50 mb-2 block text-[9px]">Contraseña</label>
              <div className="relative">
                <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-ink/30" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full pl-11 pr-12 py-3.5 bg-white border border-brand-sand rounded-xl focus:outline-none focus:border-brand-gold text-brand-ink text-sm"
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-brand-ink/30 hover:text-brand-ink transition-colors cursor-pointer">
                  <Eye size={16} />
                </button>
              </div>
            </div>

            <AnimatePresence>
              {error && (
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="flex items-center gap-2 px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl">
                  <AlertCircle size={14} className="text-red-500 flex-shrink-0" />
                  <p className="text-[10px] text-red-600 font-bold">{error}</p>
                </motion.div>
              )}
            </AnimatePresence>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 bg-brand-ink text-brand-bone rounded-xl text-[10px] uppercase font-bold tracking-[0.2em] shadow-sm hover:bg-black transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-3"
            >
              {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Key size={14} />}
              {isLoading ? 'Verificando...' : 'Iniciar Sesión'}
            </button>
          </form>

          <div className="text-center">
            <button
              type="button"
              onClick={() => setShowRequest(true)}
              className="text-[10px] font-bold uppercase tracking-widest text-brand-ink/40 hover:text-brand-gold transition-colors cursor-pointer"
            >
              ¿No tienes acceso? Solicítalo
            </button>
          </div>

          <div className="pt-4 border-t border-brand-sand flex items-center justify-center gap-3">
            <div className="flex items-center gap-1.5">
              <Lock size={10} className="text-green-600" />
              <span className="text-[8px] text-brand-ink/40 font-bold uppercase tracking-widest">TLS 256-bit</span>
            </div>
            <span className="text-brand-ink/20">·</span>
            <div className="flex items-center gap-1.5">
              <ShieldCheck size={10} className="text-green-600" />
              <span className="text-[8px] text-brand-ink/40 font-bold uppercase tracking-widest">2FA Activo</span>
            </div>
            <span className="text-brand-ink/20">·</span>
            <div className="flex items-center gap-1.5">
              <Server size={10} className="text-green-600" />
              <span className="text-[8px] text-brand-ink/40 font-bold uppercase tracking-widest">GCP</span>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function RequestAccessScreen({ onBack }: { onBack: () => void }) {
  const [form, setForm] = useState({ name: '', company: '', email: '', phone: '', message: '' });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSending(true);
    try {
      await api.requestAccess({
        name: form.name.trim(),
        company: form.company.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim() || undefined,
        message: form.message.trim() || undefined,
      });
      setSent(true);
    } catch (err) {
      setError((err as Error).message || 'No se pudo enviar la solicitud.');
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-bone flex flex-col items-center justify-center p-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-md w-full space-y-8">
        <div className="text-center space-y-2">
          <span className="label-caps">Acceso por Invitación</span>
          <h1 className="text-4xl text-brand-ink font-serif">Solicitar acceso</h1>
          <p className="text-[11px] text-brand-ink/50 px-6">Déjanos tus datos. El equipo de Royáltica revisa tu solicitud y te da de alta.</p>
        </div>

        <div className="editorial-card !bg-brand-cream space-y-6 shadow-2xl shadow-brand-sand/50">
          {sent ? (
            <div className="text-center space-y-4 py-6">
              <div className="w-14 h-14 rounded-full bg-green-50 border border-green-200 flex items-center justify-center mx-auto">
                <CheckCircle2 size={26} className="text-green-600" />
              </div>
              <h3 className="text-xl font-serif text-brand-ink">Solicitud enviada</h3>
              <p className="text-[11px] text-brand-ink/50 px-4">Gracias. Te contactaremos al correo que registraste para darte acceso.</p>
              <button onClick={onBack} className="mt-2 px-6 py-3 bg-brand-ink text-brand-bone rounded-xl text-[10px] uppercase font-bold tracking-[0.2em] hover:bg-black transition-all cursor-pointer">
                Volver al inicio
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 text-left">
              {([['name', 'Nombre completo', 'text'], ['company', 'Empresa', 'text'], ['email', 'Correo', 'email'], ['phone', 'Teléfono (opcional)', 'tel']] as const).map(([k, label, type]) => (
                <div key={k}>
                  <label className="label-caps !opacity-50 mb-2 block text-[9px]">{label}</label>
                  <input
                    type={type}
                    value={form[k]}
                    onChange={set(k)}
                    required={k !== 'phone'}
                    className="w-full px-4 py-3 bg-white border border-brand-sand rounded-xl focus:outline-none focus:border-brand-gold text-brand-ink text-sm"
                  />
                </div>
              ))}
              <div>
                <label className="label-caps !opacity-50 mb-2 block text-[9px]">¿Qué necesitas? (opcional)</label>
                <textarea value={form.message} onChange={set('message')} rows={2}
                  className="w-full px-4 py-3 bg-white border border-brand-sand rounded-xl focus:outline-none focus:border-brand-gold text-brand-ink text-sm resize-none" />
              </div>

              <AnimatePresence>
                {error && (
                  <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-2 px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl">
                    <AlertCircle size={14} className="text-red-500 flex-shrink-0" />
                    <p className="text-[10px] text-red-600 font-bold">{error}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={onBack} className="flex-1 py-3.5 bg-white border border-brand-sand rounded-xl text-[10px] uppercase font-bold tracking-[0.2em] text-brand-ink/50 hover:text-brand-ink transition-all cursor-pointer">
                  Volver
                </button>
                <button type="submit" disabled={sending}
                  className="flex-1 py-3.5 bg-brand-ink text-brand-bone rounded-xl text-[10px] uppercase font-bold tracking-[0.2em] hover:bg-black transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2">
                  {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={13} />}
                  {sending ? 'Enviando...' : 'Enviar'}
                </button>
              </div>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function TwoFactorScreen({ onVerified, onCancel, userName, verifyCode }: { onVerified: () => void, onCancel: () => void, userName: string, verifyCode?: (code: string) => Promise<boolean> }) {
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const inputRefs = React.useRef<(HTMLInputElement | null)[]>([]);

  // Si la cuenta tiene 2FA TOTP activo, el código se valida contra el backend;
  // si no, se acepta el código demo (hasta que el usuario active su 2FA real).
  const attempt = async (codeStr: string) => {
    const ok = verifyCode ? await verifyCode(codeStr) : await new Promise<boolean>(r => setTimeout(() => r(codeStr === DEMO_2FA_CODE), 600));
    if (ok) {
      onVerified();
    } else {
      setError('Código incorrecto. Intenta de nuevo.');
      setCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
      setIsVerifying(false);
    }
  };

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newCode = [...code];
    newCode[index] = value.slice(-1);
    setCode(newCode);
    setError('');
    if (value && index < 5) inputRefs.current[index + 1]?.focus();
    if (newCode.every(d => d !== '') && newCode.join('').length === 6) {
      setIsVerifying(true);
      void attempt(newCode.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      const newCode = pasted.split('');
      setCode(newCode);
      inputRefs.current[5]?.focus();
      setIsVerifying(true);
      void attempt(pasted);
    }
  };

  return (
    <div className="min-h-screen bg-brand-bone flex flex-col items-center justify-center p-8">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="max-w-sm w-full text-center space-y-8">
        <motion.div
          initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          className="w-20 h-20 mx-auto bg-brand-ink rounded-full flex items-center justify-center shadow-2xl shadow-brand-ink/30"
        >
          <Smartphone size={32} className="text-brand-gold" />
        </motion.div>

        <div className="space-y-2">
          <h2 className="text-3xl text-brand-ink font-serif">Verificación 2FA</h2>
          <p className="text-sm text-brand-ink/50">Hola {userName.split(' ')[0]}, ingresa el código de 6 dígitos de tu app de autenticación</p>
        </div>

        <div className="editorial-card !bg-brand-cream shadow-2xl shadow-brand-sand/50 space-y-6">
          <div className="flex justify-center gap-3" onPaste={handlePaste}>
            {code.map((digit, i) => (
              <input
                key={i}
                ref={el => { inputRefs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={e => handleChange(i, e.target.value)}
                onKeyDown={e => handleKeyDown(i, e)}
                disabled={isVerifying}
                className={`w-12 h-14 text-center text-2xl font-serif bg-white border-2 rounded-xl focus:outline-none transition-all disabled:opacity-50 ${
                  error ? 'border-red-300 text-red-500' : digit ? 'border-brand-gold text-brand-ink' : 'border-brand-sand focus:border-brand-gold text-brand-ink'
                }`}
              />
            ))}
          </div>

          <AnimatePresence>
            {error && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-[10px] text-red-500 font-bold uppercase tracking-widest">
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          {isVerifying && (
            <div className="flex items-center justify-center gap-2 text-brand-gold">
              <Loader2 size={16} className="animate-spin" />
              <span className="text-[10px] uppercase font-bold tracking-widest">Verificando...</span>
            </div>
          )}

          <div className="pt-4 border-t border-brand-sand space-y-3">
            <p className="text-[9px] text-brand-ink/40">
              <ShieldCheck size={10} className="inline mr-1 text-green-600" />
              Protegido con autenticación de dos factores (TOTP)
            </p>
            <button onClick={onCancel} className="text-[10px] text-brand-ink/40 hover:text-brand-ink font-bold uppercase tracking-widest transition-colors cursor-pointer">
              Cancelar y volver al login
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function LockScreen({ user, onUnlock, onLogout }: { user: FirebaseUser, onUnlock: () => void, onLogout: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsVerifying(true);
    setTimeout(() => {
      if (password === DEMO_CREDENTIALS.corporate.password) {
        onUnlock();
      } else {
        setError('Contraseña incorrecta');
        setPassword('');
        setIsVerifying(false);
      }
    }, 500);
  };

  return (
    <div className="min-h-screen bg-brand-ink flex flex-col items-center justify-center p-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-sm w-full text-center space-y-8">
        <motion.div
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
          className="w-24 h-24 mx-auto bg-brand-gold/10 border-2 border-brand-gold/30 rounded-full flex items-center justify-center"
        >
          <Lock size={36} className="text-brand-gold" />
        </motion.div>

        <div className="space-y-2">
          <h2 className="text-3xl text-brand-bone font-serif">Sesión Bloqueada</h2>
          <p className="text-sm text-brand-bone/40">Inactividad detectada — ingresa tu contraseña para continuar</p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-[2rem] p-8 space-y-6 backdrop-blur-sm">
          <div className="flex items-center justify-center gap-3">
            <div className="w-10 h-10 rounded-full bg-brand-gold/20 overflow-hidden border border-brand-gold/30">
              <img src={user.photoURL || ''} alt="" className="w-full h-full object-cover" />
            </div>
            <span className="text-brand-bone text-sm font-bold">{user.displayName}</span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-bone/30" />
              <input
                type="password"
                value={password}
                onChange={e => { setPassword(e.target.value); setError(''); }}
                className="w-full pl-11 pr-4 py-3.5 bg-white/5 border border-white/20 rounded-xl focus:outline-none focus:border-brand-gold text-brand-bone text-sm placeholder:text-brand-bone/30"
                placeholder="Contraseña"
                required
                autoFocus
              />
            </div>
            {error && <p className="text-[10px] text-red-400 font-bold uppercase tracking-widest">{error}</p>}
            <button
              type="submit"
              disabled={isVerifying}
              className="w-full py-3.5 bg-brand-gold text-brand-ink rounded-xl text-[10px] uppercase font-bold tracking-[0.2em] hover:bg-brand-gold/90 transition-all cursor-pointer disabled:opacity-50"
            >
              {isVerifying ? 'Verificando...' : 'Desbloquear'}
            </button>
          </form>

          <button onClick={onLogout} className="text-[10px] text-brand-bone/30 hover:text-brand-bone font-bold uppercase tracking-widest transition-colors cursor-pointer">
            Cerrar sesión
          </button>
        </div>

        <div className="flex items-center justify-center gap-2">
          <Shield size={10} className="text-brand-gold/50" />
          <span className="text-[8px] text-brand-bone/20 uppercase tracking-widest font-bold">Auto-lock por inactividad · 5 min</span>
        </div>
      </motion.div>
    </div>
  );
}

function RoleSelection({ onSelect, user, onProviderLogin }: { onSelect: (role: Role) => void, user: FirebaseUser, onProviderLogin: (supplier: Supplier) => void }) {
  const [showProviderLogin, setShowProviderLogin] = useState(false);
  const [rfc, setRfc] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleProviderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Flujo antiguo de proveedor por RFC (en desuso: ahora el proveedor entra
    // por el login único + ruteo por rol). Se conserva por compatibilidad.
    const supplier = MOCK_SUPPLIERS.find(s => s.rfc.toUpperCase() === rfc.toUpperCase().trim());
    if (supplier && password.length > 0) {
      onProviderLogin(supplier);
      onSelect('provider');
    } else {
      setError('RFC no encontrado o contraseña inválida.');
    }
  };

  return (
    <div className="min-h-screen bg-brand-bone flex flex-col items-center justify-center p-8">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="max-w-3xl w-full"
      >
        <header className="text-center mb-16 space-y-2">
          <h2 className="text-5xl text-brand-ink">Bienvenido, {user.displayName?.split(' ')[0]}</h2>
          <p className="label-caps !opacity-40">Seleccione su portal de gestión</p>
        </header>

        {showProviderLogin ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-md mx-auto editorial-card !bg-brand-cream shadow-2xl shadow-brand-sand/30"
          >
            <div className="flex items-center gap-4 mb-6">
              <button onClick={() => setShowProviderLogin(false)} className="p-2 hover:bg-brand-sand rounded-full transition-colors cursor-pointer">
                <ChevronLeft size={20} className="text-brand-ink" />
              </button>
              <h3 className="text-2xl text-brand-ink font-serif">Acceso Proveedor</h3>
            </div>
            
            <form onSubmit={handleProviderSubmit} className="space-y-4">
              <div>
                <label className="label-caps !opacity-60 mb-2 block">RFC de la Empresa</label>
                <input 
                  type="text" 
                  value={rfc}
                  onChange={e => setRfc(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-brand-sand rounded-xl focus:outline-none focus:border-brand-gold uppercase text-brand-ink"
                  placeholder="Ej. GSS890112XX1"
                  required
                />
              </div>
              <div>
                <label className="label-caps !opacity-60 mb-2 block">Contraseña</label>
                <input 
                  type="password" 
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-brand-sand rounded-xl focus:outline-none focus:border-brand-gold text-brand-ink"
                  placeholder="••••••••"
                  required
                />
              </div>
              {error && <p className="text-red-500 text-[10px] font-bold uppercase tracking-widest">{error}</p>}
              <button 
                type="submit"
                className="w-full py-4 bg-brand-ink text-brand-bone rounded-xl text-[10px] uppercase font-bold tracking-[0.2em] shadow-sm hover:scale-105 transition-transform cursor-pointer"
              >
                Ingresar al Portal
              </button>
            </form>
          </motion.div>
        ) : (
          <div className="grid md:grid-cols-3 gap-6">
            <motion.button
              whileHover={{ scale: 1.02 }}
              onClick={() => onSelect('corporate')}
              className="editorial-card !bg-brand-cream text-left group transition-all hover:border-brand-gold shadow-xl shadow-brand-sand/20 cursor-pointer"
            >
              <div className="w-12 h-12 bg-brand-ink text-brand-paper rounded-full flex items-center justify-center mb-6 shadow-lg shadow-brand-ink/20">
                <Building2 size={24} />
              </div>
              <h3 className="text-2xl mb-2 text-brand-ink">Portal Corporativo</h3>
              <p className="text-sm text-brand-ink/60 mb-6 font-serif">Gestión centralizada de proveedores, auditoría AI Triple Match y optimización de flujo de caja.</p>
              <div className="flex items-center gap-2 text-brand-gold text-[10px] uppercase font-bold tracking-widest">
                Entrar <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
              </div>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02 }}
              onClick={() => setShowProviderLogin(true)}
              className="editorial-card !bg-brand-paper text-left group transition-all hover:border-brand-gold shadow-xl shadow-brand-sand/20 cursor-pointer"
            >
              <div className="w-12 h-12 bg-brand-sand text-brand-ink rounded-full flex items-center justify-center mb-6 text-brand-ink/40 shadow-lg shadow-brand-sand/20">
                <User size={24} />
              </div>
              <h3 className="text-2xl mb-2 text-brand-ink">Portal Proveedor</h3>
              <p className="text-sm text-brand-ink/60 mb-6 font-serif">Facturación inmediata, seguimiento de pagos y solicitud de liquidez anticipada vía factoraje.</p>
              <div className="flex items-center gap-2 text-brand-gold text-[10px] uppercase font-bold tracking-widest">
                Entrar <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
              </div>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02 }}
              onClick={() => onSelect('admin')}
              className="editorial-card !bg-brand-ink text-left group transition-all hover:border-brand-gold shadow-xl shadow-brand-gold/10 cursor-pointer border border-brand-gold/20"
            >
              <div className="w-12 h-12 bg-brand-gold text-brand-ink rounded-full flex items-center justify-center mb-6 shadow-lg shadow-brand-gold/30">
                <Crown size={24} />
              </div>
              <h3 className="text-2xl mb-2 text-brand-paper font-serif">Royáltica Admin</h3>
              <p className="text-sm text-brand-paper/50 mb-6 font-serif">Control total de la plataforma: clientes, salud del sistema, uso y métricas operativas.</p>
              <div className="flex items-center gap-2 text-brand-gold text-[10px] uppercase font-bold tracking-widest">
                Entrar <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
              </div>
            </motion.button>
          </div>
        )}

        <button 
          onClick={() => signOut(auth)}
          className="mt-16 flex items-center gap-2 mx-auto text-[10px] uppercase tracking-[0.4em] font-bold opacity-30 hover:opacity-100 transition-opacity cursor-pointer"
        >
          <LogOut size={14} /> Cerrar Sesión
        </button>
      </motion.div>
    </div>
  );
}

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

/**
 * Campana de notificaciones flotante conectada al backend (/notifications)
 * con stream SSE en tiempo real. Reutilizable en cualquier portal.
 */
function NotificationBell() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);

  const load = React.useCallback(() => {
    api.getNotifications().then(r => { setItems(r.items); setUnread(r.unread); }).catch(() => { /* sin sesión: campana vacía */ });
  }, []);
  useEffect(() => { load(); }, [load]);
  // Tiempo real: cualquier push del backend recarga la lista.
  useEffect(() => {
    const es = api.notificationStream();
    if (!es) return;
    es.onmessage = () => load();
    es.onerror = () => { /* EventSource reintenta solo */ };
    return () => es.close();
  }, [load]);

  const markRead = async (id: string) => { await api.markNotificationRead(id).catch(() => {}); load(); };
  const markAll = async () => { await api.markAllNotificationsRead().catch(() => {}); load(); };
  const fmtTime = (iso: string) => new Date(iso).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="fixed top-6 right-8 z-[95]">
      <button onClick={() => setOpen(o => !o)}
        className="relative w-11 h-11 rounded-2xl bg-white shadow-lg border border-brand-sand/30 flex items-center justify-center hover:bg-brand-bone/40 transition-all cursor-pointer">
        <Bell size={18} className="text-brand-ink/60" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-red-500 rounded-full text-[9px] font-bold text-white flex items-center justify-center border-2 border-white">{unread > 9 ? '9+' : unread}</span>
        )}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.97 }}
            className="absolute right-0 mt-2 w-80 max-h-[70vh] bg-brand-paper rounded-2xl shadow-2xl border border-brand-sand/30 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-brand-sand/20 flex-shrink-0">
              <h4 className="text-sm font-serif text-brand-ink">Notificaciones</h4>
              {unread > 0 && <button onClick={markAll} className="text-[9px] uppercase tracking-wider font-bold text-brand-gold hover:underline cursor-pointer">Marcar todas</button>}
            </div>
            <div className="overflow-y-auto">
              {items.length === 0 ? (
                <p className="text-center text-xs text-brand-ink/40 py-10">No tienes notificaciones.</p>
              ) : items.map(n => (
                <button key={n.id} onClick={() => !n.isRead && markRead(n.id)}
                  className={`w-full text-left px-4 py-3 border-b border-brand-sand/10 hover:bg-brand-bone/40 transition-colors flex gap-3 ${n.isRead ? 'opacity-55' : 'cursor-pointer'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${n.isRead ? 'bg-transparent' : 'bg-brand-gold'}`} />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-brand-ink">{n.title}</p>
                    <p className="text-[11px] text-brand-ink/50 leading-relaxed">{n.body}</p>
                    <p className="text-[9px] text-brand-ink/30 mt-0.5">{fmtTime(n.createdAt)}</p>
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AdminDashboard({ user, onLogout, onBackToRole }: { user: FirebaseUser, onLogout: () => void, onBackToRole: () => void }) {
  const [adminTab, setAdminTab] = useState<'overview' | 'clients' | 'health' | 'activity'>('overview');
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
                {adminTab === 'overview' ? 'Panel de Control' : adminTab === 'clients' ? 'Gestión de Clientes' : adminTab === 'health' ? 'Salud del Sistema' : 'Registro de Actividad'}
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

// Multi-weight calculation logic
const calculateAuditScore = (inv: Invoice) => {
  // 33.33% per pillar (PO, XML/Integridad, Auth)
  const weightPerPillar = 33.333;
  
  // Pillar 1 & 2 combined logic or individual
  let poMatch = 1;
  let integrityMatch = 1;

  if (inv.forensicStatus === 'DISCREPANCY') {
    poMatch = 0.5; // Discrepancia leve
  } else if (inv.forensicStatus === 'BLOCKED') {
    poMatch = 0;
    integrityMatch = 0;
  }
  
  // Auth match: count real signatures
  const sigs = typeof inv.signatures === 'number' ? inv.signatures : 0;
  const authMatch = sigs / 2;
  
  // Adjusted pillars for the 3 grouped boxes effectively
  // Box 1 (PO+DUPL), Box 2 (Stability), Box 3 (Auth)
  // Let's use 33.33 each
  const score = (poMatch * weightPerPillar) + (integrityMatch * weightPerPillar) + (authMatch * weightPerPillar);
  return Math.min(100, Math.round(score));
};

// Consolidado de validación 100%
const isInvoiceFullyValidated = (inv: Invoice) => {
  return (inv.status === 'audited' || inv.status === 'approved') && (inv.signatures || 0) >= 2;
};

const getAIRecommendation = (inv: Invoice, budgetOverride?: number) => {
  const priority = getPriorityInfo(inv.date);
  const amount = inv.amount;
  const totalBudget = budgetOverride || DEFAULT_BUDGET;
  const impact = (amount / totalBudget) * 100;
  
  const isUrgente = priority.label === 'Urgente' || priority.label === 'Media Alta';
  const isHighImpact = impact > 5;

  if (isHighImpact && isUrgente) {
    return {
      strategy: 'fintech' as const,
      label: 'Recomendación: Factoraje (Fintech)',
      reason: `Esta factura es urgente y tiene un impacto alto (${impact.toFixed(1)}%) en tu presupuesto. Usar factoraje protege tu efectivo para otros gastos operativos inmediatos.`
    };
  } else if (isHighImpact) {
    return {
      strategy: 'fintech' as const,
      label: 'Sugerencia: Financiamiento Externo',
      reason: `Al ser un monto considerable (${impact.toFixed(1)}%), financiar este pago te permite mantener liquidez en caja para aprovechar otras oportunidades de inversión.`
    };
  } else if (isUrgente) {
    return {
      strategy: 'cash' as const,
      label: 'Recomendación: Pago con Caja Propia',
      reason: `Es un pago urgente pero de bajo impacto económico. Liquidar directamente con tus recursos ahorra costos financieros y cumple rápido con el proveedor.`
    };
  } else {
    return {
      strategy: 'cash' as const,
      label: 'Sugerencia: Liquidación Directa',
      reason: `El monto es pequeño y no hay urgencia. Pagar con caja propia es la opción más eficiente para evitar comisiones de financiamiento externas.`
    };
  }
};

interface DocumentFile {
  id: string;
  name: string;
  type: string;
  date: string;
}

function DocumentManagerModal({ 
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

function CorporateDashboard({ user, onLogout, onBackToRole, sessionStartedAt, permissions = [], role = '' }: { user: FirebaseUser, onLogout: () => void, onBackToRole: () => void, sessionStartedAt?: Date, permissions?: string[], role?: string }) {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'suppliers' | 'audits' | 'pending_invoices' | 'financing' | 'settings' | 'fiscal_audit' | 'contabilidad' | 'historial'>('dashboard');
  // Filtro de pestañas por permisos del JWT. Admin ve todo; el operativo solo
  // las áreas que se le asignaron al invitarlo (comodín '*' = acceso total).
  const isFullAccess = role === 'CORPORATE_ADMIN' || role === 'SUPERADMIN' || permissions.includes('*');
  const canSee = (area: string) => isFullAccess || permissions.includes(area);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => window.innerWidth < 900);
  
  // Dynamic Theme State
  const DEFAULT_THEME = {
    ink: '#1A1A1A',     // Primary Text / Sidebar / Cards
    gold: '#C5A059',    // Accents / Buttons
    bone: '#F8F5F0',    // Main Background
    sand: '#E5E0D8',    // Borders / Subtle areas
    paper: '#FFFFFF',   // Card background
    cream: '#FDFBF7'    // Secondary Background
  };

  const [currentTheme, setCurrentTheme] = useState(() => {
    try {
      const saved = localStorage.getItem('royaltica_theme');
      return saved ? JSON.parse(saved) : DEFAULT_THEME;
    } catch { return DEFAULT_THEME; }
  });
  const [themeHistory, setThemeHistory] = useState([DEFAULT_THEME]);

  // Inject CSS variables
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--brand-ink', currentTheme.ink);
    root.style.setProperty('--brand-gold', currentTheme.gold);
    root.style.setProperty('--brand-bone', currentTheme.bone);
    root.style.setProperty('--brand-sand', currentTheme.sand);
    root.style.setProperty('--brand-paper', currentTheme.paper);
    root.style.setProperty('--brand-cream', currentTheme.cream);

    // Calculate contrast and inject text-color variables
    const getContrastColor = (hex: string) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      const yiq = (r * 299 + g * 587 + b * 114) / 1000;
      return yiq >= 128 ? '#1A1A1A' : '#FFFFFF';
    };

    root.style.setProperty('--brand-ink-text', getContrastColor(currentTheme.ink));
    root.style.setProperty('--brand-gold-text', getContrastColor(currentTheme.gold));
    root.style.setProperty('--brand-bone-text', getContrastColor(currentTheme.bone));
  }, [currentTheme]);

  const updateTheme = (newTheme: typeof DEFAULT_THEME) => {
    setThemeHistory(prev => [...prev, currentTheme]);
    setCurrentTheme(newTheme);
  };

  const undoTheme = () => {
    if (themeHistory.length > 0) {
      const prev = themeHistory[themeHistory.length - 1];
      setCurrentTheme(prev);
      setThemeHistory(prev => prev.slice(0, -1));
    }
  };

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

  // Build operations context
  const buildGlobalOpsContext = React.useCallback((): OperationsContext => {
    const pending = invoices.filter(i => i.status !== 'paid' && i.status !== 'rejected');
    const paid = invoices.filter(i => i.status === 'paid');
    const today = new Date();
    const overdueCount = invoices.filter(i => {
      if (i.status === 'paid' || i.status === 'rejected') return false;
      return Math.floor((today.getTime() - new Date(i.date).getTime()) / (1000 * 60 * 60 * 24)) > 30;
    }).length;
    const fintechTotal = invoices.filter(i => i.paymentRoute === 'fintech').reduce((s, i) => s + i.amount, 0);
    const cashTotal = invoices.filter(i => i.paymentRoute === 'cash').reduce((s, i) => s + i.amount, 0);
    const fullyValidated = invoices.filter(i => i.forensicStatus === 'VALIDATED' && (i.signatures || 0) >= 2).length;
    const partiallyValidated = invoices.filter(i => i.forensicStatus === 'VALIDATED' && (i.signatures || 0) < 2).length;
    const pendingSignatures = invoices.filter(i => i.forensicStatus === 'VALIDATED').reduce((s, i) => s + Math.max(0, 2 - (i.signatures || 0)), 0);
    const factorajeRequests = invoices.filter(i => i.paymentRoute === 'fintech' && i.status === 'paid').map(i => ({
      provider: i.provider, amount: i.amount, status: 'aprobada', rate: 2.1,
    }));
    return {
      invoices: invoices.map(i => ({ id: i.id, provider: i.provider, amount: i.amount, date: i.date, status: i.status, description: i.description, auditScore: i.auditScore, paymentRoute: i.paymentRoute, forensicStatus: i.forensicStatus, signatures: i.signatures, poNumber: i.poNumber, paymentType: i.paymentType })),
      suppliers: MOCK_SUPPLIERS.map(s => ({ name: s.name, rfc: s.rfc, category: s.category, isApproved: s.isApproved, seniorityYears: s.seniorityYears })),
      totalBudget,
      pendingAmount: pending.reduce((s, i) => s + i.amount, 0),
      paidAmount: paid.reduce((s, i) => s + i.amount, 0),
      cashTotal, overdueCount, fintechTotal,
      auditStats: {
        validated: invoices.filter(i => i.forensicStatus === 'VALIDATED').length,
        discrepancy: invoices.filter(i => i.forensicStatus === 'DISCREPANCY').length,
        blocked: invoices.filter(i => i.forensicStatus === 'BLOCKED').length,
        pending: invoices.filter(i => !i.forensicStatus && i.status !== 'paid').length,
      },
      validationStats: { fullyValidated, partiallyValidated, pendingSignatures },
      factorajeRequests,
      treasuryAvailable: totalBudget * 0.6,
    };
  }, [invoices, totalBudget]);

  const handleGlobalChatSend = React.useCallback(async () => {
    if (!globalChatInput.trim() || globalChatLoading) return;
    const userMsg: ChatMessage = { role: 'user', content: globalChatInput.trim() };
    setGlobalChatMessages(prev => [...prev, userMsg]);
    setGlobalChatInput('');
    setGlobalChatLoading(true);
    setGlobalThinkingStage(0);
    const stageTimers: ReturnType<typeof setTimeout>[] = [];
    [1, 2, 3].forEach((s, i) => {
      stageTimers.push(setTimeout(() => setGlobalThinkingStage(s), (i + 1) * 800));
    });
    try {
      // El asistente corre en el backend (Gemini vía Vertex AI): consulta los
      // datos reales de la organización con sus herramientas. El historial son
      // los turnos previos (el mensaje actual va aparte).
      const { reply, toolsUsed } = await api.aiChat(userMsg.content, globalChatMessages);
      stageTimers.forEach(clearTimeout);
      setGlobalChatMessages(prev => {
        const next = [...prev, { role: 'assistant' as const, content: reply }];
        chatToolsRef.current[next.length - 1] = toolsUsed ?? [];
        return next;
      });
    } catch {
      stageTimers.forEach(clearTimeout);
      setGlobalChatMessages(prev => [...prev, { role: 'assistant', content: 'Error al procesar la consulta. Intenta de nuevo.' }]);
    }
    setGlobalChatLoading(false);
    setGlobalThinkingStage(0);
  }, [globalChatInput, globalChatLoading, globalChatMessages, buildGlobalOpsContext]);

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

  // Persiste la auditoría forense en el backend (PENDING → AUDITED + score).
  // Fire-and-forget: la UI conserva su flujo/animación local; esto solo hace
  // que la validación quede guardada en Postgres y sobreviva a recargas.
  // Si la factura es un mock (sin UUID real) o el backend rechaza la
  // transición, no se rompe nada — la experiencia local sigue igual.
  const persistAudit = React.useCallback((id: string) => {
    if (!isRealId(id)) return;
    api
      .auditInvoice(id)
      .catch((err) => console.warn('No se pudo persistir la auditoría:', err.message));
  }, []);

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
               <div className="w-8 h-8 flex-shrink-0 bg-brand-bone rounded flex items-center justify-center shadow-inner">
                  <span className="font-serif font-bold text-brand-ink leading-none text-sm">R</span>
               </div>
              {!isSidebarCollapsed && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <span className="label-caps mb-1 block !opacity-40">IA Fintech</span>
                  <h1 className="text-xl font-serif tracking-widest leading-none">Royáltica</h1>
                </motion.div>
              )}
            </button>
          </div>

          <nav className="flex-1 space-y-2">
            {canSee('dashboard') && <SidebarLink icon={<BarChart3 size={18} />} label="Tablero" active={activeTab === 'dashboard'} collapsed={isSidebarCollapsed} onClick={() => handleTabChange('dashboard')} />}
            {canSee('proveedores') && <SidebarLink icon={<Building2 size={18} />} label="Proveedores" active={activeTab === 'suppliers'} collapsed={isSidebarCollapsed} onClick={() => handleTabChange('suppliers')} />}
            {canSee('finanzas') && <SidebarLink icon={<FileText size={18} />} label="F. por pagar" active={activeTab === 'pending_invoices'} collapsed={isSidebarCollapsed} onClick={() => handleTabChange('pending_invoices')} />}
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
                    const supplier = MOCK_SUPPLIERS.find(s => s.id === inv.providerId || s.name === inv.provider);
                    const [res] = await Promise.all([
                      auditInvoice(inv, { poNumber: inv.poNumber }, invoices, supplier),
                      new Promise(resolve => setTimeout(resolve, 2500))
                    ]);
                    const result = res as ForensicAuditResult;
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
                    persistAudit(inv.id);
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

          {activeTab === 'audits' && (
              <AuditsView
                invoices={invoices}
                selectedInvoice={selectedInvoice}
                setSelectedInvoice={setSelectedInvoice}
                isAuditing={isAuditing}
                auditResult={auditResult}
                startAudit={async (inv) => {
                   setIsAuditing(true);
                   const supplier = MOCK_SUPPLIERS.find(s => s.id === inv.providerId || s.name === inv.provider);
                   // Run audit with minimum 2.5s delay so animation is visible
                   const [res] = await Promise.all([
                     auditInvoice(inv, { poNumber: inv.poNumber }, invoices, supplier),
                     new Promise(resolve => setTimeout(resolve, 2500))
                   ]);
                   setAuditResult(res as any);
                   setIsAuditing(false);

                   const result = res as ForensicAuditResult;
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
                   persistAudit(inv.id);
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
                  const supplier = MOCK_SUPPLIERS.find(s => s.id === inv.providerId || s.name === inv.provider);
                  const [res] = await Promise.all([
                    auditInvoice(inv, { poNumber: inv.poNumber }, invoices, supplier),
                    new Promise(resolve => setTimeout(resolve, 2500))
                  ]);
                  const result = res as ForensicAuditResult;
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
                  persistAudit(inv.id);
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
                currentTheme={currentTheme}
                onThemeChange={updateTheme}
                onUndo={undoTheme}
                defaultTheme={DEFAULT_THEME}
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

function SidebarLink({ icon, label, active, collapsed, onClick }: { icon: React.ReactNode, label: string, active: boolean, collapsed: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      title={collapsed ? label : ""}
      className={`w-full flex items-center ${collapsed ? 'justify-center px-0' : 'gap-3 px-4'} py-3 rounded-xl text-[10px] uppercase tracking-widest font-bold transition-all duration-300 relative ${
        active
        ? 'bg-brand-gold text-[var(--brand-gold-text)] shadow-sm'
        : 'text-brand-paper/60 hover:text-brand-paper hover:bg-brand-paper/8'
      }`}
    >
      <div className="flex-shrink-0 flex items-center justify-center w-5 h-5">{icon}</div>
      {!collapsed && (
        <motion.span 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="truncate whitespace-nowrap"
        >
          {label}
        </motion.span>
      )}
    </button>
  );
}

// Badge de score 0-100 del proveedor + recálculo (POST /suppliers/:id/score).
function SupplierScoreBadge({ supplierId, initialScore }: { supplierId: string; initialScore?: number }) {
  const [score, setScore] = React.useState<number | undefined>(initialScore);
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => { setScore(initialScore); }, [initialScore, supplierId]);

  const recompute = async () => {
    if (!isRealId(supplierId)) return;
    setBusy(true);
    try { const r = await api.recomputeSupplierScore(supplierId); setScore(r.score); }
    catch { /* ignore */ }
    finally { setBusy(false); }
  };

  const color = score === undefined ? 'bg-brand-sand/40 text-brand-ink/40 border-brand-sand'
    : score >= 80 ? 'bg-green-100 text-green-700 border-green-300'
    : score >= 50 ? 'bg-yellow-100 text-yellow-700 border-yellow-300'
    : 'bg-red-100 text-red-600 border-red-300';

  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[8px] uppercase font-bold tracking-widest border ${color}`}>
      Score: {score !== undefined ? score : '—'}
      {isRealId(supplierId) && (
        <button onClick={recompute} disabled={busy} title="Recalcular score" className="hover:opacity-70 disabled:opacity-40">
          {busy ? <Loader2 size={9} className="animate-spin" /> : <RefreshCw size={9} />}
        </button>
      )}
    </span>
  );
}

function SupplierDirectoryView({
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
                        <p className="text-sm font-bold text-brand-ink">{s.name}</p>
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
                    <SupplierScoreBadge supplierId={selectedSupplier.id} initialScore={selectedSupplier.score} />
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

function PendingInvoicesView({ invoices, totalBudget, onAuditRequest, onBatchProcess, onUpdateInvoice }: { invoices: Invoice[], totalBudget: number, onAuditRequest: (inv: Invoice) => void, onBatchProcess?: (ids: string[]) => Promise<void>, onUpdateInvoice?: (id: string, updates: Partial<Invoice>) => void }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragMode, setDragMode] = useState<'select' | 'deselect'>('select');
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);
  const [showScheduler, setShowScheduler] = useState(false);
  const [viewMode, setViewMode] = useState<'pending' | 'paid' | 'calendar'>('pending');
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [showCashSimulator, setShowCashSimulator] = useState(false);
  const [partialPayInvoice, setPartialPayInvoice] = useState<string | null>(null);
  const [partialAmount, setPartialAmount] = useState('');
  const [reviewClarInvoiceId, setReviewClarInvoiceId] = useState<string | null>(null);
  const [msgInvoice, setMsgInvoice] = useState<Invoice | null>(null);
  const [msgText, setMsgText] = useState('');
  const [msgSent, setMsgSent] = useState(false);
  const [, setClarTick] = useState(0);
  const [, setMsgTick] = useState(0);

  useEffect(() => {
    const cb = () => setClarTick(t => t + 1);
    ClarificationService.subscribe(cb);
    return () => ClarificationService.unsubscribe(cb);
  }, []);

  useEffect(() => {
    const cb = () => setMsgTick(t => t + 1);
    SupplierMessageService.subscribe(cb);
    return () => SupplierMessageService.unsubscribe(cb);
  }, []);

  // Pre-built message templates
  const getMessageTemplates = (inv: Invoice) => {
    const templates: { label: string; text: string }[] = [];
    if (inv.forensicStatus === 'DISCREPANCY') {
      templates.push({
        label: 'Solicitar aclaración',
        text: `Estimado proveedor, la factura ${inv.id} por ${CURRENCY_FORMATTER.format(inv.amount)} presenta una discrepancia en la auditoría: "${inv.auditAnalysis || 'Hallazgo pendiente de detalle'}". Favor de enviar la documentación de soporte o aclaración correspondiente a través de su portal (Facturas → Aclarar). Quedo atento.`
      });
    }
    if (inv.forensicStatus === 'BLOCKED') {
      templates.push({
        label: 'Factura bloqueada',
        text: `Estimado proveedor, la factura ${inv.id} fue bloqueada por el siguiente motivo: "${inv.auditAnalysis || 'Documento duplicado o irregular'}". Por favor revise y envíe la factura corregida o la documentación que aclare la situación. Sin este paso no es posible procesar el pago.`
      });
    }
    templates.push({
      label: 'Solicitar XML/PDF',
      text: `Estimado proveedor, requerimos el archivo XML y/o PDF de la factura ${inv.id} por ${CURRENCY_FORMATTER.format(inv.amount)} para completar la validación fiscal. Favor de subirlo en su portal en la sección de Facturas. Gracias.`
    });
    templates.push({
      label: 'Confirmar datos bancarios',
      text: `Estimado proveedor, antes de procesar el pago de la factura ${inv.id} por ${CURRENCY_FORMATTER.format(inv.amount)}, necesitamos confirmar que sus datos bancarios (CLABE) estén actualizados en su perfil del portal. Favor de verificar y confirmar. Saludos.`
    });
    templates.push({
      label: 'Solicitar nota de crédito',
      text: `Estimado proveedor, se requiere una nota de crédito asociada a la factura ${inv.id} para ajustar la diferencia detectada. Favor de emitirla y subirla como aclaración en su portal. Quedamos atentos.`
    });
    return templates;
  };

  useEffect(() => {
    const handleGlobalMouseUp = () => setIsDragging(false);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, []);

  const pendingInvoices = invoices
    .filter(inv => inv.status === 'pending')
    .filter(inv => {
      const matchesSearch = inv.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           inv.provider.toLowerCase().includes(searchTerm.toLowerCase());
      const priority = getPriorityInfo(inv.date).label;
      const matchesPriority = priorityFilter === 'all' || priority === priorityFilter;
      return matchesSearch && matchesPriority;
    })
    .sort((a, b) => {
      const aClar = ClarificationService.hasClari(a.id) ? 1 : 0;
      const bClar = ClarificationService.hasClari(b.id) ? 1 : 0;
      if (aClar !== bClar) return bClar - aClar; // clarified first
      return getPriorityInfo(b.date).score - getPriorityInfo(a.date).score;
    });

  const pendingClarCount = pendingInvoices.filter(inv => ClarificationService.hasClari(inv.id)).length;

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(new Set(pendingInvoices.map(i => i.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelect = (id: string, checked: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleRowMouseDown = (id: string, e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    const mode = selectedIds.has(id) ? 'deselect' : 'select';
    setDragMode(mode);
    handleSelect(id, mode === 'select');
    e.preventDefault();
  };

  const handleRowMouseEnter = (id: string) => {
    if (isDragging) {
      handleSelect(id, dragMode === 'select');
    }
  };

  const handleBatch = async () => {
    if (!onBatchProcess) return;
    setIsProcessing(true);
    await onBatchProcess(Array.from(selectedIds));
    setSelectedIds(new Set());
    setIsProcessing(false);
  };

  return (
    <div className="flex flex-col pb-12">
       <header className="mb-6 flex-shrink-0">
          <span className="label-caps mb-2 block">Tesorería Central</span>
          <h2 className="text-4xl mb-4 font-serif text-brand-ink">Facturas por Pagar</h2>
          <div className="flex gap-3 max-w-2xl">
            {selectedIds.size > 0 && (
              <div className="flex gap-2">
                <button
                  onClick={() => setShowScheduler(true)}
                  className="px-6 py-2.5 bg-brand-ink text-brand-paper rounded-xl text-[10px] uppercase font-bold tracking-[0.2em] shadow-sm hover:scale-105 transition-transform flex items-center gap-2 whitespace-nowrap"
                >
                  <Calendar size={14} /> Programar Pago ({selectedIds.size})
                </button>
                <button 
                  onClick={handleBatch}
                  disabled={isProcessing}
                  className="px-6 py-2.5 bg-brand-gold text-brand-ink rounded-xl text-[10px] uppercase font-bold tracking-[0.2em] shadow-sm hover:scale-105 transition-transform flex items-center gap-2 whitespace-nowrap"
                >
                  {isProcessing ? (
                    <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }} className="w-3 h-3 border-2 border-brand-ink/30 border-t-brand-ink rounded-full" />
                  ) : <CheckCircle2 size={14} />}
                  Validar y Pagar ({selectedIds.size})
                </button>
                <button 
                  onClick={() => setSelectedIds(new Set())}
                  disabled={isProcessing}
                  className="px-4 py-2.5 bg-brand-sand/30 text-brand-ink rounded-xl text-[10px] uppercase font-bold tracking-[0.2em] hover:bg-brand-sand transition-colors"
                >
                  Cancelar
                </button>
              </div>
            )}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 opacity-30 text-brand-ink" size={16} />
              <input 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Buscar por ID o Proveedor..."
                className="w-full pl-10 pr-4 py-2.5 bg-brand-cream border border-brand-sand rounded-xl text-sm focus:outline-none focus:border-brand-gold shadow-sm"
              />
            </div>
            <select 
              value={priorityFilter}
              onChange={e => setPriorityFilter(e.target.value)}
              className="px-4 py-2.5 bg-brand-cream border border-brand-sand rounded-xl text-[10px] uppercase font-bold tracking-[0.2em] shadow-sm cursor-pointer outline-none focus:border-brand-gold"
            >
              <option value="all">Todas las Prioridades</option>
              <option value="Baja">Baja</option>
              <option value="Media">Media</option>
              <option value="Media Alta">Media Alta</option>
              <option value="Urgente">Urgente</option>
            </select>
          </div>

          {/* View mode tabs + Cash Simulator toggle */}
          <div className="flex items-center justify-between mt-4">
            <div className="bg-brand-bone/80 p-1 rounded-full border border-brand-sand/50 shadow-sm flex gap-1">
              {([['pending', 'Pendientes'], ['paid', 'Pagadas'], ['calendar', 'Calendario']] as const).map(([mode, label]) => (
                <button key={mode} onClick={() => setViewMode(mode)}
                  className={`px-5 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all ${viewMode === mode ? 'bg-brand-ink text-brand-bone shadow-md' : 'text-brand-ink/40 hover:text-brand-ink'}`}>
                  {label}
                </button>
              ))}
            </div>
            <button onClick={() => setShowCashSimulator(!showCashSimulator)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border ${showCashSimulator ? 'bg-brand-gold text-brand-ink border-brand-gold' : 'bg-white border-brand-sand/40 text-brand-ink/50 hover:border-brand-gold'}`}>
              <DollarSign size={12} /> Simulador de Caja
            </button>
          </div>
       </header>

       {/* ─── Cash Impact Simulator ─── */}
       <AnimatePresence>
         {showCashSimulator && selectedIds.size > 0 && (
           <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
             className="mb-4 flex-shrink-0 overflow-hidden">
             <div className="editorial-card !p-5 border-brand-gold/30 bg-brand-gold/5 space-y-3">
               <div className="flex items-center gap-2">
                 <DollarSign size={16} className="text-brand-gold" />
                 <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-ink/60">Simulador de Impacto en Caja</span>
               </div>
               {(() => {
                 const selected = pendingInvoices.filter(i => selectedIds.has(i.id));
                 const selectedTotal = selected.reduce((s, i) => s + i.amount, 0);
                 const currentCash = totalBudget * 0.6; // mock current treasury
                 const afterPayment = currentCash - selectedTotal;
                 const allPending = invoices.filter(i => i.status === 'pending').reduce((s, i) => s + i.amount, 0);
                 const remainingPending = allPending - selectedTotal;
                 const daysOfCoverage = afterPayment > 0 ? Math.round(afterPayment / (allPending / 30)) : 0;
                 const isRisky = afterPayment < currentCash * 0.2;
                 return (
                   <div className="grid grid-cols-4 gap-4">
                     <div className="space-y-1">
                       <p className="text-[9px] uppercase tracking-wider text-brand-ink/30">Caja Actual</p>
                       <p className="text-lg font-serif text-brand-ink">{CURRENCY_FORMATTER.format(currentCash)}</p>
                     </div>
                     <div className="space-y-1">
                       <p className="text-[9px] uppercase tracking-wider text-brand-ink/30">Pago Seleccionado</p>
                       <p className="text-lg font-serif text-red-600">-{CURRENCY_FORMATTER.format(selectedTotal)}</p>
                     </div>
                     <div className="space-y-1">
                       <p className="text-[9px] uppercase tracking-wider text-brand-ink/30">Caja Después</p>
                       <p className={`text-lg font-serif ${isRisky ? 'text-red-600' : 'text-green-600'}`}>{CURRENCY_FORMATTER.format(Math.max(afterPayment, 0))}</p>
                       {isRisky && <p className="text-[8px] text-red-500 font-bold">⚠️ Liquidez baja</p>}
                     </div>
                     <div className="space-y-1">
                       <p className="text-[9px] uppercase tracking-wider text-brand-ink/30">Cobertura</p>
                       <p className="text-lg font-serif text-brand-ink">{daysOfCoverage} días</p>
                       <p className="text-[8px] text-brand-ink/30">para cubrir pendientes restantes</p>
                     </div>
                   </div>
                 );
               })()}
             </div>
           </motion.div>
         )}
       </AnimatePresence>

       {/* ─── Calendar View ─── */}
       {viewMode === 'calendar' && (
         <div className="editorial-card !p-6 space-y-4">
           <p className="text-[10px] uppercase tracking-widest font-bold text-brand-ink/30">Calendario de pagos · Abril-Mayo 2024</p>
           <div className="grid grid-cols-7 gap-2">
             {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d => (
               <div key={d} className="text-center text-[8px] uppercase tracking-widest font-bold text-brand-ink/20 py-1">{d}</div>
             ))}
             {Array.from({ length: 35 }, (_, i) => {
               const day = i - 1; // April starts on Tuesday (offset 1)
               const dateNum = day + 1;
               const isValidDay = dateNum >= 1 && dateNum <= 30;
               const dateStr = isValidDay ? `2024-04-${String(dateNum).padStart(2, '0')}` : '';
               const dayInvoices = isValidDay ? invoices.filter(inv =>
                 (inv.status !== 'paid' && inv.status !== 'rejected' && inv.date === dateStr) ||
                 (inv.scheduledPayDate === dateStr)
               ) : [];
               const paidToday = isValidDay ? invoices.filter(inv => inv.paidDate === dateStr) : [];
               const total = dayInvoices.reduce((s, inv) => s + inv.amount, 0);
               const hasItems = dayInvoices.length > 0 || paidToday.length > 0;
               return (
                 <div key={i} className={`rounded-xl p-2 min-h-[70px] border transition-all ${
                   isValidDay ? (hasItems ? 'border-brand-gold/30 bg-brand-gold/5' : 'border-brand-sand/20 bg-white/30') : 'border-transparent opacity-20'
                 }`}>
                   {isValidDay && (
                     <>
                       <p className={`text-[10px] font-bold ${hasItems ? 'text-brand-ink' : 'text-brand-ink/20'}`}>{dateNum}</p>
                       {dayInvoices.slice(0, 2).map(inv => (
                         <div key={inv.id} className="mt-1 px-1.5 py-0.5 bg-orange-100 rounded text-[6px] text-orange-700 font-bold truncate">{inv.id}</div>
                       ))}
                       {paidToday.slice(0, 1).map(inv => (
                         <div key={inv.id} className="mt-1 px-1.5 py-0.5 bg-green-100 rounded text-[6px] text-green-700 font-bold truncate">✓ {inv.id}</div>
                       ))}
                       {dayInvoices.length > 2 && <p className="text-[6px] text-brand-ink/30 mt-0.5">+{dayInvoices.length - 2} más</p>}
                       {total > 0 && <p className="text-[7px] font-bold text-brand-gold mt-1">${(total / 1000).toFixed(0)}k</p>}
                     </>
                   )}
                 </div>
               );
             })}
           </div>
           <div className="flex gap-4 pt-2">
             <div className="flex items-center gap-2"><div className="w-3 h-2 bg-orange-100 rounded" /><span className="text-[8px] text-brand-ink/40">Pendiente</span></div>
             <div className="flex items-center gap-2"><div className="w-3 h-2 bg-green-100 rounded" /><span className="text-[8px] text-brand-ink/40">Pagada</span></div>
           </div>
         </div>
       )}

       {/* ─── Paid History View ─── */}
       {viewMode === 'paid' && (
         <div className="editorial-card !p-0 overflow-hidden shadow-xl shadow-brand-sand/30 flex flex-col border border-brand-sand/50">
           <div className="scrollbar-thin scrollbar-thumb-brand-sand">
             <table className="w-full text-left border-separate border-spacing-0">
               <thead className="bg-brand-sand/10 border-b border-brand-sand sticky top-0 z-10 backdrop-blur-md">
                 <tr>
                   <th className="px-6 py-4 label-caps !opacity-40 border-b border-brand-sand">Factura</th>
                   <th className="px-6 py-4 label-caps !opacity-40 border-b border-brand-sand">Proveedor</th>
                   <th className="px-6 py-4 label-caps !opacity-40 border-b border-brand-sand">Monto</th>
                   <th className="px-6 py-4 label-caps !opacity-40 border-b border-brand-sand">Método</th>
                   <th className="px-6 py-4 label-caps !opacity-40 border-b border-brand-sand">Score</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-brand-sand/20">
                 {invoices.filter(i => i.status === 'paid').sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(inv => (
                   <tr key={inv.id} className="hover:bg-green-50/30 transition-all">
                     <td className="px-6 py-4"><span className="text-sm font-bold text-brand-ink">{inv.id}</span><br/><span className="text-[9px] text-brand-ink/30">{inv.date}</span></td>
                     <td className="px-6 py-4 text-sm text-brand-ink/70">{inv.provider}</td>
                     <td className="px-6 py-4 font-bold text-brand-ink">
                       {CURRENCY_FORMATTER.format(inv.paidAmount || inv.amount)}
                       {inv.paidAmount && inv.paidAmount < inv.amount && <span className="text-[8px] text-orange-500 ml-1">(parcial)</span>}
                     </td>
                     <td className="px-6 py-4"><span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded-full ${inv.paymentRoute === 'fintech' ? 'bg-brand-gold/20 text-brand-gold' : 'bg-green-100 text-green-700'}`}>{inv.paymentRoute || 'cash'}</span></td>
                     <td className="px-6 py-4"><span className="text-sm font-serif text-brand-ink">{inv.auditScore || '—'}</span></td>
                   </tr>
                 ))}
                 {invoices.filter(i => i.status === 'paid').length === 0 && (
                   <tr><td colSpan={5} className="px-6 py-12 text-center text-brand-ink/30 text-sm">Sin pagos realizados.</td></tr>
                 )}
               </tbody>
             </table>
           </div>
         </div>
       )}

       {/* ─── Pending View (Original Table) ─── */}
       {viewMode === 'pending' && (
       <div className="space-y-4">
       <div className="editorial-card !p-0 overflow-hidden shadow-xl shadow-brand-sand/30 flex flex-col border border-brand-sand/50">
          <div className="scrollbar-thin scrollbar-thumb-brand-sand scrollbar-track-transparent">
            <table className="w-full text-left border-separate border-spacing-0">
              <thead className="bg-brand-sand/10 border-b border-brand-sand sticky top-0 z-10 backdrop-blur-md">
                <tr>
                  <th className="px-6 py-4 w-12 border-b border-brand-sand">
                    <input
                      type="checkbox"
                      className="accent-brand-gold w-4 h-4 cursor-pointer"
                      checked={pendingInvoices.length > 0 && selectedIds.size === pendingInvoices.length}
                      onChange={handleSelectAll}
                    />
                  </th>
                  <th className="px-6 py-4 label-caps !opacity-40 border-b border-brand-sand">Prioridad</th>
                  <th className="px-6 py-4 label-caps !opacity-40 border-b border-brand-sand">Detalle Factura</th>
                  <th className="px-6 py-4 label-caps !opacity-40 border-b border-brand-sand">Monto</th>
                  <th className="px-6 py-4 label-caps !opacity-40 border-b border-brand-sand">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-sand/20">
                {pendingInvoices.map(inv => {
                  const priority = getPriorityInfo(inv.date);
                  const hasClar = ClarificationService.hasClari(inv.id);
                  const clarList = hasClar ? ClarificationService.getByInvoice(inv.id) : [];
                  const latestClar = clarList[0];
                  return (
                    <tr
                      key={inv.id}
                      className={`hover:bg-brand-gold/5 transition-all group select-none ${hasClar ? 'bg-amber-50/50' : ''}`}
                      onMouseDown={(e) => handleRowMouseDown(inv.id, e)}
                      onMouseEnter={() => handleRowMouseEnter(inv.id)}
                    >
                      <td className="px-6 py-4">
                        <input 
                          type="checkbox" 
                          className="accent-brand-gold w-4 h-4 cursor-pointer"
                          checked={selectedIds.has(inv.id)}
                          onChange={e => handleSelect(inv.id, e.target.checked)}
                        />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                           <div className={`w-3 h-3 rounded-full ${priority.color} shadow-sm shadow-brand-sand`} />
                           <span className={`text-[10px] font-bold uppercase tracking-wider ${priority.text}`}>
                             {priority.label}
                           </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div 
                          className="flex flex-col cursor-pointer hover:opacity-70 transition-opacity"
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => { e.stopPropagation(); setViewingInvoice(inv); }}
                        >
                           <div className="flex items-center gap-2">
                             <span className="text-sm font-bold text-brand-ink hover:underline">{inv.id}</span>
                           </div>
                           <span className="text-[10px] text-brand-ink/40 uppercase font-serif">{inv.provider}</span>
                           <span className="text-[9px] opacity-30 mt-1">Subida el: {inv.date}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-bold text-brand-ink tracking-tight">
                          {CURRENCY_FORMATTER.format(inv.amount)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col items-end gap-1.5">
                          <div className="flex gap-1.5">
                            <button
                              onMouseDown={e => e.stopPropagation()}
                              onClick={() => onAuditRequest(inv)}
                              className="px-3 py-1.5 bg-brand-ink text-brand-paper rounded-lg text-[8px] uppercase font-bold tracking-widest hover:bg-brand-gold hover:text-brand-ink transition-all"
                            >
                              Validar
                            </button>
                          </div>
                          {/* Note button */}
                          <button
                            onMouseDown={e => e.stopPropagation()}
                            onClick={(e) => { e.stopPropagation(); setEditingNote(editingNote === inv.id ? null : inv.id); setNoteText(inv.notes || ''); }}
                            className={`flex items-center gap-1 text-[7px] uppercase tracking-widest transition-all ${inv.notes ? 'text-brand-gold font-bold' : 'text-brand-ink/20 hover:text-brand-ink/50'}`}
                          >
                            <StickyNote size={8} /> {inv.notes ? 'Nota ✓' : '+ Nota'}
                          </button>
                          {/* Note editor */}
                          {editingNote === inv.id && (
                            <div className="flex gap-1 items-center w-full" onMouseDown={e => e.stopPropagation()}>
                              <input
                                value={noteText}
                                onChange={e => setNoteText(e.target.value)}
                                placeholder="Nota interna..."
                                className="flex-1 px-2 py-1 border border-brand-sand/40 rounded-lg text-[9px] outline-none focus:border-brand-gold"
                                onKeyDown={e => {
                                  if (e.key === 'Enter' && onUpdateInvoice) {
                                    onUpdateInvoice(inv.id, { notes: noteText });
                                    setEditingNote(null);
                                  }
                                }}
                              />
                              <button onClick={() => { if (onUpdateInvoice) { onUpdateInvoice(inv.id, { notes: noteText }); setEditingNote(null); } }}
                                className="px-2 py-1 bg-brand-gold text-brand-ink rounded-lg text-[8px] font-bold">✓</button>
                            </div>
                          )}
                          {inv.notes && editingNote !== inv.id && (
                            <p className="text-[7px] text-brand-ink/30 max-w-[140px] truncate" title={inv.notes}>📝 {inv.notes}</p>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {pendingInvoices.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-xs opacity-40 font-serif">
                       No hay facturas pendientes con los criterios seleccionados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
       </div>
       </div>
       )}

       <AnimatePresence>
         {viewingInvoice && (
           <InvoiceDetailModal invoice={viewingInvoice} onClose={() => setViewingInvoice(null)} />
         )}
         {showScheduler && (
           <SchedulePaymentModal
             onClose={() => {
               setShowScheduler(false);
               setSelectedIds(new Set());
             }}
           />
         )}
         {reviewClarInvoiceId && (() => {
           const inv = invoices.find(i => i.id === reviewClarInvoiceId);
           const clars = ClarificationService.getByInvoice(reviewClarInvoiceId);
           if (!inv || clars.length === 0) return null;
           return (
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
               className="fixed inset-0 z-[200] bg-brand-ink/40 backdrop-blur-sm flex items-center justify-center p-6"
               onClick={() => setReviewClarInvoiceId(null)}>
               <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
                 onClick={e => e.stopPropagation()} className="bg-white rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col" style={{ maxHeight: '85vh' }}>
                 {/* Header */}
                 <div className="px-7 py-5 bg-brand-ink text-brand-paper flex items-center justify-between flex-shrink-0">
                   <div>
                     <p className="text-[11px] font-bold flex items-center gap-2">
                       <MessageSquare size={14} className="text-amber-400" />
                       Aclaración — {inv.id}
                     </p>
                     <p className="text-[9px] text-brand-paper/40">{inv.provider} · {CURRENCY_FORMATTER.format(inv.amount)}</p>
                   </div>
                   <button onClick={() => setReviewClarInvoiceId(null)}><X size={16} className="text-brand-paper/40 hover:text-brand-paper" /></button>
                 </div>

                 <div className="flex-1 overflow-y-auto">
                   {/* Original issue */}
                   {inv.auditAnalysis && (
                     <div className="px-7 py-4 bg-red-50 border-b border-red-100">
                       <p className="text-[8px] font-bold text-red-700 uppercase tracking-wider mb-1">Hallazgo Original de Auditoría</p>
                       <p className="text-[10px] text-red-800">{inv.auditAnalysis}</p>
                       {inv.forensicSolution && <p className="text-[9px] text-red-600 mt-1 italic">Solución: {inv.forensicSolution}</p>}
                     </div>
                   )}

                   {/* Clarifications timeline */}
                   <div className="px-7 py-5 space-y-4">
                     <p className="text-[8px] font-bold text-brand-ink/40 uppercase tracking-wider">Aclaraciones del Proveedor</p>
                     {clars.map(clar => (
                       <div key={clar.id} className="border border-brand-sand/30 rounded-2xl overflow-hidden">
                         <div className="px-5 py-3 bg-brand-bone/50 flex items-center justify-between">
                           <div className="flex items-center gap-2">
                             <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${clar.supplierName}`} alt="" className="w-6 h-6 rounded-lg" />
                             <div>
                               <p className="text-[10px] font-bold text-brand-ink">{clar.supplierName}</p>
                               <p className="text-[7px] text-brand-ink/30">
                                 {new Date(clar.date).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })} · {new Date(clar.date).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                               </p>
                             </div>
                           </div>
                           <span className={`px-2 py-0.5 rounded-full text-[7px] font-bold uppercase tracking-wider ${
                             clar.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                             clar.status === 'accepted' ? 'bg-green-100 text-green-700' :
                             clar.status === 'rejected' ? 'bg-red-100 text-red-700' :
                             'bg-blue-100 text-blue-700'
                           }`}>{clar.status === 'pending' ? 'Pendiente' : clar.status === 'accepted' ? 'Aceptada' : clar.status === 'rejected' ? 'Rechazada' : 'Revisada'}</span>
                         </div>
                         <div className="px-5 py-4 space-y-3">
                           <p className="text-[10px] text-brand-ink/70 leading-relaxed">{clar.message}</p>
                           {clar.fileName && (
                             <div className="flex items-center gap-2 px-3 py-2 bg-brand-bone rounded-xl border border-brand-sand/20">
                               <div className="w-8 h-8 rounded-lg bg-brand-gold/10 flex items-center justify-center flex-shrink-0">
                                 {clar.fileName.endsWith('.pdf') ? <FileText size={14} className="text-red-500" /> :
                                  clar.fileName.endsWith('.xml') ? <FileText size={14} className="text-blue-500" /> :
                                  <Paperclip size={14} className="text-brand-ink/40" />}
                               </div>
                               <div className="flex-1 min-w-0">
                                 <p className="text-[9px] font-bold text-brand-ink truncate">{clar.fileName}</p>
                                 <p className="text-[7px] text-brand-ink/30">{clar.fileType || 'Documento adjunto'}</p>
                               </div>
                               <button className="px-2 py-1 bg-brand-ink/5 rounded-lg text-[7px] font-bold text-brand-ink/50 hover:bg-brand-ink/10 transition-all flex items-center gap-1">
                                 <Eye size={8} /> Ver
                               </button>
                             </div>
                           )}
                         </div>
                       </div>
                     ))}
                   </div>
                 </div>

                 {/* Action buttons */}
                 <div className="px-7 py-4 border-t border-brand-sand/20 flex gap-3 flex-shrink-0">
                   <button onClick={() => {
                     clars.forEach(c => { if (c.status === 'pending') ClarificationService.updateStatus(c.id, 'accepted'); });
                     const s = MOCK_SUPPLIERS.find(x => x.id === inv.providerId);
                     if (s) SupplierMessageService.send(s.id, s.name, 'corporate', `La aclaración para la factura ${inv.id} fue aceptada. La factura será re-procesada para validación. Gracias por su respuesta.`);
                     setReviewClarInvoiceId(null);
                   }}
                     className="flex-1 py-3 bg-green-600 text-white rounded-xl text-[9px] font-bold uppercase tracking-wider hover:bg-green-700 transition-all flex items-center justify-center gap-2">
                     <CheckCircle2 size={12} /> Aceptar Aclaración
                   </button>
                   <button onClick={() => {
                     onAuditRequest(inv);
                     setReviewClarInvoiceId(null);
                   }}
                     className="flex-1 py-3 bg-brand-ink text-brand-paper rounded-xl text-[9px] font-bold uppercase tracking-wider hover:bg-brand-gold hover:text-brand-ink transition-all flex items-center justify-center gap-2">
                     <RefreshCw size={12} /> Re-auditar con IA
                   </button>
                   <button onClick={() => {
                     clars.forEach(c => { if (c.status === 'pending') ClarificationService.updateStatus(c.id, 'rejected', 'Documentación insuficiente'); });
                     // Auto-notify supplier
                     const s = MOCK_SUPPLIERS.find(x => x.id === inv.providerId);
                     if (s) SupplierMessageService.send(s.id, s.name, 'corporate', `La aclaración para la factura ${inv.id} fue rechazada. Motivo: documentación insuficiente. Favor de enviar nuevamente la documentación correcta a través de su portal (Facturas → Aclarar).`);
                     setReviewClarInvoiceId(null);
                   }}
                     className="py-3 px-5 bg-red-50 text-red-600 border border-red-200 rounded-xl text-[9px] font-bold uppercase tracking-wider hover:bg-red-100 transition-all flex items-center justify-center gap-2">
                     <X size={12} /> Rechazar
                   </button>
                 </div>
               </motion.div>
             </motion.div>
           );
         })()}
         {msgInvoice && (() => {
           const supplier = MOCK_SUPPLIERS.find(s => s.id === msgInvoice.providerId);
           if (!supplier) return null;
           const convo = SupplierMessageService.getBySupplier(supplier.id);
           const templates = getMessageTemplates(msgInvoice);
           return (
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
               className="fixed inset-0 z-[200] bg-brand-ink/40 backdrop-blur-sm flex items-center justify-center p-6"
               onClick={() => setMsgInvoice(null)}>
               <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
                 onClick={e => e.stopPropagation()} className="bg-white rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col" style={{ maxHeight: '88vh' }}>
                 {/* Header */}
                 <div className="px-7 py-4 bg-brand-ink text-brand-paper flex items-center justify-between flex-shrink-0">
                   <div className="flex items-center gap-3">
                     <div className="w-9 h-9 rounded-xl bg-brand-gold/20 flex items-center justify-center">
                       <Send size={14} className="text-brand-gold" />
                     </div>
                     <div>
                       <p className="text-[11px] font-bold">Mensaje a {supplier.name}</p>
                       <p className="text-[8px] text-brand-paper/40">Re: Factura {msgInvoice.id} · {CURRENCY_FORMATTER.format(msgInvoice.amount)}</p>
                     </div>
                   </div>
                   <button onClick={() => setMsgInvoice(null)}><X size={16} className="text-brand-paper/40 hover:text-brand-paper" /></button>
                 </div>

                 {/* Conversation history */}
                 <div className="flex-1 overflow-y-auto" style={{ minHeight: 120 }}>
                   {convo.length > 0 && (
                     <div className="p-5 space-y-2.5 border-b border-brand-sand/20">
                       <p className="text-[8px] font-bold text-brand-ink/30 uppercase tracking-wider">Historial de conversación</p>
                       {convo.slice(-6).map(msg => (
                         <div key={msg.id} className={`flex ${msg.from === 'corporate' ? 'justify-end' : 'justify-start'}`}>
                           <div className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 ${
                             msg.from === 'corporate'
                               ? 'bg-brand-ink text-brand-paper rounded-br-md'
                               : 'bg-brand-bone text-brand-ink border border-brand-sand/20 rounded-bl-md'
                           }`}>
                             <div className="flex items-center gap-2 mb-0.5">
                               <span className={`text-[7px] font-bold uppercase tracking-wider ${msg.from === 'corporate' ? 'text-brand-gold' : 'text-brand-ink/30'}`}>
                                 {msg.from === 'corporate' ? '🏢 Corporativo' : `📦 ${supplier.name.split(' ')[0]}`}
                               </span>
                             </div>
                             <p className="text-[10px] leading-relaxed">{msg.text}</p>
                             <p className={`text-[7px] mt-1 ${msg.from === 'corporate' ? 'text-brand-paper/30' : 'text-brand-ink/20'}`}>
                               {new Date(msg.date).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })} · {new Date(msg.date).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                             </p>
                           </div>
                         </div>
                       ))}
                     </div>
                   )}

                   {/* Templates */}
                   {!msgSent && (
                     <div className="px-5 py-4 space-y-3">
                       <p className="text-[8px] font-bold text-brand-ink/30 uppercase tracking-wider">Mensajes predeterminados — clic para usar</p>
                       <div className="grid grid-cols-1 gap-2">
                         {templates.map((t, i) => (
                           <button key={i} onClick={() => setMsgText(t.text)}
                             className={`text-left px-4 py-3 rounded-xl border transition-all ${msgText === t.text ? 'border-brand-gold bg-brand-gold/5 ring-1 ring-brand-gold/30' : 'border-brand-sand/20 hover:border-brand-gold/40 hover:bg-brand-bone/50'}`}>
                             <p className="text-[9px] font-bold text-brand-ink flex items-center gap-1.5">
                               {i === 0 && msgInvoice.forensicStatus === 'DISCREPANCY' ? <AlertTriangle size={10} className="text-amber-500" /> :
                                i === 0 && msgInvoice.forensicStatus === 'BLOCKED' ? <Shield size={10} className="text-red-500" /> :
                                <FileText size={10} className="text-brand-ink/30" />}
                               {t.label}
                             </p>
                             <p className="text-[8px] text-brand-ink/40 mt-1 leading-relaxed line-clamp-2">{t.text.slice(0, 120)}…</p>
                           </button>
                         ))}
                       </div>
                     </div>
                   )}

                   {/* Sent confirmation */}
                   {msgSent && (
                     <div className="px-5 py-8 text-center space-y-3">
                       <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mx-auto">
                         <CheckCircle2 size={28} className="text-green-500" />
                       </div>
                       <h3 className="text-lg font-serif text-brand-ink">Mensaje enviado</h3>
                       <p className="text-[10px] text-brand-ink/40">El proveedor verá este mensaje en su portal y podrá responder o subir la aclaración directamente.</p>
                     </div>
                   )}
                 </div>

                 {/* Compose area */}
                 {!msgSent && (
                   <div className="p-5 border-t border-brand-sand/20 flex-shrink-0 space-y-3">
                     <textarea value={msgText} onChange={e => setMsgText(e.target.value)} rows={3}
                       placeholder="Escribe un mensaje o selecciona una plantilla..."
                       className="w-full px-4 py-3 bg-brand-bone border border-brand-sand/30 rounded-xl text-[10px] outline-none focus:border-brand-gold resize-none leading-relaxed" />
                     <div className="flex gap-2">
                       <button onClick={() => setMsgInvoice(null)}
                         className="px-5 py-2.5 border border-brand-sand/30 text-brand-ink/50 rounded-xl text-[9px] font-bold uppercase tracking-wider hover:bg-brand-bone transition-all">
                         Cancelar
                       </button>
                       <button onClick={() => {
                         if (msgText.trim()) {
                           SupplierMessageService.send(supplier.id, supplier.name, 'corporate', msgText.trim());
                           setMsgSent(true);
                         }
                       }} disabled={!msgText.trim()}
                         className="flex-1 py-2.5 bg-brand-ink text-brand-paper rounded-xl text-[9px] font-bold uppercase tracking-wider hover:bg-brand-gold hover:text-brand-ink transition-all disabled:opacity-30 flex items-center justify-center gap-2">
                         <Send size={11} /> Enviar al Proveedor
                       </button>
                     </div>
                   </div>
                 )}
                 {msgSent && (
                   <div className="p-4 border-t border-brand-sand/20 flex-shrink-0">
                     <button onClick={() => setMsgInvoice(null)}
                       className="w-full py-2.5 bg-brand-ink text-brand-paper rounded-xl text-[9px] font-bold uppercase tracking-wider">
                       Cerrar
                     </button>
                   </div>
                 )}
               </motion.div>
             </motion.div>
           );
         })()}
       </AnimatePresence>
    </div>
  );
}

function InvoiceDetailModal({ invoice, onClose }: { invoice: Invoice, onClose: () => void }) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-brand-ink/80 backdrop-blur-md"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="max-w-md w-full bg-brand-paper rounded-[3rem] p-12 space-y-10 shadow-2xl relative overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="absolute top-0 left-0 w-full h-2 bg-brand-gold" />
        
        <header className="flex justify-between items-start">
          <div className="space-y-2">
            <span className="label-caps !text-brand-gold">
              {invoice.status === 'paid' ? 'Comprobante de Pago' : 'Detalles de Factura'}
            </span>
            <h3 className="text-3xl text-brand-ink">{invoice.id}</h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-brand-bone rounded-full transition-colors opacity-30 hover:opacity-100">
            <LogOut size={20} className="rotate-90" />
          </button>
        </header>

        <div className="space-y-8">
          <div className="grid grid-cols-2 gap-8">
            <DetailItem label={invoice.status === 'paid' ? "Monto Liquidado" : "Monto"} value={CURRENCY_FORMATTER.format(invoice.amount)} />
            <DetailItem label={invoice.status === 'paid' ? "Fecha de Pago" : "Fecha de Emisión"} value={invoice.date} />
            <DetailItem label="Orden de Compra" value={`PO-${invoice.poNumber}`} />
            <DetailItem label="Estatus Actual" value={invoice.status === 'paid' ? 'Liquidadas' : (invoice.status === 'audited' ? 'Auditada' : 'Pendiente')} />
            <DetailItem label="Tipo de Pago" value={invoice.paymentType || 'PUE'} />
            <DetailItem label="Forma de Pago" value={invoice.paymentMethod || '03 - Transferencia'} />
            <DetailItem label="Uso de CFDI" value={invoice.cfdiUse || 'G03 - Gastos en general'} />
          </div>

          <div className="p-6 bg-brand-bone rounded-3xl border border-brand-sand/50 space-y-4">
            <h4 className="label-caps !opacity-40">Documentos de Respaldo</h4>
            <div className="space-y-3">
              <DocumentLink label="Factura PDF" />
              <DocumentLink label="Certificado XML Timbrado" />
              {invoice.status === 'paid' && <DocumentLink label="SPEI / Comprobante Bancario" />}
              <DocumentLink label="Dictamen de Auditoría Triple Match" />
            </div>
          </div>
        </div>

        <div className="pt-6 flex justify-center">
          <div className="flex items-center gap-3 text-green-600">
            <ShieldCheck size={18} />
            <span className="text-[10px] uppercase font-extrabold tracking-[0.2em]">Transacción Protegida e Inmutable</span>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function DocumentLink({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-between group cursor-pointer hover:bg-white p-2 rounded-xl transition-all">
      <span className="text-[10px] font-serif text-brand-ink/60">{label}</span>
      <ChevronRight size={12} className="opacity-0 group-hover:opacity-40 transition-opacity" />
    </div>
  );
}


function DetailItem({ label, value }: { label: string, value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase font-bold tracking-wider opacity-30">{label}</p>
      <p className="text-xs font-serif text-brand-ink/80">{value}</p>
    </div>
  );
}

// ─── Exportaciones CSV reales (facturas / proveedores / pagos) ───────────────
function CsvExportsBar() {
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

// ─── Estado de Resultados REAL (backend /fiscal/statements) ──────────────────
// Genera el estado de resultados de un mes a partir de las facturas reales.
// Los egresos vienen del backend (base sin IVA repartida en costo/OPEX según
// el costRatio de la organización); el ingreso lo captura el usuario.
function EstadoResultadosReal() {
  const now = new Date();
  const [month, setMonth] = useState<string>(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  const [revenue, setRevenue] = useState('');
  const [result, setResult] = useState<StatementApi | null>(null);
  const [list, setList] = useState<StatementApi[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const loadList = React.useCallback(() => {
    api.getStatements().then(setList).catch(() => setList([]));
  }, []);
  React.useEffect(() => { loadList(); }, [loadList]);

  const handleGenerate = async () => {
    setBusy(true); setErr(null);
    try {
      const rev = revenue.trim() ? Number(revenue.replace(/[^0-9.]/g, '')) : undefined;
      const r = await api.generateStatement(month, rev);
      setResult(r);
      loadList();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'No se pudo generar el estado.');
    } finally {
      setBusy(false);
    }
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

// ─── Historial / Archivo Corporativo ────────────────────────────────────────

function HistorialView({ invoices }: { invoices: Invoice[] }) {
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

// ─── Datos de la organización (Configuración → Organización) ─────────────────
function OrgSettingsForm() {
  const [form, setForm] = useState({
    displayName: '', fiscalRegimen: '', fiscalAddress: '',
    documentAlertDays: 15, factorajeFeePercent: 0, costRatio: 0.65, erpProvider: '',
  });
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api.getSettings().then(s => {
      setForm({
        displayName: s.displayName ?? '',
        fiscalRegimen: s.fiscalRegimen ?? '',
        fiscalAddress: s.fiscalAddress ?? '',
        documentAlertDays: s.documentAlertDays ?? 15,
        factorajeFeePercent: s.factorajeFeePercent ?? 0,
        costRatio: s.costRatio ?? 0.65,
        erpProvider: s.erpProvider ?? '',
      });
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  const save = async () => {
    setBusy(true); setErr(null); setMsg(null);
    try {
      await api.updateSettings({
        displayName: form.displayName || undefined,
        fiscalRegimen: form.fiscalRegimen || undefined,
        fiscalAddress: form.fiscalAddress || undefined,
        documentAlertDays: Number(form.documentAlertDays),
        factorajeFeePercent: Number(form.factorajeFeePercent),
        costRatio: Number(form.costRatio),
        erpProvider: form.erpProvider || null,
      });
      setMsg('Configuración guardada.');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'No se pudo guardar.');
    } finally { setBusy(false); }
  };

  const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div>
      <label className="text-[9px] uppercase font-bold tracking-widest text-brand-ink/40 block mb-1.5">{label}</label>
      {children}
    </div>
  );
  const inputCls = "w-full px-4 py-3 bg-white border border-brand-sand rounded-xl text-sm focus:outline-none focus:border-brand-gold";

  return (
    <div className="editorial-card space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-brand-gold/15 flex items-center justify-center"><Building2 size={18} className="text-brand-gold" /></div>
        <div>
          <h3 className="text-lg font-serif text-brand-ink">Datos de la Organización</h3>
          <p className="text-[10px] text-brand-ink/40 font-serif">Régimen fiscal, alertas y parámetros operativos usados en reportes y cálculos.</p>
        </div>
      </div>
      {!loaded ? (
        <p className="text-[11px] text-brand-ink/40 font-serif flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Cargando...</p>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Nombre visible en reportes">
              <input className={inputCls} value={form.displayName} onChange={e => setForm({ ...form, displayName: e.target.value })} placeholder="Royáltica Demo" />
            </Field>
            <Field label="Régimen fiscal">
              <input className={inputCls} value={form.fiscalRegimen} onChange={e => setForm({ ...form, fiscalRegimen: e.target.value })} placeholder="601 - General de Ley PM" />
            </Field>
            <Field label="Dirección fiscal">
              <input className={inputCls} value={form.fiscalAddress} onChange={e => setForm({ ...form, fiscalAddress: e.target.value })} placeholder="Calle, número, colonia, CP" />
            </Field>
            <Field label="ERP para sincronización">
              <select className={inputCls} value={form.erpProvider} onChange={e => setForm({ ...form, erpProvider: e.target.value })}>
                <option value="">Ninguno</option>
                <option value="aspel">Aspel</option>
                <option value="bind">Bind ERP</option>
                <option value="odoo">Odoo</option>
              </select>
            </Field>
            <Field label="Días de alerta de documentos por vencer">
              <input type="number" min={1} max={90} className={inputCls} value={form.documentAlertDays} onChange={e => setForm({ ...form, documentAlertDays: Number(e.target.value) })} />
            </Field>
            <Field label="Comisión de factoraje (%) — 0.05 = 5%">
              <input type="number" step="0.01" min={0} max={1} className={inputCls} value={form.factorajeFeePercent} onChange={e => setForm({ ...form, factorajeFeePercent: Number(e.target.value) })} />
            </Field>
            <Field label="Razón de costo (costRatio) — 0.65 = 65%">
              <input type="number" step="0.01" min={0} max={1} className={inputCls} value={form.costRatio} onChange={e => setForm({ ...form, costRatio: Number(e.target.value) })} />
            </Field>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={save} disabled={busy} className="flex items-center gap-2 px-6 py-3 bg-brand-ink text-brand-bone rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-brand-gold hover:text-brand-ink transition-all disabled:opacity-50">
              {busy ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} {busy ? 'Guardando...' : 'Guardar Cambios'}
            </button>
            {msg && <span className="text-[10px] font-bold text-green-700 flex items-center gap-1.5"><CheckCircle2 size={12} /> {msg}</span>}
            {err && <span className="text-[10px] font-bold text-red-600 flex items-center gap-1.5"><AlertTriangle size={12} /> {err}</span>}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Alertas por WhatsApp (por usuario) ──────────────────────────────────────
// ─── Seguridad: activación de 2FA TOTP real (por usuario) ───
function TwoFactorSetupPanel() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [setup, setSetup] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.me().then(u => setEnabled(Boolean(u.totpEnabled))).catch(() => setEnabled(false));
  }, []);

  const startSetup = async () => {
    setBusy(true); setMsg('');
    try { setSetup(await api.setup2fa()); }
    catch (e) { setMsg(e instanceof Error ? e.message : 'No se pudo generar el secreto.'); }
    setBusy(false);
  };

  const confirm = async () => {
    setBusy(true); setMsg('');
    try {
      await api.enable2fa(code.trim());
      setEnabled(true); setSetup(null); setCode('');
      setMsg('✓ 2FA activado. A partir de ahora el login pedirá el código de tu app.');
    } catch { setMsg('Código incorrecto. Revisa tu app autenticadora.'); }
    setBusy(false);
  };

  const turnOff = async () => {
    setBusy(true); setMsg('');
    try { await api.disable2fa(code.trim()); setEnabled(false); setCode(''); setMsg('2FA desactivado.'); }
    catch { setMsg('Código incorrecto.'); }
    setBusy(false);
  };

  return (
    <div className="editorial-card space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-brand-ink flex items-center gap-2"><Shield size={14} className="text-brand-gold" /> Autenticación de dos factores (2FA)</h4>
        {enabled !== null && (
          <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded-full ${enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-brand-sand/30 text-brand-ink/50'}`}>
            {enabled ? 'Activo' : 'Inactivo'}
          </span>
        )}
      </div>
      <p className="text-[10px] text-brand-ink/50">Código TOTP de 6 dígitos con Google Authenticator, Authy o 1Password. El secreto se guarda cifrado en el servidor.</p>

      {enabled === false && !setup && (
        <button onClick={startSetup} disabled={busy} className="px-4 py-2 bg-brand-ink text-brand-paper rounded-xl text-[10px] font-bold uppercase tracking-widest disabled:opacity-40">Activar 2FA</button>
      )}

      {setup && (
        <div className="space-y-3 border border-brand-sand/40 rounded-2xl p-4 bg-brand-cream/40">
          <p className="text-[10px] text-brand-ink/70 font-bold">1. Agrega esta clave en tu app autenticadora (o abre el enlace en el teléfono):</p>
          <p className="font-mono text-[11px] bg-white rounded-lg px-3 py-2 break-all select-all">{setup.secret}</p>
          <a href={setup.otpauthUrl} className="text-[9px] text-brand-gold underline break-all">{setup.otpauthUrl}</a>
          <p className="text-[10px] text-brand-ink/70 font-bold">2. Escribe el código que muestra la app:</p>
          <div className="flex gap-2">
            <input value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000"
              className="w-28 px-3 py-2 border border-brand-sand/50 rounded-xl text-sm font-mono text-center focus:outline-none focus:border-brand-gold" />
            <button onClick={confirm} disabled={busy || code.length !== 6} className="px-4 py-2 bg-brand-gold text-brand-ink rounded-xl text-[10px] font-bold uppercase tracking-widest disabled:opacity-40">Confirmar</button>
          </div>
        </div>
      )}

      {enabled && (
        <div className="flex gap-2 items-center">
          <input value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="Código actual"
            className="w-32 px-3 py-2 border border-brand-sand/50 rounded-xl text-xs font-mono text-center focus:outline-none focus:border-brand-gold" />
          <button onClick={turnOff} disabled={busy || code.length !== 6} className="px-4 py-2 border border-red-300 text-red-600 rounded-xl text-[10px] font-bold uppercase tracking-widest disabled:opacity-40">Desactivar</button>
        </div>
      )}

      {msg && <p className="text-[10px] text-brand-ink/60">{msg}</p>}
    </div>
  );
}

function WhatsappPrefsPanel() {
  const [optIn, setOptIn] = useState(false);
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api.getWhatsappPrefs().then(p => { setOptIn(p.optIn); setPhone(p.phone ?? ''); }).catch(() => {});
  }, []);

  const save = async (nextOptIn: boolean) => {
    setBusy(true); setErr(null); setMsg(null);
    try {
      const p = await api.setWhatsappPrefs(nextOptIn, phone.trim() || undefined);
      setOptIn(p.optIn); setPhone(p.phone ?? '');
      setMsg(p.optIn ? 'Alertas por WhatsApp activadas.' : 'Alertas por WhatsApp desactivadas.');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'No se pudo guardar.');
    } finally { setBusy(false); }
  };

  return (
    <div className="editorial-card space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center"><Bell size={18} className="text-green-600" /></div>
        <div>
          <h3 className="text-lg font-serif text-brand-ink">Mis Alertas por WhatsApp</h3>
          <p className="text-[10px] text-brand-ink/40 font-serif">Recibe alertas críticas (factura bloqueada, pago fallido, documento por vencer) en tu WhatsApp.</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+5215512345678 (formato E.164)"
          className="px-4 py-3 bg-white border border-brand-sand rounded-xl text-sm focus:outline-none focus:border-brand-gold w-64" />
        <button onClick={() => save(!optIn)} disabled={busy}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all disabled:opacity-50 ${optIn ? 'bg-white border border-red-200 text-red-600 hover:bg-red-50' : 'bg-green-600 text-white hover:bg-green-700'}`}>
          {busy ? <Loader2 size={14} className="animate-spin" /> : optIn ? <X size={14} /> : <CheckCircle2 size={14} />}
          {busy ? '...' : optIn ? 'Desactivar' : 'Activar alertas'}
        </button>
        <span className={`text-[9px] font-bold px-2 py-1 rounded-full ${optIn ? 'bg-green-100 text-green-700' : 'bg-brand-sand/40 text-brand-ink/40'}`}>{optIn ? 'ACTIVO' : 'INACTIVO'}</span>
      </div>
      {msg && <p className="text-[10px] font-bold text-green-700 flex items-center gap-1.5"><CheckCircle2 size={12} /> {msg}</p>}
      {err && <p className="text-[10px] font-bold text-red-600 flex items-center gap-1.5"><AlertTriangle size={12} /> {err}</p>}
    </div>
  );
}

// ─── Conectividad ERP (Configuración → Integraciones) ────────────────────────
// ─── Gestión de Usuarios (Configuración → Usuarios) ──────────────────────────
// Invita usuarios reales (POST /users/invite), lista los de la organización y
// permite activar/desactivar (revocación inmediata en el backend).
const USER_AREA_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  proveedores: 'Proveedores',
  finanzas: 'Finanzas / Facturas',
  factoraje: 'Factoraje',
  pagos: 'Pagos',
  estados: 'Estados / DIOT',
  notificaciones: 'Notificaciones',
  configuracion: 'Configuración',
};
const USER_AREAS = Object.keys(USER_AREA_LABELS);

function UsersManager() {
  const [users, setUsers] = useState<ApiUserRow[]>([]);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'CORPORATE_USER' | 'CORPORATE_ADMIN'>('CORPORATE_USER');
  const [perms, setPerms] = useState<string[]>(['dashboard']);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = React.useCallback(() => {
    api.getUsers().then(setUsers).catch(() => setUsers([]));
  }, []);
  React.useEffect(() => { load(); }, [load]);

  const togglePerm = (a: string) =>
    setPerms(p => (p.includes(a) ? p.filter(x => x !== a) : [...p, a]));

  const handleInvite = async () => {
    if (!email.trim() || !name.trim()) { setErr('Nombre y correo son obligatorios.'); return; }
    setBusy(true); setErr(null); setMsg(null);
    try {
      const res = await api.inviteUser({
        email: email.trim(),
        name: name.trim(),
        role,
        permissions: role === 'CORPORATE_USER' ? perms : undefined,
      });
      setMsg(res.inviteLink ? `Invitación creada para ${email.trim()}.` : `Usuario ${email.trim()} dado de alta.`);
      setEmail(''); setName(''); setPerms(['dashboard']); setRole('CORPORATE_USER');
      load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'No se pudo invitar al usuario.');
    } finally {
      setBusy(false);
    }
  };

  const toggleStatus = async (u: ApiUserRow) => {
    try {
      await api.setUserStatus(u.id, u.status !== 'ACTIVE');
      load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'No se pudo cambiar el estatus.');
    }
  };

  const roleLabel = (r: string) =>
    r === 'CORPORATE_ADMIN' ? 'Administrador' : r === 'CORPORATE_USER' ? 'Operativo' : r === 'SUPERADMIN' ? 'Superadmin' : r;

  return (
    <div className="space-y-6">
      {/* Formulario de invitación */}
      <div className="editorial-card space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-gold/15 flex items-center justify-center">
            <UserPlus size={18} className="text-brand-gold" />
          </div>
          <div>
            <h3 className="text-lg font-serif text-brand-ink">Invitar Usuario</h3>
            <p className="text-[10px] text-brand-ink/40 font-serif">Sistema por invitación · el usuario recibe acceso a las áreas que definas</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Nombre completo"
            className="px-4 py-3 bg-white border border-brand-sand rounded-xl text-sm focus:outline-none focus:border-brand-gold" />
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="correo@empresa.com"
            className="px-4 py-3 bg-white border border-brand-sand rounded-xl text-sm focus:outline-none focus:border-brand-gold" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[9px] uppercase font-bold tracking-widest text-brand-ink/40">Rol</span>
          <button onClick={() => setRole('CORPORATE_USER')}
            className={`px-4 py-2 rounded-xl text-[9px] font-bold uppercase tracking-widest transition-all ${role === 'CORPORATE_USER' ? 'bg-brand-ink text-brand-paper' : 'bg-white border border-brand-sand text-brand-ink/40 hover:text-brand-ink'}`}>
            Operativo
          </button>
          <button onClick={() => setRole('CORPORATE_ADMIN')}
            className={`px-4 py-2 rounded-xl text-[9px] font-bold uppercase tracking-widest transition-all ${role === 'CORPORATE_ADMIN' ? 'bg-brand-ink text-brand-paper' : 'bg-white border border-brand-sand text-brand-ink/40 hover:text-brand-ink'}`}>
            Administrador
          </button>
          <span className="text-[9px] text-brand-ink/30 font-serif">
            {role === 'CORPORATE_ADMIN' ? 'Ve todas las áreas' : 'Selecciona las áreas visibles abajo'}
          </span>
        </div>
        {role === 'CORPORATE_USER' && (
          <div className="flex flex-wrap gap-2">
            {USER_AREAS.map(a => (
              <button key={a} onClick={() => togglePerm(a)}
                className={`px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all ${perms.includes(a) ? 'bg-brand-gold text-brand-ink' : 'bg-white border border-brand-sand text-brand-ink/40 hover:text-brand-ink'}`}>
                {USER_AREA_LABELS[a]}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-center gap-3">
          <button onClick={handleInvite} disabled={busy}
            className="flex items-center gap-2 px-6 py-3 bg-brand-ink text-brand-bone rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-brand-gold hover:text-brand-ink transition-all disabled:opacity-50">
            {busy ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
            {busy ? 'Invitando...' : 'Enviar Invitación'}
          </button>
          {msg && <span className="text-[10px] font-bold text-green-700 flex items-center gap-1.5"><CheckCircle2 size={12} /> {msg}</span>}
          {err && <span className="text-[10px] font-bold text-red-600 flex items-center gap-1.5"><AlertTriangle size={12} /> {err}</span>}
        </div>
      </div>

      {/* Lista de usuarios */}
      <div className="editorial-card !p-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-brand-sand/30 flex items-center justify-between">
          <h4 className="text-sm font-bold text-brand-ink flex items-center gap-2"><Users size={14} className="text-brand-gold" /> Usuarios de la Organización</h4>
          <span className="text-[9px] text-brand-ink/30 font-mono">{users.length} usuario{users.length !== 1 ? 's' : ''}</span>
        </div>
        {users.length === 0 ? (
          <p className="px-6 py-8 text-center text-[11px] text-brand-ink/40 font-serif">No hay usuarios cargados (o no tienes permisos de administrador).</p>
        ) : (
          <table className="w-full text-left">
            <thead className="bg-brand-bone/40">
              <tr>
                <th className="px-6 py-3 text-[8px] uppercase tracking-widest font-bold text-brand-ink/30">Usuario</th>
                <th className="px-6 py-3 text-[8px] uppercase tracking-widest font-bold text-brand-ink/30">Rol</th>
                <th className="px-6 py-3 text-[8px] uppercase tracking-widest font-bold text-brand-ink/30">Estatus</th>
                <th className="px-6 py-3 text-[8px] uppercase tracking-widest font-bold text-brand-ink/30 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-sand/10">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-brand-bone/20 transition-colors">
                  <td className="px-6 py-3">
                    <p className="text-[12px] font-bold text-brand-ink">{u.name}</p>
                    <p className="text-[9px] font-mono text-brand-ink/40">{u.email}</p>
                  </td>
                  <td className="px-6 py-3 text-[10px] text-brand-ink/60">{roleLabel(u.role)}</td>
                  <td className="px-6 py-3">
                    <span className={`text-[8px] font-bold px-2 py-0.5 rounded-full ${u.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : u.status === 'INVITED' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {u.status === 'ACTIVE' ? 'Activo' : u.status === 'INVITED' ? 'Invitado' : u.status === 'SUSPENDED' ? 'Suspendido' : u.status}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-right">
                    {u.role !== 'SUPERADMIN' && (
                      <button onClick={() => toggleStatus(u)}
                        className={`px-3 py-1.5 rounded-lg text-[8px] font-bold uppercase tracking-widest transition-all ${u.status === 'ACTIVE' ? 'bg-white border border-red-200 text-red-600 hover:bg-red-50' : 'bg-white border border-green-200 text-green-600 hover:bg-green-50'}`}>
                        {u.status === 'ACTIVE' ? 'Desactivar' : 'Activar'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function SettingsView({
  currentTheme,
  onThemeChange,
  onUndo,
  defaultTheme,
  totalBudget,
  onBudgetChange
}: {
  currentTheme: any,
  onThemeChange: (t: any) => void,
  onUndo: () => void,
  defaultTheme: any,
  totalBudget: number,
  onBudgetChange: (b: number) => void
}) {
  const [activeSection, setActiveSection] = useState<'erp' | 'manual' | 'design' | 'auth' | 'budget' | 'usuarios' | 'organizacion' | 'integraciones'>('erp');
  const [archiveSearch, setArchiveSearch] = useState('');
  const [selectedArchiveSupplier, setSelectedArchiveSupplier] = useState<Supplier | null>(null);
  const [modalTab, setModalTab] = useState<'docs' | 'trail'>('docs');
  // Supplier messaging state
  const [chatSupplier, setChatSupplier] = useState<Supplier | null>(null);
  const [chatReply, setChatReply] = useState('');
  const [allMsgs, setAllMsgs] = useState<SupplierMessage[]>(SupplierMessageService.getAll());
  useEffect(() => {
    SupplierMessageService.subscribe(setAllMsgs);
    return () => SupplierMessageService.unsubscribe(setAllMsgs);
  }, []);
  const [auditTrails, setAuditTrails] = useState<Record<string, FiscalAuditEvent[]>>(DualLoggerService.getTrails());

  useEffect(() => {
    const handler: AuditSubscriber = (_l, t) => setAuditTrails({ ...t });
    DualLoggerService.subscribe(handler);
    return () => DualLoggerService.unsubscribe(handler);
  }, []);
  // Design Specific State
  const [tempTheme, setTempTheme] = useState(currentTheme);
  const [searchColor, setSearchColor] = useState('');
  const [isSaved, setIsSaved] = useState(false);
  // ─── New: Dark Mode & localStorage ───
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('royaltica_dark_mode') === 'true');
  const [customLogo, setCustomLogo] = useState<string | null>(() => localStorage.getItem('royaltica_custom_logo'));
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');

  useEffect(() => {
    setTempTheme(currentTheme);
  }, [currentTheme]);

  // Save dark mode preference
  useEffect(() => {
    localStorage.setItem('royaltica_dark_mode', String(darkMode));
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const handleColorChange = (key: string, value: string) => {
    const newTheme = { ...tempTheme, [key]: value };
    setTempTheme(newTheme);
    onThemeChange(newTheme); // Immediate preview
    setIsSaved(false);
  };

  const saveSettings = () => {
    // Persist theme to localStorage
    localStorage.setItem('royaltica_theme', JSON.stringify(currentTheme));
    localStorage.setItem('royaltica_dark_mode', String(darkMode));
    if (customLogo) localStorage.setItem('royaltica_custom_logo', customLogo);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setCustomLogo(result);
        localStorage.setItem('royaltica_custom_logo', result);
      };
      reader.readAsDataURL(file);
    }
  };

  const erpOptions = [
    { name: 'SAP Business One', logo: 'https://upload.wikimedia.org/wikipedia/commons/5/59/SAP_2011_logo.svg', description: 'Integración vía API para empresas de alto crecimiento.' },
    { name: 'Oracle NetSuite', logo: 'https://upload.wikimedia.org/wikipedia/commons/5/52/NetSuite_Logo.svg', description: 'Sincronización automatizada de cuentas por pagar.' },
    { name: 'CONTPAQi', logo: 'https://www.contpaqi.com/favicon-32x32.png', description: 'Importación estándar desde ficheros XML y reportes.' },
    { name: 'Aspel SAE', logo: 'https://www.aspel.com.mx/favicon.ico', description: 'Conexión directa con la base de datos local.' }
  ];

  const filteredArchiveSuppliers = MOCK_SUPPLIERS.filter(s => 
    s.name.toLowerCase().includes(archiveSearch.toLowerCase()) || 
    s.rfc.toLowerCase().includes(archiveSearch.toLowerCase())
  );

  return (
    <div className="space-y-8 pb-20 relative">
      {/* Archive Modal (File Vault) Code remain same... */}
      <AnimatePresence>
        {selectedArchiveSupplier && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-start justify-center p-6 pt-12 bg-brand-ink/40 backdrop-blur-md overflow-y-auto"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-brand-bone rounded-[3rem] shadow-2xl w-full max-w-2xl border border-brand-sand/50 my-auto"
            >
              <div className="flex justify-between items-start p-10 bg-white border-b border-brand-sand/20">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-gold bg-brand-gold/10 px-3 py-1 rounded-full">Expediente Digital</span>
                    <span className="text-[10px] font-mono opacity-40">{selectedArchiveSupplier.rfc}</span>
                  </div>
                  <h3 className="text-4xl font-serif text-brand-ink">{selectedArchiveSupplier.name}</h3>
                </div>
                <button onClick={() => setSelectedArchiveSupplier(null)} className="p-3 hover:bg-brand-bone rounded-full transition-colors">
                  <X size={24} />
                </button>
              </div>

              {/* Modal Tabs */}
              <div className="flex gap-1 px-6 pt-5 bg-white border-b border-brand-sand/20">
                <button
                  onClick={() => setModalTab('docs')}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-t-xl text-[10px] font-bold uppercase tracking-widest transition-all ${
                    modalTab === 'docs'
                      ? 'bg-brand-bone border border-b-brand-bone border-brand-sand/30 text-brand-ink -mb-px'
                      : 'text-brand-ink/30 hover:text-brand-ink'
                  }`}
                >
                  <FileText size={12} /> Documentos
                </button>
                <button
                  onClick={() => setModalTab('trail')}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-t-xl text-[10px] font-bold uppercase tracking-widest transition-all ${
                    modalTab === 'trail'
                      ? 'bg-brand-bone border border-b-brand-bone border-brand-sand/30 text-brand-gold -mb-px'
                      : 'text-brand-ink/30 hover:text-brand-ink'
                  }`}
                >
                  <BookOpen size={12} /> Pista de Auditoría
                  {(auditTrails[selectedArchiveSupplier.id]?.length ?? 0) > 0 && (
                    <span className="bg-brand-gold text-brand-ink text-[8px] font-black px-1.5 py-0.5 rounded-full">
                      {auditTrails[selectedArchiveSupplier.id].length}
                    </span>
                  )}
                </button>
              </div>
              {/* Tab content */}
              {modalTab === 'docs' && (
                <div className="p-10 grid grid-cols-1 md:grid-cols-2 gap-6">
                  {[
                    { name: 'Acta Constitutiva.pdf', type: 'Legal', date: '2024-01-15' },
                    { name: 'Opinion_32D_Positiva.pdf', type: 'Fiscal', date: '2024-04-10' },
                    { name: 'Identificacion_Vigente.pdf', type: 'Identificación', date: '2023-11-20' },
                    { name: 'Comprobante_Domicilio.pdf', type: 'Dirección', date: '2024-03-05' },
                    { name: 'Contrato_Maestro_Final.pdf', type: 'Contrato', date: '2024-02-12' },
                    { name: 'Registro_Patronal_IMSS.pdf', type: 'Laboral', date: '2024-01-22' },
                  ].map((file, i) => (
                    <div key={i} className="flex items-center gap-4 p-4 rounded-3xl bg-white border border-brand-sand/20 hover:border-brand-gold transition-colors group cursor-pointer">
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
                      <Download size={14} className="opacity-0 group-hover:opacity-40" />
                    </div>
                  ))}
                </div>
              )}

              {modalTab === 'trail' && (
                <div className="">
                  {(auditTrails[selectedArchiveSupplier.id] ?? []).length === 0 ? (
                    <div className="p-14 text-center">
                      <BookOpen size={32} className="mx-auto mb-3 text-brand-sand" />
                      <p className="text-sm font-serif text-brand-ink/30">Sin eventos registrados para este proveedor.</p>
                      <p className="text-[10px] text-brand-ink/20 mt-1">Los logs se crearán desde la pestaña Auditoría.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-brand-sand/30">
                      {(auditTrails[selectedArchiveSupplier.id] ?? []).map((evt, i) => {
                        const TYPE_BADGE: Record<FiscalAuditEvent['event_type'], { label: string; color: string }> = {
                          REP:            { label: 'REP',          color: 'bg-blue-100 text-blue-700' },
                          DIOT:           { label: 'DIOT',         color: 'bg-purple-100 text-purple-700' },
                          PAGO_GLOBAL:    { label: 'Pago Global',  color: 'bg-orange-100 text-orange-700' },
                          ERP_SYNC:       { label: 'ERP Sync',     color: 'bg-teal-100 text-teal-700' },
                          CFDI_TIMBRADO:  { label: 'CFDI',         color: 'bg-brand-gold/20 text-brand-gold' },
                          PAGO_EFECTUADO: { label: 'Pago',         color: 'bg-green-100 text-green-700' },
                        };
                        const badge = TYPE_BADGE[evt.event_type];
                        return (
                          <div key={evt.id} className="flex items-start gap-4 px-8 py-5 hover:bg-white transition-colors group">
                            <div className="mt-0.5 flex-shrink-0 w-8 h-8 rounded-full bg-brand-sand/30 flex items-center justify-center">
                              <Activity size={14} className="text-brand-ink/40" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <span className={`text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${badge.color}`}>{badge.label}</span>
                                <span className="text-[9px] font-mono text-brand-ink/30">{evt.cfdi_uuid}</span>
                              </div>
                              <p className="text-[11px] font-bold text-brand-ink">{CURRENCY_FORMATTER.format(evt.amount)}</p>
                              <div className="flex items-center gap-3 mt-0.5">
                                <span className="text-[9px] text-brand-ink/30 font-serif">{new Date(evt.timestamp).toLocaleString('es-MX')}</span>
                                <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full ${
                                  evt.status === 'Reportado al SAT' ? 'bg-green-100 text-green-700'
                                  : evt.status === 'Sincronizado ERP' ? 'bg-teal-100 text-teal-700'
                                  : evt.status === 'Error' ? 'bg-red-100 text-red-600'
                                  : 'bg-yellow-100 text-yellow-700'
                                }`}>{evt.status}</span>
                              </div>
                            </div>
                            <a
                              href={evt.storage_url}
                              className="opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity flex-shrink-0 p-2 hover:bg-brand-sand/20 rounded-lg"
                              title="Ver documento"
                            >
                              <Download size={13} className="text-brand-ink" />
                            </a>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
              
              <div className="p-8 bg-brand-bone/50 border-t border-brand-sand/20 flex justify-center">
                <button className="flex items-center gap-3 px-8 py-4 bg-brand-ink text-brand-bone rounded-2xl text-[10px] uppercase font-black tracking-widest hover:bg-brand-gold hover:text-brand-ink transition-all">
                  <UploadCloud size={16} /> Cargar Nuevo Documento
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col gap-2">
        <h2 className="text-4xl font-serif text-brand-ink">Configuración de Sistema</h2>
        <p className="text-sm text-brand-ink/40 font-medium">Gestiona integraciones, proveedores y el repositorio de documentos corporativos.</p>
      </div>

      {/* Settings Navigation */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex gap-4 p-1 bg-brand-bone border border-brand-sand/30 rounded-2xl w-fit">
          {[
            { id: 'organizacion', label: 'Organización', icon: <Building2 size={14} /> },
            { id: 'erp', label: 'Conexión ERP', icon: <Database size={14} /> },
            { id: 'integraciones', label: 'Integraciones', icon: <Webhook size={14} /> },
            { id: 'manual', label: 'Alta Manual', icon: <UserPlus size={14} /> },
            { id: 'usuarios', label: 'Usuarios', icon: <Users size={14} /> },
            { id: 'auth', label: 'Autorización', icon: <ShieldCheck size={14} /> },
            { id: 'budget', label: 'Presupuesto', icon: <DollarSign size={14} /> },
            { id: 'design', label: 'Diseño', icon: <Paintbrush size={14} /> }
          ].map(section => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id as any)}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${
                activeSection === section.id 
                  ? 'bg-brand-ink text-brand-bone shadow-lg shadow-brand-ink/20' 
                  : 'text-brand-ink/40 hover:text-brand-ink hover:bg-white'
              }`}
            >
              {section.icon}
              {section.label}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <button 
            onClick={onUndo}
            className="p-3 bg-brand-bone border border-brand-sand/20 rounded-xl text-brand-ink/40 hover:text-brand-ink hover:border-brand-gold transition-all"
            title="Deshacer Cambio"
          >
            <RotateCcw size={16} />
          </button>
          <button 
            onClick={saveSettings}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl text-[10px] uppercase font-black tracking-widest transition-all ${
              isSaved ? 'bg-green-500 text-white' : 'bg-brand-ink text-brand-bone hover:bg-brand-gold hover:text-brand-ink'
            }`}
          >
            {isSaved ? <CheckCircle2 size={14} /> : <Save size={14} />}
            {isSaved ? 'Guardado' : 'Guardar Cambios'}
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeSection === 'design' && (
          <motion.div
            key="design"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-8"
          >
            {/* Royáltica Core Palette */}
            <div className="lg:col-span-12 space-y-4">
              <div className="flex items-center gap-4 mb-4">
                <div className="px-3 py-1 bg-brand-gold text-brand-ink rounded-full text-[9px] font-black tracking-[0.2em] uppercase">Paleta Royáltica Core</div>
                <div className="h-px flex-1 bg-brand-sand/30" />
                <button 
                  onClick={() => onThemeChange(defaultTheme)}
                  className="text-[9px] font-black uppercase text-brand-ink/30 hover:text-brand-gold transition-colors"
                >
                  Restaurar Predeterminado
                </button>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {[
                  { key: 'ink', label: 'Tinta (Primario)', desc: 'Barra lateral, cartas de acción, títulos fuertes. Define el tono corporativo.' },
                  { key: 'gold', label: 'Oro (Acento)', desc: 'Botones principales, checkmarks de auditoría, indicadores de éxito.' },
                  { key: 'bone', label: 'Hueso (Fondo)', desc: 'Color principal del lienzo de la aplicación. Reduce fatiga visual.' },
                  { key: 'sand', label: 'Arena (Bordes)', desc: 'Utilizado en divisores, bordes de input y áreas de hover sutil.' },
                  { key: 'paper', label: 'Papel (Cartas)', desc: 'Fondo de tarjetas y modales. Crea capas de profundidad.' },
                  { key: 'cream', label: 'Crema (Acento suave)', desc: 'Fondos secundarios y áreas de información complementaria.' }
                ].map((color) => (
                  <div key={color.key} className="editorial-card !p-4 flex flex-col gap-3 group">
                    <div className="relative aspect-square rounded-2xl shadow-inner border border-black/5 overflow-hidden">
                       <div 
                         className="absolute inset-0 transition-transform group-hover:scale-110" 
                         style={{ backgroundColor: (currentTheme as any)[color.key] }} 
                       />
                       <input 
                         type="color" 
                         value={(currentTheme as any)[color.key]} 
                         onChange={(e) => handleColorChange(color.key, e.target.value)}
                         className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                       />
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] font-bold text-brand-ink uppercase">{color.label}</span>
                        <span className="text-[8px] font-mono opacity-40 uppercase">{(currentTheme as any)[color.key]}</span>
                      </div>
                      <p className="text-[8px] leading-relaxed text-brand-ink/40">{color.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Customizer */}
            <div className="lg:col-span-8 editorial-card">
              <div className="space-y-8">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-2xl font-serif text-brand-ink mb-1">Editor de Interfaz</h3>
                    <p className="text-[10px] text-brand-ink/40 uppercase tracking-widest">Personaliza elementos específicos del tablero</p>
                  </div>
                  <div className="relative w-64 flex gap-2">
                    <div className="relative flex-1">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-ink/20" />
                      <input 
                        type="text" 
                        placeholder="# HEX Code (ej: #FF5500)" 
                        value={searchColor}
                        onChange={(e) => setSearchColor(e.target.value)}
                        className="w-full bg-brand-bone border border-brand-sand/50 rounded-xl pl-10 pr-4 py-2 outline-none focus:border-brand-gold text-[10px] font-mono"
                      />
                    </div>
                    {/^#[0-9A-F]{6}$/i.test(searchColor) && (
                      <div className="flex gap-1">
                        <button 
                          onClick={() => handleColorChange('gold', searchColor)}
                          className="px-2 py-1 bg-brand-gold text-brand-ink text-[8px] font-bold rounded-lg hover:opacity-80 transition-opacity"
                        >
                          Aplicar Oro
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <h4 className="text-[9px] font-black uppercase tracking-[0.3em] text-brand-gold border-b border-brand-gold/20 pb-2">Ambiente General</h4>
                    <div className="space-y-4">
                      {['bone', 'ink'].map(key => (
                        <div key={key} className="flex items-center justify-between p-4 bg-brand-bone rounded-2xl border border-brand-sand/30">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg border border-black/5 shadow-sm" style={{ backgroundColor: (currentTheme as any)[key] }} />
                            <div>
                              <p className="text-[11px] font-bold text-brand-ink capitalize">{key === 'bone' ? 'Lienzo de Escritorio' : 'Panel de Navegación'}</p>
                              <p className="text-[8px] opacity-40 uppercase">Aumenta contraste automáticamente</p>
                            </div>
                          </div>
                          <input 
                             type="color" 
                             value={(currentTheme as any)[key]} 
                             onChange={(e) => handleColorChange(key, e.target.value)}
                             className="w-8 h-8 rounded-full border-none cursor-pointer"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-6">
                    <h4 className="text-[9px] font-black uppercase tracking-[0.3em] text-brand-gold border-b border-brand-gold/20 pb-2">Indicadores y Acción</h4>
                    <div className="space-y-4">
                       {['gold', 'paper'].map(key => (
                        <div key={key} className="flex items-center justify-between p-4 bg-brand-bone rounded-2xl border border-brand-sand/30">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg border border-black/5 shadow-sm" style={{ backgroundColor: (currentTheme as any)[key] }} />
                            <div>
                               <p className="text-[11px] font-bold text-brand-ink capitalize">{key === 'gold' ? 'Botones y Call-to-action' : 'Superficie de Tarjetas'}</p>
                               <p className="text-[8px] opacity-40 uppercase">Afecta interactividad visual</p>
                            </div>
                          </div>
                          <input 
                             type="color" 
                             value={(currentTheme as any)[key]} 
                             onChange={(e) => handleColorChange(key, e.target.value)}
                             className="w-8 h-8 rounded-full border-none cursor-pointer"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right sidebar: Dark mode, Logo, Preview */}
            <div className="lg:col-span-4 flex flex-col gap-6">
              {/* Dark Mode Toggle */}
              <div className="editorial-card space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {darkMode ? <Moon size={18} className="text-brand-gold" /> : <Sun size={18} className="text-brand-gold" />}
                    <div>
                      <p className="text-sm font-bold text-brand-ink">Modo Oscuro</p>
                      <p className="text-[9px] text-brand-ink/40">{darkMode ? 'Activado' : 'Desactivado'}</p>
                    </div>
                  </div>
                  <button onClick={() => setDarkMode(!darkMode)}
                    className={`w-14 h-7 rounded-full transition-all relative ${darkMode ? 'bg-brand-gold' : 'bg-brand-sand/40'}`}>
                    <motion.div animate={{ x: darkMode ? 28 : 2 }} className="w-6 h-6 bg-white rounded-full shadow-md absolute top-0.5" />
                  </button>
                </div>
              </div>

              {/* Custom Logo */}
              <div className="editorial-card space-y-4">
                <h4 className="text-sm font-bold text-brand-ink flex items-center gap-2"><Image size={14} /> Logo Personalizado</h4>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl border-2 border-dashed border-brand-sand/50 flex items-center justify-center overflow-hidden bg-brand-bone">
                    {customLogo ? (
                      <img src={customLogo} alt="Logo" className="w-full h-full object-contain" />
                    ) : (
                      <Image size={24} className="text-brand-ink/20" />
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <label className="flex items-center gap-2 px-4 py-2 bg-brand-ink text-brand-bone rounded-xl text-[10px] font-bold uppercase tracking-widest cursor-pointer hover:bg-brand-gold hover:text-brand-ink transition-all">
                      <UploadCloud size={12} /> Subir Logo
                      <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                    </label>
                    {customLogo && (
                      <button onClick={() => { setCustomLogo(null); localStorage.removeItem('royaltica_custom_logo'); }}
                        className="text-[9px] text-red-500 hover:underline">Eliminar logo</button>
                    )}
                  </div>
                </div>
              </div>

              {/* Preview Device Toggle */}
              <div className="editorial-card space-y-4">
                <h4 className="text-sm font-bold text-brand-ink flex items-center gap-2"><Eye size={14} /> Vista Previa</h4>
                <div className="flex gap-2">
                  <button onClick={() => setPreviewDevice('desktop')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${
                      previewDevice === 'desktop' ? 'bg-brand-ink text-brand-bone' : 'bg-brand-bone text-brand-ink/40'
                    }`}><Monitor size={14} /> Desktop</button>
                  <button onClick={() => setPreviewDevice('mobile')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${
                      previewDevice === 'mobile' ? 'bg-brand-ink text-brand-bone' : 'bg-brand-bone text-brand-ink/40'
                    }`}><Smartphone size={14} /> Mobile</button>
                </div>
                {/* Mini preview */}
                <div className={`rounded-2xl border border-brand-sand/30 overflow-hidden transition-all ${previewDevice === 'mobile' ? 'max-w-[200px] mx-auto' : ''}`}
                  style={{ backgroundColor: currentTheme.bone }}>
                  <div className="h-8 flex items-center gap-2 px-3" style={{ backgroundColor: currentTheme.ink }}>
                    {customLogo ? <img src={customLogo} alt="" className="h-4 w-4 rounded object-contain" /> : <div className="w-4 h-4 rounded" style={{ backgroundColor: currentTheme.gold }} />}
                    <div className="h-1.5 w-12 rounded-full" style={{ backgroundColor: currentTheme.gold, opacity: 0.4 }} />
                  </div>
                  <div className="p-3 space-y-2">
                    <div className="h-2 w-20 rounded-full" style={{ backgroundColor: currentTheme.ink, opacity: 0.2 }} />
                    <div className="flex gap-2">
                      <div className="h-8 flex-1 rounded-lg" style={{ backgroundColor: currentTheme.paper, border: `1px solid ${currentTheme.sand}` }} />
                      <div className="h-8 flex-1 rounded-lg" style={{ backgroundColor: currentTheme.paper, border: `1px solid ${currentTheme.sand}` }} />
                    </div>
                    <div className="h-6 rounded-lg flex items-center justify-center" style={{ backgroundColor: currentTheme.gold }}>
                      <div className="h-1 w-8 rounded-full" style={{ backgroundColor: currentTheme.ink, opacity: 0.3 }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Restore Default */}
              <div className="editorial-card bg-brand-ink text-center space-y-4 relative overflow-hidden">
                <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--brand-gold),transparent)]" />
                <div className="relative z-10 space-y-3">
                  <h3 className="text-lg font-serif text-brand-bone">Previsualización en Vivo</h3>
                  <p className="text-[9px] text-brand-bone/40 uppercase tracking-[0.2em] leading-relaxed">
                    Los cambios se aplican instantáneamente. Se guardan en localStorage.
                  </p>
                  <button onClick={() => onThemeChange(defaultTheme)}
                    className="px-6 py-3 border border-brand-bone/20 text-brand-bone text-[8px] font-black uppercase tracking-widest rounded-xl hover:bg-brand-bone hover:text-brand-ink transition-all">
                    Regresar a Original
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Existing Sections (ERP, Manual, Archive) remain same... */}
        {activeSection === 'erp' && (
          <motion.div key="erp" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-8">
            {/* ERP Connection State */}
            <ERPConnectionPanel erpOptions={erpOptions} />
          </motion.div>
        )}

        {activeSection === 'manual' && (
          <motion.div key="manual" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-8">
            <ManualSupplierPanel />
          </motion.div>
        )}

        {activeSection === 'organizacion' && (
          <motion.div key="organizacion" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-8">
            <OrgSettingsForm />
            <TwoFactorSetupPanel />
            <WhatsappPrefsPanel />
          </motion.div>
        )}

        {activeSection === 'integraciones' && (
          <motion.div key="integraciones" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-8">
            <ErpConnectivityPanel />
            <WebhooksPanel />
            <Sat69bChecker />
          </motion.div>
        )}

        {activeSection === 'usuarios' && (
          <motion.div key="usuarios" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-8">
            <UsersManager />
          </motion.div>
        )}

        {activeSection === 'auth' && (
          <motion.div key="auth" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-8">
            <AuthorizationPanel />
          </motion.div>
        )}

        {activeSection === 'budget' && (
          <motion.div key="budget" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-8">
            <BudgetEditor totalBudget={totalBudget} onBudgetChange={onBudgetChange} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Supplier Chat Modal ─── */}
      <AnimatePresence>
        {chatSupplier && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[200] flex items-center justify-center p-4"
            onClick={() => { setChatSupplier(null); setChatReply(''); }}>
            <motion.div initial={{ opacity: 0, y: 30, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 30, scale: 0.95 }}
              className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col" style={{ maxHeight: '80vh' }}
              onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div className="px-6 py-4 bg-brand-ink text-brand-paper flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-brand-gold/20 flex items-center justify-center">
                    <MessageSquare size={16} className="text-brand-gold" />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold">{chatSupplier.name}</p>
                    <p className="text-[8px] text-brand-paper/40 font-mono">{chatSupplier.rfc}</p>
                  </div>
                </div>
                <button onClick={() => { setChatSupplier(null); setChatReply(''); }}><X size={16} className="text-brand-paper/40 hover:text-brand-paper" /></button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-5 space-y-3" style={{ minHeight: 200 }}>
                {SupplierMessageService.getBySupplier(chatSupplier.id).length === 0 ? (
                  <div className="text-center py-10">
                    <MessageSquare size={32} className="text-brand-ink/10 mx-auto mb-3" />
                    <p className="text-brand-ink/30 text-[11px]">Sin mensajes con este proveedor</p>
                  </div>
                ) : (
                  SupplierMessageService.getBySupplier(chatSupplier.id).map(msg => (
                    <div key={msg.id} className={`flex ${msg.from === 'corporate' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] rounded-2xl px-4 py-3 ${
                        msg.from === 'corporate'
                          ? 'bg-brand-ink text-brand-paper rounded-br-md'
                          : 'bg-brand-bone text-brand-ink border border-brand-sand/20 rounded-bl-md'
                      }`}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[8px] font-bold uppercase tracking-wider ${msg.from === 'corporate' ? 'text-brand-gold' : 'text-brand-ink/40'}`}>
                            {msg.from === 'corporate' ? '🏢 Tú (Corporativo)' : `📦 ${chatSupplier.name.split(' ')[0]}`}
                          </span>
                        </div>
                        <p className="text-[10px] leading-relaxed">{msg.text}</p>
                        <p className={`text-[7px] mt-1.5 ${msg.from === 'corporate' ? 'text-brand-paper/30' : 'text-brand-ink/20'}`}>
                          {new Date(msg.date).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' })} · {new Date(msg.date).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Reply area */}
              <div className="p-4 border-t border-brand-sand/20 flex-shrink-0">
                <div className="flex gap-2">
                  <textarea value={chatReply} onChange={e => setChatReply(e.target.value)} rows={2} placeholder="Responder al proveedor..."
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey && chatReply.trim()) {
                        e.preventDefault();
                        SupplierMessageService.send(chatSupplier.id, chatSupplier.name, 'corporate', chatReply.trim());
                        setChatReply('');
                      }
                    }}
                    className="flex-1 px-4 py-2.5 bg-brand-bone border border-brand-sand/30 rounded-xl text-[10px] outline-none focus:border-brand-gold resize-none" />
                  <button onClick={() => {
                    if (chatReply.trim()) {
                      SupplierMessageService.send(chatSupplier.id, chatSupplier.name, 'corporate', chatReply.trim());
                      setChatReply('');
                    }
                  }} disabled={!chatReply.trim()}
                    className="w-11 h-11 bg-brand-ink text-brand-paper rounded-xl flex items-center justify-center disabled:opacity-30 hover:bg-brand-gold hover:text-brand-ink transition-all flex-shrink-0">
                    <Send size={14} />
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Budget Editor Component ─────────────────────────────────────────────────
function BudgetEditor({ totalBudget, onBudgetChange }: { totalBudget: number; onBudgetChange: (b: number) => void }) {
  const [editValue, setEditValue] = useState(String(totalBudget));
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    const num = parseFloat(editValue.replace(/[^0-9.]/g, ''));
    if (!isNaN(num) && num > 0) {
      onBudgetChange(num);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }
  };

  const presets = [
    { label: '$1M', value: 1000000 },
    { label: '$3M', value: 3000000 },
    { label: '$5M', value: 5000000 },
    { label: '$10M', value: 10000000 },
    { label: '$25M', value: 25000000 },
  ];

  const CURRENCY_FMT = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="p-3 bg-brand-gold/10 rounded-2xl">
          <DollarSign size={20} className="text-brand-gold" />
        </div>
        <div>
          <h3 className="text-2xl font-serif text-brand-ink">Presupuesto Maestro</h3>
          <p className="text-xs text-brand-ink/40 font-medium">Define el presupuesto anual corporativo. Se refleja en dashboard, validaciones, financiamiento y simulaciones.</p>
        </div>
      </div>

      {/* Current budget display */}
      <div className="bg-white border border-brand-sand/40 rounded-[2rem] p-8 space-y-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[9px] uppercase tracking-[0.25em] font-bold text-brand-ink/30 mb-1">Presupuesto Actual</p>
            <p className="text-3xl font-serif text-brand-ink tracking-tight">{CURRENCY_FMT.format(totalBudget)}</p>
          </div>
          {saved && (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-200 rounded-full">
              <CheckCircle2 size={14} className="text-green-600" />
              <span className="text-[10px] font-bold text-green-700 uppercase tracking-widest">Guardado</span>
            </motion.div>
          )}
        </div>

        {/* Edit field */}
        <div className="space-y-3">
          <label className="text-[10px] uppercase tracking-[0.2em] font-bold text-brand-ink/40">Nuevo monto (MXN)</label>
          <div className="flex gap-3">
            <div className="relative flex-1">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-ink/30 font-serif text-sm">$</span>
              <input
                type="text"
                value={editValue}
                onChange={(e) => {
                  const raw = e.target.value.replace(/[^0-9]/g, '');
                  setEditValue(raw);
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                className="w-full pl-8 pr-4 py-3 bg-brand-bone border border-brand-sand/40 rounded-xl text-lg font-serif text-brand-ink focus:outline-none focus:ring-2 focus:ring-brand-gold/30 focus:border-brand-gold/50 transition-all"
                placeholder="5000000"
              />
            </div>
            <button
              onClick={handleSave}
              className="px-6 py-3 bg-brand-ink text-brand-bone text-[10px] font-bold uppercase tracking-widest rounded-xl hover:bg-brand-gold hover:text-brand-ink transition-all shadow-md hover:shadow-lg"
            >
              Aplicar
            </button>
          </div>
          <p className="text-[9px] text-brand-ink/30">
            Valor formateado: {CURRENCY_FMT.format(Number(editValue.replace(/[^0-9]/g, '')) || 0)}
          </p>
        </div>

        {/* Presets */}
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-brand-ink/40">Montos predefinidos</p>
          <div className="flex flex-wrap gap-2">
            {presets.map(p => (
              <button
                key={p.value}
                onClick={() => {
                  setEditValue(String(p.value));
                  onBudgetChange(p.value);
                  setSaved(true);
                  setTimeout(() => setSaved(false), 2500);
                }}
                className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all ${
                  totalBudget === p.value
                    ? 'bg-brand-gold/10 border-brand-gold text-brand-gold shadow-sm'
                    : 'bg-brand-bone border-brand-sand/40 text-brand-ink/50 hover:border-brand-gold/40 hover:text-brand-ink'
                }`}
              >
                {p.label} MXN
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Impact preview */}
      <div className="bg-white border border-brand-sand/40 rounded-[2rem] p-8 space-y-4 shadow-sm">
        <div className="flex items-center gap-3 mb-2">
          <TrendingUp size={16} className="text-brand-gold" />
          <h4 className="text-sm font-bold uppercase tracking-[0.15em] text-brand-ink/60">Impacto del cambio</h4>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-brand-bone/50 rounded-xl border border-brand-sand/20">
            <p className="text-[9px] uppercase tracking-wider text-brand-ink/30 mb-1">Dashboard</p>
            <p className="text-xs text-brand-ink/70">El presupuesto maestro consolidado se actualiza en tiempo real.</p>
          </div>
          <div className="p-4 bg-brand-bone/50 rounded-xl border border-brand-sand/20">
            <p className="text-[9px] uppercase tracking-wider text-brand-ink/30 mb-1">Financiamiento</p>
            <p className="text-xs text-brand-ink/70">Las recomendaciones de factoraje vs caja se recalculan según el nuevo monto.</p>
          </div>
          <div className="p-4 bg-brand-bone/50 rounded-xl border border-brand-sand/20">
            <p className="text-[9px] uppercase tracking-wider text-brand-ink/30 mb-1">Simulador de Caja</p>
            <p className="text-xs text-brand-ink/70">La tesorería disponible y proyecciones se ajustan proporcionalmente.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── RFC Validation (SAT Algorithm) ──────────────────────────────────────────
// ─── ERP Connection Panel ──────────────────────────────────────────────────────
function ERPConnectionPanel({ erpOptions }: { erpOptions: { name: string; logo: string; description: string }[] }) {
  const [connectedERP, setConnectedERP] = useState<string | null>(() => localStorage.getItem('royaltica_erp_connected'));
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('royaltica_erp_apikey') || '');
  const [showApiKey, setShowApiKey] = useState(false);
  const [syncFrequency, setSyncFrequency] = useState<string>(() => localStorage.getItem('royaltica_sync_freq') || '30');
  const [syncLog, setSyncLog] = useState<{date: string; status: 'success' | 'error' | 'warning'; records: number; message: string}[]>([
    { date: '2024-04-27 14:30:00', status: 'success', records: 145, message: 'Sincronización completa. 145 registros actualizados.' },
    { date: '2024-04-27 12:00:00', status: 'success', records: 12, message: '12 nuevas facturas importadas de SAP.' },
    { date: '2024-04-26 18:15:00', status: 'warning', records: 0, message: 'Timeout de conexión. Reintento exitoso.' },
    { date: '2024-04-26 12:00:00', status: 'success', records: 89, message: 'Sincronización completa. 89 registros.' },
    { date: '2024-04-25 08:30:00', status: 'error', records: 0, message: 'Error de autenticación. API key expirada.' },
  ]);
  const [lastSync, setLastSync] = useState('Hace 2 horas');
  const [isSyncing, setIsSyncing] = useState(false);

  const handleConnect = (erpName: string) => {
    if (apiKey.length < 10) return;
    setConnectedERP(erpName);
    localStorage.setItem('royaltica_erp_connected', erpName);
    localStorage.setItem('royaltica_erp_apikey', apiKey);
  };

  const handleSync = () => {
    setIsSyncing(true);
    setTimeout(() => {
      const newLog = { date: new Date().toISOString().replace('T', ' ').substring(0, 19), status: 'success' as const, records: Math.floor(Math.random() * 50) + 10, message: `Sincronización manual exitosa.` };
      setSyncLog(prev => [newLog, ...prev]);
      setLastSync('Ahora');
      setIsSyncing(false);
    }, 2000);
  };

  return (
    <div className="space-y-6">
      {/* Connection Status Banner */}
      <div className={`flex items-center justify-between p-5 rounded-2xl border ${
        connectedERP ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
      }`}>
        <div className="flex items-center gap-3">
          {connectedERP ? <Wifi size={20} className="text-green-600" /> : <WifiOff size={20} className="text-red-600" />}
          <div>
            <p className={`text-sm font-bold ${connectedERP ? 'text-green-800' : 'text-red-800'}`}>
              {connectedERP ? `Conectado a ${connectedERP}` : 'Sin conexión ERP'}
            </p>
            <p className={`text-[10px] ${connectedERP ? 'text-green-600' : 'text-red-600'}`}>
              {connectedERP ? `Última sincronización: ${lastSync}` : 'Configura tu integración para comenzar'}
            </p>
          </div>
        </div>
        {connectedERP && (
          <div className="flex items-center gap-2">
            <button onClick={handleSync} disabled={isSyncing}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-green-700 transition-all disabled:opacity-50">
              <RefreshCw size={12} className={isSyncing ? 'animate-spin' : ''} /> {isSyncing ? 'Sincronizando...' : 'Sincronizar Ahora'}
            </button>
            <button onClick={() => { setConnectedERP(null); localStorage.removeItem('royaltica_erp_connected'); }}
              className="px-3 py-2 text-red-600 bg-red-50 border border-red-200 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-red-100 transition-all">
              Desconectar
            </button>
          </div>
        )}
      </div>

      {/* API Key & Frequency Config */}
      {connectedERP && (
        <div className="editorial-card space-y-4">
          <h4 className="text-sm font-bold text-brand-ink flex items-center gap-2"><Key size={14} className="text-brand-gold" /> Credenciales & Configuración</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-brand-ink/40">API Key / Token</label>
              <div className="relative">
                <input type={showApiKey ? 'text' : 'password'} value={apiKey} onChange={e => { setApiKey(e.target.value); localStorage.setItem('royaltica_erp_apikey', e.target.value); }}
                  className="w-full px-4 py-3 border border-brand-sand/50 rounded-xl text-sm font-mono focus:outline-none focus:border-brand-gold pr-12" placeholder="sk-xxxx..." />
                <button onClick={() => setShowApiKey(!showApiKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-ink/30 hover:text-brand-ink">
                  <Eye size={16} />
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-brand-ink/40">Frecuencia de Sincronización</label>
              <select value={syncFrequency} onChange={e => { setSyncFrequency(e.target.value); localStorage.setItem('royaltica_sync_freq', e.target.value); }}
                className="w-full px-4 py-3 border border-brand-sand/50 rounded-xl text-sm focus:outline-none focus:border-brand-gold">
                <option value="15">Cada 15 minutos</option>
                <option value="30">Cada 30 minutos</option>
                <option value="60">Cada hora</option>
                <option value="360">Cada 6 horas</option>
                <option value="1440">Cada 24 horas</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Sync Log */}
      {connectedERP && (
        <div className="editorial-card !p-0 overflow-hidden">
          <div className="px-6 py-4 bg-white border-b border-brand-sand/20 flex items-center justify-between">
            <p className="text-sm font-bold text-brand-ink flex items-center gap-2"><Database size={14} className="text-brand-gold" /> Log de Sincronizaciones</p>
            <span className="text-[9px] text-brand-ink/40 uppercase tracking-wider">{syncLog.length} registros</span>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {syncLog.map((log, i) => (
              <div key={i} className="flex items-center gap-3 px-6 py-3 border-b border-brand-sand/10 hover:bg-brand-bone/50 transition-colors">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${log.status === 'success' ? 'bg-green-500' : log.status === 'warning' ? 'bg-yellow-500' : 'bg-red-500'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-brand-ink truncate">{log.message}</p>
                  <p className="text-[9px] text-brand-ink/30">{log.date}</p>
                </div>
                {log.records > 0 && <span className="text-[9px] font-bold text-brand-ink/40 bg-brand-bone px-2 py-0.5 rounded-full">{log.records} reg.</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ERP Selection Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {erpOptions.map((erp, idx) => (
          <div key={idx} className={`editorial-card group hover:border-brand-gold transition-all cursor-pointer ${connectedERP === erp.name ? 'border-green-300 bg-green-50/30' : ''}`}>
            <div className="flex items-start justify-between mb-6">
              <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center p-2 shadow-sm">
                <img src={erp.logo} alt={erp.name} className="w-full h-full object-contain" />
              </div>
              <div className={`px-3 py-1 rounded-full ${connectedERP === erp.name ? 'bg-green-100' : 'bg-brand-gold/10'}`}>
                <span className={`text-[8px] font-bold uppercase tracking-widest ${connectedERP === erp.name ? 'text-green-700' : 'text-brand-gold'}`}>
                  {connectedERP === erp.name ? '● Conectado' : 'Disponible'}
                </span>
              </div>
            </div>
            <h3 className="text-xl font-serif text-brand-ink mb-2">{erp.name}</h3>
            <p className="text-[11px] text-brand-ink/50 leading-relaxed mb-6">{erp.description}</p>
            {connectedERP !== erp.name ? (
              <button onClick={() => handleConnect(erp.name)}
                className="w-full py-4 bg-brand-ink text-brand-bone text-[10px] uppercase font-black tracking-widest group-hover:bg-brand-gold group-hover:text-brand-ink transition-all flex items-center justify-center gap-2">
                <Globe size={14} /> Establecer Conexión
              </button>
            ) : (
              <div className="w-full py-4 bg-green-100 text-green-700 text-[10px] uppercase font-black tracking-widest text-center rounded-xl flex items-center justify-center gap-2">
                <CheckCircle2 size={14} /> Conexión Activa
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Manual Supplier Panel (Enhanced) ─────────────────────────────────────────
function ManualSupplierPanel() {
  const [rfcInput, setRfcInput] = useState('');
  const [rfcResult, setRfcResult] = useState<{ valid: boolean; type?: 'moral' | 'fisica'; error?: string } | null>(null);
  const [formData, setFormData] = useState({ name: '', email: '', giro: 'Logística', phone: '' });
  const [csfFile, setCsfFile] = useState<string | null>(null);
  const [savedSuppliers, setSavedSuppliers] = useState<{rfc: string; name: string; email: string; giro: string; date: string}[]>([]);

  const handleRfcChange = (val: string) => {
    const clean = val.toUpperCase().replace(/[^A-ZÑ&0-9]/g, '').slice(0, 13);
    setRfcInput(clean);
    if (clean.length >= 12) {
      setRfcResult(validateRFC(clean));
    } else {
      setRfcResult(null);
    }
  };

  const handleSave = () => {
    if (!rfcResult?.valid || !formData.name) return;
    setSavedSuppliers(prev => [...prev, { rfc: rfcInput, name: formData.name, email: formData.email, giro: formData.giro, date: new Date().toISOString().split('T')[0] }]);
    setRfcInput(''); setFormData({ name: '', email: '', giro: 'Logística', phone: '' }); setRfcResult(null); setCsfFile(null);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      <div className="lg:col-span-7 editorial-card">
        <div className="space-y-6 px-4">
          <div>
            <h3 className="text-2xl font-serif text-brand-ink mb-2">Alta Directa de Proveedor</h3>
            <p className="text-[11px] text-brand-ink/40 uppercase tracking-widest">Información fiscal y comercial básica</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">RFC</label>
              <input type="text" value={rfcInput} onChange={e => handleRfcChange(e.target.value)} placeholder="AAA010101AAA"
                className={`w-full bg-brand-bone border rounded-xl px-4 py-3 outline-none font-mono text-sm ${
                  rfcResult ? (rfcResult.valid ? 'border-green-400 focus:border-green-500' : 'border-red-400 focus:border-red-500') : 'border-brand-sand/30 focus:border-brand-gold'
                }`} />
              {rfcResult && (
                <p className={`text-[10px] flex items-center gap-1 ${rfcResult.valid ? 'text-green-600' : 'text-red-600'}`}>
                  {rfcResult.valid ? <><CheckCircle2 size={10} /> RFC válido ({rfcResult.type === 'moral' ? 'Persona Moral' : 'Persona Física'})</> : <><AlertCircle size={10} /> {rfcResult.error}</>}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">Giro</label>
              <select value={formData.giro} onChange={e => setFormData(p => ({...p, giro: e.target.value}))}
                className="w-full bg-brand-bone border border-brand-sand/30 rounded-xl px-4 py-3 outline-none focus:border-brand-gold text-sm h-[46px]">
                {['Logística', 'Servicios Profesionales', 'Tecnología', 'Manufactura', 'Consultoría', 'Marketing', 'Legal', 'Construcción', 'Alimentación'].map(g => (
                  <option key={g}>{g}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2 space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">Nombre o Razón Social</label>
              <input type="text" value={formData.name} onChange={e => setFormData(p => ({...p, name: e.target.value}))} placeholder="Escribe el nombre legal"
                className="w-full bg-brand-bone border border-brand-sand/30 rounded-xl px-4 py-3 outline-none focus:border-brand-gold text-sm" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">Correo Electrónico</label>
              <input type="email" value={formData.email} onChange={e => setFormData(p => ({...p, email: e.target.value}))} placeholder="contacto@empresa.mx"
                className="w-full bg-brand-bone border border-brand-sand/30 rounded-xl px-4 py-3 outline-none focus:border-brand-gold text-sm" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">Teléfono</label>
              <input type="tel" value={formData.phone} onChange={e => setFormData(p => ({...p, phone: e.target.value}))} placeholder="+52 55 1234 5678"
                className="w-full bg-brand-bone border border-brand-sand/30 rounded-xl px-4 py-3 outline-none focus:border-brand-gold text-sm" />
            </div>
          </div>

          <div className="pt-4 border-t border-brand-sand/30 flex justify-between items-center">
            {savedSuppliers.length > 0 && (
              <span className="text-[10px] text-green-600 font-bold">{savedSuppliers.length} proveedor(es) registrado(s)</span>
            )}
            <button onClick={handleSave} disabled={!rfcResult?.valid || !formData.name}
              className="px-8 py-4 bg-brand-ink text-brand-bone text-[10px] uppercase font-black tracking-widest rounded-2xl hover:bg-brand-gold hover:text-brand-ink transition-all shadow-lg shadow-brand-ink/10 disabled:opacity-40 disabled:cursor-not-allowed ml-auto">
              Registrar Proveedor
            </button>
          </div>
        </div>
      </div>

      <div className="lg:col-span-5 flex flex-col gap-6">
        {/* CSF Upload */}
        <div className="editorial-card border-dashed border-2 border-brand-sand/50 bg-brand-bone/30 p-8 text-center group cursor-pointer hover:border-brand-gold transition-all flex flex-col justify-center">
          <div className="mb-4 relative">
            <div className="w-16 h-16 bg-white rounded-3xl shadow-lg flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
              {csfFile ? <CheckCircle2 size={24} className="text-green-600" /> : <FileUp size={24} className="text-brand-ink" />}
            </div>
          </div>
          <h3 className="text-lg font-serif text-brand-ink mb-1">{csfFile ? 'CSF Cargada' : 'Constancia de Situación Fiscal'}</h3>
          <p className="text-[10px] text-brand-ink/40 uppercase tracking-[0.2em] leading-relaxed mb-4">
            {csfFile ? 'Documento recibido correctamente' : 'Sube la CSF del proveedor (PDF)'}
          </p>
          <label className="inline-flex items-center gap-2 px-6 py-3 bg-brand-ink text-brand-bone rounded-xl text-[10px] font-bold uppercase tracking-widest cursor-pointer hover:bg-brand-gold hover:text-brand-ink transition-all mx-auto">
            <UploadCloud size={14} /> {csfFile ? 'Cambiar Archivo' : 'Seleccionar PDF'}
            <input type="file" accept=".pdf" onChange={e => { if (e.target.files?.[0]) setCsfFile(e.target.files[0].name); }} className="hidden" />
          </label>
        </div>

        {/* Recently Saved */}
        {savedSuppliers.length > 0 && (
          <div className="editorial-card space-y-3">
            <h4 className="text-sm font-bold text-brand-ink">Proveedores Registrados</h4>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {savedSuppliers.map((s, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-brand-bone/50 rounded-xl">
                  <div>
                    <p className="text-[11px] font-bold text-brand-ink">{s.name}</p>
                    <p className="text-[9px] font-mono text-brand-ink/40">{s.rfc}</p>
                  </div>
                  <span className="text-[9px] text-brand-ink/30">{s.date}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Authorization Panel ──────────────────────────────────────────────────────
function AuthorizationPanel() {
  const [authorizers, setAuthorizers] = useState<Authorizer[]>(AuthorizerService.getAll());
  const [form, setForm] = useState<{ name: string; cargo: string; email: string }>({ name: '', cargo: '', email: '' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [ceoKeyInput, setCeoKeyInput] = useState('');
  const [ceoUnlocked, setCeoUnlocked] = useState(false);
  const [ceoKeyError, setCeoKeyError] = useState(false);
  const [editingCeo, setEditingCeo] = useState(false);
  const [ceoForm, setCeoForm] = useState({ name: '', cargo: '', email: '' });
  const [authRequests, setAuthRequests] = useState<Record<string, 'pending' | 'approved' | 'rejected'>>({});

  useEffect(() => {
    AuthorizerService.subscribe(setAuthorizers);
    return () => AuthorizerService.unsubscribe(setAuthorizers);
  }, []);

  const ceo = authorizers.find(a => a.type === 'ceo');
  const standard = authorizers.filter(a => a.type === 'standard');
  const gerencial = authorizers.filter(a => a.type === 'gerencial');

  // ─── Gerencial state ───
  const [gerencialForm, setGerencialForm] = useState<{ name: string; cargo: string; email: string }>({ name: '', cargo: '', email: '' });
  const [editingGerencialId, setEditingGerencialId] = useState<string | null>(null);
  const [showGerencialForm, setShowGerencialForm] = useState(false);
  const [notifiedProviders, setNotifiedProviders] = useState<Set<string>>(new Set());
  const [sendingEmail, setSendingEmail] = useState<string | null>(null);

  // ─── New: Bitácora, Limits, 2FA ───
  const [authBitacora, setAuthBitacora] = useState<{date: string; user: string; action: string; amount?: number; status: 'approved' | 'rejected' | 'escalated'}[]>([
    { date: '2024-04-27 15:30', user: 'María García', action: 'Aprobó pago FAC-2024-0891', amount: 245000, status: 'approved' },
    { date: '2024-04-27 10:15', user: 'Carlos Méndez', action: 'Rechazó factoraje FAC-2024-1002', amount: 520000, status: 'rejected' },
    { date: '2024-04-26 18:00', user: 'Sistema', action: 'Escaló a CEO — monto > $1,000,000', amount: 1200000, status: 'escalated' },
    { date: '2024-04-26 09:30', user: 'María García', action: 'Aprobó pago FAC-2024-0934', amount: 180000, status: 'approved' },
    { date: '2024-04-25 14:00', user: 'Sistema', action: 'Notificación gerencial enviada a 3 proveedores', status: 'approved' },
  ]);
  const [authLimits, setAuthLimits] = useState<{authorizerId: string; maxAmount: number}[]>([]);
  const [show2FA, setShow2FA] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpVerified, setOtpVerified] = useState(false);
  const [showBitacora, setShowBitacora] = useState(false);
  const [ceoEscalationThreshold, setCeoEscalationThreshold] = useState(1000000);

  // ─── Overdue detection: invoices pending/approved past 30 days ───
  const PAYMENT_DEADLINE_DAYS = 30;
  const today = new Date();
  const overdueInvoices = MOCK_INVOICES.filter(inv => {
    if (inv.status === 'paid' || inv.status === 'rejected') return false;
    const invDate = new Date(inv.date);
    const daysSince = Math.floor((today.getTime() - invDate.getTime()) / (1000 * 60 * 60 * 24));
    return daysSince > PAYMENT_DEADLINE_DAYS;
  });

  // Group overdue by provider
  const overdueByProvider = overdueInvoices.reduce((acc, inv) => {
    if (!acc[inv.provider]) acc[inv.provider] = { invoices: [], totalAmount: 0, maxDays: 0 };
    const daysSince = Math.floor((today.getTime() - new Date(inv.date).getTime()) / (1000 * 60 * 60 * 24));
    acc[inv.provider].invoices.push(inv);
    acc[inv.provider].totalAmount += inv.amount;
    acc[inv.provider].maxDays = Math.max(acc[inv.provider].maxDays, daysSince);
    return acc;
  }, {} as Record<string, { invoices: Invoice[]; totalAmount: number; maxDays: number }>);

  const overdueProviderCount = Object.keys(overdueByProvider).length;

  const resetGerencialForm = () => { setGerencialForm({ name: '', cargo: '', email: '' }); setEditingGerencialId(null); setShowGerencialForm(false); };

  const handleGerencialSave = () => {
    if (!gerencialForm.name.trim() || !gerencialForm.email.trim()) return;
    if (editingGerencialId) {
      AuthorizerService.update(editingGerencialId, gerencialForm);
    } else {
      AuthorizerService.add({ ...gerencialForm, type: 'gerencial' });
    }
    resetGerencialForm();
  };

  const handleGerencialEdit = (a: Authorizer) => {
    setGerencialForm({ name: a.name, cargo: a.cargo, email: a.email });
    setEditingGerencialId(a.id);
    setShowGerencialForm(true);
  };

  const simulateNotifyProvider = (providerName: string) => {
    setSendingEmail(providerName);
    setTimeout(() => {
      setNotifiedProviders(prev => new Set([...prev, providerName]));
      setSendingEmail(null);
    }, 1500);
  };

  const simulateNotifyAll = () => {
    setSendingEmail('__ALL__');
    const providers = Object.keys(overdueByProvider).filter(p => !notifiedProviders.has(p));
    setTimeout(() => {
      setNotifiedProviders(prev => new Set([...prev, ...providers]));
      setSendingEmail(null);
    }, 2200);
  };

  const resetForm = () => { setForm({ name: '', cargo: '', email: '' }); setEditingId(null); setShowForm(false); };

  const handleSave = () => {
    if (!form.name.trim() || !form.email.trim()) return;
    if (editingId) {
      AuthorizerService.update(editingId, form);
    } else {
      AuthorizerService.add({ ...form, type: 'standard' });
    }
    resetForm();
  };

  const handleEdit = (a: Authorizer) => {
    setForm({ name: a.name, cargo: a.cargo, email: a.email });
    setEditingId(a.id);
    setShowForm(true);
  };

  const handleCeoUnlock = () => {
    if (ceoKeyInput === CEO_KEY) {
      setCeoUnlocked(true);
      setCeoKeyError(false);
      if (ceo) setCeoForm({ name: ceo.name, cargo: ceo.cargo, email: ceo.email });
      setEditingCeo(true);
    } else {
      setCeoKeyError(true);
    }
  };

  const handleCeoSave = () => {
    if (ceo) AuthorizerService.update(ceo.id, ceoForm);
    setCeoUnlocked(false); setEditingCeo(false); setCeoKeyInput('');
  };

  const simulateAuthRequest = (invoiceId: string) => {
    setAuthRequests(prev => ({ ...prev, [invoiceId]: 'pending' }));
    setTimeout(() => setAuthRequests(prev => ({ ...prev, [invoiceId]: 'approved' })), 2000);
  };

  return (
    <div className="space-y-10">
      <div>
        <h3 className="text-2xl font-serif text-brand-ink mb-1">Gestión de Autorizadores</h3>
        <p className="text-[11px] text-brand-ink/40 uppercase tracking-widest">Define quién puede aprobar pagos y validaciones en el sistema</p>
      </div>

      {/* CEO Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-1 h-5 bg-brand-gold rounded-full" />
          <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-ink/60">Pagos Globales Empresariales · +$200,000</span>
        </div>
        <div className="editorial-card border-brand-gold/30 bg-brand-gold/5 space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-2xl bg-brand-ink flex items-center justify-center text-brand-bone font-bold text-sm">
                {ceo ? ceo.name.charAt(0).toUpperCase() : 'C'}
              </div>
              <div>
                <p className="font-serif text-lg text-brand-ink">{ceo?.name ?? 'Sin asignar'}</p>
                <p className="text-[10px] uppercase tracking-widest text-brand-ink/40">{ceo?.cargo ?? '—'}</p>
                <p className="text-[11px] text-brand-gold/80 mt-0.5">{ceo?.email ?? '—'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[8px] font-bold bg-brand-gold/20 text-brand-gold px-2 py-1 rounded-full uppercase tracking-widest">CEO · Acceso especial</span>
              {!editingCeo && (
                <button onClick={() => { setCeoUnlocked(false); setEditingCeo(false); setCeoKeyInput(''); setCeoKeyError(false); }}
                  className="text-[10px] font-bold uppercase tracking-widest text-brand-ink/30 hover:text-brand-ink transition-all px-3 py-1.5 border border-brand-sand/30 rounded-xl">
                  {ceoUnlocked ? '' : 'Modificar'}
                </button>
              )}
            </div>
          </div>

          {/* CEO key gate */}
          {!ceoUnlocked && (
            <div className="pt-4 border-t border-brand-gold/20">
              <p className="text-[10px] text-brand-ink/40 uppercase tracking-widest mb-3">Clave de acceso para modificar</p>
              <div className="flex gap-3">
                <input
                  type="password"
                  value={ceoKeyInput}
                  onChange={e => { setCeoKeyInput(e.target.value); setCeoKeyError(false); }}
                  onKeyDown={e => e.key === 'Enter' && handleCeoUnlock()}
                  placeholder="••••"
                  className={`flex-1 bg-white border rounded-xl px-4 py-2.5 text-sm outline-none transition-all ${ceoKeyError ? 'border-red-400 focus:border-red-400' : 'border-brand-sand/40 focus:border-brand-gold'}`}
                />
                <button onClick={handleCeoUnlock}
                  className="px-5 py-2.5 bg-brand-ink text-brand-bone text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-brand-gold hover:text-brand-ink transition-all">
                  Desbloquear
                </button>
              </div>
              {ceoKeyError && <p className="text-[10px] text-red-500 mt-2 font-medium">Clave incorrecta</p>}
            </div>
          )}

          {/* CEO edit form */}
          {ceoUnlocked && editingCeo && (
            <div className="pt-4 border-t border-brand-gold/20 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {([['name','Nombre'], ['cargo','Cargo'], ['email','Correo']] as [keyof typeof ceoForm, string][]).map(([k, label]) => (
                  <div key={k} className="space-y-1.5">
                    <label className="text-[9px] font-bold uppercase tracking-widest opacity-40">{label}</label>
                    <input type={k === 'email' ? 'email' : 'text'} value={ceoForm[k]}
                      onChange={e => setCeoForm(prev => ({ ...prev, [k]: e.target.value }))}
                      className="w-full bg-white border border-brand-sand/40 rounded-xl px-3 py-2 text-sm outline-none focus:border-brand-gold" />
                  </div>
                ))}
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button onClick={() => { setCeoUnlocked(false); setEditingCeo(false); setCeoKeyInput(''); }}
                  className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-brand-ink/40 hover:text-brand-ink border border-brand-sand/30 rounded-xl transition-all">
                  Cancelar
                </button>
                <button onClick={handleCeoSave}
                  className="px-6 py-2 bg-brand-gold text-brand-ink text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-brand-ink hover:text-brand-bone transition-all">
                  Guardar CEO
                </button>
              </div>
            </div>
          )}
        </div>
        <p className="text-[10px] text-brand-ink/30">Su autorización se solicita automáticamente en pagos globales empresariales superiores a $200,000 MXN.</p>
      </div>

      {/* Standard Authorizers */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-1 h-5 bg-brand-ink/20 rounded-full" />
            <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-ink/60">Autorizadores Operativos · Facturas y Pagos Generales</span>
          </div>
          <button onClick={() => { resetForm(); setShowForm(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-brand-ink text-brand-bone text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-brand-gold hover:text-brand-ink transition-all">
            <Plus size={12} />
            Agregar
          </button>
        </div>

        {standard.length === 0 && !showForm && (
          <div className="editorial-card border-dashed border-2 border-brand-sand/40 text-center py-12 space-y-3 bg-transparent">
            <User size={28} className="mx-auto text-brand-ink/15" />
            <p className="text-[11px] text-brand-ink/30 uppercase tracking-widest">Sin autorizadores operativos</p>
            <p className="text-[10px] text-brand-ink/20">Los pagos operativos se procesan automáticamente</p>
          </div>
        )}

        <div className="space-y-3">
          {standard.map(a => (
            <div key={a.id} className="editorial-card !p-4 flex items-center gap-4 group hover:border-brand-gold transition-all">
              <div className="w-9 h-9 rounded-xl bg-brand-bone flex items-center justify-center font-bold text-brand-ink text-sm shrink-0">
                {a.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-brand-ink text-sm truncate">{a.name}</p>
                <p className="text-[10px] text-brand-ink/40 truncate">{a.cargo} · {a.email}</p>
              </div>
              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                <button onClick={() => handleEdit(a)}
                  className="px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest border border-brand-sand/40 rounded-lg hover:border-brand-gold text-brand-ink/50 hover:text-brand-ink transition-all">
                  Editar
                </button>
                <button onClick={() => AuthorizerService.remove(a.id)}
                  className="px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest border border-red-200 rounded-lg text-red-400 hover:bg-red-50 transition-all">
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Add/Edit form */}
        <AnimatePresence>
          {showForm && (
            <motion.div key="auth-form" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className="editorial-card border-brand-gold/40 bg-brand-gold/5 space-y-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-brand-ink/60">
                {editingId ? 'Editar autorizador' : 'Nuevo autorizador operativo'}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {([['name','Nombre completo','text'], ['cargo','Cargo','text'], ['email','Correo profesional','email']] as [keyof typeof form, string, string][]).map(([k, label, type]) => (
                  <div key={k} className="space-y-1.5">
                    <label className="text-[9px] font-bold uppercase tracking-widest opacity-40">{label}</label>
                    <input type={type} value={form[k]}
                      onChange={e => setForm(prev => ({ ...prev, [k]: e.target.value }))}
                      placeholder={k === 'email' ? 'nombre@empresa.mx' : ''}
                      className="w-full bg-white border border-brand-sand/40 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-brand-gold transition-all" />
                  </div>
                ))}
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={resetForm}
                  className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-brand-ink/40 hover:text-brand-ink border border-brand-sand/30 rounded-xl transition-all">
                  Cancelar
                </button>
                <button onClick={handleSave} disabled={!form.name.trim() || !form.email.trim()}
                  className="px-6 py-2 bg-brand-ink text-brand-bone text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-brand-gold hover:text-brand-ink transition-all disabled:opacity-30">
                  {editingId ? 'Actualizar' : 'Agregar'}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ─── Gerencial Authorization Section ─── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-1 h-5 bg-red-400 rounded-full" />
            <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-ink/60">Autorización Gerencial · Mitigación de Corrupción</span>
          </div>
          <button onClick={() => { resetGerencialForm(); setShowGerencialForm(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-red-700 transition-all">
            <Plus size={12} />
            Agregar
          </button>
        </div>

        <p className="text-[10px] text-brand-ink/40 leading-relaxed">
          El autorizador gerencial supervisa que ningún pago a proveedores quede sin liquidar más allá del plazo límite ({PAYMENT_DEADLINE_DAYS} días).
          Cuando se detectan pagos vencidos, se notifica al gerente para investigar y mitigar riesgos de corrupción o negligencia.
        </p>

        {gerencial.length === 0 && !showGerencialForm && (
          <div className="editorial-card border-dashed border-2 border-red-200 text-center py-12 space-y-3 bg-red-50/30">
            <AlertTriangle size={28} className="mx-auto text-red-300" />
            <p className="text-[11px] text-red-400 uppercase tracking-widest">Sin autorizador gerencial asignado</p>
            <p className="text-[10px] text-red-300">No hay supervisión activa de pagos vencidos a proveedores</p>
          </div>
        )}

        <div className="space-y-3">
          {gerencial.map(a => (
            <div key={a.id} className="editorial-card !p-4 flex items-center gap-4 group hover:border-red-300 transition-all border-red-200/50 bg-red-50/20">
              <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center font-bold text-red-700 text-sm shrink-0">
                {a.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-brand-ink text-sm truncate">{a.name}</p>
                <p className="text-[10px] text-brand-ink/40 truncate">{a.cargo} · {a.email}</p>
                <p className="text-[8px] uppercase tracking-widest text-red-500 font-bold mt-0.5">Supervisor Anti-Corrupción</p>
              </div>
              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                <button onClick={() => handleGerencialEdit(a)}
                  className="px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest border border-brand-sand/40 rounded-lg hover:border-red-400 text-brand-ink/50 hover:text-brand-ink transition-all">
                  Editar
                </button>
                <button onClick={() => AuthorizerService.remove(a.id)}
                  className="px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest border border-red-200 rounded-lg text-red-400 hover:bg-red-50 transition-all">
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Gerencial Add/Edit form */}
        <AnimatePresence>
          {showGerencialForm && (
            <motion.div key="gerencial-form" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className="editorial-card border-red-300/40 bg-red-50/30 space-y-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-red-600/80">
                {editingGerencialId ? 'Editar autorizador gerencial' : 'Nuevo autorizador gerencial'}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {([['name','Nombre completo','text'], ['cargo','Cargo (Gerencia)','text'], ['email','Correo profesional','email']] as [keyof typeof gerencialForm, string, string][]).map(([k, label, type]) => (
                  <div key={k} className="space-y-1.5">
                    <label className="text-[9px] font-bold uppercase tracking-widest opacity-40">{label}</label>
                    <input type={type} value={gerencialForm[k]}
                      onChange={e => setGerencialForm(prev => ({ ...prev, [k]: e.target.value }))}
                      placeholder={k === 'email' ? 'gerente@empresa.mx' : k === 'cargo' ? 'Gerente de Operaciones' : ''}
                      className="w-full bg-white border border-red-200/60 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-red-400 transition-all" />
                  </div>
                ))}
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={resetGerencialForm}
                  className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-brand-ink/40 hover:text-brand-ink border border-brand-sand/30 rounded-xl transition-all">
                  Cancelar
                </button>
                <button onClick={handleGerencialSave} disabled={!gerencialForm.name.trim() || !gerencialForm.email.trim()}
                  className="px-6 py-2 bg-red-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-red-700 transition-all disabled:opacity-30">
                  {editingGerencialId ? 'Actualizar' : 'Agregar'}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── Overdue Providers Dashboard ─── */}
        {gerencial.length > 0 && (
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle size={14} className={overdueProviderCount > 0 ? 'text-red-500' : 'text-green-500'} />
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-ink/50">
                  Monitoreo de Pagos Vencidos ({`>${PAYMENT_DEADLINE_DAYS} días`})
                </span>
              </div>
              {overdueProviderCount > 0 && (
                <button
                  onClick={simulateNotifyAll}
                  disabled={sendingEmail !== null || Object.keys(overdueByProvider).every(p => notifiedProviders.has(p))}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-[9px] font-black uppercase tracking-widest rounded-xl hover:bg-red-700 transition-all disabled:opacity-30">
                  <Mail size={12} />
                  {sendingEmail === '__ALL__' ? 'Enviando...' : Object.keys(overdueByProvider).every(p => notifiedProviders.has(p)) ? 'Todos Notificados' : 'Notificar Todos'}
                </button>
              )}
            </div>

            {overdueProviderCount === 0 ? (
              <div className="editorial-card border-green-200 bg-green-50/30 text-center py-8 space-y-2">
                <CheckCircle2 size={24} className="mx-auto text-green-400" />
                <p className="text-[11px] text-green-700 font-bold uppercase tracking-widest">Sin proveedores con pagos vencidos</p>
                <p className="text-[10px] text-green-500">Todos los pagos están dentro del plazo de {PAYMENT_DEADLINE_DAYS} días</p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Summary banner */}
                <div className="editorial-card !p-4 border-red-300 bg-red-50/40 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                      <AlertTriangle size={18} className="text-red-600" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-red-700">{overdueProviderCount} proveedor{overdueProviderCount !== 1 ? 'es' : ''} con pagos vencidos</p>
                      <p className="text-[9px] text-red-500 uppercase tracking-widest">{overdueInvoices.length} factura{overdueInvoices.length !== 1 ? 's' : ''} exceden el plazo · Monto total: {CURRENCY_FORMATTER.format(overdueInvoices.reduce((s, i) => s + i.amount, 0))}</p>
                    </div>
                  </div>
                  <span className="text-[8px] font-black uppercase tracking-widest text-red-600 bg-red-100 px-3 py-1.5 rounded-full">Requiere Acción</span>
                </div>

                {/* Per-provider cards */}
                {Object.entries(overdueByProvider).map(([providerName, data]) => {
                  const isNotified = notifiedProviders.has(providerName);
                  const isSending = sendingEmail === providerName || sendingEmail === '__ALL__';
                  return (
                    <motion.div
                      key={providerName}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`editorial-card !p-5 space-y-3 transition-all ${isNotified ? 'border-green-300 bg-green-50/20' : 'border-red-200/60 hover:border-red-300'}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${isNotified ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {providerName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-brand-ink text-sm">{providerName}</p>
                            <p className="text-[9px] text-brand-ink/40 uppercase tracking-widest">
                              {data.invoices.length} factura{data.invoices.length !== 1 ? 's' : ''} · máx. {data.maxDays} días sin pago
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-bold text-red-600">{CURRENCY_FORMATTER.format(data.totalAmount)}</span>
                          {isNotified ? (
                            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-green-100 text-green-700 text-[8px] font-black uppercase tracking-widest rounded-full">
                              <CheckCircle2 size={10} /> Notificado
                            </span>
                          ) : (
                            <button
                              onClick={() => simulateNotifyProvider(providerName)}
                              disabled={isSending}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white text-[8px] font-black uppercase tracking-widest rounded-full hover:bg-red-700 transition-all disabled:opacity-50"
                            >
                              <Mail size={10} /> {isSending ? 'Enviando...' : 'Notificar'}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Invoice list */}
                      <div className="pl-12 space-y-1.5">
                        {data.invoices.map(inv => {
                          const daysSince = Math.floor((today.getTime() - new Date(inv.date).getTime()) / (1000 * 60 * 60 * 24));
                          return (
                            <div key={inv.id} className="flex items-center justify-between text-[10px] py-1 border-b border-brand-sand/20 last:border-0">
                              <div className="flex items-center gap-3">
                                <span className="font-bold text-brand-ink">{inv.id}</span>
                                <span className="text-brand-ink/40">{inv.description}</span>
                              </div>
                              <div className="flex items-center gap-4">
                                <span className="font-bold text-brand-ink">{CURRENCY_FORMATTER.format(inv.amount)}</span>
                                <span className={`font-bold uppercase tracking-widest ${daysSince > 45 ? 'text-red-600' : 'text-orange-500'}`}>
                                  {daysSince}d vencida
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {isNotified && (
                        <div className="pl-12 flex items-center gap-2 pt-1">
                          <Mail size={10} className="text-green-500" />
                          <p className="text-[9px] text-green-600">Correo de alerta enviado a {gerencial.map(g => g.email).join(', ')} sobre incumplimiento de pago a {providerName}.</p>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Authorization logic summary */}
      <div className="editorial-card !bg-brand-bone/50 border-dashed space-y-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-ink/40">Lógica de autorización</p>
        <div className="space-y-2">
          <div className="flex items-start gap-3">
            <div className="w-2 h-2 rounded-full bg-brand-gold mt-1.5 shrink-0" />
            <p className="text-[11px] text-brand-ink/60"><span className="font-bold text-brand-ink">Pago Global Empresarial &gt; $200,000:</span> Requiere autorización del CEO. Solicitud automática.</p>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-2 h-2 rounded-full bg-brand-ink/30 mt-1.5 shrink-0" />
            <p className="text-[11px] text-brand-ink/60"><span className="font-bold text-brand-ink">Facturas operativas y pagos generales:</span> {standard.length > 0 ? `Requieren autorización de ${standard.map(a => a.name).join(' o ')}.` : 'Se procesan automáticamente (sin autorizadores operativos asignados).'}</p>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-2 h-2 rounded-full bg-red-400 mt-1.5 shrink-0" />
            <p className="text-[11px] text-brand-ink/60"><span className="font-bold text-brand-ink">Supervisión gerencial anti-corrupción:</span> {gerencial.length > 0 ? `${gerencial.map(g => g.name).join(', ')} recibe${gerencial.length === 1 ? '' : 'n'} alertas de proveedores con pagos vencidos a más de ${PAYMENT_DEADLINE_DAYS} días.` : 'Sin supervisor gerencial asignado — pagos vencidos no se monitorean.'}</p>
          </div>
        </div>
      </div>

      {/* ═══ Escalation Limits ═══ */}
      <div className="editorial-card space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold text-brand-ink flex items-center gap-2"><Scale size={14} className="text-brand-gold" /> Límites de Autorización</h4>
          <span className="text-[9px] text-brand-ink/40 uppercase tracking-wider">Escalación automática</span>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-4 bg-brand-bone/50 rounded-xl border border-brand-sand/20">
            <div>
              <p className="text-[11px] font-bold text-brand-ink">Umbral de escalación a CEO</p>
              <p className="text-[9px] text-brand-ink/40">Montos superiores a este umbral requieren aprobación del CEO</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-brand-ink/40">$</span>
              <input type="number" value={ceoEscalationThreshold} onChange={e => setCeoEscalationThreshold(Number(e.target.value))}
                className="w-32 px-3 py-2 border border-brand-sand/50 rounded-xl text-sm font-serif text-right focus:outline-none focus:border-brand-gold" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Operativo', range: `Hasta ${CURRENCY_FORMATTER.format(500000)}`, color: 'bg-green-50 border-green-200 text-green-700' },
              { label: 'Gerencial', range: `${CURRENCY_FORMATTER.format(500000)} - ${CURRENCY_FORMATTER.format(ceoEscalationThreshold)}`, color: 'bg-orange-50 border-orange-200 text-orange-700' },
              { label: 'CEO', range: `Más de ${CURRENCY_FORMATTER.format(ceoEscalationThreshold)}`, color: 'bg-red-50 border-red-200 text-red-700' },
            ].map(l => (
              <div key={l.label} className={`p-3 rounded-xl border text-center ${l.color}`}>
                <p className="text-[10px] font-bold uppercase tracking-widest">{l.label}</p>
                <p className="text-[9px] mt-1">{l.range}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ═══ 2FA Simulation ═══ */}
      <div className="editorial-card space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold text-brand-ink flex items-center gap-2"><Shield size={14} className="text-brand-gold" /> Autenticación de Dos Factores (2FA)</h4>
          <button onClick={() => setShow2FA(!show2FA)}
            className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${
              otpVerified ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-brand-ink text-brand-bone hover:bg-brand-gold hover:text-brand-ink'
            }`}>
            {otpVerified ? '✓ 2FA Verificado' : show2FA ? 'Ocultar' : 'Configurar 2FA'}
          </button>
        </div>
        <AnimatePresence>
          {show2FA && !otpVerified && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="bg-brand-bone/50 rounded-xl p-6 border border-brand-sand/20 space-y-4">
                <p className="text-[11px] text-brand-ink/60">Para aprobar montos mayores a {CURRENCY_FORMATTER.format(ceoEscalationThreshold)}, se requiere un código OTP. Ingresa el código de verificación:</p>
                <div className="flex items-center gap-3">
                  <input type="text" value={otpCode} onChange={e => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000" maxLength={6}
                    className="w-40 px-4 py-3 border border-brand-sand/50 rounded-xl text-lg font-mono text-center tracking-[0.5em] focus:outline-none focus:border-brand-gold" />
                  <button onClick={() => { if (otpCode.length === 6) { setOtpVerified(true); setShow2FA(false);
                    setAuthBitacora(prev => [{ date: new Date().toISOString().replace('T', ' ').substring(0, 16), user: 'Sistema', action: '2FA verificado exitosamente', status: 'approved' }, ...prev]);
                  }}}
                    disabled={otpCode.length !== 6}
                    className="px-6 py-3 bg-brand-ink text-brand-bone rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-brand-gold hover:text-brand-ink transition-all disabled:opacity-40">
                    Verificar
                  </button>
                </div>
                <p className="text-[9px] text-brand-ink/30">Demo: ingresa cualquier código de 6 dígitos para simular la verificación.</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ═══ Bitácora de Autorizaciones ═══ */}
      <div className="editorial-card !p-0 overflow-hidden">
        <div className="px-6 py-4 bg-white border-b border-brand-sand/20 flex items-center justify-between cursor-pointer" onClick={() => setShowBitacora(!showBitacora)}>
          <p className="text-sm font-bold text-brand-ink flex items-center gap-2"><History size={14} className="text-brand-gold" /> Bitácora de Autorizaciones</p>
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-brand-ink/40 uppercase tracking-wider">{authBitacora.length} registros</span>
            <ChevronRight size={14} className={`text-brand-ink/30 transition-transform ${showBitacora ? 'rotate-90' : ''}`} />
          </div>
        </div>
        <AnimatePresence>
          {showBitacora && (
            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
              <div className="max-h-64 overflow-y-auto">
                {authBitacora.map((entry, i) => (
                  <div key={i} className="flex items-center gap-3 px-6 py-3 border-b border-brand-sand/10 hover:bg-brand-bone/50 transition-colors">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      entry.status === 'approved' ? 'bg-green-500' : entry.status === 'rejected' ? 'bg-red-500' : 'bg-orange-500'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-brand-ink"><span className="font-bold">{entry.user}</span> — {entry.action}</p>
                      <p className="text-[9px] text-brand-ink/30">{entry.date}</p>
                    </div>
                    {entry.amount && <span className="text-[10px] font-serif font-bold text-brand-ink/60">{CURRENCY_FORMATTER.format(entry.amount)}</span>}
                    <span className={`px-2 py-0.5 rounded-full text-[8px] font-bold uppercase ${
                      entry.status === 'approved' ? 'bg-green-100 text-green-700' : entry.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
                    }`}>{entry.status === 'approved' ? 'Aprobado' : entry.status === 'rejected' ? 'Rechazado' : 'Escalado'}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

const FINTECH_MONTHLY_MOCK = [
  { mes: 'Nov', monto: 42000 },
  { mes: 'Dic', monto: 78500 },
  { mes: 'Ene', monto: 31200 },
  { mes: 'Feb', monto: 95400 },
  { mes: 'Mar', monto: 61000 },
  { mes: 'Abr', monto: 0 }, // current month placeholder, filled dynamically
];

function FintechPaymentModal({ fintechTotal, totalBudget, onClose }: { fintechTotal: number; totalBudget: number; onClose: () => void }) {
  const [showPayForm, setShowPayForm] = React.useState(false);
  const [paid, setPaid] = React.useState(false);
  const [form, setForm] = React.useState({ clabe: '', banco: '', referencia: '', concepto: 'Liquidación Factoraje Royáltica' });

  const monthlyData = FINTECH_MONTHLY_MOCK.map((d, i) => i === 5 ? { ...d, monto: fintechTotal } : d);
  const maxMonth = Math.max(...monthlyData.map(d => d.monto));

  // Budget pressure: how much of remaining budget would fintech consume
  const budgetUsedByFintech = fintechTotal;
  const budgetPressure = Math.min((budgetUsedByFintech / totalBudget) * 100, 100);
  const shouldDefer = budgetPressure > 15;

  const handlePay = () => {
    if (!form.clabe || form.clabe.length !== 18 || !form.banco) return;
    setPaid(true);
    setTimeout(onClose, 2200);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-brand-ink/80 backdrop-blur-md"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0, y: 24 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.92, opacity: 0, y: 24 }}
        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
        className="w-full max-w-2xl bg-brand-paper rounded-[2.5rem] overflow-hidden shadow-2xl relative"
        onClick={e => e.stopPropagation()}
      >
        {/* Gold top bar */}
        <div className="absolute top-0 left-0 w-full h-1.5 bg-brand-gold" />

        <div className="p-10 space-y-8">
          {/* Header */}
          <div className="flex justify-between items-start">
            <div>
              <span className="label-caps !text-brand-gold !text-[9px]">Factoraje · Saldo Pendiente</span>
              <h2 className="text-3xl font-serif text-brand-ink mt-1">Pago a Fintech</h2>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-brand-bone rounded-full transition-colors opacity-30 hover:opacity-100">
              <LogOut size={20} className="rotate-90" />
            </button>
          </div>

          {/* Amount + Pay button row */}
          <div className="bg-brand-ink rounded-[2rem] p-8 flex items-center justify-between gap-6">
            <div>
              <p className="text-[9px] uppercase tracking-widest text-brand-paper/40 mb-1">Monto Total a Liquidar</p>
              <p className="text-4xl font-serif text-brand-gold">{CURRENCY_FORMATTER.format(fintechTotal)}</p>
              <p className="text-[9px] text-brand-paper/40 mt-1 uppercase tracking-wider">Vence en 14 días · Factoraje Pool</p>
            </div>
            {!paid ? (
              <button
                onClick={() => setShowPayForm(v => !v)}
                className="flex-shrink-0 bg-brand-gold text-brand-ink px-7 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-gold/90 transition-all shadow-md"
              >
                Proceder al Pago
              </button>
            ) : (
              <div className="flex items-center gap-2 text-green-400">
                <CheckCircle2 size={22} />
                <span className="text-[11px] font-bold uppercase tracking-wider">Pago enviado</span>
              </div>
            )}
          </div>

          {/* Payment Form (collapsed by default) */}
          <AnimatePresence>
            {showPayForm && !paid && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden"
              >
                <div className="bg-brand-bone rounded-[2rem] p-8 space-y-5 border border-brand-sand/60">
                  <p className="label-caps !text-brand-ink/40 !text-[9px]">Datos de Transferencia SPEI</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label className="text-[9px] uppercase tracking-widest text-brand-ink/40 font-bold block mb-1">CLABE Interbancaria (18 dígitos)</label>
                      <input
                        type="text"
                        maxLength={18}
                        value={form.clabe}
                        onChange={e => setForm(f => ({ ...f, clabe: e.target.value.replace(/\D/g,'') }))}
                        placeholder="000000000000000000"
                        className="w-full bg-white border border-brand-sand/60 rounded-xl px-4 py-3 text-sm font-mono text-brand-ink placeholder:text-brand-ink/20 focus:outline-none focus:border-brand-gold transition-colors"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] uppercase tracking-widest text-brand-ink/40 font-bold block mb-1">Banco Destinatario</label>
                      <input
                        type="text"
                        value={form.banco}
                        onChange={e => setForm(f => ({ ...f, banco: e.target.value }))}
                        placeholder="Ej. BBVA, Banamex…"
                        className="w-full bg-white border border-brand-sand/60 rounded-xl px-4 py-3 text-sm text-brand-ink placeholder:text-brand-ink/20 focus:outline-none focus:border-brand-gold transition-colors"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] uppercase tracking-widest text-brand-ink/40 font-bold block mb-1">Referencia</label>
                      <input
                        type="text"
                        value={form.referencia}
                        onChange={e => setForm(f => ({ ...f, referencia: e.target.value }))}
                        placeholder="Núm. de referencia"
                        className="w-full bg-white border border-brand-sand/60 rounded-xl px-4 py-3 text-sm text-brand-ink placeholder:text-brand-ink/20 focus:outline-none focus:border-brand-gold transition-colors"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="text-[9px] uppercase tracking-widest text-brand-ink/40 font-bold block mb-1">Concepto</label>
                      <input
                        type="text"
                        value={form.concepto}
                        onChange={e => setForm(f => ({ ...f, concepto: e.target.value }))}
                        className="w-full bg-white border border-brand-sand/60 rounded-xl px-4 py-3 text-sm text-brand-ink focus:outline-none focus:border-brand-gold transition-colors"
                      />
                    </div>
                  </div>
                  <button
                    onClick={handlePay}
                    disabled={form.clabe.length !== 18 || !form.banco}
                    className="w-full bg-brand-ink text-brand-paper py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-ink/90 transition-all disabled:opacity-30 disabled:cursor-not-allowed mt-2"
                  >
                    Confirmar y Enviar Pago · {CURRENCY_FORMATTER.format(fintechTotal)}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Monthly usage chart */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-base font-serif text-brand-ink">Uso Fintech — Últimos 6 Meses</h3>
                <p className="text-[9px] uppercase tracking-widest text-brand-ink/30">Montos financiados vía factoraje</p>
              </div>
              <Zap size={16} className="text-brand-gold opacity-60" />
            </div>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData} barSize={28} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E6D5B8" vertical={false} />
                  <XAxis dataKey="mes" tick={{ fontSize: 10, fill: '#1A1A1A', opacity: 0.4, fontFamily: 'Inter' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: '#1A1A1A', opacity: 0.3, fontFamily: 'Inter' }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                  <RechartsTooltip
                    formatter={(v: number) => [CURRENCY_FORMATTER.format(v), 'Monto Fintech']}
                    contentStyle={{ borderRadius: '12px', border: '1px solid #E6D5B8', fontSize: '11px', fontFamily: 'Inter' }}
                  />
                  <Bar dataKey="monto" radius={[6, 6, 0, 0]}>
                    {monthlyData.map((_, i) => (
                      <Cell key={i} fill={i === 5 ? '#D4AF37' : '#1A1A1A'} fillOpacity={i === 5 ? 1 : 0.18} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Budget pressure bar */}
          <div className={`rounded-[1.5rem] p-6 border ${shouldDefer ? 'bg-orange-50/60 border-orange-200' : 'bg-green-50/60 border-green-200'}`}>
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2">
                {shouldDefer
                  ? <AlertCircle size={15} className="text-orange-500" />
                  : <CheckCircle2 size={15} className="text-green-600" />}
                <span className="text-[9px] uppercase tracking-widest font-bold text-brand-ink/60">Presión Presupuestaria · Fintech</span>
              </div>
              <span className={`text-[11px] font-bold ${shouldDefer ? 'text-orange-600' : 'text-green-700'}`}>
                {budgetPressure.toFixed(1)}% del presupuesto total
              </span>
            </div>
            <div className="w-full bg-brand-sand/40 rounded-full h-2.5 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${budgetPressure}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className={`h-full rounded-full ${shouldDefer ? 'bg-orange-400' : 'bg-green-500'}`}
              />
            </div>
            <p className={`text-[10px] mt-3 leading-relaxed ${shouldDefer ? 'text-orange-700' : 'text-green-700'}`}>
              {shouldDefer
                ? `El factoraje representa el ${budgetPressure.toFixed(1)}% de tu presupuesto anual. Considera diferir pagos no urgentes para mantener liquidez operativa.`
                : `El uso actual de factoraje está dentro de parámetros saludables (${budgetPressure.toFixed(1)}%). Puedes proceder al pago sin comprometer el presupuesto.`}
            </p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function DashboardView({
  invoices,
  totalBudget,
  onNavigateToProvider,
  onNavigateToTab
}: {
  invoices: Invoice[],
  totalBudget: number,
  onNavigateToProvider: (providerName: string, priority: string) => void,
  onNavigateToTab?: (tab: 'suppliers' | 'audits' | 'pending_invoices' | 'financing') => void
}) {
  const [timeFrame, setTimeFrame] = React.useState<'monthly' | 'quarterly' | 'yearly'>('monthly');
  const [showFintechPayment, setShowFintechPayment] = React.useState(false);

  // ─── Dashboard Chat State ───
  const [dashChatSupplierId, setDashChatSupplierId] = React.useState<string | null>(null);
  const [dashChatReply, setDashChatReply] = React.useState('');
  const [, setDashMsgTick] = React.useState(0);
  React.useEffect(() => {
    const cb = () => setDashMsgTick(t => t + 1);
    SupplierMessageService.subscribe(cb);
    return () => SupplierMessageService.unsubscribe(cb);
  }, []);

  // ─── Report State ───
  const [showReportModal, setShowReportModal] = React.useState(false);
  const [reportType, setReportType] = React.useState<ReportType>('executive');
  const [reportContent, setReportContent] = React.useState<string | null>(null);
  const [reportLoading, setReportLoading] = React.useState(false);

  // Build operations context for reports
  const buildContext = React.useCallback((): OperationsContext => {
    const pending = invoices.filter(i => i.status !== 'paid' && i.status !== 'rejected');
    const paid = invoices.filter(i => i.status === 'paid');
    const today = new Date();
    const overdueCount = invoices.filter(i => {
      if (i.status === 'paid' || i.status === 'rejected') return false;
      return Math.floor((today.getTime() - new Date(i.date).getTime()) / (1000 * 60 * 60 * 24)) > 30;
    }).length;
    const fintechTotal = invoices.filter(i => i.paymentRoute === 'fintech').reduce((s, i) => s + i.amount, 0);
    const cashTotal = invoices.filter(i => i.paymentRoute === 'cash').reduce((s, i) => s + i.amount, 0);
    const fullyValidated = invoices.filter(i => i.forensicStatus === 'VALIDATED' && (i.signatures || 0) >= 2).length;
    const partiallyValidated = invoices.filter(i => i.forensicStatus === 'VALIDATED' && (i.signatures || 0) < 2).length;
    const pendingSignatures = invoices.filter(i => i.forensicStatus === 'VALIDATED').reduce((s, i) => s + Math.max(0, 2 - (i.signatures || 0)), 0);
    const factorajeRequests = invoices.filter(i => i.paymentRoute === 'fintech' && i.status === 'paid').map(i => ({
      provider: i.provider, amount: i.amount, status: 'aprobada', rate: 2.1,
    }));
    return {
      invoices: invoices.map(i => ({ id: i.id, provider: i.provider, amount: i.amount, date: i.date, status: i.status, description: i.description, auditScore: i.auditScore, paymentRoute: i.paymentRoute, forensicStatus: i.forensicStatus, signatures: i.signatures, poNumber: i.poNumber, paymentType: i.paymentType })),
      suppliers: MOCK_SUPPLIERS.map(s => ({ name: s.name, rfc: s.rfc, category: s.category, isApproved: s.isApproved, seniorityYears: s.seniorityYears })),
      totalBudget, pendingAmount: pending.reduce((s, i) => s + i.amount, 0), paidAmount: paid.reduce((s, i) => s + i.amount, 0),
      cashTotal, overdueCount, fintechTotal,
      auditStats: { validated: invoices.filter(i => i.forensicStatus === 'VALIDATED').length, discrepancy: invoices.filter(i => i.forensicStatus === 'DISCREPANCY').length, blocked: invoices.filter(i => i.forensicStatus === 'BLOCKED').length, pending: invoices.filter(i => !i.forensicStatus && i.status !== 'paid').length },
      validationStats: { fullyValidated, partiallyValidated, pendingSignatures },
      factorajeRequests, treasuryAvailable: totalBudget * 0.6,
    };
  }, [invoices, totalBudget]);

  const handleGenerateReport = React.useCallback(async () => {
    setReportLoading(true);
    setReportContent(null);
    try {
      const content = await generateReport(reportType, buildContext());
      setReportContent(content);
    } catch {
      setReportContent('Error al generar el reporte. Intenta de nuevo.');
    }
    setReportLoading(false);
  }, [reportType, buildContext]);

  // Filter invoices based on timeframe (ref date 2024-04-27)
  const filteredInvoices = React.useMemo(() => {
    const refDate = new Date('2024-04-27');
    const days = timeFrame === 'monthly' ? 30 : timeFrame === 'quarterly' ? 90 : 365;
    const threshold = new Date(refDate);
    threshold.setDate(threshold.getDate() - days);
    
    return invoices.filter(inv => new Date(inv.date) >= threshold);
  }, [invoices, timeFrame]);

  const aprobadosCount = filteredInvoices.filter(i => i.status === 'paid').length;
  const pendientesCount = filteredInvoices.filter(i => i.status === 'pending').length;
  const programadosCount = filteredInvoices.filter(i => i.status === 'audited').length;
  
  const urgentesCount = filteredInvoices.filter(i => {
    const p = getPriorityInfo(i.date);
    return (p.label === 'Urgente' || p.label === 'Media Alta') && i.status !== 'paid';
  }).length;
  
  const auditFailsCount = filteredInvoices.filter(i => i.auditScore !== undefined && i.auditScore < 85).length || 0;
  const fintechTotal = filteredInvoices.filter(i => i.paymentRoute === 'fintech').reduce((sum, inv) => sum + inv.amount, 0);

  // NEW: Treasury Traffic Light Logic
  const [selectedTrafficColor, setSelectedTrafficColor] = React.useState<'green' | 'yellow' | 'orange' | 'red' | null>(null);
  
  const trafficLightStats = React.useMemo(() => {
    const today = new Date('2024-04-27');
    const categories = {
      green: { label: 'Óptimo', color: 'bg-green-500', shadow: 'shadow-green-500/40', invoices: [] as Invoice[] },
      yellow: { label: 'En Tiempo', color: 'bg-yellow-500', shadow: 'shadow-yellow-500/40', invoices: [] as Invoice[] },
      orange: { label: 'Media Alta', color: 'bg-orange-500', shadow: 'shadow-orange-500/40', invoices: [] as Invoice[] },
      red: { label: 'Urgente', color: 'bg-red-500', shadow: 'shadow-red-500/40', invoices: [] as Invoice[] },
    };

    filteredInvoices.forEach(inv => {
      if (inv.status === 'paid') return;
      const date = new Date(inv.date);
      const diffTime = Math.abs(today.getTime() - date.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays <= 10) {
        categories.green.invoices.push(inv);
      } else if (diffDays <= 20) {
        categories.yellow.invoices.push(inv);
      } else if (diffDays <= 30) {
        categories.orange.invoices.push(inv);
      } else {
        categories.red.invoices.push(inv);
      }
    });

    return categories;
  }, [filteredInvoices]);

  const getProviderBreakdown = (color: keyof typeof trafficLightStats) => {
    const invs = trafficLightStats[color].invoices;
    const breakdown = invs.reduce((acc, inv) => {
      acc[inv.provider] = (acc[inv.provider] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    return Object.entries(breakdown).map(([name, count]) => ({ name, count }));
  };

  // (Provider data is computed inline in the chart render)

  const fintechDeadline = 14;
  // Días promedio entre emisión y pago, derivado de las facturas pagadas del periodo
  const avgPaymentDays = React.useMemo(() => {
    const refDate = new Date('2024-04-27');
    const paid = filteredInvoices.filter(i => i.status === 'paid');
    if (paid.length === 0) return 0;
    const avg = paid.reduce((s, i) => {
      const days = (refDate.getTime() - new Date(i.date).getTime()) / 86400000;
      return s + Math.min(30, Math.max(1, days * 0.18));
    }, 0) / paid.length;
    return Math.round(avg * 10) / 10;
  }, [filteredInvoices]);

  return (
    <>
    <div className="space-y-8 pb-12">
      {/* Banda superior: Presupuesto + Quick Stats + Filtros */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-brand-ink text-brand-bone rounded-[2.5rem] px-10 py-7 shadow-xl relative overflow-hidden -mt-4"
      >
        <div className="absolute top-0 right-0 w-56 h-56 bg-brand-gold/10 rounded-full -translate-y-28 translate-x-20 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 w-40 h-40 bg-brand-gold/5 rounded-full translate-y-24 blur-3xl" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <span className="text-[8px] uppercase tracking-[0.3em] font-bold text-brand-gold/80">Presupuesto Maestro Consolidado</span>
            <h1 className="text-4xl font-serif text-brand-bone tracking-tight mt-1">
              {CURRENCY_FORMATTER.format(totalBudget)}
            </h1>
            <div className="w-14 h-0.5 bg-brand-gold/30 rounded-full mt-2" />
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-6">
            <div className="flex items-center gap-8">
              <div className="text-right">
                <p className="text-[8px] uppercase tracking-widest text-brand-bone/40 font-bold">Facturas</p>
                <p className="text-2xl font-serif text-brand-gold">{filteredInvoices.length}</p>
              </div>
              <div className="text-right">
                <p className="text-[8px] uppercase tracking-widest text-brand-bone/40 font-bold">Proveedores</p>
                <p className="text-2xl font-serif text-brand-gold">{new Set(filteredInvoices.map(i => i.provider)).size}</p>
              </div>
              <div className="text-right">
                <p className="text-[8px] uppercase tracking-widest text-brand-bone/40 font-bold">Ejercido</p>
                <p className="text-2xl font-serif text-brand-gold">
                  {totalBudget > 0 ? ((filteredInvoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.amount, 0) / totalBudget) * 100).toFixed(1) : '0.0'}%
                </p>
              </div>
            </div>
            <div className="bg-white/5 border border-white/10 p-1 rounded-full flex gap-1 self-start sm:self-auto">
              {(['monthly', 'quarterly', 'yearly'] as const).map((frame) => (
                <button
                  key={frame}
                  onClick={() => setTimeFrame(frame)}
                  className={`px-5 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all ${
                    timeFrame === frame
                      ? 'bg-brand-gold text-brand-ink shadow-md'
                      : 'text-brand-bone/40 hover:text-brand-bone hover:bg-white/10'
                  }`}
                >
                  {frame === 'monthly' ? 'Mensual' : frame === 'quarterly' ? 'Trimestral' : 'Anual'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Grid de Métricas 3x2 */}
      <div className="bg-white/40 backdrop-blur-md rounded-[3rem] p-8 border border-brand-sand/30 shadow-inner">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <CreativeCard
            icon={<CheckCircle2 className="text-green-600" size={24} />}
            label="Pagos Aprobados"
            value={aprobadosCount}
            subValue="Liquidados con éxito"
            theme="green"
            onClick={() => onNavigateToTab?.('pending_invoices')}
          />
          <CreativeCard
            icon={<Clock className="text-brand-gold" size={24} />}
            label="Pagos Pendientes"
            value={pendientesCount}
            subValue="En espera de gestión"
            theme="gold"
            onClick={() => onNavigateToTab?.('pending_invoices')}
          />
          <CreativeCard
            icon={<ShieldCheck className="text-red-500" size={24} />}
            label="Falta de Requisito"
            value={auditFailsCount}
            subValue="Observaciones en auditoría"
            theme="red"
            onClick={() => onNavigateToTab?.('audits')}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <CreativeCard
            icon={<AlertCircle className="text-orange-500" size={24} />}
            label="Riesgo de Atraso"
            value={urgentesCount}
            subValue="Prioridad urgente detectada"
            theme="orange"
            onClick={() => onNavigateToTab?.('pending_invoices')}
          />
          <CreativeCard
            icon={<Calendar className="text-brand-ink" size={24} />}
            label="Pagos Programados"
            value={programadosCount}
            subValue="Auditados para dispersión"
            theme="dark"
            onClick={() => onNavigateToTab?.('pending_invoices')}
          />
          <div
            onClick={() => onNavigateToTab?.('financing')}
            className="col-span-1 bg-brand-ink text-brand-bone rounded-[2.5rem] p-8 shadow-xl relative overflow-hidden group cursor-pointer hover:shadow-2xl transition-shadow"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-brand-gold/10 rounded-full -translate-y-12 translate-x-12 blur-2xl group-hover:bg-brand-gold/20 transition-all" />
            <div className="relative z-10 space-y-6">
              <div className="flex justify-between items-center">
                <span className="label-caps !text-brand-gold !opacity-100">Factoraje Pool</span>
                <Zap size={18} className="text-brand-gold" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest opacity-40 mb-1">Monto Debido Fintech</p>
                <p className="text-3xl font-serif text-brand-gold">{CURRENCY_FORMATTER.format(fintechTotal)}</p>
              </div>
              <div className="pt-4 border-t border-white/10 flex justify-between items-center">
                <span className="text-[9px] uppercase tracking-tighter opacity-40">Pendientes del periodo</span>
                <span className="text-lg font-serif">{pendientesCount}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Mensajes de Proveedores ─── */}
      {(() => {
        const unreadMsgs = SupplierMessageService.getUnreadMessages();
        if (unreadMsgs.length === 0) return null;
        return (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className="bg-white/60 backdrop-blur-md rounded-[2.5rem] border border-brand-gold/20 shadow-sm overflow-hidden">
            <div className="px-8 py-5 flex items-center justify-between border-b border-brand-sand/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-gold/10 flex items-center justify-center relative">
                  <MessageSquare size={18} className="text-brand-gold" />
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-[8px] font-bold text-white flex items-center justify-center">{unreadMsgs.length}</span>
                </div>
                <div>
                  <h3 className="text-base font-serif text-brand-ink">Mensajes de Proveedores</h3>
                  <p className="text-[8px] text-brand-ink/30 uppercase tracking-widest">{unreadMsgs.length} mensaje{unreadMsgs.length > 1 ? 's' : ''} sin leer · Requiere{unreadMsgs.length > 1 ? 'n' : ''} atención</p>
                </div>
              </div>
              <button onClick={() => onNavigateToProvider('', '')}
                className="text-[9px] font-bold uppercase tracking-wider text-brand-gold hover:underline flex items-center gap-1">
                Ver en Configuración <ChevronRight size={12} />
              </button>
            </div>
            <div className="divide-y divide-brand-sand/10">
              {unreadMsgs.slice(0, 4).map((msg, i) => (
                <motion.div key={msg.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                  onClick={() => { SupplierMessageService.markRead(msg.id); setDashChatSupplierId(msg.supplierId); }}
                  className="px-8 py-4 flex items-start gap-4 hover:bg-brand-gold/5 transition-all cursor-pointer">
                  <div className="w-9 h-9 rounded-xl bg-brand-bone flex items-center justify-center flex-shrink-0 mt-0.5">
                    <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${msg.supplierName}`} alt="" className="w-7 h-7 rounded-lg" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[11px] font-bold text-brand-ink">{msg.supplierName}</span>
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-gold animate-pulse" />
                    </div>
                    <p className="text-[10px] text-brand-ink/60 leading-relaxed line-clamp-2">{msg.text}</p>
                  </div>
                  <div className="flex-shrink-0 text-right flex items-center gap-2">
                    <div>
                      <p className="text-[8px] text-brand-ink/30 font-mono">{new Date(msg.date).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}</p>
                      <p className="text-[7px] text-brand-ink/20">{new Date(msg.date).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                    <ChevronRight size={12} className="text-brand-ink/20" />
                  </div>
                </motion.div>
              ))}
            </div>
            {unreadMsgs.length > 4 && (
              <div className="px-8 py-3 bg-brand-bone/30 text-center">
                <p className="text-[9px] text-brand-ink/30">+{unreadMsgs.length - 4} mensaje{unreadMsgs.length - 4 > 1 ? 's' : ''} más</p>
              </div>
            )}
          </motion.div>
        );
      })()}

      {/* ─── Dashboard Chat Modal ─── */}
      <AnimatePresence>
        {dashChatSupplierId && (() => {
          const msgs = SupplierMessageService.getBySupplier(dashChatSupplierId);
          const supplierName = msgs[0]?.supplierName || 'Proveedor';
          const supplier = MOCK_SUPPLIERS.find(s => s.id === dashChatSupplierId);
          return (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[200] flex items-center justify-center p-4"
              onClick={() => { setDashChatSupplierId(null); setDashChatReply(''); }}>
              <motion.div initial={{ opacity: 0, y: 30, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 30, scale: 0.95 }}
                className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col" style={{ maxHeight: '80vh' }}
                onClick={e => e.stopPropagation()}>
                <div className="px-6 py-4 bg-brand-ink text-brand-paper flex items-center justify-between flex-shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-brand-gold/20 flex items-center justify-center">
                      <MessageSquare size={16} className="text-brand-gold" />
                    </div>
                    <div>
                      <p className="text-[11px] font-bold">{supplierName}</p>
                      <p className="text-[8px] text-brand-paper/40 font-mono">{supplier?.rfc || ''}</p>
                    </div>
                  </div>
                  <button onClick={() => { setDashChatSupplierId(null); setDashChatReply(''); }}><X size={16} className="text-brand-paper/40 hover:text-brand-paper" /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-5 space-y-3" style={{ minHeight: 200 }}>
                  {msgs.length === 0 ? (
                    <div className="text-center py-10">
                      <MessageSquare size={32} className="text-brand-ink/10 mx-auto mb-3" />
                      <p className="text-brand-ink/30 text-[11px]">Sin mensajes</p>
                    </div>
                  ) : msgs.map(msg => (
                    <div key={msg.id} className={`flex ${msg.from === 'corporate' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] rounded-2xl px-4 py-3 ${
                        msg.from === 'corporate'
                          ? 'bg-brand-ink text-brand-paper rounded-br-md'
                          : 'bg-brand-bone text-brand-ink border border-brand-sand/20 rounded-bl-md'
                      }`}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[8px] font-bold uppercase tracking-wider ${msg.from === 'corporate' ? 'text-brand-gold' : 'text-brand-ink/40'}`}>
                            {msg.from === 'corporate' ? '🏢 Tú (Corporativo)' : `📦 ${supplierName.split(' ')[0]}`}
                          </span>
                        </div>
                        <p className="text-[10px] leading-relaxed">{msg.text}</p>
                        <p className={`text-[7px] mt-1.5 ${msg.from === 'corporate' ? 'text-brand-paper/30' : 'text-brand-ink/20'}`}>
                          {new Date(msg.date).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' })} · {new Date(msg.date).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="p-4 border-t border-brand-sand/20 flex-shrink-0">
                  <div className="flex gap-2">
                    <textarea value={dashChatReply} onChange={e => setDashChatReply(e.target.value)} rows={2} placeholder="Responder al proveedor..."
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey && dashChatReply.trim()) {
                          e.preventDefault();
                          SupplierMessageService.send(dashChatSupplierId, supplierName, 'corporate', dashChatReply.trim());
                          setDashChatReply('');
                        }
                      }}
                      className="flex-1 px-4 py-2.5 bg-brand-bone border border-brand-sand/30 rounded-xl text-[10px] outline-none focus:border-brand-gold resize-none" />
                    <button onClick={() => {
                      if (dashChatReply.trim()) {
                        SupplierMessageService.send(dashChatSupplierId, supplierName, 'corporate', dashChatReply.trim());
                        setDashChatReply('');
                      }
                    }} disabled={!dashChatReply.trim()}
                      className="w-11 h-11 bg-brand-ink text-brand-paper rounded-xl flex items-center justify-center disabled:opacity-30 hover:bg-brand-gold hover:text-brand-ink transition-all flex-shrink-0">
                      <Send size={14} />
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* ─── Radiografía de Proveedores: vista comparativa unificada ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left: Stacked bar — Pagado vs Pendiente por proveedor */}
        <div className="lg:col-span-8 bg-white/40 backdrop-blur-md rounded-[3rem] p-8 border border-brand-sand/30 shadow-inner flex flex-col">
          <div className="flex justify-between items-center mb-5">
            <div>
              <h3 className="text-xl font-serif text-brand-ink">Radiografía de Proveedores</h3>
              <p className="text-[9px] uppercase tracking-widest opacity-40">Pagado vs Pendiente por proveedor · {timeFrame === 'monthly' ? '30D' : timeFrame === 'quarterly' ? '90D' : '1A'}</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm bg-brand-gold" />
                <span className="text-[8px] uppercase tracking-wider text-brand-ink/30 font-bold">Pagado</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm bg-brand-ink/15" />
                <span className="text-[8px] uppercase tracking-wider text-brand-ink/30 font-bold">Pendiente</span>
              </div>
            </div>
          </div>

          {(() => {
            // Build per-provider data: paid vs pending
            type ProviderRow = { name: string; pagado: number; pendiente: number; total: number };
            const providerMap: Record<string, ProviderRow> = {};
            filteredInvoices.forEach(inv => {
              if (!providerMap[inv.provider]) providerMap[inv.provider] = { name: inv.provider, pagado: 0, pendiente: 0, total: 0 };
              if (inv.status === 'paid') providerMap[inv.provider].pagado += inv.amount;
              else if (inv.status !== 'rejected') providerMap[inv.provider].pendiente += inv.amount;
              providerMap[inv.provider].total = providerMap[inv.provider].pagado + providerMap[inv.provider].pendiente;
            });
            const providerData = Object.values(providerMap).sort((a, b) => b.total - a.total).slice(0, 8);

            return (
              <div className="flex-1 h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={providerData} layout="vertical" barGap={0} barSize={14}
                    margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E6D5B8" horizontal={false} opacity={0.3} />
                    <XAxis type="number" tick={{ fontSize: 8, fill: '#1A1A1A', opacity: 0.3 }}
                      tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}K`} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 8, fill: '#1A1A1A', opacity: 0.5 }}
                      width={110} axisLine={false} tickLine={false} />
                    <RechartsTooltip
                      contentStyle={{ background: '#1A1A1A', border: 'none', borderRadius: '12px', color: '#F5F0E8', fontSize: '10px', fontFamily: 'Inter', padding: '8px 12px' }}
                      formatter={(value: number, name: string) => [
                        `$${value.toLocaleString('es-MX')}`,
                        name === 'pagado' ? '✓ Pagado' : '◷ Pendiente'
                      ]}
                    />
                    <Bar dataKey="pagado" name="pagado" stackId="a" fill="#C5A059" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="pendiente" name="pendiente" stackId="a" fill="#1A1A1A" fillOpacity={0.12} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            );
          })()}
        </div>

        {/* Right: Summary donut — Budget breakdown */}
        <div className="lg:col-span-4 bg-white/40 backdrop-blur-md rounded-[3rem] p-8 border border-brand-sand/30 shadow-inner flex flex-col">
          <div className="mb-4">
            <h3 className="text-lg font-serif text-brand-ink">Composición del Gasto</h3>
            <p className="text-[9px] uppercase tracking-widest opacity-40">vs Presupuesto Maestro</p>
          </div>

          {(() => {
            const totalPaidAmt = filteredInvoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.amount, 0);
            const totalPendingAmt = filteredInvoices.filter(i => i.status !== 'paid' && i.status !== 'rejected').reduce((s, i) => s + i.amount, 0);
            const disponible = Math.max(totalBudget - totalPaidAmt - totalPendingAmt, 0);
            const summaryData = [
              { name: 'Pagado', value: totalPaidAmt, color: '#C5A059' },
              { name: 'CxP Pendiente', value: totalPendingAmt, color: '#1A1A1A' },
              { name: 'Disponible', value: disponible, color: '#E6D5B8' },
            ];

            return (
              <>
                <div className="flex-1 h-[160px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={summaryData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                        {summaryData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} fillOpacity={entry.name === 'Disponible' ? 0.3 : 0.85} />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        contentStyle={{ background: '#1A1A1A', border: 'none', borderRadius: '12px', color: '#F5F0E8', fontSize: '10px', padding: '8px 12px' }}
                        formatter={(value: number, name: string) => [
                          `$${value.toLocaleString('es-MX')} (${((value / totalBudget) * 100).toFixed(1)}%)`,
                          name
                        ]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="space-y-3 mt-2">
                  {summaryData.map(item => (
                    <div key={item.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color, opacity: item.name === 'Disponible' ? 0.3 : 0.85 }} />
                        <span className="text-[9px] uppercase tracking-wider text-brand-ink/50 font-bold">{item.name}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-serif text-sm text-brand-ink">{((item.value / totalBudget) * 100).toFixed(1)}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            );
          })()}
        </div>
      </div>

      {/* Activity Component & Small Indicators */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch relative">
        {/* Treasury Traffic Light Modal (Mini Window) */}
        <AnimatePresence>
          {selectedTrafficColor && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="absolute inset-0 z-50 flex items-center justify-center p-4 lg:p-12 pointer-events-none"
            >
              <div className="bg-brand-ink text-brand-bone rounded-[2rem] shadow-2xl p-8 w-full max-w-sm pointer-events-auto border border-brand-gold/30">
                <div className="flex justify-between items-center mb-6">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${trafficLightStats[selectedTrafficColor].color} ${trafficLightStats[selectedTrafficColor].shadow} shadow-lg`} />
                    <h4 className="text-lg font-serif">Detalle: {trafficLightStats[selectedTrafficColor].label}</h4>
                  </div>
                  <button onClick={() => setSelectedTrafficColor(null)} className="p-1 hover:bg-white/10 rounded-full transition-colors">
                    <X size={16} />
                  </button>
                </div>
                
                <div className="space-y-4 max-h-60 overflow-y-auto pr-2 scrollbar-hide">
                  {getProviderBreakdown(selectedTrafficColor).map((item, idx) => (
                    <div 
                      key={idx} 
                      className="flex justify-between items-center py-2 border-b border-white/5 cursor-pointer hover:bg-white/5 px-2 rounded-lg transition-colors group"
                      onClick={() => {
                        onNavigateToProvider(item.name, trafficLightStats[selectedTrafficColor].label);
                        setSelectedTrafficColor(null);
                      }}
                    >
                      <div className="flex flex-col">
                        <span className="text-[11px] font-serif truncate max-w-[180px] group-hover:text-brand-gold transition-colors">{item.name}</span>
                        <span className="text-[7px] uppercase tracking-widest text-white/30 group-hover:text-white/50">Ver detalle y facturas</span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-[10px] bg-brand-gold/20 px-2 py-0.5 rounded text-brand-gold font-bold">
                          {item.count} {item.count === 1 ? 'Factura' : 'Facturas'}
                        </span>
                        <ChevronRight size={10} className="mt-1 opacity-20 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                      </div>
                    </div>
                  ))}
                  {getProviderBreakdown(selectedTrafficColor).length === 0 && (
                    <p className="text-center py-8 text-[10px] opacity-30 uppercase tracking-widest">No hay registros</p>
                  )}
                </div>

                <p className="mt-6 text-[8px] uppercase tracking-widest text-center opacity-30 flex items-center justify-center gap-2">
                  <ShieldCheck size={10} /> Royáltica Audit System Active
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="lg:col-span-8 flex flex-col">
          <div className="editorial-card !p-6 relative overflow-hidden flex-1 flex flex-col">
            {(() => {
              // ─── Build real treasury activity from invoices ───
              // Group by week for monthly, by half-month for quarterly, by month for yearly
              const refDate = new Date('2024-04-27');
              const relevantInvoices = invoices.filter(inv => {
                const d = new Date(inv.date);
                if (timeFrame === 'monthly') {
                  const threshold = new Date(refDate);
                  threshold.setDate(threshold.getDate() - 30);
                  return d >= threshold && d <= refDate;
                } else if (timeFrame === 'quarterly') {
                  const threshold = new Date(refDate);
                  threshold.setDate(threshold.getDate() - 90);
                  return d >= threshold && d <= refDate;
                }
                return d <= refDate; // yearly: all
              });

              type TreasuryBucket = { label: string; entradas: number; salidas: number };

              // Build weekly buckets from actual data range
              const dates = relevantInvoices.map(inv => new Date(inv.date).getTime());
              const minDate = dates.length > 0 ? Math.min(...dates) : refDate.getTime() - 30 * 86400000;
              const maxDate = refDate.getTime();
              const range = maxDate - minDate;

              const bucketCount = timeFrame === 'monthly' ? 6 : timeFrame === 'quarterly' ? 8 : 6;
              const msPerBucket = range / bucketCount;

              const buckets: TreasuryBucket[] = [];
              for (let i = 0; i < bucketCount; i++) {
                const bucketStart = new Date(minDate + i * msPerBucket);
                const bucketEnd = new Date(minDate + (i + 1) * msPerBucket);

                const bucketInvoices = relevantInvoices.filter(inv => {
                  const d = new Date(inv.date);
                  return d >= bucketStart && d < bucketEnd;
                });

                const entradas = bucketInvoices.filter(inv => inv.status === 'paid').reduce((s, inv) => s + inv.amount, 0);
                const salidas = bucketInvoices.filter(inv => inv.status !== 'paid' && inv.status !== 'rejected').reduce((s, inv) => s + inv.amount, 0);

                const label = timeFrame === 'yearly'
                  ? bucketStart.toLocaleDateString('es-MX', { month: 'short' })
                  : `${bucketStart.getDate()}/${bucketStart.getMonth() + 1}`;

                buckets.push({ label, entradas, salidas });
              }

              const totalEntradas = buckets.reduce((s, b) => s + b.entradas, 0);
              const totalSalidas = buckets.reduce((s, b) => s + b.salidas, 0);
              const neto = totalEntradas - totalSalidas;

              return (
                <>
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <h3 className="text-lg font-serif text-brand-ink">Actividad de Tesorería</h3>
                      <p className="text-[9px] uppercase tracking-widest opacity-40">
                        {relevantInvoices.length} transacciones · {timeFrame === 'monthly' ? '30D' : timeFrame === 'quarterly' ? '90D' : '1A'}
                      </p>
                    </div>
                    <div className="flex gap-4 items-end">
                      <div className="text-right leading-none">
                        <p className="text-[7px] uppercase tracking-widest opacity-25 font-bold">Entradas</p>
                        <p className="font-serif text-sm text-green-600">${(totalEntradas / 1000).toFixed(0)}K</p>
                      </div>
                      <div className="text-right leading-none">
                        <p className="text-[7px] uppercase tracking-widest opacity-25 font-bold">Salidas</p>
                        <p className="font-serif text-sm text-brand-ink/50">${(totalSalidas / 1000).toFixed(0)}K</p>
                      </div>
                      <div className="text-right leading-none">
                        <p className="text-[7px] uppercase tracking-widest opacity-25 font-bold">Neto</p>
                        <p className={`font-serif text-sm font-bold ${neto >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                          {neto >= 0 ? '+' : ''}{(neto / 1000).toFixed(0)}K
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 min-h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={buckets} barGap={1} barSize={20} margin={{ top: 0, right: 0, left: -24, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E6D5B8" vertical={false} opacity={0.3} />
                        <XAxis dataKey="label" tick={{ fontSize: 8, fill: '#1A1A1A', opacity: 0.35 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 7, fill: '#1A1A1A', opacity: 0.25 }} axisLine={false} tickLine={false}
                          tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}K`} width={36} />
                        <RechartsTooltip
                          contentStyle={{ background: '#1A1A1A', border: 'none', borderRadius: '12px', color: '#F5F0E8', fontSize: '10px', fontFamily: 'Inter', padding: '8px 12px' }}
                          formatter={(value: number, name: string) => [
                            `$${value.toLocaleString('es-MX')}`,
                            name === 'entradas' ? '↑ Cobros' : '↓ Por pagar'
                          ]}
                          labelFormatter={(label) => `${label}`}
                        />
                        <Bar dataKey="entradas" name="entradas" radius={[4, 4, 0, 0]} fill="#C5A059" fillOpacity={0.85} />
                        <Bar dataKey="salidas" name="salidas" radius={[4, 4, 0, 0]} fill="#1A1A1A" fillOpacity={0.15} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="flex items-center gap-4 mt-2">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 bg-brand-gold rounded-sm" />
                      <span className="text-[8px] uppercase font-bold opacity-30 tracking-tighter">Cobros</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 bg-brand-ink/15 rounded-sm" />
                      <span className="text-[8px] uppercase font-bold opacity-30 tracking-tighter">Por pagar</span>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>

        <div className="lg:col-span-4 flex flex-col">
          {/* Treasury Traffic Light (Semáforo) */}
          <div
            className="bg-brand-cream border border-brand-sand/50 rounded-[2.5rem] p-8 shadow-inner flex flex-col gap-6 group cursor-pointer relative overflow-hidden flex-1"
            onClick={() => setSelectedTrafficColor(selectedTrafficColor ? null : 'red')}
          >
            <div className="flex justify-between items-center mb-2">
              <span className="label-caps !text-brand-ink/40 !text-[9px]">Semáforo de Pagos (30D Max)</span>
              <AlertCircle size={14} className="text-brand-ink/20" />
            </div>
            
            <div className="flex flex-col gap-4">
              {(['red', 'orange', 'yellow', 'green'] as const).map((color) => (
                <div 
                  key={color} 
                  className={`flex items-center justify-between group/row hover:translate-x-1 transition-transform cursor-pointer px-2 py-1 rounded-xl hover:bg-brand-bone`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedTrafficColor(color);
                  }}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-4 h-4 rounded-full ${trafficLightStats[color].color} ${trafficLightStats[color].shadow} shadow-lg transition-transform group-hover/row:scale-110`} />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-brand-ink/60">{trafficLightStats[color].label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-serif text-brand-ink">{trafficLightStats[color].invoices.length}</span>
                    <ChevronRight size={12} className="opacity-0 group-hover/row:opacity-30 transition-opacity" />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-4 border-t border-brand-sand/30 flex justify-between items-center">
              <span className="text-[8px] uppercase tracking-widest font-black text-brand-ink/20">Click para detalle</span>
              <div className="px-2 py-0.5 bg-brand-ink text-brand-paper rounded text-[7px] font-bold">MONITOR ACTIVO</div>
            </div>
          </div>

        </div>
      </div>

      {/* ─── Indicadores rápidos: Promedio de Pago + Saldo Fintech ─── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Promedio de Pago */}
        <div className="bg-brand-gold/10 p-6 rounded-[2.5rem] border border-brand-gold/20 flex items-center justify-between group overflow-hidden relative">
          <TrendingDown className="absolute -top-4 -right-4 w-24 h-24 text-brand-gold/5 -rotate-12 transition-transform group-hover:rotate-0" />
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <Timer size={16} className="text-brand-gold" />
              <span className="label-caps !text-brand-gold !text-[9px]">Días Promedio de Pago</span>
            </div>
            <div className="text-4xl font-serif text-brand-ink">{avgPaymentDays} Días</div>
          </div>
          <p className="relative z-10 text-[9px] uppercase tracking-widest text-brand-ink/30 font-bold text-right max-w-[140px]">Calculado sobre facturas pagadas del periodo</p>
        </div>

        {/* Fintech Deadline */}
        <div className="bg-brand-ink p-6 rounded-[2.5rem] text-brand-paper flex items-center justify-between group overflow-hidden relative shadow-xl">
           <div className="absolute inset-0 bg-gradient-to-br from-brand-gold/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
           <div className="relative z-10">
              <div className="flex items-center gap-2 mb-2">
                <Zap size={16} className="text-brand-gold" />
                <span className="label-caps !text-brand-paper/40 !text-[9px]">Saldo Fintech</span>
              </div>
              <div className="text-4xl font-serif text-brand-gold">{fintechDeadline} Días</div>
           </div>
           <div className="relative z-10 flex flex-col items-end gap-2">
              <p className="text-[10px] text-brand-paper/60 font-medium uppercase tracking-[0.2em]">VENCE EN 14 DÍAS</p>
              <button
                onClick={() => setShowFintechPayment(true)}
                className="px-4 py-2 bg-brand-gold text-brand-ink rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-brand-gold/90 transition-all shadow-sm flex-shrink-0"
              >
                Pagar
              </button>
           </div>
        </div>
      </div>

      {/* ─── NEW: Alerts Panel ─── */}
      {(() => {
        const today = new Date('2024-04-27');
        const alerts: { type: 'overdue' | 'doc_expiring' | 'urgent'; message: string; severity: 'red' | 'orange' | 'yellow' }[] = [];

        // Overdue invoices > 30 days
        const overdueInvs = filteredInvoices.filter(i => {
          if (i.status === 'paid' || i.status === 'rejected') return false;
          return Math.floor((today.getTime() - new Date(i.date).getTime()) / (1000 * 60 * 60 * 24)) > 30;
        });
        if (overdueInvs.length > 0) {
          const providers = [...new Set(overdueInvs.map(i => i.provider))];
          alerts.push({ type: 'overdue', message: `${overdueInvs.length} factura${overdueInvs.length > 1 ? 's' : ''} vencida${overdueInvs.length > 1 ? 's' : ''} (>30 días) de ${providers.slice(0, 3).join(', ')}${providers.length > 3 ? ` y ${providers.length - 3} más` : ''}`, severity: 'red' });
        }

        // Suppliers with pending documents
        const pendingDocs = MOCK_SUPPLIERS.filter(s => s.documents.some(d => d.status === 'Pendiente'));
        if (pendingDocs.length > 0) {
          alerts.push({ type: 'doc_expiring', message: `${pendingDocs.length} proveedor${pendingDocs.length > 1 ? 'es' : ''} con documentos pendientes/vencidos (SAT/REPSE)`, severity: 'orange' });
        }

        // Urgent priority invoices
        const urgentUnpaid = filteredInvoices.filter(i => i.status !== 'paid' && getPriorityInfo(i.date).label === 'Urgente');
        if (urgentUnpaid.length > 0) {
          alerts.push({ type: 'urgent', message: `${urgentUnpaid.length} factura${urgentUnpaid.length > 1 ? 's' : ''} marcada${urgentUnpaid.length > 1 ? 's' : ''} como urgente${urgentUnpaid.length > 1 ? 's' : ''} sin liquidar`, severity: 'yellow' });
        }

        if (alerts.length === 0) return null;

        const SEVERITY = { red: 'bg-red-50 border-red-200 text-red-700', orange: 'bg-orange-50 border-orange-200 text-orange-700', yellow: 'bg-yellow-50 border-yellow-200 text-yellow-700' };
        const ICONS = { red: <AlertTriangle size={14} />, orange: <FileText size={14} />, yellow: <Clock size={14} /> };

        return (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Bell size={14} className="text-brand-ink/30" />
              <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-ink/40">Alertas Activas ({alerts.length})</span>
            </div>
            <div className="space-y-2">
              {alerts.map((alert, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}
                  className={`flex items-center gap-3 px-5 py-3 rounded-2xl border ${SEVERITY[alert.severity]}`}>
                  {ICONS[alert.severity]}
                  <p className="text-[11px] font-medium flex-1">{alert.message}</p>
                </motion.div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* ─── NEW: Cash Flow Projection + KPI Ahorro ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Cash Flow Projection Chart */}
        <div className="lg:col-span-8 bg-white/40 backdrop-blur-md rounded-[3rem] p-10 border border-brand-sand/30 shadow-inner">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-xl font-serif text-brand-ink">Flujo de Caja Proyectado</h3>
              <p className="text-[9px] uppercase tracking-widest opacity-40">Próximos 60 días · Ingresos vs Egresos proyectados</p>
            </div>
            <TrendingUp size={18} className="text-brand-gold opacity-50" />
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={(() => {
                const refDate = new Date('2024-04-27');
                const data = [];
                const pendingInvs = invoices.filter(i => i.status !== 'paid' && i.status !== 'rejected');
                const paidInvs = invoices.filter(i => i.status === 'paid');

                // Derive realistic baseline from actual historical paid data
                const totalPaidAmount = paidInvs.reduce((s, i) => s + i.amount, 0);
                const paidDates = paidInvs.map(i => new Date(i.date).getTime());
                const paidSpanDays = paidDates.length > 1
                  ? Math.max(1, (Math.max(...paidDates) - Math.min(...paidDates)) / (1000 * 60 * 60 * 24))
                  : 60;
                const dailyAvgPaid = totalPaidAmount / paidSpanDays;

                // Group pending invoices by estimated due date (30 days after emission)
                const pendingByDue: Record<number, number> = {};
                pendingInvs.forEach(inv => {
                  const dueDate = new Date(inv.date);
                  dueDate.setDate(dueDate.getDate() + 30);
                  // Round to nearest 5-day bucket
                  const daysDiff = Math.round((dueDate.getTime() - refDate.getTime()) / (1000 * 60 * 60 * 24));
                  const bucket = Math.round(daysDiff / 5) * 5;
                  if (bucket >= 0 && bucket <= 60) {
                    pendingByDue[bucket] = (pendingByDue[bucket] || 0) + inv.amount;
                  }
                });

                let balanceAccum = totalBudget * 0.6;

                for (let d = 0; d <= 60; d += 5) {
                  const day = new Date(refDate);
                  day.setDate(day.getDate() + d);
                  const label = `${day.getDate()}/${day.getMonth() + 1}`;

                  // Egresos: actual pending invoices coming due at this bucket
                  const egresos = pendingByDue[d] || dailyAvgPaid * 3;
                  // Ingresos: projected from historical collection rate, slight decay for further future
                  const decayFactor = 1 - (d / 60) * 0.15;
                  const ingresos = dailyAvgPaid * 5 * decayFactor;

                  balanceAccum = balanceAccum + ingresos - egresos;

                  data.push({ dia: label, Ingresos: Math.round(ingresos), Egresos: Math.round(egresos), Balance: Math.round(Math.max(balanceAccum, 0)) });
                }
                return data;
              })()}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E6D5B8" opacity={0.3} />
                <XAxis dataKey="dia" tick={{ fontSize: 9, fill: '#1A1A1A' }} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: '#1A1A1A' }} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <RechartsTooltip
                  contentStyle={{ background: '#1A1A1A', border: 'none', borderRadius: '12px', color: '#F5F0E8', fontSize: '10px' }}
                  formatter={(value: number) => [`$${value.toLocaleString()}`, '']}
                />
                <Area type="monotone" dataKey="Ingresos" stroke="#22c55e" fill="#22c55e" fillOpacity={0.1} strokeWidth={2} />
                <Area type="monotone" dataKey="Egresos" stroke="#ef4444" fill="#ef4444" fillOpacity={0.1} strokeWidth={2} />
                <Line type="monotone" dataKey="Balance" stroke="#D4AF37" strokeWidth={2.5} dot={false} strokeDasharray="6 3" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="flex gap-6 mt-4">
            <div className="flex items-center gap-2"><div className="w-3 h-1 bg-green-500 rounded-full" /><span className="text-[9px] text-brand-ink/40">Ingresos</span></div>
            <div className="flex items-center gap-2"><div className="w-3 h-1 bg-red-500 rounded-full" /><span className="text-[9px] text-brand-ink/40">Egresos</span></div>
            <div className="flex items-center gap-2"><div className="w-3 h-1 bg-brand-gold rounded-full" style={{ borderTop: '2px dashed #D4AF37' }} /><span className="text-[9px] text-brand-ink/40">Balance Proyectado</span></div>
          </div>
        </div>

        {/* KPI: Savings vs Fintech */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <div className="bg-white/40 backdrop-blur-md rounded-[2.5rem] p-8 border border-brand-sand/30 shadow-inner space-y-5 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign size={16} className="text-green-600" />
              <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-brand-ink/40">Ahorro vs Fintech</span>
            </div>
            {(() => {
              const cashPaid = invoices.filter(i => i.paymentRoute === 'cash' && i.status === 'paid');
              const fintechPaid = invoices.filter(i => i.paymentRoute === 'fintech' && i.status === 'paid');
              const cashTotal = cashPaid.reduce((s, i) => s + i.amount, 0);
              const fintechCost = fintechPaid.reduce((s, i) => s + i.amount, 0);
              const fintechFee = fintechCost * 0.035; // 3.5% simulated fee
              const savedByCash = cashTotal * 0.035; // What would have cost via fintech
              return (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase tracking-wider text-brand-ink/30">Pagado con caja propia</p>
                    <p className="text-2xl font-serif text-brand-ink">{CURRENCY_FORMATTER.format(cashTotal)}</p>
                    <p className="text-[9px] text-green-600 font-bold">Ahorro en comisiones: {CURRENCY_FORMATTER.format(savedByCash)}</p>
                  </div>
                  <div className="border-t border-brand-sand/30 pt-4 space-y-1">
                    <p className="text-[10px] uppercase tracking-wider text-brand-ink/30">Pagado con fintech</p>
                    <p className="text-2xl font-serif text-orange-600">{CURRENCY_FORMATTER.format(fintechCost)}</p>
                    <p className="text-[9px] text-orange-500 font-bold">Comisión estimada (3.5%): {CURRENCY_FORMATTER.format(fintechFee)}</p>
                  </div>
                  <div className="border-t border-brand-sand/30 pt-4">
                    <div className="flex items-center gap-2">
                      <Percent size={14} className="text-brand-gold" />
                      <p className="text-[10px] uppercase tracking-wider text-brand-ink/40">Eficiencia financiera</p>
                    </div>
                    <p className="text-3xl font-serif text-brand-gold mt-1">
                      {cashTotal + fintechCost > 0 ? ((cashTotal / (cashTotal + fintechCost)) * 100).toFixed(0) : 0}%
                    </p>
                    <p className="text-[9px] text-brand-ink/30">Pagos con caja propia vs total</p>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Export Button */}
          <button
            onClick={() => { window.print(); }}
            className="flex items-center justify-center gap-3 px-6 py-4 bg-brand-ink text-brand-bone rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-gold hover:text-brand-ink transition-all shadow-md"
          >
            <Printer size={16} /> Exportar Reporte (PDF)
          </button>
        </div>
      </div>
    </div>

    {/* ─── Floating Report Button ─── */}
    <div className="fixed bottom-24 right-8 z-[90]">
      <AnimatePresence>
        {!showReportModal && (
          <motion.button
            initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
            onClick={() => setShowReportModal(true)}
            className="w-11 h-11 rounded-full bg-brand-ink text-brand-bone shadow-lg flex items-center justify-center hover:bg-brand-gold hover:text-brand-ink transition-all"
            title="Generar Reporte IA"
          >
            <FileBarChart size={16} />
          </motion.button>
        )}
      </AnimatePresence>
    </div>

    {/* ─── Report Generation Modal ─── */}
    <AnimatePresence>
      {showReportModal && (
        <motion.div
          key="report-modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] bg-brand-ink/40 backdrop-blur-sm flex items-center justify-center p-6"
          onClick={() => { if (!reportLoading) { setShowReportModal(false); setReportContent(null); } }}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={e => e.stopPropagation()}
            className="w-full max-w-2xl max-h-[80vh] bg-white rounded-[2rem] border border-brand-sand/40 shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-8 py-5 border-b border-brand-sand/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-ink flex items-center justify-center">
                  <FileBarChart size={18} className="text-brand-bone" />
                </div>
                <div>
                  <p className="text-lg font-bold text-brand-ink">Generador de Reportes IA</p>
                  <p className="text-[9px] uppercase tracking-widest text-brand-ink/30">Powered by Gemini · Datos en tiempo real</p>
                </div>
              </div>
              <button onClick={() => { setShowReportModal(false); setReportContent(null); }} className="p-2 hover:bg-brand-sand/20 rounded-xl transition-all">
                <X size={18} className="text-brand-ink/40" />
              </button>
            </div>

            {/* Report type selector */}
            {!reportContent && !reportLoading && (
              <div className="p-8 space-y-6">
                <p className="text-[10px] uppercase tracking-widest font-bold text-brand-ink/40">Selecciona el tipo de reporte</p>
                <div className="grid grid-cols-2 gap-4">
                  {([
                    { type: 'executive' as ReportType, label: 'Ejecutivo de Tesorería', desc: 'Resumen de cartera, pagos y alertas para junta directiva', icon: <BarChart3 size={20} /> },
                    { type: 'anticorruption' as ReportType, label: 'Alerta Anti-Corrupción', desc: 'Informe de proveedores con pagos vencidos y riesgos', icon: <AlertTriangle size={20} /> },
                    { type: 'fiscal' as ReportType, label: 'Cumplimiento Fiscal', desc: 'Estado de auditoría IA, riesgos DIOT y discrepancias', icon: <ShieldCheck size={20} /> },
                    { type: 'provider' as ReportType, label: 'Análisis de Proveedor', desc: 'Historial, patrones y nivel de riesgo de un proveedor', icon: <Building2 size={20} /> },
                  ]).map(({ type, label, desc, icon }) => (
                    <button
                      key={type}
                      onClick={() => setReportType(type)}
                      className={`text-left p-5 rounded-2xl border-2 transition-all space-y-2 ${
                        reportType === type ? 'border-brand-gold bg-brand-gold/5' : 'border-brand-sand/30 hover:border-brand-gold/50'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${reportType === type ? 'bg-brand-gold/20 text-brand-gold' : 'bg-brand-bone text-brand-ink/40'}`}>
                        {icon}
                      </div>
                      <p className="text-sm font-bold text-brand-ink">{label}</p>
                      <p className="text-[10px] text-brand-ink/40 leading-relaxed">{desc}</p>
                    </button>
                  ))}
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={handleGenerateReport}
                    className="flex items-center gap-2 px-6 py-3 bg-brand-ink text-brand-bone text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-brand-gold hover:text-brand-ink transition-all shadow-md"
                  >
                    <Sparkles size={14} /> Generar Reporte
                  </button>
                </div>
              </div>
            )}

            {/* Loading */}
            {reportLoading && (
              <div className="p-12 flex flex-col items-center justify-center space-y-4">
                <Loader2 size={32} className="animate-spin text-brand-gold" />
                <p className="text-sm text-brand-ink/40">Generando reporte con IA...</p>
                <p className="text-[9px] text-brand-ink/20 uppercase tracking-widest">Analizando {invoices.length} facturas y {MOCK_SUPPLIERS.length} proveedores</p>
              </div>
            )}

            {/* Report content */}
            {reportContent && (
              <div className="flex-1 overflow-y-auto p-8 space-y-4">
                <div className="prose prose-sm max-w-none">
                  {reportContent.split('\n').map((line, i) => (
                    <p key={i} className={`text-[12px] leading-relaxed text-brand-ink/80 ${line.startsWith('**') ? 'font-bold text-brand-ink !text-[13px]' : ''}`}>
                      {line.split(/(\*\*[^*]+\*\*)/).map((part, k) =>
                        part.startsWith('**') && part.endsWith('**')
                          ? <strong key={k} className="font-bold text-brand-ink">{part.slice(2, -2)}</strong>
                          : part
                      )}
                    </p>
                  ))}
                </div>
                <div className="flex gap-3 pt-4 border-t border-brand-sand/30">
                  <button
                    onClick={() => { navigator.clipboard.writeText(reportContent); }}
                    className="flex items-center gap-2 px-5 py-2.5 bg-brand-bone border border-brand-sand/40 text-brand-ink text-[10px] font-bold uppercase tracking-widest rounded-xl hover:border-brand-gold transition-all"
                  >
                    <ListChecks size={14} /> Copiar
                  </button>
                  <button
                    onClick={() => { setReportContent(null); }}
                    className="flex items-center gap-2 px-5 py-2.5 bg-brand-ink text-brand-bone text-[10px] font-bold uppercase tracking-widest rounded-xl hover:bg-brand-gold hover:text-brand-ink transition-all"
                  >
                    <RotateCcw size={14} /> Generar Otro
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>

    <AnimatePresence>
      {showFintechPayment && (
        <FintechPaymentModal
          fintechTotal={fintechTotal}
          totalBudget={totalBudget}
          onClose={() => setShowFintechPayment(false)}
        />
      )}
    </AnimatePresence>
    </>
  );
}

function CreativeCard({ icon, label, value, subValue, theme, onClick }: {
  icon: React.ReactNode,
  label: string,
  value: number | string,
  subValue: string,
  theme: 'green' | 'gold' | 'red' | 'orange' | 'dark',
  onClick?: () => void
}) {
  const themeStyles = {
    green: 'bg-green-50/50 border-green-100 text-green-700',
    gold: 'bg-brand-gold/5 border-brand-gold/20 text-brand-ink',
    red: 'bg-red-50/50 border-red-100 text-red-700',
    orange: 'bg-orange-50/50 border-orange-100 text-orange-700',
    dark: 'bg-brand-bone border-brand-sand/50 text-brand-ink'
  };

  return (
    <div onClick={onClick} className={`p-8 rounded-[2.5rem] border ${themeStyles[theme]} shadow-sm hover:shadow-md transition-all group relative overflow-hidden ${onClick ? 'cursor-pointer hover:-translate-y-0.5' : ''}`}>
      <div className="flex justify-between items-start mb-8 relative z-10">
        <div className="w-12 h-12 bg-white/80 backdrop-blur-sm rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
          {icon}
        </div>
        <div className="text-[9px] font-black uppercase tracking-[0.2em] opacity-30">{label}</div>
      </div>
      
      <div className="relative z-10">
        <div className="text-5xl font-serif mb-2">
          {typeof value === 'number' && value < 10 && value >= 0 ? `0${value}` : value}
        </div>
        <div className="text-[10px] font-bold uppercase tracking-widest opacity-40">{subValue}</div>
      </div>

      <div className="absolute bottom-0 right-0 p-4 transform translate-x-2 translate-y-2 opacity-5 scale-150 rotate-12">
        {icon}
      </div>
    </div>
  );
}

function StatCard({ label, value, subValue, icon }: { label: string, value: string, subValue: string, icon: React.ReactNode }) {
  return (
    <div className="editorial-card !p-8 shadow-md border-brand-sand/20 group hover:border-brand-gold transition-colors">
      <div className="flex justify-between items-start mb-6">
        <span className="label-caps !opacity-40">{label}</span>
        <div className="p-2 bg-brand-bone rounded-xl group-hover:bg-brand-gold/10 transition-colors">
          {icon}
        </div>
      </div>
      <div className="text-5xl font-serif text-brand-ink mb-1">
        {typeof value === 'string' && value.length === 1 && !isNaN(Number(value)) ? `0${value}` : value}
      </div>
      <div className="text-[10px] opacity-40 font-bold uppercase tracking-widest">{subValue}</div>
    </div>
  );
}

function AuditsView({
  selectedInvoice,
  setSelectedInvoice,
  isAuditing,
  auditResult,
  startAudit,
  routePayment,
  invoices,
  onUpdateInvoice,
  setViewingDocs,
  onTabChange,
  onApproveWithAnimation
}: {
  selectedInvoice: Invoice | null,
  setSelectedInvoice: (i: Invoice | null) => void,
  isAuditing: boolean,
  auditResult: ForensicAuditResult | null,
  startAudit: (i: Invoice) => void,
  routePayment: (id: string, route: 'cash' | 'fintech') => void,
  invoices: Invoice[],
  onUpdateInvoice: (id: string, updates: Partial<Invoice>) => void,
  setViewingDocs: (data: { title: string, docs: DocumentFile[] } | null) => void,
  onTabChange?: (tab: 'dashboard' | 'suppliers' | 'audits' | 'pending_invoices' | 'financing' | 'settings' | 'fiscal_audit') => void,
  onApproveWithAnimation?: (inv: Invoice) => void
}) {
  const [showAuthStatus, setShowAuthStatus] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('all');

  const [missingSearchTerm, setMissingSearchTerm] = useState('');
  const [missingPriorityFilter, setMissingPriorityFilter] = useState('all');

  // ─── Batch Audit State ───
  const [isBatchAuditing, setIsBatchAuditing] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ completed: 0, total: 0 });
  const [batchResults, setBatchResults] = useState<{ validated: number; discrepancy: number; blocked: number } | null>(null);

  const [auditSubTab, setAuditSubTab] = useState<'validated' | 'pending'>('validated');
  const [rejectClarInvoice, setRejectClarInvoice] = useState<Invoice | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [pendingMsgInvoice, setPendingMsgInvoice] = useState<Invoice | null>(null);
  const [pendingMsgText, setPendingMsgText] = useState('');
  const [pendingMsgSent, setPendingMsgSent] = useState(false);
  const [, setAuditClarTick] = useState(0);
  const [, setAuditMsgTick] = useState(0);
  useEffect(() => {
    const cb = () => setAuditClarTick(t => t + 1);
    ClarificationService.subscribe(cb);
    return () => ClarificationService.unsubscribe(cb);
  }, []);
  useEffect(() => {
    const cb = () => setAuditMsgTick(t => t + 1);
    SupplierMessageService.subscribe(cb);
    return () => SupplierMessageService.unsubscribe(cb);
  }, []);

  const pendingForBatch = invoices.filter(i => i.status === 'pending' && !i.auditScore);

  const startBatchAudit = async () => {
    if (pendingForBatch.length === 0) return;
    setIsBatchAuditing(true);
    setBatchProgress({ completed: 0, total: pendingForBatch.length });
    setBatchResults(null);

    const stats = { validated: 0, discrepancy: 0, blocked: 0 };

    await batchAuditInvoices(
      pendingForBatch,
      invoices,
      MOCK_SUPPLIERS,
      (completed, total, current, result) => {
        setBatchProgress({ completed, total });
        if (result.status === 'VALIDATED') stats.validated++;
        else if (result.status === 'DISCREPANCY') stats.discrepancy++;
        else stats.blocked++;

        onUpdateInvoice(current.id, {
          status: result.status === 'VALIDATED' ? 'audited' : current.status,
          auditScore: result.score,
          auditAnalysis: result.analysis,
          forensicStatus: result.status,
          forensicSolution: result.solution,
          signatures: result.status === 'VALIDATED' ? 1 : 0,
          satStatus: result.satResult?.estado as any || 'Pendiente',
          satVerifiedAt: new Date().toISOString(),
        });
      }
    );

    setBatchResults({ ...stats });
    setIsBatchAuditing(false);
  };

  // NOTE: Auto-transition to financing removed — invoices stay in validation view until manually moved

  // Invoices currently being audited or already audited (the "queue")
  const auditingInvoices = invoices.filter(inv => {
    const isFullyApproved = inv.status === 'approved' || inv.status === 'paid';
    const isInAuditProcess = (inv.status === 'audited' || (inv.auditScore && inv.auditScore > 0) || inv.id === selectedInvoice?.id);
    const isSearchMatch = (inv.id.toLowerCase().includes(searchTerm.toLowerCase()) || inv.provider.toLowerCase().includes(searchTerm.toLowerCase()));
    const isPriorityMatch = (priorityFilter === 'all' || getPriorityInfo(inv.date).label === priorityFilter);
    
    // EXCLUDE if fully approved OR if it has a discrepancy (those move to pending)
    const hasDiscrepancy = inv.forensicStatus === 'DISCREPANCY' || inv.forensicStatus === 'BLOCKED';
    return !isFullyApproved && isInAuditProcess && isSearchMatch && isPriorityMatch && !hasDiscrepancy;
  });

  // Real pending invoices (discrepancies detected by AI or blocked)
  const forensicPendingInvoices = invoices.filter(inv => {
    const hasDiscrepancy = inv.forensicStatus === 'DISCREPANCY' || inv.forensicStatus === 'BLOCKED';
    const matchesSearch = inv.id.toLowerCase().includes(missingSearchTerm.toLowerCase()) || inv.provider.toLowerCase().includes(missingSearchTerm.toLowerCase());
    const matchesPriority = missingPriorityFilter === 'all' || getPriorityInfo(inv.date).label === missingPriorityFilter;
    return hasDiscrepancy && matchesSearch && matchesPriority;
  });

  const allPendingInvoices = [...forensicPendingInvoices];

  // Auto-start audit when an invoice is selected (only once per invoice)
  const lastAutoAuditedRef = React.useRef<string | null>(null);
  useEffect(() => {
    if (selectedInvoice && !isAuditing && selectedInvoice.status === 'pending' && lastAutoAuditedRef.current !== selectedInvoice.id) {
      lastAutoAuditedRef.current = selectedInvoice.id;
      startAudit(selectedInvoice);
    }
  }, [selectedInvoice?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col pb-12">
      <header className="mb-6 flex-shrink-0 flex justify-between items-start text-brand-ink">
        <div>
          <span className="label-caps mb-2 block">Protocolo de Control Inmutable</span>
          <h2 className="text-4xl mb-4 font-serif">Centro de Validación AI</h2>
          <p className="text-sm opacity-40 max-w-2xl font-serif">
            Las facturas en proceso de validación aparecen aquí. Motor Triple Match automatizado.
          </p>
        </div>
        <div className="flex gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 opacity-30" size={14} />
            <input 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Buscar Factura..."
              className="pl-9 pr-4 py-2 bg-brand-cream border border-brand-sand rounded-xl text-xs focus:outline-none focus:border-brand-gold shadow-sm"
            />
          </div>
          <select 
            value={priorityFilter}
            onChange={e => setPriorityFilter(e.target.value)}
            className="px-4 py-2 bg-brand-cream border border-brand-sand rounded-xl text-[9px] uppercase font-bold tracking-wider shadow-sm cursor-pointer outline-none focus:border-brand-gold"
          >
            <option value="all">Filtro Prioridad</option>
            <option value="Baja">Baja</option>
            <option value="Media">Media</option>
            <option value="Media Alta">Media Alta</option>
            <option value="Urgente">Urgente</option>
          </select>
        </div>
      </header>

      {/* ─── Batch Audit Panel ─── */}
      {(pendingForBatch.length > 0 || isBatchAuditing || batchResults) && (
        <div className="mb-6 flex-shrink-0">
          <div className={`editorial-card !p-5 space-y-4 transition-all ${isBatchAuditing ? 'border-brand-gold/50 bg-brand-gold/5' : batchResults ? 'border-green-300 bg-green-50/30' : 'border-brand-sand/40'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isBatchAuditing ? 'bg-brand-gold/20' : batchResults ? 'bg-green-100' : 'bg-brand-bone'}`}>
                  {isBatchAuditing ? <Loader2 size={18} className="text-brand-gold animate-spin" /> : batchResults ? <CheckCircle2 size={18} className="text-green-600" /> : <Cpu size={18} className="text-brand-ink/40" />}
                </div>
                <div>
                  <p className="text-sm font-bold text-brand-ink">
                    {isBatchAuditing ? `Auditando ${batchProgress.completed}/${batchProgress.total} facturas...` : batchResults ? 'Auditoría batch completada' : `${pendingForBatch.length} facturas pendientes de auditar`}
                  </p>
                  <p className="text-[9px] uppercase tracking-widest text-brand-ink/40">
                    {isBatchAuditing ? 'Motor de reglas + IA para anomalías' : batchResults ? `✅ ${batchResults.validated} validadas · ⚠️ ${batchResults.discrepancy} discrepancias · 🚫 ${batchResults.blocked} bloqueadas` : 'Motor híbrido: código determinista + IA para dictámenes'}
                  </p>
                </div>
              </div>
              {!isBatchAuditing && !batchResults && (
                <button
                  onClick={startBatchAudit}
                  className="flex items-center gap-2 px-5 py-2.5 bg-brand-ink text-brand-bone text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-brand-gold hover:text-brand-ink transition-all shadow-md"
                >
                  <Play size={12} /> Auditar Todas
                </button>
              )}
              {batchResults && (
                <button
                  onClick={() => setBatchResults(null)}
                  className="text-[9px] font-bold uppercase tracking-widest text-brand-ink/30 hover:text-brand-ink transition-all px-3 py-1.5 border border-brand-sand/30 rounded-xl"
                >
                  Cerrar
                </button>
              )}
            </div>
            {isBatchAuditing && (
              <div className="space-y-2">
                <div className="w-full bg-brand-sand/30 rounded-full h-2.5 overflow-hidden">
                  <motion.div
                    className="h-full bg-brand-gold rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${batchProgress.total > 0 ? (batchProgress.completed / batchProgress.total) * 100 : 0}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
                <p className="text-[9px] text-brand-ink/30 text-right">{Math.round(batchProgress.total > 0 ? (batchProgress.completed / batchProgress.total) * 100 : 0)}% completado</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Sub-tab toggle ─── */}
      <div className="flex items-center gap-1 mb-6 bg-brand-bone/60 p-1 rounded-xl w-fit border border-brand-sand/30">
        {[
          { key: 'validated' as const, label: 'Facturas Validadas', count: auditingInvoices.length, icon: <CheckCircle2 size={13} /> },
          { key: 'pending' as const, label: 'Facturas Pendientes', count: allPendingInvoices.length, icon: <AlertTriangle size={13} /> },
        ].map(tab => (
          <button key={tab.key} onClick={() => setAuditSubTab(tab.key)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold transition-all ${
              auditSubTab === tab.key
                ? 'bg-brand-ink text-brand-bone shadow-md'
                : 'text-brand-ink/40 hover:text-brand-ink/70 hover:bg-white/50'
            }`}>
            {tab.icon}
            {tab.label}
            {tab.count > 0 && (
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-black ${
                auditSubTab === tab.key
                  ? tab.key === 'pending' ? 'bg-red-500 text-white' : 'bg-brand-gold text-brand-ink'
                  : tab.key === 'pending' && tab.count > 0 ? 'bg-red-100 text-red-600' : 'bg-brand-sand/40 text-brand-ink/40'
              }`}>{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* ═══════════════════ VALIDATED TAB ═══════════════════ */}
      {auditSubTab === 'validated' && (
        <>
          {/* ─── Validation Animation Overlay ─── */}
          <AnimatePresence>
            {isAuditing && selectedInvoice && (
              <motion.div key="audit-overlay" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4, ease: 'easeOut' }} className="mb-4">
                <div className="relative overflow-hidden rounded-2xl border border-brand-gold/30 bg-gradient-to-r from-brand-cream via-brand-gold/5 to-brand-cream p-6 shadow-lg shadow-brand-gold/10">
                  <motion.div className="absolute inset-0 bg-gradient-to-r from-transparent via-brand-gold/10 to-transparent"
                    animate={{ x: ['-100%', '200%'] }} transition={{ repeat: Infinity, duration: 2.5, ease: 'linear' }} />
                  <div className="relative z-10 flex items-center gap-6">
                    <div className="relative flex-shrink-0">
                      <motion.div className="w-16 h-16 rounded-full border-[3px] border-brand-gold/20 border-t-brand-gold"
                        animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }} />
                      <div className="absolute inset-0 flex items-center justify-center"><ShieldCheck size={24} className="text-brand-gold" /></div>
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-3">
                        <h3 className="text-lg font-serif text-brand-ink">Validando {selectedInvoice.id}</h3>
                        <motion.span className="text-[9px] px-3 py-1 rounded-full bg-brand-gold/20 text-brand-gold font-bold uppercase tracking-widest"
                          animate={{ opacity: [1, 0.4, 1] }} transition={{ repeat: Infinity, duration: 1.5 }}>En proceso</motion.span>
                      </div>
                      <p className="text-xs text-brand-ink/50">{selectedInvoice.provider} · {CURRENCY_FORMATTER.format(selectedInvoice.amount)}</p>
                      <div className="flex items-center gap-2">
                        {['Integridad', 'OC Match', 'SAT', 'Precios IA', 'Veredicto'].map((step, idx) => (
                          <motion.div key={step} className="px-3 py-1.5 rounded-lg bg-white/60 border border-brand-sand/30"
                            initial={{ opacity: 0.3 }} animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 2, delay: idx * 0.5 }}>
                            <span className="text-[8px] font-bold uppercase tracking-wider text-brand-ink/60">{step}</span>
                          </motion.div>
                        ))}
                      </div>
                      <div className="w-full h-1.5 bg-brand-sand/20 rounded-full overflow-hidden">
                        <motion.div className="h-full bg-gradient-to-r from-brand-gold to-brand-gold/60 rounded-full"
                          initial={{ width: '5%' }} animate={{ width: '85%' }} transition={{ duration: 4, ease: 'easeOut' }} />
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {auditingInvoices.length === 0 && !isBatchAuditing ? (
            <div className="editorial-card !p-20 text-center flex flex-col items-center justify-center space-y-6 border-dashed border-brand-sand shadow-none opacity-60">
              <div className="w-20 h-20 bg-brand-sand/20 rounded-full flex items-center justify-center text-brand-ink/40"><ShieldCheck size={40} /></div>
              <div className="space-y-2">
                <h3 className="text-2xl font-serif text-brand-ink">Sin facturas validadas</h3>
                <p className="text-sm text-brand-ink/40 max-w-xs mx-auto">Las facturas aparecerán aquí una vez que se procesen con el motor de validación.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {auditingInvoices.map(inv => {
                const isCurrent = inv.id === selectedInvoice?.id;
                const isProcessing = isCurrent && isAuditing;
                const priority = getPriorityInfo(inv.date);
                const sigs = inv.signatures || 0;
                const isFullyValidated = isInvoiceFullyValidated(inv);

                return (
                  <motion.div key={inv.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    className={`editorial-card !p-0 overflow-hidden border transition-all ${
                      isFullyValidated ? 'border-green-200 bg-green-50/20' :
                      inv.forensicStatus === 'VALIDATED' ? 'border-brand-sand/50' :
                      'border-brand-sand/30'
                    }`}>
                    {/* Card header */}
                    <div className="flex items-center justify-between px-5 py-4 border-b border-brand-sand/20">
                      <div className="flex items-center gap-4">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-brand-ink">{inv.id}</span>
                            <span className={`text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${
                              isFullyValidated ? 'bg-green-600 text-white' :
                              inv.forensicStatus === 'VALIDATED' ? 'bg-yellow-100 text-yellow-800 border border-yellow-300' :
                              'bg-brand-bone text-brand-ink/30 border border-brand-sand/30'
                            }`}>
                              {isFullyValidated ? 'VALIDADA' : inv.forensicStatus === 'VALIDATED' ? 'PARCIAL' : 'EN PROCESO'}
                            </span>
                          </div>
                          <span className="text-[10px] text-brand-ink/40 font-serif mt-0.5">{inv.provider}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-5">
                        <span className="text-base font-bold text-brand-ink">{CURRENCY_FORMATTER.format(inv.amount)}</span>
                        <div className="flex items-center gap-1.5">
                          <div className={`w-1.5 h-1.5 rounded-full ${priority.color}`} />
                          <span className={`text-[9px] font-bold uppercase tracking-wider ${priority.text}`}>{priority.label}</span>
                        </div>
                      </div>
                    </div>

                    {/* Triple Match — expanded horizontal layout */}
                    <div className="px-5 py-4">
                      {isProcessing ? (
                        <div className="flex items-center gap-3 py-2">
                          <motion.div className="w-5 h-5 rounded-full border-2 border-brand-gold/20 border-t-brand-gold"
                            animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }} />
                          <span className="text-xs font-bold text-brand-ink/50">Ejecutando Triple Match...</span>
                        </div>
                      ) : (
                        <div className="grid grid-cols-4 gap-3">
                          {[
                            { label: 'Orden de Compra', sub: 'Integridad documental', ok: inv.forensicStatus !== 'BLOCKED', fail: inv.forensicStatus === 'BLOCKED',
                              onClick: () => setViewingDocs({ title: `Integridad y OC - ${inv.id}`, docs: [{ id: 'po-1', name: `PO_${inv.poNumber}.pdf`, date: inv.date, type: 'application/pdf' }] }) },
                            { label: 'Precio IA', sub: 'Estabilidad y contratos', ok: inv.forensicStatus === 'VALIDATED' || !inv.forensicStatus, warn: inv.forensicStatus === 'DISCREPANCY',
                              onClick: () => setViewingDocs({ title: `Precios - ${inv.provider}`, docs: [{ id: 'hist-1', name: 'PRECIOS_CONTRATO.pdf', date: inv.date, type: 'application/pdf' }] }) },
                            { label: 'Estatus SAT', sub: inv.satStatus || 'Pendiente', ok: inv.satStatus === 'Vigente', fail: inv.satStatus === 'Cancelado', warn: inv.satStatus === 'No Encontrado', pending: !inv.satStatus || inv.satStatus === 'Pendiente' },
                            { label: 'Firmas', sub: `${sigs} de 2 autorizaciones`, ok: sigs >= 2, warn: sigs === 1,
                              onClick: () => setShowAuthStatus(inv.id) },
                          ].map((check, ci) => (
                            <button key={ci} onClick={check.onClick}
                              className={`p-3 rounded-xl border text-left transition-all ${
                                check.fail ? 'bg-red-50 border-red-200 hover:border-red-300' :
                                check.ok ? 'bg-green-50/60 border-green-200 hover:border-green-300' :
                                check.warn ? 'bg-amber-50 border-amber-200 hover:border-amber-300' :
                                'bg-brand-bone/50 border-brand-sand/30 hover:border-brand-sand/50'
                              } ${check.onClick ? 'cursor-pointer' : 'cursor-default'}`}>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[9px] font-bold text-brand-ink/70">{check.label}</span>
                                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold ${
                                  check.fail ? 'bg-red-500 text-white' :
                                  check.ok ? 'bg-green-500 text-white' :
                                  check.warn ? 'bg-amber-400 text-white' :
                                  'bg-brand-sand/40 text-brand-ink/30'
                                }`}>
                                  {check.fail ? '✗' : check.ok ? '✓' : check.warn ? '!' : '—'}
                                </div>
                              </div>
                              <span className="text-[8px] text-brand-ink/40">{check.sub}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Verdict message */}
                    {!isProcessing && (
                      <div className={`mx-5 mb-4 px-4 py-3 rounded-xl text-xs leading-relaxed ${
                        isFullyValidated ? 'bg-green-50 border border-green-200 text-green-800' :
                        inv.forensicStatus === 'VALIDATED' ? 'bg-yellow-50 border border-yellow-200 text-yellow-900' :
                        'bg-brand-bone border border-brand-sand/30 text-brand-ink/60'
                      }`}>
                        <div className="flex items-start gap-2.5">
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                            isFullyValidated ? 'bg-green-500 text-white' :
                            inv.forensicStatus === 'VALIDATED' ? 'bg-yellow-500 text-white' :
                            'bg-brand-sand text-white'
                          }`}>
                            {isFullyValidated ? <CheckCircle2 size={10} /> : inv.forensicStatus === 'VALIDATED' ? <AlertTriangle size={10} /> : <Clock size={10} />}
                          </div>
                          <div className="flex-1">
                            <p className="font-serif text-[11px] font-medium">
                              {isFullyValidated
                                ? `Factura validada correctamente. Triple Match completo: orden de compra verificada, precios consistentes con contrato vigente, CFDI ${inv.satStatus || 'verificado'} ante el SAT${inv.cfdiUUID ? ` (UUID ${inv.cfdiUUID.slice(0, 8)}…)` : ''}. ${sigs} de 2 firmas de autorización obtenidas.`
                                : inv.forensicStatus === 'VALIDATED' && sigs < 2
                                ? `Validación parcial: Triple Match aprobado — orden de compra coincide, precios dentro de rango, CFDI ${inv.satStatus || 'pendiente'} ante SAT. Pendiente: ${2 - sigs} firma${2 - sigs > 1 ? 's' : ''} de autorización para completar el proceso.`
                                : inv.forensicStatus === 'VALIDATED' && inv.satStatus !== 'Vigente'
                                ? `Validación parcial: OC y precios verificados. Estatus SAT: ${inv.satStatus || 'pendiente de consulta'}. Se requiere confirmación del CFDI para completar la validación.`
                                : inv.auditAnalysis || 'Factura en proceso de validación.'}
                            </p>
                            {inv.auditAnalysis && isFullyValidated && (
                              <p className="text-[10px] opacity-50 mt-1 italic">{inv.auditAnalysis}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ═══════════════════ PENDING TAB ═══════════════════ */}
      {auditSubTab === 'pending' && (
        <>
          {/* Search & filter */}
          <div className="flex gap-3 mb-5">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 opacity-30 text-brand-ink" size={14} />
              <input value={missingSearchTerm} onChange={e => setMissingSearchTerm(e.target.value)}
                placeholder="Buscar factura pendiente..."
                className="w-full pl-9 pr-4 py-2.5 bg-white border border-brand-sand rounded-xl text-xs focus:outline-none focus:border-brand-gold shadow-sm" />
            </div>
            <select value={missingPriorityFilter} onChange={e => setMissingPriorityFilter(e.target.value)}
              className="px-4 py-2.5 bg-white border border-brand-sand rounded-xl text-[10px] uppercase font-bold tracking-wider shadow-sm cursor-pointer outline-none focus:border-brand-gold">
              <option value="all">Todas las prioridades</option>
              <option value="Baja">Baja</option>
              <option value="Media">Media Alta</option>
              <option value="Urgente">Urgente</option>
            </select>
          </div>

          {allPendingInvoices.length === 0 ? (
            <div className="editorial-card !p-20 text-center flex flex-col items-center justify-center space-y-6 border-dashed border-brand-sand shadow-none opacity-60">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center text-green-500"><ShieldCheck size={40} /></div>
              <div className="space-y-2">
                <h3 className="text-2xl font-serif text-brand-ink">Sin inconsistencias</h3>
                <p className="text-sm text-brand-ink/40 max-w-xs mx-auto">Todas las facturas pasaron la validación correctamente.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {allPendingInvoices.map(inv => {
                const priority = getPriorityInfo(inv.date);
                const supplier = MOCK_SUPPLIERS.find(s => s.id === inv.providerId);
                const discrepancyMsg = `Estimado ${supplier?.name || 'proveedor'},\n\nLa factura ${inv.id} por ${CURRENCY_FORMATTER.format(inv.amount)} presenta la siguiente incidencia:\n\n${inv.auditAnalysis || 'Discrepancia detectada.'}\n\nAcción requerida: ${inv.forensicSolution || 'Enviar documentación de soporte.'}\n\nFavor de subir la aclaración correspondiente en su portal (Facturas → Aclarar).`;

                return (
                  <motion.div key={inv.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    className="editorial-card !p-0 overflow-hidden border border-red-200/60 bg-white">

                    {/* Header */}
                    <div className="flex items-center justify-between px-5 py-4 border-b border-brand-sand/20 bg-brand-bone/30">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${inv.forensicStatus === 'BLOCKED' ? 'bg-red-100' : 'bg-amber-100'}`}>
                          <AlertTriangle size={16} className={inv.forensicStatus === 'BLOCKED' ? 'text-red-500' : 'text-amber-500'} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-brand-ink">{inv.id}</span>
                            <span className={`text-[8px] font-bold px-2 py-0.5 rounded-md ${inv.forensicStatus === 'BLOCKED' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700'}`}>
                              {inv.forensicStatus === 'BLOCKED' ? 'BLOQUEADA' : 'DISCREPANCIA'}
                            </span>
                            {ClarificationService.hasClari(inv.id) && (() => {
                              const cl = ClarificationService.getByInvoice(inv.id)[0];
                              return cl?.status === 'pending' ? (
                                <span className="text-[7px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-md font-bold animate-pulse">ACLARACIÓN RECIBIDA</span>
                              ) : cl?.status === 'accepted' ? (
                                <span className="text-[7px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-md font-bold">ACLARADA</span>
                              ) : null;
                            })()}
                          </div>
                          <span className="text-[10px] text-brand-ink/40 font-serif">{inv.provider}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-right">
                        <span className="text-base font-bold text-brand-ink">{CURRENCY_FORMATTER.format(inv.amount)}</span>
                        <div className="flex items-center gap-1.5">
                          <div className={`w-1.5 h-1.5 rounded-full ${priority.color}`} />
                          <span className={`text-[9px] font-bold uppercase tracking-wider ${priority.text}`}>{priority.label}</span>
                        </div>
                      </div>
                    </div>

                    {/* Body — two columns */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 lg:divide-x divide-brand-sand/20">
                      {/* Left: Incidencia + Acción */}
                      <div className="p-5 space-y-3">
                        <div>
                          <p className="text-[9px] font-bold uppercase tracking-widest text-red-500 mb-2 flex items-center gap-1.5">
                            <AlertTriangle size={10} /> Incidencia Detectada
                          </p>
                          <p className="text-xs text-brand-ink/80 leading-relaxed">{inv.auditAnalysis}</p>
                        </div>
                        {inv.forensicSolution && (
                          <div className="p-3 bg-brand-ink rounded-xl text-brand-paper">
                            <p className="text-[9px] font-bold text-brand-gold mb-1">Acción Requerida</p>
                            <p className="text-[10px] opacity-80 leading-relaxed">{inv.forensicSolution}</p>
                          </div>
                        )}

                        {/* Clarification panel */}
                        {ClarificationService.hasClari(inv.id) && (() => {
                          const cl = ClarificationService.getByInvoice(inv.id)[0];
                          if (!cl) return null;
                          return (
                            <div className={`p-4 rounded-xl border space-y-3 ${cl.status === 'pending' ? 'bg-amber-50 border-amber-200' : cl.status === 'accepted' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                              <div className="flex items-center justify-between">
                                <p className={`text-[9px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${cl.status === 'pending' ? 'text-amber-700' : cl.status === 'accepted' ? 'text-green-700' : 'text-red-600'}`}>
                                  <MessageSquare size={10} />
                                  {cl.status === 'pending' ? 'Aclaración Recibida' : cl.status === 'accepted' ? 'Aclaración Aceptada' : 'Aclaración Rechazada'}
                                </p>
                                <span className="text-[8px] text-brand-ink/30">{new Date(cl.date).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}</span>
                              </div>
                              <p className="text-xs text-brand-ink/60 leading-relaxed">{cl.message}</p>
                              {cl.fileName && (
                                <button onClick={() => setViewingDocs({ title: `Aclaración - ${inv.id}`, docs: [{ id: `clar-${cl.id}`, name: cl.fileName!, date: cl.date, type: cl.fileType || 'application/pdf' }] })}
                                  className="flex items-center gap-1.5 text-[10px] text-brand-gold hover:text-brand-ink transition-colors">
                                  <Paperclip size={10} /> <span className="underline underline-offset-2">{cl.fileName}</span>
                                </button>
                              )}
                              {cl.status === 'pending' && (
                                <div className="flex gap-2 pt-1">
                                  <button onClick={() => {
                                    ClarificationService.updateStatus(cl.id, 'accepted');
                                    if (supplier) SupplierMessageService.send(supplier.id, supplier.name, 'corporate', `La aclaración para la factura ${inv.id} fue aceptada. La factura será re-validada. Gracias.`);
                                    onUpdateInvoice(inv.id, {
                                      supportDocUrl: cl.fileName || 'aclaracion_aceptada',
                                      changeLog: [...(inv.changeLog || []), { timestamp: new Date().toISOString(), user: 'Auditor', action: 'Aclaración aceptada', from: inv.forensicStatus || 'DISCREPANCY', to: 'PENDING_REAUDIT', reason: cl.message }]
                                    });
                                  }}
                                    className="flex-1 py-2 bg-green-600 text-white rounded-lg text-[9px] font-bold uppercase tracking-wider hover:bg-green-700 transition-all flex items-center justify-center gap-1.5">
                                    <CheckCircle2 size={10} /> Aceptar
                                  </button>
                                  <button onClick={() => setRejectClarInvoice(inv)}
                                    className="flex-1 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg text-[9px] font-bold uppercase tracking-wider hover:bg-red-100 transition-all">
                                    Rechazar
                                  </button>
                                </div>
                              )}
                              {cl.status === 'accepted' && (
                                <button onClick={() => { setSelectedInvoice(inv); startAudit(inv); }}
                                  disabled={isAuditing}
                                  className="w-full py-2.5 bg-brand-ink text-white rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-brand-gold hover:text-brand-ink transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                                  <RefreshCw size={12} /> Re-validar con IA
                                </button>
                              )}
                            </div>
                          );
                        })()}
                      </div>

                      {/* Right: Mensaje al proveedor + acciones */}
                      <div className="p-5 space-y-3 bg-brand-bone/20">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-brand-ink/40 flex items-center gap-1.5">
                          <Send size={10} /> Mensaje al Proveedor
                        </p>
                        <div className="p-3 bg-white rounded-xl border border-brand-sand/30 text-[10px] text-brand-ink/60 leading-relaxed whitespace-pre-wrap max-h-[160px] overflow-y-auto scrollbar-thin scrollbar-thumb-brand-sand/30">
                          {discrepancyMsg}
                        </div>
                        <button onClick={() => {
                          if (supplier) {
                            SupplierMessageService.send(supplier.id, supplier.name, 'corporate', discrepancyMsg);
                            setPendingMsgInvoice(inv);
                            setPendingMsgSent(true);
                            setTimeout(() => setPendingMsgSent(false), 3000);
                          }
                        }}
                          className="w-full py-2.5 bg-brand-ink text-white rounded-xl text-[10px] font-bold uppercase tracking-wider hover:bg-brand-gold hover:text-brand-ink transition-all flex items-center justify-center gap-2">
                          <Send size={12} /> Enviar Solicitud al Proveedor
                        </button>
                        {pendingMsgSent && pendingMsgInvoice?.id === inv.id && (
                          <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 text-green-600 text-[10px] font-bold">
                            <CheckCircle2 size={12} /> Mensaje enviado al portal del proveedor
                          </motion.div>
                        )}

                        <div className="border-t border-brand-sand/20 pt-3 flex gap-2">
                          <button onClick={() => {
                            const reason = window.prompt('Motivo de rechazo:\n1) XML inválido\n2) OC no encontrada\n3) Monto incorrecto\n4) Proveedor no autorizado\n5) Otro', '');
                            if (reason !== null && reason.trim()) {
                              const REASONS: Record<string, string> = { '1': 'XML inválido', '2': 'OC no encontrada', '3': 'Monto incorrecto', '4': 'Proveedor no autorizado' };
                              onUpdateInvoice(inv.id, { status: 'rejected', rejectionReason: REASONS[reason.trim()] || reason.trim(),
                                changeLog: [...(inv.changeLog || []), { timestamp: new Date().toISOString(), user: 'Auditor', action: 'Rechazada', from: inv.status, to: 'rejected', reason: REASONS[reason.trim()] || reason.trim() }]
                              });
                            }
                          }}
                            className="flex-1 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg text-[9px] font-bold uppercase tracking-wider hover:bg-red-100 transition-all">
                            Rechazar Factura
                          </button>
                          <button onClick={() => setViewingDocs({ title: `Respaldo - ${inv.id}`, docs: [] })}
                            className="flex-1 py-2 bg-white border border-brand-sand/40 rounded-lg text-[9px] font-bold uppercase tracking-wider text-brand-ink/60 hover:border-brand-gold transition-all flex items-center justify-center gap-1">
                            <Paperclip size={10} /> Adjuntar
                          </button>
                        </div>

                        {/* Change log */}
                        {inv.changeLog && inv.changeLog.length > 0 && (
                          <div className="p-2.5 bg-brand-bone/60 rounded-lg space-y-1">
                            <p className="text-[8px] font-bold uppercase tracking-widest text-brand-ink/30 flex items-center gap-1"><History size={9} /> Historial</p>
                            {inv.changeLog.slice(-3).map((log, li) => (
                              <p key={li} className="text-[8px] text-brand-ink/50">
                                <span className="font-bold">{log.user}</span> · {log.action}{log.reason ? ` — ${log.reason}` : ''} · <span className="opacity-40">{new Date(log.timestamp).toLocaleDateString('es-MX')}</span>
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </>
      )}

      <AnimatePresence>
        {showAuthStatus && (
          <AuthorizationStatusModal
            onClose={() => setShowAuthStatus(null)}
            authorizations={(() => {
              const inv = invoices.find(i => i.id === showAuthStatus);
              const sigs = inv?.signatures || 0;
              const isGlobal = inv?.paymentType === 'PPD' || (inv?.amount || 0) >= 200000;
              const needsCeo = AuthorizerService.requiresCeoAuth(inv?.amount || 0, isGlobal);
              const ceo = AuthorizerService.getCeo();
              const standard = AuthorizerService.getStandard();

              if (needsCeo && ceo) {
                return [{ name: ceo.name, role: ceo.cargo, status: sigs >= 1 ? 'approved' : 'pending', dateSent: inv?.date || '', email: ceo.email, isCeo: true }];
              }
              if (standard.length > 0) {
                return standard.slice(0, 2).map((a, idx) => ({
                  name: a.name, role: a.cargo, status: sigs > idx ? 'approved' : 'pending', dateSent: inv?.date || '', email: a.email
                }));
              }
              return [{ name: 'Sin autorizador asignado', role: 'Automático', status: 'approved', dateSent: inv?.date || '' }];
            })()}
            invoiceId={showAuthStatus}
            onResend={(authItem) => {
              const inv = invoices.find(i => i.id === showAuthStatus);
              if (inv && authItem.email) {
                const priority = getPriorityInfo(inv.date).label;
                const subject = encodeURIComponent(`URGENTE: Aprobar Factura ${inv.id} - ${inv.provider}`);
                const body = encodeURIComponent(
                  `REQUERIMIENTO DE AUTORIZACIÓN\n\n` +
                  `Estimado ${authItem.name},\n\n` +
                  `Se solicita su aprobación para el pago de la siguiente factura auditada:\n\n` +
                  `• Factura: ${inv.id}\n` +
                  `• Proveedor: ${inv.provider}\n` +
                  `• Monto: ${CURRENCY_FORMATTER.format(inv.amount)}\n` +
                  `• Prioridad: ${priority}\n\n` +
                  `--------------------------------------------------\n` +
                  `[ CLICK AQUÍ PARA APROBAR PAGO ]\n` +
                  `--------------------------------------------------\n\n` +
                  `Atentamente,\nControl de Tesorería - Royáltica IA`
                );
                window.location.href = `mailto:${authItem.email}?subject=${subject}&body=${body}`;
              }
            }}
            onSign={() => {
              const inv = invoices.find(i => i.id === showAuthStatus);
              if (inv) {
                const currentSigs = inv.signatures || 0;
                const nextSigs = Math.min(2, currentSigs + 1);
                // Si llegamos a 2 firmas, nos aseguramos de que el estatus sea 'audited' para que dispare el movimiento
                onUpdateInvoice(inv.id, {
                  signatures: nextSigs,
                  status: nextSigs >= 2 ? 'audited' : inv.status
                });
                // Persiste la firma en el backend: asegura que la factura esté
                // AUDITED y registra la firma. El backend la aprueba sola al
                // alcanzar el número de autorizadores configurado. Cada usuario
                // firma una vez (2+ firmas requieren usuarios distintos).
                // Fire-and-forget + guarda de UUID: nunca rompe la UI local.
                if (isRealId(inv.id)) {
                  (async () => {
                    try {
                      await api.auditInvoice(inv.id).catch(() => {});
                      await api.signInvoice(inv.id);
                    } catch (err) {
                      console.warn('No se pudo persistir la firma:', (err as Error).message);
                    }
                  })();
                }
              }
            }}
          />
        )}
      </AnimatePresence>

      {/* Rejection reason modal */}
      <AnimatePresence>
        {rejectClarInvoice && (() => {
          const inv = rejectClarInvoice;
          const cl = ClarificationService.getByInvoice(inv.id).find(c => c.status === 'pending');
          const supplier = MOCK_SUPPLIERS.find(s => s.id === inv.providerId);
          return (
            <motion.div key="reject-clar-modal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[120] flex items-center justify-center p-6 bg-brand-ink/60 backdrop-blur-sm"
              onClick={() => { setRejectClarInvoice(null); setRejectReason(''); }}>
              <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
                className="bg-brand-paper rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-brand-sand/30"
                onClick={e => e.stopPropagation()}>
                <div className="p-5 border-b border-brand-sand/30">
                  <h3 className="text-base font-bold text-red-600 flex items-center gap-2" style={{ fontFamily: '"Playfair Display", serif' }}>
                    <AlertTriangle size={18} /> Rechazar Aclaración
                  </h3>
                  <p className="text-xs text-brand-ink/50 mt-1">{inv.id} — {supplier?.name || '---'}</p>
                </div>
                <div className="p-5 space-y-4">
                  {cl && (
                    <div className="p-3 bg-brand-bone rounded-xl border border-brand-sand/30">
                      <p className="text-[10px] font-bold uppercase text-brand-ink/40 tracking-wider mb-1">Aclaración del proveedor</p>
                      <p className="text-xs text-brand-ink/70">{cl.message}</p>
                      {cl.fileName && <p className="text-[10px] text-brand-gold mt-1 flex items-center gap-1"><FileText size={10} />{cl.fileName}</p>}
                    </div>
                  )}
                  <div>
                    <label className="text-xs font-bold text-brand-ink/60 block mb-2">Motivo del rechazo</label>
                    <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Explique por qué se rechaza y qué debe corregir el proveedor..."
                      className="w-full p-3 border border-brand-sand/30 rounded-xl text-xs bg-white/50 focus:border-red-400 focus:ring-1 focus:ring-red-300/30 transition-all resize-none" rows={4} />
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => { setRejectClarInvoice(null); setRejectReason(''); }}
                      className="flex-1 py-2.5 border border-brand-sand/40 rounded-xl text-xs font-bold text-brand-ink/60 hover:bg-brand-sand/20 transition-all">
                      Cancelar
                    </button>
                    <button disabled={!rejectReason.trim()} onClick={() => {
                      if (cl && supplier) {
                        ClarificationService.updateStatus(cl.id, 'rejected', rejectReason.trim());
                        SupplierMessageService.send(supplier.id, supplier.name, 'corporate', `La aclaración para la factura ${inv.id} fue rechazada.\n\nMotivo: ${rejectReason.trim()}\n\nFavor de corregir y re-enviar la aclaración en su portal.`);
                      }
                      setRejectClarInvoice(null);
                      setRejectReason('');
                    }} className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-700 transition-all disabled:opacity-30 flex items-center justify-center gap-2">
                      <X size={14} /> Rechazar y Enviar
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}

function AuthorizationStatusModal({ 
  onClose, 
  authorizations,
  invoiceId,
  onSign,
  onResend
}: { 
  onClose: () => void, 
  authorizations: any[],
  invoiceId: string,
  onSign?: () => void,
  onResend?: (auth: any) => void
}) {
  const isFullyApproved = authorizations.every(a => a.status === 'approved');

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-brand-ink/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.95, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 10 }}
        className="max-w-md w-full bg-brand-paper rounded-[2.5rem] p-10 shadow-2xl relative overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="absolute top-0 left-0 w-full h-1.5 bg-brand-gold" />
        
        <header className="flex justify-between items-start mb-10">
          <div className="space-y-1">
            <span className="label-caps !text-brand-gold">Control de Firmas</span>
            <h3 className="text-2xl font-serif text-brand-ink">Estatus de Autorización</h3>
            <p className="text-[9px] uppercase tracking-widest text-brand-ink/30 font-bold">Expediente: {invoiceId}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-brand-bone rounded-full transition-colors opacity-30 hover:opacity-100">
            <LogOut size={18} className="rotate-90" />
          </button>
        </header>

        <div className="space-y-6">
          {authorizations.map((auth, idx) => (
            <div key={idx} className="flex items-center justify-between p-5 bg-brand-bone rounded-[1.5rem] border border-brand-sand/30">
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${auth.status === 'approved' ? 'bg-green-50 border-green-200 text-green-600' : 'bg-brand-paper border-brand-sand/50 text-brand-ink/20'}`}>
                  {auth.status === 'approved' ? <CheckCircle2 size={20} /> : <Clock size={18} />}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold text-brand-ink">{auth.name}</p>
                    <span className="text-[8px] uppercase tracking-tighter px-1.5 py-0.5 bg-brand-ink/5 rounded-md text-brand-ink/40 font-bold">{auth.role}</span>
                    {auth.isCeo && <span className="text-[7px] font-bold bg-brand-gold/20 text-brand-gold px-1.5 py-0.5 rounded-full uppercase tracking-wider">CEO · Pago Global</span>}
                  </div>
                  <p className="text-[10px] text-brand-ink/40 font-serif">Enviado: {auth.dateSent}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                {auth.status === 'approved' ? (
                  <span className="text-[9px] uppercase font-bold text-green-600 tracking-widest">Confirmado</span>
                ) : (
                  <div className="flex items-center gap-3">
                    <span className="text-[9px] uppercase font-bold text-brand-gold tracking-widest animate-pulse">Pendiente</span>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        onResend?.(auth);
                      }}
                      className="flex items-center gap-1.5 px-2 py-1 bg-brand-gold/10 text-brand-gold rounded-lg hover:bg-brand-gold hover:text-brand-ink transition-all group/resend"
                    >
                      <Send size={10} className="group-hover/resend:translate-x-0.5 group-hover/resend:-translate-y-0.5 transition-transform" />
                      <span className="text-[8px] font-black uppercase tracking-tighter">Reenviar</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 pt-8 border-t border-brand-sand/50 space-y-3">
          {!isFullyApproved && onSign && (
            <button 
              onClick={() => {
                onSign();
                onClose();
              }}
              className="w-full btn-primary !bg-brand-gold !text-brand-ink flex items-center justify-center gap-3 group relative overflow-hidden"
            >
              <ShieldCheck size={18} />
              <span>Autorizar como Tesorería</span>
            </button>
          )}

          <button 
            onClick={() => {
              // Simulación de reenvío
              onClose();
            }}
            className="w-full btn-primary !bg-brand-ink flex items-center justify-center gap-3 group relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-red-600/10 -translate-x-full group-hover:translate-x-0 transition-transform duration-500" />
            <span className="relative z-10">Reenviar Notificaciones</span>
            <span className="relative z-10 px-2 py-0.5 bg-red-600 text-[8px] rounded uppercase tracking-tighter">Recordatorio</span>
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function MatchCard({ label, value, verified }: { label: string, value: string, verified: boolean }) {
  return (
    <div className={`flex-1 border p-8 rounded-[2rem] bg-brand-cream transition-all ${verified ? 'border-brand-gold shadow-lg shadow-brand-gold/5' : 'border-brand-sand/30 opacity-60'}`}>
      <div className="label-caps !tracking-[0.2em] !opacity-20 mb-6">{label}</div>
      <div className="text-xl font-serif text-brand-ink leading-tight">{value}</div>
      <div className={`text-[9px] mt-4 uppercase font-extrabold tracking-[0.2em] flex items-center gap-1.5 ${verified ? 'text-green-600' : 'text-brand-ink/20'}`}>
        {verified ? <><CheckCircle2 size={12} /> Datos Verificados</> : 'Esperando Entrada'}
      </div>
    </div>
  );
}

function AuditLogItem({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
      <span className="text-[9px] opacity-60 uppercase tracking-widest">{label}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: Invoice['status'] }) {
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

// ─── Registro de REP (complemento de pago) para facturas PPD pagadas ─────────
// Royáltica no timbra: solo rastrea el UUID del REP que el cliente emite en su
// PAC/ERP. Lista las facturas PPD pagadas que aún requieren REP.
function RepRegistrationPanel() {
  const [invoices, setInvoices] = React.useState<Invoice[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [inputs, setInputs] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState<string | null>(null);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try { setInvoices(await api.getInvoices({ status: 'PAID', limit: 200 })); }
    catch { setInvoices([]); }
    finally { setLoading(false); }
  }, []);
  React.useEffect(() => { load(); }, [load]);

  const pendientes = invoices.filter(i => i.paymentType === 'PPD' && i.repStatus === 'PENDING' && isRealId(i.id));

  const register = async (id: string) => {
    const uuid = (inputs[id] || '').trim();
    if (!uuid) return;
    setBusy(id); setErr(null); setMsg(null);
    try {
      await api.registerRep(id, uuid);
      setMsg('REP registrado correctamente.');
      setInputs(p => ({ ...p, [id]: '' }));
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'No se pudo registrar el REP.');
    } finally { setBusy(null); }
  };

  return (
    <div className="editorial-card space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center"><FileText size={18} className="text-orange-600" /></div>
        <div>
          <h4 className="text-sm font-bold text-brand-ink">Complementos de Pago (REP) pendientes</h4>
          <p className="text-[9px] text-brand-ink/40 font-serif">Facturas PPD pagadas que requieren el UUID del REP emitido en tu PAC/ERP.</p>
        </div>
      </div>
      {loading ? (
        <p className="text-[11px] text-brand-ink/40 font-serif flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Cargando...</p>
      ) : pendientes.length === 0 ? (
        <p className="text-[11px] text-green-700 font-serif flex items-center gap-2"><CheckCircle2 size={14} /> No hay REP pendientes. Todas las facturas PPD pagadas están al día.</p>
      ) : (
        <div className="space-y-2">
          {pendientes.map(inv => (
            <div key={inv.id} className="flex flex-wrap items-center gap-3 p-3 rounded-xl bg-white border border-brand-sand/40">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold text-brand-ink truncate">{inv.provider}</p>
                <p className="text-[9px] font-mono text-brand-ink/40">{CURRENCY_FORMATTER.format(inv.amount)} · pagada {inv.paidDate || inv.date}</p>
              </div>
              <input value={inputs[inv.id] || ''} onChange={e => setInputs(p => ({ ...p, [inv.id]: e.target.value }))}
                placeholder="UUID del REP (folio fiscal)"
                className="px-3 py-2 bg-white border border-brand-sand rounded-lg text-[11px] font-mono focus:outline-none focus:border-brand-gold w-72" />
              <button onClick={() => register(inv.id)} disabled={busy === inv.id}
                className="px-4 py-2 bg-brand-ink text-brand-paper rounded-lg text-[8px] font-bold uppercase tracking-widest hover:bg-brand-gold hover:text-brand-ink transition-all disabled:opacity-50">
                {busy === inv.id ? '...' : 'Registrar REP'}
              </button>
            </div>
          ))}
        </div>
      )}
      {msg && <p className="text-[10px] font-bold text-green-700 flex items-center gap-1.5"><CheckCircle2 size={12} /> {msg}</p>}
      {err && <p className="text-[10px] font-bold text-red-600 flex items-center gap-1.5"><AlertTriangle size={12} /> {err}</p>}
    </div>
  );
}

// ─── Factoraje corporativo: gestión de solicitudes de anticipo ───────────────
// El corporativo revisa las solicitudes que mandan los proveedores y las
// aprueba / rechaza / desembolsa. El desembolso opera en modo manual mientras
// no haya API de factoraje externa configurada.
function FactorajeCorporativoPanel() {
  const [requests, setRequests] = React.useState<CorpFactoraje[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const [msg, setMsg] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try { setRequests(await api.getFactoraje()); }
    catch { setRequests([]); }
    finally { setLoading(false); }
  }, []);
  React.useEffect(() => { load(); }, [load]);

  const act = async (id: string, action: 'approve' | 'reject' | 'disburse') => {
    setBusy(id); setErr(null); setMsg(null);
    try {
      if (action === 'approve') { await api.approveFactoraje(id); setMsg('Solicitud aprobada.'); }
      else if (action === 'disburse') { await api.disburseFactoraje(id); setMsg('Anticipo marcado como desembolsado.'); }
      else {
        const reason = window.prompt('Motivo del rechazo:') || '';
        if (!reason.trim()) { setBusy(null); return; }
        await api.rejectFactoraje(id, reason.trim()); setMsg('Solicitud rechazada.');
      }
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'No se pudo completar la acción.');
    } finally {
      setBusy(null);
    }
  };

  const STATUS: Record<CorpFactoraje['status'], { label: string; cls: string }> = {
    PENDING: { label: 'Pendiente', cls: 'bg-yellow-100 text-yellow-700' },
    APPROVED: { label: 'Aprobada', cls: 'bg-blue-100 text-blue-700' },
    DISBURSED: { label: 'Desembolsada', cls: 'bg-green-100 text-green-700' },
    REJECTED: { label: 'Rechazada', cls: 'bg-red-100 text-red-600' },
  };

  const pending = requests.filter(r => r.status === 'PENDING').length;
  const approved = requests.filter(r => r.status === 'APPROVED').length;
  const disbursedAmount = requests.filter(r => r.status === 'DISBURSED').reduce((s, r) => s + r.netAmount, 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-brand-gold/15 flex items-center justify-center">
            <DollarSign size={18} className="text-brand-gold" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-brand-ink">Solicitudes de Anticipo (Factoraje)</h4>
            <p className="text-[9px] text-brand-ink/40 font-serif">Revisa, aprueba, rechaza o desembolsa los anticipos solicitados por tus proveedores.</p>
          </div>
        </div>
        <button onClick={load} className="px-3 py-2 bg-white border border-brand-sand rounded-xl text-[9px] font-bold uppercase tracking-widest text-brand-ink/50 hover:text-brand-ink hover:border-brand-gold transition-all flex items-center gap-1.5">
          <RefreshCw size={12} /> Actualizar
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="p-4 rounded-2xl border border-yellow-200 bg-yellow-50 text-center">
          <p className="text-2xl font-bold font-serif text-yellow-700">{pending}</p>
          <p className="text-[8px] uppercase font-bold tracking-widest text-yellow-600 mt-1">Pendientes</p>
        </div>
        <div className="p-4 rounded-2xl border border-blue-200 bg-blue-50 text-center">
          <p className="text-2xl font-bold font-serif text-blue-700">{approved}</p>
          <p className="text-[8px] uppercase font-bold tracking-widest text-blue-600 mt-1">Aprobadas</p>
        </div>
        <div className="p-4 rounded-2xl border border-green-200 bg-green-50 text-center">
          <p className="text-lg font-bold font-serif text-green-700">{CURRENCY_FORMATTER.format(disbursedAmount)}</p>
          <p className="text-[8px] uppercase font-bold tracking-widest text-green-600 mt-1">Desembolsado</p>
        </div>
      </div>

      {msg && <p className="text-[10px] font-bold text-green-700 flex items-center gap-1.5"><CheckCircle2 size={12} /> {msg}</p>}
      {err && <p className="text-[10px] font-bold text-red-600 flex items-center gap-1.5"><AlertTriangle size={12} /> {err}</p>}

      <div className="editorial-card !p-0 overflow-hidden border border-brand-sand/50">
        {loading ? (
          <p className="px-6 py-8 text-center text-[11px] text-brand-ink/40 font-serif flex items-center justify-center gap-2"><Loader2 size={14} className="animate-spin" /> Cargando solicitudes...</p>
        ) : requests.length === 0 ? (
          <p className="px-6 py-8 text-center text-[11px] text-brand-ink/40 font-serif">No hay solicitudes de factoraje registradas.</p>
        ) : (
          <table className="w-full text-left">
            <thead className="bg-brand-sand/10">
              <tr>
                <th className="px-5 py-3 text-[8px] uppercase tracking-widest font-bold text-brand-ink/40">Proveedor / Factura</th>
                <th className="px-5 py-3 text-[8px] uppercase tracking-widest font-bold text-brand-ink/40 text-right">Solicitado</th>
                <th className="px-5 py-3 text-[8px] uppercase tracking-widest font-bold text-brand-ink/40 text-right">Comisión</th>
                <th className="px-5 py-3 text-[8px] uppercase tracking-widest font-bold text-brand-ink/40 text-right">Neto</th>
                <th className="px-5 py-3 text-[8px] uppercase tracking-widest font-bold text-brand-ink/40 text-center">Estado</th>
                <th className="px-5 py-3 text-[8px] uppercase tracking-widest font-bold text-brand-ink/40 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-sand/10">
              {requests.map(r => (
                <tr key={r.id} className="hover:bg-brand-gold/5 transition-colors">
                  <td className="px-5 py-4">
                    <p className="font-bold text-brand-ink text-[12px]">{r.supplierName}</p>
                    <p className="text-[9px] font-mono text-brand-ink/40">Factura {r.invoiceFolio}</p>
                  </td>
                  <td className="px-5 py-4 text-right font-serif font-bold text-brand-ink">{CURRENCY_FORMATTER.format(r.requestedAmount)}</td>
                  <td className="px-5 py-4 text-right font-mono text-red-600 text-[12px]">{CURRENCY_FORMATTER.format(r.fee)}</td>
                  <td className="px-5 py-4 text-right font-mono text-green-700 text-[12px] font-bold">{CURRENCY_FORMATTER.format(r.netAmount)}</td>
                  <td className="px-5 py-4 text-center">
                    <span className={`text-[8px] font-bold px-2 py-0.5 rounded-full ${STATUS[r.status].cls}`}>{STATUS[r.status].label}</span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex gap-1.5 justify-end">
                      {r.status === 'PENDING' && (
                        <>
                          <button onClick={() => act(r.id, 'approve')} disabled={busy === r.id}
                            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-[8px] font-bold uppercase tracking-widest hover:bg-blue-700 transition-all disabled:opacity-50">
                            {busy === r.id ? '...' : 'Aprobar'}
                          </button>
                          <button onClick={() => act(r.id, 'reject')} disabled={busy === r.id}
                            className="px-3 py-1.5 bg-white border border-red-200 text-red-600 rounded-lg text-[8px] font-bold uppercase tracking-widest hover:bg-red-50 transition-all disabled:opacity-50">
                            Rechazar
                          </button>
                        </>
                      )}
                      {r.status === 'APPROVED' && (
                        <>
                          <button onClick={() => act(r.id, 'disburse')} disabled={busy === r.id}
                            className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-[8px] font-bold uppercase tracking-widest hover:bg-green-700 transition-all disabled:opacity-50"
                            title="Marca el anticipo como desembolsado (modo manual — sin API externa)">
                            {busy === r.id ? '...' : 'Desembolsar'}
                          </button>
                          <button onClick={() => act(r.id, 'reject')} disabled={busy === r.id}
                            className="px-3 py-1.5 bg-white border border-red-200 text-red-600 rounded-lg text-[8px] font-bold uppercase tracking-widest hover:bg-red-50 transition-all disabled:opacity-50">
                            Rechazar
                          </button>
                        </>
                      )}
                      {(r.status === 'DISBURSED' || r.status === 'REJECTED') && (
                        <span className="text-[9px] text-brand-ink/30 font-serif italic">Sin acciones</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <p className="text-[9px] text-brand-ink/40 font-serif flex items-center gap-1.5">
        <HelpCircle size={11} /> El desembolso opera en modo manual. Cuando conectes la API de tu proveedor de factoraje, el mismo botón ejecutará el desembolso automático.
      </p>
    </div>
  );
}

// ─── DiotCompilerPanel (Plantilla SAT 2025) ───────────────────────────────────
function DiotCompilerPanel() {
  const [reports, setReports] = React.useState<DiotReport[]>([]);
  const [acting, setActing] = React.useState<string | null>(null);
  const [selectedReport, setSelectedReport] = React.useState<string | null>(null);
  const [viewMode, setViewMode] = React.useState<'history' | 'detail'>('history');
  const [periodFilter, setPeriodFilter] = React.useState<'monthly' | 'semestral'>('monthly');
  const [diotAlertDismissed, setDiotAlertDismissed] = React.useState(false);
  // Generación REAL: período elegido (mes o semestre) + estado de la llamada.
  const nowRef = new Date();
  const [genMonth, setGenMonth] = React.useState<string>(
    `${nowRef.getFullYear()}-${String(nowRef.getMonth() + 1).padStart(2, '0')}`,
  );
  const [genYear, setGenYear] = React.useState<number>(nowRef.getFullYear());
  const [genSemester, setGenSemester] = React.useState<1 | 2>(nowRef.getMonth() < 6 ? 1 : 2);
  const [generating, setGenerating] = React.useState(false);
  const [genError, setGenError] = React.useState<string | null>(null);
  const [genMsg, setGenMsg] = React.useState<string | null>(null);

  // Carga el historial REAL de DIOT del backend (facturas → operaciones).
  const loadHistory = React.useCallback(async () => {
    try {
      const hist = await api.getDiotHistory();
      setReports(hist.map(diotResultToReport));
    } catch {
      setReports([]);
    }
  }, []);

  React.useEffect(() => { void loadHistory(); }, [loadHistory]);

  /**
   * Genera la DIOT con datos reales. En mensual usa el mes elegido; en
   * semestral genera los 6 meses del semestre (la DIOT se presenta mensual;
   * la vista semestral consolida). Al terminar, abre el detalle del período.
   */
  const handleGenerateReal = async () => {
    setGenerating(true);
    setGenError(null);
    setGenMsg(null);
    try {
      if (periodFilter === 'monthly') {
        const result = await api.generateDiot(genMonth);
        await loadHistory();
        setGenMsg(`DIOT de ${genMonth} generada con ${result.entries.length} terceros.`);
        setSelectedReport(result.id);
        setViewMode('detail');
      } else {
        const base = genSemester === 1 ? 1 : 7;
        const months = Array.from({ length: 6 }, (_, i) =>
          `${genYear}-${String(base + i).padStart(2, '0')}`,
        );
        let totalTerceros = 0;
        for (const m of months) {
          const r = await api.generateDiot(m);
          totalTerceros += r.entries.length;
        }
        await loadHistory();
        setGenMsg(`Semestre ${genSemester} de ${genYear} generado (${months.length} meses, ${totalTerceros} operaciones).`);
        setSelectedReport(`SEM${genSemester}-${genYear}`);
        setViewMode('detail');
      }
    } catch (e) {
      setGenError(e instanceof Error ? e.message : 'No se pudo generar la DIOT.');
    } finally {
      setGenerating(false);
    }
  };

  // Presenta (submit) una DIOT mensual real ante el SAT — acción irreversible.
  const handleSubmit = async (id: string) => {
    if (!isRealId(id)) return;
    setActing(id);
    try {
      await api.submitDiot(id);
      await loadHistory();
    } catch (e) {
      setGenError(e instanceof Error ? e.message : 'No se pudo presentar la DIOT.');
    } finally {
      setActing(null);
    }
  };

  // Regenera un período existente desde las facturas actuales.
  const handleGenerate = async (id: string) => {
    const rep = reports.find(r => r.id === id);
    if (!rep) return;
    setActing(id);
    try {
      await api.generateDiot(rep.period);
      await loadHistory();
    } catch (e) {
      setGenError(e instanceof Error ? e.message : 'No se pudo regenerar.');
    } finally {
      setActing(null);
    }
  };

  const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const OP_TYPES: Record<string, string> = { '02': 'Enaj. Bienes', '03': 'Prest. Servicios', '06': 'Uso/Goce', '07': 'Importación', '08': 'Imp. Virtual', '85': 'Otros', '87': 'Op. Globales' };
  const TERCERO_TYPES: Record<string, string> = { '04': 'Nacional', '05': 'Extranjero', '15': 'Global' };

  // ─── TXT Download (SAT pipe-separated format) ───
  const handleDownloadTxt = (rep: DiotReport) => {
    const lines = rep.rows.map(row => diotRowToTxt(row));
    const content = lines.join('\r\n');
    const blob = new Blob(['﻿' + content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `DIOT_${rep.period}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ─── Excel Download (.xlsx — Plantilla SAT 2025 exacta) ───
  const handleDownloadExcel = async (rep: DiotReport) => {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Royáltica';
    wb.created = new Date();
    const ws = wb.addWorksheet('DIOT SAT 2025', { views: [{ showGridLines: true }] });

    // ── Column widths (replicated from SAT template) ──
    const colWidths: Record<number, number> = {
      1: 3, 2: 16.5, 3: 15.7, 4: 32.8, 5: 18.3, 6: 15.5, 7: 21.5, 8: 15.7, 9: 19.5,
      10: 18.8, 11: 15.7, 12: 22.7, 13: 20.8, 14: 15.7, 15: 15.7, 16: 15.7, 17: 15.7, 18: 15.7, 19: 15.7,
      20: 20, 21: 15.7, 22: 18.3, 23: 15.7, 24: 22.2, 25: 15.7, 26: 18.2, 27: 22.5, 28: 17.5, 29: 19.7,
      30: 15.7, 31: 15.7, 32: 15.7, 33: 15.7, 34: 15.7, 35: 15.7, 36: 15.7, 37: 15.7, 38: 15.7, 39: 15.7,
      40: 15.7, 41: 15.7, 42: 22.2, 43: 20.8, 44: 25.2, 45: 19, 46: 20.7, 47: 19, 48: 20.7, 49: 18.5,
      50: 15.7, 51: 15.7, 52: 15.7, 53: 15.7, 54: 15.7, 55: 15.7, 56: 15.7, 57: 90.5,
    };
    for (let c = 1; c <= 57; c++) ws.getColumn(c).width = colWidths[c] || 15.7;

    // ── Row 6: Title ──
    ws.getRow(6).height = 16;
    ws.mergeCells('C6:K6');
    const titleCell = ws.getCell('C6');
    titleCell.value = 'DECLARACIÓN INFORMATIVA DE OPERACIONES CON TERCEROS (DIOT)';
    titleCell.font = { name: 'Arial', size: 12, bold: true };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // ── Rows 7-8: spacing ──
    ws.getRow(7).height = 16;
    ws.getRow(8).height = 14;

    // ── Row 9: Section headers ──
    ws.getRow(9).height = 18.75;
    const sectionFont: Partial<ExcelJS.Font> = { name: 'Arial', size: 12, bold: true, color: { argb: 'FF404040' } };
    const sectionAlign: Partial<ExcelJS.Alignment> = { horizontal: 'center', vertical: 'middle' };
    const sections: [string, string, string][] = [
      ['B9', 'I9', 'Datos del tercero declarado'],
      ['J9', 'S9', 'Valor de actos o actividades '],
      ['T9', 'AC9', 'IVA  acreditable'],
      ['AD9', 'AW9', 'IVA no acreditable'],
      ['AX9', 'BD9', 'Datos adicionales'],
    ];
    for (const [start, end, label] of sections) {
      ws.mergeCells(`${start}:${end}`);
      const c = ws.getCell(start);
      c.value = label;
      c.font = sectionFont;
      c.alignment = sectionAlign;
    }
    // Instructions header
    const beCell = ws.getCell('BE9');
    beCell.value = 'Instrucciones';
    beCell.font = sectionFont;
    beCell.alignment = sectionAlign;

    // ── Row 10: spacing ──
    ws.getRow(10).height = 10.5;

    // ── Row 11: Column headers (156px height) ──
    ws.getRow(11).height = 156;
    const headerFont: Partial<ExcelJS.Font> = { name: 'Arial', size: 10, bold: true };
    const headerAlignCenter: Partial<ExcelJS.Alignment> = { horizontal: 'center', vertical: 'middle', wrapText: true };
    const headerAlignLeft: Partial<ExcelJS.Alignment> = { horizontal: 'left', vertical: 'middle', wrapText: true };

    const headerLabels: [string, string, Partial<ExcelJS.Alignment>][] = [
      ['B11', 'Total de operaciones que relaciona', headerAlignCenter],
      ['C11', 'Tipo de tercero\n\n04 - Nacional\n05 - Extranjero\n15 - Global', headerAlignLeft],
      ['D11', 'Tipo de operación\n\n02 - Enaj. de Bienes\n03 - Prest. de Serv. Prof.\n06 - Uso o goce temp. de bienes\n07 Importación de bienes o servicios\n08 Importación por transferencia virtual\n85 - Otros\n87 - Ope. globales', headerAlignLeft],
      ['E11', 'Registro federal de contribuyentes\n(Obligatorio solo si es nacional)', headerAlignLeft],
      ['F11', '\nNúmero de identificación fiscal  \n (Obligatorio solo si es extranjero)', headerAlignLeft],
      ['G11', 'Nombre del extranjero\n(Obligatorio solo si es extranjero)', headerAlignLeft],
      ['H11', 'País o jurisdicción de residencia fiscal \n(Obligatorio solo si es extranjero)', headerAlignLeft],
      ['I11', 'Especificar lugar de jurisdicción fiscal\n(Obligatorio solo si es extranjero)', headerAlignLeft],
      ['J11', 'Valor total de actos o actividades pagadas en la región fronteriza norte', headerAlignCenter],
      ['K11', 'Devoluciones, descuentos y bonificaciones en la región fronteriza norte', headerAlignCenter],
      ['L11', 'Valor total de actos o actividades pagadas en la región fronteriza sur', headerAlignCenter],
      ['M11', 'Devoluciones, descuentos y bonificaciones en la región fronteriza sur', headerAlignCenter],
      ['N11', 'Valor total de actos o actividades pagadas a la tasa del 16% de IVA', headerAlignCenter],
      ['O11', 'Devoluciones, descuentos y bonificaciones a la tasa del 16% de IVA', headerAlignCenter],
      ['P11', 'Valor total de actos o actividades pagados en la importación por aduana de bienes tangibles a la tasa del 16% de IVA', headerAlignCenter],
      ['Q11', 'Devoluciones, descuentos y bonificaciones en la importación por aduana de bienes tangibles a la tasa del 16% de IVA', headerAlignCenter],
      ['R11', 'Valor total de actos o actividades pagadas en la importación de bienes intangibles y servicios a la tasa del 16% de IVA', headerAlignCenter],
      ['S11', 'Devoluciones, descuentos y bonificaciones en la importación de bienes intangibles y servicios a la tasa del 16% de IVA', headerAlignCenter],
      ['T11', 'Exclusivamente de actividades gravadas en la región fronteriza norte', headerAlignCenter],
      ['U11', 'Asociado a actividades por las cuales se aplicó una proporción en la región fronteriza norte', headerAlignCenter],
      ['V11', 'Exclusivamente de actividades gravadas en la región fronteriza sur', headerAlignCenter],
      ['W11', 'Asociado a actividades por las cuales se aplicó una proporción en la región fronteriza sur', headerAlignCenter],
      ['X11', 'Exclusivamente de actividades gravadas pagados a la tasa del 16% de IVA', headerAlignCenter],
      ['Y11', 'Asociado a actividades por las cuales se aplicó una proporción pagados a la tasa del 16% de IVA', headerAlignCenter],
      ['Z11', 'Exclusivamente de actividades gravadas pagadas en la importación por aduana de bienes tangibles a la tasa del 16% de IVA', headerAlignCenter],
      ['AA11', 'Asociado a actividades por las cuales se aplicó una proporción pagadas en la importación por aduana de bienes tangibles a la tasa del 16% de IVA', headerAlignCenter],
      ['AB11', 'Exclusivamente de actividades gravadas pagadas en la importación de bienes intangibles y servicios a la tasa del 16% de IVA', headerAlignCenter],
      ['AC11', 'Asociado a actividades por las cuales se aplicó una proporción pagados en la importación de bienes intangibles y servicios a la tasa del 16% de IVA', headerAlignCenter],
      ['AD11', 'Asociado a actividades por las cuales se aplicó una proporción en la región fronteriza norte', headerAlignCenter],
      ['AE11', 'Asociado a que no cumple con requisitos en la región fronteriza norte', headerAlignCenter],
      ['AF11', 'Asociado a actividades exentas en la región fronteriza norte', headerAlignCenter],
      ['AG11', 'Asociado a actividades no objeto en la región fronteriza norte', headerAlignCenter],
      ['AH11', 'Asociado a actividades por las cuales se aplicó una proporción en la región fronteriza sur', headerAlignCenter],
      ['AI11', 'Asociado a que no cumple con requisitos en la región fronteriza sur', headerAlignCenter],
      ['AJ11', 'Asociado a actividades exentas en la región fronteriza sur', headerAlignCenter],
      ['AK11', 'Asociado a actividades no objeto en la región fronteriza sur', headerAlignCenter],
      ['AL11', 'Asociado a actividades por las cuales se aplicó una proporción a la tasa del 16% de IVA', headerAlignCenter],
      ['AM11', 'Asociado a que no cumple con requisitos a la tasa del 16% de IVA', headerAlignCenter],
      ['AN11', 'Asociado a actividades exentas a la tasa del 16% de IVA', headerAlignCenter],
      ['AO11', 'Asociado a actividades no objeto a la tasa del 16% de IVA', headerAlignCenter],
      ['AP11', 'Asociado a actividades por las cuales se aplicó una proporción en la importación por aduana de bienes tangibles a la tasa del 16% de IVA', headerAlignCenter],
      ['AQ11', 'Asociado a que no cumple con requisitos en la importación por aduana de bienes tangibles a la tasa del 16% de IVA', headerAlignCenter],
      ['AR11', 'Asociado a actividades exentas en la importación por aduana de bienes tangibles a la tasa del 16% de IVA', headerAlignCenter],
      ['AS11', 'Asociado a actividades no objeto en la importación por aduana de bienes tangibles a la tasa del 16% de IVA', headerAlignCenter],
      ['AT11', 'Asociado a actividades por las cuales se aplicó una proporción en la importación de bienes intangibles y servicios a la tasa del 16% del IVA', headerAlignCenter],
      ['AU11', 'Asociado a que no cumple con requisitos en la importación de bienes intangibles y servicios a la tasa del 16% del IVA', headerAlignCenter],
      ['AV11', 'Asociado a actividades exentas en la importación de bienes intangibles y servicios a la tasa del 16% del IVA', headerAlignCenter],
      ['AW11', 'Asociado a actividades no objeto en la importación de bienes intangibles y servicios a la tasa del 16% del IVA', headerAlignCenter],
      ['AX11', 'IVA retenido por el contribuyente pagado', headerAlignCenter],
      ['AY11', 'Valor de actos o actividades pagados en la importación de bienes y servicios por los que no se pagara el IVA (Exentos)', headerAlignCenter],
      ['AZ11', 'Valor de actos o actividades pagados por los que no se pagará el IVA (Exentos)', headerAlignCenter],
      ['BA11', 'Valor de demás actos o actividades pagados a la tasa del 0% de IVA', headerAlignCenter],
      ['BB11', 'Valor de actos o actividades no objeto del IVA realizados en territorio nacional', headerAlignCenter],
      ['BC11', 'Valor de actos o actividades no objeto del IVA por no contar con establecimiento en territorio nacional', headerAlignCenter],
      ['BD11', 'Manifiesto que se dio efectos fiscales a los comprobantes que amparan las operaciones realizadas con el proveedor, detalle', headerAlignCenter],
      ['BE11', 'Se proporciona un ejemplo práctico de como estructurar el archivo de manera correcta:\n\n1.-Copiar la columna en un bloc de notas para obtener el formato (.txt) a partir de la columna "BD9"\n2.-Los datos están separados por el carácter pipe (|).\n3.-Al momento de guardar el archivo se debe cambiar el tipo de codificación UTF-8.\n4.-Subir el archivo en el aplicativo del DIOT en línea en el campo "Agregar desde Archivo"\n5.-El archivo no permite decimales, puntos o comas, utilizar formato general.', headerAlignLeft],
    ];
    for (const [ref, val, align] of headerLabels) {
      const c = ws.getCell(ref);
      c.value = val;
      c.font = headerFont;
      c.alignment = align;
    }

    // ── Row 12: Campo # row (dark background) ──
    const campoFont: Partial<ExcelJS.Font> = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    const campoFill: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF595959' } };
    const campoAlign: Partial<ExcelJS.Alignment> = { horizontal: 'center' };
    const campoLabels = ['#', ' Campo: 1', ' Campo: 2', ' Campo: 3', ' Campo: 4', ' Campo: 5', ' Campo: 6', ' Campo: 7',
      ' Campo: 8', ' Campo: 9', ' Campo: 10', ' Campo: 11', ' Campo: 12', ' Campo: 13', ' Campo: 14', ' Campo: 15',
      ' Campo: 16', ' Campo: 17', ' Campo: 18', ' Campo: 19', ' Campo: 20', ' Campo: 21', ' Campo: 22', ' Campo: 23',
      ' Campo: 24', ' Campo: 25', ' Campo: 26', ' Campo: 27', ' Campo: 28', ' Campo: 29', ' Campo: 30', ' Campo: 31',
      ' Campo: 32', ' Campo: 33', ' Campo: 34', ' Campo: 35', ' Campo: 36', ' Campo: 37', ' Campo: 38', ' Campo: 39',
      ' Campo: 40', ' Campo: 41', ' Campo: 42', ' Campo: 43', ' Campo: 44', ' Campo: 45', ' Campo: 46', ' Campo: 47',
      ' Campo: 48', ' Campo: 49', ' Campo: 50', ' Campo: 51', ' Campo: 52', ' Campo: 53', ' Campo: 54', '|'];
    for (let i = 0; i < campoLabels.length; i++) {
      const col = i + 2; // starts at B
      const c = ws.getCell(12, col);
      c.value = campoLabels[i];
      c.font = campoFont;
      c.fill = campoFill;
      c.alignment = campoAlign;
    }

    // ── Data rows (starting row 13) ──
    const dataFont: Partial<ExcelJS.Font> = { name: 'Noto Sans', size: 10 };
    const dataCenterAlign: Partial<ExcelJS.Alignment> = { horizontal: 'center', vertical: 'middle' };
    // Column mapping: B=row#, C=campo1..BD=campo54, BE=pipe formula
    // Columns: B(2), C(3)..BD(56), BE(57)
    rep.rows.forEach((row, idx) => {
      const r = 13 + idx;
      ws.getRow(r).height = 15;
      const ivaNoAcred = row.iva_no_acred || new Array(19).fill(0);

      // B: row number
      const bCell = ws.getCell(r, 2);
      bCell.value = idx + 1;
      bCell.font = dataFont;
      bCell.alignment = dataCenterAlign;

      // Campos 1-54 → columns C(3) to BD(56)
      const campos: (string | number | null)[] = [
        row.tipo_tercero,                   // C: Campo 1
        row.tipo_operacion,                 // D: Campo 2
        row.rfc,                            // E: Campo 3
        row.num_id_fiscal || null,          // F: Campo 4
        row.nombre_extranjero || null,      // G: Campo 5
        row.pais_residencia || null,        // H: Campo 6
        row.lugar_jurisdiccion || null,     // I: Campo 7
        row.valor_frontera_norte,           // J: Campo 8
        row.dev_frontera_norte,             // K: Campo 9
        row.valor_frontera_sur,             // L: Campo 10
        row.dev_frontera_sur,               // M: Campo 11
        row.valor_16,                       // N: Campo 12
        row.dev_16,                         // O: Campo 13
        row.valor_imp_tangibles_16,         // P: Campo 14
        row.dev_imp_tangibles_16,           // Q: Campo 15
        row.valor_imp_intangibles_16,       // R: Campo 16
        row.dev_imp_intangibles_16,         // S: Campo 17
        row.iva_acred_frontera_norte,       // T: Campo 18
        row.iva_acred_prop_frontera_norte,  // U: Campo 19
        row.iva_acred_frontera_sur,         // V: Campo 20
        row.iva_acred_prop_frontera_sur,    // W: Campo 21
        row.iva_acred_16,                   // X: Campo 22
        row.iva_acred_prop_16,              // Y: Campo 23
        row.iva_acred_imp_tang_16,          // Z: Campo 24
        row.iva_acred_prop_imp_tang_16,     // AA: Campo 25
        row.iva_acred_imp_intang_16,        // AB: Campo 26
        row.iva_acred_prop_imp_intang_16,   // AC: Campo 27
        ...ivaNoAcred.slice(0, 19),         // AD-AV: Campos 28-46 (19 values)
        row.iva_no_acred?.[19] || 0,        // AW: Campo 47
        row.iva_retenido,                   // AX: Campo 48
        row.valor_exento_importacion,       // AY: Campo 49
        row.valor_exento,                   // AZ: Campo 50
        row.valor_tasa_0,                   // BA: Campo 51
        row.valor_no_objeto_nacional,       // BB: Campo 52
        row.valor_no_objeto_sin_establecimiento, // BC: Campo 53
        row.manifiesto,                     // BD: Campo 54
      ];
      for (let i = 0; i < campos.length; i++) {
        const col = 3 + i; // C=3
        const c = ws.getCell(r, col);
        c.value = campos[i] !== null && campos[i] !== undefined ? campos[i] : null;
        c.font = dataFont;
      }

      // BE: pipe-separated formula (same as SAT template)
      const colLetters = ['C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z','AA','AB','AC','AD','AE','AF','AG','AH','AI','AJ','AK','AL','AM','AN','AO','AP','AQ','AR','AS','AT','AU','AV','AW','AX','AY','AZ','BA','BB','BC','BD'];
      const formulaParts = colLetters.map(l => `${l}${r}`);
      const formula = '=+' + formulaParts.join('&"|"&') + '&""';
      const beDataCell = ws.getCell(r, 57);
      beDataCell.value = { formula };
      beDataCell.font = dataFont;
    });

    // ── Generate and download ──
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `DIOT_${rep.period}_SAT2025.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ─── DIOT Deadline Alert ───
  const now = new Date();
  const currentMonth = now.getMonth();
  const diotDeadline = new Date(now.getFullYear(), currentMonth + 1, 17);
  const daysUntilDiot = Math.ceil((diotDeadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const diotAlertLevel = daysUntilDiot <= 5 ? 'critical' : daysUntilDiot <= 15 ? 'warning' : 'ok';

  // Filter reports by period
  const filteredReports = periodFilter === 'semestral'
    ? (() => {
        const sem1 = reports.filter(r => { const m = parseInt(r.period.split('-')[1]); return m >= 1 && m <= 6; });
        const sem2 = reports.filter(r => { const m = parseInt(r.period.split('-')[1]); return m >= 7 && m <= 12; });
        return [
          ...(sem1.length > 0 ? [{
            ...sem1[0],
            id: `SEM1-${sem1[0].period.split('-')[0]}`,
            period: `${sem1[0].period.split('-')[0]}-S1`,
            total_providers: sem1.reduce((s, r) => s + r.total_providers, 0),
            total_base_16: sem1.reduce((s, r) => s + r.total_base_16, 0),
            total_iva_acred: sem1.reduce((s, r) => s + r.total_iva_acred, 0),
            total_iva_retenido: sem1.reduce((s, r) => s + r.total_iva_retenido, 0),
            rows: sem1.flatMap(r => r.rows),
            status: sem1.every(r => r.status === 'submitted') ? 'submitted' as const : sem1.some(r => r.status === 'generated') ? 'generated' as const : 'draft' as const,
          }] : []),
          ...(sem2.length > 0 ? [{
            ...sem2[0],
            id: `SEM2-${sem2[0].period.split('-')[0]}`,
            period: `${sem2[0].period.split('-')[0]}-S2`,
            total_providers: sem2.reduce((s, r) => s + r.total_providers, 0),
            total_base_16: sem2.reduce((s, r) => s + r.total_base_16, 0),
            total_iva_acred: sem2.reduce((s, r) => s + r.total_iva_acred, 0),
            total_iva_retenido: sem2.reduce((s, r) => s + r.total_iva_retenido, 0),
            rows: sem2.flatMap(r => r.rows),
            status: sem2.every(r => r.status === 'submitted') ? 'submitted' as const : sem2.some(r => r.status === 'generated') ? 'generated' as const : 'draft' as const,
          }] : []),
        ];
      })()
    : reports;

  const selectedRep = selectedReport ? filteredReports.find(r => r.id === selectedReport) || null : null;

  const formatPeriodLabel = (period: string) => {
    if (period.includes('S1')) return `1er Semestre ${period.split('-')[0]}`;
    if (period.includes('S2')) return `2do Semestre ${period.split('-')[0]}`;
    const [year, month] = period.split('-');
    return `${MONTH_NAMES[parseInt(month) - 1]} ${year}`;
  };

  const statusBadge = (status: string) => {
    if (status === 'submitted') return <span className="text-[8px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full flex items-center gap-1"><CheckCircle2 size={9}/> Presentada</span>;
    if (status === 'generated') return <span className="text-[8px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full flex items-center gap-1"><FileText size={9}/> Generada</span>;
    return <span className="text-[8px] font-bold bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full flex items-center gap-1"><Clock size={9}/> Borrador</span>;
  };

  // ─── Detail View ───
  if (viewMode === 'detail' && selectedRep) {
    return (
      <div className="space-y-5">
        {/* Back + Title */}
        <div className="flex items-center justify-between">
          <button onClick={() => { setViewMode('history'); setSelectedReport(null); }} className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-brand-ink/50 hover:text-brand-ink transition-all">
            <ChevronLeft size={14} /> Volver al historial
          </button>
          <div className="flex gap-2">
            {selectedRep.status === 'draft' && (
              <button onClick={() => handleGenerate(selectedRep.id)} disabled={acting === selectedRep.id} className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-xl text-[9px] font-bold uppercase tracking-widest hover:bg-purple-700 transition-all disabled:opacity-50">
                {acting === selectedRep.id ? <Loader2 size={12} className="animate-spin" /> : <Cpu size={12} />}
                {acting === selectedRep.id ? 'Generando...' : 'Generar Layout'}
              </button>
            )}
            <button onClick={() => handleDownloadExcel(selectedRep)} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl text-[9px] font-bold uppercase tracking-widest hover:bg-green-700 transition-all">
              <FileSpreadsheet size={12} /> Excel XLSX
            </button>
            <button onClick={() => handleDownloadTxt(selectedRep)} className="flex items-center gap-2 px-4 py-2 bg-brand-ink text-brand-paper rounded-xl text-[9px] font-bold uppercase tracking-widest hover:bg-brand-gold hover:text-brand-ink transition-all">
              <Download size={12} /> TXT para SAT
            </button>
            {isRealId(selectedRep.id) && selectedRep.status !== 'submitted' && (
              <button onClick={() => handleSubmit(selectedRep.id)} disabled={acting === selectedRep.id} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-[9px] font-bold uppercase tracking-widest hover:bg-blue-700 transition-all disabled:opacity-50">
                {acting === selectedRep.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                {acting === selectedRep.id ? 'Presentando...' : 'Presentar al SAT'}
              </button>
            )}
            {selectedRep.status === 'submitted' && (
              <span className="flex items-center gap-1.5 px-4 py-2 bg-green-100 text-green-700 rounded-xl text-[9px] font-bold uppercase tracking-widest"><CheckCircle2 size={12} /> Presentada</span>
            )}
          </div>
        </div>
        {genError && (
          <p className="text-[10px] font-bold text-red-600 flex items-center gap-1.5"><AlertTriangle size={12} /> {genError}</p>
        )}

        {/* Period Info Card */}
        <div className="grid grid-cols-4 gap-3">
          <div className="p-4 rounded-2xl border border-purple-200 bg-purple-50 text-center">
            <p className="text-xl font-bold font-serif text-purple-700">{formatPeriodLabel(selectedRep.period)}</p>
            <p className="text-[8px] uppercase font-bold tracking-widest text-purple-500 mt-1">Periodo DIOT</p>
          </div>
          <div className="p-4 rounded-2xl border border-brand-sand/30 bg-white text-center">
            <p className="text-xl font-bold font-serif text-brand-ink">{selectedRep.rows.length}</p>
            <p className="text-[8px] uppercase font-bold tracking-widest text-brand-ink/40 mt-1">Terceros Declarados</p>
          </div>
          <div className="p-4 rounded-2xl border border-brand-sand/30 bg-white text-center">
            <p className="text-lg font-bold font-serif text-brand-ink">{CURRENCY_FORMATTER.format(selectedRep.total_base_16)}</p>
            <p className="text-[8px] uppercase font-bold tracking-widest text-brand-ink/40 mt-1">Base Gravable 16%</p>
          </div>
          <div className="p-4 rounded-2xl border border-brand-sand/30 bg-white text-center">
            <p className="text-lg font-bold font-serif text-red-600">{CURRENCY_FORMATTER.format(selectedRep.total_iva_retenido)}</p>
            <p className="text-[8px] uppercase font-bold tracking-widest text-brand-ink/40 mt-1">IVA Retenido</p>
          </div>
        </div>

        {/* Data Preview Table */}
        <div className="editorial-card !p-0 overflow-hidden border border-brand-sand/50">
          <div className="px-5 py-3 bg-brand-sand/10 border-b border-brand-sand/30 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Database size={14} className="text-purple-600" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-brand-ink">Vista Previa — Datos DIOT (Plantilla SAT 2025)</span>
            </div>
            <span className="text-[8px] text-brand-ink/40 font-mono">{selectedRep.rows.length} registros · 54 campos c/u</span>
          </div>
          <div className="overflow-x-auto" style={{ maxHeight: '400px' }}>
            <table className="w-full text-left text-[10px] min-w-[1400px]">
              <thead className="bg-white sticky top-0 z-10">
                <tr>
                  <th className="px-3 py-2 text-[7px] uppercase tracking-widest font-bold text-brand-ink/40 border-b border-brand-sand/30 sticky left-0 bg-white z-20">#</th>
                  <th className="px-3 py-2 text-[7px] uppercase tracking-widest font-bold text-brand-ink/40 border-b border-brand-sand/30 sticky left-[30px] bg-white z-20 min-w-[140px]">Proveedor / RFC</th>
                  <th className="px-3 py-2 text-[7px] uppercase tracking-widest font-bold text-purple-600 border-b border-brand-sand/30">Tipo</th>
                  <th className="px-3 py-2 text-[7px] uppercase tracking-widest font-bold text-purple-600 border-b border-brand-sand/30">Operación</th>
                  <th className="px-3 py-2 text-[7px] uppercase tracking-widest font-bold text-brand-ink/40 border-b border-brand-sand/30 text-right">Valor 16%</th>
                  <th className="px-3 py-2 text-[7px] uppercase tracking-widest font-bold text-brand-ink/40 border-b border-brand-sand/30 text-right">Dev 16%</th>
                  <th className="px-3 py-2 text-[7px] uppercase tracking-widest font-bold text-brand-ink/40 border-b border-brand-sand/30 text-right">IVA Acred 16%</th>
                  <th className="px-3 py-2 text-[7px] uppercase tracking-widest font-bold text-brand-ink/40 border-b border-brand-sand/30 text-right">IVA Prop 16%</th>
                  <th className="px-3 py-2 text-[7px] uppercase tracking-widest font-bold text-red-500 border-b border-brand-sand/30 text-right">IVA Retenido</th>
                  <th className="px-3 py-2 text-[7px] uppercase tracking-widest font-bold text-brand-ink/40 border-b border-brand-sand/30 text-right">Exento</th>
                  <th className="px-3 py-2 text-[7px] uppercase tracking-widest font-bold text-brand-ink/40 border-b border-brand-sand/30 text-right">Tasa 0%</th>
                  <th className="px-3 py-2 text-[7px] uppercase tracking-widest font-bold text-brand-ink/40 border-b border-brand-sand/30 text-right">No Objeto</th>
                  <th className="px-3 py-2 text-[7px] uppercase tracking-widest font-bold text-green-600 border-b border-brand-sand/30 text-center">Manif.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-sand/10">
                {selectedRep.rows.map((row, i) => (
                  <tr key={row.id} className="hover:bg-purple-50/30 transition-colors">
                    <td className="px-3 py-2.5 text-brand-ink/30 font-mono sticky left-0 bg-white">{i + 1}</td>
                    <td className="px-3 py-2.5 sticky left-[30px] bg-white">
                      <p className="font-bold text-brand-ink text-[10px]">{row.provider_name}</p>
                      <p className="text-[8px] font-mono text-brand-ink/40">{row.rfc}</p>
                    </td>
                    <td className="px-3 py-2.5"><span className="text-[8px] font-bold bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">{TERCERO_TYPES[row.tipo_tercero]}</span></td>
                    <td className="px-3 py-2.5 text-[9px] text-brand-ink/60">{OP_TYPES[row.tipo_operacion]}</td>
                    <td className="px-3 py-2.5 text-right font-mono font-bold">{row.valor_16 > 0 ? CURRENCY_FORMATTER.format(row.valor_16) : '-'}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-brand-ink/40">{row.dev_16 > 0 ? CURRENCY_FORMATTER.format(row.dev_16) : '-'}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-blue-600">{row.iva_acred_16 > 0 ? CURRENCY_FORMATTER.format(row.iva_acred_16) : '-'}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-brand-ink/40">{row.iva_acred_prop_16 > 0 ? CURRENCY_FORMATTER.format(row.iva_acred_prop_16) : '-'}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-red-600 font-bold">{row.iva_retenido > 0 ? CURRENCY_FORMATTER.format(row.iva_retenido) : '-'}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-brand-ink/40">{row.valor_exento > 0 ? CURRENCY_FORMATTER.format(row.valor_exento) : '-'}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-brand-ink/40">{row.valor_tasa_0 > 0 ? CURRENCY_FORMATTER.format(row.valor_tasa_0) : '-'}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-brand-ink/40">{row.valor_no_objeto_nacional > 0 ? CURRENCY_FORMATTER.format(row.valor_no_objeto_nacional) : '-'}</td>
                    <td className="px-3 py-2.5 text-center"><span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${row.manifiesto === '01' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{row.manifiesto}</span></td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-brand-sand/10 border-t-2 border-brand-sand/40">
                <tr className="font-bold">
                  <td className="px-3 py-3 sticky left-0 bg-brand-sand/10" />
                  <td className="px-3 py-3 text-[9px] uppercase tracking-widest sticky left-[30px] bg-brand-sand/10">Totales</td>
                  <td colSpan={2} />
                  <td className="px-3 py-3 text-right font-mono">{CURRENCY_FORMATTER.format(selectedRep.rows.reduce((s, r) => s + r.valor_16, 0))}</td>
                  <td className="px-3 py-3 text-right font-mono text-brand-ink/40">{CURRENCY_FORMATTER.format(selectedRep.rows.reduce((s, r) => s + r.dev_16, 0))}</td>
                  <td className="px-3 py-3 text-right font-mono text-blue-600">{CURRENCY_FORMATTER.format(selectedRep.rows.reduce((s, r) => s + r.iva_acred_16, 0))}</td>
                  <td />
                  <td className="px-3 py-3 text-right font-mono text-red-600">{CURRENCY_FORMATTER.format(selectedRep.rows.reduce((s, r) => s + r.iva_retenido, 0))}</td>
                  <td className="px-3 py-3 text-right font-mono text-brand-ink/40">{CURRENCY_FORMATTER.format(selectedRep.rows.reduce((s, r) => s + r.valor_exento, 0))}</td>
                  <td className="px-3 py-3 text-right font-mono text-brand-ink/40">{CURRENCY_FORMATTER.format(selectedRep.rows.reduce((s, r) => s + r.valor_tasa_0, 0))}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* TXT Preview */}
        <div className="editorial-card !p-0 overflow-hidden border border-brand-sand/50">
          <div className="px-5 py-3 bg-brand-ink border-b flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText size={14} className="text-brand-gold" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-brand-paper">Vista Previa TXT — Formato SAT (pipe-separated)</span>
            </div>
            <span className="text-[8px] text-brand-paper/50 font-mono">Codificación UTF-8 · Sin decimales</span>
          </div>
          <div className="bg-gray-900 p-4 overflow-x-auto" style={{ maxHeight: '200px' }}>
            <pre className="text-[9px] text-green-400 font-mono leading-relaxed whitespace-pre">
              {selectedRep.rows.slice(0, 5).map(row => diotRowToTxt(row)).join('\n')}
              {selectedRep.rows.length > 5 && `\n... (${selectedRep.rows.length - 5} registros más)`}
            </pre>
          </div>
        </div>
      </div>
    );
  }

  // ─── History View ───
  return (
    <div className="space-y-5">
      {/* ─── DIOT Deadline Alert ─── */}
      {!diotAlertDismissed && diotAlertLevel !== 'ok' && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className={`flex items-center justify-between px-5 py-4 rounded-2xl border ${
            diotAlertLevel === 'critical' ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200'
          }`}>
          <div className="flex items-center gap-3">
            <Bell size={18} className={diotAlertLevel === 'critical' ? 'text-red-600 animate-bounce' : 'text-yellow-600'} />
            <div>
              <p className={`text-sm font-bold ${diotAlertLevel === 'critical' ? 'text-red-800' : 'text-yellow-800'}`}>
                DIOT próxima: {daysUntilDiot} días restantes
              </p>
              <p className={`text-[10px] ${diotAlertLevel === 'critical' ? 'text-red-600' : 'text-yellow-600'}`}>
                Fecha límite: {diotDeadline.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>
          <button onClick={() => setDiotAlertDismissed(true)} className="p-1 hover:bg-white/50 rounded-lg"><X size={14} /></button>
        </motion.div>
      )}

      {/* Header + Filters */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
            <Database size={18} className="text-purple-600" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-brand-ink">Historial DIOT — Plantilla SAT 2025</h4>
            <p className="text-[9px] text-brand-ink/40 font-serif">Declaración Informativa de Operaciones con Terceros · {reports.length} periodos registrados</p>
          </div>
        </div>
        <div className="flex gap-1 bg-brand-sand/20 rounded-xl p-1">
          <button onClick={() => setPeriodFilter('monthly')} className={`px-4 py-2 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all ${periodFilter === 'monthly' ? 'bg-brand-ink text-brand-paper shadow-sm' : 'text-brand-ink/40 hover:text-brand-ink'}`}>
            Mensual
          </button>
          <button onClick={() => setPeriodFilter('semestral')} className={`px-4 py-2 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all ${periodFilter === 'semestral' ? 'bg-brand-ink text-brand-paper shadow-sm' : 'text-brand-ink/40 hover:text-brand-ink'}`}>
            Semestral
          </button>
        </div>
      </div>

      {/* Generar DIOT con datos REALES (mensual o semestral) — plantilla SAT */}
      <div className="editorial-card !p-4 border border-purple-200 bg-purple-50/40 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-purple-700">
            <FileSpreadsheet size={16} />
            <span className="text-[10px] font-bold uppercase tracking-widest">
              Generar DIOT {periodFilter === 'semestral' ? 'Semestral' : 'Mensual'} · datos reales
            </span>
          </div>
          {periodFilter === 'monthly' ? (
            <input
              type="month"
              value={genMonth}
              onChange={e => setGenMonth(e.target.value)}
              className="px-3 py-2 bg-white border border-purple-200 rounded-xl text-[11px] text-brand-ink focus:outline-none focus:border-purple-400"
            />
          ) : (
            <>
              <select
                value={genYear}
                onChange={e => setGenYear(Number(e.target.value))}
                className="px-3 py-2 bg-white border border-purple-200 rounded-xl text-[11px] text-brand-ink focus:outline-none focus:border-purple-400"
              >
                {[0, 1, 2, 3].map(d => {
                  const y = nowRef.getFullYear() - d;
                  return <option key={y} value={y}>{y}</option>;
                })}
              </select>
              <select
                value={genSemester}
                onChange={e => setGenSemester(Number(e.target.value) as 1 | 2)}
                className="px-3 py-2 bg-white border border-purple-200 rounded-xl text-[11px] text-brand-ink focus:outline-none focus:border-purple-400"
              >
                <option value={1}>1er Semestre (Ene–Jun)</option>
                <option value={2}>2do Semestre (Jul–Dic)</option>
              </select>
            </>
          )}
          <button
            onClick={handleGenerateReal}
            disabled={generating}
            className="ml-auto flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-xl text-[9px] font-bold uppercase tracking-widest hover:bg-purple-700 transition-all disabled:opacity-50"
            title="Agrega las facturas del período por RFC y genera la DIOT"
          >
            {generating ? <Loader2 size={12} className="animate-spin" /> : <Cpu size={12} />}
            {generating ? 'Generando...' : 'Generar DIOT'}
          </button>
        </div>
        {genMsg && (
          <p className="text-[10px] font-bold text-green-700 flex items-center gap-1.5">
            <CheckCircle2 size={12} /> {genMsg}
          </p>
        )}
        {genError && (
          <p className="text-[10px] font-bold text-red-600 flex items-center gap-1.5">
            <AlertTriangle size={12} /> {genError}
          </p>
        )}
        <p className="text-[9px] text-brand-ink/40 font-serif">
          Se agregan las facturas aprobadas/pagadas del período por RFC del proveedor. Al generar se abre el detalle, donde puedes descargar el Excel/TXT con la plantilla SAT 2025 o presentar la declaración.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl border border-purple-200 bg-purple-50 text-center">
          <p className="text-2xl font-bold font-serif text-purple-700">{filteredReports.length}</p>
          <p className="text-[8px] uppercase font-bold tracking-widest text-purple-500 mt-1">Periodos</p>
        </div>
        <div className="p-4 rounded-2xl border border-green-200 bg-green-50 text-center">
          <p className="text-2xl font-bold font-serif text-green-700">{filteredReports.filter(r => r.status === 'submitted').length}</p>
          <p className="text-[8px] uppercase font-bold tracking-widest text-green-500 mt-1">Presentadas</p>
        </div>
        <div className="p-4 rounded-2xl border border-blue-200 bg-blue-50 text-center">
          <p className="text-2xl font-bold font-serif text-blue-700">{filteredReports.filter(r => r.status === 'generated').length}</p>
          <p className="text-[8px] uppercase font-bold tracking-widest text-blue-500 mt-1">Generadas</p>
        </div>
        <div className="p-4 rounded-2xl border border-yellow-200 bg-yellow-50 text-center">
          <p className="text-2xl font-bold font-serif text-yellow-700">{filteredReports.filter(r => r.status === 'draft').length}</p>
          <p className="text-[8px] uppercase font-bold tracking-widest text-yellow-500 mt-1">Borradores</p>
        </div>
      </div>

      {/* Reports Table */}
      <div className="editorial-card !p-0 overflow-hidden border border-brand-sand/50 shadow-sm">
        <table className="w-full text-left">
          <thead className="bg-brand-sand/10">
            <tr>
              <th className="px-5 py-3 text-[8px] uppercase tracking-widest font-bold text-brand-ink/40 border-b border-brand-sand/30">Periodo</th>
              <th className="px-5 py-3 text-[8px] uppercase tracking-widest font-bold text-brand-ink/40 border-b border-brand-sand/30">Estado</th>
              <th className="px-5 py-3 text-[8px] uppercase tracking-widest font-bold text-brand-ink/40 border-b border-brand-sand/30 text-center">Terceros</th>
              <th className="px-5 py-3 text-[8px] uppercase tracking-widest font-bold text-brand-ink/40 border-b border-brand-sand/30 text-right">Base 16%</th>
              <th className="px-5 py-3 text-[8px] uppercase tracking-widest font-bold text-brand-ink/40 border-b border-brand-sand/30 text-right">IVA Acred.</th>
              <th className="px-5 py-3 text-[8px] uppercase tracking-widest font-bold text-brand-ink/40 border-b border-brand-sand/30 text-right">IVA Ret.</th>
              <th className="px-5 py-3 text-[8px] uppercase tracking-widest font-bold text-brand-ink/40 border-b border-brand-sand/30 text-center">Fecha Gen.</th>
              <th className="px-5 py-3 text-[8px] uppercase tracking-widest font-bold text-brand-ink/40 border-b border-brand-sand/30 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-sand/10">
            {filteredReports.map(rep => (
              <tr key={rep.id} className="hover:bg-purple-50/30 transition-colors group">
                <td className="px-5 py-4">
                  <p className="font-bold text-brand-ink text-sm">{formatPeriodLabel(rep.period)}</p>
                  <p className="text-[8px] font-mono text-brand-ink/30 mt-0.5">{rep.id}</p>
                </td>
                <td className="px-5 py-4">{statusBadge(rep.status)}</td>
                <td className="px-5 py-4 text-center font-mono text-sm text-brand-ink">{rep.total_providers}</td>
                <td className="px-5 py-4 text-right font-serif font-bold text-brand-ink">{CURRENCY_FORMATTER.format(rep.total_base_16)}</td>
                <td className="px-5 py-4 text-right font-mono text-blue-600 text-sm">{CURRENCY_FORMATTER.format(rep.total_iva_acred)}</td>
                <td className="px-5 py-4 text-right font-mono text-red-600 text-sm">{CURRENCY_FORMATTER.format(rep.total_iva_retenido)}</td>
                <td className="px-5 py-4 text-center text-[10px] text-brand-ink/40">{rep.generated_date || '—'}</td>
                <td className="px-5 py-4">
                  <div className="flex gap-1.5 justify-end opacity-60 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => { setSelectedReport(rep.id); setViewMode('detail'); }} className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-[8px] font-bold uppercase tracking-widest hover:bg-purple-700 transition-all">
                      Ver
                    </button>
                    {rep.status !== 'draft' && (
                      <>
                        <button onClick={() => handleDownloadTxt(rep)} className="px-3 py-1.5 bg-brand-ink text-brand-paper rounded-lg text-[8px] font-bold uppercase tracking-widest hover:bg-brand-gold hover:text-brand-ink transition-all" title="Descargar TXT para SAT">
                          TXT
                        </button>
                        <button onClick={() => handleDownloadExcel(rep)} className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-[8px] font-bold uppercase tracking-widest hover:bg-green-700 transition-all" title="Descargar Excel XLSX">
                          XLSX
                        </button>
                      </>
                    )}
                    {rep.status === 'draft' && (
                      <button onClick={() => handleGenerate(rep.id)} disabled={acting === rep.id} className="px-3 py-1.5 bg-yellow-500 text-white rounded-lg text-[8px] font-bold uppercase tracking-widest hover:bg-yellow-600 transition-all disabled:opacity-50">
                        {acting === rep.id ? '...' : 'Generar'}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Instructions Card */}
      <div className="editorial-card !p-5 border border-brand-sand/30 bg-white/80">
        <div className="flex items-start gap-4">
          <div className="w-8 h-8 rounded-lg bg-brand-gold/20 flex items-center justify-center flex-shrink-0 mt-0.5">
            <HelpCircle size={16} className="text-brand-gold" />
          </div>
          <div>
            <h5 className="text-xs font-bold text-brand-ink mb-2">Instrucciones para carga al portal SAT</h5>
            <ol className="text-[10px] text-brand-ink/60 space-y-1 list-decimal pl-4 font-serif">
              <li>Genera el layout de cada periodo pendiente con el botón "Generar"</li>
              <li>Descarga el archivo <strong>TXT</strong> (formato pipe-separated, codificación UTF-8)</li>
              <li>Ingresa al portal del SAT → DIOT en línea</li>
              <li>Selecciona "Agregar desde Archivo" y sube el archivo .txt</li>
              <li>El archivo no permite decimales, puntos ni comas — Royáltica los formatea automáticamente</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
// ─── ConectividadERPPanel (unified Webhooks + Sync + Outbound) ───────────────
type OutboundERPEvent = {
  id: string;
  invoiceId: string;
  provider: string;
  amount: number;
  date: string;           // ISO date of the event
  tipo: 'aprobada' | 'pagada_caja' | 'pagada_factoraje' | 'rechazada';
  asientoContable: string; // e.g. "DB: Proveedores / CR: Banco"
  cuentaDB: string;
  cuentaCR: string;
  syncStatus: 'pendiente' | 'sincronizado' | 'error';
  syncedAt?: string;
  erpPolicyId?: string;
};

function buildOutboundEvents(): OutboundERPEvent[] {
  const out: OutboundERPEvent[] = [];
  let seq = 1;
  MOCK_INVOICES.forEach(inv => {
    // Approved (audited) → generates CxP registration event
    if (inv.status === 'audited' || inv.status === 'approved') {
      out.push({
        id: `OUT-${String(seq++).padStart(4, '0')}`,
        invoiceId: inv.id,
        provider: inv.provider,
        amount: inv.amount,
        date: inv.date,
        tipo: 'aprobada',
        asientoContable: 'DB: Proveedores · CR: CxP por Pagar',
        cuentaDB: '2010 Proveedores',
        cuentaCR: '2110 CxP',
        syncStatus: 'sincronizado',
        syncedAt: new Date(new Date(inv.date).getTime() + 86400000).toISOString(),
        erpPolicyId: `POL-${inv.id.replace('FAC-', '')}`,
      });
    }
    // Paid → generates liquidation event
    if (inv.status === 'paid') {
      const isCash = inv.paymentRoute === 'cash';
      out.push({
        id: `OUT-${String(seq++).padStart(4, '0')}`,
        invoiceId: inv.id,
        provider: inv.provider,
        amount: inv.paidAmount || inv.amount,
        date: inv.date,
        tipo: isCash ? 'pagada_caja' : 'pagada_factoraje',
        asientoContable: isCash
          ? 'DB: CxP por Pagar · CR: Bancos'
          : 'DB: CxP por Pagar · CR: Factoraje · CR: Gasto Financiero',
        cuentaDB: '2110 CxP',
        cuentaCR: isCash ? '1020 Bancos (SPEI)' : '2150 Factoraje + 5200 Gasto Fin.',
        syncStatus: seq % 7 === 0 ? 'pendiente' : 'sincronizado',
        syncedAt: seq % 7 === 0 ? undefined : new Date(new Date(inv.date).getTime() + 172800000).toISOString(),
        erpPolicyId: seq % 7 === 0 ? undefined : `POL-LIQ-${inv.id.replace('FAC-', '')}`,
      });
    }
  });
  // Sort by date descending
  out.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return out;
}

function ConectividadERPPanel() {
  const [view, setView] = React.useState<'entrantes' | 'salientes' | 'jobs'>('entrantes');

  // ─── Webhooks State (inbound) ───
  const [events, setEvents] = React.useState<WebhookEvent[]>(WebhookERPService.getEvents());
  const [acting, setActing] = React.useState<string | null>(null);
  const [retrying, setRetrying] = React.useState<Record<string, { attempts: number; maxAttempts: number; status: 'retrying' | 'success' | 'failed' }>>({});
  const [autoRetry, setAutoRetry] = React.useState(true);

  // ─── Outbound State ───
  const [outboundEvents, setOutboundEvents] = React.useState<OutboundERPEvent[]>(() => buildOutboundEvents());
  const [outboundFilter, setOutboundFilter] = React.useState<'todos' | 'aprobada' | 'pagada_caja' | 'pagada_factoraje' | 'rechazada' | 'pendiente'>('todos');
  const [syncingOutbound, setSyncingOutbound] = React.useState<string | null>(null);

  // ─── Sync Jobs State ───
  const [syncJobs, setSyncJobs] = React.useState([
    { id: 'SYNC-001', type: 'Saldos de Balance', source: 'Aspel COI', target: 'Royáltica BG', schedule: 'Diario 06:00', lastRun: '2024-04-26 06:00', status: 'success' as const, records: 48, duration: '12s' },
    { id: 'SYNC-002', type: 'Pólizas del Día', source: 'Aspel COI', target: 'Royáltica ER', schedule: 'Diario 06:05', lastRun: '2024-04-26 06:05', status: 'success' as const, records: 23, duration: '8s' },
    { id: 'SYNC-003', type: 'Cuentas por Cobrar', source: 'Aspel SAE', target: 'Royáltica BG', schedule: 'Cada 4 hrs', lastRun: '2024-04-26 10:00', status: 'success' as const, records: 156, duration: '18s' },
    { id: 'SYNC-004', type: 'Nómina Acumulada', source: 'Aspel NOI', target: 'Royáltica ER', schedule: 'Quincenal', lastRun: '2024-04-15 08:00', status: 'success' as const, records: 89, duration: '6s' },
    { id: 'SYNC-005', type: 'Activos Fijos', source: 'Aspel COI', target: 'Royáltica BG', schedule: 'Mensual', lastRun: '2024-04-01 07:00', status: 'partial' as const, records: 87, duration: '22s' },
  ]);
  const [syncing, setSyncing] = React.useState<string | null>(null);
  const [showNewJob, setShowNewJob] = React.useState(false);

  React.useEffect(() => {
    WebhookERPService.subscribe(setEvents);
    return () => WebhookERPService.unsubscribe(setEvents);
  }, []);

  const handleSimulate = () => {
    const ev = WebhookERPService.simulateWebhook();
    setTimeout(() => { WebhookERPService.processReconciliation(ev.id); }, 2000);
  };

  const handleManualSync = (id: string) => {
    setActing(id);
    setTimeout(() => { WebhookERPService.processReconciliation(id); setActing(null); }, 500);
  };

  const handleRetry = (id: string) => {
    const maxAttempts = 3;
    setRetrying(prev => ({ ...prev, [id]: { attempts: 1, maxAttempts, status: 'retrying' } }));
    const attemptRetry = (attempt: number) => {
      const delay = Math.pow(2, attempt) * 500;
      setTimeout(() => {
        const success = Math.random() > 0.3;
        if (success || attempt >= maxAttempts) {
          if (success) { WebhookERPService.processReconciliation(id); setRetrying(prev => ({ ...prev, [id]: { attempts: attempt, maxAttempts, status: 'success' } })); }
          else { setRetrying(prev => ({ ...prev, [id]: { attempts: attempt, maxAttempts, status: 'failed' } })); }
        } else { setRetrying(prev => ({ ...prev, [id]: { attempts: attempt + 1, maxAttempts, status: 'retrying' } })); attemptRetry(attempt + 1); }
      }, delay);
    };
    attemptRetry(1);
  };

  React.useEffect(() => {
    if (!autoRetry) return;
    events.filter(ev => ev.status === 'pending_match').forEach(ev => {
      if (!retrying[ev.id]) { setTimeout(() => handleRetry(ev.id), 5000); }
    });
  }, [events, autoRetry]);

  const runSync = (id: string) => {
    setSyncing(id);
    setTimeout(() => {
      setSyncJobs(prev => prev.map(j => j.id === id ? { ...j, lastRun: new Date().toLocaleString('es-MX'), status: 'success' as const, records: j.records + Math.floor(Math.random() * 10) } : j));
      setSyncing(null);
    }, 2500);
  };

  const runAll = () => {
    setSyncing('all');
    setTimeout(() => {
      setSyncJobs(prev => prev.map(j => ({ ...j, lastRun: new Date().toLocaleString('es-MX'), status: 'success' as const })));
      setSyncing(null);
    }, 4000);
  };

  // Sync a single outbound event to ERP
  const handleSyncOutbound = (eventId: string) => {
    setSyncingOutbound(eventId);
    setTimeout(() => {
      setOutboundEvents(prev => prev.map(e => e.id === eventId ? {
        ...e,
        syncStatus: 'sincronizado' as const,
        syncedAt: new Date().toISOString(),
        erpPolicyId: `POL-SYNC-${e.invoiceId.replace('FAC-', '')}`,
      } : e));
      setSyncingOutbound(null);
    }, 1500);
  };

  // Sync all pending outbound events
  const handleSyncAllOutbound = () => {
    setSyncingOutbound('all');
    setTimeout(() => {
      setOutboundEvents(prev => prev.map(e => e.syncStatus === 'pendiente' ? {
        ...e,
        syncStatus: 'sincronizado' as const,
        syncedAt: new Date().toISOString(),
        erpPolicyId: `POL-SYNC-${e.invoiceId.replace('FAC-', '')}`,
      } : e));
      setSyncingOutbound(null);
    }, 3000);
  };

  const STATUS_CONFIG: Record<WebhookEvent['status'], { label: string; badge: string }> = {
    pending_match:   { label: 'Buscando Match', badge: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
    matched_syncing: { label: 'Conectando API...', badge: 'bg-blue-100 text-blue-700 border-blue-200' },
    synced:          { label: 'Sincronizado', badge: 'bg-teal-100 text-teal-700 border-teal-200' },
  };

  const OUTBOUND_TIPO_CONFIG: Record<OutboundERPEvent['tipo'], { icon: string; label: string; badge: string; color: string }> = {
    aprobada:          { icon: '✅', label: 'Factura Aprobada', badge: 'bg-green-50 text-green-700 border-green-200', color: 'text-green-600' },
    pagada_caja:       { icon: '💳', label: 'Pagada — Caja Propia', badge: 'bg-blue-50 text-blue-700 border-blue-200', color: 'text-blue-600' },
    pagada_factoraje:  { icon: '🏦', label: 'Pagada — Factoraje', badge: 'bg-purple-50 text-purple-700 border-purple-200', color: 'text-purple-600' },
    rechazada:         { icon: '❌', label: 'Rechazada', badge: 'bg-red-50 text-red-700 border-red-200', color: 'text-red-600' },
  };

  const pendingWebhooks = events.filter(e => e.status === 'pending_match').length;
  const syncedWebhooks = events.filter(e => e.status === 'synced').length;
  const pendingOutbound = outboundEvents.filter(e => e.syncStatus === 'pendiente').length;
  const syncedOutbound = outboundEvents.filter(e => e.syncStatus === 'sincronizado').length;

  // Group outbound events by day
  const filteredOutbound = outboundEvents.filter(e => {
    if (outboundFilter === 'todos') return true;
    if (outboundFilter === 'pendiente') return e.syncStatus === 'pendiente';
    return e.tipo === outboundFilter;
  });
  const outboundByDay: Record<string, OutboundERPEvent[]> = {};
  filteredOutbound.forEach(ev => {
    const dayKey = ev.date.slice(0, 10); // YYYY-MM-DD
    if (!outboundByDay[dayKey]) outboundByDay[dayKey] = [];
    outboundByDay[dayKey].push(ev);
  });
  const sortedDays = Object.keys(outboundByDay).sort((a, b) => b.localeCompare(a));

  const formatDayLabel = (dateStr: string) => {
    const d = new Date(dateStr + 'T12:00:00');
    const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return `${dayNames[d.getDay()]} ${d.getDate()} ${monthNames[d.getMonth()]} ${d.getFullYear()}`;
  };

  return (
    <div className="space-y-6">
      {/* ─── Unified Header ─── */}
      <div className="bg-white p-6 rounded-2xl border border-brand-sand/30 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-600 flex-shrink-0">
              <Webhook size={22} />
            </div>
            <div>
              <h4 className="text-base font-bold text-brand-ink">Conectividad ERP</h4>
              <p className="text-[9px] text-brand-ink/40 uppercase tracking-widest">Eventos entrantes y salientes · Sincronización bidireccional · Aspel COI / SAE / NOI</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[8px] font-bold text-brand-ink/30 uppercase tracking-wider">Endpoint activo</span>
            </div>
          </div>
        </div>

        {/* KPI strip + view toggle */}
        <div className="flex items-center justify-between">
          <div className="flex gap-5">
            {[
              { label: 'Entrantes', value: events.length, sub: `${pendingWebhooks} pendientes`, color: pendingWebhooks > 0 ? 'text-amber-500' : 'text-green-500' },
              { label: 'Salientes', value: outboundEvents.length, sub: `${pendingOutbound} por sincronizar`, color: pendingOutbound > 0 ? 'text-amber-500' : 'text-green-500' },
              { label: 'Sync OK', value: syncedWebhooks + syncedOutbound, sub: 'registrados en ERP', color: 'text-teal-600' },
              { label: 'Jobs', value: syncJobs.length, sub: `${syncJobs.reduce((s, j) => s + j.records, 0)} registros`, color: 'text-brand-gold' },
              { label: 'Errores 7D', value: 0, sub: 'sin incidentes', color: 'text-green-500' },
            ].map(kpi => (
              <div key={kpi.label} className="text-center">
                <p className={`font-serif text-xl ${kpi.color}`}>{kpi.value}</p>
                <p className="text-[7px] uppercase tracking-[.15em] font-bold text-brand-ink/30">{kpi.label}</p>
                <p className="text-[7px] text-brand-ink/20">{kpi.sub}</p>
              </div>
            ))}
          </div>

          <div className="flex gap-1 bg-brand-bone/60 p-1 rounded-xl">
            {([
              { key: 'entrantes' as const, icon: <FolderDown size={11} />, label: '📥 Del ERP' },
              { key: 'salientes' as const, icon: <ArrowUpRight size={11} />, label: '📤 Al ERP' },
              { key: 'jobs' as const, icon: <FolderSync size={11} />, label: '⚙️ Jobs' },
            ]).map(tab => (
              <button key={tab.key} onClick={() => setView(tab.key)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all ${
                  view === tab.key ? 'bg-brand-ink text-brand-paper shadow-sm' : 'text-brand-ink/40 hover:text-brand-ink'
                }`}>
                {tab.label}
                {tab.key === 'salientes' && pendingOutbound > 0 && (
                  <span className="ml-1 w-4 h-4 rounded-full bg-amber-500 text-white text-[7px] font-bold flex items-center justify-center">{pendingOutbound}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {/* ═══════════ EVENTOS ENTRANTES (📥 Del ERP) ═══════════ */}
        {view === 'entrantes' && (
          <motion.div key="entrantes" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
            {/* Action bar */}
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-brand-ink/40 flex items-center gap-2">
                <FolderDown size={13} className="text-teal-500" />
                Transacciones bancarias que entran al sistema vía webhook para conciliación automática
              </p>
              <div className="flex items-center gap-3">
                <button onClick={() => setAutoRetry(!autoRetry)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[9px] font-bold uppercase tracking-widest transition-all border ${
                    autoRetry ? 'bg-teal-50 border-teal-200 text-teal-700' : 'bg-brand-bone border-brand-sand/30 text-brand-ink/40'
                  }`}>
                  <RefreshCw size={11} className={autoRetry ? 'animate-spin' : ''} style={autoRetry ? {animationDuration: '3s'} : {}} /> Auto-Retry {autoRetry ? 'ON' : 'OFF'}
                </button>
                <button onClick={handleSimulate} className="flex items-center gap-2 px-4 py-2 bg-brand-ink text-brand-bone rounded-xl text-[9px] font-bold uppercase tracking-widest hover:bg-brand-gold hover:text-brand-ink transition-all">
                  <Activity size={12} /> Simular Webhook
                </button>
              </div>
            </div>

            {/* Events table */}
            <div className="editorial-card !p-0 overflow-hidden border border-brand-sand/50">
              <div className="px-6 py-3 bg-white/50 border-b border-brand-sand/20 flex items-center justify-between">
                <p className="text-sm font-bold text-brand-ink flex items-center gap-2"><Database size={13} className="text-brand-gold"/> Feed Transaccional Bancario</p>
                <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"/><span className="text-[8px] font-bold text-brand-ink/40 uppercase tracking-wider">Escuchando</span></div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-separate border-spacing-0 min-w-[800px]">
                  <thead className="bg-brand-sand/10 sticky top-0 z-10">
                    <tr>
                      {['ID / Banco', 'Tx Ref', 'Monto', 'Conciliación', 'Estado'].map(h => (
                        <th key={h} className="px-5 py-3 label-caps !opacity-40 border-b border-brand-sand text-brand-ink">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-sand/20">
                    {events.map(ev => {
                      const st = STATUS_CONFIG[ev.status];
                      return (
                        <tr key={ev.id} className="hover:bg-brand-gold/5 transition-all">
                          <td className="px-5 py-3">
                            <span className="text-[9px] font-bold font-mono text-brand-ink block">{ev.id}</span>
                            <span className="text-[8px] text-brand-ink/30">{ev.bank} · {new Date(ev.date).toLocaleString('es-MX')}</span>
                          </td>
                          <td className="px-5 py-3"><span className="text-[9px] font-mono bg-brand-sand/20 px-2 py-1 rounded-md text-brand-ink/60">{ev.tx_reference}</span></td>
                          <td className="px-5 py-3 text-sm font-bold font-serif text-brand-ink">{CURRENCY_FORMATTER.format(ev.amount)}</td>
                          <td className="px-5 py-3">
                            {ev.status === 'pending_match' ? (
                              <span className="text-[9px] text-brand-ink/40 font-mono flex items-center gap-1"><Activity size={10} className="animate-pulse" /> Buscando...</span>
                            ) : (
                              <div>
                                <p className="text-[10px] font-bold text-brand-ink">{ev.provider_name}</p>
                                <p className="text-[8px] font-mono text-teal-700/70 flex items-center gap-1"><CheckCircle2 size={9} /> {ev.matched_invoice_uuid}</p>
                              </div>
                            )}
                          </td>
                          <td className="px-5 py-3">
                            <span className={`text-[8px] font-bold uppercase tracking-widest px-2 py-1 rounded-full border ${st.badge} flex items-center gap-1 w-fit`}>
                              {ev.status === 'matched_syncing' && <motion.div animate={{rotate:360}} transition={{repeat:Infinity,duration:1,ease:'linear'}} className="w-2 h-2 border border-blue-500/30 border-t-blue-600 rounded-full"/>}
                              {st.label}
                            </span>
                            {ev.erp_policy_id && (
                              <span className="text-[8px] font-mono text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded-md flex items-center gap-1 border border-teal-100 mt-1 w-fit">
                                <FolderSync size={9} /> {ev.erp_policy_id}
                              </span>
                            )}
                            {ev.status === 'pending_match' && (
                              <div className="flex items-center gap-2 mt-1.5">
                                <button onClick={() => handleManualSync(ev.id)} disabled={acting === ev.id} className="text-[8px] uppercase font-bold text-brand-gold hover:underline tracking-widest">
                                  {acting === ev.id ? 'Forzando...' : 'Match Manual'}
                                </button>
                                {retrying[ev.id] ? (
                                  <span className={`text-[8px] font-bold uppercase tracking-widest flex items-center gap-1 ${retrying[ev.id].status === 'retrying' ? 'text-blue-600' : retrying[ev.id].status === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                                    {retrying[ev.id].status === 'retrying' && <><RefreshCw size={8} className="animate-spin" /> {retrying[ev.id].attempts}/{retrying[ev.id].maxAttempts}</>}
                                    {retrying[ev.id].status === 'success' && <><CheckCircle2 size={8} /> OK</>}
                                    {retrying[ev.id].status === 'failed' && <><AlertCircle size={8} /> Fallido</>}
                                  </span>
                                ) : (
                                  <button onClick={() => handleRetry(ev.id)} className="text-[8px] uppercase font-bold text-teal-600 hover:underline tracking-widest flex items-center gap-1">
                                    <RefreshCw size={8} /> Retry
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {events.length === 0 && (
                      <tr><td colSpan={5} className="px-6 py-10 text-center text-brand-ink/30 font-serif text-sm">Esperando transacciones vía Webhook.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {/* ═══════════ EVENTOS SALIENTES (📤 Al ERP) ═══════════ */}
        {view === 'salientes' && (
          <motion.div key="salientes" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
            {/* Description + Actions */}
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-brand-ink/40 flex items-center gap-2">
                <ArrowUpRight size={13} className="text-purple-500" />
                Facturas validadas y pagadas que se envían al ERP para registro contable automático
              </p>
              <div className="flex items-center gap-3">
                {pendingOutbound > 0 && (
                  <button onClick={handleSyncAllOutbound} disabled={syncingOutbound !== null}
                    className="flex items-center gap-2 px-4 py-2 bg-brand-ink text-brand-bone rounded-xl text-[9px] font-bold uppercase tracking-widest hover:bg-brand-gold hover:text-brand-ink transition-all disabled:opacity-50">
                    {syncingOutbound === 'all' ? <Loader2 size={12} className="animate-spin" /> : <FolderSync size={12} />}
                    Sincronizar Todo ({pendingOutbound})
                  </button>
                )}
              </div>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-2 flex-wrap">
              {([
                { key: 'todos' as const, label: 'Todos', count: outboundEvents.length },
                { key: 'aprobada' as const, label: '✅ Aprobadas', count: outboundEvents.filter(e => e.tipo === 'aprobada').length },
                { key: 'pagada_caja' as const, label: '💳 Caja Propia', count: outboundEvents.filter(e => e.tipo === 'pagada_caja').length },
                { key: 'pagada_factoraje' as const, label: '🏦 Factoraje', count: outboundEvents.filter(e => e.tipo === 'pagada_factoraje').length },
                { key: 'pendiente' as const, label: '⏳ Pendientes', count: pendingOutbound },
              ]).map(f => (
                <button key={f.key} onClick={() => setOutboundFilter(f.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[9px] font-bold transition-all border ${
                    outboundFilter === f.key
                      ? 'bg-brand-ink text-brand-paper border-brand-ink shadow-sm'
                      : 'bg-white text-brand-ink/50 border-brand-sand/30 hover:border-brand-ink/20'
                  }`}>
                  {f.label}
                  <span className={`ml-0.5 text-[8px] px-1.5 py-0.5 rounded-full ${
                    outboundFilter === f.key ? 'bg-brand-paper/20 text-brand-paper' : 'bg-brand-sand/30 text-brand-ink/30'
                  }`}>{f.count}</span>
                </button>
              ))}
            </div>

            {/* Summary strip: totals by event type */}
            <div className="grid grid-cols-4 gap-3">
              {([
                { tipo: 'aprobada' as const, label: 'CxP Registradas', desc: 'DB: Proveedores · CR: CxP' },
                { tipo: 'pagada_caja' as const, label: 'Liquidadas Caja', desc: 'DB: CxP · CR: Bancos' },
                { tipo: 'pagada_factoraje' as const, label: 'Liquidadas Factoraje', desc: 'DB: CxP · CR: Factoraje + Gasto' },
                { tipo: 'rechazada' as const, label: 'Rechazadas', desc: 'Cancela CxP en ERP' },
              ]).map(s => {
                const eventsOfType = outboundEvents.filter(e => e.tipo === s.tipo);
                const total = eventsOfType.reduce((sum, e) => sum + e.amount, 0);
                const cfg = OUTBOUND_TIPO_CONFIG[s.tipo];
                return (
                  <div key={s.tipo} className={`rounded-xl border p-3 ${cfg.badge}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-base">{cfg.icon}</span>
                      <span className="text-[8px] font-bold uppercase tracking-wider">{s.label}</span>
                    </div>
                    <p className={`font-serif text-lg ${cfg.color}`}>{CURRENCY_FORMATTER.format(total)}</p>
                    <p className="text-[8px] opacity-60 mt-0.5">{eventsOfType.length} eventos · {s.desc}</p>
                  </div>
                );
              })}
            </div>

            {/* Feed grouped by day */}
            <div className="space-y-4">
              {sortedDays.map(day => {
                const dayEvents = outboundByDay[day];
                const dayTotal = dayEvents.reduce((s, e) => s + e.amount, 0);
                const dayPending = dayEvents.filter(e => e.syncStatus === 'pendiente').length;
                return (
                  <div key={day} className="editorial-card !p-0 overflow-hidden border border-brand-sand/30">
                    {/* Day header */}
                    <div className="px-5 py-3 bg-gradient-to-r from-brand-bone/80 to-white border-b border-brand-sand/20 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-brand-ink/5 flex items-center justify-center">
                          <Calendar size={14} className="text-brand-ink/40" />
                        </div>
                        <div>
                          <p className="text-[11px] font-bold text-brand-ink">{formatDayLabel(day)}</p>
                          <p className="text-[8px] text-brand-ink/30">{dayEvents.length} eventos · {CURRENCY_FORMATTER.format(dayTotal)}</p>
                        </div>
                      </div>
                      {dayPending > 0 && (
                        <span className="text-[8px] font-bold px-2 py-1 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                          {dayPending} pendiente{dayPending > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>

                    {/* Events for this day */}
                    <div className="divide-y divide-brand-sand/10">
                      {dayEvents.map((ev, idx) => {
                        const tipoCfg = OUTBOUND_TIPO_CONFIG[ev.tipo];
                        const isSyncing = syncingOutbound === ev.id || syncingOutbound === 'all';
                        return (
                          <motion.div key={ev.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.03 }}
                            className="px-5 py-3.5 hover:bg-brand-gold/5 transition-all">
                            <div className="flex items-center gap-4">
                              {/* Icon + Type */}
                              <div className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-lg" style={{ background: 'var(--color-brand-bone)' }}>
                                {tipoCfg.icon}
                              </div>

                              {/* Invoice + Provider info */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <span className={`text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${tipoCfg.badge}`}>{tipoCfg.label}</span>
                                  <span className="text-[9px] font-mono text-brand-ink/30">{ev.invoiceId}</span>
                                </div>
                                <p className="text-[10px] font-bold text-brand-ink truncate">{ev.provider}</p>
                              </div>

                              {/* Amount */}
                              <div className="text-right flex-shrink-0 mr-4">
                                <p className={`font-serif text-sm font-bold ${tipoCfg.color}`}>{CURRENCY_FORMATTER.format(ev.amount)}</p>
                              </div>

                              {/* Accounting entry */}
                              <div className="flex-shrink-0 w-52 hidden xl:block">
                                <p className="text-[8px] font-mono text-brand-ink/40 leading-relaxed">
                                  <span className="text-brand-ink/60">DB:</span> {ev.cuentaDB}
                                </p>
                                <p className="text-[8px] font-mono text-brand-ink/40 leading-relaxed">
                                  <span className="text-brand-ink/60">CR:</span> {ev.cuentaCR}
                                </p>
                              </div>

                              {/* Sync status */}
                              <div className="flex-shrink-0 w-32 text-right">
                                {ev.syncStatus === 'sincronizado' ? (
                                  <div>
                                    <span className="text-[8px] font-bold uppercase tracking-widest text-teal-600 flex items-center gap-1 justify-end">
                                      <CheckCircle2 size={10} /> Sincronizado
                                    </span>
                                    {ev.erpPolicyId && (
                                      <span className="text-[7px] font-mono text-teal-600/60 block mt-0.5">{ev.erpPolicyId}</span>
                                    )}
                                  </div>
                                ) : ev.syncStatus === 'error' ? (
                                  <div>
                                    <span className="text-[8px] font-bold uppercase tracking-widest text-red-500 flex items-center gap-1 justify-end">
                                      <AlertCircle size={10} /> Error
                                    </span>
                                    <button onClick={() => handleSyncOutbound(ev.id)} disabled={isSyncing}
                                      className="text-[8px] uppercase font-bold text-brand-gold hover:underline tracking-widest mt-0.5">
                                      Re-intentar
                                    </button>
                                  </div>
                                ) : (
                                  <button onClick={() => handleSyncOutbound(ev.id)} disabled={isSyncing}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-ink text-brand-paper text-[8px] font-bold uppercase tracking-wider rounded-lg hover:bg-brand-gold hover:text-brand-ink transition-all disabled:opacity-50">
                                    {isSyncing ? <Loader2 size={10} className="animate-spin" /> : <ArrowUpRight size={10} />}
                                    {isSyncing ? 'Enviando...' : 'Sincronizar'}
                                  </button>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {filteredOutbound.length === 0 && (
                <div className="text-center py-12">
                  <ArrowUpRight size={32} className="text-brand-ink/10 mx-auto mb-3" />
                  <p className="text-brand-ink/30 font-serif text-sm">No hay eventos para este filtro.</p>
                </div>
              )}
            </div>

            {/* Legend / accounting guide */}
            <div className="bg-gradient-to-br from-brand-ink to-brand-ink/90 rounded-2xl p-5 text-brand-paper">
              <div className="flex items-center gap-2 mb-3">
                <BookOpen size={14} className="text-brand-gold" />
                <h3 className="text-sm font-serif tracking-tight">Guía de Asientos Contables</h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { icon: '✅', title: 'Factura Aprobada → Registra CxP', desc: 'DB: 2010 Proveedores · CR: 2110 Cuentas por Pagar. Se genera al aprobar la auditoría.' },
                  { icon: '💳', title: 'Pagada Caja Propia → Liquida CxP', desc: 'DB: 2110 CxP · CR: 1020 Bancos (SPEI). Se genera al ejecutar el pago directo.' },
                  { icon: '🏦', title: 'Pagada Factoraje → Liquida CxP + Gasto', desc: 'DB: 2110 CxP · CR: 2150 Factoraje + 5200 Gasto Financiero (comisión).' },
                  { icon: '❌', title: 'Rechazada → Cancela CxP', desc: 'Reversa el asiento de CxP. La factura no se procesa para pago en el ERP.' },
                ].map(g => (
                  <div key={g.title} className="flex gap-3">
                    <span className="text-lg flex-shrink-0">{g.icon}</span>
                    <div>
                      <p className="text-[10px] font-bold text-brand-paper/90">{g.title}</p>
                      <p className="text-[8px] text-brand-paper/50 leading-relaxed mt-0.5">{g.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* ═══════════ JOBS PROGRAMADOS ═══════════ */}
        {view === 'jobs' && (
          <motion.div key="jobs" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
            {/* Action bar */}
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-brand-ink/40 flex items-center gap-2">
                <FolderSync size={13} className="text-brand-gold" />
                Sincronización automática programada entre ERP y Royáltica
              </p>
              <div className="flex items-center gap-2">
                <button onClick={runAll} disabled={syncing !== null}
                  className="flex items-center gap-2 px-4 py-2 bg-brand-ink text-brand-paper text-[9px] font-bold uppercase tracking-wider rounded-xl hover:bg-brand-ink/80 transition-all disabled:opacity-50">
                  {syncing === 'all' ? <Loader2 size={11} className="animate-spin" /> : <Play size={11} />} Sincronizar Todo
                </button>
                <button onClick={() => setShowNewJob(!showNewJob)}
                  className="flex items-center gap-2 px-4 py-2 bg-brand-gold/10 text-brand-gold text-[9px] font-bold uppercase tracking-wider rounded-xl hover:bg-brand-gold/20 transition-all">
                  <Plus size={11} /> Nuevo Job
                </button>
              </div>
            </div>

            {/* New Job Form */}
            <AnimatePresence>
              {showNewJob && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                  className="bg-brand-bone/50 rounded-2xl border border-brand-sand/30 p-5 overflow-hidden">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-brand-ink mb-4">Nuevo Job de Sincronización</h4>
                  <div className="grid grid-cols-4 gap-4">
                    {[
                      { label: 'Tipo de datos', options: ['Saldos de Balance', 'Pólizas Contables', 'Cuentas por Cobrar', 'Nómina', 'Activos Fijos', 'Inventarios'] },
                      { label: 'Origen (ERP)', options: ['Aspel COI', 'Aspel SAE', 'Aspel NOI'] },
                      { label: 'Destino', options: ['Royáltica ER', 'Royáltica BG', 'Ambos'] },
                      { label: 'Frecuencia', options: ['Diario', 'Cada 4 horas', 'Cada hora', 'Quincenal', 'Mensual'] },
                    ].map(field => (
                      <div key={field.label}>
                        <label className="text-[8px] uppercase tracking-wider text-brand-ink/40 font-bold block mb-1">{field.label}</label>
                        <select className="w-full text-[10px] px-3 py-2 rounded-xl border border-brand-sand/30 bg-white/80 text-brand-ink">
                          {field.options.map(o => <option key={o}>{o}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-end gap-2 mt-4">
                    <button onClick={() => setShowNewJob(false)} className="px-4 py-2 text-[9px] font-bold uppercase tracking-wider text-brand-ink/40 hover:text-brand-ink">Cancelar</button>
                    <button onClick={() => {
                      setSyncJobs(prev => [...prev, { id: `SYNC-${String(prev.length + 1).padStart(3, '0')}`, type: 'Inventarios', source: 'Aspel SAE', target: 'Royáltica BG', schedule: 'Diario 07:00', lastRun: 'Pendiente', status: 'success', records: 0, duration: '—' }]);
                      setShowNewJob(false);
                    }} className="px-4 py-2 bg-brand-gold text-white text-[9px] font-bold uppercase tracking-wider rounded-xl hover:bg-brand-gold/80 transition-all">
                      Crear Job
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Jobs table */}
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-brand-sand/20 overflow-hidden">
              <div className="px-5 py-2.5 border-b border-brand-sand/10 grid grid-cols-8 gap-3 text-[7px] uppercase tracking-[.2em] font-bold text-brand-ink/30">
                <span>Job</span>
                <span className="col-span-2">Tipo de datos</span>
                <span>Origen → Destino</span>
                <span>Frecuencia</span>
                <span>Última ejecución</span>
                <span>Registros</span>
                <span className="text-right">Acción</span>
              </div>
              {syncJobs.map((job, i) => (
                <motion.div key={job.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}
                  className="px-5 py-3 grid grid-cols-8 gap-3 items-center border-b border-brand-sand/5 last:border-0 hover:bg-brand-bone/20 transition-colors">
                  <span className="text-[8px] font-mono text-brand-ink/30">{job.id}</span>
                  <div className="col-span-2 flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${job.status === 'success' ? 'bg-green-400' : 'bg-amber-400'}`} />
                    <span className="text-[10px] font-bold text-brand-ink">{job.type}</span>
                  </div>
                  <span className="text-[9px] text-brand-ink/50">{job.source} → {job.target}</span>
                  <span className="text-[9px] text-brand-ink/40">{job.schedule}</span>
                  <span className="text-[8px] text-brand-ink/40">{job.lastRun}</span>
                  <div className="flex items-center gap-1">
                    <span className="font-serif text-sm text-brand-ink">{job.records}</span>
                    <span className="text-[7px] text-brand-ink/25 uppercase">reg</span>
                  </div>
                  <div className="text-right">
                    <button onClick={() => runSync(job.id)} disabled={syncing !== null}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-bone text-brand-ink text-[8px] font-bold uppercase tracking-wider rounded-lg hover:bg-brand-sand/40 transition-all disabled:opacity-30">
                      {syncing === job.id || syncing === 'all' ? <Loader2 size={10} className="animate-spin" /> : <Play size={10} />}
                      {syncing === job.id ? 'Sync...' : 'Ejecutar'}
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Architecture footer */}
            <div className="bg-gradient-to-br from-brand-ink to-brand-ink/90 rounded-2xl p-5 text-brand-paper">
              <div className="flex items-center gap-2 mb-3">
                <FolderSync size={14} className="text-brand-gold" />
                <h3 className="text-sm font-serif tracking-tight">Pipeline de Sincronización</h3>
              </div>
              <div className="grid grid-cols-4 gap-4 text-[8px] text-brand-paper/60">
                {[
                  { step: '1', text: 'Pull via ODBC / API REST' },
                  { step: '2', text: 'Mapeo a catálogo NIF' },
                  { step: '3', text: 'Validación y reconciliación' },
                  { step: '4', text: 'Actualización ER / BG' },
                ].map(s => (
                  <div key={s.step} className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-brand-gold/20 text-brand-gold flex items-center justify-center text-[8px] font-bold flex-shrink-0">{s.step}</span>
                    {s.text}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

// ─── CLABE Validation Utility ─────────────────────────────────────────────────
// ─── REPMotorPanel ────────────────────────────────────────────────────────────
function REPMotorPanel() {
  const [invoices, setInvoices] = React.useState<PPDInvoice[]>(REPMotorService.getInvoices());
  const [acting, setActing] = React.useState<string | null>(null);
  // ─── New: CLABE Validation ───
  const [clabeInput, setClabeInput] = React.useState('');
  const [clabeResult, setClabeResult] = React.useState<{ valid: boolean; bank?: string; error?: string } | null>(null);
  const [showClabeValidator, setShowClabeValidator] = React.useState(false);

  React.useEffect(() => {
    REPMotorService.subscribe(setInvoices);
    return () => REPMotorService.unsubscribe(setInvoices);
  }, []);

  const atRisk = invoices.filter(i => i.days_since_payment >= 5 && i.rep_status === 'pending');
  const stamped = invoices.filter(i => i.rep_status === 'stamped' || i.rep_status === 'risk_extinct');
  const extinct = invoices.filter(i => i.rep_status === 'risk_extinct');

  const REP_STATUS: Record<PPDInvoice['rep_status'], { label: string; badge: string; pill: string }> = {
    pending:      { label: 'Sin REP',         badge: 'bg-red-100 text-red-700',    pill: '🔴' },
    claimed:      { label: 'Reclamado',       badge: 'bg-yellow-100 text-yellow-700', pill: '🟡' },
    received:     { label: 'REP Recibido',    badge: 'bg-blue-100 text-blue-700',  pill: '🔵' },
    stamped:      { label: 'Timbrado',        badge: 'bg-teal-100 text-teal-700',  pill: '🟢' },
    risk_extinct: { label: 'Riesgo Extinto ✓', badge: 'bg-green-100 text-green-700', pill: '✅' },
  };

  const handleAction = (id: string, action: 'claim' | 'stamp') => {
    setActing(id);
    setTimeout(() => {
      if (action === 'claim') REPMotorService.claimREP(id);
      else REPMotorService.stampREP(id);
      setActing(null);
    }, 900);
  };

  return (
    <div className="space-y-6">
      {/* Stats + CLABE Validator Toggle */}
      <div className="flex items-center justify-between">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 flex-1">
          {[
            { label: 'Total PPD',       val: invoices.length,   color: 'text-brand-ink',    bg: 'bg-white border-brand-sand/30' },
            { label: 'En Riesgo (+5d)', val: atRisk.length,     color: 'text-red-600',      bg: 'bg-red-50 border-red-200' },
            { label: 'REPs Timbrados',  val: stamped.length,    color: 'text-teal-600',     bg: 'bg-teal-50 border-teal-200' },
            { label: 'Riesgo Extinto',  val: extinct.length,    color: 'text-green-600',    bg: 'bg-green-50 border-green-200' },
          ].map(s => (
            <div key={s.label} className={`p-4 rounded-2xl border ${s.bg} text-center`}>
              <p className={`text-2xl font-bold font-serif ${s.color}`}>{s.val}</p>
              <p className="text-[9px] uppercase font-bold tracking-widest text-brand-ink/40 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
        <button onClick={() => setShowClabeValidator(!showClabeValidator)}
          className={`ml-4 flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all flex-shrink-0 ${
            showClabeValidator ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100'
          }`}>
          <CreditCard size={14} /> Validar CLABE
        </button>
      </div>

      {/* ─── CLABE Validator ─── */}
      <AnimatePresence>
        {showClabeValidator && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="bg-white rounded-2xl p-6 border border-blue-200 space-y-4 shadow-sm">
              <div className="flex items-center gap-3">
                <CreditCard size={18} className="text-blue-600" />
                <div>
                  <h4 className="text-sm font-bold text-brand-ink">Validador de CLABE Interbancaria</h4>
                  <p className="text-[10px] text-brand-ink/40">Verifica 18 dígitos, código de banco y dígito verificador (módulo 10)</p>
                </div>
              </div>
              <div className="flex gap-3">
                <input
                  value={clabeInput}
                  onChange={e => { setClabeInput(e.target.value.replace(/\D/g, '').slice(0, 18)); setClabeResult(null); }}
                  placeholder="Ingresa la CLABE de 18 dígitos..."
                  maxLength={18}
                  className="flex-1 px-4 py-3 border border-brand-sand/50 rounded-xl text-sm font-mono tracking-widest focus:outline-none focus:border-blue-500"
                />
                <button onClick={() => setClabeResult(validateCLABE(clabeInput))}
                  disabled={clabeInput.length !== 18}
                  className="px-6 py-3 bg-blue-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-blue-700 transition-all disabled:opacity-40">
                  Validar
                </button>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-brand-ink/40">
                <span>Dígitos: {clabeInput.length}/18</span>
                {clabeInput.length > 0 && clabeInput.length < 18 && (
                  <div className="flex-1 bg-brand-sand/20 rounded-full h-1.5 overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${(clabeInput.length / 18) * 100}%` }} />
                  </div>
                )}
              </div>
              {clabeResult && (
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${
                    clabeResult.valid ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                  }`}>
                  {clabeResult.valid ? (
                    <>
                      <CheckCircle2 size={18} className="text-green-600" />
                      <div>
                        <p className="text-sm font-bold text-green-800">CLABE válida</p>
                        <p className="text-[10px] text-green-600">Banco: <strong>{clabeResult.bank}</strong> · Dígito verificador correcto</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <AlertCircle size={18} className="text-red-600" />
                      <div>
                        <p className="text-sm font-bold text-red-800">CLABE inválida</p>
                        <p className="text-[10px] text-red-600">{clabeResult.error}</p>
                      </div>
                    </>
                  )}
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Actionable Cards — En Riesgo */}
      {atRisk.length > 0 && (
        <div className="space-y-3">
          <p className="label-caps !text-red-500 flex items-center gap-1.5"><AlertTriangle size={10}/> Actionable Cards — Requieren Atención</p>
          {atRisk.map(inv => (
            <motion.div key={inv.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-4 p-4 bg-red-50 border border-red-200 rounded-2xl">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded-full uppercase tracking-widest">PPD · {inv.days_since_payment}d sin REP</span>
                </div>
                <p className="text-sm font-bold text-brand-ink">{inv.provider_name}</p>
                <p className="text-[10px] font-mono text-brand-ink/40">{inv.cfdi_uuid} · {CURRENCY_FORMATTER.format(inv.amount)}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleAction(inv.id, 'claim')} disabled={acting === inv.id}
                  className="px-3 py-2 bg-brand-ink text-brand-bone rounded-xl text-[9px] font-bold uppercase tracking-widest hover:bg-red-700 transition-all disabled:opacity-50">
                  {acting === inv.id ? '...' : 'Reclamar REP'}
                </button>
                <button onClick={() => handleAction(inv.id, 'stamp')} disabled={acting === inv.id}
                  className="px-3 py-2 bg-brand-gold text-brand-ink rounded-xl text-[9px] font-bold uppercase tracking-widest hover:scale-105 transition-all disabled:opacity-50">
                  Auto-Timbrar
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Full Table */}
      <div className="editorial-card !p-0 overflow-hidden shadow-xl shadow-brand-sand/30 border border-brand-sand/50">
        <div className="px-6 py-3 bg-white/50 border-b border-brand-sand/20 flex items-center justify-between">
          <p className="text-sm font-bold text-brand-ink">Monitor PPD — Complementos de Pago</p>
          <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"/><span className="text-[9px] font-bold text-brand-ink/40 uppercase tracking-wider">En vivo</span></div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-separate border-spacing-0 min-w-[600px]">
            <thead className="bg-brand-sand/10 sticky top-0 z-10 backdrop-blur-md">
              <tr>
                {['Folio PPD','Proveedor','CFDI UUID','Monto','Días Pago','Estatus REP','Acción'].map(h => (
                  <th key={h} className="px-5 py-3.5 label-caps !opacity-40 border-b border-brand-sand text-brand-ink">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-sand/20">
              {invoices.map(inv => {
                const st = REP_STATUS[inv.rep_status];
                const isAct = acting === inv.id;
                const canClaim = inv.rep_status === 'pending' && inv.days_since_payment >= 5;
                const canStamp = inv.rep_status === 'received' || inv.rep_status === 'claimed';
                return (
                  <tr key={inv.id} className="hover:bg-brand-gold/5 transition-all">
                    <td className="px-5 py-4 text-[10px] font-bold font-mono text-brand-ink">{inv.id}</td>
                    <td className="px-5 py-4"><p className="text-[11px] font-bold text-brand-ink">{inv.provider_name}</p><p className="text-[9px] text-brand-ink/30 font-mono">{inv.provider_id}</p></td>
                    <td className="px-5 py-4"><span className="text-[9px] font-mono bg-brand-sand/20 px-2 py-0.5 rounded-lg text-brand-ink/60">{inv.cfdi_uuid}</span></td>
                    <td className="px-5 py-4 text-sm font-bold font-serif text-brand-ink">{CURRENCY_FORMATTER.format(inv.amount)}</td>
                    <td className="px-5 py-4">
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${inv.days_since_payment >= 5 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{inv.days_since_payment}d</span>
                    </td>
                    <td className="px-5 py-4"><span className={`text-[8px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full ${st.badge}`}>{st.label}</span></td>
                    <td className="px-5 py-4">
                      {inv.rep_xml_url
                        ? <a href={inv.rep_xml_url} className="flex items-center gap-1 text-[9px] font-bold text-teal-600 hover:underline"><Download size={10}/> XML</a>
                        : canClaim ? (
                          <button onClick={() => handleAction(inv.id, 'claim')} disabled={isAct} className="px-3 py-1.5 bg-brand-ink text-brand-bone rounded-lg text-[8px] font-bold uppercase tracking-widest hover:bg-red-700 transition-all disabled:opacity-50">
                            {isAct ? '...' : 'Reclamar'}
                          </button>
                        ) : canStamp ? (
                          <button onClick={() => handleAction(inv.id, 'stamp')} disabled={isAct} className="px-3 py-1.5 bg-brand-gold text-brand-ink rounded-lg text-[8px] font-bold uppercase tracking-widest hover:scale-105 transition-all disabled:opacity-50">
                            {isAct ? '...' : 'Auto-Timbrar'}
                          </button>
                        ) : <span className="text-brand-ink/20 text-[9px]">—</span>
                      }
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-6 py-3 bg-brand-bone/50 border-t border-brand-sand/20">
          <p className="text-[8px] text-brand-ink/30 font-serif">* Worker PPD: Escucha facturas liquidadas en bancos con MetodoPago=PPD. Si +5 días sin REP → Actionable Card. Auto-timbra via Facturama/SATWS al detectar cobro exacto.</p>
        </div>
      </div>
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

// ─── PagosGlobalesPanel ───────────────────────────────────────────────────────
function PagosGlobalesPanel() {
  const [txs, setTxs] = React.useState<BankTransaction[]>(BankTxService.getTransactions());
  const [expanded, setExpanded] = React.useState<string | null>(null);
  const [acting, setActing] = React.useState<string | null>(null);
  const [showForm, setShowForm] = React.useState(false);
  // New payment form state
  const [formTxId, setFormTxId] = React.useState('');
  const [formTotal, setFormTotal] = React.useState('');
  const [formDesc, setFormDesc] = React.useState('');
  const [formAllocs, setFormAllocs] = React.useState<{cfdi: string; prov: string; amount: string}[]>([
    {cfdi: '', prov: '', amount: ''}
  ]);

  React.useEffect(() => {
    BankTxService.subscribe(setTxs);
    return () => BankTxService.unsubscribe(setTxs);
  }, []);

  const TX_STATUS: Record<BankTransaction['status'], {label: string; badge: string}> = {
    pending_allocation: { label: 'Pendiente',      badge: 'bg-yellow-100 text-yellow-700' },
    pending_approval:   { label: 'Pend. Aprobación',badge: 'bg-orange-100 text-orange-700' },
    confirmed:          { label: 'Confirmado ✓',   badge: 'bg-green-100 text-green-700' },
    rejected:           { label: 'Rechazado',      badge: 'bg-red-100 text-red-700' },
  };

  const handleConfirm = (id: string) => {
    setActing(id);
    setTimeout(() => { BankTxService.confirmCharge(id); setActing(null); }, 1000);
  };
  const handleCFO = (id: string) => {
    setActing(id + '_cfo');
    setTimeout(() => { BankTxService.approveCFO(id); setActing(null); }, 800);
  };

  const formAllocTotal = formAllocs.reduce((s, a) => s + (parseFloat(a.amount) || 0), 0);
  const formTotalNum   = parseFloat(formTotal) || 0;
  const formValid      = formTxId && formTotalNum > 0 && Math.abs(formAllocTotal - formTotalNum) < 0.01 && formAllocs.every(a => a.cfdi && a.prov && parseFloat(a.amount) > 0);

  const handleSubmitForm = () => {
    if (!formValid) return;
    BankTxService.addTransaction({
      bank_tx_id: formTxId, total_amount: formTotalNum, description: formDesc, date: new Date().toISOString().slice(0,10),
      status: formTotalNum > 250000 ? 'pending_approval' : 'pending_allocation',
      requires_cfo_approval: formTotalNum > 250000, cfo_approved: false, logged: false,
      allocations: formAllocs.map(a => ({ cfdi_uuid: a.cfdi, provider_id: 'PROV-NEW', provider_name: a.prov, amount: parseFloat(a.amount) }))
    });
    setShowForm(false); setFormTxId(''); setFormTotal(''); setFormDesc('');
    setFormAllocs([{cfdi:'',prov:'',amount:''}]);
  };

  const totalPending   = txs.filter(t => t.status !== 'confirmed').reduce((s,t) => s+t.total_amount, 0);
  const totalConfirmed = txs.filter(t => t.status === 'confirmed').reduce((s,t) => s+t.total_amount, 0);

  return (
    <div className="space-y-6">
      {/* Stats + Actions */}
      <div className="flex flex-col md:flex-row gap-4 items-start justify-between">
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total Transacciones', val: txs.length,             color: 'text-brand-ink',  bg: 'bg-white border-brand-sand/30' },
            { label: 'Monto Pendiente',     val: CURRENCY_FORMATTER.format(totalPending),  color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200' },
            { label: 'Monto Confirmado',    val: CURRENCY_FORMATTER.format(totalConfirmed),color: 'text-green-600',  bg: 'bg-green-50 border-green-200' },
          ].map(s => (
            <div key={s.label} className={`p-4 rounded-2xl border ${s.bg} text-center`}>
              <p className={`text-base font-bold font-serif ${s.color}`}>{s.val}</p>
              <p className="text-[9px] uppercase font-bold tracking-widest text-brand-ink/40 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
        <button onClick={() => setShowForm(f => !f)} className="flex items-center gap-2 px-5 py-3 bg-brand-gold text-brand-ink rounded-xl text-[10px] font-bold uppercase tracking-widest hover:scale-105 transition-all shadow-sm">
          <Plus size={14}/> Nuevo Pago Global
        </button>
      </div>

      {/* New Payment Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{opacity:0,y:-8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-8}}
            className="editorial-card border border-brand-gold/30 space-y-4">
            <p className="text-sm font-bold text-brand-ink flex items-center gap-2"><Plus size={14}/> Nueva Orden de Pago Global</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input value={formTxId} onChange={e=>setFormTxId(e.target.value)} placeholder="Bank TX ID (ej. BANAMEX-2024-...)" className="px-4 py-2.5 border border-brand-sand rounded-xl text-xs focus:outline-none focus:border-brand-gold"/>
              <input value={formTotal} onChange={e=>setFormTotal(e.target.value)} type="number" placeholder="Monto Total Egreso Bancario" className="px-4 py-2.5 border border-brand-sand rounded-xl text-xs focus:outline-none focus:border-brand-gold"/>
              <input value={formDesc} onChange={e=>setFormDesc(e.target.value)} placeholder="Descripción" className="px-4 py-2.5 border border-brand-sand rounded-xl text-xs focus:outline-none focus:border-brand-gold"/>
            </div>
            <div className="space-y-2">
              <p className="label-caps text-brand-ink/40">Asignaciones CFDI</p>
              {formAllocs.map((a, i) => (
                <div key={i} className="grid grid-cols-3 gap-2">
                  <input value={a.cfdi} onChange={e=>{const n=[...formAllocs];n[i]={...n[i],cfdi:e.target.value};setFormAllocs(n);}} placeholder="CFDI UUID" className="px-3 py-2 border border-brand-sand rounded-xl text-xs focus:outline-none focus:border-brand-gold"/>
                  <input value={a.prov} onChange={e=>{const n=[...formAllocs];n[i]={...n[i],prov:e.target.value};setFormAllocs(n);}} placeholder="Proveedor" className="px-3 py-2 border border-brand-sand rounded-xl text-xs focus:outline-none focus:border-brand-gold"/>
                  <input value={a.amount} onChange={e=>{const n=[...formAllocs];n[i]={...n[i],amount:e.target.value};setFormAllocs(n);}} type="number" placeholder="Monto" className="px-3 py-2 border border-brand-sand rounded-xl text-xs focus:outline-none focus:border-brand-gold"/>
                </div>
              ))}
              <button onClick={()=>setFormAllocs(p=>[...p,{cfdi:'',prov:'',amount:''}])} className="text-[9px] font-bold text-brand-gold hover:underline uppercase tracking-widest">+ Agregar CFDI</button>
            </div>
            {/* Validation bar */}
            {formTotalNum > 0 && (
              <div className={`flex items-center gap-3 p-3 rounded-xl border text-xs font-bold ${Math.abs(formAllocTotal-formTotalNum)<0.01 ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                {Math.abs(formAllocTotal-formTotalNum)<0.01 ? <CheckCircle2 size={14}/> : <AlertTriangle size={14}/>}
                Asignado: {CURRENCY_FORMATTER.format(formAllocTotal)} / Total: {CURRENCY_FORMATTER.format(formTotalNum)}
                {Math.abs(formAllocTotal-formTotalNum)>0.01 && <span className="ml-auto">Diferencia: {CURRENCY_FORMATTER.format(Math.abs(formAllocTotal-formTotalNum))}</span>}
              </div>
            )}
            {formTotalNum > 250000 && (
              <div className="flex items-center gap-2 p-3 bg-orange-50 border border-orange-200 rounded-xl text-xs text-orange-700 font-bold">
                <AlertTriangle size={14}/> Monto {'>'} $250,000 MXN — Se enviará Actionable Card al CFO para aprobación antes de liberar layout bancario.
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={handleSubmitForm} disabled={!formValid} className="px-6 py-2.5 bg-brand-ink text-brand-bone rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-brand-gold hover:text-brand-ink transition-all disabled:opacity-40">Crear Orden</button>
              <button onClick={()=>setShowForm(false)} className="px-6 py-2.5 bg-brand-sand/30 text-brand-ink rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-brand-sand transition-all">Cancelar</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Collapsible Tree */}
      <div className="editorial-card !p-0 overflow-hidden shadow-xl shadow-brand-sand/30 border border-brand-sand/50">
        <div className="px-6 py-3 bg-white/50 border-b border-brand-sand/20 flex items-center justify-between">
          <p className="text-sm font-bold text-brand-ink">Árbol de Transacciones Bancarias → CFDIs</p>
          <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"/><span className="text-[9px] font-bold text-brand-ink/40 uppercase tracking-wider">En vivo</span></div>
        </div>
        <div className="divide-y divide-brand-sand/20">
          {txs.map(tx => {
            const isOpen = expanded === tx.id;
            const allocSum = tx.allocations.reduce((s,a)=>s+a.amount, 0);
            const sumOk    = Math.abs(allocSum - tx.total_amount) < 0.01;
            const st = TX_STATUS[tx.status];
            const needsCFO = tx.requires_cfo_approval && !tx.cfo_approved;
            return (
              <div key={tx.id}>
                {/* Parent Row */}
                <div className="flex items-center gap-4 px-6 py-4 hover:bg-brand-gold/5 transition-all cursor-pointer group" onClick={()=>setExpanded(isOpen ? null : tx.id)}>
                  <div className={`transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}><ChevronRight size={16} className="text-brand-ink/30 group-hover:text-brand-gold"/></div>
                  <div className="flex-1 grid grid-cols-4 gap-4 items-center">
                    <div>
                      <p className="text-[10px] font-bold font-mono text-brand-ink">{tx.bank_tx_id}</p>
                      <p className="text-[9px] text-brand-ink/30 font-serif">{tx.date}</p>
                    </div>
                    <p className="text-[11px] text-brand-ink/60 truncate">{tx.description}</p>
                    <p className="text-sm font-bold font-serif text-brand-ink">{CURRENCY_FORMATTER.format(tx.total_amount)}</p>
                    <div className="flex items-center gap-2 justify-end">
                      {!sumOk && <span className="text-[8px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold">⚠ Suma difiere</span>}
                      <span className={`text-[8px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full ${st.badge}`}>{st.label}</span>
                      <span className="text-[9px] text-brand-ink/30">{tx.allocations.length} CFDIs</span>
                    </div>
                  </div>
                </div>
                {/* CFO Approval Card */}
                {needsCFO && (
                  <div className="mx-6 mb-3 flex items-center gap-3 p-3 bg-orange-50 border border-orange-200 rounded-xl">
                    <AlertTriangle size={14} className="text-orange-600 flex-shrink-0"/>
                    <p className="text-[10px] text-orange-700 font-bold flex-1">Requiere aprobación CFO — Pago mayor a $250,000 MXN. Layout bancario bloqueado.</p>
                    <button onClick={()=>handleCFO(tx.id)} disabled={acting===tx.id+'_cfo'} className="px-4 py-2 bg-orange-600 text-white rounded-lg text-[9px] font-bold uppercase tracking-widest hover:bg-orange-700 transition-all disabled:opacity-50">
                      {acting===tx.id+'_cfo' ? '...' : 'Aprobar como CFO'}
                    </button>
                  </div>
                )}
                {/* Children CFDIs */}
                <AnimatePresence>
                  {isOpen && (
                    <motion.div initial={{height:0,opacity:0}} animate={{height:'auto',opacity:1}} exit={{height:0,opacity:0}} className="overflow-hidden bg-brand-bone/40">
                      <div className="ml-10 mr-6 mb-3 divide-y divide-brand-sand/10 rounded-2xl overflow-hidden border border-brand-sand/20">
                        {tx.allocations.map((alloc,i) => (
                          <div key={i} className="flex items-center gap-4 px-5 py-3 bg-white/60 hover:bg-brand-gold/5 transition-all">
                            <div className="w-px h-4 bg-brand-sand/40"/>
                            <div className="flex-1 grid grid-cols-3 gap-4">
                              <div><p className="text-[10px] font-bold text-brand-ink">{alloc.provider_name}</p><p className="text-[9px] text-brand-ink/30 font-mono">{alloc.provider_id}</p></div>
                              <span className="text-[9px] font-mono text-brand-ink/50 bg-brand-sand/20 px-2 py-0.5 rounded-lg self-center">{alloc.cfdi_uuid}</span>
                              <p className="text-sm font-bold font-serif text-brand-ink text-right">{CURRENCY_FORMATTER.format(alloc.amount)}</p>
                            </div>
                          </div>
                        ))}
                        {/* Confirm Button */}
                        {tx.status !== 'confirmed' && sumOk && !needsCFO && (
                          <div className="px-5 py-3 bg-white/60 flex justify-end">
                            <button onClick={()=>handleConfirm(tx.id)} disabled={acting===tx.id} className="flex items-center gap-2 px-5 py-2 bg-brand-ink text-brand-bone rounded-xl text-[9px] font-bold uppercase tracking-widest hover:bg-brand-gold hover:text-brand-ink transition-all disabled:opacity-50">
                              {acting===tx.id ? <motion.div animate={{rotate:360}} transition={{repeat:Infinity,duration:1,ease:'linear'}} className="w-3 h-3 border-2 border-brand-ink/30 border-t-brand-ink rounded-full"/> : <CheckCircle2 size={12}/>}
                              {acting===tx.id ? 'Procesando...' : 'Confirmar Cargo Bancario'}
                            </button>
                          </div>
                        )}
                        {tx.status === 'confirmed' && tx.logged && (
                          <div className="px-5 py-2 bg-green-50 text-green-700 text-[9px] font-bold flex items-center gap-2">
                            <CheckCircle2 size={12}/> Cargo confirmado · {tx.allocations.length} logs inyectados al Ledger Maestro y expedientes de proveedores
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
        <div className="px-6 py-3 bg-brand-bone/50 border-t border-brand-sand/20">
          <p className="text-[8px] text-brand-ink/30 font-serif">* Regla estricta: Si suma de asignaciones ≠ egreso bancario total, la orden es rechazada. Pagos {'>'} $250,000 MXN requieren Actionable Card al CFO.</p>
        </div>
      </div>
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

// ─── ContabilidadView ─────────────────────────────────────────────────────────
function ContabilidadView({ invoices }: { invoices: Invoice[] }) {
  const [activeSection, setActiveSection] = React.useState<'estado_resultados' | 'razones_cxp' | 'razones' | 'importar_erp'>('estado_resultados');

  // Razones financieras de Cuentas por Pagar reales (backend). Null al cargar.
  const [financialRatios, setFinancialRatios] = React.useState<FinancialRatios | null>(null);
  React.useEffect(() => {
    api
      .getFinancialRatios()
      .then(setFinancialRatios)
      .catch((err) => console.warn('No se pudieron cargar razones CxP:', err.message));
  }, []);
  const [capitalTip, setCapitalTip] = React.useState(false);
  const capitalRef = React.useRef<HTMLDivElement>(null);
  const [capitalTipPos, setCapitalTipPos] = React.useState({ top: 0, left: 0, width: 0 });

  // ─── Derive accounting data from invoices ───
  const paidInvoices = invoices.filter(i => i.status === 'paid');
  const pendingInvoices = invoices.filter(i => i.status === 'pending');
  const auditedInvoices = invoices.filter(i => i.status === 'audited');

  const totalPaid = paidInvoices.reduce((s, i) => s + i.amount, 0);
  const totalPending = pendingInvoices.reduce((s, i) => s + i.amount, 0);
  const totalAudited = auditedInvoices.reduce((s, i) => s + i.amount, 0);

  // ─── Historical Monthly Periods ───
  type PeriodData = {
    id: string; label: string; shortLabel: string; closed: boolean;
    er: { ventasNetas: number; otrosIngresos: number; ingresosFinancieros: number; costoVentas: number; depreciacion: number; sueldos: number; servicios: number; renta: number; marketing: number; tecnologia: number; otros: number };
    bg: { efectivo: number; cuentasCobrar: number; inventarios: number; anticipos: number; mobiliario: number; equipo: number; depAcumulada: number; proveedores: number; impuestos: number; prestamosCP: number; creditoLP: number; arrendamiento: number; capitalSocial: number };
  };

  const HISTORICAL_PERIODS: PeriodData[] = React.useMemo(() => [
    { id: '2024-01', label: 'Enero 2024', shortLabel: 'Ene', closed: true,
      er: { ventasNetas: 750_000, otrosIngresos: 18_000, ingresosFinancieros: 5_200, costoVentas: 375_000, depreciacion: 30_000, sueldos: 102_000, servicios: 42_000, renta: 32_500, marketing: 12_000, tecnologia: 23_500, otros: 11_000 },
      bg: { efectivo: 980_000, cuentasCobrar: 720_000, inventarios: 395_000, anticipos: 40_000, mobiliario: 850_000, equipo: 1_200_000, depAcumulada: -290_000, proveedores: 520_000, impuestos: 42_000, prestamosCP: 350_000, creditoLP: 900_000, arrendamiento: 270_000, capitalSocial: 1_500_000 } },
    { id: '2024-02', label: 'Febrero 2024', shortLabel: 'Feb', closed: true,
      er: { ventasNetas: 810_000, otrosIngresos: 20_000, ingresosFinancieros: 5_800, costoVentas: 400_000, depreciacion: 30_000, sueldos: 103_000, servicios: 45_000, renta: 32_500, marketing: 14_000, tecnologia: 23_500, otros: 11_500 },
      bg: { efectivo: 1_020_000, cuentasCobrar: 760_000, inventarios: 405_000, anticipos: 45_000, mobiliario: 850_000, equipo: 1_200_000, depAcumulada: -320_000, proveedores: 490_000, impuestos: 48_000, prestamosCP: 340_000, creditoLP: 880_000, arrendamiento: 265_000, capitalSocial: 1_500_000 } },
    { id: '2024-03', label: 'Marzo 2024', shortLabel: 'Mar', closed: true,
      er: { ventasNetas: 890_000, otrosIngresos: 22_000, ingresosFinancieros: 6_100, costoVentas: 445_000, depreciacion: 30_000, sueldos: 104_000, servicios: 48_000, renta: 32_500, marketing: 15_000, tecnologia: 23_800, otros: 11_800 },
      bg: { efectivo: 1_100_000, cuentasCobrar: 810_000, inventarios: 410_000, anticipos: 50_000, mobiliario: 850_000, equipo: 1_200_000, depAcumulada: -350_000, proveedores: 470_000, impuestos: 56_000, prestamosCP: 330_000, creditoLP: 860_000, arrendamiento: 260_000, capitalSocial: 1_500_000 } },
    { id: '2024-04', label: 'Abril 2024', shortLabel: 'Abr', closed: true,
      er: { ventasNetas: 830_000, otrosIngresos: 20_000, ingresosFinancieros: 6_000, costoVentas: 415_000, depreciacion: 30_000, sueldos: 105_000, servicios: 50_000, renta: 32_500, marketing: 14_500, tecnologia: 24_000, otros: 11_200 },
      bg: { efectivo: 1_180_000, cuentasCobrar: 850_000, inventarios: 415_000, anticipos: 55_000, mobiliario: 850_000, equipo: 1_200_000, depAcumulada: -370_000, proveedores: 480_000, impuestos: 52_000, prestamosCP: 320_000, creditoLP: 840_000, arrendamiento: 255_000, capitalSocial: 1_500_000 } },
    { id: '2024-05', label: 'Mayo 2024', shortLabel: 'May', closed: true,
      er: { ventasNetas: 860_000, otrosIngresos: 21_000, ingresosFinancieros: 5_900, costoVentas: 425_000, depreciacion: 30_000, sueldos: 103_000, servicios: 47_000, renta: 32_500, marketing: 14_000, tecnologia: 23_500, otros: 11_400 },
      bg: { efectivo: 1_220_000, cuentasCobrar: 870_000, inventarios: 418_000, anticipos: 60_000, mobiliario: 850_000, equipo: 1_200_000, depAcumulada: -375_000, proveedores: 460_000, impuestos: 55_000, prestamosCP: 310_000, creditoLP: 820_000, arrendamiento: 252_000, capitalSocial: 1_500_000 } },
    { id: '2024-06', label: 'Junio 2024', shortLabel: 'Jun', closed: false,
      er: { ventasNetas: 710_000, otrosIngresos: 19_000, ingresosFinancieros: 5_500, costoVentas: 365_000, depreciacion: 30_000, sueldos: 103_000, servicios: totalPaid || 53_000, renta: 32_500, marketing: 14_500, tecnologia: 23_700, otros: 11_100 },
      bg: { efectivo: 1_250_000, cuentasCobrar: 890_000, inventarios: 420_000, anticipos: 65_000, mobiliario: 850_000, equipo: 1_200_000, depAcumulada: -380_000, proveedores: totalPending || 450_000, impuestos: 58_000, prestamosCP: 300_000, creditoLP: 800_000, arrendamiento: 250_000, capitalSocial: 1_500_000 } },
  ], [totalPaid, totalPending]);

  const [selectedPeriod, setSelectedPeriod] = React.useState('acumulado');
  // 'acumulado' = Ene–Jun summed, or a specific month id like '2024-01'

  // ─── Compute selected period data ───
  const isAccumulated = selectedPeriod === 'acumulado';
  const selectedPeriodData = React.useMemo(() => {
    if (isAccumulated) {
      const allPeriods = HISTORICAL_PERIODS;
      return {
        er: {
          ventasNetas: allPeriods.reduce((s, p) => s + p.er.ventasNetas, 0),
          otrosIngresos: allPeriods.reduce((s, p) => s + p.er.otrosIngresos, 0),
          ingresosFinancieros: allPeriods.reduce((s, p) => s + p.er.ingresosFinancieros, 0),
          costoVentas: allPeriods.reduce((s, p) => s + p.er.costoVentas, 0),
          depreciacion: allPeriods.reduce((s, p) => s + p.er.depreciacion, 0),
          sueldos: allPeriods.reduce((s, p) => s + p.er.sueldos, 0),
          servicios: allPeriods.reduce((s, p) => s + p.er.servicios, 0),
          renta: allPeriods.reduce((s, p) => s + p.er.renta, 0),
          marketing: allPeriods.reduce((s, p) => s + p.er.marketing, 0),
          tecnologia: allPeriods.reduce((s, p) => s + p.er.tecnologia, 0),
          otros: allPeriods.reduce((s, p) => s + p.er.otros, 0),
        },
        // BG always uses the LATEST period snapshot
        bg: allPeriods[allPeriods.length - 1].bg,
        label: 'Enero – Junio 2024',
        closed: false,
      };
    }
    const p = HISTORICAL_PERIODS.find(p => p.id === selectedPeriod)!;
    return { er: p.er, bg: p.bg, label: p.label, closed: p.closed };
  }, [selectedPeriod, HISTORICAL_PERIODS, isAccumulated]);

  const prevPeriodData = React.useMemo(() => {
    if (isAccumulated) return null;
    const idx = HISTORICAL_PERIODS.findIndex(p => p.id === selectedPeriod);
    return idx > 0 ? HISTORICAL_PERIODS[idx - 1] : null;
  }, [selectedPeriod, HISTORICAL_PERIODS, isAccumulated]);

  // ─── Derive P&L from selected period ───
  const d = selectedPeriodData;
  const ingresos = {
    ventasNetas: d.er.ventasNetas,
    otrosIngresos: d.er.otrosIngresos,
    ingresosFinancieros: d.er.ingresosFinancieros,
    total: d.er.ventasNetas + d.er.otrosIngresos + d.er.ingresosFinancieros,
  };
  const costos = {
    costoVentas: d.er.costoVentas,
    depreciacion: d.er.depreciacion,
    total: d.er.costoVentas + d.er.depreciacion,
  };
  const gastosOp = {
    sueldos: d.er.sueldos,
    servicios: d.er.servicios,
    renta: d.er.renta,
    marketing: d.er.marketing,
    tecnologia: d.er.tecnologia,
    otros: d.er.otros,
    total: d.er.sueldos + d.er.servicios + d.er.renta + d.er.marketing + d.er.tecnologia + d.er.otros,
  };
  const utilidadBruta = ingresos.total - costos.total;
  const utilidadOperativa = utilidadBruta - gastosOp.total;
  const isr = utilidadOperativa * 0.30;
  const ptu = utilidadOperativa * 0.10;
  const utilidadNeta = utilidadOperativa - isr - ptu;
  const ebitda = utilidadOperativa + costos.depreciacion;
  const margenBruto = (utilidadBruta / ingresos.total) * 100;
  const margenOperativo = (utilidadOperativa / ingresos.total) * 100;
  const margenNeto = (utilidadNeta / ingresos.total) * 100;
  const margenEbitda = (ebitda / ingresos.total) * 100;

  // Var% vs previous period
  const varVsAnterior = React.useMemo(() => {
    if (!prevPeriodData) return null;
    const prevTotal = prevPeriodData.er.ventasNetas + prevPeriodData.er.otrosIngresos + prevPeriodData.er.ingresosFinancieros;
    return prevTotal > 0 ? ((ingresos.total - prevTotal) / prevTotal * 100) : 0;
  }, [prevPeriodData, ingresos.total]);

  // ─── Derive BG from selected period ───
  const b = selectedPeriodData.bg;
  const activoCirculante = {
    efectivo: b.efectivo,
    cuentasCobrar: b.cuentasCobrar,
    inventarios: b.inventarios,
    anticipos: b.anticipos,
    total: b.efectivo + b.cuentasCobrar + b.inventarios + b.anticipos,
  };
  const activoFijo = {
    mobiliario: b.mobiliario,
    equipo: b.equipo,
    depAcumulada: b.depAcumulada,
    total: b.mobiliario + b.equipo + b.depAcumulada,
  };
  const totalActivo = activoCirculante.total + activoFijo.total;

  const pasivoCorto = {
    proveedores: b.proveedores,
    impuestos: b.impuestos,
    prestamos: b.prestamosCP,
    total: b.proveedores + b.impuestos + b.prestamosCP,
  };
  const pasivoLargo = {
    creditoBancario: b.creditoLP,
    arrendamiento: b.arrendamiento,
    total: b.creditoLP + b.arrendamiento,
  };
  const totalPasivo = pasivoCorto.total + pasivoLargo.total;

  const capital = {
    capitalSocial: b.capitalSocial,
    utilidadesRetenidas: totalActivo - totalPasivo - b.capitalSocial - utilidadNeta,
    utilidadEjercicio: utilidadNeta,
    total: totalActivo - totalPasivo,
  };

  // ─── Razones Financieras ───
  const razones = {
    liquidez: {
      razonCirculante: activoCirculante.total / pasivoCorto.total,
      pruebaAcida: (activoCirculante.total - activoCirculante.inventarios) / pasivoCorto.total,
      capitalTrabajo: activoCirculante.total - pasivoCorto.total,
    },
    deuda: {
      razonDeuda: totalPasivo / totalActivo,
      apalancamiento: totalPasivo / capital.total,
      cobertura: utilidadOperativa / (pasivoCorto.prestamos + pasivoLargo.creditoBancario) * 12,
    },
    rendimiento: {
      roa: (utilidadNeta / totalActivo) * 100,
      roe: (utilidadNeta / capital.total) * 100,
      margenUtilidad: margenNeto,
      margenEbitda: margenEbitda,
    },
  };

  // ─── Period Selector Component ───
  const PeriodSelector = () => (
    <div className="flex items-center gap-1 bg-white/50 backdrop-blur-sm p-1 rounded-xl border border-brand-sand/20">
      <button
        onClick={() => setSelectedPeriod('acumulado')}
        className={`px-3 py-1.5 rounded-lg text-[8px] font-bold uppercase tracking-wider transition-all ${
          selectedPeriod === 'acumulado' ? 'bg-brand-gold text-white shadow-sm' : 'text-brand-ink/40 hover:text-brand-ink/70'
        }`}
      >
        Acumulado
      </button>
      {HISTORICAL_PERIODS.map(p => (
        <button
          key={p.id}
          onClick={() => setSelectedPeriod(p.id)}
          className={`px-2.5 py-1.5 rounded-lg text-[8px] font-bold uppercase tracking-wider transition-all flex items-center gap-1 ${
            selectedPeriod === p.id ? 'bg-brand-ink text-brand-paper shadow-sm' : 'text-brand-ink/40 hover:text-brand-ink/70'
          }`}
        >
          {p.shortLabel}
          {p.closed && <CheckCircle2 size={8} className={selectedPeriod === p.id ? 'text-green-300' : 'text-green-400/50'} />}
        </button>
      ))}
    </div>
  );

  // ─── Chart data derived from historical periods ───
  const plMonthlyData = HISTORICAL_PERIODS.map(p => {
    const ing = p.er.ventasNetas + p.er.otrosIngresos + p.er.ingresosFinancieros;
    const gastos = p.er.costoVentas + p.er.depreciacion + p.er.sueldos + p.er.servicios + p.er.renta + p.er.marketing + p.er.tecnologia + p.er.otros;
    return { mes: p.shortLabel, ingresos: ing, gastos, utilidad: ing - gastos };
  });

  const balanceComposition = [
    { name: 'Efectivo', value: activoCirculante.efectivo, color: '#C5A059' },
    { name: 'CxC', value: activoCirculante.cuentasCobrar, color: '#8B7355' },
    { name: 'Inventarios', value: activoCirculante.inventarios, color: '#D4C5A9' },
    { name: 'Act. Fijo', value: activoFijo.total, color: '#6B5B3E' },
  ];

  const pasivoComposition = [
    { name: 'Proveedores', value: pasivoCorto.proveedores, color: '#C5A059' },
    { name: 'Impuestos', value: pasivoCorto.impuestos, color: '#8B7355' },
    { name: 'Préstamos CP', value: pasivoCorto.prestamos, color: '#D4C5A9' },
    { name: 'Deuda LP', value: pasivoLargo.total, color: '#6B5B3E' },
    { name: 'Capital', value: capital.total, color: '#3D3525' },
  ];

  const fmt = (n: number) => n < 0
    ? `(${Math.abs(n).toLocaleString('es-MX', { maximumFractionDigits: 0 })})`
    : n.toLocaleString('es-MX', { maximumFractionDigits: 0 });
  const fmtM = (n: number) => `$${(n / 1_000_000).toFixed(2)}M`;
  const fmtK = (n: number) => `$${(n / 1_000).toFixed(0)}K`;
  const fmtPct = (n: number) => `${n.toFixed(1)}%`;
  const fmtRatio = (n: number) => n.toFixed(2);

  // ─── Importar ERP State ───
  const [erpDataView, setErpDataView] = React.useState<'home' | 'catalogo' | 'polizas' | 'activos'>('home');
  const [catalogoFilter, setCatalogoFilter] = React.useState('');
  const [polizasFilter, setPolizasFilter] = React.useState('');
  const [polizasType, setPolizasType] = React.useState('Todos');
  const [selectedPoliza, setSelectedPoliza] = React.useState<string | null>(null);
  const [erpConnection, setErpConnection] = React.useState<{ system: string; status: 'disconnected' | 'connecting' | 'connected'; lastSync?: string }>({ system: 'Aspel COI', status: 'disconnected' });
  const [importHistory, setImportHistory] = React.useState<{ id: string; type: string; date: string; records: number; status: 'success' | 'partial' | 'error'; detail: string }[]>([
    { id: 'IMP-001', type: 'Catálogo de Cuentas', date: '2024-04-20 09:15', records: 342, status: 'success', detail: 'Aspel COI v14.0 — 342 cuentas importadas' },
    { id: 'IMP-002', type: 'Pólizas Contables', date: '2024-04-20 09:18', records: 1204, status: 'success', detail: 'Período Ene–Mar 2024 — 1,204 pólizas' },
    { id: 'IMP-003', type: 'Saldos Activos Fijos', date: '2024-04-19 14:30', records: 87, status: 'partial', detail: '87 de 92 activos — 5 sin clasificar' },
    { id: 'IMP-004', type: 'Pólizas Contables', date: '2024-03-31 18:00', records: 986, status: 'success', detail: 'Cierre mensual Marzo — 986 pólizas' },
    { id: 'IMP-005', type: 'Catálogo de Cuentas', date: '2024-03-15 10:00', records: 338, status: 'success', detail: 'Aspel COI v14.0 — 338 cuentas importadas' },
  ]);
  const [importLoading, setImportLoading] = React.useState<string | null>(null);

  const simulateImport = (type: string, records: number, detail: string) => {
    setImportLoading(type);
    setTimeout(() => {
      setImportHistory(prev => [{
        id: `IMP-${String(prev.length + 1).padStart(3, '0')}`,
        type,
        date: new Date().toLocaleString('es-MX', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }),
        records,
        status: 'success',
        detail,
      }, ...prev]);
      setImportLoading(null);
    }, 2500);
  };

  const simulateConnect = () => {
    setErpConnection(prev => ({ ...prev, status: 'connecting' }));
    setTimeout(() => {
      setErpConnection({ system: 'Aspel COI', status: 'connected', lastSync: new Date().toLocaleString('es-MX') });
    }, 2000);
  };

  // ─── Mock ERP Data ───
  const MOCK_CATALOGO = [
    { cuenta: '1000', nombre: 'ACTIVO', clase: 'Activo', tipo: 'Acumulativa', nivel: 1, saldo: 4_295_000, destino: 'BG', mapeada: true },
    { cuenta: '1100', nombre: 'ACTIVO CIRCULANTE', clase: 'Activo', tipo: 'Acumulativa', nivel: 2, saldo: 2_625_000, destino: 'BG', mapeada: true },
    { cuenta: '1101', nombre: 'Caja y Bancos', clase: 'Activo', tipo: 'Detalle', nivel: 3, saldo: 1_250_000, destino: 'BG', mapeada: true },
    { cuenta: '1102', nombre: 'Clientes', clase: 'Activo', tipo: 'Detalle', nivel: 3, saldo: 890_000, destino: 'BG', mapeada: true },
    { cuenta: '1103', nombre: 'Inventarios', clase: 'Activo', tipo: 'Detalle', nivel: 3, saldo: 420_000, destino: 'BG', mapeada: true },
    { cuenta: '1104', nombre: 'Anticipo a Proveedores', clase: 'Activo', tipo: 'Detalle', nivel: 3, saldo: 65_000, destino: 'BG', mapeada: true },
    { cuenta: '1200', nombre: 'ACTIVO FIJO', clase: 'Activo', tipo: 'Acumulativa', nivel: 2, saldo: 1_670_000, destino: 'BG', mapeada: true },
    { cuenta: '1201', nombre: 'Mobiliario y Equipo de Oficina', clase: 'Activo', tipo: 'Detalle', nivel: 3, saldo: 850_000, destino: 'BG', mapeada: true },
    { cuenta: '1202', nombre: 'Equipo de Cómputo', clase: 'Activo', tipo: 'Detalle', nivel: 3, saldo: 1_200_000, destino: 'BG', mapeada: true },
    { cuenta: '1299', nombre: 'Depreciación Acumulada', clase: 'Activo', tipo: 'Detalle', nivel: 3, saldo: -380_000, destino: 'BG', mapeada: true },
    { cuenta: '2000', nombre: 'PASIVO', clase: 'Pasivo', tipo: 'Acumulativa', nivel: 1, saldo: 2_046_910, destino: 'BG', mapeada: true },
    { cuenta: '2100', nombre: 'PASIVO A CORTO PLAZO', clase: 'Pasivo', tipo: 'Acumulativa', nivel: 2, saldo: 996_910, destino: 'BG', mapeada: true },
    { cuenta: '2101', nombre: 'Proveedores', clase: 'Pasivo', tipo: 'Detalle', nivel: 3, saldo: 548_910, destino: 'BG', mapeada: true },
    { cuenta: '2102', nombre: 'Impuestos por Pagar (ISR/PTU)', clase: 'Pasivo', tipo: 'Detalle', nivel: 3, saldo: 148_000, destino: 'BG', mapeada: true },
    { cuenta: '2103', nombre: 'Préstamos Bancarios CP', clase: 'Pasivo', tipo: 'Detalle', nivel: 3, saldo: 300_000, destino: 'BG', mapeada: true },
    { cuenta: '2200', nombre: 'PASIVO A LARGO PLAZO', clase: 'Pasivo', tipo: 'Acumulativa', nivel: 2, saldo: 1_050_000, destino: 'BG', mapeada: true },
    { cuenta: '2201', nombre: 'Crédito Bancario LP', clase: 'Pasivo', tipo: 'Detalle', nivel: 3, saldo: 800_000, destino: 'BG', mapeada: true },
    { cuenta: '2202', nombre: 'Arrendamiento Financiero', clase: 'Pasivo', tipo: 'Detalle', nivel: 3, saldo: 250_000, destino: 'BG', mapeada: true },
    { cuenta: '3000', nombre: 'CAPITAL CONTABLE', clase: 'Capital', tipo: 'Acumulativa', nivel: 1, saldo: 2_248_090, destino: 'BG', mapeada: true },
    { cuenta: '3001', nombre: 'Capital Social', clase: 'Capital', tipo: 'Detalle', nivel: 2, saldo: 1_500_000, destino: 'BG', mapeada: true },
    { cuenta: '3002', nombre: 'Utilidades Retenidas', clase: 'Capital', tipo: 'Detalle', nivel: 2, saldo: 407_800, destino: 'BG', mapeada: true },
    { cuenta: '3003', nombre: 'Utilidad del Ejercicio', clase: 'Capital', tipo: 'Detalle', nivel: 2, saldo: 340_290, destino: 'BG', mapeada: true },
    { cuenta: '4000', nombre: 'INGRESOS', clase: 'Resultado', tipo: 'Acumulativa', nivel: 1, saldo: 5_005_000, destino: 'ER', mapeada: true },
    { cuenta: '4001', nombre: 'Ventas Netas', clase: 'Resultado', tipo: 'Detalle', nivel: 2, saldo: 4_850_000, destino: 'ER', mapeada: true },
    { cuenta: '4002', nombre: 'Otros Ingresos', clase: 'Resultado', tipo: 'Detalle', nivel: 2, saldo: 120_000, destino: 'ER', mapeada: true },
    { cuenta: '4003', nombre: 'Ingresos Financieros', clase: 'Resultado', tipo: 'Detalle', nivel: 2, saldo: 35_000, destino: 'ER', mapeada: true },
    { cuenta: '5000', nombre: 'COSTO DE VENTAS', clase: 'Resultado', tipo: 'Acumulativa', nivel: 1, saldo: 2_425_000, destino: 'ER', mapeada: true },
    { cuenta: '5001', nombre: 'Costo Directo de Servicios', clase: 'Resultado', tipo: 'Detalle', nivel: 2, saldo: 2_245_000, destino: 'ER', mapeada: true },
    { cuenta: '5002', nombre: 'Depreciación Aplicada', clase: 'Resultado', tipo: 'Detalle', nivel: 2, saldo: 180_000, destino: 'ER', mapeada: true },
    { cuenta: '6000', nombre: 'GASTOS DE OPERACIÓN', clase: 'Resultado', tipo: 'Acumulativa', nivel: 1, saldo: 1_395_000, destino: 'ER', mapeada: true },
    { cuenta: '6001', nombre: 'Sueldos y Salarios', clase: 'Resultado', tipo: 'Detalle', nivel: 2, saldo: 620_000, destino: 'ER', mapeada: true },
    { cuenta: '6002', nombre: 'Servicios Profesionales', clase: 'Resultado', tipo: 'Detalle', nivel: 2, saldo: 285_000, destino: 'ER', mapeada: true },
    { cuenta: '6003', nombre: 'Rentas', clase: 'Resultado', tipo: 'Detalle', nivel: 2, saldo: 195_000, destino: 'ER', mapeada: true },
    { cuenta: '6004', nombre: 'Marketing y Publicidad', clase: 'Resultado', tipo: 'Detalle', nivel: 2, saldo: 85_000, destino: 'ER', mapeada: true },
    { cuenta: '6005', nombre: 'Tecnología y Licencias', clase: 'Resultado', tipo: 'Detalle', nivel: 2, saldo: 142_000, destino: 'ER', mapeada: true },
    { cuenta: '6006', nombre: 'Otros Gastos Operativos', clase: 'Resultado', tipo: 'Detalle', nivel: 2, saldo: 68_000, destino: 'ER', mapeada: true },
  ];

  const MOCK_POLIZAS = [
    { id: 'POL-0241', tipo: 'Ingreso', fecha: '2024-04-25', concepto: 'Cobro cliente Nexus Corp — Fac F-0891', cargo: 0, abono: 245_000, cuenta: '4001', ref: 'TRF-4521', status: 'aplicada' },
    { id: 'POL-0240', tipo: 'Egreso', fecha: '2024-04-25', concepto: 'Pago a Logística Global SA — Fac FAC-01-C5', cargo: 38_100, abono: 0, cuenta: '5001', ref: 'SPEI-8820', status: 'aplicada' },
    { id: 'POL-0239', tipo: 'Diario', fecha: '2024-04-24', concepto: 'Depreciación mensual equipo de cómputo', cargo: 30_000, abono: 30_000, cuenta: '5002', ref: 'DEP-0424', status: 'aplicada' },
    { id: 'POL-0238', tipo: 'Egreso', fecha: '2024-04-24', concepto: 'Pago nómina quincenal 2a quincena Abril', cargo: 310_000, abono: 0, cuenta: '6001', ref: 'NOM-0424B', status: 'aplicada' },
    { id: 'POL-0237', tipo: 'Ingreso', fecha: '2024-04-23', concepto: 'Cobro anticipo proyecto Beta Industries', cargo: 0, abono: 180_000, cuenta: '4001', ref: 'TRF-4498', status: 'aplicada' },
    { id: 'POL-0236', tipo: 'Egreso', fecha: '2024-04-22', concepto: 'Pago renta oficina Abril 2024', cargo: 65_000, abono: 0, cuenta: '6003', ref: 'CFDI-RNT-04', status: 'aplicada' },
    { id: 'POL-0235', tipo: 'Diario', fecha: '2024-04-20', concepto: 'Provisión ISR mensual estimado', cargo: 74_000, abono: 74_000, cuenta: '2102', ref: 'PROV-ISR-04', status: 'aplicada' },
    { id: 'POL-0234', tipo: 'Egreso', fecha: '2024-04-19', concepto: 'Pago a TechParts MX — Fac FAC-02-P1 parcial', cargo: 20_000, abono: 0, cuenta: '5001', ref: 'SPEI-8791', status: 'aplicada' },
    { id: 'POL-0233', tipo: 'Ingreso', fecha: '2024-04-18', concepto: 'Intereses cuenta inversión BANAMEX', cargo: 0, abono: 8_500, cuenta: '4003', ref: 'INT-BNM-04', status: 'aplicada' },
    { id: 'POL-0232', tipo: 'Diario', fecha: '2024-04-15', concepto: 'Ajuste diferencia tipo de cambio USD', cargo: 12_000, abono: 12_000, cuenta: '4002', ref: 'TC-ADJ-04', status: 'aplicada' },
    { id: 'POL-0231', tipo: 'Egreso', fecha: '2024-04-15', concepto: 'Pago licencias SaaS (Adobe, GitHub, AWS)', cargo: 48_000, abono: 0, cuenta: '6005', ref: 'CFDI-TEC-04', status: 'aplicada' },
    { id: 'POL-0230', tipo: 'Egreso', fecha: '2024-04-10', concepto: 'Pago servicio marketing digital Q2', cargo: 42_500, abono: 0, cuenta: '6004', ref: 'CFDI-MKT-04', status: 'aplicada' },
  ];

  const MOCK_ACTIVOS = [
    { cuenta: '1201-001', nombre: 'Escritorios Ejecutivos (10 pzas)', categoria: 'Mobiliario', fechaAdq: '2022-01-15', costoAdq: 85_000, depAnual: 17_000, depAcum: 34_000, valorNeto: 51_000, vidaUtil: 5, vidaRestante: 3, metodo: 'Línea Recta', ubicacion: 'Piso 3 - Gerencias' },
    { cuenta: '1201-002', nombre: 'Sillas Ergonómicas (25 pzas)', categoria: 'Mobiliario', fechaAdq: '2022-01-15', costoAdq: 62_500, depAnual: 12_500, depAcum: 25_000, valorNeto: 37_500, vidaUtil: 5, vidaRestante: 3, metodo: 'Línea Recta', ubicacion: 'Todas las áreas' },
    { cuenta: '1201-003', nombre: 'Sala de Juntas (mesa + sillas)', categoria: 'Mobiliario', fechaAdq: '2022-03-01', costoAdq: 145_000, depAnual: 29_000, depAcum: 55_100, valorNeto: 89_900, vidaUtil: 5, vidaRestante: 2.8, metodo: 'Línea Recta', ubicacion: 'Piso 4 - Sala A' },
    { cuenta: '1202-001', nombre: 'Laptops MacBook Pro (12 pzas)', categoria: 'Equipo Cómputo', fechaAdq: '2023-02-10', costoAdq: 360_000, depAnual: 72_000, depAcum: 78_000, valorNeto: 282_000, vidaUtil: 5, vidaRestante: 4.1, metodo: 'Línea Recta', ubicacion: 'Desarrollo / Finanzas' },
    { cuenta: '1202-002', nombre: 'Servidor Dell PowerEdge R750', categoria: 'Equipo Cómputo', fechaAdq: '2023-01-20', costoAdq: 280_000, depAnual: 56_000, depAcum: 60_667, valorNeto: 219_333, vidaUtil: 5, vidaRestante: 4.2, metodo: 'Línea Recta', ubicacion: 'Cuarto de Servidores' },
    { cuenta: '1202-003', nombre: 'Switches y Router Core', categoria: 'Equipo Cómputo', fechaAdq: '2023-01-20', costoAdq: 95_000, depAnual: 19_000, depAcum: 20_583, valorNeto: 74_417, vidaUtil: 5, vidaRestante: 4.2, metodo: 'Línea Recta', ubicacion: 'Infraestructura de Red' },
    { cuenta: '1202-004', nombre: 'Impresoras (3 pzas) + Escáner', categoria: 'Equipo Cómputo', fechaAdq: '2022-06-01', costoAdq: 48_000, depAnual: 9_600, depAcum: 18_400, valorNeto: 29_600, vidaUtil: 5, vidaRestante: 2.6, metodo: 'Línea Recta', ubicacion: 'Área Administrativa' },
    { cuenta: '1202-005', nombre: 'Pantallas Monitoreo (8 pzas)', categoria: 'Equipo Cómputo', fechaAdq: '2023-04-15', costoAdq: 72_000, depAnual: 14_400, depAcum: 13_200, valorNeto: 58_800, vidaUtil: 5, vidaRestante: 4.7, metodo: 'Línea Recta', ubicacion: 'NOC / Operaciones' },
    { cuenta: '1202-006', nombre: 'UPS y Reguladores de Voltaje', categoria: 'Equipo Cómputo', fechaAdq: '2023-01-20', costoAdq: 45_000, depAnual: 9_000, depAcum: 9_750, valorNeto: 35_250, vidaUtil: 5, vidaRestante: 4.2, metodo: 'Línea Recta', ubicacion: 'Cuarto de Servidores' },
    { cuenta: '1202-007', nombre: 'Teléfonos IP (20 pzas)', categoria: 'Equipo Cómputo', fechaAdq: '2022-04-01', costoAdq: 40_000, depAnual: 8_000, depAcum: 16_000, valorNeto: 24_000, vidaUtil: 5, vidaRestante: 2.8, metodo: 'Línea Recta', ubicacion: 'Todas las áreas' },
    { cuenta: '1201-SIN', nombre: 'Locker área común (sin clasificar)', categoria: 'Mobiliario', fechaAdq: '2024-01-10', costoAdq: 18_000, depAnual: 3_600, depAcum: 1_200, valorNeto: 16_800, vidaUtil: 5, vidaRestante: 4.9, metodo: 'Pendiente', ubicacion: 'Sin asignar' },
  ];

  const sections = [
    { id: 'estado_resultados' as const, label: 'Estado de Resultados', icon: <FileBarChart size={14} /> },
    { id: 'razones_cxp' as const, label: 'Razones de Cuentas por Pagar', icon: <DollarSign size={14} /> },
    { id: 'razones' as const, label: 'Razones Financieras', icon: <TrendingUp size={14} /> },
    { id: 'importar_erp' as const, label: 'Importar ERP', icon: <FolderSync size={14} /> },
  ];

  // Gauge component for ratios — tooltip renders via React Portal to escape ALL stacking contexts
  const RatioGauge = ({ label, value, format, min, max, ideal, unit, color, tooltip }: {
    label: string; value: number; format: string; min: number; max: number; ideal?: string; unit?: string; color: string;
    tooltip?: { status: 'saludable' | 'precaución' | 'riesgo'; title: string; explanation: string; recommendation: string };
  }) => {
    const pct = Math.min(Math.max(((value - min) / (max - min)) * 100, 0), 100);
    const [showTip, setShowTip] = React.useState(false);
    const gaugeRef = React.useRef<HTMLDivElement>(null);
    const [tipPos, setTipPos] = React.useState({ top: 0, left: 0, width: 0, placement: 'below' as 'below' | 'above' });
    const tipStatusConfig = {
      saludable: { icon: '✅', bgStyle: { background: '#f0fdf4', borderColor: '#bbf7d0' }, titleColor: '#15803d', badgeBg: '#dcfce7', badgeText: '#166534', label: 'Saludable' },
      precaución: { icon: '⚠️', bgStyle: { background: '#fffbeb', borderColor: '#fde68a' }, titleColor: '#b45309', badgeBg: '#fef3c7', badgeText: '#92400e', label: 'Precaución' },
      riesgo: { icon: '🔴', bgStyle: { background: '#fef2f2', borderColor: '#fecaca' }, titleColor: '#b91c1c', badgeBg: '#fee2e2', badgeText: '#991b1b', label: 'Riesgo' },
    };

    const handleMouseEnter = () => {
      if (gaugeRef.current && tooltip) {
        const rect = gaugeRef.current.getBoundingClientRect();
        const tipHeight = 240;
        const spaceBelow = window.innerHeight - rect.bottom;
        const placement = spaceBelow < tipHeight + 16 ? 'above' : 'below';
        setTipPos({
          top: placement === 'above' ? rect.top - tipHeight - 10 : rect.bottom + 10,
          left: rect.left,
          width: Math.max(rect.width, 320),
          placement,
        });
      }
      setShowTip(true);
    };

    return (
      <motion.div
        ref={gaugeRef}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white/60 backdrop-blur-sm rounded-2xl p-5 border border-brand-sand/30 cursor-default"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setShowTip(false)}
      >
        <p className="text-[8px] uppercase tracking-[.2em] font-bold text-brand-ink/40 mb-3 flex items-center gap-1.5">
          {label}
          {tooltip && <HelpCircle size={10} className="text-brand-ink/20" />}
        </p>
        <div className="flex items-end gap-2 mb-3">
          <span className="font-serif text-2xl tracking-tight text-brand-ink">{format}</span>
          {unit && <span className="text-[9px] text-brand-ink/40 font-bold uppercase mb-1">{unit}</span>}
        </div>
        <div className="w-full h-2 bg-brand-sand/30 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
            className="h-full rounded-full"
            style={{ backgroundColor: color }}
          />
        </div>
        {ideal && <p className="text-[7px] text-brand-ink/30 mt-2 uppercase tracking-wider">Ideal: {ideal}</p>}

        {/* Portal Tooltip — renders at document.body, fully escapes all parent stacking contexts */}
        {showTip && tooltip && ReactDOM.createPortal(
          <div
            style={{
              position: 'fixed',
              top: tipPos.top,
              left: tipPos.left,
              width: tipPos.width,
              zIndex: 99999,
              pointerEvents: 'none',
              ...tipStatusConfig[tooltip.status].bgStyle,
              borderWidth: 1,
              borderStyle: 'solid',
              borderRadius: 12,
              padding: 16,
              boxShadow: '0 20px 60px rgba(0,0,0,0.15), 0 4px 20px rgba(0,0,0,0.1)',
              animation: 'fadeInTip 0.18s ease-out',
            }}
          >
            {/* Status badge */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{
                fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em',
                padding: '2px 8px', borderRadius: 9999,
                background: tipStatusConfig[tooltip.status].badgeBg,
                color: tipStatusConfig[tooltip.status].badgeText,
              }}>
                {tipStatusConfig[tooltip.status].icon} {tipStatusConfig[tooltip.status].label}
              </span>
              <span style={{ fontSize: 8, fontFamily: 'monospace', color: 'rgba(0,0,0,0.3)' }}>{format} {unit || ''}</span>
            </div>

            {/* Title */}
            <p style={{ fontSize: 11, fontWeight: 700, marginBottom: 6, color: tipStatusConfig[tooltip.status].titleColor }}>
              {tooltip.title}
            </p>

            {/* Explanation */}
            <p style={{ fontSize: 10, color: 'rgba(0,0,0,0.5)', lineHeight: 1.6, marginBottom: 12 }}>
              {tooltip.explanation}
            </p>

            {/* Recommendation */}
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 8,
              background: 'rgba(255,255,255,0.6)', borderRadius: 8, padding: 10,
              border: '1px solid rgba(0,0,0,0.06)',
            }}>
              <Sparkles size={12} style={{ color: '#C5A059', flexShrink: 0, marginTop: 2 }} />
              <div>
                <p style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(0,0,0,0.35)', marginBottom: 2 }}>Recomendación</p>
                <p style={{ fontSize: 9, color: 'rgba(0,0,0,0.6)', lineHeight: 1.6 }}>{tooltip.recommendation}</p>
              </div>
            </div>
          </div>,
          document.body
        )}
      </motion.div>
    );
  };

  // P&L Row component
  const PLRow = ({ label, amount, bold, indent, highlight, border }: {
    label: string; amount: number; bold?: boolean; indent?: boolean; highlight?: boolean; border?: boolean;
  }) => (
    <div className={`flex justify-between items-center py-2.5 px-4 ${border ? 'border-t border-brand-sand/40' : ''} ${highlight ? 'bg-brand-gold/5 rounded-xl' : ''}`}>
      <span className={`text-[10px] tracking-wider ${bold ? 'font-bold uppercase text-brand-ink' : 'text-brand-ink/60'} ${indent ? 'pl-6' : ''}`}>
        {label}
      </span>
      <span className={`font-serif text-sm tracking-tight ${bold ? 'text-brand-ink font-bold' : amount < 0 ? 'text-red-500' : 'text-brand-ink/80'}`}>
        ${fmt(amount)}
      </span>
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-2xl tracking-tight text-brand-ink">Contabilidad</h2>
          <p className="text-[9px] uppercase tracking-[.25em] text-brand-ink/40 font-bold mt-1">
            Información financiera · {selectedPeriodData.label}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[8px] uppercase tracking-widest text-brand-ink/30 font-bold">Datos derivados del ERP</span>
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 bg-white/40 backdrop-blur-sm p-1 rounded-2xl border border-brand-sand/20 w-fit">
        {sections.map(s => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[9px] uppercase tracking-[.15em] font-bold transition-all duration-300 ${
              activeSection === s.id
                ? 'bg-brand-ink text-brand-paper shadow-lg'
                : 'text-brand-ink/40 hover:text-brand-ink/70 hover:bg-white/50'
            }`}
          >
            {s.icon} {s.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* ═══════════════════ ESTADO DE RESULTADOS ═══════════════════ */}
        {activeSection === 'estado_resultados' && (
          <motion.div
            key="er"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4 }}
            className="space-y-6"
          >
            {/* Period Selector */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <PeriodSelector />
                {selectedPeriodData.closed && !isAccumulated && (
                  <span className="flex items-center gap-1 text-[8px] font-bold uppercase tracking-wider text-green-600 bg-green-50 px-2.5 py-1 rounded-full">
                    <CheckCircle2 size={10} /> Período cerrado
                  </span>
                )}
                {!selectedPeriodData.closed && !isAccumulated && (
                  <span className="flex items-center gap-1 text-[8px] font-bold uppercase tracking-wider text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full">
                    <Clock size={10} /> Período abierto
                  </span>
                )}
              </div>
              <p className="text-[9px] text-brand-ink/30 font-bold uppercase tracking-wider">{selectedPeriodData.label}</p>
            </div>

            {/* KPI Strip */}
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: 'Ingresos Totales', value: fmtM(ingresos.total), sub: varVsAnterior !== null ? `${varVsAnterior >= 0 ? '+' : ''}${varVsAnterior.toFixed(1)}% vs anterior` : isAccumulated ? '6 meses acumulados' : 'Primer período', color: 'text-brand-ink' },
                { label: 'Utilidad Bruta', value: fmtM(utilidadBruta), sub: `Margen ${fmtPct(margenBruto)}`, color: 'text-brand-ink' },
                { label: 'EBITDA', value: fmtM(ebitda), sub: `Margen ${fmtPct(margenEbitda)}`, color: 'text-brand-gold' },
                { label: 'Utilidad Neta', value: fmtM(utilidadNeta), sub: `Margen ${fmtPct(margenNeto)}`, color: utilidadNeta > 0 ? 'text-green-600' : 'text-red-500' },
              ].map((kpi, i) => (
                <motion.div
                  key={kpi.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="bg-white/70 backdrop-blur-sm rounded-2xl p-5 border border-brand-sand/20"
                >
                  <p className="text-[8px] uppercase tracking-[.2em] font-bold text-brand-ink/40">{kpi.label}</p>
                  <p className={`font-serif text-2xl tracking-tight mt-2 ${kpi.color}`}>{kpi.value}</p>
                  <p className="text-[8px] text-brand-ink/30 mt-1 font-medium">{kpi.sub}</p>
                </motion.div>
              ))}
            </div>

            {/* Two columns: P&L Table + Chart */}
            <div className="grid grid-cols-5 gap-6">
              {/* P&L Statement */}
              <div className="col-span-3 bg-white/70 backdrop-blur-sm rounded-2xl border border-brand-sand/20 overflow-hidden">
                <div className="px-6 py-4 border-b border-brand-sand/20">
                  <h3 className="font-serif text-lg tracking-tight text-brand-ink">Estado de Resultados</h3>
                  <p className="text-[8px] uppercase tracking-[.2em] text-brand-ink/30 font-bold mt-0.5">Período: {selectedPeriodData.label}</p>
                </div>
                <div className="p-4 space-y-0.5">
                  <PLRow label="Ventas Netas" amount={ingresos.ventasNetas} bold />
                  <PLRow label="Otros Ingresos" amount={ingresos.otrosIngresos} indent />
                  <PLRow label="Ingresos Financieros" amount={ingresos.ingresosFinancieros} indent />
                  <PLRow label="Total Ingresos" amount={ingresos.total} bold highlight border />

                  <div className="h-3" />
                  <PLRow label="Costo de Ventas" amount={-costos.costoVentas} indent />
                  <PLRow label="Depreciación" amount={-costos.depreciacion} indent />
                  <PLRow label="Utilidad Bruta" amount={utilidadBruta} bold highlight border />

                  <div className="h-3" />
                  <PLRow label="Sueldos y Salarios" amount={-gastosOp.sueldos} indent />
                  <PLRow label="Servicios Profesionales" amount={-gastosOp.servicios} indent />
                  <PLRow label="Rentas" amount={-gastosOp.renta} indent />
                  <PLRow label="Marketing" amount={-gastosOp.marketing} indent />
                  <PLRow label="Tecnología" amount={-gastosOp.tecnologia} indent />
                  <PLRow label="Otros Gastos" amount={-gastosOp.otros} indent />
                  <PLRow label="Total Gastos Operativos" amount={-gastosOp.total} bold border />

                  <div className="h-3" />
                  <PLRow label="Utilidad Operativa" amount={utilidadOperativa} bold highlight border />
                  <PLRow label="ISR (30%)" amount={-isr} indent />
                  <PLRow label="PTU (10%)" amount={-ptu} indent />
                  <PLRow label="Utilidad Neta" amount={utilidadNeta} bold highlight border />
                </div>
              </div>

              {/* Trend Chart */}
              <div className="col-span-2 space-y-4">
                <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-brand-sand/20 p-5">
                  <h4 className="text-[9px] uppercase tracking-[.2em] font-bold text-brand-ink/40 mb-4">Tendencia Mensual</h4>
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={plMonthlyData}>
                      <defs>
                        <linearGradient id="gradIngresos" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#C5A059" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#C5A059" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gradUtilidad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#D8D3C4" strokeOpacity={0.3} />
                      <XAxis dataKey="mes" tick={{ fontSize: 9, fill: '#1A1A1A80' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 8, fill: '#1A1A1A50' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${(v/1000).toFixed(0)}K`} />
                      <RechartsTooltip
                        contentStyle={{ background: '#FFFDF5', border: '1px solid #D8D3C4', borderRadius: 12, fontSize: 10 }}
                        formatter={(v: number) => [`$${(v/1000).toFixed(0)}K`, '']}
                      />
                      <Area type="monotone" dataKey="ingresos" stroke="#C5A059" fill="url(#gradIngresos)" strokeWidth={2} name="Ingresos" />
                      <Area type="monotone" dataKey="utilidad" stroke="#22c55e" fill="url(#gradUtilidad)" strokeWidth={2} name="Utilidad" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* Margin cards */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Margen Bruto', value: margenBruto, color: '#C5A059' },
                    { label: 'Margen Operativo', value: margenOperativo, color: '#8B7355' },
                    { label: 'Margen EBITDA', value: margenEbitda, color: '#6B5B3E' },
                    { label: 'Margen Neto', value: margenNeto, color: '#22c55e' },
                  ].map((m, i) => (
                    <motion.div
                      key={m.label}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.3 + i * 0.08 }}
                      className="bg-white/70 backdrop-blur-sm rounded-2xl p-4 border border-brand-sand/20"
                    >
                      <p className="text-[7px] uppercase tracking-[.2em] font-bold text-brand-ink/35">{m.label}</p>
                      <div className="flex items-end gap-1 mt-2">
                        <span className="font-serif text-xl tracking-tight text-brand-ink">{m.value.toFixed(1)}</span>
                        <span className="text-[9px] text-brand-ink/40 mb-0.5 font-bold">%</span>
                      </div>
                      <div className="w-full h-1.5 bg-brand-sand/20 rounded-full mt-2 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(m.value, 100)}%` }}
                          transition={{ duration: 1, delay: 0.5 + i * 0.1 }}
                          className="h-full rounded-full"
                          style={{ backgroundColor: m.color }}
                        />
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ═══════════════════ RAZONES DE CUENTAS POR PAGAR ═══════════════════ */}
        {activeSection === 'razones_cxp' && (
          <motion.div key="razones_cxp" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.4 }} className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <span className="label-caps !text-brand-gold">Análisis · Cuentas por Pagar</span>
                <h3 className="text-2xl font-serif text-brand-ink">Razones de Cuentas por Pagar</h3>
                <p className="text-[10px] text-brand-ink/40 mt-1">Métricas operativas y de riesgo calculadas con tus datos reales de tesorería.</p>
              </div>
              {financialRatios && (
                <span className="text-[9px] text-brand-ink/40 uppercase tracking-widest font-bold flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Datos en vivo
                </span>
              )}
            </div>

            {!financialRatios ? (
              <div className="editorial-card text-center py-16 text-brand-ink/40 text-sm">Cargando razones de cuentas por pagar…</div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="editorial-card !p-6 space-y-2">
                    <div className="flex items-center gap-2 text-brand-ink/40"><Clock size={16} /><span className="text-[9px] uppercase tracking-widest font-bold">Días Promedio de Pago</span></div>
                    <p className="text-5xl font-serif text-brand-ink leading-none">{financialRatios.dpo.value}<span className="text-lg text-brand-ink/40 ml-1.5 font-sans">días</span></p>
                    <p className="text-[10px] text-brand-ink/40">Promedio sobre {financialRatios.dpo.basis} factura(s) pagada(s)</p>
                  </div>
                  <div className="editorial-card !p-6 space-y-3">
                    <div className="flex items-center gap-2 text-brand-ink/40"><CheckCircle2 size={16} /><span className="text-[9px] uppercase tracking-widest font-bold">Pagadas a Tiempo</span></div>
                    <p className="text-5xl font-serif text-brand-ink leading-none">{financialRatios.punctuality.onTimePct}<span className="text-lg text-brand-ink/40 ml-1 font-sans">%</span></p>
                    <div className="w-full h-2 bg-brand-sand/40 rounded-full overflow-hidden">
                      <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${financialRatios.punctuality.onTimePct}%` }} />
                    </div>
                    <p className="text-[10px] text-brand-ink/40">{financialRatios.punctuality.onTime} a tiempo · {financialRatios.punctuality.late} tarde</p>
                  </div>
                  <div className="editorial-card !p-6 space-y-2">
                    <div className="flex items-center gap-2 text-brand-ink/40"><RefreshCw size={16} /><span className="text-[9px] uppercase tracking-widest font-bold">Rotación de CxP</span></div>
                    <p className="text-5xl font-serif text-brand-ink leading-none">{financialRatios.turnover.value}<span className="text-lg text-brand-ink/40 ml-1.5 font-sans">veces</span></p>
                    <p className="text-[10px] text-brand-ink/40">Compras {CURRENCY_FORMATTER.format(financialRatios.turnover.compras)} / CxP {CURRENCY_FORMATTER.format(financialRatios.turnover.cxpActual)}</p>
                  </div>
                  <div className="editorial-card !p-6 space-y-2">
                    <div className="flex items-center gap-2 text-brand-ink/40"><DollarSign size={16} /><span className="text-[9px] uppercase tracking-widest font-bold">Costo de Factoraje</span></div>
                    <p className="text-5xl font-serif text-brand-ink leading-none">{financialRatios.factorajeCost.costPct}<span className="text-lg text-brand-ink/40 ml-1 font-sans">%</span></p>
                    <p className="text-[10px] text-brand-ink/40">{CURRENCY_FORMATTER.format(financialRatios.factorajeCost.totalFee)} en comisiones · {financialRatios.factorajeCost.operations} op.</p>
                  </div>
                  <div className="editorial-card !p-6 space-y-2 md:col-span-2 !bg-brand-ink">
                    <div className="flex items-center gap-2 text-brand-paper/50"><ShieldCheck size={16} /><span className="text-[9px] uppercase tracking-widest font-bold">Protegido por Auditoría Forense</span></div>
                    <p className="text-5xl font-serif text-brand-paper leading-none">{CURRENCY_FORMATTER.format(financialRatios.forensicSavings.blockedAmount)}</p>
                    <p className="text-[10px] text-brand-paper/50">{financialRatios.forensicSavings.blockedCount} factura(s) bloqueada(s) por fraude o duplicado · {financialRatios.forensicSavings.discrepancyCount} con discrepancia ({CURRENCY_FORMATTER.format(financialRatios.forensicSavings.discrepancyAmount)})</p>
                  </div>
                </div>

                <div className="editorial-card !p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-brand-ink/40"><Scale size={16} /><span className="text-[9px] uppercase tracking-widest font-bold">Concentración de Proveedores</span></div>
                    <p className="text-sm font-bold text-brand-ink">{financialRatios.supplierConcentration.concentrationPct}% en top {financialRatios.supplierConcentration.top.length}</p>
                  </div>
                  <div className="space-y-3">
                    {financialRatios.supplierConcentration.top.map((s, i) => (
                      <div key={s.supplierId} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-brand-ink font-medium truncate max-w-[55%]">{s.name}</span>
                          <span className="text-brand-ink/50">{CURRENCY_FORMATTER.format(s.amount)} · {s.sharePct}%</span>
                        </div>
                        <div className="w-full h-2.5 bg-brand-sand/40 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${s.sharePct}%`, backgroundColor: i === 0 ? '#D4AF37' : i === 1 ? '#C9A227' : i === 2 ? '#B8941F' : '#A8841A' }} />
                        </div>
                      </div>
                    ))}
                    {financialRatios.supplierConcentration.top.length === 0 && (
                      <p className="text-[10px] text-brand-ink/40">Sin cuentas por pagar pendientes para analizar.</p>
                    )}
                  </div>
                  {financialRatios.supplierConcentration.concentrationPct >= 70 && (
                    <p className="text-[10px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-start gap-2">
                      <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                      <span>Alta concentración: una parte grande de tu deuda depende de pocos proveedores. Considera diversificar para reducir el riesgo operativo.</span>
                    </p>
                  )}
                </div>
              </>
            )}
          </motion.div>
        )}

        {/* ═══════════════════ RAZONES FINANCIERAS ═══════════════════ */}
        {activeSection === 'razones' && (
          <motion.div
            key="razones"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4 }}
            className="space-y-6"
          >
            {/* Liquidez */}
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
                  <DollarSign size={16} className="text-blue-500" />
                </div>
                <div>
                  <h3 className="font-serif text-lg tracking-tight text-brand-ink">Liquidez</h3>
                  <p className="text-[8px] uppercase tracking-[.2em] text-brand-ink/30 font-bold">Capacidad para cumplir obligaciones a corto plazo</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <RatioGauge
                  label="Razón Circulante"
                  value={razones.liquidez.razonCirculante}
                  format={fmtRatio(razones.liquidez.razonCirculante)}
                  min={0} max={4}
                  ideal="1.5 – 2.5"
                  unit="veces"
                  color={razones.liquidez.razonCirculante >= 1.5 ? '#22c55e' : razones.liquidez.razonCirculante >= 1 ? '#f59e0b' : '#ef4444'}
                  tooltip={razones.liquidez.razonCirculante >= 2.5 ? {
                    status: 'saludable',
                    title: `Tu razón circulante de ${fmtRatio(razones.liquidez.razonCirculante)} es excelente`,
                    explanation: `Por cada $1 de deuda a corto plazo, tienes $${fmtRatio(razones.liquidez.razonCirculante)} en activos circulantes. Esto significa que puedes cubrir tus obligaciones ${fmtRatio(razones.liquidez.razonCirculante)} veces sin problemas.`,
                    recommendation: 'Podrías usar parte del excedente de liquidez para inversión a corto plazo o pago anticipado a proveedores con descuento por pronto pago.',
                  } : razones.liquidez.razonCirculante >= 1.5 ? {
                    status: 'saludable',
                    title: `Tu razón circulante de ${fmtRatio(razones.liquidez.razonCirculante)} está en rango saludable`,
                    explanation: `Tienes $${fmtRatio(razones.liquidez.razonCirculante)} en activos circulantes por cada $1 de pasivos a corto plazo. Es un balance adecuado entre liquidez y eficiencia de capital.`,
                    recommendation: 'Mantén este nivel. Monitorea mensualmente y asegúrate de que tus cuentas por cobrar se estén convirtiendo en efectivo a tiempo.',
                  } : razones.liquidez.razonCirculante >= 1 ? {
                    status: 'precaución',
                    title: `Tu razón circulante de ${fmtRatio(razones.liquidez.razonCirculante)} está por debajo del ideal`,
                    explanation: `Aunque puedes cubrir tus deudas a corto plazo, el margen es estrecho. Cualquier retraso en cobranza o gasto imprevisto podría generar tensión de liquidez.`,
                    recommendation: 'Acelera la cobranza de facturas vencidas, negocia plazos más largos con proveedores, o considera una línea de crédito revolvente como colchón.',
                  } : {
                    status: 'riesgo',
                    title: `Tu razón circulante de ${fmtRatio(razones.liquidez.razonCirculante)} indica riesgo de liquidez`,
                    explanation: `Tus pasivos a corto plazo superan tus activos circulantes. Esto significa que no tienes suficientes recursos líquidos para cubrir tus deudas próximas.`,
                    recommendation: 'Urgente: reestructura deuda de corto a largo plazo, inyecta capital, o liquida activos no esenciales. Considera factoraje para convertir cuentas por cobrar en efectivo inmediato.',
                  }}
                />
                <RatioGauge
                  label="Prueba Ácida"
                  value={razones.liquidez.pruebaAcida}
                  format={fmtRatio(razones.liquidez.pruebaAcida)}
                  min={0} max={3}
                  ideal="1.0 – 1.5"
                  unit="veces"
                  color={razones.liquidez.pruebaAcida >= 1 ? '#22c55e' : razones.liquidez.pruebaAcida >= 0.7 ? '#f59e0b' : '#ef4444'}
                  tooltip={razones.liquidez.pruebaAcida >= 1.5 ? {
                    status: 'saludable',
                    title: `Prueba ácida de ${fmtRatio(razones.liquidez.pruebaAcida)} — liquidez inmediata excelente`,
                    explanation: `Sin contar inventarios, tienes $${fmtRatio(razones.liquidez.pruebaAcida)} en activos líquidos por cada $1 de deuda a corto plazo. Puedes pagar tus compromisos sin vender inventario.`,
                    recommendation: 'Excelente posición. El excedente de liquidez podría destinarse a inversiones de corto plazo (CETES, reporto) para generar rendimiento.',
                  } : razones.liquidez.pruebaAcida >= 1 ? {
                    status: 'saludable',
                    title: `Prueba ácida de ${fmtRatio(razones.liquidez.pruebaAcida)} — adecuada`,
                    explanation: `Puedes cubrir tus deudas a corto plazo con efectivo y cuentas por cobrar, sin depender de vender inventario. La diferencia con la razón circulante (${fmtRatio(razones.liquidez.razonCirculante)}) muestra cuánto de tu liquidez está en inventarios.`,
                    recommendation: 'Buen nivel. Vigila la rotación de cuentas por cobrar para asegurar que se conviertan en efectivo rápidamente.',
                  } : razones.liquidez.pruebaAcida >= 0.7 ? {
                    status: 'precaución',
                    title: `Prueba ácida de ${fmtRatio(razones.liquidez.pruebaAcida)} — dependes del inventario`,
                    explanation: `Sin inventarios, no alcanzas a cubrir tus deudas a corto plazo 1 a 1. Esto sugiere que gran parte de tu liquidez está atada en mercancía almacenada.`,
                    recommendation: 'Reduce niveles de inventario, mejora la rotación de producto, y acelera la cobranza. Si tienes facturas por cobrar, el factoraje puede liberarte liquidez inmediata.',
                  } : {
                    status: 'riesgo',
                    title: `Prueba ácida de ${fmtRatio(razones.liquidez.pruebaAcida)} — insuficiente`,
                    explanation: `Tus activos más líquidos (efectivo + cuentas por cobrar) solo cubren el ${Math.round(razones.liquidez.pruebaAcida * 100)}% de tus pasivos a corto plazo. Dependes completamente del inventario.`,
                    recommendation: 'Prioridad: cobrar facturas vencidas, negociar plazos con proveedores y evaluar financiamiento puente. No adquieras más inventario hasta mejorar este indicador.',
                  }}
                />
                {(() => {
                  const ct = razones.liquidez.capitalTrabajo;
                  const ctTip = ct > 500000 ? {
                    status: 'saludable' as const,
                    title: `$${fmt(ct)} de capital de trabajo — holgura financiera`,
                    explanation: `Tienes un excedente significativo de activos circulantes sobre pasivos a corto plazo. Esto te da flexibilidad para invertir, pagar anticipadamente, o absorber imprevistos sin estrés.`,
                    recommendation: 'Considera invertir el excedente en instrumentos de bajo riesgo o en mejoras operativas que incrementen tu rentabilidad.',
                  } : ct > 0 ? {
                    status: 'precaución' as const,
                    title: `$${fmt(ct)} de capital de trabajo — margen ajustado`,
                    explanation: `Aunque es positivo, el colchón es pequeño. Un retraso en la cobranza o un gasto imprevisto podría dejarte sin liquidez para operar.`,
                    recommendation: 'Fortalece tu posición reduciendo gastos no esenciales, acelerando cobranza, o asegurando una línea de crédito revolvente como respaldo.',
                  } : {
                    status: 'riesgo' as const,
                    title: `Capital de trabajo negativo: -$${fmt(Math.abs(ct))}`,
                    explanation: `Tus deudas a corto plazo superan tus activos circulantes. La empresa no puede cubrir sus compromisos inmediatos con lo que tiene disponible.`,
                    recommendation: 'Acción inmediata: negocia extensión de plazos con proveedores, cobra facturas vencidas con urgencia, y evalúa si necesitas inyección de capital o reestructura de deuda.',
                  };
                  const ctBgClass = ctTip.status === 'saludable' ? 'bg-green-50 border-green-200' : ctTip.status === 'precaución' ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200';
                  const ctBadgeClass = ctTip.status === 'saludable' ? 'bg-green-100 text-green-800' : ctTip.status === 'precaución' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800';
                  const ctTextClass = ctTip.status === 'saludable' ? 'text-green-700' : ctTip.status === 'precaución' ? 'text-amber-700' : 'text-red-700';
                  const ctIcon = ctTip.status === 'saludable' ? '✅' : ctTip.status === 'precaución' ? '⚠️' : '🔴';
                  const ctLabel = ctTip.status === 'saludable' ? 'Saludable' : ctTip.status === 'precaución' ? 'Precaución' : 'Riesgo';
                  return (
                    <motion.div
                      ref={capitalRef}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-white/60 backdrop-blur-sm rounded-2xl p-5 border border-brand-sand/30 relative cursor-default"
                      onMouseEnter={() => {
                        if (capitalRef.current) {
                          const rect = capitalRef.current.getBoundingClientRect();
                          const tipH = 220;
                          const spaceBelow = window.innerHeight - rect.bottom;
                          setCapitalTipPos({
                            top: spaceBelow < tipH + 12 ? rect.top - tipH - 8 : rect.bottom + 8,
                            left: rect.left,
                            width: rect.width,
                          });
                        }
                        setCapitalTip(true);
                      }}
                      onMouseLeave={() => setCapitalTip(false)}
                    >
                      <p className="text-[8px] uppercase tracking-[.2em] font-bold text-brand-ink/40 mb-3 flex items-center gap-1.5">
                        Capital de Trabajo <HelpCircle size={10} className="text-brand-ink/20" />
                      </p>
                      <div className="flex items-end gap-1">
                        <span className="font-serif text-2xl tracking-tight text-brand-ink">${fmt(ct)}</span>
                      </div>
                      <p className="text-[8px] text-brand-ink/30 mt-2">
                        {ct > 0
                          ? 'Positivo — la empresa puede cubrir sus deudas de corto plazo'
                          : 'Negativo — riesgo de insolvencia'}
                      </p>
                      <div className="flex items-center gap-1.5 mt-3">
                        {ct > 0
                          ? <CheckCircle2 size={10} className="text-green-500" />
                          : <AlertTriangle size={10} className="text-red-500" />}
                        <span className={`text-[7px] font-bold uppercase tracking-wider ${ct > 0 ? 'text-green-600' : 'text-red-500'}`}>
                          {ct > 0 ? 'Saludable' : 'Atención'}
                        </span>
                      </div>

                      {/* Portal tooltip — renders at document.body */}
                      {capitalTip && ReactDOM.createPortal(
                        <div style={{
                          position: 'fixed',
                          top: capitalTipPos.top,
                          left: capitalTipPos.left,
                          width: Math.max(capitalTipPos.width, 320),
                          zIndex: 99999,
                          pointerEvents: 'none',
                          background: ctTip.status === 'saludable' ? '#f0fdf4' : ctTip.status === 'precaución' ? '#fffbeb' : '#fef2f2',
                          borderColor: ctTip.status === 'saludable' ? '#bbf7d0' : ctTip.status === 'precaución' ? '#fde68a' : '#fecaca',
                          borderWidth: 1, borderStyle: 'solid', borderRadius: 12, padding: 16,
                          boxShadow: '0 20px 60px rgba(0,0,0,0.15), 0 4px 20px rgba(0,0,0,0.1)',
                          animation: 'fadeInTip 0.18s ease-out',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                            <span style={{
                              fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em',
                              padding: '2px 8px', borderRadius: 9999,
                              background: ctTip.status === 'saludable' ? '#dcfce7' : ctTip.status === 'precaución' ? '#fef3c7' : '#fee2e2',
                              color: ctTip.status === 'saludable' ? '#166534' : ctTip.status === 'precaución' ? '#92400e' : '#991b1b',
                            }}>
                              {ctIcon} {ctLabel}
                            </span>
                            <span style={{ fontSize: 8, fontFamily: 'monospace', color: 'rgba(0,0,0,0.3)' }}>${fmt(ct)}</span>
                          </div>
                          <p style={{ fontSize: 11, fontWeight: 700, marginBottom: 6, color: ctTip.status === 'saludable' ? '#15803d' : ctTip.status === 'precaución' ? '#b45309' : '#b91c1c' }}>
                            {ctTip.title}
                          </p>
                          <p style={{ fontSize: 10, color: 'rgba(0,0,0,0.5)', lineHeight: 1.6, marginBottom: 12 }}>
                            {ctTip.explanation}
                          </p>
                          <div style={{
                            display: 'flex', alignItems: 'flex-start', gap: 8,
                            background: 'rgba(255,255,255,0.6)', borderRadius: 8, padding: 10,
                            border: '1px solid rgba(0,0,0,0.06)',
                          }}>
                            <Sparkles size={12} style={{ color: '#C5A059', flexShrink: 0, marginTop: 2 }} />
                            <div>
                              <p style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(0,0,0,0.35)', marginBottom: 2 }}>Recomendación</p>
                              <p style={{ fontSize: 9, color: 'rgba(0,0,0,0.6)', lineHeight: 1.6 }}>{ctTip.recommendation}</p>
                            </div>
                          </div>
                        </div>,
                        document.body
                      )}
                    </motion.div>
                  );
                })()}
              </div>
            </div>

            {/* Deuda */}
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center">
                  <Scale size={16} className="text-amber-500" />
                </div>
                <div>
                  <h3 className="font-serif text-lg tracking-tight text-brand-ink">Endeudamiento</h3>
                  <p className="text-[8px] uppercase tracking-[.2em] text-brand-ink/30 font-bold">Estructura de capital y apalancamiento</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <RatioGauge
                  label="Razón de Deuda"
                  value={razones.deuda.razonDeuda * 100}
                  format={fmtPct(razones.deuda.razonDeuda * 100)}
                  min={0} max={100}
                  ideal="< 60%"
                  color={razones.deuda.razonDeuda < 0.5 ? '#22c55e' : razones.deuda.razonDeuda < 0.7 ? '#f59e0b' : '#ef4444'}
                  tooltip={razones.deuda.razonDeuda < 0.4 ? {
                    status: 'saludable',
                    title: `Solo el ${fmtPct(razones.deuda.razonDeuda * 100)} de tus activos están financiados con deuda`,
                    explanation: `Tu empresa tiene un perfil conservador. La mayor parte de tus activos se financian con capital propio, lo que te da estabilidad y capacidad de pedir crédito si lo necesitas.`,
                    recommendation: 'Podrías apalancar más para crecer. Evalúa créditos con tasa preferencial si hay oportunidades de expansión que justifiquen el costo financiero.',
                  } : razones.deuda.razonDeuda < 0.6 ? {
                    status: 'saludable',
                    title: `Razón de deuda de ${fmtPct(razones.deuda.razonDeuda * 100)} — nivel moderado`,
                    explanation: `Poco más de la mitad de tus activos se financian con recursos de terceros. Es un nivel aceptable para la mayoría de las industrias en México.`,
                    recommendation: 'Mantén este nivel. Si planeas tomar más deuda, asegúrate de que el rendimiento esperado supere la tasa de interés.',
                  } : razones.deuda.razonDeuda < 0.7 ? {
                    status: 'precaución',
                    title: `${fmtPct(razones.deuda.razonDeuda * 100)} de deuda sobre activos — nivel elevado`,
                    explanation: `Más del 60% de tus activos están comprometidos con acreedores. Esto limita tu capacidad para obtener financiamiento adicional y aumenta la presión sobre el flujo de efectivo.`,
                    recommendation: 'Prioriza reducir pasivos: liquida deuda de mayor tasa primero, evita nuevos compromisos, y destina excedentes de efectivo al pago de capital.',
                  } : {
                    status: 'riesgo',
                    title: `Razón de deuda de ${fmtPct(razones.deuda.razonDeuda * 100)} — sobreendeudamiento`,
                    explanation: `La mayoría de tus activos están financiados por terceros. Un cambio en las tasas de interés o una caída en ingresos podría generar incumplimiento.`,
                    recommendation: 'Acción urgente: reestructura de deuda, venta de activos no esenciales, o inyección de capital fresco. Evita absolutamente nueva deuda.',
                  }}
                />
                <RatioGauge
                  label="Apalancamiento"
                  value={razones.deuda.apalancamiento}
                  format={fmtRatio(razones.deuda.apalancamiento)}
                  min={0} max={5}
                  ideal="< 2.0"
                  unit="veces"
                  color={razones.deuda.apalancamiento < 1.5 ? '#22c55e' : razones.deuda.apalancamiento < 2.5 ? '#f59e0b' : '#ef4444'}
                  tooltip={razones.deuda.apalancamiento < 1 ? {
                    status: 'saludable',
                    title: `Apalancamiento de ${fmtRatio(razones.deuda.apalancamiento)}x — empresa poco apalancada`,
                    explanation: `Tu deuda total es menor que tu capital contable. Los accionistas tienen más en juego que los acreedores, lo que da confianza a bancos y proveedores.`,
                    recommendation: 'Buena posición para negociar créditos en términos favorables. Si hay oportunidades de crecimiento, puedes apalancarte con bajo riesgo.',
                  } : razones.deuda.apalancamiento < 2 ? {
                    status: 'saludable',
                    title: `Apalancamiento de ${fmtRatio(razones.deuda.apalancamiento)}x — equilibrado`,
                    explanation: `Por cada $1 de capital, tienes $${fmtRatio(razones.deuda.apalancamiento)} de deuda. Es un nivel manejable que balancea crecimiento con estabilidad.`,
                    recommendation: 'Mantén el apalancamiento en este rango. Antes de tomar nueva deuda, verifica que la cobertura de intereses se mantenga por encima de 2x.',
                  } : razones.deuda.apalancamiento < 3 ? {
                    status: 'precaución',
                    title: `Apalancamiento de ${fmtRatio(razones.deuda.apalancamiento)}x — alto`,
                    explanation: `Tu deuda duplica o triplica tu capital. Los acreedores tienen más exposición que los socios, lo que complica obtener nuevo financiamiento.`,
                    recommendation: 'Reduce deuda progresivamente. Capitaliza utilidades en lugar de distribuir dividendos para fortalecer el capital contable.',
                  } : {
                    status: 'riesgo',
                    title: `Apalancamiento de ${fmtRatio(razones.deuda.apalancamiento)}x — peligrosamente alto`,
                    explanation: `Tu deuda supera 3 veces tu capital. Cualquier variación negativa en ingresos puede llevar a insolvencia técnica. Bancos difícilmente prestarán más.`,
                    recommendation: 'Requiere reestructura de capital inmediata: inyección de socios, conversión de deuda a capital, o venta estratégica de activos.',
                  }}
                />
                <RatioGauge
                  label="Cobertura de Deuda"
                  value={razones.deuda.cobertura}
                  format={fmtRatio(razones.deuda.cobertura)}
                  min={0} max={10}
                  ideal="> 2.0"
                  unit="veces"
                  color={razones.deuda.cobertura > 2 ? '#22c55e' : razones.deuda.cobertura > 1 ? '#f59e0b' : '#ef4444'}
                  tooltip={razones.deuda.cobertura > 4 ? {
                    status: 'saludable',
                    title: `Cobertura de ${fmtRatio(razones.deuda.cobertura)}x — tu operación genera de sobra para pagar deuda`,
                    explanation: `Tu utilidad operativa cubre ${fmtRatio(razones.deuda.cobertura)} veces el servicio de tu deuda. Tienes un margen amplio de seguridad ante caídas en ventas.`,
                    recommendation: 'Excelente. Podrías considerar inversiones productivas o renegociar tu deuda existente en mejores términos dado el bajo riesgo.',
                  } : razones.deuda.cobertura > 2 ? {
                    status: 'saludable',
                    title: `Cobertura de ${fmtRatio(razones.deuda.cobertura)}x — nivel adecuado`,
                    explanation: `Generas suficiente utilidad operativa para cubrir tus obligaciones de deuda más de 2 veces. Es el mínimo recomendado por la banca.`,
                    recommendation: 'Buen nivel. Mantén vigilancia mensual. Si la cobertura baja de 2x, considera pausar nuevas inversiones financiadas con deuda.',
                  } : razones.deuda.cobertura > 1 ? {
                    status: 'precaución',
                    title: `Cobertura de ${fmtRatio(razones.deuda.cobertura)}x — margen estrecho`,
                    explanation: `Tu operación genera apenas lo suficiente para cubrir el servicio de deuda. Una baja en ventas del ${Math.round((1 - 1/razones.deuda.cobertura) * 100)}% te pondría en riesgo de impago.`,
                    recommendation: 'No tomes deuda adicional. Enfócate en mejorar márgenes operativos y reducir gastos fijos para ampliar este colchón.',
                  } : {
                    status: 'riesgo',
                    title: `Cobertura menor a 1x — no generas suficiente para pagar tu deuda`,
                    explanation: `Tu utilidad operativa no alcanza a cubrir los pagos de deuda. Estás consumiendo capital o reservas para cumplir con acreedores.`,
                    recommendation: 'Situación crítica: renegocia plazos y tasas con bancos inmediatamente. Reduce costos operativos agresivamente y evalúa si necesitas una reestructura formal.',
                  }}
                />
              </div>
            </div>

            {/* Rendimiento */}
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-xl bg-green-50 flex items-center justify-center">
                  <TrendingUp size={16} className="text-green-500" />
                </div>
                <div>
                  <h3 className="font-serif text-lg tracking-tight text-brand-ink">Rendimiento</h3>
                  <p className="text-[8px] uppercase tracking-[.2em] text-brand-ink/30 font-bold">Rentabilidad y eficiencia operativa</p>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-4">
                <RatioGauge
                  label="ROA"
                  value={razones.rendimiento.roa}
                  format={fmtPct(razones.rendimiento.roa)}
                  min={0} max={30}
                  ideal="> 5%"
                  color={razones.rendimiento.roa > 5 ? '#22c55e' : razones.rendimiento.roa > 2 ? '#f59e0b' : '#ef4444'}
                  tooltip={razones.rendimiento.roa > 8 ? {
                    status: 'saludable',
                    title: `ROA de ${fmtPct(razones.rendimiento.roa)} — tus activos generan buen rendimiento`,
                    explanation: `Por cada $100 invertidos en activos totales, la empresa genera $${razones.rendimiento.roa.toFixed(1)} de utilidad neta. Supera el benchmark de la industria en México.`,
                    recommendation: 'Excelente eficiencia de activos. Analiza cuáles activos generan mayor retorno y considera desinvertir en los que no contribuyen.',
                  } : razones.rendimiento.roa > 5 ? {
                    status: 'saludable',
                    title: `ROA de ${fmtPct(razones.rendimiento.roa)} — rendimiento aceptable`,
                    explanation: `Generas ${razones.rendimiento.roa.toFixed(1)} centavos de utilidad por cada peso en activos. Es un nivel razonable que supera la inflación.`,
                    recommendation: 'Busca mejorar la rotación de activos: reduce inventario ocioso, cobra más rápido, y evalúa si todos tus activos fijos están productivos.',
                  } : razones.rendimiento.roa > 2 ? {
                    status: 'precaución',
                    title: `ROA de ${fmtPct(razones.rendimiento.roa)} — rendimiento bajo`,
                    explanation: `Tus activos no están generando suficiente utilidad. Un ROA menor al 5% indica que podrías obtener mejor retorno invirtiendo en CETES o instrumentos de bajo riesgo.`,
                    recommendation: 'Revisa la eficiencia operativa: reduce costos, mejora márgenes, o vende activos improductivos que no contribuyen al negocio.',
                  } : {
                    status: 'riesgo',
                    title: `ROA de ${fmtPct(razones.rendimiento.roa)} — tus activos casi no generan valor`,
                    explanation: `La utilidad que producen tus activos es mínima. Es probable que tengas activos sobredimensionados o márgenes de utilidad muy comprimidos.`,
                    recommendation: 'Diagnóstico profundo necesario: identifica activos improductivos, revisa la estructura de costos completa, y evalúa si el modelo de negocio es sostenible.',
                  }}
                />
                <RatioGauge
                  label="ROE"
                  value={razones.rendimiento.roe}
                  format={fmtPct(razones.rendimiento.roe)}
                  min={0} max={40}
                  ideal="> 15%"
                  color={razones.rendimiento.roe > 15 ? '#22c55e' : razones.rendimiento.roe > 8 ? '#f59e0b' : '#ef4444'}
                  tooltip={razones.rendimiento.roe > 20 ? {
                    status: 'saludable',
                    title: `ROE de ${fmtPct(razones.rendimiento.roe)} — alta rentabilidad para accionistas`,
                    explanation: `Los socios obtienen un retorno del ${razones.rendimiento.roe.toFixed(1)}% sobre su inversión. Esto es superior a la mayoría de las alternativas de inversión disponibles en México.`,
                    recommendation: 'Verifica que el alto ROE no sea solo por exceso de apalancamiento (compáralo con ROA). Si es por eficiencia operativa genuina, el negocio es muy atractivo.',
                  } : razones.rendimiento.roe > 15 ? {
                    status: 'saludable',
                    title: `ROE de ${fmtPct(razones.rendimiento.roe)} — retorno atractivo`,
                    explanation: `Los accionistas obtienen ${razones.rendimiento.roe.toFixed(1)} centavos por cada peso invertido. Es un rendimiento que justifica mantener la inversión en el negocio.`,
                    recommendation: 'Buen rendimiento. Reinvierte utilidades para crecer o distribuye dividendos según las necesidades de capitalización.',
                  } : razones.rendimiento.roe > 8 ? {
                    status: 'precaución',
                    title: `ROE de ${fmtPct(razones.rendimiento.roe)} — rendimiento moderado`,
                    explanation: `El retorno para los accionistas es inferior al 15%. Un inversionista podría obtener rendimientos similares en instrumentos financieros con menos riesgo.`,
                    recommendation: 'Mejora márgenes operativos, optimiza la estructura de capital, o considera si necesitas cambiar la estrategia de precios para ser más rentable.',
                  } : {
                    status: 'riesgo',
                    title: `ROE de ${fmtPct(razones.rendimiento.roe)} — el negocio no está siendo rentable para los socios`,
                    explanation: `El capital de los accionistas genera un retorno mínimo. Mantener dinero en el negocio tiene un costo de oportunidad alto.`,
                    recommendation: 'Evalúa si la empresa necesita una reestructuración profunda: ajustar precios, eliminar líneas de negocio no rentables, o reducir la base de capital.',
                  }}
                />
                <RatioGauge
                  label="Margen de Utilidad"
                  value={razones.rendimiento.margenUtilidad}
                  format={fmtPct(razones.rendimiento.margenUtilidad)}
                  min={0} max={30}
                  ideal="> 10%"
                  color={razones.rendimiento.margenUtilidad > 10 ? '#22c55e' : razones.rendimiento.margenUtilidad > 5 ? '#f59e0b' : '#ef4444'}
                  tooltip={razones.rendimiento.margenUtilidad > 15 ? {
                    status: 'saludable',
                    title: `Margen neto de ${fmtPct(razones.rendimiento.margenUtilidad)} — alta rentabilidad operativa`,
                    explanation: `De cada $100 que vendes, te quedan $${razones.rendimiento.margenUtilidad.toFixed(1)} de utilidad neta después de todos los gastos, impuestos e intereses.`,
                    recommendation: 'Excelente margen. Protégelo manteniendo disciplina en gastos y monitorea que tu costo de ventas no crezca más rápido que tus ingresos.',
                  } : razones.rendimiento.margenUtilidad > 10 ? {
                    status: 'saludable',
                    title: `Margen neto de ${fmtPct(razones.rendimiento.margenUtilidad)} — competitivo`,
                    explanation: `Conservas ${razones.rendimiento.margenUtilidad.toFixed(1)} centavos de cada peso vendido. Es un margen saludable para empresas B2B en México.`,
                    recommendation: 'Mantén este nivel. Busca pequeñas eficiencias en gastos administrativos y negocia mejores términos con proveedores clave.',
                  } : razones.rendimiento.margenUtilidad > 5 ? {
                    status: 'precaución',
                    title: `Margen neto de ${fmtPct(razones.rendimiento.margenUtilidad)} — margen delgado`,
                    explanation: `Solo conservas ${razones.rendimiento.margenUtilidad.toFixed(1)} centavos por peso vendido. Un incremento en costos o una baja en ventas podría llevarte a pérdidas.`,
                    recommendation: 'Revisa tu estructura de costos línea por línea. Identifica gastos prescindibles, renegocia con proveedores, y evalúa si puedes subir precios sin perder clientes.',
                  } : {
                    status: 'riesgo',
                    title: `Margen neto de ${fmtPct(razones.rendimiento.margenUtilidad)} — crítico`,
                    explanation: `Tu utilidad neta es casi nula o negativa. La operación apenas cubre sus costos, sin dejar margen para crecimiento o contingencias.`,
                    recommendation: 'Revisión urgente: audita cada línea del estado de resultados. Elimina gastos no esenciales, renegocia deuda, y evalúa si necesitas ajustar tu modelo de precios.',
                  }}
                />
                <RatioGauge
                  label="Margen EBITDA"
                  value={razones.rendimiento.margenEbitda}
                  format={fmtPct(razones.rendimiento.margenEbitda)}
                  min={0} max={50}
                  ideal="> 20%"
                  color={razones.rendimiento.margenEbitda > 20 ? '#22c55e' : razones.rendimiento.margenEbitda > 10 ? '#f59e0b' : '#ef4444'}
                  tooltip={razones.rendimiento.margenEbitda > 25 ? {
                    status: 'saludable',
                    title: `EBITDA de ${fmtPct(razones.rendimiento.margenEbitda)} — operación muy eficiente`,
                    explanation: `Antes de intereses, impuestos, depreciación y amortización, conservas el ${razones.rendimiento.margenEbitda.toFixed(1)}% de tus ventas. Esto refleja una operación con buena estructura de costos.`,
                    recommendation: 'Excelente generación de flujo operativo. Este margen te da capacidad para servir deuda, invertir y distribuir utilidades simultáneamente.',
                  } : razones.rendimiento.margenEbitda > 15 ? {
                    status: 'saludable',
                    title: `EBITDA de ${fmtPct(razones.rendimiento.margenEbitda)} — generación de caja sana`,
                    explanation: `Tu operación genera ${razones.rendimiento.margenEbitda.toFixed(1)} centavos de flujo operativo por cada peso vendido. Es el indicador preferido por bancos para evaluar capacidad de pago.`,
                    recommendation: 'Buen nivel para acceder a crédito bancario. Si la diferencia entre EBITDA y utilidad neta es grande, revisa que tu carga financiera no sea excesiva.',
                  } : razones.rendimiento.margenEbitda > 10 ? {
                    status: 'precaución',
                    title: `EBITDA de ${fmtPct(razones.rendimiento.margenEbitda)} — generación moderada`,
                    explanation: `Tu flujo operativo antes de intereses e impuestos es modesto. Si tienes deuda significativa, este margen puede no ser suficiente para cubrirla cómodamente.`,
                    recommendation: 'Enfócate en mejorar la eficiencia operativa: automatiza procesos, reduce desperdicios, y negocia mejores precios de insumos.',
                  } : {
                    status: 'riesgo',
                    title: `EBITDA de ${fmtPct(razones.rendimiento.margenEbitda)} — generación insuficiente`,
                    explanation: `Tu operación genera muy poco flujo antes de cargos financieros. Esto limita severamente tu capacidad de pagar deuda, invertir y crecer.`,
                    recommendation: 'Reestructura operativa necesaria: reduce gastos fijos, evalúa si hay líneas de negocio deficitarias que debes eliminar, y busca incrementar volumen o precio.',
                  }}
                />
              </div>
            </div>

            {/* Summary Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="bg-gradient-to-br from-brand-ink to-brand-ink/90 rounded-2xl p-6 text-brand-paper"
            >
              <div className="flex items-center gap-3 mb-4">
                <Sparkles size={18} className="text-brand-gold" />
                <h3 className="font-serif text-lg tracking-tight">Diagnóstico Financiero</h3>
              </div>
              <div className="grid grid-cols-3 gap-6">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${razones.liquidez.razonCirculante >= 1.5 ? 'bg-green-400' : 'bg-amber-400'}`} />
                    <span className="text-[9px] uppercase tracking-[.15em] font-bold text-brand-paper/60">Liquidez</span>
                  </div>
                  <p className="text-[10px] text-brand-paper/80 leading-relaxed">
                    {razones.liquidez.razonCirculante >= 1.5
                      ? 'Posición sólida. La empresa tiene suficiente liquidez para cubrir sus obligaciones a corto plazo sin estrés financiero.'
                      : 'Posición ajustada. Considerar mejorar ciclo de cobro o reducir pasivos de corto plazo.'}
                  </p>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${razones.deuda.razonDeuda < 0.6 ? 'bg-green-400' : 'bg-amber-400'}`} />
                    <span className="text-[9px] uppercase tracking-[.15em] font-bold text-brand-paper/60">Deuda</span>
                  </div>
                  <p className="text-[10px] text-brand-paper/80 leading-relaxed">
                    {razones.deuda.razonDeuda < 0.6
                      ? 'Nivel de endeudamiento conservador. Hay margen para apalancamiento adicional si se requiere inversión.'
                      : 'Endeudamiento moderado-alto. Monitorear capacidad de pago y evitar compromisos adicionales sin plan de reducción.'}
                  </p>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${razones.rendimiento.roe > 15 ? 'bg-green-400' : 'bg-amber-400'}`} />
                    <span className="text-[9px] uppercase tracking-[.15em] font-bold text-brand-paper/60">Rendimiento</span>
                  </div>
                  <p className="text-[10px] text-brand-paper/80 leading-relaxed">
                    {razones.rendimiento.roe > 15
                      ? 'Rentabilidad atractiva. El retorno sobre capital justifica la operación y genera valor para accionistas.'
                      : 'Rentabilidad por debajo del benchmark. Explorar optimización de costos operativos o incremento de márgenes.'}
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* ═══════════════════ IMPORTAR ERP ═══════════════════ */}
        {activeSection === 'importar_erp' && (
          <motion.div
            key="importar_erp"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4 }}
            className="space-y-5"
          >
            {/* ── Top bar: connection + data-view nav ── */}
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-brand-sand/20 overflow-hidden">
              <div className="px-6 py-4 flex items-center justify-between gap-4">
                {/* ERP status pill */}
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-brand-gold/10 flex items-center justify-center">
                    <FolderSync size={18} className="text-brand-gold" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-brand-ink">Aspel COI · NOI · SAE</p>
                    <p className="text-[8px] text-brand-ink/30">v14.0 · 192.168.1.50:3306</p>
                  </div>
                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[8px] font-bold uppercase tracking-wider ml-2 ${
                    erpConnection.status === 'connected' ? 'bg-green-50 text-green-600' :
                    erpConnection.status === 'connecting' ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-400'
                  }`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${
                      erpConnection.status === 'connected' ? 'bg-green-400 animate-pulse' :
                      erpConnection.status === 'connecting' ? 'bg-amber-400 animate-spin' : 'bg-red-300'
                    }`} />
                    {erpConnection.status === 'connected' ? `Conectado · ${erpConnection.lastSync}` : erpConnection.status === 'connecting' ? 'Conectando...' : 'Desconectado'}
                  </div>
                </div>

                {/* Data-view tabs (only when connected) */}
                {erpConnection.status === 'connected' && (
                  <div className="flex gap-1 bg-brand-bone/50 p-1 rounded-xl">
                    {[
                      { id: 'home', icon: <UploadCloud size={12} />, label: 'Importar' },
                      { id: 'catalogo', icon: <ListChecks size={12} />, label: 'Catálogo' },
                      { id: 'polizas', icon: <FileText size={12} />, label: 'Pólizas' },
                      { id: 'activos', icon: <Building2 size={12} />, label: 'Activos Fijos' },
                    ].map(v => (
                      <button key={v.id} onClick={() => setErpDataView(v.id as any)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[8px] font-bold uppercase tracking-wider transition-all ${
                          erpDataView === v.id ? 'bg-brand-ink text-brand-paper shadow-sm' : 'text-brand-ink/40 hover:text-brand-ink'
                        }`}>
                        {v.icon} {v.label}
                      </button>
                    ))}
                  </div>
                )}

                {erpConnection.status !== 'connected' ? (
                  <button onClick={simulateConnect} disabled={erpConnection.status === 'connecting'}
                    className="px-4 py-2 bg-brand-ink text-brand-paper text-[9px] font-bold uppercase tracking-wider rounded-xl hover:bg-brand-ink/80 transition-all disabled:opacity-50">
                    Conectar ERP
                  </button>
                ) : (
                  <button onClick={() => { setErpConnection({ system: 'Aspel COI', status: 'disconnected' }); setErpDataView('home'); }}
                    className="px-4 py-2 bg-red-50 text-red-500 text-[9px] font-bold uppercase tracking-wider rounded-xl hover:bg-red-100 transition-all">
                    Desconectar
                  </button>
                )}
              </div>
            </div>

            <AnimatePresence mode="wait">

              {/* ────────────────── HOME: import actions + history ────────────────── */}
              {(erpDataView === 'home' || erpConnection.status !== 'connected') && (
                <motion.div key="home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-5">
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { icon: <ListChecks size={20} />, title: 'Catálogo de Cuentas', desc: 'Plan de cuentas con mapeo automático a NIF. Alimenta Balance General y Estado de Resultados.', records: '342 cuentas', action: () => { simulateImport('Catálogo de Cuentas', 342, 'Aspel COI v14.0 — 342 cuentas con mapeo NIF'); }, loading: importLoading === 'Catálogo de Cuentas', view: 'catalogo' },
                      { icon: <FileText size={20} />, title: 'Pólizas Contables', desc: 'Pólizas de diario, ingresos, egresos y cheques del período. Actualiza saldos del ER automáticamente.', records: '1,247 pólizas', action: () => { simulateImport('Pólizas Contables', 1247, 'Período Abr 2024 — 1,247 pólizas'); }, loading: importLoading === 'Pólizas Contables', view: 'polizas' },
                      { icon: <Building2 size={20} />, title: 'Saldos Activos Fijos', desc: 'Activos con costo de adquisición, depreciación acumulada y valor neto. Actualiza el Balance General.', records: '92 activos', action: () => { simulateImport('Saldos Activos Fijos', 92, 'Aspel COI — 92 activos fijos con depreciación'); }, loading: importLoading === 'Saldos Activos Fijos', view: 'activos' },
                    ].map((item, i) => (
                      <motion.div key={item.title} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                        className="bg-white/70 backdrop-blur-sm rounded-2xl border border-brand-sand/20 p-5 flex flex-col">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 rounded-xl bg-brand-bone flex items-center justify-center text-brand-gold">{item.icon}</div>
                          <div>
                            <h4 className="text-[11px] font-bold uppercase tracking-wider text-brand-ink">{item.title}</h4>
                            <p className="text-[8px] text-brand-ink/30">{item.records}</p>
                          </div>
                        </div>
                        <p className="text-[9px] text-brand-ink/50 leading-relaxed mb-3 flex-1">{item.desc}</p>
                        <div className="flex gap-2">
                          <button onClick={item.action} disabled={erpConnection.status !== 'connected' || !!importLoading}
                            className="flex-1 py-2 rounded-xl text-[9px] font-bold uppercase tracking-wider transition-all disabled:opacity-30 flex items-center justify-center gap-1.5 bg-brand-ink text-brand-paper hover:bg-brand-ink/80">
                            {item.loading ? <><Loader2 size={11} className="animate-spin" />Importando...</> : <><Download size={11} />Importar</>}
                          </button>
                          {erpConnection.status === 'connected' && (
                            <button onClick={() => setErpDataView(item.view as any)}
                              className="px-3 py-2 rounded-xl text-[9px] font-bold uppercase tracking-wider bg-brand-bone text-brand-ink hover:bg-brand-sand/40 transition-all">
                              Ver
                            </button>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-brand-sand/20 overflow-hidden">
                    <div className="px-6 py-4 border-b border-brand-sand/10 flex items-center justify-between">
                      <div>
                        <h3 className="text-[11px] font-bold uppercase tracking-wider text-brand-ink">Historial de Importaciones</h3>
                        <p className="text-[8px] text-brand-ink/30 mt-0.5">{importHistory.length} importaciones · registro inmutable</p>
                      </div>
                      <History size={14} className="text-brand-ink/20" />
                    </div>
                    <div className="divide-y divide-brand-sand/10">
                      {importHistory.map((imp, i) => (
                        <motion.div key={imp.id} initial={i === 0 ? { opacity: 0, x: -16 } : {}} animate={{ opacity: 1, x: 0 }}
                          className="px-6 py-3 flex items-center gap-4 hover:bg-brand-bone/30 transition-colors">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${imp.status === 'success' ? 'bg-green-50 text-green-500' : imp.status === 'partial' ? 'bg-amber-50 text-amber-500' : 'bg-red-50 text-red-500'}`}>
                            {imp.status === 'success' ? <CheckCircle2 size={13} /> : imp.status === 'partial' ? <AlertTriangle size={13} /> : <AlertCircle size={13} />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-brand-ink">{imp.type}</span>
                              <span className={`text-[7px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${imp.status === 'success' ? 'bg-green-50 text-green-600' : imp.status === 'partial' ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-500'}`}>
                                {imp.status === 'success' ? 'Completado' : imp.status === 'partial' ? 'Parcial' : 'Error'}
                              </span>
                            </div>
                            <p className="text-[8px] text-brand-ink/40 truncate">{imp.detail}</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="font-serif text-sm text-brand-ink">{imp.records.toLocaleString()}</p>
                            <p className="text-[7px] text-brand-ink/25 uppercase">registros</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-[8px] text-brand-ink/40">{imp.date}</p>
                            <p className="text-[7px] text-brand-ink/20 font-mono">{imp.id}</p>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ────────────────── CATÁLOGO DE CUENTAS ────────────────── */}
              {erpDataView === 'catalogo' && erpConnection.status === 'connected' && (
                <motion.div key="catalogo" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-serif text-xl tracking-tight text-brand-ink">Catálogo de Cuentas</h3>
                      <p className="text-[8px] uppercase tracking-[.2em] text-brand-ink/30 font-bold mt-0.5">Aspel COI v14.0 · {MOCK_CATALOGO.length} cuentas · NIF mapeadas</p>
                    </div>
                    <div className="relative">
                      <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-ink/30" />
                      <input value={catalogoFilter} onChange={e => setCatalogoFilter(e.target.value)} placeholder="Buscar cuenta o nombre..."
                        className="pl-8 pr-4 py-2 text-[10px] bg-white/70 border border-brand-sand/20 rounded-xl outline-none w-60" />
                    </div>
                  </div>

                  {/* Summary pills */}
                  <div className="flex gap-3">
                    {['Activo','Pasivo','Capital','Resultado'].map(clase => {
                      const items = MOCK_CATALOGO.filter(c => c.clase === clase);
                      const colors: Record<string,string> = { Activo: 'bg-blue-50 text-blue-600', Pasivo: 'bg-red-50 text-red-500', Capital: 'bg-green-50 text-green-600', Resultado: 'bg-amber-50 text-amber-600' };
                      return (
                        <div key={clase} className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[8px] font-bold uppercase tracking-wider ${colors[clase]}`}>
                          <span>{clase}</span>
                          <span className="opacity-60">{items.length} cuentas</span>
                        </div>
                      );
                    })}
                    <div className="ml-auto flex items-center gap-2 text-[8px] text-brand-ink/30 font-bold uppercase tracking-wider">
                      <CheckCircle2 size={12} className="text-green-400" />
                      {MOCK_CATALOGO.filter(c => c.mapeada).length} mapeadas a ER/BG
                    </div>
                  </div>

                  <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-brand-sand/20 overflow-hidden">
                    <div className="px-5 py-2.5 border-b border-brand-sand/10 grid grid-cols-12 gap-2 text-[7px] uppercase tracking-[.2em] font-bold text-brand-ink/30">
                      <span className="col-span-1">Cuenta</span>
                      <span className="col-span-4">Nombre</span>
                      <span className="col-span-1">Clase</span>
                      <span className="col-span-1">Tipo</span>
                      <span className="col-span-1">Niv.</span>
                      <span className="col-span-2 text-right">Saldo</span>
                      <span className="col-span-1">Destino</span>
                      <span className="col-span-1">Estado</span>
                    </div>
                    <div className="divide-y divide-brand-sand/5 max-h-[480px] overflow-y-auto">
                      {MOCK_CATALOGO.filter(c =>
                        catalogoFilter === '' ||
                        c.cuenta.includes(catalogoFilter) ||
                        c.nombre.toLowerCase().includes(catalogoFilter.toLowerCase())
                      ).map((c, i) => {
                        const claseColor: Record<string,string> = { Activo: 'text-blue-500', Pasivo: 'text-red-400', Capital: 'text-green-500', Resultado: 'text-amber-500' };
                        return (
                          <motion.div key={c.cuenta} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                            className={`px-5 py-2.5 grid grid-cols-12 gap-2 items-center hover:bg-brand-bone/30 transition-colors ${c.nivel === 1 ? 'bg-brand-bone/20' : ''}`}>
                            <span className={`col-span-1 font-mono text-[9px] font-bold ${c.nivel === 1 ? 'text-brand-ink' : 'text-brand-ink/50'}`}>{c.cuenta}</span>
                            <span className={`col-span-4 text-[10px] ${c.nivel === 1 ? 'font-bold text-brand-ink' : c.nivel === 2 ? 'font-semibold text-brand-ink/80 pl-3' : 'text-brand-ink/60 pl-6'}`}>{c.nombre}</span>
                            <span className={`col-span-1 text-[8px] font-bold uppercase ${claseColor[c.clase]}`}>{c.clase.slice(0,3)}</span>
                            <span className="col-span-1 text-[8px] text-brand-ink/40">{c.tipo === 'Acumulativa' ? 'Acum.' : 'Det.'}</span>
                            <span className="col-span-1 text-[9px] text-brand-ink/30 font-mono">{c.nivel}</span>
                            <span className={`col-span-2 text-right font-serif text-sm ${c.saldo < 0 ? 'text-red-500' : 'text-brand-ink'}`}>
                              {c.saldo < 0 ? `(${Math.abs(c.saldo).toLocaleString()})` : c.saldo.toLocaleString()}
                            </span>
                            <span className={`col-span-1 text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md w-fit ${c.destino === 'ER' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'}`}>{c.destino}</span>
                            <span className="col-span-1">
                              {c.mapeada
                                ? <CheckCircle2 size={12} className="text-green-400" />
                                : <AlertCircle size={12} className="text-amber-400" />}
                            </span>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="bg-brand-ink/5 rounded-2xl p-4 flex items-start gap-3">
                    <Sparkles size={14} className="text-brand-gold mt-0.5 flex-shrink-0" />
                    <p className="text-[9px] text-brand-ink/60 leading-relaxed">
                      Las cuentas marcadas como <strong className="text-brand-ink">ER</strong> alimentan automáticamente el <strong className="text-brand-ink">Estado de Resultados</strong> (ingresos y gastos).
                      Las marcadas <strong className="text-brand-ink">BG</strong> alimentan el <strong className="text-brand-ink">Balance General</strong> (activos, pasivos y capital).
                      Puedes modificar el mapeo para ajustar qué cuentas aparecen en cada estado financiero.
                    </p>
                  </div>
                </motion.div>
              )}

              {/* ────────────────── PÓLIZAS CONTABLES ────────────────── */}
              {erpDataView === 'polizas' && erpConnection.status === 'connected' && (
                <motion.div key="polizas" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h3 className="font-serif text-xl tracking-tight text-brand-ink">Pólizas Contables</h3>
                      <p className="text-[8px] uppercase tracking-[.2em] text-brand-ink/30 font-bold mt-0.5">Período Abril 2024 · {MOCK_POLIZAS.length} pólizas importadas</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <select value={polizasType} onChange={e => setPolizasType(e.target.value)}
                        className="text-[9px] px-3 py-2 rounded-xl border border-brand-sand/20 bg-white/70 outline-none">
                        {['Todos','Ingreso','Egreso','Diario'].map(t => <option key={t}>{t}</option>)}
                      </select>
                      <div className="relative">
                        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-ink/30" />
                        <input value={polizasFilter} onChange={e => setPolizasFilter(e.target.value)} placeholder="Buscar concepto o ref..."
                          className="pl-8 pr-4 py-2 text-[10px] bg-white/70 border border-brand-sand/20 rounded-xl outline-none w-56" />
                      </div>
                    </div>
                  </div>

                  {/* Summary */}
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'Total Ingresos', value: MOCK_POLIZAS.filter(p => p.tipo === 'Ingreso').reduce((s,p) => s + p.abono, 0), color: 'text-green-600' },
                      { label: 'Total Egresos', value: MOCK_POLIZAS.filter(p => p.tipo === 'Egreso').reduce((s,p) => s + p.cargo, 0), color: 'text-red-500' },
                      { label: 'Pólizas Diario', value: MOCK_POLIZAS.filter(p => p.tipo === 'Diario').length, color: 'text-brand-ink', suffix: 'pólizas' },
                    ].map((s,i) => (
                      <div key={i} className="bg-white/70 backdrop-blur-sm rounded-2xl border border-brand-sand/20 p-4">
                        <p className="text-[8px] uppercase tracking-[.2em] font-bold text-brand-ink/30">{s.label}</p>
                        <p className={`font-serif text-xl tracking-tight mt-1 ${s.color}`}>
                          {s.suffix ? s.value : `$${s.value.toLocaleString()}`}
                          {s.suffix && <span className="text-sm text-brand-ink/40 ml-1">{s.suffix}</span>}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-brand-sand/20 overflow-hidden">
                    <div className="px-5 py-2.5 border-b border-brand-sand/10 grid grid-cols-12 gap-2 text-[7px] uppercase tracking-[.2em] font-bold text-brand-ink/30">
                      <span className="col-span-1">ID</span>
                      <span className="col-span-1">Tipo</span>
                      <span className="col-span-1">Fecha</span>
                      <span className="col-span-4">Concepto</span>
                      <span className="col-span-1">Cuenta</span>
                      <span className="col-span-1 text-right">Cargo</span>
                      <span className="col-span-1 text-right">Abono</span>
                      <span className="col-span-1">Referencia</span>
                      <span className="col-span-1">Estado</span>
                    </div>
                    <div className="divide-y divide-brand-sand/5">
                      {MOCK_POLIZAS.filter(p =>
                        (polizasType === 'Todos' || p.tipo === polizasType) &&
                        (polizasFilter === '' || p.concepto.toLowerCase().includes(polizasFilter.toLowerCase()) || p.ref.toLowerCase().includes(polizasFilter.toLowerCase()))
                      ).map((p, i) => (
                        <motion.div key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                          onClick={() => setSelectedPoliza(selectedPoliza === p.id ? null : p.id)}
                          className="cursor-pointer">
                          <div className="px-5 py-2.5 grid grid-cols-12 gap-2 items-center hover:bg-brand-bone/30 transition-colors">
                            <span className="col-span-1 font-mono text-[8px] text-brand-ink/40">{p.id}</span>
                            <span className={`col-span-1 text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-md w-fit ${
                              p.tipo === 'Ingreso' ? 'bg-green-50 text-green-600' : p.tipo === 'Egreso' ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-500'
                            }`}>{p.tipo}</span>
                            <span className="col-span-1 text-[8px] text-brand-ink/50">{p.fecha}</span>
                            <span className="col-span-4 text-[9px] text-brand-ink/80 truncate">{p.concepto}</span>
                            <span className="col-span-1 font-mono text-[9px] text-brand-gold">{p.cuenta}</span>
                            <span className="col-span-1 text-right font-serif text-sm text-brand-ink/70">{p.cargo > 0 ? `$${p.cargo.toLocaleString()}` : '—'}</span>
                            <span className="col-span-1 text-right font-serif text-sm text-green-600">{p.abono > 0 ? `$${p.abono.toLocaleString()}` : '—'}</span>
                            <span className="col-span-1 font-mono text-[8px] text-brand-ink/40 truncate">{p.ref}</span>
                            <span className="col-span-1"><CheckCircle2 size={12} className="text-green-400" /></span>
                          </div>
                          {/* Expandable detail */}
                          <AnimatePresence>
                            {selectedPoliza === p.id && (
                              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                                className="px-5 pb-3 bg-brand-bone/30 overflow-hidden">
                                <div className="grid grid-cols-3 gap-4 pt-3">
                                  <div>
                                    <p className="text-[7px] uppercase tracking-[.2em] font-bold text-brand-ink/30 mb-1">Movimientos</p>
                                    <div className="space-y-1">
                                      <div className="flex justify-between text-[9px]">
                                        <span className="text-brand-ink/60">{p.cuenta} {p.tipo === 'Egreso' ? '(Cargo)' : '(Abono)'}</span>
                                        <span className="font-serif">${(p.cargo || p.abono).toLocaleString()}</span>
                                      </div>
                                      {p.cargo > 0 && p.abono > 0 && (
                                        <div className="flex justify-between text-[9px]">
                                          <span className="text-brand-ink/60">Cuenta complementaria</span>
                                          <span className="font-serif text-green-600">${p.abono.toLocaleString()}</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  <div>
                                    <p className="text-[7px] uppercase tracking-[.2em] font-bold text-brand-ink/30 mb-1">Referencia Fiscal</p>
                                    <p className="text-[9px] text-brand-ink/60">{p.ref}</p>
                                    <p className="text-[8px] text-brand-ink/30 mt-1">Período: {p.fecha.slice(0,7)}</p>
                                  </div>
                                  <div>
                                    <p className="text-[7px] uppercase tracking-[.2em] font-bold text-brand-ink/30 mb-1">Impacto en ER/BG</p>
                                    <p className="text-[9px] text-brand-ink/60">
                                      {p.cuenta.startsWith('4') ? '↑ Incrementa Ingresos en ER' :
                                       p.cuenta.startsWith('5') || p.cuenta.startsWith('6') ? '↑ Incrementa Gastos en ER' :
                                       p.cuenta.startsWith('1') ? '↔ Modifica Activo en BG' :
                                       p.cuenta.startsWith('2') ? '↔ Modifica Pasivo en BG' : '↔ Afecta Capital en BG'}
                                    </p>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-brand-ink/5 rounded-2xl p-4 flex items-start gap-3">
                    <Sparkles size={14} className="text-brand-gold mt-0.5 flex-shrink-0" />
                    <p className="text-[9px] text-brand-ink/60 leading-relaxed">
                      Cada póliza actualiza automáticamente los saldos del <strong className="text-brand-ink">Estado de Resultados</strong> y el <strong className="text-brand-ink">Balance General</strong>.
                      Haz clic en cualquier póliza para ver el detalle del movimiento y su impacto contable.
                    </p>
                  </div>
                </motion.div>
              )}

              {/* ────────────────── ACTIVOS FIJOS ────────────────── */}
              {erpDataView === 'activos' && erpConnection.status === 'connected' && (
                <motion.div key="activos" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-serif text-xl tracking-tight text-brand-ink">Saldos de Activos Fijos</h3>
                      <p className="text-[8px] uppercase tracking-[.2em] text-brand-ink/30 font-bold mt-0.5">Aspel COI v14.0 · {MOCK_ACTIVOS.length} activos · Método línea recta</p>
                    </div>
                  </div>

                  {/* KPI row */}
                  <div className="grid grid-cols-4 gap-3">
                    {[
                      { label: 'Costo Total Adquisición', value: `$${MOCK_ACTIVOS.reduce((s,a) => s+a.costoAdq,0).toLocaleString()}` },
                      { label: 'Dep. Acumulada Total', value: `$${MOCK_ACTIVOS.reduce((s,a) => s+a.depAcum,0).toLocaleString()}`, sub: 'aplicada al período' },
                      { label: 'Valor Neto Total', value: `$${MOCK_ACTIVOS.reduce((s,a) => s+a.valorNeto,0).toLocaleString()}`, sub: 'en BG' },
                      { label: 'Sin Clasificar', value: MOCK_ACTIVOS.filter(a => a.metodo === 'Pendiente').length, sub: 'activos pendientes', color: 'text-amber-500' },
                    ].map((k,i) => (
                      <div key={i} className="bg-white/70 backdrop-blur-sm rounded-2xl border border-brand-sand/20 p-4">
                        <p className="text-[8px] uppercase tracking-[.2em] font-bold text-brand-ink/30">{k.label}</p>
                        <p className={`font-serif text-xl tracking-tight mt-1 ${(k as any).color || 'text-brand-ink'}`}>{k.value}</p>
                        {k.sub && <p className="text-[7px] text-brand-ink/25 mt-0.5">{k.sub}</p>}
                      </div>
                    ))}
                  </div>

                  <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-brand-sand/20 overflow-hidden">
                    <div className="px-5 py-2.5 border-b border-brand-sand/10 grid grid-cols-12 gap-2 text-[7px] uppercase tracking-[.2em] font-bold text-brand-ink/30">
                      <span className="col-span-1">Cuenta</span>
                      <span className="col-span-3">Activo</span>
                      <span className="col-span-1">Categoría</span>
                      <span className="col-span-1 text-right">Costo Adq.</span>
                      <span className="col-span-1 text-right">Dep. Anual</span>
                      <span className="col-span-1 text-right">Dep. Acum.</span>
                      <span className="col-span-1 text-right">Valor Neto</span>
                      <span className="col-span-2">Vida Útil</span>
                      <span className="col-span-1">Método</span>
                    </div>
                    <div className="divide-y divide-brand-sand/5">
                      {MOCK_ACTIVOS.map((a, i) => {
                        const pctDepreciado = (a.depAcum / a.costoAdq) * 100;
                        return (
                          <motion.div key={a.cuenta} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}
                            className="px-5 py-3 grid grid-cols-12 gap-2 items-center hover:bg-brand-bone/30 transition-colors">
                            <span className="col-span-1 font-mono text-[8px] text-brand-ink/40">{a.cuenta}</span>
                            <div className="col-span-3">
                              <p className="text-[10px] font-bold text-brand-ink leading-tight">{a.nombre}</p>
                              <p className="text-[7px] text-brand-ink/30">{a.ubicacion}</p>
                            </div>
                            <span className={`col-span-1 text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-md w-fit ${a.categoria === 'Mobiliario' ? 'bg-purple-50 text-purple-500' : 'bg-blue-50 text-blue-500'}`}>
                              {a.categoria === 'Mobiliario' ? 'Mob.' : 'Cómp.'}
                            </span>
                            <span className="col-span-1 text-right font-serif text-sm text-brand-ink">${a.costoAdq.toLocaleString()}</span>
                            <span className="col-span-1 text-right font-serif text-sm text-brand-ink/50">${a.depAnual.toLocaleString()}</span>
                            <span className="col-span-1 text-right font-serif text-sm text-red-400">${a.depAcum.toLocaleString()}</span>
                            <span className="col-span-1 text-right font-serif text-sm font-bold text-brand-ink">${a.valorNeto.toLocaleString()}</span>
                            <div className="col-span-2">
                              <div className="flex items-center gap-1.5 mb-1">
                                <span className="text-[8px] text-brand-ink/50">{a.vidaRestante.toFixed(1)} / {a.vidaUtil} años</span>
                              </div>
                              <div className="w-full h-1.5 bg-brand-sand/20 rounded-full overflow-hidden">
                                <motion.div initial={{ width: 0 }} animate={{ width: `${pctDepreciado}%` }} transition={{ duration: 1, delay: i * 0.05 }}
                                  className={`h-full rounded-full ${pctDepreciado > 70 ? 'bg-red-400' : pctDepreciado > 40 ? 'bg-amber-400' : 'bg-green-400'}`} />
                              </div>
                              <span className="text-[7px] text-brand-ink/25">{pctDepreciado.toFixed(0)}% depreciado</span>
                            </div>
                            <span className={`col-span-1 text-[8px] font-bold ${a.metodo === 'Pendiente' ? 'text-amber-500' : 'text-brand-ink/40'}`}>
                              {a.metodo === 'Pendiente' ? '⚠ Pendiente' : 'L. Recta'}
                            </span>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="bg-brand-ink/5 rounded-2xl p-4 flex items-start gap-3">
                    <Sparkles size={14} className="text-brand-gold mt-0.5 flex-shrink-0" />
                    <p className="text-[9px] text-brand-ink/60 leading-relaxed">
                      El <strong className="text-brand-ink">Valor Neto</strong> de todos los activos ($1,670,000) se refleja automáticamente en el <strong className="text-brand-ink">Balance General → Activo Fijo</strong>.
                      La <strong className="text-brand-ink">Depreciación Anual</strong> alimenta el <strong className="text-brand-ink">Estado de Resultados → cuenta 5002</strong>.
                      Los activos marcados en <span className="text-amber-500 font-bold">amarillo</span> requieren clasificación antes del cierre mensual.
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

// ─── FiscalAuditDashboard ─────────────────────────────────────────────────────
// Aviso visual para paneles que todavía corren sobre servicios simulados en
// memoria (no persisten en el backend). Ver docs/auditoria-modulos.md para el
// detalle de qué está conectado a la API real y qué sigue en modo demo.
function DemoModeNotice({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2.5 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-[10px] font-bold uppercase tracking-widest text-amber-700">
      <Info size={13} className="flex-shrink-0" />
      {label} — datos simulados, no persisten en el backend
    </div>
  );
}

function FiscalAuditDashboard() {
  const [ledger, setLedger] = React.useState<FiscalAuditEvent[]>(DualLoggerService.getLedger());
  const [trails, setTrails] = React.useState<Record<string, FiscalAuditEvent[]>>(DualLoggerService.getTrails());
  const [activeSection, setActiveSection] = React.useState<'diot' | 'erp' | 'rep_motor' | 'pagos_globales' | 'factoraje'>('rep_motor');
  const [filter, setFilter] = React.useState('');
  const [isInjecting, setIsInjecting] = React.useState(false);
  const [lastInjected, setLastInjected] = React.useState<string | null>(null);

  React.useEffect(() => {
    const handler: AuditSubscriber = (l, t) => { setLedger([...l]); setTrails({ ...t }); };
    DualLoggerService.subscribe(handler);
    return () => DualLoggerService.unsubscribe(handler);
  }, []);

  const handleInjectTest = () => {
    setIsInjecting(true);
    setTimeout(() => {
      const evt = DualLoggerService.logFiscalEvent({
        provider_id: 'PROV-001',
        provider_name: 'Logística Global SA',
        event_type: 'REP',
        cfdi_uuid: `TEST-${Date.now().toString(36).toUpperCase()}`,
        amount: Math.floor(Math.random() * 50000) + 5000,
        storage_url: '/docs/test_rep.pdf',
        status: 'Reportado al SAT',
      });
      setLastInjected(evt.id);
      setIsInjecting(false);
    }, 800);
  };

  const EVENT_CONFIG: Record<FiscalAuditEvent['event_type'], { label: string; color: string; bg: string }> = {
    REP:             { label: 'REP',           color: 'text-blue-600',   bg: 'bg-blue-50 border-blue-200' },
    DIOT:            { label: 'DIOT',          color: 'text-purple-600', bg: 'bg-purple-50 border-purple-200' },
    PAGO_GLOBAL:     { label: 'Pago Global',   color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200' },
    ERP_SYNC:        { label: 'ERP Sync',      color: 'text-teal-600',   bg: 'bg-teal-50 border-teal-200' },
    CFDI_TIMBRADO:   { label: 'CFDI',          color: 'text-brand-gold', bg: 'bg-brand-gold/10 border-brand-gold/30' },
    PAGO_EFECTUADO:  { label: 'Pago',          color: 'text-green-600',  bg: 'bg-green-50 border-green-200' },
  };

  const STATUS_STYLES: Record<FiscalAuditEvent['status'], string> = {
    'Reportado al SAT': 'bg-green-100 text-green-700',
    'Pendiente SAT':    'bg-yellow-100 text-yellow-700',
    'Sincronizado ERP': 'bg-teal-100 text-teal-700',
    'Error':            'bg-red-100 text-red-700',
  };

  const filtered = ledger.filter(e =>
    filter === '' ||
    e.provider_name.toLowerCase().includes(filter.toLowerCase()) ||
    e.cfdi_uuid.toLowerCase().includes(filter.toLowerCase()) ||
    e.event_type.toLowerCase().includes(filter.toLowerCase())
  );

  const byType = (type: FiscalAuditEvent['event_type']) => filtered.filter(e => e.event_type === type);

  const sections = [
    { id: 'rep_motor',      label: 'Motor REP PPD',      icon: <Activity size={14} /> },
    { id: 'diot',            label: 'DIOT',               icon: <Database size={14} /> },
    { id: 'factoraje',       label: 'Anticipos',          icon: <DollarSign size={14} /> },
    { id: 'erp',             label: 'Conectividad ERP',   icon: <Webhook size={14} /> },
    { id: 'pagos_globales',  label: 'Pagos Globales',     icon: <Layers size={14} /> },
  ] as const;

  return (
    <div className="space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <span className="label-caps mb-2 block">Registro Dual Inmutable</span>
          <h2 className="text-4xl font-serif text-brand-ink">Auditoría Fiscal</h2>
          <p className="text-sm text-brand-ink/40 font-serif mt-1">
            Trazabilidad completa de REPs, DIOT, Pagos Globales y Sincronización ERP reportados al SAT.
          </p>
        </div>

        {/* Stats row */}
        <div className="flex gap-3 flex-wrap">
          {(['REP', 'DIOT', 'PAGO_GLOBAL', 'ERP_SYNC'] as FiscalAuditEvent['event_type'][]).map(type => (
            <div key={type} className={`px-4 py-2.5 rounded-2xl border text-center min-w-[80px] ${EVENT_CONFIG[type].bg}`}>
              <p className={`text-[18px] font-bold font-serif ${EVENT_CONFIG[type].color}`}>{byType(type).length}</p>
              <p className={`text-[8px] uppercase font-bold tracking-widest ${EVENT_CONFIG[type].color} opacity-70`}>{EVENT_CONFIG[type].label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        {/* Section tabs */}
        <div className="flex gap-2 p-1 bg-brand-bone border border-brand-sand/30 rounded-2xl w-fit flex-wrap">
          {sections.map(s => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${
                activeSection === s.id
                  ? 'bg-brand-ink text-brand-bone shadow-lg shadow-brand-ink/20'
                  : 'text-brand-ink/40 hover:text-brand-ink hover:bg-white'
              }`}
            >
              {s.icon}{s.label}
            </button>
          ))}
        </div>

        <div className="flex gap-3 items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 opacity-30 text-brand-ink" size={14} />
            <input
              value={filter}
              onChange={e => setFilter(e.target.value)}
              placeholder="Buscar proveedor, UUID, tipo..."
              className="pl-9 pr-4 py-2.5 bg-white border border-brand-sand rounded-xl text-xs focus:outline-none focus:border-brand-gold shadow-sm w-64"
            />
          </div>
          <button
            onClick={() => {
              // Generate executive audit summary and download
              const lines: string[] = [];
              lines.push('═══════════════════════════════════════════');
              lines.push('    RESUMEN EJECUTIVO DE AUDITORÍA FISCAL');
              lines.push('    Royáltica — Plataforma de Orquestación');
              lines.push(`    Generado: ${new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}`);
              lines.push('═══════════════════════════════════════════');
              lines.push('');
              lines.push(`Total de eventos registrados: ${ledger.length}`);
              lines.push('');
              (['REP', 'DIOT', 'PAGO_GLOBAL', 'ERP_SYNC'] as FiscalAuditEvent['event_type'][]).forEach(type => {
                const items = ledger.filter(e => e.event_type === type);
                const total = items.reduce((s, e) => s + e.amount, 0);
                lines.push(`[${type}] ${items.length} eventos — Total: $${total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`);
              });
              lines.push('');
              lines.push('─── Detalle por Proveedor ───');
              const byProvider = new Map<string, FiscalAuditEvent[]>();
              ledger.forEach(e => {
                const list = byProvider.get(e.provider_name) || [];
                list.push(e);
                byProvider.set(e.provider_name, list);
              });
              byProvider.forEach((events, name) => {
                const total = events.reduce((s, e) => s + e.amount, 0);
                lines.push(`  ${name}: ${events.length} eventos, $${total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`);
              });
              lines.push('');
              lines.push('═══ FIN DEL RESUMEN ═══');

              const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `Resumen_Auditoria_${new Date().toISOString().split('T')[0]}.txt`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
            }}
            className="flex items-center gap-2 px-5 py-2.5 bg-brand-ink text-brand-bone rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-brand-ink/90 transition-all shadow-sm"
          >
            <Printer size={14} /> Resumen Ejecutivo
          </button>
          <button
            onClick={handleInjectTest}
            disabled={isInjecting}
            className="flex items-center gap-2 px-5 py-2.5 bg-brand-gold text-brand-ink rounded-xl text-[10px] font-bold uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-sm disabled:opacity-60"
          >
            {isInjecting
              ? <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }} className="w-3.5 h-3.5 border-2 border-brand-ink/30 border-t-brand-ink rounded-full" />
              : <ArrowUpRight size={14} />
            }
            Inyectar Log de Prueba
          </button>
        </div>
      </div>

      {/* Last injected notification */}
      <AnimatePresence>
        {lastInjected && (
          <motion.div
            key={lastInjected}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-3 px-5 py-3 bg-green-50 border border-green-200 rounded-2xl text-sm text-green-700"
          >
            <CheckCircle2 size={16} className="text-green-600 flex-shrink-0" />
            <span>Log <strong>{lastInjected}</strong> inyectado y registrado en ambas pestañas (Ledger Maestro + Expediente del proveedor en Configuración).</span>
            <button onClick={() => setLastInjected(null)} className="ml-auto text-green-400 hover:text-green-600"><X size={14} /></button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Data Table or New Panel */}
      {activeSection === 'rep_motor' ? (
        <div className="space-y-6">
          <RepRegistrationPanel />
          <DemoModeNotice label="Vista previa · Motor de riesgo REP" />
          <REPMotorPanel />
        </div>
      ) : activeSection === 'pagos_globales' ? (
        <div className="space-y-4">
          <DemoModeNotice label="Vista previa · Pagos Globales" />
          <PagosGlobalesPanel />
        </div>
      ) : activeSection === 'diot' ? (
        <DiotCompilerPanel />
      ) : activeSection === 'factoraje' ? (
        <FactorajeCorporativoPanel />
      ) : activeSection === 'erp' ? (
        <div className="space-y-4">
          <DemoModeNotice label="Vista previa · Conectividad ERP (el conector real está en Stub, ver Configuración → ERP)" />
          <ConectividadERPPanel />
        </div>
      ) : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function FinancingView({ invoices, routePayment, totalBudget }: { invoices: Invoice[], routePayment: (id: string, route: 'cash' | 'fintech') => void, totalBudget: number }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('all');
  // ─── New: Factoraje Simulator ───
  const [showSimulator, setShowSimulator] = useState(false);
  const [simTasa, setSimTasa] = useState(3.5);
  const [simDays, setSimDays] = useState(30);
  const [simAmount, setSimAmount] = useState(500000);
  // ─── New: Route Comparator ───
  const [showComparator, setShowComparator] = useState(false);
  const [comparatorAmount, setComparatorAmount] = useState(300000);
  // ─── New: Gerencial Approval Tracking ───
  const [pendingApprovals, setPendingApprovals] = useState<{invoiceId: string; amount: number; status: 'pending' | 'approved' | 'rejected'; date: string}[]>([]);
  // ─── New: Factoraje Request Status ───
  const [factorajeRequests, setFactorajeRequests] = useState<{id: string; invoiceId: string; provider: string; amount: number; status: 'enviada' | 'en_revision' | 'aprobada' | 'fondos_recibidos'; date: string}[]>([
    { id: 'FR-001', invoiceId: 'FAC-2024-0891', provider: 'Logística Global SA', amount: 245000, status: 'fondos_recibidos', date: '2024-03-15' },
    { id: 'FR-002', invoiceId: 'FAC-2024-0934', provider: 'TechParts MX', amount: 180000, status: 'aprobada', date: '2024-03-22' },
    { id: 'FR-003', invoiceId: 'FAC-2024-1002', provider: 'Industrias del Norte', amount: 520000, status: 'en_revision', date: '2024-04-01' },
  ]);
  // ─── New: View Mode ───
  const [viewMode, setViewMode] = useState<'routing' | 'simulator' | 'history'>('routing');
  const [showSolicitudes, setShowSolicitudes] = useState(false);

  // ─── Fintech Usage History (mock data) ───
  const fintechHistory = [
    { mes: 'Nov', operaciones: 3, monto: 420000 },
    { mes: 'Dic', operaciones: 5, monto: 680000 },
    { mes: 'Ene', operaciones: 2, monto: 310000 },
    { mes: 'Feb', operaciones: 7, monto: 890000 },
    { mes: 'Mar', operaciones: 4, monto: 560000 },
    { mes: 'Abr', operaciones: 6, monto: 745000 },
  ];

  const GERENCIAL_THRESHOLD = 500000; // Montos > $500k requieren aprobación gerencial

  const eligibleInvoices = invoices.filter(inv => {
    const isNotPaid = inv.status !== 'paid' && inv.status !== 'rejected';
    const matchesSearch = inv.id.toLowerCase().includes(searchTerm.toLowerCase()) || inv.provider.toLowerCase().includes(searchTerm.toLowerCase());
    const priority = getPriorityInfo(inv.date);
    const matchesPriority = priorityFilter === 'all' || priority.label === priorityFilter;
    return isInvoiceFullyValidated(inv) && isNotPaid && matchesSearch && matchesPriority;
  });

  // Factoraje cost calculation
  const calcFactorajeCost = (amount: number, tasa: number, days: number) => {
    const dailyRate = tasa / 100 / 360;
    const cost = amount * dailyRate * days;
    const netAmount = amount - cost;
    return { cost, netAmount, effectiveRate: (cost / amount) * 100 };
  };

  const simResult = calcFactorajeCost(simAmount, simTasa, simDays);

  // Route payment with gerencial check
  const handleRoutePayment = (id: string, route: 'cash' | 'fintech') => {
    const inv = invoices.find(i => i.id === id);
    if (inv && route === 'fintech' && inv.amount > GERENCIAL_THRESHOLD) {
      setPendingApprovals(prev => [...prev, { invoiceId: id, amount: inv.amount, status: 'pending', date: new Date().toISOString() }]);
      // Add to factoraje requests
      setFactorajeRequests(prev => [...prev, { id: `FR-${String(prev.length + 4).padStart(3, '0')}`, invoiceId: id, provider: inv.provider, amount: inv.amount, status: 'enviada', date: new Date().toISOString().split('T')[0] }]);
      return;
    }
    if (route === 'fintech') {
      setFactorajeRequests(prev => [...prev, { id: `FR-${String(prev.length + 4).padStart(3, '0')}`, invoiceId: id, provider: inv?.provider || '', amount: inv?.amount || 0, status: 'aprobada', date: new Date().toISOString().split('T')[0] }]);
    }
    routePayment(id, route);
  };

  const FACTORAJE_STATUS_CONFIG: Record<string, { label: string; badge: string; icon: string }> = {
    'enviada': { label: 'Enviada', badge: 'bg-blue-100 text-blue-700 border-blue-200', icon: '📤' },
    'en_revision': { label: 'En Revisión', badge: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: '🔍' },
    'aprobada': { label: 'Aprobada', badge: 'bg-green-100 text-green-700 border-green-200', icon: '✅' },
    'fondos_recibidos': { label: 'Fondos Recibidos', badge: 'bg-teal-100 text-teal-700 border-teal-200', icon: '💰' },
  };

  return (
    <div className="flex flex-col pb-12">
      {/* Header with view mode tabs */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="p-2.5 bg-brand-gold/10 rounded-xl shadow-sm">
            <Zap size={20} className="text-brand-gold" />
          </div>
          <h2 className="text-2xl font-serif text-brand-ink">Factoraje Estratégico</h2>
        </div>

        <div className="flex gap-2 p-1 bg-brand-bone border border-brand-sand/30 rounded-2xl">
          {([
            { id: 'routing', label: 'Routing', icon: <ArrowRightLeft size={12} /> },
            { id: 'simulator', label: 'Simulador', icon: <Calculator size={12} /> },
            { id: 'history', label: 'Historial', icon: <History size={12} /> },
          ] as const).map(tab => (
            <button key={tab.id} onClick={() => setViewMode(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${
                viewMode === tab.id ? 'bg-brand-ink text-brand-bone shadow-lg' : 'text-brand-ink/40 hover:text-brand-ink'
              }`}
            >{tab.icon}{tab.label}</button>
          ))}
        </div>
      </div>

      {/* ═══ VIEW: Routing (original + enhancements) ═══ */}
      {viewMode === 'routing' && (
        <>
          {/* Search and Filters */}
          <div className="flex flex-wrap gap-2 mb-4">
            <div className="relative flex-1 md:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 opacity-30 text-brand-ink" size={14} />
              <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Buscar por ID o Proveedor..."
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-brand-sand/50 rounded-xl text-[11px] focus:outline-none focus:border-brand-gold shadow-sm" />
            </div>
            <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}
              className="px-4 py-2.5 bg-white border border-brand-sand/50 rounded-xl text-[10px] uppercase font-bold tracking-wider shadow-sm cursor-pointer outline-none focus:border-brand-gold">
              <option value="all">Prioridad: Todas</option>
              <option value="Baja">Baja</option>
              <option value="Media">Media</option>
              <option value="Media Alta">Media Alta</option>
              <option value="Urgente">Urgente</option>
            </select>
            <button onClick={() => setShowComparator(!showComparator)}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-brand-ink text-brand-bone rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-brand-ink/90 transition-all">
              <Scale size={14} /> Comparar Rutas
            </button>
          </div>

          {/* ─── Route Comparator Panel ─── */}
          <AnimatePresence>
            {showComparator && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden mb-4">
                <div className="editorial-card !p-6 space-y-4 border-brand-gold/30">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-brand-ink flex items-center gap-2"><Scale size={16} className="text-brand-gold" /> Comparador de Rutas de Pago</h3>
                    <button onClick={() => setShowComparator(false)} className="p-1 hover:bg-brand-bone rounded-lg"><X size={14} /></button>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] uppercase font-bold tracking-widest text-brand-ink/40">Monto:</span>
                    <input type="number" value={comparatorAmount} onChange={e => setComparatorAmount(Number(e.target.value))}
                      className="px-3 py-2 border border-brand-sand/50 rounded-xl text-sm font-serif w-48 focus:outline-none focus:border-brand-gold" />
                  </div>
                  <div className="overflow-x-auto rounded-xl border border-brand-sand/20">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-brand-bone/50">
                        <tr>
                          {['Ruta', 'Costo', 'Tiempo de Liquidación', 'Monto Neto', 'Requiere Aprobación'].map(h => (
                            <th key={h} className="px-4 py-3 text-[9px] uppercase tracking-widest font-bold text-brand-ink/40">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-brand-sand/10">
                        {(() => {
                          const factCost = calcFactorajeCost(comparatorAmount, 3.5, 30);
                          return [
                            { route: 'Caja Propia', cost: '$0', time: '1-2 días hábiles', net: CURRENCY_FORMATTER.format(comparatorAmount), approval: comparatorAmount > GERENCIAL_THRESHOLD ? 'Sí (Gerencial)' : 'No', highlight: comparatorAmount <= 200000 },
                            { route: 'Fintech (Factoraje)', cost: CURRENCY_FORMATTER.format(factCost.cost), time: '24-48 horas', net: CURRENCY_FORMATTER.format(factCost.netAmount), approval: comparatorAmount > GERENCIAL_THRESHOLD ? 'Sí (Gerencial)' : 'No', highlight: comparatorAmount > 200000 && comparatorAmount <= 500000 },
                            { route: 'Financiamiento Externo', cost: CURRENCY_FORMATTER.format(comparatorAmount * 0.06), time: '5-10 días hábiles', net: CURRENCY_FORMATTER.format(comparatorAmount * 0.94), approval: 'Sí (CEO + Gerencial)', highlight: comparatorAmount > 500000 },
                          ].map(r => (
                            <tr key={r.route} className={`transition-colors ${r.highlight ? 'bg-brand-gold/5' : 'hover:bg-white'}`}>
                              <td className="px-4 py-3 font-bold text-brand-ink flex items-center gap-2">
                                {r.highlight && <span className="w-2 h-2 bg-brand-gold rounded-full" />}
                                {r.route}
                              </td>
                              <td className="px-4 py-3 font-serif">{r.cost}</td>
                              <td className="px-4 py-3">{r.time}</td>
                              <td className="px-4 py-3 font-serif font-bold">{r.net}</td>
                              <td className="px-4 py-3">
                                <span className={`px-2 py-1 rounded-full text-[8px] font-bold ${r.approval === 'No' ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700'}`}>{r.approval}</span>
                              </td>
                            </tr>
                          ));
                        })()}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-[9px] text-brand-ink/30 font-sans">* La ruta recomendada se resalta con el indicador dorado. Montos &gt; {CURRENCY_FORMATTER.format(GERENCIAL_THRESHOLD)} requieren aprobación gerencial.</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ─── Pending Gerencial Approvals Banner ─── */}
          {pendingApprovals.filter(a => a.status === 'pending').length > 0 && (
            <div className="mb-4 p-4 bg-orange-50 border border-orange-200 rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Shield size={18} className="text-orange-600" />
                <div>
                  <p className="text-sm font-bold text-orange-800">{pendingApprovals.filter(a => a.status === 'pending').length} factura(s) pendientes de aprobación gerencial</p>
                  <p className="text-[10px] text-orange-600">Montos superiores a {CURRENCY_FORMATTER.format(GERENCIAL_THRESHOLD)} requieren autorización</p>
                </div>
              </div>
              <div className="flex gap-2">
                {pendingApprovals.filter(a => a.status === 'pending').map(a => (
                  <div key={a.invoiceId} className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-orange-700">{a.invoiceId} ({CURRENCY_FORMATTER.format(a.amount)})</span>
                    <button onClick={() => {
                      setPendingApprovals(prev => prev.map(p => p.invoiceId === a.invoiceId ? { ...p, status: 'approved' } : p));
                      setFactorajeRequests(prev => prev.map(r => r.invoiceId === a.invoiceId ? { ...r, status: 'en_revision' } : r));
                      routePayment(a.invoiceId, 'fintech');
                    }} className="px-3 py-1 bg-green-600 text-white rounded-lg text-[9px] font-bold uppercase hover:bg-green-700 transition-all">Aprobar</button>
                    <button onClick={() => setPendingApprovals(prev => prev.map(p => p.invoiceId === a.invoiceId ? { ...p, status: 'rejected' } : p))}
                      className="px-3 py-1 bg-red-100 text-red-700 rounded-lg text-[9px] font-bold uppercase hover:bg-red-200 transition-all">Rechazar</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Invoice Cards Grid */}
          <div className="border border-brand-sand/40 rounded-[2.5rem] bg-brand-bone/10 flex flex-col shadow-inner backdrop-blur-sm mb-6">
            {eligibleInvoices.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center p-12 opacity-30">
                <ShieldCheck size={48} className="mb-4 opacity-10" />
                <p className="font-serif text-2xl text-brand-ink">Bandeja Vacía</p>
                <p className="text-[10px] uppercase font-bold tracking-[0.2em] mt-2">Sólo las facturas auditadas al 100% aparecen aquí.</p>
              </div>
            ) : (
              <div className="p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-2">
                  {eligibleInvoices.map(inv => {
                    const rec = getAIRecommendation(inv, totalBudget);
                    const priorityInfo = getPriorityInfo(inv.date);
                    const needsGerencial = inv.amount > GERENCIAL_THRESHOLD;

                    return (
                      <motion.div key={inv.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                        className="editorial-card !p-0 overflow-hidden flex flex-col group hover:shadow-xl transition-all duration-500 border-brand-sand/30 bg-white/95">
                        <div className="p-6 space-y-4">
                          <div className="flex justify-between items-start">
                            <div className="space-y-1 flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                {(() => {
                                  const s = inv.signatures || 0;
                                  const pct = s >= 2 ? 100 : s === 1 ? 90 : 80;
                                  return <span className={`px-1.5 py-0.5 text-[7px] font-black uppercase tracking-widest rounded border ${pct === 100 ? 'bg-green-50 text-green-600 border-green-100' : 'bg-yellow-50 text-yellow-600 border-yellow-100'}`}>{pct}% Auditada</span>;
                                })()}
                                <div className={`w-1.5 h-1.5 rounded-full ${priorityInfo.color}`} />
                                <span className={`text-[8px] font-bold uppercase tracking-widest ${priorityInfo.text}`}>{priorityInfo.label}</span>
                                {needsGerencial && <span className="px-1.5 py-0.5 bg-orange-50 text-orange-600 text-[7px] font-black uppercase tracking-widest rounded border border-orange-100">Req. Gerencial</span>}
                              </div>
                              <h3 className="text-xl font-serif text-brand-ink leading-tight">{inv.id}</h3>
                              <p className="text-[9px] text-brand-ink/40 font-bold uppercase tracking-widest truncate max-w-[140px]">{inv.provider}</p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="text-xl font-bold text-brand-ink tracking-tighter">{CURRENCY_FORMATTER.format(inv.amount)}</p>
                              <p className="text-[8px] opacity-30 font-bold uppercase mt-0.5">{inv.date}</p>
                            </div>
                          </div>

                          <div className={`p-4 rounded-2xl border flex items-start gap-4 transition-all ${rec.strategy === 'fintech' ? 'bg-brand-ink text-brand-paper border-brand-ink shadow-md translate-y-[-2px]' : 'bg-brand-gold/5 border-brand-gold/20'}`}>
                            <div className={`mt-0.5 p-2 rounded-lg flex-shrink-0 ${rec.strategy === 'fintech' ? 'bg-brand-gold text-brand-ink' : 'bg-brand-ink text-brand-paper'}`}>
                              <Cpu size={14} />
                            </div>
                            <div className="min-h-[44px] flex flex-col justify-center">
                              <p className="text-[8px] uppercase font-black tracking-widest mb-1.5 leading-none">{rec.label}</p>
                              <p className="text-[11px] font-serif leading-relaxed opacity-80">{inv.aiRecommendation || rec.reason}</p>
                            </div>
                          </div>
                        </div>

                        <div className="bg-brand-bone/30 border-t border-brand-sand/10 p-3 flex gap-2">
                          <button onClick={() => handleRoutePayment(inv.id, 'cash')}
                            className={`flex-1 py-3.5 rounded-xl text-[9px] uppercase font-black tracking-widest transition-all ${rec.strategy === 'cash' ? 'bg-brand-gold text-brand-ink shadow-sm' : 'bg-white border border-brand-sand/40 text-brand-ink/30 hover:text-brand-ink'}`}>
                            Caja Propia
                          </button>
                          <button onClick={() => handleRoutePayment(inv.id, 'fintech')}
                            className={`flex-1 py-3.5 rounded-xl text-[9px] uppercase font-black tracking-widest transition-all ${rec.strategy === 'fintech' ? 'bg-brand-gold text-brand-ink shadow-sm' : 'bg-brand-ink text-brand-paper hover:bg-brand-ink/90'}`}>
                            {needsGerencial ? '🔒 Factoraje (Gerencial)' : 'Factoraje'}
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Factoraje Request Status - Toggle Button */}
          {factorajeRequests.length > 0 && !showSolicitudes && (
            <div className="mb-6">
              <button onClick={() => setShowSolicitudes(true)}
                className="flex items-center gap-3 px-6 py-4 bg-white border border-brand-sand/40 rounded-2xl hover:border-brand-gold hover:shadow-lg transition-all w-full group">
                <div className="p-2 bg-brand-gold/10 rounded-xl group-hover:bg-brand-gold/20 transition-all">
                  <CreditCard size={16} className="text-brand-gold" />
                </div>
                <div className="text-left flex-1">
                  <p className="text-sm font-bold text-brand-ink">Estado de Solicitudes de Factoraje</p>
                  <p className="text-[9px] text-brand-ink/40 uppercase tracking-wider">{factorajeRequests.length} solicitudes activas</p>
                </div>
                <ChevronRight size={16} className="text-brand-ink/20 group-hover:text-brand-gold transition-all" />
              </button>
            </div>
          )}

          {/* Factoraje Request Status - Full Panel */}
          <AnimatePresence>
            {showSolicitudes && factorajeRequests.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="fixed inset-0 z-50 flex items-center justify-center p-8 bg-brand-ink/30 backdrop-blur-md">
                <div className="bg-brand-bone rounded-[2rem] shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col border border-brand-sand/50 overflow-hidden">
                  <div className="px-8 py-6 bg-white border-b border-brand-sand/20 flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-brand-gold/10 rounded-xl">
                        <CreditCard size={18} className="text-brand-gold" />
                      </div>
                      <div>
                        <p className="text-lg font-bold font-serif text-brand-ink">Estado de Solicitudes de Factoraje</p>
                        <p className="text-[9px] text-brand-ink/40 uppercase tracking-wider">{factorajeRequests.length} solicitudes registradas</p>
                      </div>
                    </div>
                    <button onClick={() => setShowSolicitudes(false)} className="p-2 hover:bg-brand-bone rounded-xl transition-all">
                      <X size={18} className="text-brand-ink/40" />
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-brand-bone/50 sticky top-0 backdrop-blur-md">
                        <tr>
                          {['ID', 'Factura', 'Proveedor', 'Monto', 'Estado', 'Fecha'].map(h => (
                            <th key={h} className="px-6 py-4 text-[9px] uppercase tracking-widest font-bold text-brand-ink/40">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-brand-sand/10">
                        {factorajeRequests.map(req => {
                          const st = FACTORAJE_STATUS_CONFIG[req.status];
                          return (
                            <tr key={req.id} className="hover:bg-brand-gold/5 transition-colors">
                              <td className="px-6 py-4 font-mono font-bold text-brand-ink">{req.id}</td>
                              <td className="px-6 py-4 font-mono text-brand-ink/60">{req.invoiceId}</td>
                              <td className="px-6 py-4">{req.provider}</td>
                              <td className="px-6 py-4 font-serif font-bold">{CURRENCY_FORMATTER.format(req.amount)}</td>
                              <td className="px-6 py-4">
                                <span className={`px-2.5 py-1 rounded-full text-[8px] font-bold uppercase tracking-wider border ${st.badge}`}>
                                  {st.icon} {st.label}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-brand-ink/40">{req.date}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      {/* ═══ VIEW: Simulador de Factoraje ═══ */}
      {viewMode === 'simulator' && (
        <div className="flex-1 overflow-y-auto space-y-6 pb-8">
          {/* Simulator Card */}
          <div className="editorial-card !p-8 space-y-6 border-brand-gold/30">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2.5 bg-brand-gold/10 rounded-xl"><Calculator size={20} className="text-brand-gold" /></div>
              <div>
                <h3 className="text-xl font-serif text-brand-ink">Simulador de Costo de Factoraje</h3>
                <p className="text-[10px] text-brand-ink/40 uppercase tracking-widest">Calcula el costo real antes de solicitar</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold tracking-widest text-brand-ink/40">Monto de Factura</label>
                <input type="number" value={simAmount} onChange={e => setSimAmount(Number(e.target.value))}
                  className="w-full px-4 py-3 border border-brand-sand/50 rounded-xl text-lg font-serif focus:outline-none focus:border-brand-gold" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold tracking-widest text-brand-ink/40">Tasa Anual (%)</label>
                <input type="number" step="0.1" value={simTasa} onChange={e => setSimTasa(Number(e.target.value))}
                  className="w-full px-4 py-3 border border-brand-sand/50 rounded-xl text-lg font-serif focus:outline-none focus:border-brand-gold" />
                <input type="range" min="1" max="12" step="0.1" value={simTasa} onChange={e => setSimTasa(Number(e.target.value))}
                  className="w-full accent-brand-gold" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold tracking-widest text-brand-ink/40">Plazo (días)</label>
                <input type="number" value={simDays} onChange={e => setSimDays(Number(e.target.value))}
                  className="w-full px-4 py-3 border border-brand-sand/50 rounded-xl text-lg font-serif focus:outline-none focus:border-brand-gold" />
                <div className="flex gap-2">
                  {[15, 30, 45, 60, 90].map(d => (
                    <button key={d} onClick={() => setSimDays(d)} className={`px-3 py-1 rounded-lg text-[9px] font-bold transition-all ${simDays === d ? 'bg-brand-ink text-brand-bone' : 'bg-brand-bone text-brand-ink/40 hover:text-brand-ink'}`}>{d}d</button>
                  ))}
                </div>
              </div>
            </div>

            {/* Results */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-brand-sand/20">
              <div className="bg-red-50 rounded-2xl p-6 border border-red-100 text-center">
                <p className="text-[9px] uppercase font-bold tracking-widest text-red-400 mb-1">Costo del Factoraje</p>
                <p className="text-3xl font-serif text-red-600">{CURRENCY_FORMATTER.format(simResult.cost)}</p>
                <p className="text-[10px] text-red-400 mt-1">{simResult.effectiveRate.toFixed(3)}% efectivo</p>
              </div>
              <div className="bg-green-50 rounded-2xl p-6 border border-green-100 text-center">
                <p className="text-[9px] uppercase font-bold tracking-widest text-green-400 mb-1">Monto Neto a Recibir</p>
                <p className="text-3xl font-serif text-green-700">{CURRENCY_FORMATTER.format(simResult.netAmount)}</p>
                <p className="text-[10px] text-green-400 mt-1">Depósito en 24-48 hrs</p>
              </div>
              <div className="bg-brand-gold/10 rounded-2xl p-6 border border-brand-gold/20 text-center">
                <p className="text-[9px] uppercase font-bold tracking-widest text-brand-gold/60 mb-1">Tasa Diaria</p>
                <p className="text-3xl font-serif text-brand-ink">{(simTasa / 360).toFixed(4)}%</p>
                <p className="text-[10px] text-brand-ink/40 mt-1">{CURRENCY_FORMATTER.format(simResult.cost / simDays)} / día</p>
              </div>
            </div>

            {simAmount > GERENCIAL_THRESHOLD && (
              <div className="flex items-center gap-3 px-5 py-3 bg-orange-50 border border-orange-200 rounded-2xl">
                <Shield size={16} className="text-orange-600" />
                <p className="text-[11px] text-orange-700">Este monto supera el umbral de {CURRENCY_FORMATTER.format(GERENCIAL_THRESHOLD)} y requerirá <strong>aprobación gerencial</strong> antes de procesarse.</p>
              </div>
            )}
          </div>

          {/* Route Comparator integrated */}
          <div className="editorial-card !p-6 space-y-4">
            <h3 className="text-sm font-bold text-brand-ink flex items-center gap-2"><Scale size={16} className="text-brand-gold" /> Comparación de Rutas para {CURRENCY_FORMATTER.format(simAmount)}</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { label: 'Caja Propia', cost: 0, time: '1-2 días', color: 'bg-green-50 border-green-200', textColor: 'text-green-700' },
                { label: 'Factoraje', cost: simResult.cost, time: '24-48 hrs', color: 'bg-brand-gold/10 border-brand-gold/30', textColor: 'text-brand-ink' },
                { label: 'Financiamiento Externo', cost: simAmount * 0.06, time: '5-10 días', color: 'bg-red-50 border-red-200', textColor: 'text-red-700' },
              ].map(r => (
                <div key={r.label} className={`rounded-2xl p-5 border ${r.color} space-y-2`}>
                  <p className="text-[9px] uppercase font-bold tracking-widest text-brand-ink/40">{r.label}</p>
                  <p className={`text-2xl font-serif ${r.textColor}`}>-{CURRENCY_FORMATTER.format(r.cost)}</p>
                  <p className="text-[10px] text-brand-ink/40">Liquidación: {r.time}</p>
                  <p className="text-sm font-bold font-serif text-brand-ink">Neto: {CURRENCY_FORMATTER.format(simAmount - r.cost)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══ VIEW: Historial Fintech ═══ */}
      {viewMode === 'history' && (
        <div className="flex-1 overflow-y-auto space-y-6 pb-8">
          {/* Monthly Usage Chart */}
          <div className="editorial-card !p-6 space-y-4">
            <h3 className="text-sm font-bold text-brand-ink flex items-center gap-2"><BarChart3 size={16} className="text-brand-gold" /> Uso Mensual de Fintech</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={fintechHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e0d8" />
                  <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                  <RechartsTooltip formatter={(value: number) => CURRENCY_FORMATTER.format(value)} />
                  <Bar dataKey="monto" fill="#c9a84c" radius={[8, 8, 0, 0]} name="Monto Factoraje" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-3 gap-4 pt-2">
              <div className="text-center">
                <p className="text-2xl font-serif text-brand-ink">{fintechHistory.reduce((s, m) => s + m.operaciones, 0)}</p>
                <p className="text-[9px] uppercase tracking-widest text-brand-ink/40 font-bold">Operaciones Totales</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-serif text-brand-ink">{CURRENCY_FORMATTER.format(fintechHistory.reduce((s, m) => s + m.monto, 0))}</p>
                <p className="text-[9px] uppercase tracking-widest text-brand-ink/40 font-bold">Monto Total</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-serif text-brand-ink">{CURRENCY_FORMATTER.format(Math.round(fintechHistory.reduce((s, m) => s + m.monto, 0) / fintechHistory.length))}</p>
                <p className="text-[9px] uppercase tracking-widest text-brand-ink/40 font-bold">Promedio Mensual</p>
              </div>
            </div>
          </div>

          {/* Operations per month detail */}
          <div className="editorial-card !p-6 space-y-4">
            <h3 className="text-sm font-bold text-brand-ink flex items-center gap-2"><History size={16} className="text-brand-gold" /> Detalle por Mes</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {fintechHistory.map(m => (
                <div key={m.mes} className="bg-white rounded-2xl p-4 border border-brand-sand/30 space-y-2 hover:shadow-md transition-all">
                  <p className="text-[10px] uppercase font-bold tracking-widest text-brand-ink/40">{m.mes}</p>
                  <p className="text-xl font-serif text-brand-ink">{CURRENCY_FORMATTER.format(m.monto)}</p>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-brand-gold/10 text-brand-gold text-[9px] font-bold rounded-full">{m.operaciones} ops</span>
                    <span className="text-[9px] text-brand-ink/30">prom. {CURRENCY_FORMATTER.format(Math.round(m.monto / m.operaciones))}/op</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Factoraje Requests History */}
          <div className="editorial-card !p-0 overflow-hidden border-brand-sand/40">
            <div className="px-6 py-4 bg-white border-b border-brand-sand/20">
              <p className="text-sm font-bold text-brand-ink flex items-center gap-2"><FileText size={14} className="text-brand-gold" /> Historial de Solicitudes</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-brand-bone/50">
                  <tr>
                    {['ID', 'Factura', 'Proveedor', 'Monto', 'Estado', 'Fecha'].map(h => (
                      <th key={h} className="px-4 py-3 text-[9px] uppercase tracking-widest font-bold text-brand-ink/40">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-sand/10">
                  {factorajeRequests.map(req => {
                    const st = FACTORAJE_STATUS_CONFIG[req.status];
                    return (
                      <tr key={req.id} className="hover:bg-brand-gold/5 transition-colors">
                        <td className="px-4 py-3 font-mono font-bold">{req.id}</td>
                        <td className="px-4 py-3 font-mono text-brand-ink/60">{req.invoiceId}</td>
                        <td className="px-4 py-3">{req.provider}</td>
                        <td className="px-4 py-3 font-serif font-bold">{CURRENCY_FORMATTER.format(req.amount)}</td>
                        <td className="px-4 py-3"><span className={`px-2.5 py-1 rounded-full text-[8px] font-bold uppercase tracking-wider border ${st.badge}`}>{st.icon} {st.label}</span></td>
                        <td className="px-4 py-3 text-brand-ink/40">{req.date}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProviderFactorajeView({ supplier, invoices, capitalAmount, requests, onRequest, message }: {
  supplier: Supplier; invoices: Invoice[]; capitalAmount: number;
  requests: FactorajeItem[];
  onRequest: (invoiceId: string, amount?: number) => Promise<void>;
  message: { ok: boolean; text: string } | null;
}) {
  const patrimony = capitalAmount;

  // Estado de la solicitud en curso (para deshabilitar el botón mientras se envía).
  const [requesting, setRequesting] = useState<string | null>(null);
  const doRequest = async (invoiceId: string) => {
    setRequesting(invoiceId);
    await onRequest(invoiceId);
    setRequesting(null);
  };
  // Facturas APROBADAS sin solicitud de anticipo activa = elegibles.
  const activeReqInvoiceIds = new Set(
    requests.filter(r => r.status === 'PENDING' || r.status === 'APPROVED' || r.status === 'DISBURSED').map(r => r.invoiceId),
  );
  const eligible = invoices.filter(i => i.status === 'approved' && isRealId(i.id) && !activeReqInvoiceIds.has(i.id));
  const FACTORAJE_STATUS: Record<FactorajeItem['status'], { label: string; cls: string }> = {
    PENDING: { label: 'Pendiente', cls: 'bg-amber-50 text-amber-700' },
    APPROVED: { label: 'Aprobada', cls: 'bg-blue-50 text-blue-700' },
    DISBURSED: { label: 'Dispersada', cls: 'bg-green-50 text-green-700' },
    REJECTED: { label: 'Rechazada', cls: 'bg-red-50 text-red-600' },
  };

  const paid = invoices.filter(i => i.status === 'paid');
  const pending = invoices.filter(i => i.status !== 'paid');

  const totalPaid = paid.reduce((s, i) => s + i.amount, 0);
  const totalPending = pending.reduce((s, i) => s + i.amount, 0);
  const totalReceivable = totalPaid + totalPending;

  // Average payment days: mock calculation based on invoice date distance from reference
  const refDate = new Date('2024-04-27');
  const avgPayDays = paid.length > 0
    ? Math.round(paid.reduce((s, inv) => {
        const invDate = new Date(inv.date);
        const diff = Math.abs(refDate.getTime() - invDate.getTime()) / (1000 * 60 * 60 * 24);
        return s + Math.min(diff, 60);
      }, 0) / paid.length)
    : 28;

  // Liquidity health: how much of patrimony is covered vs outstanding receivables
  const liquidityRatio = patrimony > 0 ? Math.min(((patrimony - totalPending) / patrimony) * 100, 100) : 0;
  const healthScore = Math.max(liquidityRatio, 0);
  const healthLabel = healthScore >= 70 ? 'Saludable' : healthScore >= 40 ? 'Moderada' : 'Comprometida';
  const healthColor = healthScore >= 70 ? 'bg-green-500' : healthScore >= 40 ? 'bg-yellow-400' : 'bg-red-500';
  const healthTextColor = healthScore >= 70 ? 'text-green-700' : healthScore >= 40 ? 'text-yellow-700' : 'text-red-700';
  const healthBg = healthScore >= 70 ? 'bg-green-50/60 border-green-200' : healthScore >= 40 ? 'bg-yellow-50/60 border-yellow-200' : 'bg-red-50/60 border-red-200';
  const recommendFactoraje = healthScore < 65 || avgPayDays > 25;

  // Monthly receivables trend — derived from actual invoice dates
  const MONTHS_MAP: Record<string, { label: string; start: Date; end: Date }> = {
    'Nov': { label: 'Nov', start: new Date('2023-11-01'), end: new Date('2023-11-30') },
    'Dic': { label: 'Dic', start: new Date('2023-12-01'), end: new Date('2023-12-31') },
    'Ene': { label: 'Ene', start: new Date('2024-01-01'), end: new Date('2024-01-31') },
    'Feb': { label: 'Feb', start: new Date('2024-02-01'), end: new Date('2024-02-29') },
    'Mar': { label: 'Mar', start: new Date('2024-03-01'), end: new Date('2024-03-31') },
    'Abr': { label: 'Abr', start: new Date('2024-04-01'), end: new Date('2024-04-30') },
  };
  const monthlyData = Object.values(MONTHS_MAP).map(({ label, start, end }) => {
    const monthInvoices = invoices.filter(inv => {
      const d = new Date(inv.date);
      return d >= start && d <= end;
    });
    const cobrado = monthInvoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.amount, 0);
    const pendiente = monthInvoices.filter(i => i.status !== 'paid' && i.status !== 'rejected').reduce((s, i) => s + i.amount, 0);
    return { mes: label, cobrado, pendiente };
  });

  return (
    <div className="space-y-10">
      {/* Header */}
      <div>
        <span className="label-caps !text-brand-gold !text-[9px]">Análisis Financiero</span>
        <h2 className="text-4xl font-bold text-brand-ink tracking-tight mt-1">Factoraje & Liquidez</h2>
        <p className="text-sm text-brand-ink/40 mt-1">Salud financiera basada en tu capital y cuentas por cobrar.</p>
      </div>

      {/* ═══ Solicitar anticipo (factoraje real) ═══ */}
      <div className="editorial-card !p-7 space-y-5 border border-brand-gold/20">
        <div className="flex items-center justify-between">
          <div>
            <span className="label-caps !text-brand-gold !text-[9px]">Liquidez Anticipada</span>
            <h3 className="text-xl font-serif text-brand-ink mt-1">Solicitar Anticipo</h3>
          </div>
          <Zap size={20} className="text-brand-gold" />
        </div>

        {message && (
          <div className={`text-[11px] rounded-xl px-4 py-2.5 ${message.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>{message.text}</div>
        )}

        {/* Facturas elegibles (aprobadas, sin solicitud activa) */}
        <div>
          <p className="text-[9px] uppercase tracking-widest text-brand-ink/30 font-bold mb-2">Facturas elegibles · aprobadas</p>
          {eligible.length === 0 ? (
            <p className="text-[11px] text-brand-ink/40 bg-brand-bone/40 rounded-xl px-4 py-3">No tienes facturas aprobadas disponibles para anticipo en este momento. El factoraje solo aplica a facturas ya autorizadas por el corporativo.</p>
          ) : (
            <div className="space-y-2">
              {eligible.map(inv => (
                <div key={inv.id} className="flex items-center gap-4 bg-white/70 rounded-xl px-4 py-3 border border-brand-sand/20">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-brand-ink truncate">{inv.poNumber || inv.cfdiUUID?.slice(0, 8) || inv.id}</p>
                    <p className="text-[10px] text-brand-ink/40">{CURRENCY_FORMATTER.format(inv.amount)} · anticipa ~{CURRENCY_FORMATTER.format(inv.amount * 0.965)}</p>
                  </div>
                  <button onClick={() => doRequest(inv.id)} disabled={requesting === inv.id}
                    className="px-4 py-2 bg-brand-gold text-white rounded-xl text-[9px] font-bold uppercase tracking-wider hover:bg-brand-gold/80 transition-all disabled:opacity-40 flex items-center gap-1.5">
                    {requesting === inv.id ? <><Loader2 size={12} className="animate-spin" /> Enviando</> : 'Solicitar'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Mis solicitudes (reales del backend) */}
        {requests.length > 0 && (
          <div>
            <p className="text-[9px] uppercase tracking-widest text-brand-ink/30 font-bold mb-2">Mis solicitudes</p>
            <div className="space-y-2">
              {requests.map(r => (
                <div key={r.id} className="flex items-center gap-4 bg-white/50 rounded-xl px-4 py-3 border border-brand-sand/15">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-brand-ink truncate">Factura {r.invoiceFolio}</p>
                    <p className="text-[10px] text-brand-ink/40">Solicitado {CURRENCY_FORMATTER.format(r.requestedAmount)} · neto {CURRENCY_FORMATTER.format(r.netAmount)} (comisión {CURRENCY_FORMATTER.format(r.fee)})</p>
                  </div>
                  <span className={`text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${FACTORAJE_STATUS[r.status].cls}`}>{FACTORAJE_STATUS[r.status].label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="editorial-card !p-8 space-y-3">
          <span className="label-caps !opacity-40 !text-[9px]">Capital</span>
          <p className="text-3xl font-serif text-brand-ink">{CURRENCY_FORMATTER.format(patrimony)}</p>
          <p className="text-[9px] uppercase tracking-wider text-brand-ink/30">{supplier.seniorityYears} años de operación</p>
        </div>
        <div className="editorial-card !p-8 space-y-3">
          <span className="label-caps !opacity-40 !text-[9px]">Por Cobrar (Pendiente)</span>
          <p className="text-3xl font-serif text-orange-600">{CURRENCY_FORMATTER.format(totalPending)}</p>
          <p className="text-[9px] uppercase tracking-wider text-brand-ink/30">{pending.length} factura{pending.length !== 1 ? 's' : ''} en proceso</p>
        </div>
        <div className="editorial-card !p-8 space-y-3">
          <span className="label-caps !opacity-40 !text-[9px]">Plazo Promedio de Pago</span>
          <p className="text-3xl font-serif text-brand-ink">{avgPayDays} días</p>
          <p className="text-[9px] uppercase tracking-wider text-brand-ink/30">{totalPaid > 0 ? `${paid.length} facturas liquidadas` : 'Sin histórico pagado'}</p>
        </div>
      </div>

      {/* Liquidity health bar */}
      <div className={`rounded-[2rem] p-8 border ${healthBg} space-y-5`}>
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Activity size={16} className={healthTextColor} />
            <span className="text-[9px] uppercase tracking-widest font-bold text-brand-ink/60">Barra de Salud de Liquidez</span>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-sm font-black font-serif ${healthTextColor}`}>{healthScore.toFixed(0)}%</span>
            <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${healthTextColor} ${healthBg} border`}>{healthLabel}</span>
          </div>
        </div>

        {/* Bar */}
        <div className="space-y-2">
          <div className="w-full bg-brand-sand/40 rounded-full h-4 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${healthScore}%` }}
              transition={{ duration: 1, ease: 'easeOut', delay: 0.2 }}
              className={`h-full rounded-full ${healthColor} shadow-inner`}
            />
          </div>
          <div className="flex justify-between text-[9px] text-brand-ink/30 uppercase tracking-wider">
            <span>Comprometida</span>
            <span>Moderada</span>
            <span>Saludable</span>
          </div>
        </div>

        {/* Breakdown */}
        <div className="grid grid-cols-2 gap-4 pt-2">
          <div className="bg-white/60 rounded-2xl p-4 space-y-1">
            <p className="text-[9px] uppercase tracking-wider text-brand-ink/40 font-bold">Capital Base</p>
            <p className="font-serif text-lg text-brand-ink">{CURRENCY_FORMATTER.format(patrimony)}</p>
          </div>
          <div className="bg-white/60 rounded-2xl p-4 space-y-1">
            <p className="text-[9px] uppercase tracking-wider text-brand-ink/40 font-bold">C × C Pendiente</p>
            <p className="font-serif text-lg text-orange-600">{CURRENCY_FORMATTER.format(totalPending)}</p>
          </div>
        </div>

        <p className={`text-[11px] leading-relaxed ${healthTextColor}`}>
          {healthScore >= 70
            ? `Tu liquidez es sólida. Tu capital cubre con holgura tus cuentas por cobrar. No es urgente usar factoraje, aunque puede acelerar tu flujo de efectivo.`
            : healthScore >= 40
            ? `Liquidez moderada. Tienes ${CURRENCY_FORMATTER.format(totalPending)} pendientes de cobrar que presionan tu capital. Considera factoraje para las facturas de mayor monto.`
            : `Liquidez comprometida. Las cuentas por cobrar representan una proporción alta de tu capital. Se recomienda activar factoraje para mantener operación sin interrupciones.`}
        </p>
      </div>

      {/* Avg payment term detail */}
      <div className="bg-white/40 backdrop-blur-md rounded-[2rem] p-8 border border-brand-sand/30 space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-xl font-serif text-brand-ink">Plazo de Cobro Histórico</h3>
            <p className="text-[9px] uppercase tracking-widest text-brand-ink/30 mt-0.5">Días promedio que tarda Royáltica en liquidarte</p>
          </div>
          <div className={`px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-wider ${avgPayDays <= 20 ? 'bg-green-100 text-green-700' : avgPayDays <= 35 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
            {avgPayDays <= 20 ? 'Óptimo' : avgPayDays <= 35 ? 'Aceptable' : 'Demorado'}
          </div>
        </div>

        <div className="flex items-end gap-4">
          <div className="text-6xl font-serif text-brand-ink">{avgPayDays}</div>
          <div className="pb-2 space-y-0.5">
            <p className="text-sm font-bold text-brand-ink/60">días promedio</p>
            <p className="text-[9px] uppercase tracking-wider text-brand-ink/30">de emisión a liquidación</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Mejor plazo registrado', value: `${Math.max(avgPayDays - 8, 7)} días`, color: 'text-green-700' },
            { label: 'Plazo promedio', value: `${avgPayDays} días`, color: 'text-brand-ink' },
            { label: 'Peor plazo registrado', value: `${avgPayDays + 12} días`, color: 'text-red-600' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-brand-bone/60 rounded-2xl p-4 space-y-1">
              <p className="text-[8px] uppercase tracking-wider text-brand-ink/30 font-bold">{label}</p>
              <p className={`font-serif text-base ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Factoraje recommendation banner */}
      {recommendFactoraje && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-brand-ink rounded-[2rem] p-8 text-brand-paper space-y-4 relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-brand-gold" />
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-brand-gold rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
              <Zap size={18} className="text-brand-ink" />
            </div>
            <div className="space-y-1">
              <span className="label-caps !text-brand-gold !text-[9px]">Recomendación Royáltica</span>
              <h4 className="text-xl font-serif text-brand-paper">Activa Factoraje para mejorar tu liquidez</h4>
              <p className="text-[11px] text-brand-paper/60 leading-relaxed max-w-lg">
                Con un plazo promedio de {avgPayDays} días y {CURRENCY_FORMATTER.format(totalPending)} en cuentas por cobrar, puedes adelantar el cobro de tus facturas aprobadas a través de factoraje. Sin costo de adhesión para proveedores calificados.
              </p>
            </div>
          </div>
          <div className="flex gap-3 pl-14">
            <button className="px-6 py-3 bg-brand-gold text-brand-ink rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-gold/90 transition-all">
              Solicitar Factoraje
            </button>
            <button className="px-6 py-3 border border-brand-paper/20 text-brand-paper/60 rounded-xl text-[10px] font-black uppercase tracking-widest hover:border-brand-paper/40 transition-all">
              Más Información
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}

// Pagos REALES del proveedor (registros de Payment del backend, no derivados).
function ProviderPaymentsReal() {
  const [payments, setPayments] = useState<import('./services/apiClient.ts').ProviderPayment[]>([]);
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

function ProviderDashboard({ user, supplier, onLogout, onBackToRole }: { user: FirebaseUser, supplier: Supplier, onLogout: () => void, onBackToRole: () => void }) {
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
  const [kycDocs, setKycDocs] = useState<import('./services/apiClient.ts').ProviderDocument[]>([]);
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
function ProviderInvoicesViewNew({ invoices, getHumanStatus, calcAnticipo, onDispute, onFactoraje }: {
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

function ImportInvoicesModal({ onClose }: { onClose: () => void }) {
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

function SchedulePaymentModal({ onClose }: { onClose: () => void }) {
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
