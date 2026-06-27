jest.mock('ai', () => ({ generateObject: jest.fn() }));
jest.mock('@ai-sdk/openai', () => ({
  createOpenAI: jest.fn(() => (model: string) => ({ model })),
}));

import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { generateObject } from 'ai';
import { StoryEvaluatorService } from './story-evaluator.service';
import type { EvaluateInput } from './story-evaluator.service';
import type { Story } from '../schemas';

const mockGenerateObject = generateObject as jest.MockedFunction<typeof generateObject>;

const validStory: Story = {
  title: 'Маша и кот',
  characterProfile: '6-year-old girl with brown hair, blue dress',
  pages: [
    { template: 'cover', text: null, title: 'Маша и кот', illustrationPrompt: 'A girl with cat' },
    {
      template: 'image-top',
      text: 'Маша играла с котом',
      title: null,
      illustrationPrompt: 'Girl playing',
    },
    {
      template: 'image-bottom',
      text: 'Кот убежал',
      title: null,
      illustrationPrompt: 'Cat running',
    },
    {
      template: 'image-left',
      text: 'Маша искала кота',
      title: null,
      illustrationPrompt: 'Girl searching',
    },
    {
      template: 'image-left',
      text: 'Маша нашла кота и обняла',
      title: null,
      illustrationPrompt: 'Girl hugging cat',
    },
    {
      template: 'final',
      text: 'Дружба важна',
      title: null,
      illustrationPrompt: 'Girl and cat friends',
    },
  ],
  discussionQuestions: ['Что случилось?', 'Почему?', 'Как?', 'Что узнала?', 'Что важно?'],
};

const passingJudge = {
  scores: {
    ageAppropriateVocab: 8,
    hasMoralLesson: 9,
    structureCompleteness: 8,
    safetyForChildren: 10,
    length: 8,
    earnedResolution: 8,
    registerMatch: 9,
  },
  reasoning: 'Good story.',
};

const failingJudge = {
  scores: {
    ageAppropriateVocab: 4,
    hasMoralLesson: 5,
    structureCompleteness: 4,
    safetyForChildren: 6,
    length: 5,
    earnedResolution: 4,
    registerMatch: 4,
  },
  reasoning: 'Needs improvement.',
};

const corpusWords = [
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
];

const baseInput: EvaluateInput = {
  story: validStory,
  childAge: 6,
  learningGoal: 'научиться дружить',
  bookId: 'book-1',
  corpusWords,
};

describe('StoryEvaluatorService', () => {
  let service: StoryEvaluatorService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        StoryEvaluatorService,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn().mockReturnValue('sk-test'),
            get: jest.fn().mockReturnValue(undefined),
          },
        },
      ],
    }).compile();
    service = module.get(StoryEvaluatorService);
  });

  it('returns passed=true when all checks pass', async () => {
    mockGenerateObject.mockResolvedValueOnce({ object: passingJudge } as never);
    const result = await service.evaluate(baseInput);
    expect(result.passed).toBe(true);
    expect(result.structuralErrors).toHaveLength(0);
  });

  it('returns passed=false when judge score is below threshold', async () => {
    mockGenerateObject.mockResolvedValueOnce({ object: failingJudge } as never);
    const result = await service.evaluate(baseInput);
    expect(result.passed).toBe(false);
    expect(result.computedFinalScore).toBeLessThan(7.0);
  });

  it('returns passed=false when story has no cover page', async () => {
    const storyNoCover: Story = {
      ...validStory,
      pages: [
        { template: 'image-top', text: 'нет обложки', title: null, illustrationPrompt: 'x' },
        ...validStory.pages.slice(1),
      ],
    };
    mockGenerateObject.mockResolvedValueOnce({ object: passingJudge } as never);
    const result = await service.evaluate({ ...baseInput, story: storyNoCover });
    expect(result.passed).toBe(false);
    expect(result.structuralErrors.some((e) => /cover/i.test(e))).toBe(true);
  });

  it('does NOT hard-fail on low vocabulary compliance (soft signal), but still reports it', async () => {
    const storyWithRareWords: Story = {
      ...validStory,
      title: 'бегемот жираф слон антилопа носорог лемур',
      pages: validStory.pages.map((page) =>
        page.text ? { ...page, text: 'бегемот жираф слон антилопа носорог' } : page,
      ),
    };
    mockGenerateObject.mockResolvedValueOnce({ object: passingJudge } as never);
    const result = await service.evaluate({
      ...baseInput,
      story: storyWithRareWords,
      corpusWords: ['кот'],
    });
    // Judge + structure + language purity pass; vocabulary is now a soft signal.
    expect(result.passed).toBe(true);
    expect(result.outOfCorpus.length).toBeGreaterThan(0); // still reported
    expect(result.vocabularyCompliance).toBeLessThan(0.4); // still computed
  });

  it('calls generateObject with story-evaluator telemetry', async () => {
    mockGenerateObject.mockResolvedValueOnce({ object: passingJudge } as never);
    await service.evaluate(baseInput);
    expect(mockGenerateObject).toHaveBeenCalledWith(
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        experimental_telemetry: expect.objectContaining({ functionId: 'story-evaluator' }),
      }),
    );
  });
});
