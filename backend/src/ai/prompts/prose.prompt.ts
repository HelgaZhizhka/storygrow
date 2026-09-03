import {
  PAGE_TEMPLATES,
  ageToAgeBand,
  type AgeBand,
} from '../../pdf/page-templates/page-templates.config';
import type { StoryPlan } from '../schemas';
import type { BuildStoryPromptOptions } from './story-generator.prompt';
import { pickExemplar } from './exemplars';

/**
 * buildProseSystemPrompt — the Prose phase (ADR-0005). Writes the FINAL Russian
 * text for an already-approved StoryPlan. Its ONLY job is voice: render each
 * page's intent in the target read-aloud register. Structure, arc, names and
 * safe conflict are already settled in the plan and must be followed exactly.
 *
 * A function of AgeBand (not a static const) because the cover-title cap and
 * the "ages" claim in the opening line both vary per band (#196).
 */
export const buildProseSystemPrompt = (ageBand: AgeBand): string => {
  const ageLabel = ageBand === '3-4' ? '3–4' : '5–6';
  const coverMax = PAGE_TEMPLATES.cover.maxChars[ageBand].title ?? 60;
  return `
You are a beloved author of Russian read-aloud children's books (ages ${ageLabel}), in
the tradition of В. Сутеев and the Russian folk tale.

You are given an APPROVED PLAN. Write the final Russian text for it. Your only job
is the VOICE — do not redesign the story.

Hard rules:
1. Follow the plan EXACTLY: same number of pages, same order, same template per
   page, same beat. Do not add, drop, merge, or reorder pages.
2. Use the plan's heroName on EVERY page — never rename the hero.
3. Keep the plan's title and characterProfile verbatim. characterProfile and all
   discussionQuestions are carried over from the plan unchanged.
4. Each page's "text" renders that page's intent as a FULL, warm read-aloud
   moment — 2–3 flowing sentences that USE MOST of the page's character budget
   (aim for roughly three-quarters of the limit). Do NOT clip the intent into one
   bare line; unfold it with rhythm, a little dialogue, and feeling. Respect the
   template's character limit (given per page). The cover page has a title and no
   body text; that cover title MUST be ≤ ${coverMax} characters — a concise cover version
   of the book title, not the full title.
5. State the moral only ONCE, on the final page, using the plan's lesson. On
   content pages neither narrator nor character states or defines the lesson.
6. illustrationPrompt: the page's ACTION in English — what the hero and any
   listed characters are DOING, their poses and expressions, one composition hint.
   Do NOT describe anyone's appearance or the place: both are fixed in the Visual
   Bible and added downstream. No text/letters in the image. Keep it brief.

THE VOICE — match this register (warm Сутеев read-aloud):
  • Warm narrator ("Жил-был…"), folk rhythm and inversion, gentle humour.
  • Natural dialogue carries much of the story ("…", — сказал он).
  • Show feeling through ACTION and SPEECH, not narrator labels (write the moment,
    not "он испугался").
  • TWO-SIDED target: do NOT go flat (a dry "he saw / he felt / he did" summary),
    and do NOT go ornate (decorative adult similes/clichés like "свет, как чай с
    мёдом", "туча заволокла солнце", rare or abstract words).
  • Concrete, childlike, lively — a story a parent enjoys reading aloud.
`.trim();
};

const renderPlanPages = (plan: StoryPlan, ageBand: AgeBand): string => {
  const locName = (id: string): string =>
    plan.visualBible.locations.find((l) => l.id === id)?.name ?? id;
  const castName = (id: string): string =>
    plan.visualBible.cast.find((c) => c.id === id)?.name ?? id;
  return plan.pages
    .map((p, i) => {
      const cap = PAGE_TEMPLATES[p.template].maxChars[ageBand].text;
      const capStr = cap !== undefined ? `, text max ${cap} chars` : ', title only — no body text';
      const withCast = p.scene.castIds.map(castName);
      const castStr = withCast.length > 0 ? ` · with: ${withCast.join(', ')}` : '';
      return `  Page ${i + 1} [${p.template}] (${p.beat}) @${locName(p.scene.locationId)}${castStr}${capStr}: ${p.intent}`;
    })
    .join('\n');
};

/** Cast roster so the prose uses the bible's names consistently (empty if none). */
const renderCastRoster = (plan: StoryPlan): string => {
  if (plan.visualBible.cast.length === 0) return '';
  const lines = plan.visualBible.cast.map((c) => `  • ${c.name} — ${c.role}`).join('\n');
  return `Characters besides the hero (use these exact names):\n${lines}\n\n`;
};

/** buildProsePrompt — the user-turn for the Prose phase. */
export const buildProsePrompt = (plan: StoryPlan, opts: BuildStoryPromptOptions): string => {
  const ageBand = ageToAgeBand(opts.childAge);
  const exemplar = pickExemplar(opts.topic, opts.arcType, ageBand);
  return `
Write the final Russian read-aloud text for this approved plan.

Title: ${plan.title}
Hero name (use on every page): ${plan.heroName}
characterProfile (keep verbatim): ${plan.characterProfile}
Lesson (final page only): ${plan.lesson}

${renderCastRoster(plan)}Pages to render (follow exactly):
${renderPlanPages(plan, ageBand)}

Discussion questions (carry over verbatim):
${plan.discussionQuestions.map((q, i) => `  ${i + 1}. ${q}`).join('\n')}

EXAMPLE of the VOICE and register to match — match its CRAFT only, never copy its
plot, names, or setting:
"""
${exemplar.text}
"""`.trim();
};
