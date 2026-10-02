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
import { SettingsService } from '../settings/settings.service';
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
    private readonly settings: SettingsService,
  ) {}

  /**
   * Estimado del costo del mes en curso para la organización, según el
   * `billingModel` configurado (spec "Mejoras V1", sección 5 — 4 esquemas).
   * No es una factura: es una proyección para que el corporativo entienda
   * qué le costaría el mes bajo el esquema elegido.
   *  - SUBSCRIPTION: solo `subscriptionFeeMxn` (cuota fija).
   *  - VOLUMETRIC: mensajes de cobranza enviados este mes × `messageRateMxn`.
   *    Un "mensaje" = un canal (WhatsApp o correo) de un recordatorio
   *    (ReceivablesService.dispatchReminder ya audita cada envío en
   *    InvoiceAuditLog con action=REMINDER_SENT y metadata.channels).
   *  - RECOVERY: % (`recoveryFeePercent`) sobre el monto de facturas CxC
   *    cobradas este mes cuyo total sea >= `recoveryFeeMinInvoiceMxn`
   *    ("únicamente cuentas grandes de cartera", spec).
   *  - HYBRID: `subscriptionFeeMxn` (mínima) + el componente VOLUMETRIC.
   */
  async estimateMonthlyCost(user: AuthenticatedUser) {
    const organizationId = this.requireOrg(user);
    const orgSettings = await this.settings.get(organizationId);

    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const [messageCount, recoveredInvoices] = await Promise.all([
      this.countBillableMessages(organizationId, from, to),
      orgSettings.billingModel === 'RECOVERY'
        ? this.sumLargeRecoveredInvoices(
            organizationId,
            from,
            to,
            orgSettings.recoveryFeeMinInvoiceMxn,
          )
        : Promise.resolve({ count: 0, amount: 0 }),
    ]);

    const volumetricCostMxn =
      Math.round(messageCount * orgSettings.messageRateMxn * 100) / 100;
    const recoveryCostMxn =
      Math.round(
        recoveredInvoices.amount * (orgSettings.recoveryFeePercent / 100) * 100,
      ) / 100;

    let totalMxn = 0;
    if (orgSettings.billingModel === 'SUBSCRIPTION') {
      totalMxn = orgSettings.subscriptionFeeMxn;
    } else if (orgSettings.billingModel === 'VOLUMETRIC') {
      totalMxn = volumetricCostMxn;
    } else if (orgSettings.billingModel === 'RECOVERY') {
      totalMxn = recoveryCostMxn;
    } else {
      totalMxn = orgSettings.subscriptionFeeMxn + volumetricCostMxn;
    }

    return {
      billingModel: orgSettings.billingModel,
      period: { from: from.toISOString(), to: to.toISOString() },
      volumetric: {
        messageCount,
        rateMxn: orgSettings.messageRateMxn,
        costMxn: volumetricCostMxn,
      },
      recovery: {
        invoiceCount: recoveredInvoices.count,
        recoveredAmountMxn: recoveredInvoices.amount,
        feePercent: orgSettings.recoveryFeePercent,
        minInvoiceMxn: orgSettings.recoveryFeeMinInvoiceMxn,
        costMxn: recoveryCostMxn,
      },
      subscriptionFeeMxn: orgSettings.subscriptionFeeMxn,
      estimatedTotalMxn: Math.round(totalMxn * 100) / 100,
      generatedAt: now.toISOString(),
    };
  }

  /** Cuenta canales (WhatsApp + correo) de recordatorios enviados en el período, vía InvoiceAuditLog. */
  private async countBillableMessages(
    organizationId: string,
    from: Date,
    to: Date,
  ): Promise<number> {
    const logs = await this.prisma.invoiceAuditLog.findMany({
      where: {
        action: 'REMINDER_SENT',
        createdAt: { gte: from, lt: to },
        invoice: { organizationId },
      },
      select: { metadata: true },
    });
    return logs.reduce((acc, log) => {
      const channels = (log.metadata as { channels?: { whatsapp?: boolean; email?: boolean } } | null)
        ?.channels;
      return acc + (channels?.whatsapp ? 1 : 0) + (channels?.email ? 1 : 0);
    }, 0);
  }

  /** Suma de facturas CxC cobradas este mes que superan el umbral de "cuenta grande" (modelo RECOVERY). */
  private async sumLargeRecoveredInvoices(
    organizationId: string,
    from: Date,
    to: Date,
    minInvoiceMxn: number,
  ): Promise<{ count: number; amount: number }> {
    const invoices = await this.prisma.invoice.findMany({
      where: {
        organizationId,
        direction: 'RECEIVABLE',
        status: 'PAID',
        deletedAt: null,
        paidDate: { gte: from, lt: to },
        total: { gte: minInvoiceMxn },
      },
      select: { total: true },
    });
    return {
      count: invoices.length,
      amount: invoices.reduce((acc, i) => acc + Number(i.total), 0),
    };
  }

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
