jest.mock('../generated/prisma/client', () => ({
  PrismaClient: class {},
  SubscriptionPlan: { free: 'free', basic: 'basic', premium: 'premium' },
  SubscriptionStatus: {
    active: 'active',
    trialing: 'trialing',
    canceled: 'canceled',
    past_due: 'past_due',
  },
}));

import { Test } from '@nestjs/testing';
import { HttpException } from '@nestjs/common';
import { SubscriptionPlan } from '../generated/prisma/client';
import { BooksService } from './books.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  child: { findMany: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn() },
  learningGoal: { findMany: jest.fn() },
  subscription: { findUnique: jest.fn() },
  book: {
    count: jest.fn(),
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
  },
};

describe('BooksService.getQuota', () => {
  let service: BooksService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [BooksService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = module.get(BooksService);
  });

  it('returns free plan with limit=1 when no subscription', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValueOnce(null);
    mockPrisma.book.count.mockResolvedValueOnce(0);

    const quota = await service.getQuota('user-1');

    expect(quota).toEqual({ plan: SubscriptionPlan.free, used: 0, limit: 1 });
  });

  it('returns basic plan with limit=10 for active basic subscription', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValueOnce({
      plan: SubscriptionPlan.basic,
      status: 'active',
    });
    mockPrisma.book.count.mockResolvedValueOnce(3);

    const quota = await service.getQuota('user-1');

    expect(quota).toEqual({ plan: SubscriptionPlan.basic, used: 3, limit: 10 });
  });

  it('returns premium plan with limit=null (unlimited)', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValueOnce({
      plan: SubscriptionPlan.premium,
      status: 'active',
    });
    mockPrisma.book.count.mockResolvedValueOnce(50);

    const quota = await service.getQuota('user-1');

    expect(quota).toEqual({ plan: SubscriptionPlan.premium, used: 50, limit: null });
  });

  it('falls back to free plan for canceled subscription', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValueOnce({
      plan: SubscriptionPlan.basic,
      status: 'canceled',
    });
    mockPrisma.book.count.mockResolvedValueOnce(0);

    const quota = await service.getQuota('user-1');

    expect(quota.plan).toBe(SubscriptionPlan.free);
    expect(quota.limit).toBe(1);
  });

  it('accepts trialing status as active', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValueOnce({
      plan: SubscriptionPlan.basic,
      status: 'trialing',
    });
    mockPrisma.book.count.mockResolvedValueOnce(2);

    const quota = await service.getQuota('user-1');

    expect(quota.plan).toBe(SubscriptionPlan.basic);
    expect(quota.limit).toBe(10);
  });
});

describe('BooksService.createBook', () => {
  let service: BooksService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [BooksService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = module.get(BooksService);
  });

  it('rejects a childId the user does not own', async () => {
    mockPrisma.child.findFirst.mockResolvedValueOnce(null);

    await expect(
      service.createBook('user-1', {
        childId: 'other-child',
        learningGoalId: 'g1',
        mode: 'custom',
      }),
    ).rejects.toThrow(HttpException);
    expect(mockPrisma.book.create).not.toHaveBeenCalled();
  });

  it('throws 402 when free quota (1 book) is exceeded', async () => {
    mockPrisma.child.findFirst.mockResolvedValueOnce({ id: 'c1' });
    mockPrisma.subscription.findUnique.mockResolvedValueOnce(null);
    mockPrisma.book.count.mockResolvedValueOnce(1);

    await expect(
      service.createBook('user-1', { childId: 'c1', learningGoalId: 'g1', mode: 'custom' }),
    ).rejects.toThrow(HttpException);
  });

  it('creates book when under quota', async () => {
    mockPrisma.child.findFirst.mockResolvedValueOnce({ id: 'c1' });
    mockPrisma.subscription.findUnique.mockResolvedValueOnce(null);
    mockPrisma.book.count.mockResolvedValueOnce(0);
    mockPrisma.book.create.mockResolvedValueOnce({
      id: 'book-1',
      status: 'pending',
      childId: 'c1',
      learningGoalId: 'g1',
      createdAt: new Date(),
    });

    const result = await service.createBook('user-1', {
      childId: 'c1',
      learningGoalId: 'g1',
      mode: 'custom',
    });

    expect(result.id).toBe('book-1');
    expect(result.mode).toBe('custom');
  });

  it('does not enforce quota for premium plan', async () => {
    mockPrisma.child.findFirst.mockResolvedValueOnce({ id: 'c1' });
    mockPrisma.subscription.findUnique.mockResolvedValueOnce({
      plan: SubscriptionPlan.premium,
      status: 'active',
    });
    mockPrisma.book.count.mockResolvedValueOnce(999);
    mockPrisma.book.create.mockResolvedValueOnce({
      id: 'book-2',
      status: 'pending',
      childId: 'c1',
      learningGoalId: 'g1',
      createdAt: new Date(),
    });

    await expect(
      service.createBook('user-1', { childId: 'c1', learningGoalId: 'g1', mode: 'custom' }),
    ).resolves.not.toThrow();
  });
});
