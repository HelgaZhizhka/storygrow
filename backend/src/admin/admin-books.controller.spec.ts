jest.mock('../generated/prisma/client', () => ({
  PrismaClient: class {},
}));

import { Test } from '@nestjs/testing';
import { AdminBooksController } from './admin-books.controller';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  book: { count: jest.fn() },
  storyEval: { findMany: jest.fn() },
};

const REAL_JUDGE_SCORES = {
  ageAppropriateVocab: 8,
  hasMoralLesson: 8,
  structureCompleteness: 8,
  safetyForChildren: 8,
  length: 8,
  earnedResolution: 8,
  registerMatch: 9,
};

const FAST_FLOW_PLACEHOLDER = {
  judgeScores: {},
  finalScore: 0,
  passed: true,
  attempt: 1,
};

describe('AdminBooksController.getMetrics', () => {
  let controller: AdminBooksController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      controllers: [AdminBooksController],
      providers: [{ provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    controller = module.get(AdminBooksController);
  });

  it('excludes Fast Flow placeholder rows from meanFinalScore, meanCriterionScores, and recentEvalCount', async () => {
    mockPrisma.book.count.mockResolvedValueOnce(2).mockResolvedValueOnce(2);
    mockPrisma.storyEval.findMany
      .mockResolvedValueOnce([
        { judgeScores: REAL_JUDGE_SCORES, finalScore: 9, passed: true, attempt: 1 },
        FAST_FLOW_PLACEHOLDER,
      ])
      .mockResolvedValueOnce([{ judgeScores: REAL_JUDGE_SCORES }, { judgeScores: {} }]);

    const result = await controller.getMetrics();

    // A Fast Flow finalScore of 0 must not drag this down from the real 9.
    expect(result.meanFinalScore).toBe(9);
    expect(result.recentEvalCount).toBe(1);
    expect(result.meanCriterionScores.registerMatch).toBe(9);
    // Only the real-judge row in firstAttemptEvals should count.
    expect(result.passedFirstAttempt).toBe(1);
  });

  it('reports null meanFinalScore and zero recentEvalCount when only Fast Flow rows exist', async () => {
    mockPrisma.book.count.mockResolvedValueOnce(1).mockResolvedValueOnce(1);
    mockPrisma.storyEval.findMany
      .mockResolvedValueOnce([FAST_FLOW_PLACEHOLDER])
      .mockResolvedValueOnce([{ judgeScores: {} }]);

    const result = await controller.getMetrics();

    expect(result.meanFinalScore).toBeNull();
    expect(result.recentEvalCount).toBe(0);
    expect(result.passedFirstAttempt).toBe(0);
  });
});
