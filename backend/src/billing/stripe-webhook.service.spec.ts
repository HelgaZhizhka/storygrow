jest.mock('../../generated/prisma/client', () => ({
  PrismaClient: class {},
  SubscriptionPlan: {
    free: 'free',
    basic: 'basic',
    premium: 'premium',
  },
  SubscriptionStatus: {
    active: 'active',
    canceled: 'canceled',
    past_due: 'past_due',
    trialing: 'trialing',
  },
}));

import { PrismaService } from '../prisma/prisma.service';
import { StripeWebhookService, type StripeWebhookEvent } from './stripe-webhook.service';

function prismaError(code: string): Error & { code: string } {
  const error = new Error(code) as Error & { code: string };
  error.code = code;
  return error;
}

function stripeEvent(overrides: Partial<StripeWebhookEvent> = {}): StripeWebhookEvent {
  return {
    id: 'evt_123',
    type: 'customer.subscription.updated',
    data: {
      object: {
        id: 'sub_123',
        status: 'active',
        current_period_end: 1_799_712_000,
        metadata: {
          userId: 'user_123',
          plan: 'premium',
        },
      },
    },
    ...overrides,
  };
}

function createPrismaMock() {
  return {
    stripeWebhookEvent: {
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({}),
    },
    subscription: {
      upsert: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
    },
  };
}

describe('StripeWebhookService', () => {
  it('claims the Stripe event before syncing subscription state', async () => {
    const prisma = createPrismaMock();
    const service = new StripeWebhookService(prisma as unknown as PrismaService);

    await expect(service.process(stripeEvent())).resolves.toMatchObject({
      eventId: 'evt_123',
      received: true,
      status: 'processed',
    });

    expect(prisma.stripeWebhookEvent.create).toHaveBeenCalledWith({
      data: { id: 'evt_123', type: 'customer.subscription.updated' },
    });
    expect(prisma.subscription.upsert).toHaveBeenCalledWith({
      where: { userId: 'user_123' },
      create: {
        userId: 'user_123',
        stripeSubscriptionId: 'sub_123',
        status: 'active',
        plan: 'premium',
        periodEnd: expect.any(Date) as Date,
      },
      update: {
        stripeSubscriptionId: 'sub_123',
        status: 'active',
        plan: 'premium',
        periodEnd: expect.any(Date) as Date,
      },
    });
    expect(prisma.stripeWebhookEvent.update).toHaveBeenCalledWith({
      where: { id: 'evt_123' },
      data: { processedAt: expect.any(Date) as Date },
    });
  });

  it('returns duplicate without running subscription side effects', async () => {
    const prisma = createPrismaMock();
    prisma.stripeWebhookEvent.create.mockRejectedValueOnce(prismaError('P2002'));
    const service = new StripeWebhookService(prisma as unknown as PrismaService);

    await expect(service.process(stripeEvent())).resolves.toEqual({
      eventId: 'evt_123',
      received: true,
      status: 'duplicate',
    });

    expect(prisma.subscription.upsert).not.toHaveBeenCalled();
    expect(prisma.stripeWebhookEvent.update).not.toHaveBeenCalled();
  });

  it('releases the event claim when processing fails so Stripe can retry', async () => {
    const prisma = createPrismaMock();
    prisma.subscription.upsert.mockRejectedValueOnce(new Error('database down'));
    const service = new StripeWebhookService(prisma as unknown as PrismaService);

    await expect(service.process(stripeEvent())).rejects.toThrow('database down');

    expect(prisma.stripeWebhookEvent.delete).toHaveBeenCalledWith({
      where: { id: 'evt_123' },
    });
  });

  it('updates an existing subscription for invoice payment failures', async () => {
    const prisma = createPrismaMock();
    const service = new StripeWebhookService(prisma as unknown as PrismaService);

    await expect(
      service.process(
        stripeEvent({
          type: 'invoice.payment_failed',
          data: { object: { subscription: 'sub_123' } },
        }),
      ),
    ).resolves.toMatchObject({ status: 'processed' });

    expect(prisma.subscription.update).toHaveBeenCalledWith({
      where: { stripeSubscriptionId: 'sub_123' },
      data: { status: 'past_due' },
    });
  });
});
