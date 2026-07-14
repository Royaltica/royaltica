// Variables mínimas para que validateEnv no aborte el arranque.
process.env.NODE_ENV = 'production';
process.env.DATABASE_URL = 'postgresql://u:p@localhost:5432/royaltica';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.JWT_SECRET = 'test-secret-test-secret-1234';

// firebase-admin arrastra ESM que jest no transpila.
jest.mock('firebase-admin/app', () => ({
  initializeApp: jest.fn(),
  cert: jest.fn(),
  getApps: jest.fn(() => []),
}));
jest.mock('firebase-admin/auth', () => ({ getAuth: jest.fn() }));

import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { AppModule } from './app.module';
import { PrismaService } from './common/prisma/prisma.service';
import { RedisService } from './common/redis/redis.service';

/**
 * Valida que el grafo completo de DI resuelve: módulos, controladores,
 * guards globales (JwtAuthGuard), JwtStrategy y FirebaseService.
 * Se sustituyen Prisma y Redis para no requerir infraestructura real.
 */
describe('AppModule (grafo de DI)', () => {
  let moduleRef: TestingModule;

  it('compila e inicializa toda la aplicación', async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({
        onModuleInit: jest.fn(),
        onModuleDestroy: jest.fn(),
        isHealthy: jest.fn().mockResolvedValue(true),
      })
      .overrideProvider(RedisService)
      .useValue({
        onModuleDestroy: jest.fn(),
        isHealthy: jest.fn().mockResolvedValue(true),
      })
      .compile();

    const app = moduleRef.createNestApplication();
    await app.init();
    expect(app).toBeDefined();
    await app.close();
  });
});
