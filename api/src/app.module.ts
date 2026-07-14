import { randomUUID } from 'node:crypto';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import type { IncomingMessage, ServerResponse } from 'node:http';

import { validateEnv } from './config/env.validation';
import { PrismaModule } from './common/prisma/prisma.module';
import { RedisModule } from './common/redis/redis.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { FirebaseModule } from './auth/firebase/firebase.module';
import { UsersModule } from './users/users.module';
import { StorageModule } from './storage/storage.module';
import { SuppliersModule } from './suppliers/suppliers.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { GeminiModule } from './gemini/gemini.module';
import { SatModule } from './sat/sat.module';
import { InvoicesModule } from './invoices/invoices.module';
import { SettingsModule } from './settings/settings.module';
import { ActivityModule } from './activity/activity.module';
import { OrganizationModule } from './organization/organization.module';
import { FiscalModule } from './fiscal/fiscal.module';
import { EmailModule } from './email/email.module';
import { NotificationsModule } from './notifications/notifications.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { PaymentsModule } from './payments/payments.module';
import { FactorajeModule } from './factoraje/factoraje.module';
import { PortalModule } from './portal/portal.module';
import { JobsModule } from './jobs/jobs.module';
import { ErpModule } from './erp/erp.module';
import { AiModule } from './ai/ai.module';
import { UsageModule } from './usage/usage.module';
import { AdminModule } from './admin/admin.module';
import { WhatsappModule } from './whatsapp/whatsapp.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),

    // Logger estructurado con request-id en cada log
    LoggerModule.forRoot({
      pinoHttp: {
        genReqId: (req: IncomingMessage, res: ServerResponse) => {
          const existing = req.headers['x-request-id'];
          const id =
            (Array.isArray(existing) ? existing[0] : existing) ?? randomUUID();
          res.setHeader('x-request-id', id);
          return id;
        },
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        redact: [
          'req.headers.authorization',
          'req.headers.cookie',
          // El SSE manda el JWT como ?token=; lo ocultamos de los logs.
          'req.query.token',
        ],
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { singleLine: true } }
            : undefined,
      },
    }),

    // Rate limiting global: 100 req / 60s por IP
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),

    PrismaModule,
    RedisModule,
    HealthModule,
    FirebaseModule,
    StorageModule,
    GeminiModule,
    SatModule,
    SettingsModule,
    ActivityModule,
    EmailModule,
    NotificationsModule,
    WebhooksModule,
    UsageModule,
    WhatsappModule,
    AuthModule,
    UsersModule,
    OrganizationModule,
    SuppliersModule,
    DashboardModule,
    InvoicesModule,
    FiscalModule,
    PaymentsModule,
    FactorajeModule,
    PortalModule,
    JobsModule,
    ErpModule,
    AiModule,
    AdminModule,
  ],
  providers: [
    // Orden de guards globales: rate-limit → autenticación JWT.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
