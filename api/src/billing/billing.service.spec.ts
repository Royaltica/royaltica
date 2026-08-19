import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type Stripe from 'stripe';
import { BillingService } from './billing.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { StripeService } from '../stripe/stripe.service';
import { ActivityLogService } from '../activity/activity-log.service';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import type { Env } from '../config/env.validation';

const admin: AuthenticatedUser = {
  id: 'user-1',
  firebaseUid: 'fb-1',
  email: 'admin@royaltica.com',
  role: 'CORPORATE_ADMIN',
  organizationId: 'org-1',
  permissions: ['*'],
  supplierId: null,
};

const noOrgUser: AuthenticatedUser = { ...admin, organizationId: null };

describe('BillingService', () => {
  let service: BillingService;
  let prisma: {
    organization: {
      findUniqueOrThrow: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
  };
  let stripe: {
    createCustomer: jest.Mock;
    createCheckoutSession: jest.Mock;
    createBillingPortalSession: jest.Mock;
  };
  let activity: { record: jest.Mock };

  const ENV_DEFAULTS: Record<string, string> = {
    FRONTEND_URL: 'https://app.royaltica.com',
    STRIPE_PRICE_PRO: 'price_pro_123',
    STRIPE_PRICE_ENTERPRISE: 'price_ent_456',
  };

  beforeEach(() => {
    prisma = {
      organization: {
        findUniqueOrThrow: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };
    stripe = {
      createCustomer: jest.fn(),
      createCheckoutSession: jest.fn(),
      createBillingPortalSession: jest.fn(),
    };
    activity = { record: jest.fn().mockResolvedValue(undefined) };
    const config = { get: jest.fn((key: string) => ENV_DEFAULTS[key] ?? '') };

    service = new BillingService(
      prisma as unknown as PrismaService,
      stripe as unknown as StripeService,
      activity as unknown as ActivityLogService,
      config as unknown as ConfigService<Env, true>,
    );
  });

  describe('createCheckoutSession', () => {
    it('rechaza usuarios sin organización', async () => {
      await expect(
        service.createCheckoutSession(noOrgUser, 'PRO'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rechaza un plan sin price ID configurado', async () => {
      prisma.organization.findUniqueOrThrow.mockResolvedValue({
        id: 'org-1',
        name: 'Acme',
        stripeCustomerId: null,
      });
      const configSinPrecios = { get: jest.fn(() => '') };
      const svc = new BillingService(
        prisma as unknown as PrismaService,
        stripe as unknown as StripeService,
        activity as unknown as ActivityLogService,
        configSinPrecios as unknown as ConfigService<Env, true>,
      );
      await expect(svc.createCheckoutSession(admin, 'PRO')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('crea un customer nuevo si la organización no tiene uno', async () => {
      prisma.organization.findUniqueOrThrow.mockResolvedValue({
        id: 'org-1',
        name: 'Acme',
        stripeCustomerId: null,
      });
      stripe.createCustomer.mockResolvedValue({ id: 'cus_new' });
      stripe.createCheckoutSession.mockResolvedValue({ url: 'https://checkout.stripe.com/x' });

      const result = await service.createCheckoutSession(admin, 'PRO');

      expect(stripe.createCustomer).toHaveBeenCalledWith(
        expect.objectContaining({ email: admin.email, name: 'Acme' }),
      );
      expect(prisma.organization.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'org-1' },
          data: { stripeCustomerId: 'cus_new' },
        }),
      );
      expect(stripe.createCheckoutSession).toHaveBeenCalledWith(
        expect.objectContaining({ priceId: 'price_pro_123', customerId: 'cus_new' }),
      );
      expect(result.url).toBe('https://checkout.stripe.com/x');
    });

    it('reutiliza el customer existente sin crear uno nuevo', async () => {
      prisma.organization.findUniqueOrThrow.mockResolvedValue({
        id: 'org-1',
        name: 'Acme',
        stripeCustomerId: 'cus_existing',
      });
      stripe.createCheckoutSession.mockResolvedValue({ url: 'https://checkout.stripe.com/y' });

      await service.createCheckoutSession(admin, 'ENTERPRISE');

      expect(stripe.createCustomer).not.toHaveBeenCalled();
      expect(stripe.createCheckoutSession).toHaveBeenCalledWith(
        expect.objectContaining({ priceId: 'price_ent_456', customerId: 'cus_existing' }),
      );
    });
  });

  describe('createPortalSession', () => {
    it('rechaza si la organización no tiene stripeCustomerId', async () => {
      prisma.organization.findUniqueOrThrow.mockResolvedValue({ stripeCustomerId: null });
      await expect(service.createPortalSession(admin)).rejects.toThrow(BadRequestException);
    });

    it('crea la sesión del portal con el customer existente', async () => {
      prisma.organization.findUniqueOrThrow.mockResolvedValue({ stripeCustomerId: 'cus_1' });
      stripe.createBillingPortalSession.mockResolvedValue({ url: 'https://billing.stripe.com/p' });

      const result = await service.createPortalSession(admin);

      expect(stripe.createBillingPortalSession).toHaveBeenCalledWith(
        expect.objectContaining({ customerId: 'cus_1' }),
      );
      expect(result.url).toBe('https://billing.stripe.com/p');
    });
  });

  describe('webhooks', () => {
    it('applyCheckoutCompleted ignora eventos sin metadata.organizationId', async () => {
      await service.applyCheckoutCompleted({
        id: 'cs_1',
        customer: 'cus_1',
        metadata: {},
      } as unknown as Stripe.Checkout.Session);
      expect(prisma.organization.update).not.toHaveBeenCalled();
    });

    it('applyCheckoutCompleted persiste el stripeCustomerId de la organización', async () => {
      await service.applyCheckoutCompleted({
        id: 'cs_1',
        customer: 'cus_1',
        metadata: { organizationId: 'org-1' },
      } as unknown as Stripe.Checkout.Session);
      expect(prisma.organization.update).toHaveBeenCalledWith({
        where: { id: 'org-1' },
        data: { stripeCustomerId: 'cus_1' },
      });
    });

    it('applySubscriptionChange mapea el price ID al Plan interno y guarda el status', async () => {
      prisma.organization.findUnique.mockResolvedValue({ id: 'org-1', plan: 'FREE' });
      await service.applySubscriptionChange({
        id: 'sub_1',
        customer: 'cus_1',
        status: 'active',
        items: { data: [{ price: { id: 'price_pro_123' } }] },
      } as unknown as Stripe.Subscription);

      expect(prisma.organization.update).toHaveBeenCalledWith({
        where: { id: 'org-1' },
        data: { stripeSubscriptionId: 'sub_1', subscriptionStatus: 'active', plan: 'PRO' },
      });
      expect(activity.record).toHaveBeenCalled();
    });

    it('applySubscriptionChange conserva el plan actual si el price ID no tiene mapeo', async () => {
      prisma.organization.findUnique.mockResolvedValue({ id: 'org-1', plan: 'PRO' });
      await service.applySubscriptionChange({
        id: 'sub_1',
        customer: 'cus_1',
        status: 'active',
        items: { data: [{ price: { id: 'price_desconocido' } }] },
      } as unknown as Stripe.Subscription);

      expect(prisma.organization.update).toHaveBeenCalledWith({
        where: { id: 'org-1' },
        data: { stripeSubscriptionId: 'sub_1', subscriptionStatus: 'active' },
      });
    });

    it('applySubscriptionChange no hace nada si el customer no está vinculado a ninguna organización', async () => {
      prisma.organization.findUnique.mockResolvedValue(null);
      await service.applySubscriptionChange({
        id: 'sub_1',
        customer: 'cus_huerfano',
        status: 'active',
        items: { data: [] },
      } as unknown as Stripe.Subscription);
      expect(prisma.organization.update).not.toHaveBeenCalled();
    });

    it('applySubscriptionDeleted hace downgrade a FREE', async () => {
      prisma.organization.findUnique.mockResolvedValue({ id: 'org-1' });
      await service.applySubscriptionDeleted({
        id: 'sub_1',
        customer: 'cus_1',
      } as unknown as Stripe.Subscription);

      expect(prisma.organization.update).toHaveBeenCalledWith({
        where: { id: 'org-1' },
        data: { plan: 'FREE', subscriptionStatus: 'canceled' },
      });
    });

    it('applyInvoicePaymentFailed marca la organización como past_due sin tocar el plan', async () => {
      prisma.organization.findUnique.mockResolvedValue({ id: 'org-1' });
      await service.applyInvoicePaymentFailed({
        id: 'in_1',
        customer: 'cus_1',
      } as unknown as Stripe.Invoice);

      expect(prisma.organization.update).toHaveBeenCalledWith({
        where: { id: 'org-1' },
        data: { subscriptionStatus: 'past_due' },
      });
    });
  });
});
