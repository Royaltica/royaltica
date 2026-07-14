/**
 * Cliente HTTP del backend Royáltica (NestJS en :8080).
 *
 * Todas las llamadas pasan por el proxy de Vite (/api/* → backend), así que
 * no hay problemas de CORS. El JWT se guarda en localStorage y se adjunta
 * automáticamente en cada petición protegida.
 *
 * Incluye los "mappers" que traducen la forma del backend (Decimal→number,
 * status en MAYÚSCULAS, supplier anidado) al tipo `Invoice`/`Supplier` que ya
 * usa la UI, para no tener que reescribir las pantallas.
 */
import type { Invoice, Supplier } from '../types';

const TOKEN_KEY = 'royaltica_jwt';
const BASE = '/api';

/**
 * Las facturas reales del backend usan UUID; los mocks usan ids como
 * "FAC-01-P1". Solo deben mandarse al backend las que tienen UUID real,
 * para no provocar 400/404. Si el backend estaba vacío y quedaron mocks,
 * las mutaciones siguen siendo locales (degradación elegante).
 */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isRealId = (id: string): boolean => UUID_RE.test(id);

// ── Sesión (JWT) ───────────────────────────────────────────

export const getToken = (): string | null => localStorage.getItem(TOKEN_KEY);
export const setToken = (t: string): void => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = (): void => localStorage.removeItem(TOKEN_KEY);

