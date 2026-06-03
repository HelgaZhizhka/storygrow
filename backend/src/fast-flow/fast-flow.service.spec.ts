jest.mock('../../generated/prisma/client', () => ({ PrismaClient: class {} }));
jest.mock('puppeteer', () => ({ __esModule: true, default: { launch: jest.fn() } }));

import { NotFoundException } from '@nestjs/common';
import { FastFlowService } from './fast-flow.service';

const mockChild = { id: 'child-1', name: 'Аня', age: 6 };

const templateContent = {
  pages: [
    { pageNumber: 1, text: '{{childName}} вышел в парк.', illustrationTag: 'park' },
    { pageNumber: 2, text: 'Рядом сидела девочка.', illustrationTag: 'sad' },
    { pageNumber: 3, text: '{{childName}} протянул игрушку.', illustrationTag: 'sharing' },
    { pageNumber: 4, text: 'Они стали друзьями.', illustrationTag: 'happy' },
    { pageNumber: 5, text: 'Делиться — значит дарить радость.', illustrationTag: 'happy' },
  ],
};

const mockTemplate = {
  id: 'tpl-1',
  title: 'Маленький {{childName}} учится делиться',
  content: templateContent,
  learningGoalId: 'goal-1',
};

const mockIllustrations = [
  { id: 'ill-park', url: 'https://s3/park.png', tags: ['park'] },
  { id: 'ill-sad', url: 'https://s3/sad.png', tags: ['sad'] },
  { id: 'ill-sharing', url: 'https://s3/sharing.png', tags: ['sharing'] },
  { id: 'ill-happy', url: 'https://s3/happy.png', tags: ['happy'] },
];

function makeMocks() {
  const prisma = {
    child: { findUnique: jest.fn() },
    template: { findFirst: jest.fn() },
    fastIllustration: { findMany: jest.fn() },
    book: { create: jest.fn(), update: jest.fn() },
    bookPage: { createMany: jest.fn() },
  };
  const pdfRender = { render: jest.fn() };
  const service = new FastFlowService(prisma as never, pdfRender as never);
  return { prisma, pdfRender, service };
}

