import { Module } from '@nestjs/common';
import { ExternalDataSyncService } from './external-data-sync.service';
import { ExternalDataSyncController } from './external-data-sync.controller';
import { FieldMappingService } from './field-mapping.service';

@Module({
  controllers: [ExternalDataSyncController],
  providers: [ExternalDataSyncService, FieldMappingService],
  exports: [ExternalDataSyncService],
})
export class ExternalDataSyncModule {}
