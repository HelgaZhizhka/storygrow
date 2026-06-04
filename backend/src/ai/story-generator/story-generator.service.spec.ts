jest.mock('ai', () => ({ generateObject: jest.fn() }));
jest.mock('@ai-sdk/openai', () => ({
  createOpenAI: jest.fn(() => (model: string) => ({ model })),
}));

import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { generateObject } from 'ai';
import { StoryGeneratorService } from './story-generator.service';
import type { GenerateStoryInput } from './story-generator.service';
import type { Story } from '../schemas';

const mockGenerateObject = generateObject as jest.MockedFunction<typeof generateObject>;

const validStory: Story = {
  title: 'Маша и кот',
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
      text: 'Маша нашла кота',
      title: null,
      illustrationPrompt: 'Girl found cat',
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

const input: GenerateStoryInput = {
  bookId: 'book-1',
  childName: 'Маша',
  childAge: 6,
  topic: 'дружба',
  learningGoal: 'научиться дружить',
  allowedWords: ['маша', 'кот', 'дружба'],
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

  it('returns Story from generateObject', async () => {
    mockGenerateObject.mockResolvedValueOnce({ object: validStory } as never);
    const result = await service.generateStory(input);
    expect(result).toEqual(validStory);
  });

  it('calls generateObject with StorySchema and telemetry', async () => {
    mockGenerateObject.mockResolvedValueOnce({ object: validStory } as never);
    await service.generateStory(input);
    expect(mockGenerateObject).toHaveBeenCalledWith(
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        experimental_telemetry: expect.objectContaining({ functionId: 'story-generator' }),
      }),
    );
  });

  it('passes feedback into the user prompt when provided', async () => {
    mockGenerateObject.mockResolvedValueOnce({ object: validStory } as never);
    await service.generateStory({ ...input, feedback: 'fix vocabulary' });
    const call = mockGenerateObject.mock.calls[0][0] as { prompt: string };
    expect(call.prompt).toContain('fix vocabulary');
  });
});
