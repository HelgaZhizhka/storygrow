/**
 * Pure helpers for the eval:images harness (#348, PR 3; variants removed in
 * #372 — the harness now always exercises the production path under the real
 * env flags, a run is just a label).
 */

const TRANSLIT: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'e',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'y',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'h',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'sch',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
};

/** Transliterate Cyrillic → Latin so a slug survives (goal titles are Russian). */
export const translit = (raw: string): string =>
  raw.replace(/[а-яё]/gi, (c) => {
    const lower = c.toLowerCase();
    const mapped = TRANSLIT[lower] ?? '';
    return c === lower ? mapped : mapped.charAt(0).toUpperCase() + mapped.slice(1);
  });

/** Safe S3/-filesystem id segment (bookIds and folder names) from a fixture label. */
export const sanitizeId = (raw: string): string =>
  translit(raw)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

/** Deterministic bookId for a run × fixture render (stable S3 keys per run label). */
export const evalBookId = (run: string, fixture: string): string =>
  `eval-${sanitizeId(run)}-${sanitizeId(fixture)}`;
