import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { type Job } from 'bullmq';
import { BookStatus } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StoryOrchestratorService } from '../ai/story-generator/story-orchestrator.service';
import { ImageGeneratorService } from '../ai/image-generator/image-generator.service';
import { GENERATION_QUEUE, type GenerateBookPayload } from './generation.types';

interface BookWithRelations {
  id: string;
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
      await job.updateProgress(10);

      const book = await this.fetchBook(bookId, userId);
      await job.updateProgress(20);

      const storyResult = await this.orchestrator.generate({
        bookId,
        childName: book.child.name,
        childAge: book.child.age,
        topic: book.learningGoal.title,
        learningGoal: book.learningGoal.description,
      });
      await job.updateProgress(60);

      await this.prisma.book.update({
        where: { id: bookId },
        data: { storyJson: storyResult.story },
      });

      const imageKeys = await this.imageGenerator.generate({
        story: storyResult.story,
        bookId,
      });
      await job.updateProgress(90);

      await this.prisma.book.update({
        where: { id: bookId },
        data: { imageKeys, status: BookStatus.ready },
      });
      await job.updateProgress(100);

      this.logger.log(`Book ${bookId} generated in ${storyResult.attempts} attempt(s)`);
    } catch (err: unknown) {
      this.logger.error(`Job ${job.id} failed for book ${bookId}`, err);
      if (generatingSet) await this.setStatus(bookId, BookStatus.failed);
      throw err;
    }
  }

  private async fetchBook(bookId: string, userId: string): Promise<BookWithRelations> {
    const book = await this.prisma.book.findUnique({
      where: { id: bookId, userId },
      select: {
        id: true,
        child: { select: { name: true, age: true } },
        learningGoal: { select: { title: true, description: true } },
      },
    });
    if (!book) throw new Error(`Book ${bookId} not found for user ${userId}`);
    return book;
  }

  private async setStatus(bookId: string, status: BookStatus): Promise<void> {
    await this.prisma.book.update({ where: { id: bookId }, data: { status } });
  }
}
