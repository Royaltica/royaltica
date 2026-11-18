import 'dotenv/config';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { resetPilot, seedPilot } from '../src/pilot/pilot-seed';

async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.error('La semilla del piloto no está permitida en producción.');
    process.exitCode = 1;
    return;
  }
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length === 1 && args[0] !== '--reset')) {
    console.error('Uso: npm run seed:piloto o npm run reset:piloto.');
    process.exitCode = 1;
    return;
  }
  const prisma = new PrismaService({ transactionOptions: { timeout: 60_000 } });
  try {
    if (args[0] === '--reset') {
      const deleted = await resetPilot(prisma);
      console.log(deleted ? 'Piloto Demo eliminado.' : 'Piloto Demo no existe; no se borró nada.');
    } else {
      await seedPilot(prisma);
      console.log('Piloto Demo listo: 3 usuarios, 10 clientes, 25 facturas y un estado de cuenta de ejemplo. Plan en modo sombra, sin envío automático.');
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(() => {
  // Los errores de conexión de Prisma pueden incluir credenciales de la URL.
  console.error('No se pudo completar la operación del piloto. Revisa el entorno, la conexión y que no haya datos en conflicto.');
  process.exitCode = 1;
});
