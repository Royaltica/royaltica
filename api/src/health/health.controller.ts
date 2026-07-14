import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from '../common/prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { Public } from '../auth/decorators/public.decorator';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Public()
  @Get()
  @SkipThrottle()
  async check() {
    const [db, redis] = await Promise.all([
      this.prisma.isHealthy(),
      this.redis.isHealthy(),
    ]);
    const ok = db && redis;
    return {
      status: ok ? 'ok' : 'degraded',
      db: db ? 'ok' : 'down',
      redis: redis ? 'ok' : 'down',
      timestamp: new Date().toISOString(),
    };
  }
}
