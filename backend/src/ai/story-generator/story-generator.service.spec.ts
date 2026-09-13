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
import {
  sceneFixture,
  planVisualBibleFixture,
  appearanceFixture,
} from '../schemas/__fixtures__/visual-bible.fixture';
import { renderAppearance, toStoryBible } from '../schemas';

const mockGenerateObject = generateObject as jest.MockedFunction<typeof generateObject>;

const validPlan: StoryPlan = {
  title: 'Маша и кот',
  heroName: 'Маша',
  characterProfile: '6-year-old girl with brown hair, blue dress',
  lesson: 'Дружба важна',
  discussionQuestions: ['Что случилось?', 'Почему?', 'Как?', 'Что узнала?', 'Что важно?'],
  visualBible: planVisualBibleFixture(),
  pages: [
    { template: 'cover', beat: 'Обложка', intent: 'Маша и кот на лугу', scene: sceneFixture() },
    {
      template: 'image-top',
      beat: 'Завязка',
      intent: 'Маша играет с котом',
      scene: sceneFixture(),
    },
    { template: 'image-bottom', beat: 'Конфликт', intent: 'Кот убежал', scene: sceneFixture() },
    {
      template: 'image-left',
      beat: 'Внутренняя борьба',
      intent: 'Маша ищет кота',
      scene: sceneFixture(),
    },
    { template: 'image-left', beat: 'Развязка', intent: 'Маша нашла кота', scene: sceneFixture() },
    { template: 'final', beat: 'Финал', intent: 'Снова вместе', scene: sceneFixture() },
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

// What generateStory persists: the plan bible rendered to descriptors, the hero
// descriptor = characterProfile rendered from the structured appearance (#360).
// In child mode the hero's kind is built from age + gender (#376): the input
// fixture is a 6-year-old with no gender → "6-year-old child".
const heroLook = { ...planVisualBibleFixture().hero.appearance, kind: '6-year-old child' };
const mergedStory: Story = {
  ...validStory,
  characterProfile: renderAppearance(heroLook),
  visualBible: toStoryBible(
    { ...planVisualBibleFixture(), hero: { name: 'Герой', appearance: heroLook } },
    renderAppearance(heroLook),
  ),
  pages: validStory.pages.map((p, i) => ({ ...p, scene: validPlan.pages[i].scene })),
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

/**
 * Mock the sequential calls for a no-seeds run: Plan, Prose, then Title.
 * The title equals the story's own title (a concrete title that passes the
 * validator), so the result still deep-equals validStory.
 */
const mockPlanThenProse = (): void => {
  mockGenerateObject
    .mockResolvedValueOnce({ object: validPlan } as never)
    .mockResolvedValueOnce({ object: validStory } as never)
    .mockResolvedValueOnce({ object: { title: validStory.title } } as never);
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

  it('runs Plan, Prose, Title and returns the Prose Story', async () => {
    mockPlanThenProse();
    const result = await service.generateStory(input);
    expect(result).toEqual(mergedStory);
    expect(mockGenerateObject).toHaveBeenCalledTimes(3);
  });

  it('merges the Visual Bible and per-page scenes into the returned Story (#348)', async () => {
    mockPlanThenProse();
    const result = await service.generateStory(input);
    expect(result.visualBible?.locations[0].id).toBe('home');
    expect(result.pages.every((p) => p.scene !== undefined)).toBe(true);
    // Hero descriptor = characterProfile = the structured appearance rendered
    // in code (#360) — never the model's free-text placeholder, never a name.
    const rendered = renderAppearance(heroLook);
    expect(result.characterProfile).toBe(rendered);
    expect(result.visualBible?.hero.descriptor).toBe(rendered);
    expect(rendered).not.toContain(validPlan.heroName);
  });

  it('renders every cast member descriptor from its structured appearance (#360)', async () => {
    const withCast: StoryPlan = {
      ...validPlan,
      visualBible: planVisualBibleFixture({
        cast: [
          {
            id: 'brother',
            name: 'братик',
            role: 'младший брат',
            appearance: appearanceFixture({
              kind: 'toddler boy',
              skin: 'light skin',
              hair: 'blond curls',
              outfit: 'a white shirt and pink overalls',
              detail: 'a dimple',
            }),
          },
        ],
      }),
    };
    mockGenerateObject
      .mockResolvedValueOnce({ object: withCast } as never)
      .mockResolvedValueOnce({ object: validStory } as never)
      .mockResolvedValueOnce({ object: { title: validStory.title } } as never);
    const result = await service.generateStory(input);
    expect(result.visualBible?.cast[0].descriptor).toBe(
      'toddler boy, light skin, blond curls, wearing a white shirt and pink overalls, a dimple',
    );
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

  it('titles from the finished story (story-title) after the Prose phase', async () => {
    mockPlanThenProse();
    await service.generateStory(input);
    const titleCall = mockGenerateObject.mock.calls[2][0] as {
      experimental_telemetry: { functionId: string };
    };
    expect(titleCall.experimental_telemetry.functionId).toBe('story-title');
  });

  it('regenerates the title while it names the learning value', async () => {
    mockGenerateObject
      .mockResolvedValueOnce({ object: validPlan } as never)
      .mockResolvedValueOnce({ object: validStory } as never)
      // topic is 'дружба'; first title names it → rejected, second is concrete.
      .mockResolvedValueOnce({ object: { title: 'Дружба и Маша' } } as never)
      .mockResolvedValueOnce({ object: { title: 'Маша и беглый кот' } } as never);

    const result = await service.generateStory(input);

    expect(result.title).toBe('Маша и беглый кот');
    expect(result.pages[0].title).toBe('Маша и беглый кот');
    expect(mockGenerateObject).toHaveBeenCalledTimes(4);
  });

  it('derives the age band once from childAge and uses it for the Prose schema, Prose system prompt, and Title system prompt', async () => {
    mockGenerateObject
      .mockResolvedValueOnce({ object: { ...validPlan, characterProfile: 'toddler' } } as never)
      .mockResolvedValueOnce({ object: validStory } as never)
      .mockResolvedValueOnce({ object: { title: validStory.title } } as never);

    await service.generateStory({ ...input, childAge: 3, arcType: 'virtue' });

    const proseCall = mockGenerateObject.mock.calls[1][0] as { system: string };
    expect(proseCall.system).toContain('40 characters'); // 3-4 cover cap, via buildProseSystemPrompt

    const titleCall = mockGenerateObject.mock.calls[2][0] as { system: string };
    expect(titleCall.system).toContain('40 characters maximum'); // 3-4 cap, via buildTitleSystem
  });
});

describe('hero appearance — one source in every mode (#376)', () => {
  let service: StoryGeneratorService;
  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        StoryGeneratorService,
        { provide: ConfigService, useValue: { getOrThrow: () => 'k', get: () => undefined } },
      ],
    }).compile();
    service = module.get(StoryGeneratorService);
  });

  it('child mode with a parent description: derived structured look wins, kind from age + gender, bible and profile agree', async () => {
    const derived = appearanceFixture({
      kind: 'ignored by the system',
      hair: 'long wavy red hair',
      outfit: 'a green dress',
      detail: 'round glasses',
    });
    mockGenerateObject
      .mockResolvedValueOnce({ object: validPlan } as never) // plan
      .mockResolvedValueOnce({ object: derived } as never) // appearance derivation
      .mockResolvedValueOnce({ object: validStory } as never) // prose
      .mockResolvedValueOnce({ object: { title: validStory.title } } as never); // title
    const story = await service.generateStory({
      ...input,
      protagonistMode: 'child',
      appearance: 'рыжие волнистые волосы, очки',
      gender: 'female',
      childAge: 5,
    });
    const expected = renderAppearance({ ...derived, kind: '5-year-old girl' });
    expect(story.characterProfile).toBe(expected);
    expect(story.visualBible?.hero.descriptor).toBe(expected);
    expect(expected).toContain('long wavy red hair');
    expect(expected).not.toContain('ignored by the system');
  });

  it('child mode without a description: the Plan look with kind from age + gender', async () => {
    mockPlanThenProse();
    const story = await service.generateStory({
      ...input,
      protagonistMode: 'child',
      appearance: undefined,
      gender: 'male',
      childAge: 6,
    });
    expect(story.characterProfile.startsWith('6-year-old boy,')).toBe(true);
    expect(story.visualBible?.hero.descriptor).toBe(story.characterProfile);
  });

  it('observer mode: the Plan-invented look stands as is', async () => {
    mockPlanThenProse();
    const story = await service.generateStory({
      ...input,
      protagonistMode: 'observer',
      appearance: undefined,
    });
    expect(story.characterProfile).toBe(renderAppearance(validPlan.visualBible.hero.appearance));
  });
});

