import { motion, useReducedMotion } from 'motion/react';
import { Headset, ShieldCheck, Users } from 'lucide-react';
import { EASE } from './primitives.tsx';

export type Rol = 'admin' | 'supervisor' | 'agente';

export const ROLES: { id: Rol; nombre: string; resumen: string; Icono: typeof ShieldCheck }[] = [
  { id: 'admin', nombre: 'Administrador', resumen: 'Ve todo, carga datos y configura', Icono: ShieldCheck },
  { id: 'supervisor', nombre: 'Supervisor', resumen: 'Su equipo, campañas y reglas', Icono: Users },
  { id: 'agente', nombre: 'Agente', resumen: 'Solo lo necesario para contactar', Icono: Headset },
];

/**
 * Selector de perfil. Borde "texture card" (patrón de cult-ui): capas de
 * hilos claros/oscuros alternados que dan un canto grabado en vez de una
 * sombra plana. El resaltado se desliza entre opciones (layoutId).
 */
export function RolSelector({ rol, onChange }: { rol: Rol; onChange: (r: Rol) => void }) {
  const reduce = useReducedMotion();
  return (
    <div className="rounded-[22px] border border-white/70 p-[3px] shadow-sm bg-brand-paper">
      <div className="rounded-[19px] border border-brand-ink/10 p-px">
        <div className="rounded-[18px] border border-white/60 bg-brand-bone/60 p-1 grid grid-cols-3 gap-1">
          {ROLES.map(({ id, nombre, resumen, Icono }) => {
            const activo = rol === id;
            return (
              <button
                key={id}
                onClick={() => onChange(id)}
                aria-pressed={activo}
                className="relative text-left rounded-2xl px-4 py-3"
              >
                {activo && (
                  <motion.span
                    layoutId={reduce ? undefined : 'rol-activo'}
                    className="absolute inset-0 rounded-2xl bg-brand-paper border border-brand-gold/40 shadow-sm"
                    transition={{ duration: 0.32, ease: EASE }}
                  />
                )}
                <span className="relative flex items-center gap-2.5">
                  <Icono size={16} className={activo ? 'text-brand-gold' : 'text-brand-ink/35'} />
                  <span>
                    <span className={`block text-[13px] font-semibold ${activo ? 'text-brand-ink' : 'text-brand-ink/55'}`}>
                      {nombre}
                    </span>
                    <span className="hidden sm:block text-[11px] text-brand-ink/40 leading-tight">{resumen}</span>
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
