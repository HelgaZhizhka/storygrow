import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { BillingService } from './billing.service';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionPlan, SubscriptionStatus } from '../generated/prisma/client';
import type { StripeEvent } from './billing-types';

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

const makeEvent = (type: string, data: object, id = 'evt_001'): StripeEvent =>
  ({ id, type, data: { object: data } }) as unknown as StripeEvent;

describe('BillingService', () => {
  let service: BillingService;
  let prisma: {
    stripeWebhookEvent: { findUnique: jest.Mock; create: jest.Mock };
    subscription: {
      upsert: jest.Mock;
      updateMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      stripeWebhookEvent: { findUnique: jest.fn(), create: jest.fn().mockResolvedValue({}) },
      subscription: {
        upsert: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
    };

    const module = await Test.createTestingModule({
      providers: [BillingService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(BillingService);
  });

  describe('idempotency', () => {
    it('skips processing if event already recorded', async () => {
      prisma.stripeWebhookEvent.findUnique.mockResolvedValue({ id: 'evt_001' });

      await service.handleEvent(makeEvent('customer.subscription.created', {}));

      expect(prisma.stripeWebhookEvent.create).not.toHaveBeenCalled();
      expect(prisma.subscription.upsert).not.toHaveBeenCalled();
    });

    it('records event before processing', async () => {
      prisma.stripeWebhookEvent.findUnique.mockResolvedValue(null);
      const sub = {
        id: 'sub_1',
        customer: 'cus_test1',
        status: 'active',
        current_period_end: 1700000000,
        metadata: { userId: 'user_1', plan: 'premium' },
      };

      await service.handleEvent(makeEvent('customer.subscription.created', sub));

      expect(prisma.stripeWebhookEvent.create).toHaveBeenCalledWith({
        data: { id: 'evt_001', type: 'customer.subscription.created' },
      });
    });
  });

  describe('customer.subscription.created', () => {
    it('upserts subscription with correct data', async () => {
      prisma.stripeWebhookEvent.findUnique.mockResolvedValue(null);
      const sub = {
        id: 'sub_1',
        customer: 'cus_test1',
        status: 'active',
        current_period_end: 1700000000,
        metadata: { userId: 'user_1', plan: 'premium' },
      };

      await service.handleEvent(makeEvent('customer.subscription.created', sub));

      expect(prisma.subscription.upsert).toHaveBeenCalledWith({
        where: { userId: 'user_1' },
        create: {
          userId: 'user_1',
          stripeSubscriptionId: 'sub_1',
          stripeCustomerId: 'cus_test1',
          plan: SubscriptionPlan.premium,
          status: SubscriptionStatus.active,
          periodEnd: new Date(1700000000 * 1000),
        },
        update: {
          stripeSubscriptionId: 'sub_1',
          stripeCustomerId: 'cus_test1',
          plan: SubscriptionPlan.premium,
          status: SubscriptionStatus.active,
          periodEnd: new Date(1700000000 * 1000),
        },
      });
    });

    it('re-subscribing after cancellation upserts by userId, not the new stripeSubscriptionId', async () => {
      // Regression test (production incident, 2026-07-24): a user cancels, then
      // re-subscribes -- Stripe issues a brand-new subscription object (a
      // different id) for the same userId. Keying the upsert on
      // stripeSubscriptionId made this fall through to `create`, which then
      // hit the userId unique constraint against the user's old row and threw,
      // silently dropping the webhook (the account kept showing the free plan).
      prisma.stripeWebhookEvent.findUnique.mockResolvedValue(null);
      const sub = {
        id: 'sub_new_after_resubscribe',
        customer: 'cus_test1',
        status: 'active',
        current_period_end: 1700000000,
        metadata: { userId: 'user_1', plan: 'premium' },
      };

      await service.handleEvent(makeEvent('customer.subscription.created', sub));

      expect(prisma.subscription.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user_1' },
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          update: expect.objectContaining({ stripeSubscriptionId: 'sub_new_after_resubscribe' }),
        }),
      );
    });

    it('persists the Stripe customer id from the webhook payload', async () => {
      prisma.stripeWebhookEvent.findUnique.mockResolvedValue(null);
      const sub = {
        id: 'sub_1',
        customer: 'cus_abc123',
        status: 'active',
        current_period_end: 1700000000,
        metadata: { userId: 'user_1', plan: 'premium' },
      };

      await service.handleEvent(makeEvent('customer.subscription.created', sub));

      expect(prisma.subscription.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          create: expect.objectContaining({ stripeCustomerId: 'cus_abc123' }),
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          update: expect.objectContaining({ stripeCustomerId: 'cus_abc123' }),
        }),
      );
    });

    it('throws BadRequestException when userId metadata is missing', async () => {
      prisma.stripeWebhookEvent.findUnique.mockResolvedValue(null);
      const sub = {
        id: 'sub_1',
        status: 'active',
        current_period_end: 1700000000,
        metadata: {},
      };

      await expect(
        service.handleEvent(makeEvent('customer.subscription.created', sub)),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('customer.subscription.updated', () => {
    it('upserts subscription with updated data', async () => {
      prisma.stripeWebhookEvent.findUnique.mockResolvedValue(null);
      const sub = {
        id: 'sub_1',
        customer: 'cus_test1',
        status: 'past_due',
        current_period_end: 1700000000,
        metadata: { userId: 'user_1', plan: 'premium' },
      };

      await service.handleEvent(makeEvent('customer.subscription.updated', sub, 'evt_002'));

      expect(prisma.subscription.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user_1' },
          update: {
            stripeSubscriptionId: 'sub_1',
            stripeCustomerId: 'cus_test1',
            plan: SubscriptionPlan.premium,
            status: SubscriptionStatus.past_due,
            periodEnd: new Date(1700000000 * 1000),
          },
        }),
      );
    });
  });

  describe('customer.subscription.deleted', () => {
    it('sets status to canceled', async () => {
      prisma.stripeWebhookEvent.findUnique.mockResolvedValue(null);
      const sub = { id: 'sub_1', metadata: {} };

      await service.handleEvent(makeEvent('customer.subscription.deleted', sub, 'evt_003'));

      expect(prisma.subscription.updateMany).toHaveBeenCalledWith({
        where: { stripeSubscriptionId: 'sub_1' },
        data: { status: SubscriptionStatus.canceled },
      });
    });
  });

  describe('invoice.paid', () => {
    it('sets status to active and updates periodEnd', async () => {
      prisma.stripeWebhookEvent.findUnique.mockResolvedValue(null);
      const invoice = { subscription: 'sub_1', period_end: 1700000000 };

      await service.handleEvent(makeEvent('invoice.paid', invoice, 'evt_004'));

      expect(prisma.subscription.updateMany).toHaveBeenCalledWith({
        where: { stripeSubscriptionId: 'sub_1' },
        data: { status: SubscriptionStatus.active, periodEnd: new Date(1700000000 * 1000) },
      });
    });

    it('ignores invoice with no subscription', async () => {
      prisma.stripeWebhookEvent.findUnique.mockResolvedValue(null);
      const invoice = { subscription: null, period_end: 1700000000 };

      await service.handleEvent(makeEvent('invoice.paid', invoice, 'evt_005'));

      expect(prisma.subscription.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('invoice.payment_failed', () => {
    it('sets status to past_due', async () => {
      prisma.stripeWebhookEvent.findUnique.mockResolvedValue(null);
      const invoice = { subscription: 'sub_1', period_end: 1700000000 };

      await service.handleEvent(makeEvent('invoice.payment_failed', invoice, 'evt_006'));

      expect(prisma.subscription.updateMany).toHaveBeenCalledWith({
        where: { stripeSubscriptionId: 'sub_1' },
        data: { status: SubscriptionStatus.past_due },
      });
    });
  });

  describe('unknown event type', () => {
    it('ignores silently without DB write', async () => {
      prisma.stripeWebhookEvent.findUnique.mockResolvedValue(null);

      await service.handleEvent(makeEvent('some.unknown.event', {}, 'evt_007'));

      expect(prisma.subscription.upsert).not.toHaveBeenCalled();
      expect(prisma.subscription.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('hasActiveSubscription', () => {
    it('returns false when the user has no subscription row', async () => {
      prisma.subscription.findUnique.mockResolvedValue(null);
      expect(await service.hasActiveSubscription('user-1')).toBe(false);
    });

    it('returns true for an active subscription', async () => {
      prisma.subscription.findUnique.mockResolvedValue({ status: SubscriptionStatus.active });
      expect(await service.hasActiveSubscription('user-1')).toBe(true);
    });

    it('returns true for a trialing subscription', async () => {
      prisma.subscription.findUnique.mockResolvedValue({ status: SubscriptionStatus.trialing });
      expect(await service.hasActiveSubscription('user-1')).toBe(true);
    });

    it('returns false for a canceled subscription', async () => {
      prisma.subscription.findUnique.mockResolvedValue({ status: SubscriptionStatus.canceled });
      expect(await service.hasActiveSubscription('user-1')).toBe(false);
    });

    it('returns false for a past_due subscription', async () => {
      prisma.subscription.findUnique.mockResolvedValue({ status: SubscriptionStatus.past_due });
      expect(await service.hasActiveSubscription('user-1')).toBe(false);
    });
  });

  describe('getSubscriptionForPortal', () => {
    it('returns null when the user has no subscription', async () => {
      prisma.subscription.findUnique.mockResolvedValue(null);

      const result = await service.getSubscriptionForPortal('user-1');

      expect(result).toBeNull();
    });

    it('returns the subscription and customer ids', async () => {
      prisma.subscription.findUnique.mockResolvedValue({
        stripeSubscriptionId: 'sub_1',
        stripeCustomerId: 'cus_abc123',
      });

      const result = await service.getSubscriptionForPortal('user-1');

      expect(result).toEqual({ stripeSubscriptionId: 'sub_1', stripeCustomerId: 'cus_abc123' });
      expect(prisma.subscription.findUnique).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        select: { stripeSubscriptionId: true, stripeCustomerId: true },
      });
    });
  });

  describe('setStripeCustomerId', () => {
    it('updates the subscription row with the resolved customer id', async () => {
      await service.setStripeCustomerId('user-1', 'cus_abc123');

      expect(prisma.subscription.update).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        data: { stripeCustomerId: 'cus_abc123' },
      });
    });
  });
});
