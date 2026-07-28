import {
  mockPrisma,
  mockLearningGoalSafety,
  createBooksServiceForTest,
} from './books.service.test-helpers';
import { BooksService } from './books.service';

describe('BooksService.listLearningGoals', () => {
  let service: BooksService;

  beforeEach(async () => {
    service = await createBooksServiceForTest();
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

  it('filters to built-in or own goals when no childId is given (age unknown)', async () => {
    mockPrisma.learningGoal.findMany.mockResolvedValueOnce([]);
    await service.listLearningGoals('user-1');
    const call = mockPrisma.learningGoal.findMany.mock.calls[0][0] as { where?: unknown };
    expect(call.where).toEqual({
      OR: [{ createdByUserId: null }, { createdByUserId: 'user-1' }],
    });
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

  it('includes the ownership filter alongside the age filter', async () => {
    mockPrisma.learningGoal.findMany.mockResolvedValueOnce([]);
    await service.listLearningGoals('user-1', undefined, 5);
    const call = mockPrisma.learningGoal.findMany.mock.calls[0][0] as { where?: unknown };
    expect(call.where).toEqual(
      expect.objectContaining({
        OR: [{ createdByUserId: null }, { createdByUserId: 'user-1' }],
      }),
    );
  });
});

describe('BooksService.createCustomLearningGoal', () => {
  let service: BooksService;

  beforeEach(async () => {
    service = await createBooksServiceForTest();
  });

  it('rejects with the safety reason when the check fails', async () => {
    mockLearningGoalSafety.check.mockResolvedValueOnce({
      safe: false,
      reason: 'Тема не подходит для детской книги',
    });

    await expect(
      service.createCustomLearningGoal('user-1', { text: 'something unsafe' }),
    ).rejects.toThrow('Тема не подходит для детской книги');
    expect(mockPrisma.learningGoal.create).not.toHaveBeenCalled();
  });

  it('fails closed when the safety check itself throws', async () => {
    mockLearningGoalSafety.check.mockRejectedValueOnce(new Error('timeout'));

    await expect(
      service.createCustomLearningGoal('user-1', { text: 'любовь к чтению' }),
    ).rejects.toThrow('Не удалось проверить цель');
    expect(mockPrisma.learningGoal.create).not.toHaveBeenCalled();
  });

  it('creates a virtue goal owned by the user when safe', async () => {
    mockLearningGoalSafety.check.mockResolvedValueOnce({ safe: true });
    mockPrisma.learningGoal.create.mockResolvedValueOnce({ id: 'g-new' });

    await service.createCustomLearningGoal('user-1', { text: 'любовь к чтению' });

    expect(mockPrisma.learningGoal.create).toHaveBeenCalledWith({
      data: {
        title: 'любовь к чтению',
        description: 'любовь к чтению',
        arcType: 'virtue',
        createdByUserId: 'user-1',
      },
    });
  });

  it('forces virtue for a 3-4 child even if flaw was requested', async () => {
    mockLearningGoalSafety.check.mockResolvedValueOnce({ safe: true });
    mockPrisma.learningGoal.create.mockResolvedValueOnce({ id: 'g-new' });

    await service.createCustomLearningGoal('user-1', {
      text: 'терпение',
      childAge: 3,
      arcType: 'flaw',
    });

    expect(mockPrisma.learningGoal.create).toHaveBeenCalledWith({
      data: {
        title: 'терпение',
        description: 'терпение',
        arcType: 'virtue',
        createdByUserId: 'user-1',
      },
    });
  });

  it('sets a 5-6 age range for a flaw goal requested by a 5-6 child', async () => {
    mockLearningGoalSafety.check.mockResolvedValueOnce({ safe: true });
    mockPrisma.learningGoal.create.mockResolvedValueOnce({ id: 'g-new' });

    await service.createCustomLearningGoal('user-1', {
      text: 'терпение',
      childAge: 6,
      arcType: 'flaw',
    });

    expect(mockPrisma.learningGoal.create).toHaveBeenCalledWith({
      data: {
        title: 'терпение',
        description: 'терпение',
        arcType: 'flaw',
        createdByUserId: 'user-1',
        ageRangeMin: 5,
        ageRangeMax: 6,
      },
    });
  });
});
