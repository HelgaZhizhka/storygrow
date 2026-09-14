import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { ImageEvalRow, ImageEvalSink } from './image-eval.sink';

/** Production sink: one `ImageEval` row per page per attempt — never silent. */
@Injectable()
export class PrismaImageEvalStore implements ImageEvalSink {
  constructor(private readonly prisma: PrismaService) {}

  async record(row: ImageEvalRow): Promise<void> {
    await this.prisma.imageEval.create({
      data: {
        bookId: row.bookId,
        pageNumber: row.pageNumber,
        attempt: row.attempt,
        run: row.run,
        scores: row.scores,
        passed: row.passed,
        failures: row.failures,
        reasoning: row.reasoning,
        model: row.model,
        prompt: row.prompt,
        labels: row.labels,
      },
    });
  }
}
