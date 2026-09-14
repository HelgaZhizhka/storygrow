import { mockPrisma, createBooksServiceForTest } from './books.service.test-helpers';
import { HttpException } from '@nestjs/common';
import { SubscriptionPlan } from '../generated/prisma/client';
import { BooksService } from './books.service';

// Personalization seeds (#197) default to empty; most createBook tests don't
// exercise them, so spread this to satisfy the required DTO fields.
const noSeeds = { interests: [], motifs: [], favoriteWords: [] };

describe('BooksService.createBook', () => {
  let service: BooksService;

  beforeEach(async () => {
    service = await createBooksServiceForTest();
  });

  it('rejects a childId the user does not own', async () => {
    mockPrisma.child.findFirst.mockResolvedValueOnce(null);

    await expect(
      service.createBook('user-1', {
        childId: 'other-child',
        learningGoalId: 'g1',
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
      protagonistMode: 'child',
      artStyle: 'watercolor',
      ...noSeeds,
    });

    expect(mockPrisma.$transaction).toHaveBeenCalled();

    expect(result.id).toBe('book-1');
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
        protagonistMode: 'child',
        artStyle: 'watercolor',
        ...noSeeds,
      }),
    ).rejects.toThrow(HttpException);
  });
});
