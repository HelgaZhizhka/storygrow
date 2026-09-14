jest.mock('../generated/prisma/client', () => ({
  PrismaClient: class {},
  BookStatus: {
    generating: 'generating',
    ready: 'ready',
    failed: 'failed',
    pending: 'pending',
    images_failed: 'images_failed',
  },
}));

jest.mock('puppeteer', () => ({
  __esModule: true,
  default: { launch: jest.fn() },
}));

import { Test } from '@nestjs/testing';
import { type Job } from 'bullmq';
import { GenerationProcessor } from './generation.processor';
import { PrismaService } from '../prisma/prisma.service';
import { StoryOrchestratorService } from '../ai/story-generator/story-orchestrator.service';
import { ImageGeneratorService } from '../ai/image-generator/image-generator.service';
import { BookImageService } from '../books/book-image.service';
import { BookProgressService } from '../books/book-progress.service';
import { PdfRenderService } from '../pdf/pdf-render.service';
import type { GenerateBookPayload } from './generation.types';
import type { Story } from '../ai/schemas';

export const mockStory: Story = {
  title: 'Test Story',
  characterProfile: '6-year-old boy with blond hair',
  pages: [
    { template: 'cover', text: null, title: 'Test Story', illustrationPrompt: 'cover art' },
    { template: 'image-top', text: 'Once upon a time', title: null, illustrationPrompt: 'scene' },
    { template: 'final', text: 'The end', title: null, illustrationPrompt: 'ending' },
  ],
  discussionQuestions: ['Q1?', 'Q2?', 'Q3?', 'Q4?', 'Q5?'],
};

export const mockBook = {
  id: 'book-1',
  storyJson: null,
  imageKeys: [] as string[],
  protagonistMode: 'child' as const,
  artStyle: 'watercolor' as const,
  characterPortraitKey: null as string | null,
  characterAppearance: null as unknown,
  referenceImageKeys: [] as string[],
  child: { name: 'Маша', age: 6, gender: 'female', appearance: 'brown hair' },
  learningGoal: { title: 'дружба', description: 'научиться дружить' },
};

export const mockPrisma = {
  book: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  imageEval: {
    aggregate: jest.fn().mockResolvedValue({ _max: { run: null } }),
  },
};

export const mockOrchestrator = {
  generate: jest.fn(),
};

export const mockImageGen = {
  generate: jest.fn(),
};

export const mockBookImage = {
  signKeys: jest.fn(),
  signKey: jest.fn(),
};

export const mockPdfRender = {
  render: jest.fn(),
};

export const mockBookProgress = {
  emit: jest.fn(),
  stream: jest.fn(),
};

export const makeJob = (data: GenerateBookPayload): Job<GenerateBookPayload> =>
  ({
    id: 'job-1',
    data,
    updateProgress: jest.fn(),
  }) as unknown as Job<GenerateBookPayload>;

/** Fresh processor wired to the mocks above; every spec file resets them here. */
export const buildProcessor = async (): Promise<GenerationProcessor> => {
  jest.clearAllMocks();
  const module = await Test.createTestingModule({
    providers: [
      GenerationProcessor,
      { provide: PrismaService, useValue: mockPrisma },
      { provide: StoryOrchestratorService, useValue: mockOrchestrator },
      { provide: ImageGeneratorService, useValue: mockImageGen },
      { provide: BookImageService, useValue: mockBookImage },
      { provide: PdfRenderService, useValue: mockPdfRender },
      { provide: BookProgressService, useValue: mockBookProgress },
    ],
  }).compile();
  return module.get(GenerationProcessor);
};
