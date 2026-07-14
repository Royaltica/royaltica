import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { JobsService } from './jobs.service';

/**
 * Registra el scheduler de NestJS y las tareas de recordatorio.
 * SettingsService, NotificationsService y EmailService son globales.
 */
@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [JobsService],
  exports: [JobsService],
})
export class JobsModule {}
