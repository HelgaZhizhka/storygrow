jest.mock('../generated/prisma/client', () => ({
  PrismaClient: class {},
  SubscriptionPlan: { free: 'free', basic: 'basic', premium: 'premium' },
  SubscriptionStatus: {
    active: 'active',
    canceled: 'canceled',
    past_due: 'past_due',
    trialing: 'trialing',
  },
}));

jest.mock('stripe');

import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import type { StripeInstance, StripeEvent } from './billing-types';
import type { JwtPayload } from '../auth/auth.service';

const mockUser: JwtPayload = { sub: 'user-1', email: 'a@b.com', role: 'user' };

describe('BillingController', () => {
  let controller: BillingController;
  let billingService: { handleEvent: jest.Mock };
  let mockConstructEvent: jest.Mock;
  let mockCreateSession: jest.Mock;

  beforeEach(async () => {
    mockConstructEvent = jest.fn();
    mockCreateSession = jest.fn();
    (Stripe as jest.MockedClass<typeof Stripe>).mockImplementation(
      () =>
        ({
          webhooks: { constructEvent: mockConstructEvent },
          checkout: { sessions: { create: mockCreateSession } },
        }) as unknown as StripeInstance,
    );

    billingService = { handleEvent: jest.fn().mockResolvedValue(undefined) };

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
                STRIPE_PRICE_BASIC: 'price_basic',
                STRIPE_PRICE_PREMIUM: 'price_premium',
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
    it('creates a checkout session and returns url', async () => {
      mockCreateSession.mockResolvedValueOnce({ url: 'https://checkout.stripe.com/pay/cs_test' });

      const result = await controller.createSubscription(mockUser, { plan: 'basic' });

      expect(mockCreateSession).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'subscription',
          line_items: [{ price: 'price_basic', quantity: 1 }],
          subscription_data: { metadata: { userId: 'user-1', plan: 'basic' } },
        }),
      );
      expect(result).toEqual({ url: 'https://checkout.stripe.com/pay/cs_test' });
    });

    it('uses correct price ID for premium plan', async () => {
      mockCreateSession.mockResolvedValueOnce({ url: 'https://checkout.stripe.com/pay/cs_prem' });

      await controller.createSubscription(mockUser, { plan: 'premium' });

      expect(mockCreateSession).toHaveBeenCalledWith(
        expect.objectContaining({
          line_items: [{ price: 'price_premium', quantity: 1 }],
        }),
      );
    });

    it('throws BadRequestException when Stripe returns no url', async () => {
      mockCreateSession.mockResolvedValueOnce({ url: null });

      await expect(controller.createSubscription(mockUser, { plan: 'basic' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws ZodError on invalid plan', async () => {
      const badBody: unknown = { plan: 'enterprise' };
      await expect(controller.createSubscription(mockUser, badBody)).rejects.toThrow();
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
