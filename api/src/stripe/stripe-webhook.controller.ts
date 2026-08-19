import {
  Controller,
  Post,
  Req,
  Headers,
  Logger,
  HttpCode,
  RawBodyRequest,
} from '@nestjs/common';
import type { Request } from 'express';
import type Stripe from 'stripe';
import { Public } from '../auth/decorators/public.decorator';
import { StripeService } from './stripe.service';
import { BillingService } from '../billing/billing.service';

/**
 * Endpoint público para recibir webhooks de Stripe.
 * Stripe firma cada request; lo verificamos con constructWebhookEvent.
 *
 * Requiere que NestJS reciba el raw body. En main.ts se configura
 * `app.useBodyParser('raw', { type: 'application/json' })` si es necesario,
 * o se usa `rawBody: true` en NestFactory.create.
 */
@Controller('stripe/webhook')
export class StripeWebhookController {
  private readonly logger = new Logger(StripeWebhookController.name);

  constructor(
    private readonly stripe: StripeService,
    private readonly billing: BillingService,
  ) {}

  @Public()
  @Post()
  @HttpCode(200)
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ): Promise<{ received: true }> {
    const rawBody = req.rawBody;
    if (!rawBody) {
      this.logger.error('Raw body no disponible — verificar configuración de NestJS');
      return { received: true };
    }

    let event: Stripe.Event;
    try {
      event = this.stripe.constructWebhookEvent(rawBody, signature);
    } catch (err) {
      this.logger.warn(`Webhook signature inválida: ${(err as Error).message}`);
      return { received: true };
    }

    this.logger.log(`Stripe event: ${event.type} [${event.id}]`);

    try {
      switch (event.type) {
        case 'checkout.session.completed':
          await this.billing.applyCheckoutCompleted(
            event.data.object as Stripe.Checkout.Session,
          );
          break;

        case 'customer.subscription.created':
        case 'customer.subscription.updated':
          await this.billing.applySubscriptionChange(
            event.data.object as Stripe.Subscription,
          );
          break;

        case 'customer.subscription.deleted':
          await this.billing.applySubscriptionDeleted(
            event.data.object as Stripe.Subscription,
          );
          break;

        case 'invoice.payment_succeeded':
          this.logger.log(`Factura pagada [${event.id}].`);
          break;

        case 'invoice.payment_failed':
          await this.billing.applyInvoicePaymentFailed(
            event.data.object as Stripe.Invoice,
          );
          break;

        default:
          this.logger.debug(`Evento no manejado: ${event.type}`);
      }
    } catch (err) {
      // Nunca se responde error a Stripe por un fallo de nuestro lado al
      // procesar el evento (Stripe reintentaría indefinidamente el mismo
      // webhook) — se registra para investigar y se confirma la recepción.
      this.logger.error(
        `Error procesando webhook ${event.type} [${event.id}]: ${
          err instanceof Error ? err.message : err
        }`,
      );
    }

    return { received: true };
  }
}
