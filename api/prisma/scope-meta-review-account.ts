/**
 * Reduce el acceso de la cuenta de prueba de Meta (meta-review@royaltica.com)
 * para que SOLO vea la administración de cobranza (área CXC) — ni dashboard,
 * ni finanzas, ni proveedores, ni configuración.
 *
 * - role: CORPORATE_USER (CORPORATE_ADMIN ignora permissions y ve todo).
 * - operationalProfile: SUPERVISOR_GERENTE (vista de administración de
 *   cobranza, no la bandeja ultra-simplificada de AGENTE_EJECUTIVO).
 * - permissions: ['cxc'] explícito (pisa el bundle default del perfil, que
 *   de otro modo incluiría dashboard/finanzas/estados).
 *
 * Uso:
 *   railway run --service "Royáltica" -- sh -c \
 *     'DATABASE_URL="$DATABASE_ADMIN_URL" npx ts-node prisma/scope-meta-review-account.ts'
 */
import { OperationalProfile, PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();
const EMAIL = 'meta-review@royaltica.com';

async function main() {
  const user = await prisma.user.update({
    where: { email: EMAIL },
    data: {
      role: UserRole.CORPORATE_USER,
      operationalProfile: OperationalProfile.SUPERVISOR_GERENTE,
      permissions: ['cxc'],
    },
  });
  console.log(
    `✅ ${user.email} ahora es CORPORATE_USER / SUPERVISOR_GERENTE con permissions: ${JSON.stringify(
      user.permissions,
    )} (solo área Cobranza/CXC).`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
