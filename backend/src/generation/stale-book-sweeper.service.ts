import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { BookStatus } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BookProgressService } from '../books/book-progress.service';

const SWEEP_INTERVAL_MS = 5 * 60 * 1000;
const STALE_THRESHOLD_MS = 10 * 60 * 1000;

@Injectable()
export class StaleBooksSweeperService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(StaleBooksSweeperService.name);
  private intervalId: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly bookProgress: BookProgressService,
  ) {}

  onModuleInit(): void {
    this.intervalId = setInterval(() => void this.sweep(), SWEEP_INTERVAL_MS);
  }

  onModuleDestroy(): void {
    if (this.intervalId !== null) clearInterval(this.intervalId);
  }

  async sweep(): Promise<number> {
    const threshold = new Date(Date.now() - STALE_THRESHOLD_MS);

    const staleBooks = await this.prisma.book.findMany({
      // 'pending' is deliberately excluded — for the custom flow it's a long-lived
      // draft state (created before the user separately triggers generation), not a
      // stuck job; sweeping it would force-fail a book the user just hasn't finished
      // personalizing yet (#280).
      where: { status: BookStatus.generating, updatedAt: { lt: threshold } },
      select: { id: true, storyJson: true, updatedAt: true },
    });

    if (staleBooks.length === 0) return 0;

    await Promise.all(
      staleBooks.map(async (book) => {
        const stuckMinutes = Math.round((Date.now() - book.updatedAt.getTime()) / 60_000);
        const failStatus = book.storyJson != null ? BookStatus.images_failed : BookStatus.failed;

        await this.prisma.book.update({
          where: { id: book.id },
          data: { status: failStatus },
        });
        this.bookProgress.emit(book.id, { type: 'failed', message: 'Ошибка генерации' });
        this.logger.warn(`Stale book ${book.id} stuck ${stuckMinutes}min → ${failStatus}`);
      }),
    );

    return staleBooks.length;
  }
}
