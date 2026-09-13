/**
 * check:book (#373) — the last line of the manual Definition of Done for an
 * image-pipeline change: after a REAL generation, assert from the database that
 * the judge saw every page. Exit 1 on any gap.
 *
 *   pnpm --filter backend check:book --book=<bookId>
 *
 * Asserts: ImageEval rows = Σ(pages × attempts), every page has a row, every
 * row carries a verdict (a `judge:` failure means the judge gave none); prints
 * the per-page outcome so a bad page is diagnosable without LangFuse.
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient } from '../generated/prisma/client';

const flag = (name: string): string | undefined =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);

interface Row {
  pageNumber: number;
  attempt: number;
  passed: boolean;
  failures: string[];
}

const checkBook = (pageCount: number, rows: Row[]): string[] => {
  const problems: string[] = [];
  for (let p = 1; p <= pageCount; p++) {
    const forPage = rows.filter((r) => r.pageNumber === p).sort((a, b) => a.attempt - b.attempt);
    if (forPage.length === 0) {
      problems.push(`page ${p}: no ImageEval row`);
      continue;
    }
    forPage.forEach((r, i) => {
      if (r.attempt !== i + 1) problems.push(`page ${p}: attempts are not 1..n (${r.attempt})`);
      const noVerdict = r.failures.find(
        (f) => f.startsWith('judge:') && !f.endsWith(':identity-only'),
      );
      if (noVerdict) problems.push(`page ${p} attempt ${r.attempt}: no verdict (${noVerdict})`);
    });
  }
  const orphan = rows.filter((r) => r.pageNumber < 1 || r.pageNumber > pageCount);
  if (orphan.length > 0) problems.push(`${orphan.length} rows outside 1..${pageCount}`);
  return problems;
};

const main = async (): Promise<void> => {
  const bookId = flag('book');
  if (!bookId) {
    console.error('--book=<bookId> is required');
    process.exit(1);
  }
  const prisma = new PrismaClient({
    adapter: new PrismaPg(new Pool({ connectionString: process.env['DATABASE_URL'] })),
  });
  try {
    const book = await prisma.book.findUniqueOrThrow({
      where: { id: bookId },
      include: { imageEvals: { orderBy: [{ pageNumber: 'asc' }, { attempt: 'asc' }] } },
    });
    const story = book.storyJson as { pages?: unknown[] } | null;
    const pageCount = story?.pages?.length ?? 0;
    console.log(
      `book ${book.id} status=${book.status} pages=${pageCount} images=${book.imageKeys.length} ImageEval rows=${book.imageEvals.length}`,
    );
    for (const r of book.imageEvals) {
      console.log(
        `  p${r.pageNumber} a${r.attempt} ${r.passed ? 'PASS' : 'FAIL'} ${r.failures.join(',')}`,
      );
    }
    const problems = checkBook(pageCount, book.imageEvals);
    if (problems.length > 0) {
      console.error(`\ncheck:book FAILED\n${problems.map((p) => `  - ${p}`).join('\n')}`);
      process.exit(1);
    }
    console.log('\ncheck:book OK — every page judged, every attempt recorded');
  } finally {
    await prisma.$disconnect();
  }
};

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
