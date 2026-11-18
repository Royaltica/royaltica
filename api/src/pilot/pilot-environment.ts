export class PilotEnvironmentError extends Error {}

/** Valida el destino antes de crear el cliente Prisma o consultar datos. */
export function assertPilotEnvironment(env: NodeJS.ProcessEnv = process.env): string {
  if (env.NODE_ENV === 'production') {
    throw new PilotEnvironmentError('La semilla del piloto no está permitida en producción.');
  }

  const databaseUrl = env.DATABASE_URL ?? '';
  let database: URL;
  try {
    database = new URL(databaseUrl);
    if (!['postgres:', 'postgresql:'].includes(database.protocol) || !database.hostname || database.searchParams.has('host')) {
      throw new Error();
    }
  } catch {
    throw new PilotEnvironmentError('DATABASE_URL no es una URL válida de PostgreSQL con un host explícito. No se ejecutó la operación.');
  }

  const host = database.hostname.startsWith('[') ? database.hostname.slice(1, -1) : database.hostname;
  if (!['localhost', '127.0.0.1', '::1'].includes(host) && env.PILOT_SEED_ALLOW_HOST !== host) {
    throw new PilotEnvironmentError(`Host bloqueado para el piloto: ${host}. Para staging, PILOT_SEED_ALLOW_HOST debe coincidir exactamente con ese host.`);
  }
  return databaseUrl;
}
