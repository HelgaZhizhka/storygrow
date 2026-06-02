import { Test } from '@nestjs/testing';
import Stripe from 'stripe';
import { BadRequestException } from '@nestjs/common';
import { BillingService } from './billing.service';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionPlan, SubscriptionStatus } from '../../generated/prisma/client';

jest.mock('../../generated/prisma/client', () => ({
  PrismaClient: class {},
  SubscriptionPlan: { free: 'free', basic: 'basic', premium: 'premium' },
  SubscriptionStatus: {
    active: 'active',
    canceled: 'canceled',
    past_due: 'past_due',
    trialing: 'trialing',
  },
}));

const makeEvent = (type: string, data: object, id = 'evt_001'): Stripe.Event =>
  ({ id, type, data: { object: data } }) as unknown as Stripe.Event;

describe('BillingService', () => {
  let service: BillingService;
  let prisma: {
    stripeWebhookEvent: { findUnique: jest.Mock; create: jest.Mock };
    subscription: { upsert: jest.Mock; updateMany: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      stripeWebhookEvent: { findUnique: jest.fn(), create: jest.fn().mockResolvedValue({}) },
      subscription: {
        upsert: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({}),
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
        status: 'active',
        current_period_end: 1700000000,
        metadata: { userId: 'user_1', plan: 'basic' },
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
        status: 'active',
        current_period_end: 1700000000,
        metadata: { userId: 'user_1', plan: 'basic' },
      };

      await service.handleEvent(makeEvent('customer.subscription.created', sub));

      expect(prisma.subscription.upsert).toHaveBeenCalledWith({
        where: { stripeSubscriptionId: 'sub_1' },
        create: {
          userId: 'user_1',
          stripeSubscriptionId: 'sub_1',
          plan: SubscriptionPlan.basic,
          status: SubscriptionStatus.active,
          periodEnd: new Date(1700000000 * 1000),
        },
        update: {
          plan: SubscriptionPlan.basic,
          status: SubscriptionStatus.active,
          periodEnd: new Date(1700000000 * 1000),
        },
      });
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
        status: 'past_due',
        current_period_end: 1700000000,
        metadata: { userId: 'user_1', plan: 'premium' },
      };

      await service.handleEvent(makeEvent('customer.subscription.updated', sub, 'evt_002'));

      expect(prisma.subscription.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            status: SubscriptionStatus.past_due,
            plan: SubscriptionPlan.premium,
          }),
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
});
