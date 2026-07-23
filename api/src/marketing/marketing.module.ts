import { Module } from '@nestjs/common';
import { MarketingService } from './marketing.service';
import { MarketingController } from './marketing.controller';

/**
 * Captura de leads públicos desde royaltica.com.
 * EmailModule y NotificationsModule ya son globales.
 */
@Module({
  controllers: [MarketingController],
  providers: [MarketingService],
  exports: [MarketingService],
})
export class MarketingModule {}
