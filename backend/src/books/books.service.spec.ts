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
import { HttpException, NotFoundException } from '@nestjs/common';
import { SubscriptionPlan } from '../generated/prisma/client';
import { BooksService } from './books.service';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../s3/s3.service';

const mockPrisma = {
  child: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    upsert: jest.fn(),
  },
  learningGoal: { findMany: jest.fn() },
  subscription: { findUnique: jest.fn() },
  book: {
    count: jest.fn(),
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    delete: jest.fn(),
  },
};

const mockS3 = { deleteObjects: jest.fn(), uploadObject: jest.fn(), getSignedUrl: jest.fn() };

describe('BooksService.getQuota', () => {
  let service: BooksService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        BooksService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: S3Service, useValue: mockS3 },
      ],
    }).compile();
    service = module.get(BooksService);
  });

  it('returns free plan with unlimited limit (temporary, no Stripe) when no subscription', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValueOnce(null);
    mockPrisma.book.count.mockResolvedValueOnce(0);

    const quota = await service.getQuota('user-1');

    expect(quota).toEqual({ plan: SubscriptionPlan.free, used: 0, limit: null });
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
    expect(quota.limit).toBe(null);
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

// Personalization seeds (#197) default to empty; most createBook tests don't
// exercise them, so spread this to satisfy the required DTO fields.
const noSeeds = { interests: [], motifs: [], favoriteWords: [] };

describe('BooksService.createBook', () => {
  let service: BooksService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        BooksService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: S3Service, useValue: mockS3 },
      ],
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
        protagonistMode: 'child',
        artStyle: 'watercolor',
        ...noSeeds,
      }),
    ).rejects.toThrow(HttpException);
    expect(mockPrisma.book.create).not.toHaveBeenCalled();
  });

  it('createChild stores appearance', async () => {
    mockPrisma.child.upsert.mockResolvedValueOnce({ id: 'c1' });

    await service.createChild('user-1', { name: 'Маша', age: 6, appearance: 'brown hair' });

    expect(mockPrisma.child.upsert).toHaveBeenCalledWith({
      where: { userId_name: { userId: 'user-1', name: 'Маша' } },
      create: {
        userId: 'user-1',
        name: 'Маша',
        age: 6,
        gender: undefined,
        appearance: 'brown hair',
      },
      update: { age: 6, gender: undefined, appearance: 'brown hair' },
    });
  });

  it('createBook persists protagonistMode and artStyle', async () => {
    mockPrisma.child.findFirst.mockResolvedValueOnce({ id: 'c1' });
    mockPrisma.subscription.findUnique.mockResolvedValueOnce(null);
    mockPrisma.book.count.mockResolvedValueOnce(0);
    mockPrisma.book.create.mockResolvedValueOnce({
      id: 'book-9',
      status: 'pending',
      childId: 'c1',
      learningGoalId: 'g1',
      createdAt: new Date(),
    });

    await service.createBook('user-1', {
      childId: 'c1',
      learningGoalId: 'g1',
      mode: 'custom',
      protagonistMode: 'observer',
      artStyle: 'pixel',
      ...noSeeds,
    });

    expect(mockPrisma.book.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        childId: 'c1',
        learningGoalId: 'g1',
        title: '',
        status: 'pending',
        protagonistMode: 'observer',
        artStyle: 'pixel',
        ...noSeeds,
      },
      select: { id: true, status: true, childId: true, learningGoalId: true, createdAt: true },
    });
  });

  it('throws 402 when a plan quota is exceeded (basic: 10 books)', async () => {
    mockPrisma.child.findFirst.mockResolvedValueOnce({ id: 'c1' });
    mockPrisma.subscription.findUnique.mockResolvedValueOnce({
      plan: SubscriptionPlan.basic,
      status: 'active',
    });
    mockPrisma.book.count.mockResolvedValueOnce(10);

    await expect(
      service.createBook('user-1', {
        childId: 'c1',
        learningGoalId: 'g1',
        mode: 'custom',
        protagonistMode: 'child',
        artStyle: 'watercolor',
        ...noSeeds,
      }),
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
      protagonistMode: 'child',
      artStyle: 'watercolor',
      ...noSeeds,
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
      service.createBook('user-1', {
        childId: 'c1',
        learningGoalId: 'g1',
        mode: 'custom',
        protagonistMode: 'child',
        artStyle: 'watercolor',
        ...noSeeds,
      }),
    ).resolves.not.toThrow();
  });
});

describe('BooksService.deleteBook', () => {
  let service: BooksService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        BooksService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: S3Service, useValue: mockS3 },
      ],
    }).compile();
    service = module.get(BooksService);
  });

  it('deletes S3 assets then the book row when owned', async () => {
    mockPrisma.book.findFirst.mockResolvedValueOnce({
      id: 'book-1',
      imageKeys: ['books/book-1/page-1.png'],
      characterPortraitKey: 'books/book-1/portrait.png',
      pdfKey: 'books/book-1/book.pdf',
    });

    await service.deleteBook('user-1', 'book-1');

    expect(mockS3.deleteObjects).toHaveBeenCalledWith([
      'books/book-1/page-1.png',
      'books/book-1/portrait.png',
      'books/book-1/book.pdf',
    ]);
    expect(mockPrisma.book.delete).toHaveBeenCalledWith({ where: { id: 'book-1' } });
  });

  it("throws 404 and does not delete when the book is not the user's", async () => {
    mockPrisma.book.findFirst.mockResolvedValueOnce(null);

    await expect(service.deleteBook('user-1', 'book-x')).rejects.toThrow(NotFoundException);
    expect(mockS3.deleteObjects).not.toHaveBeenCalled();
    expect(mockPrisma.book.delete).not.toHaveBeenCalled();
  });
});

describe('BooksService.listLearningGoals', () => {
  let service: BooksService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        BooksService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: S3Service, useValue: mockS3 },
      ],
    }).compile();
    service = module.get(BooksService);
  });

  it('excludes flaw-arc goals for a 3-year-old child, even if ageRangeMin would include them', async () => {
    mockPrisma.child.findFirst.mockResolvedValueOnce({ id: 'c1', age: 3 });
    mockPrisma.learningGoal.findMany.mockResolvedValueOnce([
      { id: 'g1', title: 'Дружба', arcType: 'virtue' },
    ]);

    await service.listLearningGoals('user-1', 'c1');

    expect(mockPrisma.learningGoal.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          NOT: { arcType: 'flaw' },
        }),
      }),
    );
  });

  it('does NOT exclude flaw-arc goals for a 6-year-old child', async () => {
    mockPrisma.child.findFirst.mockResolvedValueOnce({ id: 'c1', age: 6 });
    mockPrisma.learningGoal.findMany.mockResolvedValueOnce([]);

    await service.listLearningGoals('user-1', 'c1');

    const call = mockPrisma.learningGoal.findMany.mock.calls[0][0] as { where?: unknown };
    expect(call.where).not.toEqual(expect.objectContaining({ NOT: { arcType: 'flaw' } }));
  });

  it('does not filter by arcType when no childId is given (age unknown)', async () => {
    mockPrisma.learningGoal.findMany.mockResolvedValueOnce([]);
    await service.listLearningGoals('user-1');
    const call = mockPrisma.learningGoal.findMany.mock.calls[0][0] as { where?: unknown };
    expect(call.where).toBeUndefined();
  });
});
