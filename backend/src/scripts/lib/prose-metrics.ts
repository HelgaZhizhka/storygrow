/**
 * Deterministic prose metrics for the Suteev-register refactor (phase 0 of
 * docs/superpowers/specs/2026-09-13-suteev-register-refactor-design.md).
 *
 * Pure functions over a persisted Story — no LLM, no I/O — so the same numbers
 * come out of a live `eval:batch` run and an offline `eval:metrics` pass over
 * frozen story JSONs. They measure the symptoms the corpus analysis found
 * (formula moral, question tic, thin cast, name density, no dialogue, no
 * refrain) so each refactor phase can show a before/after on them.
 */
import type { Story } from '../../ai/schemas';

export interface ProseMetrics {
  /** Body words over all content pages (cover excluded). */
  words: number;
  sentences: number;
  avgSentenceWords: number;
  /** Share of body characters inside direct speech (guillemets or dash lines), 0..1. */
  dialogueShare: number;
  /** Hero-name mentions per sentence — the "Алиса… Алиса… сказала Алиса" symptom. */
  heroNamePerSentence: number;
  /** «X? Не X?», «X? X?», «X или нет?» inner-monologue tics. */
  questionTics: number;
  /** Final page states the lesson as a formula («X — это…», «значит», «нужно/важно…»). */
  moralFormulaOnFinal: boolean;
  /** Visual-bible cast members whose name actually occurs in the body text. */
  castNamed: number;
  castTotal: number;
  /** Distinct lines of ≥3 words that recur ≥2 times — a refrain device. */
  refrainLines: number;
  /** Title carries a "magic" stop-word (волшебн-, колдовск-, таинствен-, секрет…). */
  titleStopword: boolean;
}

export const TITLE_STOPWORDS = /волшебн|колдовск|таинствен|секрет|чудесн|приключени/i;
const MORAL_FORMULA = /— это|это когда|это значит|значит|нужно|стоит|важно|приятно/i;
// No \b: JS word boundaries do not see Cyrillic letters (see title.prompt.ts).
const QUESTION_TIC = /(?:^|[^а-яё])([а-яё]+)\? (?:не |)\1\?|или нет\?/gi;

const bodyTexts = (story: Story): string[] =>
  story.pages.filter((p) => p.text != null).map((p) => p.text as string);

// Sentence ends inside «…» belong to the quote («Карр! Безобразие!» is one
// sentence of the narration), so they are masked before the split.
const MASK: Record<string, string> = { '.': '\uE000', '!': '\uE001', '?': '\uE002', '…': '\uE003' };
const UNMASK: Record<string, string> = {
  '\uE000': '.',
  '\uE001': '!',
  '\uE002': '?',
  '\uE003': '…',
};

const splitSentences = (text: string): string[] =>
  text
    .replace(/«[^»]*»/g, (q) => q.replace(/[.!?…]/g, (c) => MASK[c]))
    .split(/(?<=[.!?…])\s+/)
    .map((s) => s.replace(/[\uE000-\uE003]/g, (c) => UNMASK[c]).trim())
    .filter((s) => s.length > 0);

const wordCount = (text: string): number => text.split(/\s+/).filter((w) => w.length > 0).length;

/** Chars inside «…» plus dash-introduced speech up to the next sentence end. */
const dialogueChars = (text: string): number => {
  const quoted = text.match(/«[^»]*»/g) ?? [];
  const dashed = text.match(/(?:^|\s)—\s[^.!?…]*[.!?…]?/g) ?? [];
  return [...quoted, ...dashed].reduce((sum, s) => sum + s.length, 0);
};

/** Cyrillic names inflect; a stem (name minus its last letter) catches the cases. */
const nameStem = (name: string): string => (name.length > 3 ? name.slice(0, -1) : name);

const countStem = (text: string, name: string): number =>
  (text.match(new RegExp(nameStem(name), 'gi')) ?? []).length;

