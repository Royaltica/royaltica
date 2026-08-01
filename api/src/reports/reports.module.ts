import { Module } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { DashboardModule } from '../dashboard/dashboard.module';

/**
 * Módulo de reportes de cobranza en PDF. Reutiliza los cálculos ya
 * expuestos por DashboardModule (digest, aging, clientes en riesgo) para
 * armar un PDF listo para enviar por correo a la dirección financiera del
 * tenant (caso de uso: Tradespace y sus reportes periódicos a liderazgo).
 */
@Module({
  imports: [DashboardModule],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
