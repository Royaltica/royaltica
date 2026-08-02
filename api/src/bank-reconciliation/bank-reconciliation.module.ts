import { Module } from '@nestjs/common';
import { BankReconciliationService } from './bank-reconciliation.service';
import { BankReconciliationMatchingService } from './bank-reconciliation-matching.service';
import { BankReconciliationController } from './bank-reconciliation.controller';
// FieldMappingService solo depende de PrismaService: se provee directo acá
// en vez de importar ExternalDataSyncModule (que no la exporta) para evitar
// un acoplamiento innecesario entre módulos de dominios distintos.
import { FieldMappingService } from '../external-data-sync/field-mapping.service';

@Module({
  controllers: [BankReconciliationController],
  providers: [BankReconciliationService, BankReconciliationMatchingService, FieldMappingService],
  exports: [BankReconciliationService, BankReconciliationMatchingService],
})
export class BankReconciliationModule {}
