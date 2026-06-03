import type { Story } from '../schemas';
import { STOP_WORDS } from './stop-words';
import { stemRussian } from './russian-stemmer';
import { COMPLIANCE_THRESHOLD } from '../ai.config';
import type { CheckResult } from '../validators/check-result';

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
