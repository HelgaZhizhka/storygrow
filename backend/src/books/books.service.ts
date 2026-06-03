import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface CreateChildDto {
  name: string;
  age: number;
  gender?: 'male' | 'female' | 'other';
}

interface CreateBookDto {
  childId: string;
  learningGoalId: string;
  mode: 'fast' | 'custom';
}

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
    return this.prisma.child.create({
      data: { userId, name: dto.name, age: dto.age, gender: dto.gender },
    });
  }

  listLearningGoals() {
    return this.prisma.learningGoal.findMany({ orderBy: { title: 'asc' } });
  }

  async createBook(userId: string, dto: CreateBookDto) {
    const book = await this.prisma.book.create({
      data: {
        userId,
        childId: dto.childId,
        learningGoalId: dto.learningGoalId,
        title: '',
        status: 'pending',
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
        child: { select: { name: true, age: true } },
        learningGoal: { select: { title: true } },
      },
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
