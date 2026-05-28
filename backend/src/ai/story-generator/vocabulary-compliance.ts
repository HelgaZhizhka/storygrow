import type { Story } from '../schemas';
import { STOP_WORDS } from './stop-words';

export const COMPLIANCE_THRESHOLD = 0.85;

export interface ComplianceResult {
  compliant: boolean;
  score: number;
  outOfCorpus: string[];
}

const extractRussianText = (story: Story): string =>
  [
    story.title,
    ...story.pages.flatMap((p) => [p.title, p.text].filter((t): t is string => Boolean(t))),
  ].join(' ');

const tokenize = (text: string): string[] => text.toLowerCase().match(/[а-яё]+/g) ?? [];

export const checkCompliance = (
  story: Story,
  allowedWords: readonly string[],
): ComplianceResult => {
  const corpusSet = new Set(allowedWords.map((w) => w.toLowerCase()));
  const allTokens = tokenize(extractRussianText(story));
  const meaningful = allTokens.filter((t) => !STOP_WORDS.has(t));

  if (meaningful.length === 0) {
    return { compliant: true, score: 1, outOfCorpus: [] };
  }

  const outOfCorpusSet = new Set(meaningful.filter((t) => !corpusSet.has(t)));
  const inCorpusCount = meaningful.filter((t) => corpusSet.has(t)).length;
  const score = inCorpusCount / meaningful.length;

  return {
    compliant: score >= COMPLIANCE_THRESHOLD,
    score,
    outOfCorpus: [...outOfCorpusSet],
  };
};
