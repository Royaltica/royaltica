/**
 * Servicios simulados (en memoria) que todavía no están conectados al backend
 * real: auditoría fiscal dual-ledger, autorizadores, Motor REP, Pagos
 * Globales, Webhooks/ERP sync, mensajería proveedor↔corporativo, y
 * aclaraciones de factura. Extraído de App.tsx (Fase C de
 * docs/plan-division-apptsx.md) — sin cambios de comportamiento, solo
 * ubicación.
 *
 * Igual que en Fase B, cualquier panel que consuma estos servicios debe
 * mostrar el aviso `DemoModeNotice` ("vista previa, datos simulados") — estos
 * datos NO persisten en Postgres.
 */
import { api } from './apiClient.ts';
import { MOCK_SUPPLIERS } from '../types.ts';
import type { DiotRow, DiotReport } from '../lib/diot.ts';

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
export type AuditSubscriber = (ledger: FiscalAuditEvent[], trails: Record<string, FiscalAuditEvent[]>) => void;
const _auditSubscribers: AuditSubscriber[] = [];

export const DualLoggerService = {
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

export const CEO_KEY = '123';

let _authorizers: Authorizer[] = [
  { id: 'AUTH-CEO', name: 'Director General', cargo: 'CEO', email: 'ceo@royaltica.com', type: 'ceo' },
];

type AuthSubscriber = (list: Authorizer[]) => void;
const _authSubscribers: AuthSubscriber[] = [];
const _notifyAuth = () => _authSubscribers.forEach(cb => cb([..._authorizers]));

export const AuthorizerService = {
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

export const REPMotorService = {
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

export const BankTxService = {
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

/** Código muerto sin consumidores (ver docs/plan-division-apptsx.md, Fase B) — se conserva tal cual hasta decidir si se elimina o se reactiva. */
export const DiotService = {
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

export const WebhookERPService = {
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
export type SupplierMessage = {
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

export const SupplierMessageService = {
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
export type InvoiceClarification = {
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
export const ClarificationService = {
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
