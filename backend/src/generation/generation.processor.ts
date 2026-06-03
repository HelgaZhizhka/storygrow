import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { type Job } from 'bullmq';
import { BookStatus } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StoryOrchestratorService } from '../ai/story-generator/story-orchestrator.service';
import { ImageGeneratorService } from '../ai/image-generator/image-generator.service';
import { BookImageService } from '../books/book-image.service';
import { BookProgressService } from '../books/book-progress.service';
import { PdfRenderService } from '../pdf/pdf-render.service';
import type { Story } from '../ai/schemas';
import { GENERATION_QUEUE, type GenerateBookPayload } from './generation.types';

interface BookWithRelations {
  id: string;
  storyJson: Story | null;
  imageKeys: string[];
  child: { name: string; age: number };
  learningGoal: { title: string; description: string };
}

@Processor(GENERATION_QUEUE)
export class GenerationProcessor extends WorkerHost {
  private readonly logger = new Logger(GenerationProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly orchestrator: StoryOrchestratorService,
    private readonly imageGenerator: ImageGeneratorService,
    private readonly bookImage: BookImageService,
    private readonly pdfRender: PdfRenderService,
    private readonly bookProgress: BookProgressService,
  ) {
    super();
  }

  async process(job: Job<GenerateBookPayload>): Promise<void> {
    const { bookId, userId } = job.data;
    this.logger.log(`Processing job ${job.id} for book ${bookId}`);

    let generatingSet = false;
    try {
      await this.setStatus(bookId, BookStatus.generating);
      generatingSet = true;
      this.bookProgress.emit(bookId, { type: 'generating', message: 'Подготовка…' });
      await job.updateProgress(10);

      const book = await this.fetchBook(bookId, userId);
      this.bookProgress.emit(bookId, {
        type: 'progress',
        progress: 20,
        message: 'Получение данных…',
      });
      await job.updateProgress(20);

      // On retry: skip orchestrator if story was already generated and saved
      let story: Story;
      if (book.storyJson) {
        this.logger.log(`Book ${bookId}: reusing saved storyJson (retry path)`);
        story = book.storyJson;
        this.bookProgress.emit(bookId, {
          type: 'progress',
          progress: 60,
          message: 'История уже сгенерирована — повторяем иллюстрации',
        });
        await job.updateProgress(60);
      } else {
        const storyResult = await this.orchestrator.generate({
          bookId,
          childName: book.child.name,
          childAge: book.child.age,
          topic: book.learningGoal.title,
          learningGoal: book.learningGoal.description,
        });
        story = storyResult.story;
        this.bookProgress.emit(bookId, {
          type: 'progress',
          progress: 60,
          message: `История сгенерирована (попытка ${storyResult.attempts})`,
        });
        await job.updateProgress(60);
        await this.prisma.book.update({
          where: { id: bookId },
          data: { storyJson: story },
        });
      }

      // On retry: skip image-gen if images are already stored
      let imageKeys: string[];
      if (book.imageKeys.length > 0) {
        this.logger.log(
          `Book ${bookId}: reusing ${book.imageKeys.length} saved image keys (retry path)`,
        );
        imageKeys = book.imageKeys;
      } else {
        imageKeys = await this.imageGenerator.generate({ story, bookId });
        await this.prisma.book.update({
          where: { id: bookId },
          data: { imageKeys },
        });
      }
      this.bookProgress.emit(bookId, {
        type: 'progress',
        progress: 85,
        message: 'Иллюстрации готовы',
      });
      await job.updateProgress(85);

      const illustrationUrls = await this.bookImage.signKeys(imageKeys);
      const pdfKey = await this.pdfRender.render({
        bookId,
        story,
        illustrationUrls,
      });
      await job.updateProgress(95);

      await this.prisma.book.update({
        where: { id: bookId },
        data: { pdfKey, status: BookStatus.ready },
      });
      await job.updateProgress(100);
      this.bookProgress.emit(bookId, { type: 'ready', progress: 100, message: 'Книга готова!' });

      this.logger.log(`Book ${bookId} ready`);
    } catch (err: unknown) {
      this.logger.error(`Job ${job.id} failed for book ${bookId}`, err);
      if (generatingSet) {
        await this.setStatus(bookId, BookStatus.failed);
        this.bookProgress.emit(bookId, { type: 'failed', message: 'Ошибка генерации' });
      }
      throw err;
    }
  }

  private async fetchBook(bookId: string, userId: string): Promise<BookWithRelations> {
    const book = await this.prisma.book.findUnique({
      where: { id: bookId, userId },
      select: {
        id: true,
        storyJson: true,
        imageKeys: true,
        child: { select: { name: true, age: true } },
        learningGoal: { select: { title: true, description: true } },
      },
    });
    if (!book) throw new Error(`Book ${bookId} not found for user ${userId}`);
    return { ...book, storyJson: book.storyJson as Story | null };
  }

  private async setStatus(bookId: string, status: BookStatus): Promise<void> {
    await this.prisma.book.update({ where: { id: bookId }, data: { status } });
  }
}
