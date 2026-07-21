import {
  Injectable,
  HttpException,
  HttpStatus,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { Prisma, SubscriptionPlan } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../s3/s3.service';
import { isActiveSubscriptionStatus } from '../prisma/subscription-status.util';
import { ageToAgeBand } from '../pdf/page-templates/page-templates.config';

interface CreateChildDto {
  name: string;
  age: number;
  gender?: 'male' | 'female' | 'other';
  appearance?: string;
}

interface CreateBookDto {
  childId: string;
  learningGoalId: string;
  mode: 'fast' | 'custom';
  protagonistMode: 'child' | 'observer';
  artStyle: 'watercolor' | 'cartoon' | 'storybook' | 'pixel' | 'realistic';
  interests: string[];
  motifs: string[];
  favoriteWords: string[];
}

export interface QuotaInfo {
  plan: SubscriptionPlan;
  used: number;
  limit: number;
}

const PLAN_LIMITS: Record<SubscriptionPlan, number> = {
  [SubscriptionPlan.free]: 1,
  [SubscriptionPlan.premium]: 30,
};

const PERIOD_DAYS = 30;

// Prisma's interactive-transaction default is 5s — createBook's transaction holds a
// per-user advisory lock, so a legitimate double-click/retry queued behind it needs
// more headroom than that before it's treated as a failure.
const TRANSACTION_TIMEOUT_MS = 10_000;

// failed/images_failed books are excluded from the success quota (#280), which on its
// own would let repeated failures be retried without limit — a reliably-failing input
// (or a scripted attacker) could rack up unbounded real LLM/render cost. This caps
// attempts, independent of the success quota. Scaled to the plan's own limit (not a
// flat number) so a premium user isn't locked out for the same handful of failures a
// free user would be — floored so a free user (limit 1) still gets a few retries.
const MIN_FAILED_ATTEMPTS_CAP = 5;

@Injectable()
export class BooksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
  ) {}

  listChildren(userId: string) {
    return this.prisma.child.findMany({
      where: { userId },
      orderBy: { name: 'asc' },
    });
  }

  createChild(userId: string, dto: CreateChildDto) {
    return this.prisma.child.upsert({
      where: { userId_name: { userId, name: dto.name } },
      create: {
        userId,
        name: dto.name,
        age: dto.age,
        gender: dto.gender,
        appearance: dto.appearance,
      },
      update: { age: dto.age, gender: dto.gender, appearance: dto.appearance },
    });
  }

  private async assertChildOwned(userId: string, childId: string): Promise<void> {
    const child = await this.prisma.child.findFirst({
      where: { id: childId, userId },
      select: { id: true },
    });
    if (!child) {
      throw new HttpException('Child not found', HttpStatus.NOT_FOUND);
    }
  }

  async listLearningGoals(userId: string, childId?: string, explicitAge?: number) {
    let age = explicitAge;
    if (age === undefined && childId) {
      const child = await this.prisma.child.findFirst({
        where: { id: childId, userId },
        select: { age: true },
      });
      age = child?.age;
    }
    const excludeFlaw = age !== undefined && ageToAgeBand(age) === '3-4';
    return this.prisma.learningGoal.findMany({
      where:
        age === undefined
          ? undefined
          : {
              ageRangeMin: { lte: age },
              ageRangeMax: { gte: age },
              ...(excludeFlaw ? { NOT: { arcType: 'flaw' as const } } : {}),
            },
      orderBy: { title: 'asc' },
    });
  }

  async getQuota(userId: string): Promise<QuotaInfo> {
    return this.computeQuota(this.prisma, userId);
  }

  private async computeQuota(client: Prisma.TransactionClient, userId: string): Promise<QuotaInfo> {
    const periodStart = new Date(Date.now() - PERIOD_DAYS * 24 * 60 * 60 * 1000);

    // Run concurrently, not sequentially — this runs inside createBook's held advisory
    // lock, so every extra round trip here lengthens the critical section for anyone
    // else queued behind the same user's lock.
    const [sub, used] = await Promise.all([
      client.subscription.findUnique({ where: { userId }, select: { plan: true, status: true } }),
      // failed/images_failed books don't count — a transient generation error (LLM
      // rate limit, PDF render crash) shouldn't permanently cost the user a slot (#280).
      client.book.count({
        where: {
          userId,
          createdAt: { gte: periodStart },
          status: { notIn: ['failed', 'images_failed'] },
        },
      }),
    ]);

    const plan = sub && isActiveSubscriptionStatus(sub.status) ? sub.plan : SubscriptionPlan.free;
    const limit = PLAN_LIMITS[plan];

    return { plan, used, limit };
  }

  /**
   * Runs `createRow` inside one transaction serialized per user via a Postgres
   * advisory lock, after re-checking quota inside that same transaction —
   * otherwise two concurrent requests can both read `used < limit` before
   * either commits and both create a book (#154). A generous timeout keeps a
   * legitimate double-click/retry queued behind the same user's lock from
   * tripping Prisma's 5s default and surfacing as a 500.
   */
  private async withQuotaLock<T>(
    userId: string,
    createRow: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId})::bigint)`;

        const [{ used, limit }, failedAttempts] = await Promise.all([
          this.computeQuota(tx, userId),
          this.countFailedAttempts(tx, userId),
        ]);

        if (used >= limit) {
          throw new HttpException(
            { message: 'Book quota exceeded for current plan', used, limit },
            HttpStatus.PAYMENT_REQUIRED,
          );
        }
        if (failedAttempts >= Math.max(limit, MIN_FAILED_ATTEMPTS_CAP)) {
          throw new HttpException(
            { message: 'Too many failed generation attempts recently — please try again later' },
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }

        return createRow(tx);
      },
      { timeout: TRANSACTION_TIMEOUT_MS },
    );
  }

  private countFailedAttempts(client: Prisma.TransactionClient, userId: string): Promise<number> {
    const periodStart = new Date(Date.now() - PERIOD_DAYS * 24 * 60 * 60 * 1000);
    return client.book.count({
      where: {
        userId,
        createdAt: { gte: periodStart },
        status: { in: ['failed', 'images_failed'] },
      },
    });
  }

  async createBook(userId: string, dto: CreateBookDto) {
    await this.assertChildOwned(userId, dto.childId);

    const book = await this.withQuotaLock(userId, (tx) =>
      tx.book.create({
        data: {
          userId,
          childId: dto.childId,
          learningGoalId: dto.learningGoalId,
          title: '',
          status: 'pending',
          protagonistMode: dto.protagonistMode,
          artStyle: dto.artStyle,
          interests: dto.interests,
          motifs: dto.motifs,
          favoriteWords: dto.favoriteWords,
        },
        select: { id: true, status: true, childId: true, learningGoalId: true, createdAt: true },
      }),
    );

    return { ...book, mode: dto.mode };
  }

  /**
   * Reserves a book slot for the fast-flow generation path (#280): fast flow
   * previously created its Book row only after an LLM call completed, with no
   * atomic quota re-check at that point — a much larger TOCTOU window than
   * #154 closed for the custom flow. Reserving here, before generation starts,
   * closes it the same way; FastFlowService updates this row instead of
   * creating its own.
   */
  async reserveFastFlowBook(
    userId: string,
    childId: string,
    learningGoalId: string,
  ): Promise<{ id: string }> {
    await this.assertChildOwned(userId, childId);
    await this.assertFastFlowTemplateExists(learningGoalId);

    return this.withQuotaLock(userId, (tx) =>
      tx.book.create({
        data: { userId, childId, learningGoalId, title: '', status: 'generating' },
        select: { id: true },
      }),
    );
  }

  /**
   * Book.learningGoalId is a required FK — validate it before reserving, or an
   * invalid id surfaces as a raw FK-violation 500 instead of a clean 404 (#280).
   * FastFlowService re-fetches the template afterward for illustrationTags; this
   * check only confirms existence, so the two don't share a query.
   */
  private async assertFastFlowTemplateExists(learningGoalId: string): Promise<void> {
    const template = await this.prisma.template.findFirst({
      where: { learningGoalId },
      select: { id: true },
    });
    if (!template) {
      throw new NotFoundException(`No template for learning goal ${learningGoalId}`);
    }
  }

  listBooks(userId: string) {
    return this.prisma.book.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        status: true,
        createdAt: true,
        imageKeys: true,
        child: { select: { name: true, age: true } },
        learningGoal: { select: { title: true } },
      },
    });
  }

  findById(bookId: string) {
    return this.prisma.book.findUnique({
      where: { id: bookId },
      select: { id: true, status: true, userId: true },
    });
  }

  getBook(userId: string, bookId: string) {
    return this.prisma.book.findFirst({
      where: { id: bookId, userId },
      include: {
        child: { select: { name: true, age: true } },
        learningGoal: { select: { title: true } },
        pages: { orderBy: { pageNumber: 'asc' } },
        evals: { orderBy: { attempt: 'desc' }, take: 1 },
      },
    });
  }

  /**
   * Delete a book the user owns. S3 assets are removed first (best-effort), then
   * the row — pages and evals cascade via the schema. Throws 404 if the book is
   * not the user's, 409 while it's still pending/generating (#280): allowing
   * that would let a user loop reserve→delete to bypass the quota entirely
   * (computeQuota only counts existing rows) and orphan whatever the in-flight
   * generation later uploads to S3, since deletion only cleans up what's on the
   * row at delete time. A book stuck non-terminal isn't a permanent lockout —
   * StaleBooksSweeperService flips both 'pending' and 'generating' to 'failed'
   * within its sweep window, after which it deletes normally.
   */
  async deleteBook(userId: string, bookId: string): Promise<void> {
    const book = await this.prisma.book.findFirst({
      where: { id: bookId, userId },
      select: { id: true, status: true, imageKeys: true, characterPortraitKey: true, pdfKey: true },
    });
    if (!book) throw new NotFoundException('Book not found');
    if (book.status === 'pending' || book.status === 'generating') {
      throw new ConflictException('Cannot delete a book while it is still being generated');
    }

    const keys = [...book.imageKeys, book.characterPortraitKey, book.pdfKey].filter(
      (k): k is string => Boolean(k),
    );
    await this.s3.deleteObjects(keys);
    await this.prisma.book.delete({ where: { id: bookId } });
  }
}
