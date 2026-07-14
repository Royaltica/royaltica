import { Module } from '@nestjs/common';
import { SuppliersService } from './suppliers.service';
import { SuppliersController } from './suppliers.controller';
import { DocumentsService } from './documents/documents.service';
import { DocumentsController } from './documents/documents.controller';
import { SupplierScoringService } from './scoring/supplier-scoring.service';

@Module({
  controllers: [SuppliersController, DocumentsController],
  providers: [SuppliersService, DocumentsService, SupplierScoringService],
  exports: [SuppliersService, SupplierScoringService, DocumentsService],
})
export class SuppliersModule {}
