import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { PrismaService } from '../prisma/prisma.service';
import { JudgeScoreSchema } from '../ai/schemas/judge.schema';
import type { JudgeScores } from '../ai/schemas/judge.schema';
import { computeImageMetrics } from './image-metrics';

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

  /** Image pipeline outcomes and cost per provider over the window (#379). */
  @Get('metrics/images')
  async getImageMetrics() {
    const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const [rows, books] = await Promise.all([
      this.prisma.imageEval.findMany({
        where: { judgedAt: { gte: since } },
        select: {
          bookId: true,
          run: true,
          pageNumber: true,
          attempt: true,
          passed: true,
          failures: true,
          model: true,
          labels: true,
        },
      }),
      this.prisma.book.findMany({
        where: { createdAt: { gte: since } },
        select: { imageModel: true, characterPortraitKey: true, referenceImageKeys: true },
      }),
    ]);
    return computeImageMetrics({ rows, books, windowDays: WINDOW_DAYS });
  }

  @Get('metrics')
  async getMetrics() {
    const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);

    const [totalBooks, readyBooks, recentEvals, firstAttemptEvals] = await Promise.all([
      this.prisma.book.count(),
      this.prisma.book.count({ where: { status: 'ready' } }),
      this.prisma.storyEval.findMany({
        where: { generatedAt: { gte: since } },
        select: { judgeScores: true, finalScore: true, passed: true, attempt: true },
      }),
      this.prisma.storyEval.findMany({
        where: { attempt: 1, passed: true },
        select: { judgeScores: true },
      }),
    ]);

    // Legacy Fast Flow books (mode removed #402) wrote a placeholder StoryEval
    // (finalScore: 0, judgeScores: {}, "no quality evaluation"); such rows still
    // exist in the DB and must not dilute the AI-quality metrics below.
    const realRecentEvals = recentEvals.filter(isRealJudgeEval);
    return {
      windowDays: WINDOW_DAYS,
      totalBooks,
      readyBooks,
      passedFirstAttempt: firstAttemptEvals.filter(isRealJudgeEval).length,
      passRate: totalBooks > 0 ? readyBooks / totalBooks : 0,
      meanFinalScore: meanPassedFinalScore(realRecentEvals),
      meanCriterionScores: computeMeanCriterionScores(realRecentEvals),
      recentEvalCount: realRecentEvals.length,
    };
  }
}

/** True for a real LLM-judge evaluation, false for a legacy Fast Flow placeholder row (#402). */
function isRealJudgeEval(evalRow: { judgeScores: unknown }): boolean {
  return (
    typeof evalRow.judgeScores === 'object' &&
    evalRow.judgeScores !== null &&
    Object.keys(evalRow.judgeScores).length > 0
  );
}

function computeMeanCriterionScores(
  evals: { judgeScores: unknown; passed: boolean }[],
): Record<string, number> {
  const passedEvals = evals.filter((e) => e.passed);
  // Parse leniently so historical rows written before a criterion existed (e.g.
  // 6-key rows predating `earnedResolution`) still contribute their present
  // keys. Each criterion averages only over the rows that actually carry it.
  const lenient = JudgeScoreSchema.partial();
  const sums = Object.fromEntries(JUDGE_CRITERIA.map((k) => [k, 0]));
  const counts = Object.fromEntries(JUDGE_CRITERIA.map((k) => [k, 0]));

  for (const evalRow of passedEvals) {
    const parsed = lenient.safeParse(evalRow.judgeScores);
    if (!parsed.success) continue;
    for (const key of JUDGE_CRITERIA) {
      const value = parsed.data[key];
      if (typeof value === 'number') {
        sums[key] = (sums[key] ?? 0) + value;
        counts[key] = (counts[key] ?? 0) + 1;
      }
    }
  }

  return Object.fromEntries(
    JUDGE_CRITERIA.map((k) => {
      const count = counts[k] ?? 0;
      return [k, count === 0 ? 0 : Math.round(((sums[k] ?? 0) / count) * 100) / 100];
    }),
  );
}

/** Mean finalScore over the passed evals, rounded to 2 decimals; null when none passed. */
const meanPassedFinalScore = (evals: Array<{ passed: boolean; finalScore: number }>) => {
  const passed = evals.filter((e) => e.passed);
  if (passed.length === 0) return null;
  const mean = passed.reduce((sum, e) => sum + e.finalScore, 0) / passed.length;
  return Math.round(mean * 100) / 100;
};
