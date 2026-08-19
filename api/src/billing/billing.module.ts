import { Module } from '@nestjs/common';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';
import { StripeWebhookController } from '../stripe/stripe-webhook.controller';
import { StripeModule } from '../stripe/stripe.module';
import { ActivityModule } from '../activity/activity.module';

@Module({
  imports: [StripeModule, ActivityModule],
  controllers: [BillingController, StripeWebhookController],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}
