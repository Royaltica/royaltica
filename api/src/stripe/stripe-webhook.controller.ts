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

  constructor(private readonly stripe: StripeService) {}

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

    switch (event.type) {
      case 'checkout.session.completed':
        await this.onCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case 'customer.subscription.updated':
        await this.onSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await this.onSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.payment_succeeded':
        await this.onInvoicePaid(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await this.onInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        this.logger.debug(`Evento no manejado: ${event.type}`);
    }

    return { received: true };
  }

  // ─── Event Handlers ─────────────────────────────────────
  // TODO: Conectar con OrganizationService para actualizar plan/status.

  private async onCheckoutCompleted(
    session: Stripe.Checkout.Session,
  ): Promise<void> {
    this.logger.log(
      `Checkout completado: customer=${session.customer}, subscription=${session.subscription}`,
    );
    // Aquí se vincularía el stripeCustomerId y subscriptionId a la Organization.
  }

  private async onSubscriptionUpdated(
    subscription: Stripe.Subscription,
  ): Promise<void> {
    this.logger.log(
      `Suscripción actualizada: ${subscription.id} → status=${subscription.status}`,
    );
  }

  private async onSubscriptionDeleted(
    subscription: Stripe.Subscription,
  ): Promise<void> {
    this.logger.log(`Suscripción cancelada: ${subscription.id}`);
    // Downgrade a plan free o desactivar features premium.
  }

  private async onInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
    this.logger.log(
      `Factura pagada: ${invoice.id}, amount=${invoice.amount_paid}`,
    );
  }

  private async onInvoicePaymentFailed(
    invoice: Stripe.Invoice,
  ): Promise<void> {
    this.logger.warn(
      `Pago fallido: invoice=${invoice.id}, customer=${invoice.customer}`,
    );
    // Notificar al admin de la organización.
  }
}
