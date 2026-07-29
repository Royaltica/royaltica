import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldCheck, AlertCircle, Calendar, Mail, MessageSquare, Loader2, Eye, Lock, Key, Shield, Server } from 'lucide-react';
import { RequestAccessScreen } from './auth/RequestAccessScreen.tsx';
import { ScheduleDemoScreen } from './auth/ScheduleDemoScreen.tsx';
import { ContactScreen } from './auth/ContactScreen.tsx';

export function LandingPage({ onLogin }: { onLogin: (email: string, password: string) => Promise<void> }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  // Pantalla de "Solicitar acceso" (el CEO recibe el aviso y da de alta).
  const [showRequest, setShowRequest] = useState(false);
  // Pantallas públicas del sitio marketing (royaltica.com).
  const [showDemo, setShowDemo] = useState(false);
  const [showContact, setShowContact] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      // Firebase valida la contraseña; el backend valida que la cuenta exista
      // y tenga acceso. Cualquiera de los dos pasos puede fallar.
      await onLogin(email.trim().toLowerCase(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cuenta no encontrada o sin acceso. Solicita acceso abajo.');
      setIsLoading(false);
    }
  };

  if (showRequest) {
    return <RequestAccessScreen onBack={() => setShowRequest(false)} />;
  }
  if (showDemo) {
    return <ScheduleDemoScreen onBack={() => setShowDemo(false)} />;
  }
  if (showContact) {
    return <ContactScreen onBack={() => setShowContact(false)} />;
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

          <div className="pt-4 border-t border-brand-sand grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setShowDemo(true)}
              className="flex items-center justify-center gap-2 py-2.5 px-3 bg-brand-ink text-brand-bone rounded-lg text-[9px] uppercase font-bold tracking-[0.15em] hover:bg-black transition-all cursor-pointer"
            >
              <Calendar size={12} />
              Agendar demo
            </button>
            <button
              type="button"
              onClick={() => setShowContact(true)}
              className="flex items-center justify-center gap-2 py-2.5 px-3 bg-white border border-brand-sand text-brand-ink rounded-lg text-[9px] uppercase font-bold tracking-[0.15em] hover:bg-brand-cream transition-all cursor-pointer"
            >
              <MessageSquare size={12} />
              Contáctanos
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
