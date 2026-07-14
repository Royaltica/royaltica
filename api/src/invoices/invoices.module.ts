import { Module } from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { InvoicesController } from './invoices.controller';
import { InvoiceAuditService } from './audit/invoice-audit.service';

@Module({
  controllers: [InvoicesController],
  providers: [InvoicesService, InvoiceAuditService],
})
export class InvoicesModule {}
