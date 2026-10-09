import type { Organization } from '@prisma/client';

/**
 * Límite de licencias (subcuentas) por paquete, pedido por José para el
 * perfil Cliente-Admin → Agente/Supervisor/Agente de CxC (spec "jerarquía de
 * cuentas", punto 5 de sus notas con Paolo). Paquete 1/2/3 son nombres
 * provisionales — José confirmó 3/3/3, 4/4/4 y 5/5/5 pero dijo que todavía
 * lo va a platicar con Paolo, así que estos valores son el default sugerido,
 * no una decisión cerrada. Cambiarlos aquí no requiere migración.
 */
export interface SeatLimits {
  admin: number;
  supervisor: number;
  agente: number;
}

export const SEAT_PACKAGE_PRESETS: Record<string, SeatLimits> = {
  PAQUETE_1: { admin: 3, supervisor: 3, agente: 3 },
  PAQUETE_2: { admin: 4, supervisor: 4, agente: 4 },
  PAQUETE_3: { admin: 5, supervisor: 5, agente: 5 },
};

/** Sin paquete asignado (orgs existentes antes de esta feature): sin tope,
 * para no romper nada retroactivamente — el superadmin asigna un paquete
 * explícito cuando quiera empezar a limitar. */
const UNLIMITED: SeatLimits = {
  admin: Number.POSITIVE_INFINITY,
  supervisor: Number.POSITIVE_INFINITY,
  agente: Number.POSITIVE_INFINITY,
};

/**
 * Lee el límite de licencias vigente de una organización. Se guarda dentro
 * de `Organization.settings` (JSON) en vez de columnas propias — mismo
 * patrón que `multiUserEnabled` en users.service.ts — para no requerir
 * migración de Prisma mientras el esquema de paquetes se sigue definiendo
 * con Paolo.
 */
export function getSeatLimits(org: Pick<Organization, 'settings'>): SeatLimits {
  const settings = (org.settings ?? {}) as Record<string, unknown>;
  const raw = settings.seatLimits as Partial<SeatLimits> | undefined;
  if (!raw) return UNLIMITED;
  return {
    admin: raw.admin ?? UNLIMITED.admin,
    supervisor: raw.supervisor ?? UNLIMITED.supervisor,
    agente: raw.agente ?? UNLIMITED.agente,
  };
}
