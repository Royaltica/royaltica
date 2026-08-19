import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Plan } from '@prisma/client';
import type Stripe from 'stripe';
import { PrismaService } from '../common/prisma/prisma.service';
import { ActivityLogService } from '../activity/activity-log.service';
import { StripeService } from '../stripe/stripe.service';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import type { Env } from '../config/env.validation';

/** Planes de pago disponibles para checkout (FREE no se compra: es el default). */
export type PaidPlan = Extract<Plan, 'PRO' | 'ENTERPRISE'>;

/**
 * Orquesta la suscripción de una organización con Stripe: crea el customer
 * y la sesión de checkout/portal, y persiste lo que los webhooks de Stripe
 * reportan (ver StripeWebhookController). Todo el estado vive en columnas
 * dedicadas de Organization (stripeCustomerId/stripeSubscriptionId/
 * subscriptionStatus), no en el JSON `settings` — así el update genérico de
 * `/organization/settings` nunca puede pisar ni falsificar el estado de pago.
 */
@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripe: StripeService,
    private readonly activity: ActivityLogService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  // ─── Checkout / Portal (front-end del corporativo) ──────────

  /** Crea (o reutiliza) el customer de Stripe de la organización y devuelve la URL de checkout. */
  async createCheckoutSession(
    user: AuthenticatedUser,
    plan: PaidPlan,
  ): Promise<{ url: string }> {
    const organizationId = this.requireOrg(user);
    const priceId = this.priceIdForPlan(plan);
    if (!priceId) {
      throw new BadRequestException(
        `El plan ${plan} no tiene un price ID de Stripe configurado (STRIPE_PRICE_${plan}).`,
      );
    }

    const org = await this.prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { id: true, name: true, stripeCustomerId: true },
    });

    const customerId =
      org.stripeCustomerId ??
      (await this.createAndSaveCustomer(organizationId, org.name, user.email));

    const frontendUrl = this.config.get('FRONTEND_URL', { infer: true });
    const session = await this.stripe.createCheckoutSession({
      priceId,
      customerId,
      successUrl: `${frontendUrl}/configuracion?billing=success`,
      cancelUrl: `${frontendUrl}/configuracion?billing=cancelled`,
      metadata: { organizationId },
    });

    if (!session.url) {
      throw new BadRequestException('Stripe no devolvió una URL de checkout.');
    }
    return { url: session.url };
  }

  /** Crea una sesión del billing portal para que el admin gestione su suscripción ya existente. */
  async createPortalSession(user: AuthenticatedUser): Promise<{ url: string }> {
    const organizationId = this.requireOrg(user);
    const org = await this.prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { stripeCustomerId: true },
    });
    if (!org.stripeCustomerId) {
      throw new BadRequestException(
        'Esta organización todavía no tiene una suscripción de Stripe.',
      );
    }

    const frontendUrl = this.config.get('FRONTEND_URL', { infer: true });
    const session = await this.stripe.createBillingPortalSession({
      customerId: org.stripeCustomerId,
      returnUrl: `${frontendUrl}/configuracion`,
    });
    return { url: session.url };
  }

  // ─── Webhooks de Stripe (persistencia) ──────────────────────

  /**
   * `checkout.session.completed`: confirma que el customer/subscription
   * quedaron ligados a la organización. El plan/estatus definitivo lo fija
   * `applySubscriptionChange` (Stripe siempre manda también un evento
   * `customer.subscription.created` en el mismo checkout).
   */
  async applyCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
    const organizationId = session.metadata?.organizationId;
    if (!organizationId) {
      this.logger.warn(
        `checkout.session.completed sin metadata.organizationId (session=${session.id}).`,
      );
      return;
    }
    const customerId =
      typeof session.customer === 'string' ? session.customer : session.customer?.id;
    if (!customerId) return;

    await this.prisma.organization.update({
      where: { id: organizationId },
      data: { stripeCustomerId: customerId },
    });
    this.logger.log(
      `Checkout completado: org=${organizationId} customer=${customerId}.`,
    );
  }

  /** `customer.subscription.created` / `customer.subscription.updated`. */
  async applySubscriptionChange(subscription: Stripe.Subscription): Promise<void> {
    const customerId =
      typeof subscription.customer === 'string'
        ? subscription.customer
        : subscription.customer?.id;
    if (!customerId) return;

    const org = await this.prisma.organization.findUnique({
      where: { stripeCustomerId: customerId },
      select: { id: true, plan: true },
    });
    if (!org) {
      this.logger.warn(
        `Suscripción de Stripe sin organización vinculada (customer=${customerId}).`,
      );
      return;
    }

    const priceId = subscription.items.data[0]?.price?.id ?? null;
    const plan = priceId ? this.planForPriceId(priceId) : null;
    if (priceId && !plan) {
      this.logger.warn(
        `Price ID de Stripe sin mapeo a Plan interno: ${priceId} (org=${org.id}). Se conserva el plan actual.`,
      );
    }

    await this.prisma.organization.update({
      where: { id: org.id },
      data: {
        stripeSubscriptionId: subscription.id,
        subscriptionStatus: subscription.status,
        ...(plan ? { plan } : {}),
      },
    });
    await this.activity.record({
      organizationId: org.id,
      action: 'BILLING_SUBSCRIPTION_UPDATED',
      entityType: 'Organization',
      entityId: org.id,
      metadata: { status: subscription.status, plan: plan ?? org.plan },
    });
  }

  /** `customer.subscription.deleted`: la suscripción terminó — downgrade a FREE. */
  async applySubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    const customerId =
      typeof subscription.customer === 'string'
        ? subscription.customer
        : subscription.customer?.id;
    if (!customerId) return;

    const org = await this.prisma.organization.findUnique({
      where: { stripeCustomerId: customerId },
      select: { id: true },
    });
    if (!org) return;

    await this.prisma.organization.update({
      where: { id: org.id },
      data: { plan: 'FREE', subscriptionStatus: 'canceled' },
    });
    await this.activity.record({
      organizationId: org.id,
      action: 'BILLING_SUBSCRIPTION_CANCELED',
      entityType: 'Organization',
      entityId: org.id,
    });
    this.logger.log(`Suscripción cancelada: org=${org.id} → downgrade a FREE.`);
  }

  /** `invoice.payment_failed`: marca la organización en grace period (no toca el plan). */
  async applyInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    const customerId =
      typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
    if (!customerId) return;

    const org = await this.prisma.organization.findUnique({
      where: { stripeCustomerId: customerId },
      select: { id: true },
    });
    if (!org) return;

    await this.prisma.organization.update({
      where: { id: org.id },
      data: { subscriptionStatus: 'past_due' },
    });
    this.logger.warn(`Pago fallido: org=${org.id} → subscriptionStatus=past_due.`);
  }

  // ── helpers ───────────────────────────────────────────────

  private async createAndSaveCustomer(
    organizationId: string,
    orgName: string,
    email: string,
  ): Promise<string> {
    const customer = await this.stripe.createCustomer({
      email,
      name: orgName,
      metadata: { organizationId },
    });
    await this.prisma.organization.update({
      where: { id: organizationId },
      data: { stripeCustomerId: customer.id },
    });
    return customer.id;
  }

  private priceIdForPlan(plan: PaidPlan): string | null {
    const key = plan === 'PRO' ? 'STRIPE_PRICE_PRO' : 'STRIPE_PRICE_ENTERPRISE';
    const value = this.config.get(key, { infer: true });
    return value ? value : null;
  }

  private planForPriceId(priceId: string): Plan | null {
    if (priceId === this.config.get('STRIPE_PRICE_PRO', { infer: true })) return 'PRO';
    if (priceId === this.config.get('STRIPE_PRICE_ENTERPRISE', { infer: true }))
      return 'ENTERPRISE';
    return null;
  }

  private requireOrg(user: AuthenticatedUser): string {
    if (!user.organizationId) {
      throw new ForbiddenException('Tu cuenta no pertenece a una organización.');
    }
    return user.organizationId;
  }
}
