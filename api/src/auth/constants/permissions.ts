/**
 * Áreas de la plataforma a las que se puede dar acceso granular.
 * Un CORPORATE_USER solo ve las áreas que tenga en su `permissions[]`.
 * Un CORPORATE_ADMIN / SUPERADMIN ve todas (se ignora su `permissions[]`).
 *
 * Estos valores deben coincidir con las pestañas del frontend.
 */
export const AREAS = {
  DASHBOARD: 'dashboard',
  PROVEEDORES: 'proveedores',
  CXC: 'cxc',
  FINANZAS: 'finanzas',
  FACTORAJE: 'factoraje',
  PAGOS: 'pagos',
  ESTADOS: 'estados',
  NOTIFICACIONES: 'notificaciones',
  CONFIGURACION: 'configuracion',
} as const;

export type Area = (typeof AREAS)[keyof typeof AREAS];

/** Lista completa de áreas válidas (para validar invitaciones). */
export const ALL_AREAS: Area[] = Object.values(AREAS);

/** Wildcard que representa "todas las áreas" (lo que tiene un admin). */
export const WILDCARD_PERMISSION = '*';

/**
 * Roles con acceso total e implícito a todas las áreas,
 * sin importar lo que tengan en `permissions[]`.
 */
export const FULL_ACCESS_ROLES = ['CORPORATE_ADMIN', 'SUPERADMIN'] as const;
