import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService
  extends Redis
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(RedisService.name);

  constructor(config: ConfigService) {
    super(config.getOrThrow<string>('REDIS_URL'), {
      maxRetriesPerRequest: 3,
      lazyConnect: false,
    });
  }

  onModuleInit(): void {
    this.on('connect', () => this.logger.log('Redis conectado'));
    this.on('error', (err) =>
      this.logger.error(`Error de Redis: ${err.message}`),
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.quit();
    this.logger.log('Redis desconectado');
  }

  /** Health check: hace PING a Redis. */
  async isHealthy(): Promise<boolean> {
    try {
      const res = await this.ping();
      return res === 'PONG';
    } catch (err) {
      this.logger.error(
        `Health check de Redis falló: ${(err as Error).message}`,
      );
      return false;
    }
  }
}
