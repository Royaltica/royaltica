/**
 * Crea (idempotente) un usuario SUPERADMIN de la plataforma.
 * No es destructivo: se puede correr sin borrar datos. Si el email ya
 * existe como User (p. ej. ya iniciaste sesión alguna vez con Google/Firebase
 * con ese correo), solo le sube el rol a SUPERADMIN y conserva todo lo demás
 * (su firebaseUid real, su organizationId, etc.) — no lo recrea.
 *
 * Email por defecto: jgmalfavaun@gmail.com (José). Para crear otro
 * SUPERADMIN, pasa el correo como argumento:
 *   npx ts-node prisma/create-superadmin.ts otro@correo.com
 */
import { PrismaClient, UserRole, UserStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = (process.argv[2] || 'jgmalfavaun@gmail.com').toLowerCase();
  const user = await prisma.user.upsert({
    where: { email },
    update: { role: UserRole.SUPERADMIN, isActive: true, status: UserStatus.ACTIVE },
    create: {
      // Placeholder: se sobrescribe solo con el UID real de Firebase en el
      // primer login real con este correo (ver auth.service.ts verifyToken,
      // flujo de "primer ingreso del invitado").
      firebaseUid: `seed-superadmin-${email}`,
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
