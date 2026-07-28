import {
  Injectable,
  Logger,
  OnModuleInit,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import type { Env } from '../config/env.validation';

/**
 * Servicio wrapper de Stripe.
 * Si STRIPE_SECRET_KEY está vacío, todos los métodos lanzan BadRequestException
 * indicando que Stripe no está configurado.
 */
@Injectable()
export class StripeService implements OnModuleInit {
  private readonly logger = new Logger(StripeService.name);
  private stripe: Stripe | null = null;

  constructor(private readonly config: ConfigService<Env, true>) {}

  onModuleInit(): void {
    const secretKey = this.config.get('STRIPE_SECRET_KEY', { infer: true });
    if (secretKey) {
      this.stripe = new Stripe(secretKey, { apiVersion: '2026-06-24.dahlia' });
      this.logger.log('Stripe SDK inicializado');
    } else {
      this.logger.warn('STRIPE_SECRET_KEY no configurado — módulo en modo stub');
    }
  }

  private ensureClient(): Stripe {
    if (!this.stripe) {
      throw new BadRequestException(
        'Stripe no está configurado. Define STRIPE_SECRET_KEY.',
      );
    }
    return this.stripe;
  }

  // ─── Checkout Sessions ───────────────────────────────────

  /** Crear sesión de checkout para suscripción o pago único. */
  async createCheckoutSession(params: {
    priceId: string;
    customerId?: string;
    customerEmail?: string;
    successUrl: string;
    cancelUrl: string;
    mode?: Stripe.Checkout.SessionCreateParams.Mode;
    metadata?: Record<string, string>;
  }): Promise<Stripe.Checkout.Session> {
    const stripe = this.ensureClient();
    return stripe.checkout.sessions.create({
      mode: params.mode ?? 'subscription',
      line_items: [{ price: params.priceId, quantity: 1 }],
      customer: params.customerId,
      customer_email: params.customerId ? undefined : params.customerEmail,
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      metadata: params.metadata,
    });
  }

  /** Crear portal de billing para que el cliente gestione su suscripción. */
  async createBillingPortalSession(params: {
    customerId: string;
    returnUrl: string;
  }): Promise<Stripe.BillingPortal.Session> {
    const stripe = this.ensureClient();
    return stripe.billingPortal.sessions.create({
      customer: params.customerId,
      return_url: params.returnUrl,
    });
  }

  // ─── Customers ───────────────────────────────────────────

  /** Crear un customer en Stripe vinculado a una organización. */
  async createCustomer(params: {
    email: string;
    name: string;
    metadata?: Record<string, string>;
  }): Promise<Stripe.Customer> {
    const stripe = this.ensureClient();
    return stripe.customers.create({
      email: params.email,
      name: params.name,
      metadata: params.metadata,
    });
  }

  /** Obtener un customer por su ID. */
  async getCustomer(customerId: string): Promise<Stripe.Customer | Stripe.DeletedCustomer> {
    const stripe = this.ensureClient();
    return stripe.customers.retrieve(customerId);
  }

  // ─── Subscriptions ──────────────────────────────────────

  /** Obtener la suscripción activa de un customer. */
  async getActiveSubscription(
    customerId: string,
  ): Promise<Stripe.Subscription | null> {
    const stripe = this.ensureClient();
    const { data } = await stripe.subscriptions.list({
      customer: customerId,
      status: 'active',
      limit: 1,
    });
    return data[0] ?? null;
  }

  /** Cancelar una suscripción al final del periodo de facturación. */
  async cancelSubscription(
    subscriptionId: string,
  ): Promise<Stripe.Subscription> {
    const stripe = this.ensureClient();
    return stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });
  }

  // ─── Webhook Verification ───────────────────────────────

  /** Verificar y parsear un evento de webhook de Stripe. */
  constructWebhookEvent(
    payload: Buffer,
    signature: string,
  ): Stripe.Event {
    const stripe = this.ensureClient();
    const secret = this.config.get('STRIPE_WEBHOOK_SECRET', { infer: true });
    if (!secret) {
      throw new BadRequestException('STRIPE_WEBHOOK_SECRET no configurado');
    }
    return stripe.webhooks.constructEvent(payload, signature, secret);
  }
}
