import {
  PAGE_TEMPLATES,
  templatesForAge,
  ageToAgeBand,
  type TemplateName,
} from '../../pdf/page-templates/page-templates.config';
import { getBeatSheet, type BuildStoryPromptOptions } from './story-generator.prompt';
import { pickExemplar } from './exemplars';
import { PAGE_COUNT_BY_BAND } from '../ai.config';

/**
 * PLAN_SYSTEM_PROMPT — the Plan phase (ADR-0005). Produces the StoryPlan "bible":
 * structure, arc beats, safe conflict, hero identity, page layout — but NOT the
 * final wording. The Prose phase writes the words; this phase must not.
 */
export const PLAN_SYSTEM_PROMPT = `
You are a planner of Russian children's books for read-aloud (ages 3–6).
You design the STRUCTURE of a story as a JSON plan that matches the schema — you
do NOT write the final prose. That is a separate later step.

Hard rules:
1. INVENT a concrete, specific scenario for THIS topic and hero — a small,
   everyday situation a preschooler would recognize (a shared toy, a scary
   shadow, a broken promise, a new food, a tall slide). The reference story
   given in the user prompt shows the CRAFT you must match — pacing, warmth,
   how a beat sheet becomes a warm concrete scene — copy ITS QUALITY, never
   its plot, premise, conflict, names, or setting. Stay small-scale and true
   to a child's real world: no random fantasy, no far-fetched or invented
   magic, no adventures beyond what a preschooler actually does in a day.
   Map YOUR invented scenario onto the beat sheet below. THEN output a PLAN,
   not a story: each page's "intent" says WHAT HAPPENS and the emotional beat
   in Russian — it is NOT the final sentence; keep intents short and
   concrete, never polished prose.
2. title, lesson, intent and discussionQuestions are in Russian.
   characterProfile is in ENGLISH (it seeds the illustrations).
3. Fix the hero's name once (heroName) so it can never drift between pages.
4. The page layout encodes the arc: page 1 uses 'cover', the last page uses
   'final', and the content pages in between carry the arc beats IN ORDER.
5. Use only templates from the provided catalogue (they are age-filtered).
6. Prefer MORE short pages over fewer dense ones — a richer story is spread
   across more spreads, not crammed onto a page.
7. SAFE CONFLICT (non-negotiable). Tension must be EMOTIONAL/SOCIAL/INTERNAL
   (fear of the dark, trying something new, a friend upset, making a mistake and
   fixing it). The hero must NEVER approach, befriend, or be rescued by a real
   physical danger (wild/unknown animals, strangers, fire, water, heights,
   exploring dangerous places alone). The lesson must never model unsafe behaviour.
8. State the lesson once, in the 'lesson' field (rendered on the final page only).
9. TITLE — make it concrete and playful, built from a vivid image or object in
   YOUR invented scenario plus the hero's name, in the spirit of the reference
   story's title (e.g. «Гриша и хвостатая выдумка», «Тошка и буря в стакане»,
   «Лиза и гора конфет»). Do NOT name the abstract value/learning goal and
   never use the templates «история про…», «история с…», «… учится …» — those
   are dull.
`.trim();

const buildTemplateCatalogue = (childAge: number): string => {
  const ageBand = ageToAgeBand(childAge);
  const lines: string[] = ['Available page templates (use ONLY these):'];
  templatesForAge(childAge).forEach((name: TemplateName) => {
    const maxChars = PAGE_TEMPLATES[name].maxChars[ageBand];
    const limits: string[] = [];
    if (maxChars.title !== undefined) limits.push(`title max ${maxChars.title}`);
    if (maxChars.text !== undefined) limits.push(`text max ${maxChars.text}`);
    const limitStr = limits.length > 0 ? ` — ${limits.join(', ')} chars` : '';
    lines.push(`  • ${name}${limitStr}`);
  });
  return lines.join('\n');
};

