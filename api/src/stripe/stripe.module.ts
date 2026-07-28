import { Module } from '@nestjs/common';
import { StripeService } from './stripe.service';
import { StripeWebhookController } from './stripe-webhook.controller';

@Module({
  controllers: [StripeWebhookController],
  providers: [StripeService],
  exports: [StripeService],
})
export class StripeModule {}
