/**
 * Crea (idempotente) el usuario SUPERADMIN de la plataforma — el CEO.
 * No es destructivo: se puede correr sin borrar datos.
 *   npx ts-node prisma/create-superadmin.ts
 */
import { PrismaClient, UserRole, UserStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = 'admin@royaltica.com';
  const user = await prisma.user.upsert({
    where: { email },
    update: { role: UserRole.SUPERADMIN, isActive: true, status: UserStatus.ACTIVE },
    create: {
      firebaseUid: 'seed-superadmin-uid',
      organizationId: null,
      role: UserRole.SUPERADMIN,
      email,
      name: 'Administrador Royáltica',
      isActive: true,
      status: UserStatus.ACTIVE,
      permissions: [],
    },
  });
  console.log(`✅ SUPERADMIN listo: ${user.email} (id ${user.id})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
