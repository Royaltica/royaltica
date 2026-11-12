import { motion, useReducedMotion } from 'motion/react';
import { Headset, ShieldCheck, Users } from 'lucide-react';
import { SPRING } from './campanasUi.tsx';

export type Rol = 'admin' | 'supervisor' | 'agente';

export const ROLES: { id: Rol; nombre: string; resumen: string; Icono: typeof ShieldCheck }[] = [
  { id: 'admin', nombre: 'Administrador', resumen: 'Ve todo, carga datos y configura', Icono: ShieldCheck },
  { id: 'supervisor', nombre: 'Supervisor', resumen: 'Su equipo, campañas y reglas', Icono: Users },
  { id: 'agente', nombre: 'Agente', resumen: 'Solo lo necesario para contactar', Icono: Headset },
];

/**
 * Selector de perfil compacto (solo para la etapa de prueba: en uso real cada
 * persona entra con su perfil y este control desaparece). Control segmentado
 * de vidrio; el resaltado se desliza entre opciones (layoutId).
 */
export function RolSelector({ rol, onChange }: { rol: Rol; onChange: (r: Rol) => void }) {
  const reduce = useReducedMotion();
  return (
    <div className="inline-flex flex-col items-start sm:items-end gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-ink/40">Vista de prueba</span>
      <div
        role="radiogroup"
        aria-label="Ver como"
        className="inline-flex items-center gap-0.5 rounded-full p-1 bg-white/55 backdrop-blur-xl border border-white/80 ring-1 ring-brand-ink/[0.06] shadow-[0_1px_0_rgba(255,255,255,0.9)_inset]"
      >
        {ROLES.map(({ id, nombre, resumen, Icono }) => {
          const activo = rol === id;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={activo}
              title={resumen}
              onClick={() => onChange(id)}
              className={`relative inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand-gold/70 ${
                activo ? 'text-brand-ink' : 'text-brand-ink/45 hover:text-brand-ink/75'
              }`}
            >
              {activo && (
                <motion.span
                  layoutId={reduce ? undefined : 'rol-activo'}
                  transition={SPRING}
                  className="absolute inset-0 rounded-full bg-white ring-1 ring-brand-gold/50 shadow-[0_6px_18px_-10px_rgba(6,182,212,0.6)]"
                />
              )}
              <Icono size={13} className={`relative ${activo ? 'text-cyan-600' : ''}`} />
              {/* En pantallas chicas, los inactivos quedan solo con icono para no desbordar. */}
              <span className={`relative ${activo ? '' : 'sr-only sm:not-sr-only'}`}>{nombre}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
