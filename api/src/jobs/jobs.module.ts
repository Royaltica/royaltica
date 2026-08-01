import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { JobsService } from './jobs.service';
import { ReceivablesModule } from '../receivables/receivables.module';
import { DashboardModule } from '../dashboard/dashboard.module';
import { ReportsModule } from '../reports/reports.module';
import { CollectionSequencesModule } from '../collection-sequences/collection-sequences.module';

/**
 * Registra el scheduler de NestJS y las tareas de recordatorio.
 * SettingsService, NotificationsService y EmailService son globales.
 * ReceivablesModule (agente de cobranza), DashboardModule (resumen semanal),
 * ReportsModule (PDF adjunto al resumen semanal) y CollectionSequencesModule
 * (motor de escalamiento multi-paso).
 */
@Module({
  imports: [
    ScheduleModule.forRoot(),
    ReceivablesModule,
    DashboardModule,
    ReportsModule,
    CollectionSequencesModule,
  ],
  providers: [JobsService],
  exports: [JobsService],
})
export class JobsModule {}