const buildProtagonistBlock = (opts: BuildStoryPromptOptions): string => {
  const gender = opts.gender ?? 'unspecified';
  if (opts.protagonistMode === 'child') {
    // NOTE: the child's real appearance is deliberately NOT passed here. Visual
    // details (hair, clothes, accessories) belong to the illustrations only — the
    // characterProfile is derived separately downstream and overrides this one.
    // Keeping appearance out of the plot prevents a hair-bow etc. from leaking
    // into the story/title.
    return `Protagonist: the child named "${opts.childName}" (age ${opts.childAge}, gender ${gender}).
heroName MUST be "${opts.childName}".
Set characterProfile to a fitting, age-appropriate English visual description.`;
  }
  return `Protagonist: an INVENTED character — NOT the child, do NOT use the child's real name.
Invent a fitting name and appearance for an age-${opts.childAge} ${gender === 'unspecified' ? 'child' : gender} character.
Set characterProfile to the invented character's English visual description.`;
};

/**
 * Optional personalization seeds (#197): interests/motifs/favoriteWords, SOFT by
 * design — they enrich the hero's world (props, setting, small touches) and must
 * NOT change the premise, conflict, or lesson. (A `belongings`/named-pet seed was
 * tried and removed — #245: it needed its own derivation call, prompt rule, and a
 * firm-presence carve-out just to avoid disappearing, because a proven story's own
 * beat can conflict with a named pet's role in ways specific to each exemplar —
 * a whack-a-mole risk, not a one-time fix.)
 */
const buildSeedsBlock = (seeds?: BuildStoryPromptOptions['seeds']): string => {
  if (!seeds) return '';
  const lines: string[] = [];
  if (seeds.interests.length > 0) lines.push(`  Interests: ${seeds.interests.join(', ')}`);
  if (seeds.motifs.length > 0) lines.push(`  Motifs to play with: ${seeds.motifs.join(', ')}`);
  if (seeds.favoriteWords.length > 0)
    lines.push(`  Favourite words (weave ONLY if natural): ${seeds.favoriteWords.join(', ')}`);
  if (lines.length === 0) return '';
  return `
PERSONALIZATION SEEDS (SOFT — enrich the hero's WORLD, do NOT change the premise,
conflict, or lesson; use as concrete props/setting/small touches where they fit):
${lines.join('\n')}
`;
};

/** buildPlanPrompt — the user-turn for the Plan phase. */
export const buildPlanPrompt = (opts: BuildStoryPromptOptions): string => {
  const ageBand = ageToAgeBand(opts.childAge);
  const pageCount = PAGE_COUNT_BY_BAND[ageBand];
  const feedbackBlock = opts.feedback
    ? `\nREGENERATION FEEDBACK (fix these issues in the new plan):\n${opts.feedback}\n`
    : '';
  return `
Plan a personalised children's book in Russian.

${buildProtagonistBlock(opts)}

  Topic: ${opts.topic}
  Learning goal: ${opts.learningGoal}
${buildSeedsBlock(opts.seeds)}
${buildTemplateCatalogue(opts.childAge)}

Narrative arc for YOUR invented scenario (use as the beat reference):
${getBeatSheet(ageBand, opts.arcType)}

CRAFT REFERENCE — do NOT reuse its plot, conflict, or setting. It exists only
to show you the target register, pacing, and how a beat sheet turns into a
warm, concrete scene. Invent your OWN scenario fitting the ACTUAL topic above:
"""
${pickExemplar(opts.topic, opts.arcType, ageBand).text}
"""

Produce the plan:
  • Invent your own scenario for the topic above, following the beat sheet.
    ${pageCount.min}–${pageCount.max} pages total. Page 1 'cover', last page 'final'.
  • Each content page: one arc beat (in order) + an "intent" that says what
    happens at that beat in YOUR invented scenario — short and concrete, NOT
    the final sentence.
  • Spread the arc generously across pages so the Prose phase has room for a warm,
    unhurried read-aloud story.
  • heroName fixed; characterProfile in English; lesson in one short Russian
    sentence; exactly five discussion questions.${feedbackBlock}`.trim();
};
