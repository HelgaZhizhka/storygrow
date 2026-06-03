import { Injectable, Logger } from '@nestjs/common';
import { embed } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
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
  private readonly openai = createOpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  constructor(private readonly prisma: PrismaService) {}

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
}
