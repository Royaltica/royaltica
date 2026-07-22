import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { JobsService } from './jobs.service';
import { ReceivablesModule } from '../receivables/receivables.module';
import { DashboardModule } from '../dashboard/dashboard.module';

/**
 * Registra el scheduler de NestJS y las tareas de recordatorio.
 * SettingsService, NotificationsService y EmailService son globales.
 * ReceivablesModule (agente de cobranza) y DashboardModule (resumen semanal).
 */
@Module({
  imports: [ScheduleModule.forRoot(), ReceivablesModule, DashboardModule],
  providers: [JobsService],
  exports: [JobsService],
})
export class JobsModule {}
