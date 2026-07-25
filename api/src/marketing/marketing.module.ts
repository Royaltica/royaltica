import { Module } from '@nestjs/common';
import { MarketingService } from './marketing.service';
import { MarketingController } from './marketing.controller';
import { AdminLeadsController } from './admin-leads.controller';
import { LeadsAdminService } from './leads-admin.service';

/**
 * Captura de leads públicos desde royaltica.com + panel admin para
 * operarlos (SUPERADMIN). EmailModule y NotificationsModule ya son globales.
 */
@Module({
  controllers: [MarketingController, AdminLeadsController],
  providers: [MarketingService, LeadsAdminService],
  exports: [MarketingService, LeadsAdminService],
})
export class MarketingModule {}
