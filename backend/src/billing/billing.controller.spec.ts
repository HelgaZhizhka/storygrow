jest.mock('../generated/prisma/client', () => ({
  PrismaClient: class {},
  SubscriptionPlan: { free: 'free', premium: 'premium' },
  SubscriptionStatus: {
    active: 'active',
    canceled: 'canceled',
    past_due: 'past_due',
    trialing: 'trialing',
  },
}));

jest.mock('stripe');

import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import type { StripeInstance, StripeEvent } from './billing-types';
import type { JwtPayload } from '../auth/auth.service';

const mockUser: JwtPayload = { sub: 'user-1', email: 'a@b.com', role: 'user' };

describe('BillingController', () => {
  let controller: BillingController;
  let billingService: {
    handleEvent: jest.Mock;
    hasActiveSubscription: jest.Mock;
    getSubscriptionForPortal: jest.Mock;
    setStripeCustomerId: jest.Mock;
  };
  let mockConstructEvent: jest.Mock;
  let mockCreateSession: jest.Mock;
  let mockCreatePortalSession: jest.Mock;
  let mockRetrieveSubscription: jest.Mock;

  beforeEach(async () => {
    mockConstructEvent = jest.fn();
    mockCreateSession = jest.fn();
    mockCreatePortalSession = jest.fn();
    mockRetrieveSubscription = jest.fn();
    (Stripe as jest.MockedClass<typeof Stripe>).mockImplementation(
      () =>
        ({
          webhooks: { constructEvent: mockConstructEvent },
          checkout: { sessions: { create: mockCreateSession } },
          billingPortal: { sessions: { create: mockCreatePortalSession } },
          subscriptions: { retrieve: mockRetrieveSubscription },
        }) as unknown as StripeInstance,
    );

    billingService = {
      handleEvent: jest.fn().mockResolvedValue(undefined),
      hasActiveSubscription: jest.fn().mockResolvedValue(false),
      getSubscriptionForPortal: jest.fn(),
      setStripeCustomerId: jest.fn().mockResolvedValue(undefined),
    };

    const module = await Test.createTestingModule({
      controllers: [BillingController],
      providers: [
        { provide: BillingService, useValue: billingService },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn((key: string) => {
              const values: Record<string, string> = {
                STRIPE_SECRET_KEY: 'sk_test',
                STRIPE_WEBHOOK_SECRET: 'whsec_test',
                FRONTEND_URL: 'http://localhost:3000',
                STRIPE_PRICE_ID: 'price_premium',
              };
              return values[key] ?? 'unknown';
            }),
          },
        },
      ],
    }).compile();

    controller = module.get(BillingController);
  });

  describe('POST /api/stripe/subscribe', () => {
    it('creates a checkout session for the single Premium price and returns url', async () => {
      mockCreateSession.mockResolvedValueOnce({ url: 'https://checkout.stripe.com/pay/cs_test' });

      const result = await controller.createSubscription(mockUser);

      expect(mockCreateSession).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'subscription',
          line_items: [{ price: 'price_premium', quantity: 1 }],
          subscription_data: { metadata: { userId: 'user-1', plan: 'premium' } },
        }),
      );
      expect(result).toEqual({ url: 'https://checkout.stripe.com/pay/cs_test' });
    });

    it('throws BadRequestException when Stripe returns no url', async () => {
      mockCreateSession.mockResolvedValueOnce({ url: null });

      await expect(controller.createSubscription(mockUser)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException instead of creating a session when the user already has an active subscription', async () => {
      billingService.hasActiveSubscription.mockResolvedValueOnce(true);

      await expect(controller.createSubscription(mockUser)).rejects.toThrow(BadRequestException);
      expect(mockCreateSession).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/stripe/portal', () => {
    it('throws NotFoundException when the user has no subscription', async () => {
      billingService.getSubscriptionForPortal.mockResolvedValueOnce(null);

      await expect(controller.createPortalSession(mockUser)).rejects.toThrow(NotFoundException);
      expect(mockCreatePortalSession).not.toHaveBeenCalled();
    });

    it('creates a portal session using the stored customer id', async () => {
      billingService.getSubscriptionForPortal.mockResolvedValueOnce({
        stripeSubscriptionId: 'sub_1',
        stripeCustomerId: 'cus_abc123',
      });
      mockCreatePortalSession.mockResolvedValueOnce({
        url: 'https://billing.stripe.com/p/session_1',
      });

      const result = await controller.createPortalSession(mockUser);

      expect(mockRetrieveSubscription).not.toHaveBeenCalled();
      expect(mockCreatePortalSession).toHaveBeenCalledWith({
        customer: 'cus_abc123',
        return_url: 'http://localhost:3000/account',
      });
      expect(result).toEqual({ url: 'https://billing.stripe.com/p/session_1' });
    });

    it('lazily resolves and persists the customer id when missing on the row', async () => {
      billingService.getSubscriptionForPortal.mockResolvedValueOnce({
        stripeSubscriptionId: 'sub_1',
        stripeCustomerId: null,
      });
      mockRetrieveSubscription.mockResolvedValueOnce({ customer: 'cus_backfilled' });
      mockCreatePortalSession.mockResolvedValueOnce({
        url: 'https://billing.stripe.com/p/session_2',
      });

      const result = await controller.createPortalSession(mockUser);

      expect(mockRetrieveSubscription).toHaveBeenCalledWith('sub_1');
      expect(billingService.setStripeCustomerId).toHaveBeenCalledWith('user-1', 'cus_backfilled');
      expect(mockCreatePortalSession).toHaveBeenCalledWith({
        customer: 'cus_backfilled',
        return_url: 'http://localhost:3000/account',
      });
      expect(result).toEqual({ url: 'https://billing.stripe.com/p/session_2' });
    });

    it('throws BadRequestException when Stripe returns no url', async () => {
      billingService.getSubscriptionForPortal.mockResolvedValueOnce({
        stripeSubscriptionId: 'sub_1',
        stripeCustomerId: 'cus_abc123',
      });
      mockCreatePortalSession.mockResolvedValueOnce({ url: null });

      await expect(controller.createPortalSession(mockUser)).rejects.toThrow(BadRequestException);
    });
  });

  describe('POST /api/stripe/webhooks', () => {
    it('throws BadRequestException on invalid Stripe signature', async () => {
      mockConstructEvent.mockImplementation(() => {
        throw new Error('No signatures found');
      });
      const req = { rawBody: Buffer.from('{}') } as never;

      await expect(controller.handleWebhook('bad-sig', req)).rejects.toThrow(BadRequestException);
    });

    it('returns { received: true } and delegates to BillingService on valid event', async () => {
      const fakeEvent = { id: 'evt_1', type: 'invoice.paid' } as unknown as StripeEvent;
      mockConstructEvent.mockReturnValue(fakeEvent);

      const req = { rawBody: Buffer.from('{}') } as never;
      const result = await controller.handleWebhook('valid-sig', req);

      expect(billingService.handleEvent).toHaveBeenCalledWith(fakeEvent);
      expect(result).toEqual({ received: true });
    });

    it('throws BadRequestException when rawBody is missing', async () => {
      const req = { rawBody: undefined } as never;

      await expect(controller.handleWebhook('sig', req)).rejects.toThrow(BadRequestException);
    });
  });
});
