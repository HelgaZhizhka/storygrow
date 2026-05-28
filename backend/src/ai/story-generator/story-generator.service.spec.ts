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

jest.mock('ai', () => ({ generateObject: jest.fn() }));
jest.mock('@ai-sdk/openai', () => ({
  createOpenAI: jest.fn(() => (model: string) => ({ model })),
}));

import { Test } from '@nestjs/testing';
import { generateObject } from 'ai';
import { StoryGeneratorService } from './story-generator.service';
import type { GenerateStoryOptions } from './story-generator.service';
import { StoryGenerationFailedError } from './errors';
import { VocabularyRagService } from '../rag/vocabulary-rag.service';
import { PrismaService } from '../../prisma/prisma.service';
import type { Story } from '../schemas';

const mockGenerateObject = generateObject as jest.MockedFunction<typeof generateObject>;

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

const validJudge = {
  scores: {
    ageAppropriateVocab: 8,
    hasMoralLesson: 9,
    structureCompleteness: 8,
    safetyForChildren: 10,
    length: 8,
  },
  reasoning: 'Well-structured story with age-appropriate vocabulary.',
  finalScore: 8.6,
};

const opts: GenerateStoryOptions = {
  bookId: 'book-1',
  childName: 'Маша',
  childAge: 6,
  topic: 'дружба',
  learningGoal: 'научиться дружить',
};

