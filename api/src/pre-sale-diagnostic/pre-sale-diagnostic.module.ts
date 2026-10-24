import { Module } from '@nestjs/common';
import { PreSaleDiagnosticService } from './pre-sale-diagnostic.service';
import { PreSaleDiagnosticController } from './pre-sale-diagnostic.controller';

/**
 * Diagnóstico pre-venta público (Fase 4, concepto de Paolo). EmailModule y
 * NotificationsModule ya son globales (mismo criterio que MarketingModule).
 */
@Module({
  controllers: [PreSaleDiagnosticController],
  providers: [PreSaleDiagnosticService],
  exports: [PreSaleDiagnosticService],
})
export class PreSaleDiagnosticModule {}
