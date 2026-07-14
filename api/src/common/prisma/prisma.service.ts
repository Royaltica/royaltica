import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Prisma conectado a la base de datos');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.log('Prisma desconectado');
  }

  /**
   * Ejecuta consultas con Row Level Security ACTIVA para una organización:
   * dentro de la transacción, Postgres solo entrega filas de esa org aunque
   * la consulta olvide el filtro por organizationId (defensa en profundidad).
   */
  async withOrg<T>(
    organizationId: string,
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.org_id', ${organizationId}, true)`;
      return fn(tx);
    });
  }

  /** Health check: ejecuta un SELECT 1 contra Postgres. */
  async isHealthy(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch (err) {
      this.logger.error(
        `Health check de DB falló: ${(err as Error).message}`,
      );
      return false;
    }
  }
}
