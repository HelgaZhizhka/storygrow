import type { Story } from '../schemas';
import { STOP_WORDS } from './stop-words';
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
  allowedWords: readonly string[],
): ComplianceCheckResult => {
  const corpusSet = new Set(allowedWords.map((w) => w.toLowerCase()));
  const allTokens = tokenize(extractRussianText(story));
  const meaningful = allTokens.filter((t) => !STOP_WORDS.has(t));

  if (meaningful.length === 0) {
    return { passed: true, errors: [], score: 1, outOfCorpus: [] };
  }

  const outOfCorpus = [...new Set(meaningful.filter((t) => !corpusSet.has(t)))];
  const inCorpusCount = meaningful.filter((t) => corpusSet.has(t)).length;
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
