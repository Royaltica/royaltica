import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, User, AlertTriangle, Mail, CheckCircle2, Scale, Shield, History, ChevronRight } from 'lucide-react';
import { AuthorizerService, CEO_KEY, type Authorizer } from '../../../services/mockServices.ts';
import { MOCK_INVOICES, type Invoice } from '../../../types.ts';

const CURRENCY_FORMATTER = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
});

// ─── Authorization Panel ──────────────────────────────────────────────────────
export function AuthorizationPanel() {
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
