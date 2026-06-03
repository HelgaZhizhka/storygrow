import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { PrismaService } from '../prisma/prisma.service';
import { JudgeScoreSchema } from '../ai/schemas/judge.schema';
import type { JudgeScores } from '../ai/schemas/judge.schema';

const booksQuerySchema = z.object({
  status: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

const JUDGE_CRITERIA = Object.keys(JudgeScoreSchema.shape) as (keyof JudgeScores)[];
const WINDOW_DAYS = 7;

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminBooksController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('books')
  async listBooks(@Query() rawQuery: unknown) {
    const query = booksQuerySchema.parse(rawQuery);

    const where: Record<string, unknown> = {};
    if (query.status) where['status'] = query.status;
    if (query.dateFrom || query.dateTo) {
      const createdAt: Record<string, Date> = {};
      if (query.dateFrom) createdAt['gte'] = new Date(query.dateFrom);
      if (query.dateTo) createdAt['lte'] = new Date(query.dateTo);
      where['createdAt'] = createdAt;
    }

    return this.prisma.book.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true,
        title: true,
        status: true,
        createdAt: true,
        child: { select: { name: true, age: true } },
        learningGoal: { select: { title: true } },
        evals: {
          orderBy: { attempt: 'desc' },
          take: 1,
          select: { finalScore: true, passed: true, attempt: true, generatedAt: true },
        },
      },
    });
  }

  @Get('metrics')
  async getMetrics() {
    const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);

    const [totalBooks, readyBooks, recentEvals, passedFirstAttempt] = await Promise.all([
      this.prisma.book.count(),
      this.prisma.book.count({ where: { status: 'ready' } }),
      this.prisma.storyEval.findMany({
        where: { generatedAt: { gte: since } },
        select: { judgeScores: true, finalScore: true, passed: true, attempt: true },
      }),
      this.prisma.storyEval.count({ where: { attempt: 1, passed: true } }),
    ]);

    const meanCriterionScores = computeMeanCriterionScores(recentEvals);
    const passedEvals = recentEvals.filter((e) => e.passed);
    const meanFinalScore =
      passedEvals.length > 0
        ? passedEvals.reduce((sum, e) => sum + e.finalScore, 0) / passedEvals.length
        : null;

    return {
      windowDays: WINDOW_DAYS,
      totalBooks,
      readyBooks,
      passedFirstAttempt,
      passRate: totalBooks > 0 ? readyBooks / totalBooks : 0,
      meanFinalScore: meanFinalScore !== null ? Math.round(meanFinalScore * 100) / 100 : null,
      meanCriterionScores,
      recentEvalCount: recentEvals.length,
    };
  }
}

function computeMeanCriterionScores(
  evals: { judgeScores: unknown; passed: boolean }[],
): Record<string, number> {
  const passedEvals = evals.filter((e) => e.passed);
  if (passedEvals.length === 0) return Object.fromEntries(JUDGE_CRITERIA.map((k) => [k, 0]));

  const sums = Object.fromEntries(JUDGE_CRITERIA.map((k) => [k, 0]));
  let validCount = 0;

  for (const evalRow of passedEvals) {
    const parsed = JudgeScoreSchema.safeParse(evalRow.judgeScores);
    if (!parsed.success) continue;
    validCount++;
    for (const key of JUDGE_CRITERIA) {
      sums[key] = (sums[key] ?? 0) + (parsed.data[key] ?? 0);
    }
  }

  if (validCount === 0) return Object.fromEntries(JUDGE_CRITERIA.map((k) => [k, 0]));
  return Object.fromEntries(
    JUDGE_CRITERIA.map((k) => [k, Math.round(((sums[k] ?? 0) / validCount) * 100) / 100]),
  );
}
