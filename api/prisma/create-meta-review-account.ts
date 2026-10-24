/**
 * Crea (idempotente) una organización y cuenta de prueba DEDICADA para que
 * los revisores de Meta (App Review de WhatsApp) puedan entrar a Royáltica
 * con correo + contraseña reales, sin tocar datos de clientes reales.
 *
 * - Organización nueva "Royáltica · Demo Meta Review" (RFC placeholder).
 * - Usuario CORPORATE_ADMIN con contraseña real en Firebase (no invitación
 *   por link — el revisor necesita poder escribir usuario/contraseña
 *   directamente en el formulario de Meta).
 * - Status ACTIVE desde el inicio (sin 2FA, sin fricción de "primer ingreso").
 *
 * Uso (correr con DATABASE_URL apuntando a DATABASE_ADMIN_URL, igual que
 * create-superadmin.ts):
 *   railway run --service "Royáltica" -- sh -c \
 *     'DATABASE_URL="$DATABASE_ADMIN_URL" npx ts-node prisma/create-meta-review-account.ts'
 */
import { PrismaClient, UserRole, UserStatus } from '@prisma/client';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const prisma = new PrismaClient();

const EMAIL = 'meta-review@royaltica.com';
const PASSWORD = 'MetaReview2026!Royaltica';
const NAME = 'Meta Reviewer';
const ORG_NAME = 'Royáltica · Demo Meta Review';
const ORG_RFC = 'DEMO260101XXX';
const ORG_LEGAL_NAME = 'Royáltica Demo Meta Review SA de CV';

async function main() {
  // ── 1. Firebase: crear (o actualizar) el usuario con contraseña real ──
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const rawKey = process.env.FIREBASE_PRIVATE_KEY;
  if (!projectId || !clientEmail || !rawKey) {
    throw new Error(
      'Faltan FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY en el entorno.',
    );
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

  // ── 2. Organización dedicada (idempotente por RFC) ──
  let org = await prisma.organization.findUnique({ where: { rfc: ORG_RFC } });
  if (!org) {
    org = await prisma.organization.create({
      data: {
        name: ORG_NAME,
        rfc: ORG_RFC,
        legalName: ORG_LEGAL_NAME,
        plan: 'FREE',
      },
    });
    console.log(`Organización creada: ${org.name} (${org.id}).`);
  } else {
    console.log(`Organización ya existía: ${org.name} (${org.id}).`);
  }

  // ── 3. Usuario CORPORATE_ADMIN en Postgres, ya ACTIVE (sin invitación) ──
  const user = await prisma.user.upsert({
    where: { email: EMAIL },
    update: {
      firebaseUid,
      organizationId: org.id,
      role: UserRole.CORPORATE_ADMIN,
      isActive: true,
      status: UserStatus.ACTIVE,
    },
    create: {
      firebaseUid,
      organizationId: org.id,
      role: UserRole.CORPORATE_ADMIN,
      email: EMAIL,
      name: NAME,
      isActive: true,
      status: UserStatus.ACTIVE,
      permissions: [],
    },
  });

  console.log('\n✅ Cuenta de prueba para Meta lista:');
  console.log(`   Correo:      ${EMAIL}`);
  console.log(`   Contraseña:  ${PASSWORD}`);
  console.log(`   Organización: ${org.name} (${org.id})`);
  console.log(`   User id:     ${user.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
