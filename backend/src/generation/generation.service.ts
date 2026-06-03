import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { BookStatus } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { GENERATION_QUEUE, GENERATE_BOOK_JOB, type GenerateBookPayload } from './generation.types';

export interface EnqueueResult {
  jobId: string;
}

@Injectable()
export class GenerationService {
  constructor(
    @InjectQueue(GENERATION_QUEUE) private readonly queue: Queue<GenerateBookPayload>,
    private readonly prisma: PrismaService,
  ) {}

  async enqueueBook(bookId: string, userId: string): Promise<EnqueueResult> {
    const book = await this.prisma.book.findUnique({
      where: { id: bookId },
      select: { id: true, userId: true, status: true },
    });

    if (!book || book.userId !== userId) throw new NotFoundException('Book not found');
    if (book.status === BookStatus.generating)
      throw new ConflictException('Generation already in progress');
    if (book.status === BookStatus.ready) throw new ConflictException('Book already generated');

    const job = await this.queue.add(GENERATE_BOOK_JOB, { bookId, userId });

    if (!job.id) throw new Error(`BullMQ did not assign a job ID for book ${bookId}`);
    return { jobId: job.id };
  }

  async getJobStatus(jobId: string, userId: string): Promise<string | null> {
    const job = await this.queue.getJob(jobId);
    if (!job || job.data.userId !== userId) return null;
    return job.getState();
  }
}
