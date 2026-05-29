// Mock the Prisma generated client (ESM-native, incompatible with Jest CJS mode)
jest.mock('../../../generated/prisma/client', () => ({
  Prisma: {
    sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
      strings: Array.from(strings),
      values,
    }),
    raw: (value: string) => value,
  },
  PrismaClient: class {},
}));

import { Test } from '@nestjs/testing';
import { StoryOrchestratorService } from './story-orchestrator.service';
import type { GenerateStoryOptions } from './story-orchestrator.service';
import { StoryGenerationFailedError } from './errors';
import { StoryGeneratorService } from './story-generator.service';
import { StoryEvaluatorService } from './story-evaluator.service';
import { VocabularyRagService } from '../rag/vocabulary-rag.service';
import { PrismaService } from '../../prisma/prisma.service';
import type { Story } from '../schemas';
import type { EvalCheckResult } from './story-evaluator.service';

const validStory: Story = {
  title: 'Маша и кот',
  pages: [
    { template: 'cover', title: 'Маша и кот', illustrationPrompt: 'A girl with cat' },
    { template: 'image-top', text: 'Маша играла с котом', illustrationPrompt: 'Girl playing' },
    { template: 'image-bottom', text: 'Кот убежал', illustrationPrompt: 'Cat running' },
    { template: 'image-left', text: 'Маша искала кота', illustrationPrompt: 'Girl searching' },
    {
      template: 'image-left',
      text: 'Маша нашла кота и обняла',
      illustrationPrompt: 'Girl hugging cat',
    },
    { template: 'final', text: 'Дружба важна', illustrationPrompt: 'Girl and cat friends' },
  ],
  discussionQuestions: [
    'Что случилось?',
    'Почему кот убежал?',
    'Как искала Маша?',
    'Что узнала Маша?',
    'Что важно?',
  ],
};

const passingEval: EvalCheckResult = {
  passed: true,
  judgeResult: {
    scores: {
      ageAppropriateVocab: 8,
      hasMoralLesson: 9,
      structureCompleteness: 8,
      safetyForChildren: 10,
      length: 8,
    },
    reasoning: 'Well-structured story.',
    finalScore: 8.6,
  },
  computedFinalScore: 8.6,
  outOfCorpus: [],
  structuralErrors: [],
  vocabularyCompliance: 1.0,
};

const failingEval: EvalCheckResult = {
  passed: false,
  judgeResult: {
    scores: {
      ageAppropriateVocab: 4,
      hasMoralLesson: 5,
      structureCompleteness: 4,
      safetyForChildren: 6,
      length: 5,
    },
    reasoning: 'Needs improvement.',
    finalScore: 4.8,
  },
  computedFinalScore: 4.8,
  outOfCorpus: ['чужое'],
  structuralErrors: [],
  vocabularyCompliance: 0.5,
};

const opts: GenerateStoryOptions = {
  bookId: 'book-1',
  childName: 'Маша',
  childAge: 6,
  topic: 'дружба',
  learningGoal: 'научиться дружить',
};

interface StoryEvalCreateArgs {
  data: {
    bookId: string;
    passed: boolean;
    attempt: number;
    finalScore: number;
    judgeScores: unknown;
    judgeReasoning: string;
    vocabularyCompliance: number;
  };
  select: { id: true };
}

const mockGenerator = { generateStory: jest.fn<Promise<Story>, [unknown]>() };
const mockEvaluator = { evaluate: jest.fn<Promise<EvalCheckResult>, [unknown]>() };
const mockVocabRag = { retrieve: jest.fn().mockResolvedValue(['маша', 'кот', 'дружба']) };
const mockPrisma = {
  storyEval: {
    create: jest.fn<Promise<{ id: string }>, [StoryEvalCreateArgs]>().mockResolvedValue({
      id: 'eval-1',
    }),
  },
};

describe('StoryOrchestratorService', () => {
  let orchestrator: StoryOrchestratorService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockGenerator.generateStory.mockResolvedValue(validStory);
    mockEvaluator.evaluate.mockResolvedValue(passingEval);
    mockVocabRag.retrieve.mockResolvedValue(['маша', 'кот', 'дружба']);
    mockPrisma.storyEval.create.mockResolvedValue({ id: 'eval-1' });

    const module = await Test.createTestingModule({
      providers: [
        StoryOrchestratorService,
        { provide: StoryGeneratorService, useValue: mockGenerator },
        { provide: StoryEvaluatorService, useValue: mockEvaluator },
        { provide: VocabularyRagService, useValue: mockVocabRag },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    orchestrator = module.get(StoryOrchestratorService);
  });

  it('returns story and evalId on first passing attempt', async () => {
    const result = await orchestrator.generate(opts);
    expect(result.story).toEqual(validStory);
    expect(result.evalId).toBe('eval-1');
    expect(result.attempts).toBe(1);
  });

  it('writes a StoryEval row with passed=true on success', async () => {
    await orchestrator.generate(opts);
    const call = mockPrisma.storyEval.create.mock.calls[0][0];
    expect(call.data.bookId).toBe('book-1');
    expect(call.data.passed).toBe(true);
    expect(call.data.attempt).toBe(1);
    expect(call.data.finalScore).toBe(8.6);
  });

  it('retries on failing eval and succeeds on second attempt', async () => {
    mockEvaluator.evaluate.mockResolvedValueOnce(failingEval).mockResolvedValueOnce(passingEval);

    const result = await orchestrator.generate(opts);
    expect(result.attempts).toBe(2);
    expect(mockPrisma.storyEval.create).toHaveBeenCalledTimes(2);
  });

  it('writes passed=false for the failing attempt', async () => {
    mockEvaluator.evaluate.mockResolvedValueOnce(failingEval).mockResolvedValueOnce(passingEval);

    await orchestrator.generate(opts);
    expect(mockPrisma.storyEval.create.mock.calls[0][0].data.passed).toBe(false);
    expect(mockPrisma.storyEval.create.mock.calls[1][0].data.passed).toBe(true);
  });

  it('throws StoryGenerationFailedError after all attempts fail', async () => {
    mockEvaluator.evaluate.mockResolvedValue(failingEval);
    await expect(orchestrator.generate(opts)).rejects.toThrow(StoryGenerationFailedError);
  });

  it('passes structural errors to feedback on retry', async () => {
    const structuralFailEval: EvalCheckResult = {
      ...failingEval,
      structuralErrors: ["First page must use the 'cover' template"],
    };
    mockEvaluator.evaluate
      .mockResolvedValueOnce(structuralFailEval)
      .mockResolvedValueOnce(passingEval);

    await orchestrator.generate(opts);
    // Second generateStory call should receive feedback
    const secondCall = mockGenerator.generateStory.mock.calls[1][0] as { feedback?: string };
    expect(secondCall.feedback).toContain('cover');
  });

  it('retrieves allowed words using correct gradeLevel for childAge', async () => {
    await orchestrator.generate({ ...opts, childAge: 6 });
    // age 6 → gradeLevel 1
    expect(mockVocabRag.retrieve).toHaveBeenCalledWith(
      expect.objectContaining({ gradeLevel: 1, topic: opts.topic }),
    );
  });
});
