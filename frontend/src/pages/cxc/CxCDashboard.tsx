import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ChevronRight, Brain, ShieldCheck, Lock, Server, LogOut } from 'lucide-react';
import type { User as FirebaseUser } from 'firebase/auth';
import { NotificationBell } from '../../components/NotificationBell.tsx';
import { SidebarLink } from '../../components/SidebarLink.tsx';
import { CobranzaInteligenteView } from '../corporate/views/CobranzaInteligenteView.tsx';
import { useOrgBranding } from '../../hooks/useOrgBranding.ts';

/**
 * Producto separado de Cobranza IA: shell propio, sin pestañas ni ruteo —
 * quien entra por aquí (ver CxCApp.tsx) ve ÚNICAMENTE Cobranza IA, sin CxP,
 * contabilidad, factoraje ni siquiera las otras vistas de CxC (F. por cobrar,
 * Crecimiento). No hay lógica de permisos que decida qué mostrar: este login
 * lleva directo a esta única vista, punto.
 */
export function CxCDashboard({
  user,
  onLogout,
  onBackToRole,
}: {
  user: FirebaseUser;
  onLogout: () => void;
  onBackToRole: () => void;
}) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => window.innerWidth < 900);
  const branding = useOrgBranding();

  return (
    <div className="h-screen w-full bg-brand-bone flex overflow-hidden">
      <NotificationBell />

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
              <div className="w-8 h-8 flex-shrink-0 bg-brand-bone rounded flex items-center justify-center shadow-inner overflow-hidden">
                {branding.logoUrl ? (
                  <img src={branding.logoUrl} alt={branding.displayName} className="w-full h-full object-contain" />
                ) : (
                  <span className="font-serif font-bold text-brand-ink leading-none text-sm">{branding.displayName.charAt(0)}</span>
                )}
              </div>
              {!isSidebarCollapsed && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <span className="label-caps mb-1 block !opacity-40">Cobranza IA</span>
                  <h1 className="text-xl font-serif tracking-widest leading-none">{branding.displayName}</h1>
                </motion.div>
              )}
            </button>
          </div>

          {/* Una sola pestaña, siempre activa — mismo componente y colores
              (dorado/tinta) que usaba dentro del portal corporativo completo. */}
          <nav className="flex-1 space-y-2">
            <SidebarLink icon={<Brain size={18} />} label="Cobranza IA" active collapsed={isSidebarCollapsed} onClick={() => {}} />
          </nav>

          <div className="mt-auto py-8 border-t border-brand-paper/10 flex flex-col gap-6">
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
                <img src={user.photoURL || 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix'} alt="" className="w-full h-full object-cover" />
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
              <LogOut size={16} /> {!isSidebarCollapsed && 'Salir'}
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area — única vista, sin ruteo. */}
      <main className="flex-1 flex flex-col p-10 pb-0 overflow-y-auto bg-brand-bone text-[var(--brand-bone-text)] min-h-0">
        <div className="flex-1 flex flex-col min-h-0 pb-0">
          <CobranzaInteligenteView />
        </div>
      </main>
    </div>
  );
}
