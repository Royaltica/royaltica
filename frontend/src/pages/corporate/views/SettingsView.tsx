import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShieldCheck, Building2, CheckCircle2, AlertCircle, FileText, X, Send, Settings, Database,
  UserPlus, UploadCloud, Globe, FileUp, Download, AlertTriangle, Activity, BookOpen, Webhook,
  MessageSquare, Loader2, Bell, TrendingUp, DollarSign, Eye, RefreshCw, Key, Shield, Wifi,
  WifiOff, Users,
} from 'lucide-react';
import { auth } from '../../../lib/firebase.ts';
import { validateRFC } from '../../../lib/validators.ts';
import { MOCK_SUPPLIERS, type Supplier } from '../../../types.ts';
import { api, type ApiUserRow } from '../../../services/apiClient.ts';
import {
  DualLoggerService, type FiscalAuditEvent, type AuditSubscriber,
  SupplierMessageService, type SupplierMessage,
} from '../../../services/mockServices.ts';
import { CURRENCY_FORMATTER } from '../../../utils/format.ts';
import { ErpConnectivityPanel } from '../../../features/corporate/settings/ErpConnectivityPanel.tsx';
import { WebhooksPanel } from '../../../features/corporate/settings/WebhooksPanel.tsx';
import { Sat69bChecker } from '../../../features/corporate/settings/Sat69bChecker.tsx';
import { AuthorizationPanel } from '../../../features/corporate/auditoria/AuthorizationPanel.tsx';

// ─── Datos de la organización (Configuración → Organización) ─────────────────
export function OrgSettingsForm() {
  const [form, setForm] = useState({
    displayName: '', fiscalRegimen: '', fiscalAddress: '',
    documentAlertDays: 15, factorajeFeePercent: 0, costRatio: 0.65, erpProvider: '',
    // White label (Tradespace): marca propia del tenant sobre la plataforma.
    brandDisplayName: '', brandLogoUrl: '', brandPrimaryColor: '', brandAccentColor: '',
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
        brandDisplayName: s.brandDisplayName ?? '',
        brandLogoUrl: s.brandLogoUrl ?? '',
        brandPrimaryColor: s.brandPrimaryColor ?? '',
        brandAccentColor: s.brandAccentColor ?? '',
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
        brandDisplayName: form.brandDisplayName.trim() || null,
        brandLogoUrl: form.brandLogoUrl.trim() || null,
        brandPrimaryColor: form.brandPrimaryColor.trim() || null,
        brandAccentColor: form.brandAccentColor.trim() || null,
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

          {/* ── White label (Tradespace: marca propia) ────────────────── */}
          <div className="pt-2 border-t border-brand-sand/30">
            <p className="text-[9px] uppercase font-bold tracking-widest text-brand-ink/40 mb-3">Marca propia (White Label)</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label='Nombre de marca (reemplaza "Royáltica")'>
                <input className={inputCls} value={form.brandDisplayName} onChange={e => setForm({ ...form, brandDisplayName: e.target.value })} placeholder="Tradespace" />
              </Field>
              <Field label="URL del logo">
                <input className={inputCls} value={form.brandLogoUrl} onChange={e => setForm({ ...form, brandLogoUrl: e.target.value })} placeholder="https://.../logo.png" />
              </Field>
              <Field label="Color primario (hex)">
                <div className="flex items-center gap-2">
                  <input className={inputCls} value={form.brandPrimaryColor} onChange={e => setForm({ ...form, brandPrimaryColor: e.target.value })} placeholder="#111827" />
                  {form.brandPrimaryColor && <span className="w-8 h-8 rounded-lg border border-brand-sand flex-shrink-0" style={{ backgroundColor: form.brandPrimaryColor }} />}
                </div>
              </Field>
              <Field label="Color de acento (hex)">
                <div className="flex items-center gap-2">
                  <input className={inputCls} value={form.brandAccentColor} onChange={e => setForm({ ...form, brandAccentColor: e.target.value })} placeholder="#06B6D4" />
                  {form.brandAccentColor && <span className="w-8 h-8 rounded-lg border border-brand-sand flex-shrink-0" style={{ backgroundColor: form.brandAccentColor }} />}
                </div>
              </Field>
            </div>
            <p className="text-[9px] text-brand-ink/30 font-serif mt-2">Deja estos campos vacíos para usar la marca por defecto de Royáltica. Los cambios de color se aplican al refrescar la página.</p>
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
export function TwoFactorSetupPanel() {
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


export function WhatsappPrefsPanel() {
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
  cxc: 'Cuentas por Cobrar',
  factoraje: 'Factoraje',
  pagos: 'Pagos',
  estados: 'Estados / DIOT',
  notificaciones: 'Notificaciones',
  configuracion: 'Configuración',
};
const USER_AREAS = Object.keys(USER_AREA_LABELS);

export function UsersManager() {
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


export function SettingsView({
  totalBudget,
  onBudgetChange
}: {
  totalBudget: number,
  onBudgetChange: (b: number) => void
}) {
  const [activeSection, setActiveSection] = useState<'erp' | 'manual' | 'auth' | 'budget' | 'usuarios' | 'organizacion' | 'integraciones'>('erp');
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
            { id: 'budget', label: 'Presupuesto', icon: <DollarSign size={14} /> }
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

      </div>

      <AnimatePresence mode="wait">
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
export function BudgetEditor({ totalBudget, onBudgetChange }: { totalBudget: number; onBudgetChange: (b: number) => void }) {
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
export function ERPConnectionPanel({ erpOptions }: { erpOptions: { name: string; logo: string; description: string }[] }) {
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
export function ManualSupplierPanel() {
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

