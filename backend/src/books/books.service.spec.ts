import { mockPrisma, createBooksServiceForTest } from './books.service.test-helpers';
import { SubscriptionPlan } from '../generated/prisma/client';
import { BooksService } from './books.service';

describe('BooksService.getQuota', () => {
  let service: BooksService;

  beforeEach(async () => {
    service = await createBooksServiceForTest();
  });

  it('returns free plan with limit=1 when no subscription', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValueOnce(null);
    mockPrisma.book.count.mockResolvedValueOnce(0);

    const quota = await service.getQuota('user-1');

    expect(quota).toEqual({ plan: SubscriptionPlan.free, used: 0, limit: 1 });
  });

  it('returns premium plan with limit=30 for an active subscription', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValueOnce({
      plan: SubscriptionPlan.premium,
      status: 'active',
    });
    mockPrisma.book.count.mockResolvedValueOnce(20);

    const quota = await service.getQuota('user-1');

    expect(quota).toEqual({ plan: SubscriptionPlan.premium, used: 20, limit: 30 });
  });

  it('falls back to free plan for canceled subscription', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValueOnce({
      plan: SubscriptionPlan.premium,
      status: 'canceled',
    });
    mockPrisma.book.count.mockResolvedValueOnce(0);

    const quota = await service.getQuota('user-1');

    expect(quota.plan).toBe(SubscriptionPlan.free);
    expect(quota.limit).toBe(1);
  });

  it('accepts trialing status as active', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValueOnce({
      plan: SubscriptionPlan.premium,
      status: 'trialing',
    });
    mockPrisma.book.count.mockResolvedValueOnce(2);

    const quota = await service.getQuota('user-1');

    expect(quota.plan).toBe(SubscriptionPlan.premium);
    expect(quota.limit).toBe(30);
  });

  it('excludes failed and images_failed books from the count, so a generation error does not cost a quota slot (#280)', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValueOnce(null);
    mockPrisma.book.count.mockResolvedValueOnce(0);

    await service.getQuota('user-1');

    type CountArg = { where: { status?: { notIn: string[] } } };
    const countCalls = mockPrisma.book.count.mock.calls as Array<[CountArg]>;
    expect(countCalls[0][0].where.status).toEqual({ notIn: ['failed', 'images_failed'] });
  });
});