const countRefrains = (texts: string[]): number => {
  const seen = new Map<string, number>();
  for (const line of texts.flatMap(splitSentences)) {
    const key = line
      .replace(/[«»"—]/g, '')
      .trim()
      .toLowerCase();
    if (wordCount(key) < 3) continue;
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  return [...seen.values()].filter((n) => n >= 2).length;
};

const isFinalPage = (story: Story): string => {
  const finals = story.pages.filter((p) => p.template === 'final' && p.text != null);
  const last = finals[finals.length - 1] ?? story.pages[story.pages.length - 1];
  return last?.text ?? '';
};

const castNamedCount = (story: Story, body: string): number =>
  (story.visualBible?.cast ?? []).filter((c) => countStem(body, c.name) > 0).length;

/** heroName defaults to the bible's hero; the eval harness passes the child's name. */
export const measureProse = (story: Story, heroName?: string): ProseMetrics => {
  const texts = bodyTexts(story);
  const body = texts.join(' ');
  const sentences = texts.flatMap(splitSentences);
  const words = wordCount(body);
  const hero = heroName ?? story.visualBible?.hero.name ?? '';
  const stripped = body.replace(/[«»"]/g, '');
  return {
    words,
    sentences: sentences.length,
    avgSentenceWords: sentences.length === 0 ? 0 : round2(words / sentences.length),
    dialogueShare: body.length === 0 ? 0 : round2(dialogueChars(body) / body.length),
    heroNamePerSentence:
      sentences.length === 0 || hero === '' ? 0 : round2(countStem(body, hero) / sentences.length),
    questionTics: (stripped.match(QUESTION_TIC) ?? []).length,
    moralFormulaOnFinal: MORAL_FORMULA.test(isFinalPage(story)),
    castNamed: castNamedCount(story, body),
    castTotal: story.visualBible?.cast.length ?? 0,
    refrainLines: countRefrains(texts),
    titleStopword: TITLE_STOPWORDS.test(story.title),
  };
};

const round2 = (n: number): number => Math.round(n * 100) / 100;

export interface RepeatedName {
  name: string;
  count: number;
}

export interface BatchDiversity {
  /** Prop names (lowercased) used by ≥2 stories in the batch — the "коробка" symptom. */
  repeatedProps: RepeatedName[];
  repeatedLocations: RepeatedName[];
}

const repeated = (names: string[]): RepeatedName[] => {
  const counts = new Map<string, number>();
  for (const n of names) counts.set(n, (counts.get(n) ?? 0) + 1);
  return [...counts.entries()]
    .filter(([, count]) => count >= 2)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
};

/** Head noun = last word («волшебная коробка» → «коробка»); one entry per story per noun. */
const headNouns = (names: readonly (string | undefined)[]): string[] => [
  ...new Set(
    names
      .filter((n): n is string => Boolean(n && n.trim()))
      .map((n) => n.toLowerCase().trim().split(/\s+/).pop() ?? n),
  ),
];

export const measureBatchDiversity = (stories: readonly Story[]): BatchDiversity => ({
  repeatedProps: repeated(
    stories.flatMap((s) => headNouns((s.visualBible?.props ?? []).map((p) => p.name))),
  ),
  repeatedLocations: repeated(
    stories.flatMap((s) => headNouns((s.visualBible?.locations ?? []).map((l) => l.name))),
  ),
});

/** Batch means of the numeric metrics plus counts of the boolean symptoms. */
export interface MetricsSummary {
  words: number;
  dialogueShare: number;
  heroNamePerSentence: number;
  avgSentenceWords: number;
  questionTicStories: number;
  moralFormulaStories: number;
  titleStopwordStories: number;
  castNamedMean: number;
  refrainStories: number;
}

const mean = (values: number[]): number =>
  values.length === 0 ? 0 : round2(values.reduce((a, b) => a + b, 0) / values.length);

export const summarizeMetrics = (all: readonly ProseMetrics[]): MetricsSummary => ({
  words: mean(all.map((m) => m.words)),
  dialogueShare: mean(all.map((m) => m.dialogueShare)),
  heroNamePerSentence: mean(all.map((m) => m.heroNamePerSentence)),
  avgSentenceWords: mean(all.map((m) => m.avgSentenceWords)),
  questionTicStories: all.filter((m) => m.questionTics > 0).length,
  moralFormulaStories: all.filter((m) => m.moralFormulaOnFinal).length,
  titleStopwordStories: all.filter((m) => m.titleStopword).length,
  castNamedMean: mean(all.map((m) => m.castNamed)),
  refrainStories: all.filter((m) => m.refrainLines > 0).length,
});

export const formatMetricsSummary = (s: MetricsSummary, total: number): string =>
  [
    `words/story ${s.words} | sentence ${s.avgSentenceWords} words | dialogue ${(s.dialogueShare * 100).toFixed(0)}% | hero name ${s.heroNamePerSentence}/sentence | cast named ${s.castNamedMean}`,
    `stories with: question tic ${s.questionTicStories}/${total} | formula moral on final ${s.moralFormulaStories}/${total} | title stop-word ${s.titleStopwordStories}/${total} | refrain ${s.refrainStories}/${total}`,
  ].join('\n');
