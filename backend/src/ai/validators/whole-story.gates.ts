import type { AgeBand } from '../../pdf/page-templates/page-templates.config';
import { WORD_RANGE_BY_BAND } from '../ai.config';
import { BANNED_TITLE_PATTERNS, valueStem } from '../prompts/title.prompt';

/**
 * Deterministic text gates for a whole tale (ADR-0008 decision 4; spec
 * 2026-09-23 §6). Pure functions, run in code before any model-based check:
 * word range per band, Russian-only text, title content. Deliberately NOT
 * here: any page or character cap, and any title length cap — layout is the
 * split's problem, not the author's, and the layout feasibility check only
 * applies once a layout is chosen (spec §7, stage 1b).
 */

/** One counting rule, recorded here: Cyrillic/Latin/digit runs, hyphenated words count once, a standalone dash is not a word. */
export const countWords = (text: string): number =>
  (text.match(/[А-Яа-яЁёA-Za-z0-9]+(?:[-‑][А-Яа-яЁёA-Za-z0-9]+)*/g) ?? []).length;

const LATIN_WORD_RE = /[a-zA-Z]{2,}/g;

export const latinWords = (text: string): string[] => [
  ...new Set([...text.matchAll(LATIN_WORD_RE)].map((m) => m[0])),
];

export interface TextGateInput {
  readonly title: string;
  readonly text: string;
  readonly ageBand: AgeBand;
  readonly goalTitle: string;
}

export interface TextGateResult {
  readonly passed: boolean;
  readonly errors: readonly string[];
  readonly words: number;
  readonly latinWords: readonly string[];
  readonly titleIssues: readonly string[];
}

const rangeLabel = (ageBand: AgeBand): string => {
  const { min, max } = WORD_RANGE_BY_BAND[ageBand];
  return `${min}–${max}`;
};

const wordRangeErrors = (words: number, ageBand: AgeBand): string[] => {
  const { min, max } = WORD_RANGE_BY_BAND[ageBand];
  if (words >= min && words <= max) return [];
  return [`Length: ${words} words, the ${ageBand} band wants ${rangeLabel(ageBand)}`];
};

const languageErrors = (found: readonly string[]): string[] =>
  found.length === 0 ? [] : [`Language: Latin words in Russian text: ${found.join(', ')}`];

/** Title CONTENT only (no value naming, no dull template) — never length. */
const titleIssuesOf = (title: string, goalTitle: string): string[] => {
  const issues: string[] = [];
  if (title.toLowerCase().includes(valueStem(goalTitle)))
    issues.push(`Title names the learning value «${goalTitle}»`);
  if (BANNED_TITLE_PATTERNS.some((re) => re.test(title)))
    issues.push('Title uses a dull template (история про… / … учится … / … с …остью)');
  return issues;
};

export const runTextGates = (input: TextGateInput): TextGateResult => {
  const words = countWords(input.text);
  const latin = latinWords(`${input.title} ${input.text}`);
  const titleIssues = titleIssuesOf(input.title, input.goalTitle);
  const errors = [
    ...wordRangeErrors(words, input.ageBand),
    ...languageErrors(latin),
    ...titleIssues.map((issue) => `Title: ${issue}`),
  ];
  return { passed: errors.length === 0, errors, words, latinWords: latin, titleIssues };
};
