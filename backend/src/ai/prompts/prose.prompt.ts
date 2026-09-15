import {
  PAGE_TEMPLATES,
  ageToAgeBand,
  type AgeBand,
} from '../../pdf/page-templates/page-templates.config';
import type { StoryPlan } from '../schemas';
import type { BuildStoryPromptOptions } from './story-generator.prompt';
import { pickExemplar } from './exemplars';
import { renderVoiceForProse, voiceStyleForBand } from './register';

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
  const style = voiceStyleForBand(ageBand);
  return `
You are a beloved author of Russian read-aloud children's books (ages ${ageLabel}), in
the tradition of В. Сутеев and the Russian folk tale.

You are given an APPROVED PLAN. Write the final Russian text for it. Your only job
is the VOICE — do not redesign the story.

Hard rules:
1. Follow the plan EXACTLY: same number of pages, same order, same template per
   page, same beat. Do not add, drop, merge, or reorder pages.
2. Name the hero at least ONCE per page, then use a pronoun or nickname — never
   rename the hero, and never repeat the full name three times on one page.
3. Keep the plan's title verbatim; carry all discussionQuestions over unchanged.
4. Render each page's intent in as many SHORT phrases as it needs — each phrase
   roughly 4–10 words. Volume comes from the NUMBER of short phrases and lively
   dialogue, never from padding one long sentence with description. Stay within
   the template's character limit (given per page); do NOT strain to fill it. The
   cover page has a title and no body text; that cover title MUST be
   ≤ ${coverMax} characters — a concise cover version of the book title, not the
   full title.
5. State the moral only ONCE, on the final page, using the plan's lesson. On
   content pages neither narrator nor character states or defines the lesson.
6. illustrationPrompt: the page's ACTION in English — what the hero and any
   listed characters are DOING, their poses and expressions, one composition hint.
   Do NOT describe anyone's appearance or the place: both are fixed in the Visual
   Bible and added downstream. Refer to the hero as "the child" (she/he), NEVER by
   name — a name inside an image prompt gets drawn as a sign in the picture; the
   name belongs to the Russian text only. No text/letters in the image. Keep it brief.
7. THE WORLD IS FIXED. Each page lists what is «в кадре» — the place, the
   characters and the objects the illustration will show. Unfold the intent with
   dialogue, gesture and feeling, NEVER with new objects, food, animals, weather
   or scenery: if the frame says «трава», there is no песок; if it lists no ball,
   nobody throws one. What the text names, the picture must be able to show.
8. One tense within a page: tell each page in the past OR the present, not
   switching mid-page («подбросит… ловит… присела» inside one page is wrong).

THE VOICE — build the read-aloud register from these Сутеев DEVICES, not from
adjectives. Reach for several on every page; aim for at least ${style.minDevicesForHigh}
different devices across the story:
${renderVoiceForProse(style)}
  • Two-sided target: do NOT go flat (a dry "he saw / he felt / he did" summary),
    and do NOT go ornate (decorative adult similes/clichés like «свет, как чай с
    мёдом», «туча заволокла солнце», rare or abstract words).
  • Concrete, childlike, lively — a story a parent enjoys reading aloud.
`.trim();
};

// Russian names only: the English descriptors are for the illustrator, and a
// descriptor shown to Prose would either leak English or invite word-painting.
const inFrame = (plan: StoryPlan, scene: StoryPlan['pages'][number]['scene']): string => {
  const bible = plan.visualBible;
  const place = bible.locations.find((l) => l.id === scene.locationId)?.name ?? scene.locationId;
  const cast = scene.castIds.map((id) => bible.cast.find((c) => c.id === id)?.name ?? id);
  const props = scene.propIds.map((id) => bible.props.find((x) => x.id === id)?.name ?? id);
  const people = [scene.heroOnPage ? plan.heroName : null, ...cast].filter(Boolean);
  return [place, ...people, ...props].join(', ');
};

const renderPlanPages = (plan: StoryPlan, ageBand: AgeBand): string =>
  plan.pages
    .map((p, i) => {
      const cap = PAGE_TEMPLATES[p.template].maxChars[ageBand].text;
      const capStr = cap !== undefined ? `, text max ${cap} chars` : ', title only — no body text';
      return `  Page ${i + 1} [${p.template}] (${p.beat}${capStr}) в кадре: ${inFrame(plan, p.scene)}: ${p.intent}`;
    })
    .join('\n');

/** Cast roster so the prose uses the bible's names consistently (empty if none). */
const renderCastRoster = (plan: StoryPlan): string => {
  if (plan.visualBible.cast.length === 0) return '';
  const lines = plan.visualBible.cast.map((c) => `  • ${c.name} — ${c.role}`).join('\n');
  return `Characters besides the hero (use these exact names):\n${lines}\n\n`;
};

// Gender explicitly, because the hero's look is no longer shown to Prose (#367):
// appearance is image-only, but она/он must not drift.
const heroGender = (gender?: string): string =>
  gender === 'female' ? ' — девочка (она)' : gender === 'male' ? ' — мальчик (он)' : '';

/** buildProsePrompt — the user-turn for the Prose phase. */
export const buildProsePrompt = (plan: StoryPlan, opts: BuildStoryPromptOptions): string => {
  const ageBand = ageToAgeBand(opts.childAge);
  const exemplar = pickExemplar(opts.topic, opts.arcType, ageBand);
  return `
Write the final Russian read-aloud text for this approved plan.

Title: ${plan.title}
Hero (use this exact name; see rule 2 for how often): ${plan.heroName}${heroGender(opts.gender)}
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