describe('FastFlowService.generate', () => {
  it('throws NotFoundException when child does not exist', async () => {
    const { prisma, service } = makeMocks();
    prisma.child.findUnique.mockResolvedValue(null);

    await expect(
      service.generate({ userId: 'u1', childId: 'c1', learningGoalId: 'g1' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws NotFoundException when no template exists for the learning goal', async () => {
    const { prisma, service } = makeMocks();
    prisma.child.findUnique.mockResolvedValue(mockChild);
    prisma.template.findFirst.mockResolvedValue(null);

    await expect(
      service.generate({ userId: 'u1', childId: 'child-1', learningGoalId: 'missing-goal' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('substitutes {{childName}} in title and page texts', async () => {
    const { prisma, pdfRender, service } = makeMocks();
    prisma.child.findUnique.mockResolvedValue(mockChild);
    prisma.template.findFirst.mockResolvedValue(mockTemplate);
    prisma.fastIllustration.findMany.mockResolvedValue(mockIllustrations);
    prisma.book.create.mockResolvedValue({ id: 'book-1' });
    pdfRender.render.mockResolvedValue('books/book-1/book.pdf');
    prisma.bookPage.createMany.mockResolvedValue({ count: 5 });
    prisma.book.update.mockResolvedValue({});

    await service.generate({ userId: 'u1', childId: 'child-1', learningGoalId: 'goal-1' });

    const renderCall = pdfRender.render.mock.calls[0][0];
    expect(renderCall.story.title).toBe('Маленький Аня учится делиться');
    expect(renderCall.story.pages[0].title).toBe('Маленький Аня учится делиться');
    expect(renderCall.story.pages[2].text).toBe('Аня протянул игрушку.');
  });

  it('maps first page to cover, last to final, middle pages cycle content templates', async () => {
    const { prisma, pdfRender, service } = makeMocks();
    prisma.child.findUnique.mockResolvedValue(mockChild);
    prisma.template.findFirst.mockResolvedValue(mockTemplate);
    prisma.fastIllustration.findMany.mockResolvedValue(mockIllustrations);
    prisma.book.create.mockResolvedValue({ id: 'book-1' });
    pdfRender.render.mockResolvedValue('books/book-1/book.pdf');
    prisma.bookPage.createMany.mockResolvedValue({ count: 5 });
    prisma.book.update.mockResolvedValue({});

    await service.generate({ userId: 'u1', childId: 'child-1', learningGoalId: 'goal-1' });

    const pages = pdfRender.render.mock.calls[0][0].story.pages;
    expect(pages[0].template).toBe('cover');
    expect(pages[0].text).toBeNull();
    expect(pages[pages.length - 1].template).toBe('final');
    expect(pages[1].template).toBe('image-top');
    expect(pages[2].template).toBe('image-bottom');
    expect(pages[3].template).toBe('image-left');
  });

  it('picks illustrations by tag and passes them to PdfRenderService', async () => {
    const { prisma, pdfRender, service } = makeMocks();
    prisma.child.findUnique.mockResolvedValue(mockChild);
    prisma.template.findFirst.mockResolvedValue(mockTemplate);
    prisma.fastIllustration.findMany.mockResolvedValue(mockIllustrations);
    prisma.book.create.mockResolvedValue({ id: 'book-1' });
    pdfRender.render.mockResolvedValue('books/book-1/book.pdf');
    prisma.bookPage.createMany.mockResolvedValue({ count: 5 });
    prisma.book.update.mockResolvedValue({});

    await service.generate({ userId: 'u1', childId: 'child-1', learningGoalId: 'goal-1' });

    const { illustrationUrls } = pdfRender.render.mock.calls[0][0];
    expect(illustrationUrls[0]).toBe('https://s3/park.png');
    expect(illustrationUrls[1]).toBe('https://s3/sad.png');
    expect(illustrationUrls[2]).toBe('https://s3/sharing.png');
  });

  it('marks book as failed and re-throws when PDF render fails', async () => {
    const { prisma, pdfRender, service } = makeMocks();
    prisma.child.findUnique.mockResolvedValue(mockChild);
    prisma.template.findFirst.mockResolvedValue(mockTemplate);
    prisma.fastIllustration.findMany.mockResolvedValue(mockIllustrations);
    prisma.book.create.mockResolvedValue({ id: 'book-1' });
    pdfRender.render.mockRejectedValue(new Error('Puppeteer crash'));
    prisma.book.update.mockResolvedValue({});

    await expect(
      service.generate({ userId: 'u1', childId: 'child-1', learningGoalId: 'goal-1' }),
    ).rejects.toThrow('Puppeteer crash');

    expect(prisma.book.update).toHaveBeenCalledWith({
      where: { id: 'book-1' },
      data: { status: 'failed' },
    });
  });

  it('returns bookId and pdfKey on success', async () => {
    const { prisma, pdfRender, service } = makeMocks();
    prisma.child.findUnique.mockResolvedValue(mockChild);
    prisma.template.findFirst.mockResolvedValue(mockTemplate);
    prisma.fastIllustration.findMany.mockResolvedValue(mockIllustrations);
    prisma.book.create.mockResolvedValue({ id: 'book-42' });
    pdfRender.render.mockResolvedValue('books/book-42/book.pdf');
    prisma.bookPage.createMany.mockResolvedValue({ count: 5 });
    prisma.book.update.mockResolvedValue({});

    const result = await service.generate({
      userId: 'u1',
      childId: 'child-1',
      learningGoalId: 'goal-1',
    });

    expect(result).toEqual({ bookId: 'book-42', pdfKey: 'books/book-42/book.pdf' });
  });
});
