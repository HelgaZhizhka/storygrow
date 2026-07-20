jest.mock('../generated/prisma/client', () => ({
  PrismaClient: class {},
  SubscriptionPlan: { free: 'free', premium: 'premium' },
  SubscriptionStatus: {
    active: 'active',
    trialing: 'trialing',
    canceled: 'canceled',
    past_due: 'past_due',
  },
}));

import { Test } from '@nestjs/testing';
import { ConflictException, HttpException, NotFoundException } from '@nestjs/common';
import { SubscriptionPlan } from '../generated/prisma/client';
import { BooksService } from './books.service';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../s3/s3.service';

const basePrisma = {
  child: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    upsert: jest.fn(),
  },
  learningGoal: {
    findMany: jest.fn<Promise<unknown[]>, [{ where?: unknown; orderBy?: unknown }]>(),
  },
  subscription: { findUnique: jest.fn() },
  book: {
    count: jest.fn(),
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    delete: jest.fn(),
  },
  $executeRaw: jest.fn(),
};

// createBook runs inside a transaction (#154) — the mock hands the callback
// basePrisma, whose nested spies (book.create etc.) are the same objects mockPrisma exposes.
const mockPrisma = {
  ...basePrisma,
  $transaction: jest.fn((cb: (tx: typeof basePrisma) => unknown) => cb(basePrisma)),
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

  it('throws 402 when a plan quota is exceeded (free: 1 book)', async () => {
    mockPrisma.child.findFirst.mockResolvedValueOnce({ id: 'c1' });
    mockPrisma.subscription.findUnique.mockResolvedValueOnce(null);
    mockPrisma.book.count.mockResolvedValueOnce(1);

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

    expect(mockPrisma.$transaction).toHaveBeenCalled();

    expect(result.id).toBe('book-1');
    expect(result.mode).toBe('custom');
  });

  it('acquires a per-user advisory lock before the quota check, so two concurrent requests cannot both pass it (#154)', async () => {
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

    await service.createBook('user-1', {
      childId: 'c1',
      learningGoalId: 'g1',
      mode: 'custom',
      protagonistMode: 'child',
      artStyle: 'watercolor',
      ...noSeeds,
    });

    expect(mockPrisma.$executeRaw).toHaveBeenCalled();
    const lockCallOrder = mockPrisma.$executeRaw.mock.invocationCallOrder[0];
    const countCallOrder = mockPrisma.book.count.mock.invocationCallOrder[0];
    expect(lockCallOrder).toBeLessThan(countCallOrder);
  });

  it('creates book when under the 30-book premium quota', async () => {
    mockPrisma.child.findFirst.mockResolvedValueOnce({ id: 'c1' });
    mockPrisma.subscription.findUnique.mockResolvedValueOnce({
      plan: SubscriptionPlan.premium,
      status: 'active',
    });
    mockPrisma.book.count.mockResolvedValueOnce(29);
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

  it('throws 402 when the premium quota (30) is exceeded', async () => {
    mockPrisma.child.findFirst.mockResolvedValueOnce({ id: 'c1' });
    mockPrisma.subscription.findUnique.mockResolvedValueOnce({
      plan: SubscriptionPlan.premium,
      status: 'active',
    });
    mockPrisma.book.count.mockResolvedValueOnce(30);

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
});

describe('BooksService.reserveFastFlowBook', () => {
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

    await expect(service.reserveFastFlowBook('user-1', 'other-child', 'g1')).rejects.toThrow(
      HttpException,
    );
    expect(mockPrisma.book.create).not.toHaveBeenCalled();
  });

  it('throws 402 when quota is exceeded, same as the custom flow (#280)', async () => {
    mockPrisma.child.findFirst.mockResolvedValueOnce({ id: 'c1' });
    mockPrisma.subscription.findUnique.mockResolvedValueOnce(null);
    mockPrisma.book.count.mockResolvedValueOnce(1);

    await expect(service.reserveFastFlowBook('user-1', 'c1', 'g1')).rejects.toThrow(HttpException);
    expect(mockPrisma.book.create).not.toHaveBeenCalled();
  });

  it('reserves a placeholder book row atomically, under the same advisory lock as createBook', async () => {
    mockPrisma.child.findFirst.mockResolvedValueOnce({ id: 'c1' });
    mockPrisma.subscription.findUnique.mockResolvedValueOnce(null);
    mockPrisma.book.count.mockResolvedValueOnce(0);
    mockPrisma.book.create.mockResolvedValueOnce({ id: 'book-1' });

    const result = await service.reserveFastFlowBook('user-1', 'c1', 'g1');

    expect(result).toEqual({ id: 'book-1' });
    expect(mockPrisma.book.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        childId: 'c1',
        learningGoalId: 'g1',
        title: '',
        status: 'generating',
      },
      select: { id: true },
    });
    expect(mockPrisma.$executeRaw).toHaveBeenCalled();
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
      status: 'ready',
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

  it.each(['pending', 'generating'])(
    'throws 409 and does not delete a book that is still %s (#280)',
    async (status) => {
      mockPrisma.book.findFirst.mockResolvedValueOnce({
        id: 'book-1',
        status,
        imageKeys: [],
        characterPortraitKey: null,
        pdfKey: null,
      });

      await expect(service.deleteBook('user-1', 'book-1')).rejects.toThrow(ConflictException);
      expect(mockS3.deleteObjects).not.toHaveBeenCalled();
      expect(mockPrisma.book.delete).not.toHaveBeenCalled();
    },
  );
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

    const call = mockPrisma.learningGoal.findMany.mock.calls[0][0] as { where?: unknown };
    expect(call.where).toEqual(expect.objectContaining({ NOT: { arcType: 'flaw' } }));
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

  it('excludes flaw-arc goals for an explicit age of 3, with no childId given', async () => {
    mockPrisma.learningGoal.findMany.mockResolvedValueOnce([]);

    await service.listLearningGoals('user-1', undefined, 3);

    expect(mockPrisma.child.findFirst).not.toHaveBeenCalled();
    const call = mockPrisma.learningGoal.findMany.mock.calls[0][0] as { where?: unknown };
    expect(call.where).toEqual(
      expect.objectContaining({
        ageRangeMin: { lte: 3 },
        ageRangeMax: { gte: 3 },
        NOT: { arcType: 'flaw' },
      }),
    );
  });

  it('prefers explicit age over a childId lookup when both are given', async () => {
    mockPrisma.learningGoal.findMany.mockResolvedValueOnce([]);

    await service.listLearningGoals('user-1', 'c1', 5);

    expect(mockPrisma.child.findFirst).not.toHaveBeenCalled();
    const call = mockPrisma.learningGoal.findMany.mock.calls[0][0] as { where?: unknown };
    expect(call.where).toEqual(
      expect.objectContaining({ ageRangeMin: { lte: 5 }, ageRangeMax: { gte: 5 } }),
    );
    expect(call.where).not.toEqual(expect.objectContaining({ NOT: { arcType: 'flaw' } }));
  });
});