const mockVocabRag = {
  retrieve: jest
    .fn()
    .mockResolvedValue([
      'маша',
      'кот',
      'котом',
      'кота',
      'играла',
      'дружба',
      'нашла',
      'обняла',
      'искала',
      'убежал',
      'случилось',
      'важна',
      'важно',
      'узнала',
    ]),
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

const mockPrisma = {
  storyEval: {
    create: jest.fn<Promise<{ id: string }>, [StoryEvalCreateArgs]>().mockResolvedValue({
      id: 'eval-1',
    }),
  },
};

describe('StoryGeneratorService', () => {
  let service: StoryGeneratorService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockGenerateObject.mockReset();
    mockVocabRag.retrieve.mockResolvedValue([
      'маша',
      'кот',
      'котом',
      'кота',
      'играла',
      'дружба',
      'нашла',
      'обняла',
      'искала',
      'убежал',
      'случилось',
      'важна',
      'важно',
      'узнала',
    ]);
    mockPrisma.storyEval.create.mockResolvedValue({ id: 'eval-1' });
    const module = await Test.createTestingModule({
      providers: [
        StoryGeneratorService,
        { provide: VocabularyRagService, useValue: mockVocabRag },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get(StoryGeneratorService);
  });

  it('returns story and evalId on first passing attempt', async () => {
    mockGenerateObject
      .mockResolvedValueOnce({ object: validStory } as never)
      .mockResolvedValueOnce({ object: validJudge } as never);
    const result = await service.generate(opts);

    expect(result.story).toEqual(validStory);
    expect(result.evalId).toBe('eval-1');
    expect(result.attempts).toBe(1);
  });

  it('writes a StoryEval row with passed=true on success', async () => {
    mockGenerateObject
      .mockResolvedValueOnce({ object: validStory } as never)
      .mockResolvedValueOnce({ object: validJudge } as never);

    await service.generate(opts);

    const call = mockPrisma.storyEval.create.mock.calls[0][0];
    expect(call.data.bookId).toBe('book-1');
    expect(call.data.passed).toBe(true);
    expect(call.data.attempt).toBe(1);
    expect(call.data.finalScore).toBe(8.6);
  });

  it('retries on low judge score and succeeds on second attempt', async () => {
    const failingJudge = {
      ...validJudge,
      scores: {
        ageAppropriateVocab: 4,
        hasMoralLesson: 5,
        structureCompleteness: 4,
        safetyForChildren: 6,
        length: 5,
      },
      finalScore: 4.8,
    };
    mockGenerateObject
      .mockResolvedValueOnce({ object: validStory } as never)
      .mockResolvedValueOnce({ object: failingJudge } as never)
      .mockResolvedValueOnce({ object: validStory } as never)
      .mockResolvedValueOnce({ object: validJudge } as never);

    const result = await service.generate(opts);

    expect(result.attempts).toBe(2);
    expect(mockPrisma.storyEval.create).toHaveBeenCalledTimes(2);
  });

  it('writes passed=false for the failing attempt', async () => {
    const failingJudge = {
      ...validJudge,
      scores: {
        ageAppropriateVocab: 4,
        hasMoralLesson: 5,
        structureCompleteness: 4,
        safetyForChildren: 6,
        length: 5,
      },
      finalScore: 4.8,
    };
    mockGenerateObject
      .mockResolvedValueOnce({ object: validStory } as never)
      .mockResolvedValueOnce({ object: failingJudge } as never)
      .mockResolvedValueOnce({ object: validStory } as never)
      .mockResolvedValueOnce({ object: validJudge } as never);

    await service.generate(opts);

    const firstCall = mockPrisma.storyEval.create.mock.calls[0][0];
    expect(firstCall.data.passed).toBe(false);
    const secondCall = mockPrisma.storyEval.create.mock.calls[1][0];
    expect(secondCall.data.passed).toBe(true);
  });

  it('throws StoryGenerationFailedError after all attempts fail', async () => {
    const failingJudge = {
      ...validJudge,
      scores: {
        ageAppropriateVocab: 4,
        hasMoralLesson: 5,
        structureCompleteness: 4,
        safetyForChildren: 6,
        length: 5,
      },
      finalScore: 4.8,
    };
    for (let i = 0; i < 10; i++) {
      mockGenerateObject
        .mockResolvedValueOnce({ object: validStory } as never)
        .mockResolvedValueOnce({ object: failingJudge } as never);
    }

    await expect(service.generate(opts)).rejects.toThrow(StoryGenerationFailedError);
  });

  it('writes passed=false and retries when validateBookPlan fails', async () => {
    // Story with no cover page — validateBookPlan will return valid=false
    const invalidStory: Story = {
      title: 'Маша и кот',
      pages: [
        { template: 'image-top', text: 'Маша играла', illustrationPrompt: 'Girl playing' },
        { template: 'image-top', text: 'Кот убежал', illustrationPrompt: 'Cat running' },
        { template: 'image-top', text: 'Маша искала', illustrationPrompt: 'Girl searching' },
        { template: 'image-top', text: 'Маша нашла кота', illustrationPrompt: 'Girl found cat' },
        { template: 'image-top', text: 'Маша обняла кота', illustrationPrompt: 'Girl hugs cat' },
        { template: 'final', text: 'Дружба важна', illustrationPrompt: 'Friends' },
      ],
      discussionQuestions: [
        'Что случилось?',
        'Почему кот убежал?',
        'Как искала Маша?',
        'Что узнала Маша?',
        'Что важно?',
      ],
    };

    mockGenerateObject
      .mockResolvedValueOnce({ object: invalidStory } as never) // attempt 1: no cover → structural fail
      .mockResolvedValueOnce({ object: validJudge } as never) // attempt 1: judge still called
      .mockResolvedValueOnce({ object: validStory } as never) // attempt 2: valid story
      .mockResolvedValueOnce({ object: validJudge } as never); // attempt 2: judge passes

    const result = await service.generate(opts);

    // First attempt: structural failure → passed=false
    const firstCall = mockPrisma.storyEval.create.mock.calls[0][0];
    expect(firstCall.data.passed).toBe(false);
    // Second attempt: success
    expect(result.attempts).toBe(2);
  });

  it('retrieves allowed words from VocabularyRagService using correct gradeLevel', async () => {
    mockGenerateObject
      .mockResolvedValueOnce({ object: validStory } as never)
      .mockResolvedValueOnce({ object: validJudge } as never);

    await service.generate({ ...opts, childAge: 6 });

    // age 6 → gradeLevel 1 (from age-grade.map.ts)
    expect(mockVocabRag.retrieve).toHaveBeenCalledWith(
      expect.objectContaining({ gradeLevel: 1, topic: opts.topic }),
    );
  });
});
