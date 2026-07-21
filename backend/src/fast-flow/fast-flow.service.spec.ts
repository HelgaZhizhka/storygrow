jest.mock('../generated/prisma/client', () => ({
  PrismaClient: class {},
  Prisma: {
    PrismaClientKnownRequestError: class extends Error {
      code: string;
      constructor(message: string, params: { code: string }) {
        super(message);
        this.code = params.code;
      }
    },
  },
}));
jest.mock('puppeteer', () => ({ __esModule: true, default: { launch: jest.fn() } }));

const mockGenerateObject = jest.fn();
jest.mock('ai', () => ({
  generateObject: (...args: unknown[]): unknown => mockGenerateObject(...args),
}));
jest.mock('@ai-sdk/openai', () => ({ openai: jest.fn((id: string) => ({ id })) }));
jest.mock('@langfuse/tracing', () => ({
  startActiveObservation: async <T>(_n: string, fn: () => Promise<T>) => fn(),
}));

import { NotFoundException } from '@nestjs/common';
import { FastFlowService } from './fast-flow.service';
import { Prisma } from '../generated/prisma/client';
import type { RenderInput } from '../pdf/pdf-render.service';
import type { Story } from '../ai/schemas';

const mockChild = { id: 'child-1', name: 'Аня', age: 6, gender: 'female' };

const mockTemplate = { illustrationTags: ['park', 'sad', 'sharing', 'happy'] };
const mockGoal = { title: 'Делиться с другими' };

const mockStory: Story = {
  title: 'Аня учится делиться',
  characterProfile: '5-year-old girl with dark hair, blue dress',
  discussionQuestions: ['Q1', 'Q2', 'Q3', 'Q4', 'Q5'],
  pages: [
    { template: 'cover', text: null, title: 'Аня учится делиться', illustrationPrompt: 'cover' },
    { template: 'image-top', text: 'Аня пошла в парк.', title: null, illustrationPrompt: 'park' },
    {
      template: 'image-bottom',
      text: 'Она увидела грустного ребёнка.',
      title: null,
      illustrationPrompt: 'sad child',
    },
    {
      template: 'image-left',
      text: 'Аня протянула игрушку.',
      title: null,
      illustrationPrompt: 'sharing',
    },
    {
      template: 'image-top',
      text: 'Они стали друзьями.',
      title: null,
      illustrationPrompt: 'happy',
    },
    {
      template: 'final',
      text: 'Делиться — значит дарить радость.',
      title: null,
      illustrationPrompt: 'happy friends',
    },
  ],
};

const mockIllustrations = [
  { id: 'ill-park', url: 'https://s3/park.png', tags: ['park'] },
  { id: 'ill-sad', url: 'https://s3/sad.png', tags: ['sad'] },
  { id: 'ill-sharing', url: 'https://s3/sharing.png', tags: ['sharing'] },
  { id: 'ill-happy', url: 'https://s3/happy.png', tags: ['happy'] },
];

function makeMocks() {
  const prisma = {
    child: { findFirst: jest.fn() },
    template: { findFirst: jest.fn() },
    learningGoal: { findUnique: jest.fn() },
    fastIllustration: { findMany: jest.fn() },
    book: { update: jest.fn() },
    bookPage: { createMany: jest.fn() },
    storyEval: { create: jest.fn() },
  };
  const pdfRender = { render: jest.fn<Promise<string>, [RenderInput]>() };
  const service = new FastFlowService(prisma as never, pdfRender as never);
  return { prisma, pdfRender, service };
}

function setupHappyPath(prisma: ReturnType<typeof makeMocks>['prisma']) {
  prisma.child.findFirst.mockResolvedValue(mockChild);
  prisma.template.findFirst.mockResolvedValue(mockTemplate);
  prisma.learningGoal.findUnique.mockResolvedValue(mockGoal);
  prisma.fastIllustration.findMany.mockResolvedValue(mockIllustrations);
  prisma.storyEval.create.mockResolvedValue({});
  prisma.bookPage.createMany.mockResolvedValue({ count: 6 });
  prisma.book.update.mockResolvedValue({});
  mockGenerateObject.mockResolvedValue({ object: mockStory });
}

beforeEach(() => jest.clearAllMocks());

