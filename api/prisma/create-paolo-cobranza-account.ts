/**
 * Crea (idempotente) una cuenta de prueba para Paolo, con acceso SOLO a la
 * administración de Cuentas por Cobrar (CXC/Cobranza), dentro de la
 * organización REAL de Royáltica (la misma que usa director@royaltica.com) —
 * para poder ver cambios y probar los mensajes de recordatorio contra datos
 * reales, sin exponerle el resto de las áreas (dashboard, finanzas,
 * proveedores, configuración).
 *
 * - role: CORPORATE_USER (CORPORATE_ADMIN ignora permissions y ve todo).
 * - operationalProfile: SUPERVISOR_GERENTE (vista de administración, no la
 *   bandeja ultra-simplificada de AGENTE_EJECUTIVO).
 * - permissions: ['cxc'] explícito.
 *
 * Uso:
 *   railway run --service "Royáltica" -- sh -c \
 *     'DATABASE_URL="$DATABASE_ADMIN_URL" npx ts-node prisma/create-paolo-cobranza-account.ts'
 */
import {
  OperationalProfile,
  PrismaClient,
  UserRole,
  UserStatus,
} from '@prisma/client';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const prisma = new PrismaClient();

const EMAIL = 'paolo.cobranza@royaltica.com';
const PASSWORD = 'Cobranza2026!Royaltica';
const NAME = 'Paolo (Cobranza)';
// Organización real de Royáltica: la misma de director@royaltica.com.
const ORG_ADMIN_EMAIL = 'director@royaltica.com';

async function main() {
  const orgAdmin = await prisma.user.findUnique({
    where: { email: ORG_ADMIN_EMAIL },
    select: { organizationId: true, organization: { select: { name: true } } },
  });
  if (!orgAdmin?.organizationId) {
    throw new Error(
      `No encontré la organización de ${ORG_ADMIN_EMAIL}. Ajusta ORG_ADMIN_EMAIL en el script.`,
    );
  }
  const organizationId = orgAdmin.organizationId;

  // ── Firebase: crear/actualizar con contraseña real ──
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const rawKey = process.env.FIREBASE_PRIVATE_KEY;
  if (!projectId || !clientEmail || !rawKey) {
    throw new Error('Faltan FIREBASE_* en el entorno.');
  }
  const privateKey = rawKey.replace(/\\n/g, '\n');
  const app =
    getApps()[0] ?? initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  const auth = getAuth(app);

  let firebaseUid: string;
  try {
    const existing = await auth.getUserByEmail(EMAIL);
    await auth.updateUser(existing.uid, {
      password: PASSWORD,
      emailVerified: true,
      disabled: false,
    });
    firebaseUid = existing.uid;
    console.log(`Firebase: usuario existente actualizado (uid ${firebaseUid}).`);
  } catch {
    const created = await auth.createUser({
      email: EMAIL,
      password: PASSWORD,
      displayName: NAME,
      emailVerified: true,
      disabled: false,
    });
    firebaseUid = created.uid;
    console.log(`Firebase: usuario creado (uid ${firebaseUid}).`);
  }

  // ── Postgres: User scoped a CXC dentro de la org real ──
  const user = await prisma.user.upsert({
    where: { email: EMAIL },
    update: {
      firebaseUid,
      organizationId,
      role: UserRole.CORPORATE_USER,
      operationalProfile: OperationalProfile.SUPERVISOR_GERENTE,
      permissions: ['cxc'],
      isActive: true,
      status: UserStatus.ACTIVE,
    },
    create: {
      firebaseUid,
      organizationId,
      role: UserRole.CORPORATE_USER,
      operationalProfile: OperationalProfile.SUPERVISOR_GERENTE,
      permissions: ['cxc'],
      email: EMAIL,
      name: NAME,
      isActive: true,
      status: UserStatus.ACTIVE,
    },
  });

  console.log('\n✅ Cuenta de Paolo (solo Cobranza/CXC) lista:');
  console.log(`   Correo:       ${EMAIL}`);
  console.log(`   Contraseña:   ${PASSWORD}`);
  console.log(`   Organización: ${orgAdmin.organization?.name} (${organizationId})`);
  console.log(`   User id:      ${user.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
