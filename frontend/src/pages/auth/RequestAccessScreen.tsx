import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, AlertCircle, Send, Loader2 } from 'lucide-react';
import { api } from '../../services/apiClient.ts';

export function RequestAccessScreen({ onBack }: { onBack: () => void }) {
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
