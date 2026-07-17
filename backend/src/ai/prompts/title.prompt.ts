import type { Story } from '../schemas';

/**
 * Title derivation (#232) — an ISOLATED step run AFTER the prose, so it titles
 * from the actual, concrete story rather than from the abstract plan (whose
 * title kept naming the learning value, «…с честностью»).
 *
 * #256: the earlier "CONCRETE and PLAYFUL, vivid image" framing with three
 * quirky-idiomatic examples over-corrected into pseudo-whimsy («булочки,
 * привыкнувшие скучать») and invented words («велик-двоечник») — the model
 * imitated the examples' quirky surface without their idiomatic grounding.
 * Per ADR-0005 philosophy the fix is reference + measurement, not ban lists:
 * this prompt now anchors on PLAIN real-book titles, and the judge measures
 * the title as part of registerMatch (see judge.prompt.ts).
 */
export const TITLE_SYSTEM = `
You create the TITLE for a Russian children's book that is already written.
Title it the way real Russian children's books are titled: the hero's name plus
one simple, concrete thing or moment that ACTUALLY APPEARS in the story — an
object the hero holds, a place, an event. Plain, warm, idiomatic Russian; every
word a 4-year-old already knows.

Titles in the target spirit (real books and approved exemplars):
«Кто сказал „мяу“?», «Под грибом», «Мешок яблок», «Миша и ночная тень»,
«Соня и новенький», «Тёма и непослушные шнурки», «Лиза и гора конфет».

Hard rules:
- Russian. Output ONLY the title text, nothing else.
- 60 characters maximum.
- NEVER name the abstract value / lesson. Do NOT use the "value to avoid" given in
  the prompt or any of its word-forms, and do not make an abstract quality
  (честность, дружба, смелость, доброта…) the subject of the title.
- NEVER use these dull templates: «история про…», «… учится …», «… и его
  переживания…», «… с честностью/добротой/…».
`.trim();

export const buildTitlePrompt = (heroName: string, story: Story, avoidValue: string): string => {
  const storyText = story.pages
    .map((p) => p.text)
    .filter((t): t is string => Boolean(t))
    .join(' ');
  return `Hero (must appear in the title): ${heroName}
Learning value to AVOID naming: ${avoidValue}

The story — pick a concrete image, object, or event from it for the title:
"""
${storyText}
"""`;
};

// Dull, abstract patterns a title must not match (the failure modes we saw).
// NOTE: \b is unreliable around Cyrillic (Cyrillic letters aren't \w in JS
// regex), so these use explicit whitespace/anchors instead of word boundaries.
const BANNED_TITLE_PATTERNS: readonly RegExp[] = [
  /истори[яю]\s+про/i,
  /учит(?:ся|ься)/i,
  /переживани[еяй]/i,
  /(?:^|\s)с\s+[а-яё]+ость[юи]?(?:\s|$)/i, // "…с честностью", "…с добротой"
];

/** Stem of the value word, tolerant to Russian inflection (честность→честнос). */
const valueStem = (value: string): string => {
  const v = value.trim().toLowerCase();
  return v.length > 5 ? v.slice(0, v.length - 2) : v;
};

/**
 * A title is "concrete" when it fits the length budget, does not name the
 * learning value, and does not match a dull template. Used to gate the derived
 * title and trigger a regeneration.
 */
export const isConcreteTitle = (title: string, avoidValue: string): boolean => {
  const t = title.trim();
  if (t.length === 0 || t.length > 60) return false;
  if (t.toLowerCase().includes(valueStem(avoidValue))) return false;
  return !BANNED_TITLE_PATTERNS.some((re) => re.test(t));
};
