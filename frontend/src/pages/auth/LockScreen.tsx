import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Lock, Shield } from 'lucide-react';
import type { User as FirebaseUser } from 'firebase/auth';
import { signInWithEmail } from '../../lib/firebase.ts';

export function LockScreen({ user, onUnlock, onLogout }: { user: FirebaseUser, onUnlock: () => void, onLogout: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsVerifying(true);
    setError('');
    try {
      if (!user.email) throw new Error('No se pudo verificar la sesión.');
      // Re-verifica contra Firebase (misma cuenta, sin re-emitir sesión del
      // backend) — confirma que quien desbloquea sí conoce la contraseña.
      await signInWithEmail(user.email, password);
      onUnlock();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Contraseña incorrecta');
      setPassword('');
      setIsVerifying(false);
    }
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
