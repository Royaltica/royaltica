import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, AlertCircle, Calendar, Loader2 } from 'lucide-react';
import { api } from '../../services/apiClient.ts';
import { buildLeadSource } from '../../utils/format.ts';

export function ScheduleDemoScreen({ onBack }: { onBack: () => void }) {
  const [form, setForm] = useState({
    name: '',
    company: '',
    email: '',
    phone: '',
    jobTitle: '',
    companySize: '',
    preferredDate: '',
    preferredTime: '',
    message: '',
    website: '', // honeypot — invisible en el UI
  });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSending(true);
    try {
      const companySize = form.companySize ? parseInt(form.companySize, 10) : undefined;
      await api.scheduleDemo({
        name: form.name.trim(),
        company: form.company.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim() || undefined,
        jobTitle: form.jobTitle.trim() || undefined,
        companySize: Number.isFinite(companySize) ? companySize : undefined,
        preferredDate: form.preferredDate || undefined,
        preferredTime: form.preferredTime.trim() || undefined,
        message: form.message.trim() || undefined,
        source: buildLeadSource(),
        website: form.website, // honeypot: si viene con valor, el backend lo detecta
      });
      setSent(true);
    } catch (err) {
      setError((err as Error).message || 'No pudimos enviar tu solicitud. Intenta de nuevo.');
      setSending(false);
    }
  };

  // Franjas horarias sugeridas — puramente UI, el backend acepta texto libre.
  const timeSlots = ['09:00 - 10:00', '10:00 - 11:00', '11:00 - 12:00', '15:00 - 16:00', '16:00 - 17:00', '17:00 - 18:00'];
  // Rangos de empresa comunes en México.
  const sizeOptions = [
    { value: '', label: 'Selecciona…' },
    { value: '10', label: '1 – 10' },
    { value: '50', label: '11 – 50' },
    { value: '250', label: '51 – 250' },
    { value: '1000', label: '251 – 1,000' },
    { value: '5000', label: '1,001 – 5,000' },
    { value: '10000', label: '5,000+' },
  ];
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="min-h-screen bg-brand-bone flex flex-col items-center justify-center p-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-lg w-full space-y-8">
        <div className="text-center space-y-2">
          <span className="label-caps">Demo en Vivo · 30 min</span>
          <h1 className="text-4xl text-brand-ink font-serif">Agenda una demo</h1>
          <p className="text-[11px] text-brand-ink/50 px-6">
            Te mostramos cómo Royáltica orquesta pagos y cumplimiento fiscal en tu operación real. Sin compromiso.
          </p>
        </div>

        <div className="editorial-card !bg-brand-cream space-y-6 shadow-2xl shadow-brand-sand/50">
          {sent ? (
            <div className="text-center space-y-4 py-6">
              <div className="w-14 h-14 rounded-full bg-green-50 border border-green-200 flex items-center justify-center mx-auto">
                <CheckCircle2 size={26} className="text-green-600" />
              </div>
              <h3 className="text-xl font-serif text-brand-ink">¡Perfecto!</h3>
              <p className="text-[11px] text-brand-ink/60 px-4">
                Recibimos tu solicitud. Te contactaremos en las próximas <strong>24 h hábiles</strong> para confirmar la sesión y enviarte el link.
              </p>
              <button onClick={onBack} className="mt-2 px-6 py-3 bg-brand-ink text-brand-bone rounded-xl text-[10px] uppercase font-bold tracking-[0.2em] hover:bg-black transition-all cursor-pointer">
                Volver al inicio
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 text-left">
              {/* Honeypot invisible — solo los bots lo llenan. */}
              <input
                type="text"
                name="website"
                value={form.website}
                onChange={set('website')}
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label-caps !opacity-50 mb-2 block text-[9px]">Nombre completo *</label>
                  <input type="text" value={form.name} onChange={set('name')} required maxLength={120}
                    className="w-full px-4 py-3 bg-white border border-brand-sand rounded-xl focus:outline-none focus:border-brand-gold text-brand-ink text-sm" />
                </div>
                <div>
                  <label className="label-caps !opacity-50 mb-2 block text-[9px]">Empresa *</label>
                  <input type="text" value={form.company} onChange={set('company')} required maxLength={160}
                    className="w-full px-4 py-3 bg-white border border-brand-sand rounded-xl focus:outline-none focus:border-brand-gold text-brand-ink text-sm" />
                </div>
                <div>
                  <label className="label-caps !opacity-50 mb-2 block text-[9px]">Correo corporativo *</label>
                  <input type="email" value={form.email} onChange={set('email')} required
                    className="w-full px-4 py-3 bg-white border border-brand-sand rounded-xl focus:outline-none focus:border-brand-gold text-brand-ink text-sm" />
                </div>
                <div>
                  <label className="label-caps !opacity-50 mb-2 block text-[9px]">Teléfono</label>
                  <input type="tel" value={form.phone} onChange={set('phone')}
                    className="w-full px-4 py-3 bg-white border border-brand-sand rounded-xl focus:outline-none focus:border-brand-gold text-brand-ink text-sm" />
                </div>
                <div>
                  <label className="label-caps !opacity-50 mb-2 block text-[9px]">Puesto</label>
                  <input type="text" value={form.jobTitle} onChange={set('jobTitle')} maxLength={120}
                    className="w-full px-4 py-3 bg-white border border-brand-sand rounded-xl focus:outline-none focus:border-brand-gold text-brand-ink text-sm" />
                </div>
                <div>
                  <label className="label-caps !opacity-50 mb-2 block text-[9px]">Tamaño de empresa</label>
                  <select value={form.companySize} onChange={set('companySize')}
                    className="w-full px-4 py-3 bg-white border border-brand-sand rounded-xl focus:outline-none focus:border-brand-gold text-brand-ink text-sm">
                    {sizeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label-caps !opacity-50 mb-2 block text-[9px]">Fecha preferida</label>
                  <input type="date" value={form.preferredDate} onChange={set('preferredDate')} min={today}
                    className="w-full px-4 py-3 bg-white border border-brand-sand rounded-xl focus:outline-none focus:border-brand-gold text-brand-ink text-sm" />
                </div>
                <div>
                  <label className="label-caps !opacity-50 mb-2 block text-[9px]">Horario preferido</label>
                  <select value={form.preferredTime} onChange={set('preferredTime')}
                    className="w-full px-4 py-3 bg-white border border-brand-sand rounded-xl focus:outline-none focus:border-brand-gold text-brand-ink text-sm">
                    <option value="">Cualquiera</option>
                    {timeSlots.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="label-caps !opacity-50 mb-2 block text-[9px]">Contexto (opcional)</label>
                <textarea value={form.message} onChange={set('message')} rows={3} maxLength={1000}
                  placeholder="Cuéntanos brevemente tu operación: # facturas/mes, ERP, mayor pain point…"
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
                  className="flex-[2] py-3.5 bg-brand-ink text-brand-bone rounded-xl text-[10px] uppercase font-bold tracking-[0.2em] hover:bg-black transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2">
                  {sending ? <Loader2 size={14} className="animate-spin" /> : <Calendar size={13} />}
                  {sending ? 'Enviando…' : 'Solicitar demo'}
                </button>
              </div>
              <p className="text-center text-[9px] text-brand-ink/40 uppercase tracking-widest pt-1">
                Respondemos en menos de 24 h hábiles
              </p>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
}
