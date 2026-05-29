import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, type Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { GENERATION_QUEUE, GENERATE_BOOK_JOB, type GenerateBookPayload } from './generation.types';

export interface EnqueueResult {
  jobId: string;
}

@Injectable()
export class GenerationService {
  constructor(
    @InjectQueue(GENERATION_QUEUE) private readonly queue: Queue,
    private readonly prisma: PrismaService,
  ) {}

  async enqueueBook(bookId: string, userId: string): Promise<EnqueueResult> {
    const book = await this.prisma.book.findUnique({
      where: { id: bookId },
      select: { id: true, userId: true, status: true },
    });

    if (!book || book.userId !== userId) throw new NotFoundException('Book not found');
    if (book.status === 'generating') throw new ConflictException('Generation already in progress');
    if (book.status === 'ready') throw new ConflictException('Book already generated');

    const job = await this.queue.add(GENERATE_BOOK_JOB, { bookId, userId });

    return { jobId: (job as Job<GenerateBookPayload>).id ?? bookId };
  }

  async getJobStatus(jobId: string): Promise<string | null> {
    const job = await this.queue.getJob(jobId);
    if (!job) return null;
    return job.getState();
  }
}
