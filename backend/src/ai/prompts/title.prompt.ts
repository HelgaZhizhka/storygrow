import { PAGE_TEMPLATES, type AgeBand } from '../../pdf/page-templates/page-templates.config';
import type { Story } from '../schemas';

/**
 * Title derivation (#232) — an ISOLATED step run AFTER the prose, so it titles
 * from the actual, concrete story (a flying cat, a turtle-that-was-a-boot, the
 * rescued kitten) rather than from the abstract plan. The Plan's own title was
 * unreliable — it kept naming the learning value («…с честностью»), which is the
 * dullest possible title and the first thing a reader sees. This step builds a
 * concrete, playful title and a validator (isConcreteTitle) gates it.
 *
 * Both the system prompt and the length gate are age-band-aware (#196) — the
 * cover's title cap differs 3-4 (40) vs 5-6 (60), same as every other
 * per-band template cap.
 */
export const buildTitleSystem = (ageBand: AgeBand): string => {
  const max = PAGE_TEMPLATES.cover.maxChars[ageBand].title ?? 60;
  return `
You create the TITLE for a Russian children's book that is already written.
Make it CONCRETE and PLAYFUL: build it from a vivid image, object, or event that
actually happens in THIS story, plus the hero's name — in the spirit of Сутеев and
the Russian folk tale (e.g. «Гриша и хвостатая выдумка», «Тошка и буря в стакане»,
«Лиза и гора конфет»).

Hard rules:
- Russian. Output ONLY the title text, nothing else.
- ${max} characters maximum.
- NEVER name the abstract value / lesson. Do NOT use the “value to avoid” given in
  the prompt or any of its word-forms, and do not make an abstract quality
  (честность, дружба, смелость, доброта…) the subject of the title.
- NEVER use these dull templates: «история про…», «… учится …», «… и его
  переживания…», «… с честностью/добротой/…».
`.trim();
};

export const buildTitlePrompt = (heroName: string, story: Story, avoidValue: string): string => {
  const storyText = story.pages
    .map((p) => p.text)
    .filter((t): t is string => Boolean(t))
    .join(' ');
  return `Hero (must appear in the title): ${heroName}
Learning value to AVOID naming: ${avoidValue}

The story — pick a concrete image, object, or event from it for the title:
“””
${storyText}
“””`;
};

// Dull, abstract patterns a title must not match (the failure modes we saw).
// NOTE: \b is unreliable around Cyrillic (Cyrillic letters aren't \w in JS
// regex), so these use explicit whitespace/anchors instead of word boundaries.
const BANNED_TITLE_PATTERNS: readonly RegExp[] = [
  /истори[яю]\s+про/i,
  /учит(?:ся|ься)/i,
  /переживани[еяй]/i,
  /(?:^|\s)с\s+[а-яё]+ость[юи]?(?:\s|$)/i, // “…с честностью”, “…с добротой”
];

/** Stem of the value word, tolerant to Russian inflection (честность→честнос). */
const valueStem = (value: string): string => {
  const v = value.trim().toLowerCase();
  return v.length > 5 ? v.slice(0, v.length - 2) : v;
};

/**
 * A title is “concrete” when it fits the band's length budget, does not name
 * the learning value, and does not match a dull template. Used to gate the
 * derived title and trigger a regeneration.
 */
export const isConcreteTitle = (title: string, avoidValue: string, ageBand: AgeBand): boolean => {
  const t = title.trim();
  const max = PAGE_TEMPLATES.cover.maxChars[ageBand].title ?? 60;
  if (t.length === 0 || t.length > max) return false;
  if (t.toLowerCase().includes(valueStem(avoidValue))) return false;
  return !BANNED_TITLE_PATTERNS.some((re) => re.test(t));
};