// ── Núcleo de peticiones ───────────────────────────────────

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  explicitToken?: string | null,
): Promise<T> {
  // Si se pasa un token explícito (p. ej. el del Portal del Proveedor), se usa
  // ese y NO se toca la sesión corporativa de localStorage.
  const usingExplicit = explicitToken !== undefined;
  const token = usingExplicit ? explicitToken : getToken();
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  if (!res.ok) {
    let message = `Error ${res.status}`;
    try {
      const data = await res.json();
      message = data.message ?? message;
    } catch {
      /* respuesta sin JSON */
    }
    if (res.status === 401 && !usingExplicit) clearToken();
    throw new Error(Array.isArray(message) ? message.join(', ') : message);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

/**
 * Descarga un endpoint que devuelve CSV (text/csv) adjuntando el JWT y
 * disparando la descarga en el navegador. `request()` no sirve porque parsea
 * JSON; aquí leemos el texto crudo y creamos un blob descargable.
 */
async function downloadCsv(path: string, filename: string): Promise<void> {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  if (!res.ok) {
    let message = `Error ${res.status}`;
    try {
      const d = await res.json();
      message = d.message ?? message;
    } catch {
      /* sin JSON */
    }
    throw new Error(Array.isArray(message) ? message.join(', ') : message);
  }
  const text = await res.text();
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Tipos del backend (los campos que consumimos) ──────────

export interface ApiUser {
  id: string;
  email: string;
  name: string;
  role: 'CORPORATE_ADMIN' | 'CORPORATE_USER' | 'PROVIDER' | 'SUPERADMIN';
  organizationId: string | null;
  permissions: string[];
  supplierId: string | null;
  avatarUrl: string | null;
  totpEnabled?: boolean;
}

interface ApiAuthResult {
  accessToken: string;
  expiresIn: string;
  user: ApiUser;
  /** Presentes cuando la cuenta tiene 2FA activo: falta el código TOTP. */
  twoFactorRequired?: true;
  tempToken?: string;
}

export interface LoginResult {
  user: ApiUser;
  twoFactorRequired: boolean;
  tempToken: string | null;
}

interface Paginated<T> {
  data: T[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

// ── Autenticación ──────────────────────────────────────────

export const api = {
  /** Login de desarrollo (el backend lo permite fuera de producción). */
  async devLogin(email: string): Promise<LoginResult> {
    const result = await request<ApiAuthResult>('POST', '/auth/dev-login', {
      email,
    });
    if (result.twoFactorRequired) {
      // NO hay sesión todavía: falta el código de la app autenticadora.
      return { user: result.user, twoFactorRequired: true, tempToken: result.tempToken ?? null };
    }
    setToken(result.accessToken);
    return { user: result.user, twoFactorRequired: false, tempToken: null };
  },

  /** Segundo paso del login: código TOTP + token temporal → sesión completa. */
  async complete2fa(tempToken: string, code: string): Promise<ApiUser> {
    const result = await request<ApiAuthResult>('POST', '/auth/2fa/complete', { tempToken, code }, null);
    setToken(result.accessToken);
    return result.user;
  },

  /** Genera el secreto TOTP (mostrar QR/clave y luego confirmar con enable2fa). */
  async setup2fa(): Promise<{ secret: string; otpauthUrl: string }> {
    return request('POST', '/auth/2fa/setup');
  },

  async enable2fa(code: string): Promise<{ enabled: boolean }> {
    return request('POST', '/auth/2fa/enable', { code });
  },

  async disable2fa(code: string): Promise<{ enabled: boolean }> {
    return request('POST', '/auth/2fa/disable', { code });
  },

  async me(): Promise<ApiUser> {
    return request<ApiUser>('GET', '/auth/me');
  },

  logout(): void {
    clearToken();
  },

  // ── Datos ──────────────────────────────────────────────

  async getDashboard(): Promise<any> {
    return request<any>('GET', '/dashboard');
  },

  async getInvoices(params: {
    status?: string;
    supplierId?: string;
    limit?: number;
    page?: number;
  } = {}): Promise<Invoice[]> {
    const q = new URLSearchParams();
    if (params.status) q.set('status', params.status);
    if (params.supplierId) q.set('supplierId', params.supplierId);
    q.set('limit', String(params.limit ?? 100));
    q.set('page', String(params.page ?? 1));
    const res = await request<Paginated<ApiInvoice>>(
      'GET',
      `/invoices?${q.toString()}`,
    );
    return res.data.map(mapInvoice);
  },

  async getSuppliers(): Promise<Supplier[]> {
    const res = await request<Paginated<ApiSupplier>>(
      'GET',
      '/suppliers?limit=100',
    );
    return res.data.map(mapSupplier);
  },

  async getFinancialRatios(): Promise<FinancialRatios> {
    return request<FinancialRatios>('GET', '/dashboard/financial-ratios');
  },

  // ── Mutaciones de facturas ──────────────────────────────
  // Persisten la acción en el backend. La UI mantiene su flujo/animación
  // local; estas llamadas hacen que el cambio quede guardado en Postgres.

  /**
   * Persiste la auditoría forense de una factura (PENDING → AUDITED y
   * guarda score/forensicStatus/satStatus). El backend recalcula con sus
   * reglas deterministas + SAT 69-B; es la fuente de verdad al recargar.
   * Solo aplica a facturas en estado PENDING o AUDITED (otras dan 409).
   */
  async auditInvoice(id: string): Promise<AuditResult> {
    return request<AuditResult>('POST', `/invoices/${id}/audit`);
  },

  /**
   * Persiste un cambio de estatus de factura (p. ej. rechazo). El backend
   * valida la transición: solo PENDING/AUDITED/APPROVED → REJECTED, etc.
   * `status` va en MAYÚSCULAS (formato del enum del backend).
   */
  async updateInvoiceStatus(
    id: string,
    status: 'PENDING' | 'AUDITED' | 'APPROVED' | 'PAID' | 'REJECTED',
    reason?: string,
  ): Promise<unknown> {
    return request<unknown>('PATCH', `/invoices/${id}/status`, {
      status,
      ...(reason ? { reason } : {}),
    });
  },

  /** Registra una firma de autorización (cada usuario firma una vez). */
  async signInvoice(id: string): Promise<{ approved: boolean; signaturesRequired: number }> {
    return request('POST', `/invoices/${id}/sign`);
  },

  // ── Configuración de la organización ────────────────────

  async getSettings(): Promise<OrgSettings> {
    return request<OrgSettings>('GET', '/organization/settings');
  },

  /**
   * Persiste los autorizadores operativos. Su CANTIDAD define las firmas
   * requeridas en el backend (0 = aprobación automática).
   */
  async updateAuthorizers(
    authorizers: { name: string; cargo: string; email: string }[],
  ): Promise<OrgSettings> {
    return request<OrgSettings>('PATCH', '/organization/settings', {
      authorizers,
    });
  },

  // ── Pago (orquesta crear pago + procesar + completar) ───

  /**
   * Paga una factura ya APROBADA: crea el pago, lo procesa y lo completa,
   * dejando la factura en PAID en el backend. `route` mapea la ruta de la UI
   * a la del backend (cash→TRANSFER, fintech→CREDIT).
   */
  async payInvoice(
    id: string,
    route: 'cash' | 'fintech' = 'cash',
  ): Promise<{ paymentId: string }> {
    const backendRoute = route === 'fintech' ? 'CREDIT' : 'TRANSFER';
    const payment = await request<{ id: string }>('POST', '/payments', {
      invoiceIds: [id],
      route: backendRoute,
    });
    await request('PATCH', `/payments/${payment.id}/status`, {
      status: 'PROCESSING',
    });
    await request('PATCH', `/payments/${payment.id}/status`, {
      status: 'COMPLETED',
    });
    return { paymentId: payment.id };
  },

  // ── DIOT (Declaración Informativa de Operaciones con Terceros) ──
  // El backend agrega las facturas APROBADAS/PAGADAS del período por RFC del
  // tercero y devuelve las operaciones. La plantilla SAT (Excel/TXT) se arma
  // en el frontend con estos datos reales.

  /**
   * Genera (o regenera, si no está presentada) la DIOT de un período mensual
   * "YYYY-MM" a partir de las facturas reales de la organización.
   */
  async generateDiot(period: string): Promise<DiotApiResult> {
    return request<DiotApiResult>('POST', '/fiscal/diot', { period });
  },

  /** Historial de DIOT generadas/presentadas (períodos mensuales). */
  async getDiotHistory(): Promise<DiotApiResult[]> {
    const res = await request<Paginated<DiotApiResult>>(
      'GET',
      '/fiscal/diot?limit=100',
    );
    return res.data;
  },

  /** Marca la DIOT como presentada al SAT (irreversible). */
  async submitDiot(id: string): Promise<DiotApiResult> {
    return request<DiotApiResult>('POST', `/fiscal/diot/${id}/submit`);
  },

  // ── Estados Financieros ─────────────────────────────────

  /** Lista los estados de resultados generados (por período). */
  async getStatements(): Promise<StatementApi[]> {
    return request<StatementApi[]>('GET', '/fiscal/statements');
  },

  /**
   * Genera el estado de resultados del período. Los egresos se toman de las
   * facturas reales; el ingreso lo aporta el usuario (opcional).
   */
  async generateStatement(period: string, revenue?: number): Promise<StatementApi> {
    return request<StatementApi>('POST', '/fiscal/statements/generate', {
      period,
      ...(revenue !== undefined ? { revenue } : {}),
    });
  },

  // ── Exportaciones CSV ───────────────────────────────────

  /** Descarga facturas en CSV (respeta el JWT y dispara la descarga). */
  async exportInvoicesCsv(): Promise<void> {
    return downloadCsv('/invoices/export', 'facturas.csv');
  },
  /** Descarga el directorio de proveedores en CSV. */
  async exportSuppliersCsv(): Promise<void> {
    return downloadCsv('/suppliers/export', 'proveedores.csv');
  },
  /** Descarga el reporte de pagos en CSV. */
  async exportPaymentsCsv(): Promise<void> {
    return downloadCsv('/payments/export', 'pagos.csv');
  },

  // ── Usuarios (Configuración → Usuarios, solo admin) ─────

  /** Lista los usuarios de la organización. */
  async getUsers(): Promise<ApiUserRow[]> {
    return request<ApiUserRow[]>('GET', '/users');
  },

  /**
   * Invita a un usuario nuevo (crea la cuenta + envía el correo si Resend
   * está configurado). `permissions` son las áreas visibles (se ignoran para
   * CORPORATE_ADMIN, que ve todo).
   */
  async inviteUser(payload: {
    email: string;
    name: string;
    role?: 'CORPORATE_USER' | 'CORPORATE_ADMIN';
    permissions?: string[];
  }): Promise<ApiUserRow & { inviteLink?: string | null }> {
    return request('POST', '/users/invite', payload);
  },

  /** Activa o desactiva un usuario (revocación inmediata de acceso). */
  async setUserStatus(id: string, isActive: boolean): Promise<ApiUserRow> {
    return request<ApiUserRow>('PATCH', `/users/${id}/status`, { isActive });
  },

  // ── Factoraje corporativo (aprobar / rechazar / desembolsar) ──
  // El corporativo revisa las solicitudes que mandan los proveedores.

  /** Lista las solicitudes de factoraje de la organización. */
  async getFactoraje(status?: string): Promise<CorpFactoraje[]> {
    const q = new URLSearchParams();
    if (status) q.set('status', status);
    q.set('limit', '100');
    const res = await request<Paginated<ApiCorpFactoraje>>(
      'GET',
      `/factoraje?${q.toString()}`,
    );
    return res.data.map(mapCorpFactoraje);
  },

  /** Aprueba una solicitud (calcula neto descontando la comisión). */
  async approveFactoraje(id: string): Promise<CorpFactoraje> {
    return mapCorpFactoraje(
      await request<ApiCorpFactoraje>('POST', `/factoraje/${id}/approve`),
    );
  },

  /** Rechaza una solicitud con un motivo. */
  async rejectFactoraje(id: string, reason: string): Promise<CorpFactoraje> {
    return mapCorpFactoraje(
      await request<ApiCorpFactoraje>('POST', `/factoraje/${id}/reject`, {
        reason,
      }),
    );
  },

  /**
   * Desembolsa el anticipo. Sin API de factoraje externa configurada, el
   * backend lo marca DISBURSED en modo manual (stub) — no requiere credenciales.
   */
  async disburseFactoraje(id: string): Promise<CorpFactoraje> {
    return mapCorpFactoraje(
      await request<ApiCorpFactoraje>('POST', `/factoraje/${id}/disburse`),
    );
  },

  // ── Portal del Proveedor ────────────────────────────────
  // Con login único + ruteo por rol, el proveedor entra por la misma pantalla
  // y su JWT queda como sesión principal; estas llamadas usan ese token y el
  // backend acota todo a su supplierId.

  /** Perfil del proveedor autenticado (su supplier + documentos KYC). */
  async getProviderProfile(): Promise<Supplier> {
    const s = await request<ApiSupplier>('GET', '/portal/profile');
    return mapSupplier(s);
  },

  /** El proveedor actualiza sus datos bancarios (CLABE / banco). */
  async updateProviderProfile(payload: { clabeInterbancaria?: string; bankName?: string }): Promise<Supplier> {
    const s = await request<ApiSupplier>('PATCH', '/portal/profile', payload);
    return mapSupplier(s);
  },

  // ── Documentos KYC del proveedor ─────────────────────────

  /** Lista los documentos KYC del proveedor autenticado. */
  async getProviderDocuments(): Promise<ProviderDocument[]> {
    return request<ProviderDocument[]>('GET', '/portal/documents');
  },

  /**
   * Sube un documento KYC (multipart). Usa fetch directo porque `request()`
   * fuerza Content-Type JSON; aquí el navegador pone el boundary de FormData.
   */
  async uploadProviderDocument(type: string, file: File): Promise<ProviderDocument> {
    const form = new FormData();
    form.append('type', type);
    form.append('file', file);
    const token = getToken();
    const res = await fetch(`${BASE}/portal/documents`, {
      method: 'POST',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: form,
    });
    if (!res.ok) {
      let message = `Error ${res.status}`;
      try { const d = await res.json(); message = d.message ?? message; } catch { /* sin JSON */ }
      throw new Error(Array.isArray(message) ? message.join(', ') : message);
    }
    return res.json() as Promise<ProviderDocument>;
  },

  /** Borra un documento KYC propio. */
  async deleteProviderDocument(docId: string): Promise<void> {
    await request('DELETE', `/portal/documents/${docId}`);
  },

  /** Facturas del proveedor autenticado (acotadas a su supplierId). */
  async getProviderInvoices(): Promise<Invoice[]> {
    const res = await request<Paginated<ApiInvoice>>(
      'GET',
      '/portal/invoices?limit=100',
    );
    return res.data.map(mapInvoice);
  },

  /** Solicitudes de factoraje (anticipo) del proveedor autenticado. */
  async getProviderFactoraje(): Promise<FactorajeItem[]> {
    const res = await request<Paginated<ApiFactoraje>>(
      'GET',
      '/portal/factoraje?limit=50',
    );
    return res.data.map(mapFactoraje);
  },

  /**
   * Solicita un anticipo (factoraje) sobre una factura APROBADA del proveedor.
   * Si no se da monto, el backend toma el total de la factura.
   */
  async requestProviderFactoraje(
    invoiceId: string,
    requestedAmount?: number,
  ): Promise<FactorajeItem> {
    const f = await request<ApiFactoraje>('POST', '/portal/factoraje', {
      invoiceId,
      ...(requestedAmount ? { requestedAmount } : {}),
    });
    return mapFactoraje(f);
  },

  // ── Asistente de IA (Gemini vía Vertex AI en el backend) ──
  // El chat corre en el backend: la API key/credencial nunca llega al
  // navegador, y el modelo usa herramientas que leen datos reales acotados
  // al organizationId del JWT. `history` se manda en el formato del backend
  // (role 'user'|'model'); la UI usa 'assistant', así que lo mapeamos aquí.

  // ── Notificaciones (campana) ────────────────────────────

  /** Notificaciones del usuario autenticado + conteo de no leídas. */
  async getNotifications(): Promise<{ items: NotificationItem[]; unread: number }> {
    const res = await request<
      Paginated<ApiNotification> & { unread: number }
    >('GET', '/notifications?limit=20');
    return { items: res.data.map(mapNotification), unread: res.unread };
  },

  /** Marca una notificación como leída. */
  async markNotificationRead(id: string): Promise<void> {
    await request('PATCH', `/notifications/${id}/read`);
  },

  /** Marca todas como leídas. */
  async markAllNotificationsRead(): Promise<void> {
    await request('PATCH', '/notifications/read-all');
  },

  /**
   * Abre el stream SSE de notificaciones en tiempo real. EventSource no manda
   * headers, así que el JWT viaja como ?token= (la JwtStrategy lo acepta).
   * Devuelve null si no hay sesión.
   */
  notificationStream(): EventSource | null {
    const token = getToken();
    if (!token) return null;
    return new EventSource(
      `${BASE}/notifications/stream?token=${encodeURIComponent(token)}`,
    );
  },

  /** Estado del asistente (si Vertex AI está configurado en el backend). */
  async aiStatus(): Promise<{ available: boolean }> {
    return request<{ available: boolean }>('GET', '/ai/status');
  },

  /** Health-check del backend: estado de la base de datos y el caché. */
  async health(): Promise<{ status: string; db: string; redis: string; timestamp: string }> {
    return request('GET', '/health');
  },

  /** Envía un mensaje al asistente y devuelve su respuesta + herramientas usadas. */
  async aiChat(
    message: string,
    history: { role: 'user' | 'assistant'; content: string }[] = [],
  ): Promise<{ reply: string; toolsUsed: string[] }> {
    const mapped = history.map((m) => ({
      role: m.role === 'assistant' ? ('model' as const) : ('user' as const),
      content: m.content,
    }));
    return request<{ reply: string; toolsUsed: string[] }>(
      'POST',
      '/ai/chat',
      { message, history: mapped },
    );
  },

  /** Califica una respuesta del asistente (👍/👎) para retroalimentar al modelo. */
  async aiFeedback(payload: {
    rating: 'UP' | 'DOWN';
    question: string;
    answer: string;
    comment?: string;
    toolsUsed?: string[];
  }): Promise<{ ok: boolean }> {
    return request<{ ok: boolean }>('POST', '/ai/feedback', payload);
  },

  // ── Panel SUPERADMIN (consola del CEO) ──────────────────
  // Requieren un JWT con rol SUPERADMIN (admin@royaltica.com). El backend
  // acota cada endpoint con @Roles('SUPERADMIN').

  /** KPIs globales de la plataforma (organizaciones, facturas, costo 30d). */
  async adminStats(): Promise<AdminStats> {
    return request<AdminStats>('GET', '/admin/stats');
  },

  /** Lista de organizaciones (clientes) con conteos y monto facturado. */
  async adminOrganizations(): Promise<AdminOrg[]> {
    return request<AdminOrg[]>('GET', '/admin/organizations');
  },

  /** Bitácora de actividad global de la plataforma (todas las orgs). */
  async adminActivity(limit = 50): Promise<AdminActivity[]> {
    return request<AdminActivity[]>('GET', `/admin/activity?limit=${limit}`);
  },

  /** Gasto global por servicio (Gemini, correos, etc.) de toda la plataforma. */
  async adminCostsByFeature(): Promise<AdminCostByFeature> {
    return request<AdminCostByFeature>('GET', '/admin/costs/by-feature');
  },

  /** Gasto por cliente (organización). */
  async adminCosts(): Promise<AdminCostOrg[]> {
    return request<AdminCostOrg[]>('GET', '/admin/costs');
  },

  /** Desglose de costo por servicio de UNA organización (cliente). */
  async adminCostForOrg(orgId: string): Promise<AdminOrgCost> {
    return request<AdminOrgCost>('GET', `/admin/costs/${orgId}`);
  },

  /**
   * Da de alta un cliente nuevo (organización + su primer CORPORATE_ADMIN).
   * Devuelve la organización creada y el link de invitación (si Firebase está
   * configurado; en dev suele venir null y el admin entra por dev-login).
   */
  async adminCreateOrganization(payload: {
    name: string;
    rfc: string;
    legalName: string;
    plan?: 'FREE' | 'PRO' | 'ENTERPRISE';
    adminEmail: string;
    adminName: string;
  }): Promise<{
    organization: { id: string; name: string; rfc: string; plan: string };
    admin: { email: string; name: string };
    inviteLink: string | null;
    emailSent: boolean;
  }> {
    return request('POST', '/admin/organizations', payload);
  },

  // ── Configuración de la organización (completa) ─────────

  /** Actualiza los datos fiscales / operativos de la organización. */
  async updateSettings(patch: Partial<{
    fiscalRegimen: string;
    fiscalAddress: string;
    displayName: string;
    documentAlertDays: number;
    factorajeFeePercent: number;
    costRatio: number;
    erpProvider: string | null;
  }>): Promise<OrgSettings> {
    return request<OrgSettings>('PATCH', '/organization/settings', patch);
  },

  // ── REP (complemento de pago) ───────────────────────────

  /** Registra el UUID del REP que el cliente emitió para una factura PPD pagada. */
  async registerRep(id: string, repUuid: string): Promise<unknown> {
    return request('POST', `/invoices/${id}/rep`, { repUuid });
  },

  // ── Score del proveedor ─────────────────────────────────

  /** Recalcula el score 0-100 de un proveedor. */
  async recomputeSupplierScore(id: string): Promise<{ score: number }> {
    return request<{ score: number }>('POST', `/suppliers/${id}/score`);
  },

  // ── WhatsApp (alertas críticas por usuario) ─────────────

  /** Preferencias de alertas por WhatsApp del usuario autenticado. */
  async getWhatsappPrefs(): Promise<WhatsappPrefs> {
    const r = await request<Record<string, unknown>>('GET', '/notifications/whatsapp');
    return {
      optIn: Boolean(r.optIn ?? r.whatsappOptIn ?? false),
      phone: (r.phone ?? r.whatsappPhone ?? null) as string | null,
    };
  },

  /** Activa/desactiva las alertas por WhatsApp (E.164 requerido para activar). */
  async setWhatsappPrefs(optIn: boolean, phone?: string): Promise<WhatsappPrefs> {
    const r = await request<Record<string, unknown>>('PUT', '/notifications/whatsapp', {
      optIn,
      ...(phone ? { phone } : {}),
    });
    return {
      optIn: Boolean(r.optIn ?? r.whatsappOptIn ?? optIn),
      phone: (r.phone ?? r.whatsappPhone ?? phone ?? null) as string | null,
    };
  },

  // ── Conectividad ERP ────────────────────────────────────

  /** Estado del conector ERP (proveedor, modo stub/live). */
  async getErpStatus(): Promise<ErpStatus> {
    return request<ErpStatus>('GET', '/erp/status');
  },

  /** Sincroniza facturas o proveedores desde el ERP (stub sin credenciales). */
  async erpSync(kind: 'invoices' | 'suppliers'): Promise<unknown> {
    return request('POST', `/erp/sync/${kind}`);
  },

  // ── SAT 69-B (verificación de RFC) ──────────────────────

  /** Verifica si un RFC está activo y si aparece en la lista negra 69-B. */
  async checkRfc(rfc: string): Promise<RfcCheck> {
    return request<RfcCheck>('GET', `/sat/check-rfc/${encodeURIComponent(rfc)}`);
  },

  // ── Webhooks salientes ──────────────────────────────────

  /** Catálogo de eventos disponibles para suscripción. */
  async getWebhookEvents(): Promise<string[]> {
    const r = await request<{ events: string[] }>('GET', '/webhooks/events');
    return r.events;
  },

  /** Endpoints de webhook registrados. */
  async getWebhooks(): Promise<WebhookEndpointItem[]> {
    return request<WebhookEndpointItem[]>('GET', '/webhooks');
  },

  /** Registra un endpoint saliente (devuelve el secret whsec_ solo al crear). */
  async createWebhook(payload: { url: string; events?: string[]; description?: string }): Promise<WebhookEndpointItem & { secret?: string }> {
    return request('POST', '/webhooks', payload);
  },

  /** Elimina un endpoint de webhook. */
  async deleteWebhook(id: string): Promise<void> {
    await request('DELETE', `/webhooks/${id}`);
  },

  // ── Pagos recibidos del proveedor ───────────────────────

  /** Pagos recibidos por el proveedor autenticado. */
  async getProviderPayments(): Promise<ProviderPayment[]> {
    const res = await request<Paginated<ApiProviderPayment>>(
      'GET',
      '/portal/payments?limit=100',
    );
    return res.data.map(mapProviderPayment);
  },

  // ── Solicitud pública de acceso ─────────────────────────

  /** Registra interés de acceso; el backend avisa al CEO. No crea cuenta. */
  async requestAccess(payload: {
    name: string;
    company: string;
    email: string;
    phone?: string;
    message?: string;
  }): Promise<{ ok: boolean }> {
    return request<{ ok: boolean }>(
      'POST',
      '/auth/request-access',
      payload,
      null, // público, sin token
    );
  },
};

/** KPIs globales del panel SUPERADMIN (GET /admin/stats). */
export interface AdminStats {
  organizations: { total: number; active: number };
  users: number;
  suppliers: number;
  invoices: { total: number; totalAmount: number };
  cost30d: { events: number; estimatedCostMxn: number };
  generatedAt: string;
}

/** Una organización (cliente) en el panel SUPERADMIN (GET /admin/organizations). */
export interface AdminOrg {
  id: string;
  name: string;
  rfc: string;
  plan: string;
  isActive: boolean;
  deleted: boolean;
  createdAt: string;
  amount: number;
  counts: { users: number; suppliers: number; invoices: number };
}

/** Gasto de un servicio/feature (Gemini, correos, etc.). */
export interface AdminCostFeature {
  feature: string;
  events: number;
  units: number;
  estimatedCostMxn: number;
}

/** Desglose global de costo por feature (GET /admin/costs/by-feature). */
export interface AdminCostByFeature {
  totalCostMxn: number;
  byFeature: AdminCostFeature[];
}

/** Desglose de costo por servicio de una organización (GET /admin/costs/:orgId). */
export interface AdminOrgCost {
  organizationId: string;
  totalCostMxn: number;
  byFeature: AdminCostFeature[];
}

/** Gasto de una organización (GET /admin/costs). */
export interface AdminCostOrg {
  organizationId: string;
  organizationName: string;
  plan: string | null;
  events: number;
  units: number;
  estimatedCostMxn: number;
}

/** Un evento de la bitácora global del panel SUPERADMIN (GET /admin/activity). */
export interface AdminActivity {
  id: string;
  action: string;
  entityType: string | null;
  user: string;
  organization: string;
  createdAt: string;
}

/** Configuración de la organización (campos que consume el frontend). */
export interface OrgSettings {
  multiUserEnabled: boolean;
  authorizers: { name: string; cargo: string; email: string }[];
  requiredSignatures: number;
  documentAlertDays: number;
  factorajeFeePercent: number;
  costRatio: number;
  fiscalRegimen: string | null;
  fiscalAddress: string | null;
  displayName: string | null;
  erpProvider: string | null;
}

/** Resultado de POST /invoices/:id/audit (ver InvoiceAuditService backend). */
export interface AuditResult {
  invoiceId: string;
  status: string;
  forensicScore: number;
  forensicStatus: 'VALIDATED' | 'DISCREPANCY' | 'BLOCKED';
  satStatus: string;
  analysis: unknown;
}

/** Razones financieras de cuentas por pagar (ver DashboardService backend). */
export interface FinancialRatios {
  dpo: { label: string; value: number; unit: string; basis: number };
  punctuality: {
    label: string;
    onTimePct: number;
    onTime: number;
    late: number;
    settled: number;
  };
  turnover: {
    label: string;
    value: number;
    unit: string;
    compras: number;
    cxpActual: number;
  };
  supplierConcentration: {
    label: string;
    concentrationPct: number;
    totalCxp: number;
    top: {
      supplierId: string;
      name: string;
      amount: number;
      sharePct: number;
    }[];
  };
  factorajeCost: {
    label: string;
    costPct: number;
    totalFee: number;
    totalFinanced: number;
    operations: number;
  };
  forensicSavings: {
    label: string;
    blockedAmount: number;
    blockedCount: number;
    discrepancyAmount: number;
    discrepancyCount: number;
  };
  generatedAt: string;
}

/** Una operación con tercero de la DIOT (agregada por RFC en el backend). */
export interface DiotEntryApi {
  rfcTercero: string;
  nombre: string;
  tipoTercero: string; // '04' nacional
  tipoOperacion: string; // '85' otros
  baseGravable: number;
  iva: number;
  numeroOperaciones: number;
}

/** Resultado de generar/consultar una DIOT (POST/GET /fiscal/diot). */
export interface DiotApiResult {
  id: string;
  period: string; // "YYYY-MM"
  entries: DiotEntryApi[];
  totalOps: number;
  totalIva: number;
  submittedAt: string | null;
  generatedAt?: string;
}

/** Un estado de resultados (GET /fiscal/statements). */
export interface StatementApi {
  id: string;
  period: string;
  type: string;
  revenue: number;
  costs: number;
  opex: number;
  netIncome: number;
  generatedAt: string;
  data?: {
    invoiceCount?: number;
    totalExpenses?: number;
    grossMargin?: number | null;
    netMargin?: number | null;
    topSuppliers?: { name: string; amount: number }[];
    assumptions?: { costRatio?: number };
  };
}

/** Un usuario de la organización (GET /users). */
export interface ApiUserRow {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  permissions: string[];
  lastLoginAt: string | null;
  createdAt: string;
}

/** Una solicitud de factoraje vista desde el lado corporativo. */
export interface CorpFactoraje {
  id: string;
  status: 'PENDING' | 'APPROVED' | 'DISBURSED' | 'REJECTED';
  supplierId: string;
  supplierName: string;
  invoiceId: string;
  invoiceFolio: string;
  requestedAmount: number;
  fee: number;
  netAmount: number;
  rate: number;
  createdAt: string;
  resolvedAt: string | null;
  disbursedAt: string | null;
}

interface ApiCorpFactoraje {
  id: string;
  status: CorpFactoraje['status'];
  supplierId: string;
  invoiceId: string;
  requestedAmount: number;
  fee: number;
  netAmount: number;
  rate: number;
  createdAt: string;
  resolvedAt: string | null;
  disbursedAt: string | null;
  supplier?: { id: string; name: string };
  invoice?: { id: string; folio: string | null; cfdiUuid: string };
}

function mapCorpFactoraje(f: ApiCorpFactoraje): CorpFactoraje {
  return {
    id: f.id,
    status: f.status,
    supplierId: f.supplier?.id ?? f.supplierId,
    supplierName: f.supplier?.name ?? '—',
    invoiceId: f.invoice?.id ?? f.invoiceId,
    invoiceFolio: f.invoice?.folio ?? f.invoice?.cfdiUuid ?? f.invoiceId,
    requestedAmount: Number(f.requestedAmount),
    fee: Number(f.fee),
    netAmount: Number(f.netAmount),
    rate: Number(f.rate),
    createdAt: f.createdAt,
    resolvedAt: f.resolvedAt ?? null,
    disbursedAt: f.disbursedAt ?? null,
  };
}

/** Preferencias de alertas por WhatsApp (GET/PUT /notifications/whatsapp). */
export interface WhatsappPrefs {
  optIn: boolean;
  phone: string | null;
}

/** Estado del conector ERP (GET /erp/status). */
export interface ErpStatus {
  erpProvider: string | null;
  connected: boolean;
  mode: 'live' | 'stub' | 'none';
  message: string;
}

/** Resultado de verificar un RFC contra el SAT (GET /sat/check-rfc/:rfc). */
export interface RfcCheck {
  rfc?: string;
  active?: boolean;
  status?: string;
  message?: string;
  list69b?: { listed: boolean; status?: string | null } | boolean | null;
  [key: string]: unknown;
}

/** Un endpoint de webhook (GET /webhooks). */
export interface WebhookEndpointItem {
  id: string;
  url: string;
  events: string[];
  description: string | null;
  isActive: boolean;
  secretHint?: string;
  createdAt: string;
}

/** Un pago recibido por el proveedor (GET /portal/payments). */
export interface ProviderPayment {
  id: string;
  totalAmount: number;
  status: string;
  route: string | null;
  createdAt: string;
  scheduledPayDate: string | null;
}

interface ApiProviderPayment {
  id: string;
  totalAmount: number;
  status: string;
  route?: string | null;
  createdAt: string;
  scheduledPayDate?: string | null;
}

function mapProviderPayment(p: ApiProviderPayment): ProviderPayment {
  return {
    id: p.id,
    totalAmount: Number(p.totalAmount),
    status: p.status,
    route: p.route ?? null,
    createdAt: p.createdAt,
    scheduledPayDate: p.scheduledPayDate ?? null,
  };
}

/** Un documento KYC del proveedor (GET /portal/documents). */
export interface ProviderDocument {
  id: string;
  type: string;
  fileName: string | null;
  status: 'PENDING' | 'VALIDATED' | 'EXPIRED';
  expiresAt: string | null;
}

/** Una notificación de la campana (forma que consume la UI). */
export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
}

interface ApiNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
}

function mapNotification(n: ApiNotification): NotificationItem {
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    isRead: n.isRead,
    createdAt: n.createdAt,
  };
}

/** Una solicitud de factoraje del proveedor (forma que consume la UI). */
export interface FactorajeItem {
  id: string;
  status: 'PENDING' | 'APPROVED' | 'DISBURSED' | 'REJECTED';
  requestedAmount: number;
  fee: number;
  netAmount: number;
  rate: number;
  invoiceId: string;
  invoiceFolio: string;
  createdAt: string;
  resolvedAt: string | null;
}

interface ApiFactoraje {
  id: string;
  status: FactorajeItem['status'];
  requestedAmount: number;
  fee: number;
  netAmount: number;
  rate: number;
  invoiceId: string;
  createdAt: string;
  resolvedAt: string | null;
  invoice?: { id: string; folio: string | null; cfdiUuid: string };
}

function mapFactoraje(f: ApiFactoraje): FactorajeItem {
  return {
    id: f.id,
    status: f.status,
    requestedAmount: Number(f.requestedAmount),
    fee: Number(f.fee),
    netAmount: Number(f.netAmount),
    rate: Number(f.rate),
    invoiceId: f.invoice?.id ?? f.invoiceId,
    invoiceFolio: f.invoice?.folio ?? f.invoice?.cfdiUuid ?? f.invoiceId,
    createdAt: f.createdAt,
    resolvedAt: f.resolvedAt ?? null,
  };
}

// ── Mappers backend → tipos de la UI ───────────────────────

interface ApiInvoice {
  id: string;
  folio: string | null;
  cfdiUuid: string;
  total: number;
  status: string;
  date: string;
  dueDate: string | null;
  poNumber: string | null;
  description: string | null;
  paymentType: 'PPD' | 'PUE' | null;
  forensicStatus: string;
  forensicScore: number | null;
  satStatus: string | null;
  repStatus: string;
  paidDate: string | null;
  scheduledPayDate: string | null;
  supplierId: string;
  supplier: { id: string; name: string };
}

const FORENSIC_UI = new Set(['VALIDATED', 'DISCREPANCY', 'BLOCKED']);

export function mapInvoice(i: ApiInvoice): Invoice {
  return {
    id: i.id,
    providerId: i.supplierId,
    provider: i.supplier?.name ?? '—',
    amount: i.total,
    date: i.date,
    status: i.status.toLowerCase() as Invoice['status'],
    poNumber: i.poNumber ?? '',
    description: i.description ?? '',
    auditScore: i.forensicScore ?? undefined,
    paymentType: i.paymentType ?? undefined,
    forensicStatus: FORENSIC_UI.has(i.forensicStatus)
      ? (i.forensicStatus as Invoice['forensicStatus'])
      : undefined,
    cfdiUUID: i.cfdiUuid,
    satStatus: (i.satStatus as Invoice['satStatus']) ?? undefined,
    scheduledPayDate: i.scheduledPayDate ?? undefined,
    paidDate: i.paidDate ?? undefined,
    repStatus: (['NA', 'PENDING', 'RECEIVED'].includes(i.repStatus)
      ? i.repStatus
      : undefined) as Invoice['repStatus'],
  };
}

interface ApiSupplierDocument {
  id: string;
  type: string;
  status: string;
  fileName: string | null;
  expiresAt: string | null;
}

interface ApiSupplier {
  id: string;
  name: string;
  rfc: string;
  legalName: string;
  contact: string | null;
  category: string | null;
  activity: string | null;
  isApproved: boolean;
  seniorityYears: number;
  score?: number | null;
  clabeInterbancaria?: string | null;
  bankName?: string | null;
  documents?: ApiSupplierDocument[];
}

/** Etiquetas legibles de los tipos de documento KYC (enum backend → UI). */
const DOC_TYPE_LABEL: Record<string, string> = {
  CONSTANCIA_SF: 'Constancia de Situación Fiscal',
  OPINION_32D: 'Opinión del SAT',
  COMPROBANTE_DOMICILIO: 'Comprobante de Domicilio',
  ACTA_CONSTITUTIVA: 'Acta Constitutiva',
  IDENTIFICACION: 'Identificación',
  PODER_NOTARIAL: 'Poder Notarial',
};

export function mapSupplier(s: ApiSupplier): Supplier {
  return {
    id: s.id,
    name: s.name,
    rfc: s.rfc,
    contact: s.contact ?? '',
    isApproved: s.isApproved,
    category: (s.category as Supplier['category']) ?? 'Servicios TI',
    priority: 'Media',
    legalName: s.legalName,
    activity: s.activity ?? '',
    seniorityYears: s.seniorityYears,
    score: s.score ?? undefined,
    clabe: s.clabeInterbancaria ?? undefined,
    bankName: s.bankName ?? undefined,
    documents: (s.documents ?? []).map((d) => ({
      type: DOC_TYPE_LABEL[d.type] ?? d.type,
      status: d.status === 'VALIDATED' ? 'Validado' : 'Pendiente',
    })),
  };
}
