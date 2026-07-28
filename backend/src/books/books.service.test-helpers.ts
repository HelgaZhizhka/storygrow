jest.mock('../generated/prisma/client', () => ({
  PrismaClient: class {},
  SubscriptionPlan: { free: 'free', premium: 'premium' },
  SubscriptionStatus: {
    active: 'active',
    trialing: 'trialing',
    canceled: 'canceled',
    past_due: 'past_due',
  },
}));

import { Test } from '@nestjs/testing';
import { BooksService } from './books.service';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../s3/s3.service';
import { LearningGoalSafetyService } from '../ai/learning-goal-safety/learning-goal-safety.service';

export const mockLearningGoalSafety = { check: jest.fn() };

export const basePrisma = {
  child: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    upsert: jest.fn(),
  },
  learningGoal: {
    findMany: jest.fn<Promise<unknown[]>, [{ where?: unknown; orderBy?: unknown }]>(),
    create: jest.fn(),
  },
  subscription: { findUnique: jest.fn() },
  book: {
    count: jest.fn(),
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    delete: jest.fn(),
  },
  template: { findFirst: jest.fn() },
  $executeRaw: jest.fn(),
};

// createBook runs inside a transaction (#154) — the mock hands the callback
// basePrisma, whose nested spies (book.create etc.) are the same objects mockPrisma exposes.
export const mockPrisma = {
  ...basePrisma,
  $transaction: jest.fn((cb: (tx: typeof basePrisma) => unknown) => cb(basePrisma)),
};

export const mockS3 = {
  deleteObjects: jest.fn(),
  uploadObject: jest.fn(),
  getSignedUrl: jest.fn(),
};

// Shared by every books.service.*.spec.ts file: resets the mocks and builds a
// fresh BooksService wired to them. Keeps each spec's beforeEach to one line
// instead of duplicating the Test.createTestingModule boilerplate per file.
export async function createBooksServiceForTest(): Promise<BooksService> {
  jest.clearAllMocks();
  const module = await Test.createTestingModule({
    providers: [
      BooksService,
      { provide: PrismaService, useValue: mockPrisma },
      { provide: S3Service, useValue: mockS3 },
      { provide: LearningGoalSafetyService, useValue: mockLearningGoalSafety },
    ],
  }).compile();
  return module.get(BooksService);
}
