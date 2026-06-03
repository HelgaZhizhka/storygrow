import { createReadStream } from 'fs';
import { resolve } from 'path';
import { parse } from 'csv-parse';
import { embedMany } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient } from '../generated/prisma/client';
import { EMBEDDING_MODEL } from '../ai/ai.config';

const BATCH_SIZE = 512;
const BATCH_DELAY_MS = 200;
const CSV_PATH = resolve(__dirname, '../../prisma/seed/vocabulary.csv');

interface CsvRow {
  word: string;
  gradeLevel: number;
  frequency: number;
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const parseCsv = (): Promise<CsvRow[]> =>
  new Promise((resolve, reject) => {
    const rows: CsvRow[] = [];
    createReadStream(CSV_PATH)
      .pipe(parse({ columns: ['word', 'gradeLevel', 'frequency'] }))
      .on('data', (row: Record<string, string>) => {
        rows.push({
          word: row.word.trim(),
          gradeLevel: parseInt(row.gradeLevel, 10),
          frequency: parseFloat(row.frequency),
        });
      })
      .on('end', () => resolve(rows))
      .on('error', reject);
  });

const main = async (): Promise<void> => {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is required');
  }
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required');
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });
  const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    const rows = await parseCsv();
    process.stdout.write(`Loaded ${rows.length} words from CSV\n`);

    const chunks: CsvRow[][] = [];
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      chunks.push(rows.slice(i, i + BATCH_SIZE));
    }

    let seeded = 0;
    for (const [idx, chunk] of chunks.entries()) {
      const words = chunk.map((r) => r.word);

      const { embeddings } = await embedMany({
        model: openai.embedding(EMBEDDING_MODEL),
        values: words,
      });

      for (let i = 0; i < chunk.length; i++) {
        const row = chunk[i];
        const embedding = embeddings[i];

        await prisma.$executeRaw`
          INSERT INTO "VocabularyEntry" (id, word, "gradeLevel", frequency, embedding)
          VALUES (
            gen_random_uuid(),
            ${row.word},
            ${row.gradeLevel},
            ${row.frequency},
            ${`[${embedding.join(',')}]`}::vector
          )
          ON CONFLICT (word) DO UPDATE SET
            "gradeLevel" = EXCLUDED."gradeLevel",
            frequency    = EXCLUDED.frequency,
            embedding    = EXCLUDED.embedding
        `;
      }

      seeded += chunk.length;
      process.stdout.write(`[${seeded}/${rows.length}] seeded\n`);

      if (idx < chunks.length - 1) {
        await sleep(BATCH_DELAY_MS);
      }
    }

    process.stdout.write('Done.\n');
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
};

main().catch((err: unknown) => {
  process.stderr.write(`${String(err)}\n`);
  process.exit(1);
});
