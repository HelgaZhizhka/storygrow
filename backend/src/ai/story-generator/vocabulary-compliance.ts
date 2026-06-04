import type { Story } from '../schemas';
import { STOP_WORDS } from './stop-words';
import { stemRussian } from './russian-stemmer';
import { COMPLIANCE_THRESHOLD } from '../ai.config';
import type { CheckResult } from '../validators/check-result';

export interface LanguagePurityResult extends CheckResult {
  latinWords: readonly string[];
}

const LATIN_WORD_RE = /[a-zA-Z]{2,}/g;

/** Returns Latin words found in Russian-only text fields (illustrationPrompt is excluded). */
const extractLatinWords = (story: Story): string[] => {
  const texts: string[] = [
    story.title,
    ...story.pages.flatMap((p) => [p.title, p.text].filter((t): t is string => Boolean(t))),
    ...story.discussionQuestions,
  ];
  const found = new Set<string>();
  for (const t of texts) {
    for (const m of t.matchAll(LATIN_WORD_RE)) found.add(m[0]);
  }
  return [...found];
};

export const checkLanguagePurity = (story: Story): LanguagePurityResult => {
  const latinWords = extractLatinWords(story);
  if (latinWords.length === 0) return { passed: true, errors: [], latinWords: [] };
  return {
    passed: false,
    errors: [
      `Language violation: Latin words found in Russian text fields: ${latinWords.slice(0, 8).join(', ')}${latinWords.length > 8 ? ` and ${latinWords.length - 8} more` : ''}. All text fields except illustrationPrompt must be in Russian.`,
    ],
    latinWords,
  };
};

export interface ComplianceCheckResult extends CheckResult {
  score: number;
  outOfCorpus: readonly string[];
}

const extractRussianText = (story: Story): string =>
  [
    story.title,
    ...story.pages.flatMap((p) => [p.title, p.text].filter((t): t is string => Boolean(t))),
    ...story.discussionQuestions,
  ].join(' ');

const tokenize = (text: string): string[] => text.toLowerCase().match(/[а-яё]+/g) ?? [];

export const checkCompliance = (
  story: Story,
  corpusWords: readonly string[],
): ComplianceCheckResult => {
  const corpusStems = new Set(corpusWords.map(stemRussian));
  const inCorpus = (token: string): boolean => corpusStems.has(stemRussian(token));
  const allTokens = tokenize(extractRussianText(story));
  const meaningful = allTokens.filter((t) => !STOP_WORDS.has(t));

  if (meaningful.length === 0) {
    return { passed: true, errors: [], score: 1, outOfCorpus: [] };
  }

  const outOfCorpus = [...new Set(meaningful.filter((t) => !inCorpus(t)))];
  const inCorpusCount = meaningful.filter(inCorpus).length;
  const score = inCorpusCount / meaningful.length;
  const passed = score >= COMPLIANCE_THRESHOLD;

  return {
    passed,
    errors: passed
      ? []
      : [
          `Vocabulary compliance ${(score * 100).toFixed(0)}% below threshold ${COMPLIANCE_THRESHOLD * 100}%`,
        ],
    score,
    outOfCorpus,
  };
};
