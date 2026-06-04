import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { embed } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import type { OpenAIProvider } from '@ai-sdk/openai';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EMBEDDING_MODEL, DEFAULT_TOP_K } from '../ai.config';
import { createTelemetry } from '../telemetry';

interface RetrieveOptions {
  topic: string;
  learningGoal: string;
  gradeLevel: number;
  topK?: number;
}

interface VocabularyRow {
  word: string;
}

@Injectable()
export class VocabularyRagService {
  private readonly logger = new Logger(VocabularyRagService.name);
  private readonly openai: OpenAIProvider;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.openai = createOpenAI({ apiKey: config.getOrThrow<string>('OPENAI_API_KEY') });
  }

  async retrieve({
    topic,
    learningGoal,
    gradeLevel,
    topK = DEFAULT_TOP_K,
  }: RetrieveOptions): Promise<string[]> {
    const { embedding } = await embed({
      model: this.openai.embedding(EMBEDDING_MODEL),
      value: `${topic} ${learningGoal}`,
      experimental_telemetry: createTelemetry('vocabulary-rag', {
        topic,
        learningGoal,
        gradeLevel,
      }),
    });

    const vectorLiteral = Prisma.raw(`'[${embedding.join(',')}]'::vector`);

    const rows = await this.prisma.$queryRaw<VocabularyRow[]>(
      Prisma.sql`
        SELECT word
        FROM   "VocabularyEntry"
        WHERE  "gradeLevel" <= ${gradeLevel}
          AND  embedding IS NOT NULL
        ORDER BY embedding <=> ${vectorLiteral}
        LIMIT  ${topK}
      `,
    );

    if (rows.length === 0) {
      this.logger.warn(
        `VocabularyRagService: no results for gradeLevel=${gradeLevel}. ` +
          'Run seed:vocabulary to populate VocabularyEntry.',
      );
    }

    return rows.map((r) => r.word);
  }

  async listByGrade(gradeLevel: number): Promise<string[]> {
    const rows = await this.prisma.vocabularyEntry.findMany({
      where: { gradeLevel: { lte: gradeLevel } },
      select: { word: true },
    });
    return rows.map((r) => r.word);
  }
}
