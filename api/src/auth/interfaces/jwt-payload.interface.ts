import type { UserRole } from '@prisma/client';

/**
 * Contenido del JWT propio que emite Royáltica tras verificar
 * el ID token de Firebase. Es lo que viaja en cada request.
 */
export interface JwtPayload {
  /** ID interno del User en PostgreSQL (no el de Firebase). */
  sub: string;
  firebaseUid: string;
  email: string;
  role: UserRole;
  /** Multi-tenancy: organización a la que pertenece. Null para SUPERADMIN. */
  organizationId: string | null;
  /** Áreas autorizadas. Para admins viaja como ['*']. */
  permissions: string[];
  /** ID del proveedor si el usuario es PROVIDER. */
  supplierId: string | null;
  iat?: number;
  exp?: number;
}
