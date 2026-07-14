import type { UserRole } from '@prisma/client';

/**
 * Usuario autenticado inyectado en `request.user` por la JwtStrategy.
 * Es lo que recibe el decorator `@CurrentUser()`.
 */
export interface AuthenticatedUser {
  id: string;
  firebaseUid: string;
  email: string;
  role: UserRole;
  organizationId: string | null;
  permissions: string[];
  supplierId: string | null;
}