describe('plan-owned pages (#378)', () => {
  let service: StoryGeneratorService;
  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        StoryGeneratorService,
        { provide: ConfigService, useValue: { getOrThrow: () => 'k', get: () => undefined } },
      ],
    }).compile();
    service = module.get(StoryGeneratorService);
  });

  it("asks Prose for exactly the plan's page count", async () => {
    mockPlanThenProse();
    await service.generateStory(input);
    const proseCall = mockGenerateObject.mock.calls[1][0] as {
      schema: { safeParse: (v: unknown) => { success: boolean } };
    };
    const tooFew = { ...validStory, pages: validStory.pages.slice(0, -1) };
    expect(proseCall.schema.safeParse(tooFew).success).toBe(false);
    expect(proseCall.schema.safeParse({ ...validStory, characterProfile: undefined }).success).toBe(
      true,
    );
  });

  it('attaches no scene to a page whose template differs from the plan (the structural check catches it)', async () => {
    const drifted = {
      ...validStory,
      pages: validStory.pages.map((p, i) =>
        i === 1 ? { ...p, template: 'image-bottom' as const } : p,
      ),
    };
    mockGenerateObject
      .mockResolvedValueOnce({ object: validPlan } as never)
      .mockResolvedValueOnce({ object: drifted } as never)
      .mockResolvedValueOnce({ object: { title: validStory.title } } as never);
    const story = await service.generateStory(input);
    expect(story.pages[1].scene).toBeUndefined();
    expect(story.pages[0].scene).toBeDefined();
  });
});
