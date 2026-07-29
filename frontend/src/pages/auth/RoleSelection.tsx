import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Building2, LogOut, ChevronRight, User, ChevronLeft, Crown } from 'lucide-react';
import type { User as FirebaseUser } from 'firebase/auth';
import { signOut } from 'firebase/auth';
import { auth } from '../../lib/firebase.ts';
import { MOCK_SUPPLIERS, type Supplier } from '../../types.ts';
import type { Role } from '../../utils/role.ts';

export function RoleSelection({ onSelect, user, onProviderLogin }: { onSelect: (role: Role) => void, user: FirebaseUser, onProviderLogin: (supplier: Supplier) => void }) {
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
