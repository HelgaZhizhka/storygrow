jest.mock('ai', () => ({ generateObject: jest.fn() }));
jest.mock('@ai-sdk/openai', () => ({
  createOpenAI: jest.fn(() => (model: string) => ({ model })),
}));

import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { generateObject } from 'ai';
import { StoryGeneratorService } from './story-generator.service';
import type { GenerateStoryInput } from './story-generator.service';
import type { Story, StoryPlan } from '../schemas';

const mockGenerateObject = generateObject as jest.MockedFunction<typeof generateObject>;

const validPlan: StoryPlan = {
  title: 'Маша и кот',
  heroName: 'Маша',
  characterProfile: '6-year-old girl with brown hair, blue dress',
  lesson: 'Дружба важна',
  discussionQuestions: ['Что случилось?', 'Почему?', 'Как?', 'Что узнала?', 'Что важно?'],
  pages: [
    { template: 'cover', beat: 'Обложка', intent: 'Маша и кот на лугу' },
    { template: 'image-top', beat: 'Завязка', intent: 'Маша играет с котом' },
    { template: 'image-bottom', beat: 'Конфликт', intent: 'Кот убежал' },
    { template: 'image-left', beat: 'Внутренняя борьба', intent: 'Маша ищет кота' },
    { template: 'image-left', beat: 'Развязка', intent: 'Маша нашла кота' },
    { template: 'final', beat: 'Финал', intent: 'Снова вместе' },
  ],
};

const validStory: Story = {
  title: 'Маша и кот',
  characterProfile: '6-year-old girl with brown hair, blue dress',
  pages: [
    { template: 'cover', text: null, title: 'Маша и кот', illustrationPrompt: 'A girl with cat' },
    {
      template: 'image-top',
      text: 'Маша играла с котом',
      title: null,
      illustrationPrompt: 'Playing',
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
      illustrationPrompt: 'Searching',
    },
    {
      template: 'image-left',
      text: 'Маша нашла кота',
      title: null,
      illustrationPrompt: 'Found cat',
    },
    { template: 'final', text: 'Дружба важна', title: null, illustrationPrompt: 'Friends' },
  ],
  discussionQuestions: ['Что случилось?', 'Почему?', 'Как?', 'Что узнала?', 'Что важно?'],
};

const input: GenerateStoryInput = {
  bookId: 'book-1',
  childName: 'Маша',
  childAge: 6,
  topic: 'дружба',
  learningGoal: 'научиться дружить',
  protagonistMode: 'child',
  arcType: 'virtue',
};

/** Mock the two sequential calls: Plan, then Prose. */
const mockPlanThenProse = (): void => {
  mockGenerateObject
    .mockResolvedValueOnce({ object: validPlan } as never)
    .mockResolvedValueOnce({ object: validStory } as never);
};

describe('StoryGeneratorService', () => {
  let service: StoryGeneratorService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        StoryGeneratorService,
        { provide: ConfigService, useValue: { getOrThrow: jest.fn().mockReturnValue('sk-test') } },
      ],
    }).compile();
    service = module.get(StoryGeneratorService);
  });

  it('runs Plan then Prose and returns the Prose Story', async () => {
    mockPlanThenProse();
    const result = await service.generateStory(input);
    expect(result).toEqual(validStory);
    expect(mockGenerateObject).toHaveBeenCalledTimes(2);
  });

  it('traces the two phases separately (story-planner, then story-prose)', async () => {
    mockPlanThenProse();
    await service.generateStory(input);
    const calls = mockGenerateObject.mock.calls as unknown as Array<
      [{ experimental_telemetry: { functionId: string } }]
    >;
    expect(calls[0][0].experimental_telemetry.functionId).toBe('story-planner');
    expect(calls[1][0].experimental_telemetry.functionId).toBe('story-prose');
  });

  it('passes feedback into the Plan prompt when provided', async () => {
    mockPlanThenProse();
    await service.generateStory({ ...input, feedback: 'fix vocabulary' });
    const planCall = mockGenerateObject.mock.calls[0][0] as { prompt: string };
    expect(planCall.prompt).toContain('fix vocabulary');
  });

  it('encodes the flaw beat sheet in the Plan prompt (Расплата)', async () => {
    mockPlanThenProse();
    await service.generateStory({ ...input, arcType: 'flaw' });
    const planCall = mockGenerateObject.mock.calls[0][0] as { prompt: string };
    expect(planCall.prompt).toContain('Расплата');
  });

  it('feeds the approved plan into the Prose prompt', async () => {
    mockPlanThenProse();
    await service.generateStory(input);
    const proseCall = mockGenerateObject.mock.calls[1][0] as { prompt: string };
    expect(proseCall.prompt).toContain('Маша');
    expect(proseCall.prompt).toContain(validPlan.pages[1].intent);
  });

  it('does NOT derive companions when there are no belongings (Plan, Prose only)', async () => {
    mockPlanThenProse();
    await service.generateStory(input);
    expect(mockGenerateObject).toHaveBeenCalledTimes(2);
  });

  it('derives companions from belongings and feeds them into the Prose prompt', async () => {
    // Plan → Companions → Prose (companions inserted between the two).
    mockGenerateObject
      .mockResolvedValueOnce({ object: validPlan } as never)
      .mockResolvedValueOnce({ object: { companions: ['Mira, a small grey tabby cat'] } } as never)
      .mockResolvedValueOnce({ object: validStory } as never);

    await service.generateStory({
      ...input,
      seeds: { interests: [], motifs: [], favoriteWords: [], belongings: ['кошка Мира'] },
    });

    expect(mockGenerateObject).toHaveBeenCalledTimes(3);
    expect(
      (mockGenerateObject.mock.calls[1][0] as { experimental_telemetry: { functionId: string } })
        .experimental_telemetry.functionId,
    ).toBe('story-companions');
    const proseCall = mockGenerateObject.mock.calls[2][0] as { prompt: string };
    expect(proseCall.prompt).toContain('Mira, a small grey tabby cat');
  });
});