describe('FastFlowService.generate', () => {
  it('throws NotFoundException and marks the reserved book failed when child does not exist or is not owned by the user', async () => {
    const { prisma, service } = makeMocks();
    // findFirst with { id, userId } returns null both when the child is missing
    // and when it belongs to another user — neither is leaked to the caller.
    prisma.child.findFirst.mockResolvedValue(null);
    prisma.book.update.mockResolvedValue({});

    await expect(
      service.generate({
        bookId: 'book-1',
        userId: 'u1',
        childId: 'other-users-child',
        learningGoalId: 'g1',
      }),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.book.update).toHaveBeenCalledWith({
      where: { id: 'book-1' },
      data: { status: 'failed' },
    });
  });

  it('throws NotFoundException when no template exists for the learning goal', async () => {
    const { prisma, service } = makeMocks();
    prisma.child.findFirst.mockResolvedValue(mockChild);
    prisma.template.findFirst.mockResolvedValue(null);
    prisma.learningGoal.findUnique.mockResolvedValue(mockGoal);
    prisma.book.update.mockResolvedValue({});

    await expect(
      service.generate({
        bookId: 'book-1',
        userId: 'u1',
        childId: 'child-1',
        learningGoalId: 'missing-goal',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('calls generateObject with child name, age, and learning goal in prompt', async () => {
    const { prisma, pdfRender, service } = makeMocks();
    setupHappyPath(prisma);
    pdfRender.render.mockResolvedValue('books/book-1/book.pdf');

    await service.generate({
      bookId: 'book-1',
      userId: 'u1',
      childId: 'child-1',
      learningGoalId: 'goal-1',
    });

    expect(mockGenerateObject).toHaveBeenCalledTimes(1);
    const calls = mockGenerateObject.mock.calls as Array<[{ prompt: string; system: string }]>;
    const callArg = calls[0][0];
    expect(callArg.prompt).toContain('Аня');
    expect(callArg.prompt).toContain('Делиться с другими');
    expect(callArg.prompt).toContain('6');
  });

  it('uses LLM-generated title and pages for the book', async () => {
    const { prisma, pdfRender, service } = makeMocks();
    setupHappyPath(prisma);
    pdfRender.render.mockResolvedValue('books/book-1/book.pdf');

    await service.generate({
      bookId: 'book-1',
      userId: 'u1',
      childId: 'child-1',
      learningGoalId: 'goal-1',
    });

    const renderCall = pdfRender.render.mock.calls[0][0];
    expect(renderCall?.story.title).toBe('Аня учится делиться');
    expect(renderCall?.story.pages).toHaveLength(6);
    expect(renderCall?.story.pages[0]?.template).toBe('cover');
    expect(renderCall?.story.pages[5]?.template).toBe('final');

    type BookUpdateArg = { where: { id: string }; data: { title: string; status: string } };
    const updateCalls = prisma.book.update.mock.calls as Array<[BookUpdateArg]>;
    const readyUpdate = updateCalls[0][0];
    expect(readyUpdate.where).toEqual({ id: 'book-1' });
    expect(readyUpdate.data.title).toBe('Аня учится делиться');
    expect(readyUpdate.data.status).toBe('ready');
  });

  it('picks illustrations by cycling through template illustrationTags', async () => {
    const { prisma, pdfRender, service } = makeMocks();
    setupHappyPath(prisma);
    pdfRender.render.mockResolvedValue('books/book-1/book.pdf');

    await service.generate({
      bookId: 'book-1',
      userId: 'u1',
      childId: 'child-1',
      learningGoalId: 'goal-1',
    });

    const illustrationUrls = pdfRender.render.mock.calls[0][0]?.illustrationUrls ?? [];
    expect(illustrationUrls[0]).toBe('https://s3/park.png');
    expect(illustrationUrls[1]).toBe('https://s3/sad.png');
    expect(illustrationUrls[2]).toBe('https://s3/sharing.png');
    expect(illustrationUrls[3]).toBe('https://s3/happy.png');
  });

  it('creates a StoryEval row marked as passed', async () => {
    const { prisma, pdfRender, service } = makeMocks();
    setupHappyPath(prisma);
    pdfRender.render.mockResolvedValue('books/book-1/book.pdf');

    await service.generate({
      bookId: 'book-1',
      userId: 'u1',
      childId: 'child-1',
      learningGoalId: 'goal-1',
    });

    type StoryEvalArg = { data: { bookId: string; attempt: number; passed: boolean } };
    const evalCalls = prisma.storyEval.create.mock.calls as Array<[StoryEvalArg]>;
    expect(evalCalls[0][0].data.bookId).toBe('book-1');
    expect(evalCalls[0][0].data.attempt).toBe(1);
    expect(evalCalls[0][0].data.passed).toBe(true);
  });

  it('marks book as failed and re-throws when PDF render fails', async () => {
    const { prisma, pdfRender, service } = makeMocks();
    setupHappyPath(prisma);
    pdfRender.render.mockRejectedValue(new Error('Puppeteer crash'));

    await expect(
      service.generate({
        bookId: 'book-1',
        userId: 'u1',
        childId: 'child-1',
        learningGoalId: 'goal-1',
      }),
    ).rejects.toThrow('Puppeteer crash');

    expect(prisma.book.update).toHaveBeenCalledWith({
      where: { id: 'book-1' },
      data: { status: 'failed' },
    });
  });

  it('returns the reserved bookId and pdfKey on success', async () => {
    const { prisma, pdfRender, service } = makeMocks();
    setupHappyPath(prisma);
    pdfRender.render.mockResolvedValue('books/book-42/book.pdf');

    const result = await service.generate({
      bookId: 'book-42',
      userId: 'u1',
      childId: 'child-1',
      learningGoalId: 'goal-1',
    });

    expect(result).toEqual({ bookId: 'book-42', pdfKey: 'books/book-42/book.pdf' });
  });

  it('throws a clean NotFoundException, without a further failure-mark update, when the book was deleted mid-generation (#280)', async () => {
    const { prisma, pdfRender, service } = makeMocks();
    setupHappyPath(prisma);
    pdfRender.render.mockResolvedValue('books/book-1/book.pdf');
    prisma.book.update.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('Record to update not found.', {
        code: 'P2025',
        clientVersion: '7.8.0',
      }),
    );

    await expect(
      service.generate({
        bookId: 'book-1',
        userId: 'u1',
        childId: 'child-1',
        learningGoalId: 'goal-1',
      }),
    ).rejects.toThrow(NotFoundException);

    // Only the one (failed) update call — no second attempt to mark it 'failed'.
    expect(prisma.book.update).toHaveBeenCalledTimes(1);
  });

  it('still throws the original error when the failure-mark update itself fails for an unrelated reason', async () => {
    const { prisma, pdfRender, service } = makeMocks();
    setupHappyPath(prisma);
    pdfRender.render.mockRejectedValue(new Error('Puppeteer crash'));
    prisma.book.update.mockRejectedValueOnce(new Error('DB connection lost'));

    await expect(
      service.generate({
        bookId: 'book-1',
        userId: 'u1',
        childId: 'child-1',
        learningGoalId: 'goal-1',
      }),
    ).rejects.toThrow('Puppeteer crash');
  });
});
