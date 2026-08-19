import { Module } from '@nestjs/common';
import { StripeService } from './stripe.service';

// StripeWebhookController vive en BillingModule (necesita BillingService
// para persistir lo que Stripe reporta) — este módulo solo expone el
// wrapper del SDK de Stripe para quien lo necesite (hoy, BillingModule).
@Module({
  providers: [StripeService],
  exports: [StripeService],
})
export class StripeModule {}
