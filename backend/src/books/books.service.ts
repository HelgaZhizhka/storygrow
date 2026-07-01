import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { SubscriptionPlan, SubscriptionStatus } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

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
}

export interface QuotaInfo {
  plan: SubscriptionPlan;
  used: number;
  limit: number | null;
}

const PLAN_LIMITS: Record<SubscriptionPlan, number | null> = {
  // TEMPORARY: free is unlimited while Stripe is not wired in production, so the
  // deployed app is testable without a paid plan. Restore to 1 once billing works.
  [SubscriptionPlan.free]: null,
  [SubscriptionPlan.basic]: 10,
  [SubscriptionPlan.premium]: null,
};

const PERIOD_DAYS = 30;

@Injectable()
export class BooksService {
  constructor(private readonly prisma: PrismaService) {}

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

  async listLearningGoals(userId: string, childId?: string) {
    let age: number | undefined;
    if (childId) {
      const child = await this.prisma.child.findFirst({
        where: { id: childId, userId },
        select: { age: true },
      });
      age = child?.age;
    }
    return this.prisma.learningGoal.findMany({
      where:
        age !== undefined ? { ageRangeMin: { lte: age }, ageRangeMax: { gte: age } } : undefined,
      orderBy: { title: 'asc' },
    });
  }

  async getQuota(userId: string): Promise<QuotaInfo> {
    const sub = await this.prisma.subscription.findUnique({
      where: { userId },
      select: { plan: true, status: true },
    });

    const plan =
      sub?.status === SubscriptionStatus.active || sub?.status === SubscriptionStatus.trialing
        ? sub.plan
        : SubscriptionPlan.free;

    const limit = PLAN_LIMITS[plan];
    const periodStart = new Date(Date.now() - PERIOD_DAYS * 24 * 60 * 60 * 1000);

    const used = await this.prisma.book.count({
      where: { userId, createdAt: { gte: periodStart } },
    });

    return { plan, used, limit };
  }

  async createBook(userId: string, dto: CreateBookDto) {
    await this.assertChildOwned(userId, dto.childId);

    const { used, limit } = await this.getQuota(userId);
    if (limit !== null && used >= limit) {
      throw new HttpException(
        { message: 'Book quota exceeded for current plan', used, limit },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    const book = await this.prisma.book.create({
      data: {
        userId,
        childId: dto.childId,
        learningGoalId: dto.learningGoalId,
        title: '',
        status: 'pending',
        protagonistMode: dto.protagonistMode,
        artStyle: dto.artStyle,
      },
      select: { id: true, status: true, childId: true, learningGoalId: true, createdAt: true },
    });
    return { ...book, mode: dto.mode };
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
}
