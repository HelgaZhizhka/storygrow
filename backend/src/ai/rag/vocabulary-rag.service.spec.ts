import { Test, TestingModule } from '@nestjs/testing';
import { VocabularyRagService } from './vocabulary-rag.service';
import { PrismaService } from '../../prisma/prisma.service';

// Mock the Prisma generated client (ESM-native, incompatible with Jest CJS mode)
jest.mock('../../../generated/prisma/client', () => ({
  Prisma: {
    sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
      strings: Array.from(strings),
      values,
    }),
    raw: (value: string) => value,
  },
  PrismaClient: class {},
}));

// Mock the entire 'ai' module so no real API calls happen
jest.mock('ai', () => ({
  embed: jest.fn(),
}));

import { embed } from 'ai';
const mockEmbed = embed as jest.MockedFunction<typeof embed>;

const mockPrisma = {
  $queryRaw: jest.fn(),
};

describe('VocabularyRagService', () => {
  let service: VocabularyRagService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [VocabularyRagService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<VocabularyRagService>(VocabularyRagService);
    jest.clearAllMocks();
  });

  describe('retrieve', () => {
    const fakeEmbedding = Array.from({ length: 1536 }, (_, i) => i * 0.001);

    beforeEach(() => {
      mockEmbed.mockResolvedValue({ embedding: fakeEmbedding } as never);
    });

    it('returns words from query result', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([
        { word: 'друг' },
        { word: 'радость' },
        { word: 'лес' },
      ]);

      const result = await service.retrieve({
        topic: 'дружба',
        learningGoal: 'научиться делиться',
        gradeLevel: 1,
      });

      expect(result).toEqual(['друг', 'радость', 'лес']);
    });

    it('calls embed with concatenated topic and learningGoal', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);

      await service.retrieve({
        topic: 'приключение',
        learningGoal: 'быть смелым',
        gradeLevel: 2,
      });

      expect(mockEmbed).toHaveBeenCalledWith(
        expect.objectContaining({
          value: 'приключение быть смелым',
        }),
      );
    });

    it('uses default topK of 80 when not specified', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);
      await service.retrieve({ topic: 'тест', learningGoal: 'цель', gradeLevel: 0 });
      const rawCalls = mockPrisma.$queryRaw.mock.calls as Array<[{ strings: string[] }]>;
      const sqlString = rawCalls[0][0].strings.join('');
      expect(sqlString).toContain('LIMIT');
    });

    it('returns empty array when table is empty', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);

      const result = await service.retrieve({
        topic: 'тест',
        learningGoal: 'цель',
        gradeLevel: 1,
      });

      expect(result).toEqual([]);
    });

    it('passes gradeLevel as SQL parameter', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);
      await service.retrieve({ topic: 'тест', learningGoal: 'цель', gradeLevel: 3 });
      const rawCalls = mockPrisma.$queryRaw.mock.calls as Array<[{ values: unknown[] }]>;
      expect(rawCalls[0][0].values).toContain(3);
    });
  });
});
