import {
  PAGE_TEMPLATES,
  TEMPLATE_NAMES,
  type TemplateName,
} from '../../pdf/page-templates/page-templates.config';
import { BEAT_SHEETS, type BuildStoryPromptOptions } from './story-generator.prompt';

/**
 * PLAN_SYSTEM_PROMPT — the Plan phase (ADR-0005). Produces the StoryPlan "bible":
 * structure, arc beats, safe conflict, hero identity, page layout — but NOT the
 * final wording. The Prose phase writes the words; this phase must not.
 */
export const PLAN_SYSTEM_PROMPT = `
You are a planner of Russian children's books for read-aloud (ages 5–6).
You design the STRUCTURE of a story as a JSON plan that matches the schema — you
do NOT write the final prose. That is a separate later step.

Hard rules:
1. Output a PLAN, not a story. Each page's "intent" says WHAT HAPPENS and the
   emotional beat in Russian — it is NOT the final sentence the child will hear.
   Keep intents short and concrete (a clause or two), never polished prose.
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
`.trim();

const buildTemplateCatalogue = (childAge: number): string => {
  const lines: string[] = ['Available page templates (use ONLY these):'];
  TEMPLATE_NAMES.forEach((name: TemplateName) => {
    const config = PAGE_TEMPLATES[name];
    if (!config.suitableFor.includes(childAge)) return;
    const limits: string[] = [];
    if (config.maxChars.title !== undefined) limits.push(`title max ${config.maxChars.title}`);
    if (config.maxChars.text !== undefined) limits.push(`text max ${config.maxChars.text}`);
    const limitStr = limits.length > 0 ? ` — ${limits.join(', ')} chars` : '';
    lines.push(`  • ${name}${limitStr}`);
  });
  return lines.join('\n');
};

const buildProtagonistBlock = (opts: BuildStoryPromptOptions): string => {
  const gender = opts.gender ?? 'unspecified';
  if (opts.protagonistMode === 'child') {
    const appearance =
      opts.appearance && opts.appearance.trim().length > 0
        ? opts.appearance
        : 'invent a fitting, age-appropriate appearance';
    return `Protagonist: the child named "${opts.childName}" (age ${opts.childAge}, gender ${gender}).
heroName MUST be "${opts.childName}". Hero appearance: ${appearance}.
Set characterProfile to this hero's English visual description.`;
  }
  return `Protagonist: an INVENTED character — NOT the child, do NOT use the child's real name.
Invent a fitting name and appearance for an age-${opts.childAge} ${gender === 'unspecified' ? 'child' : gender} character.
Set characterProfile to the invented character's English visual description.`;
};

/** buildPlanPrompt — the user-turn for the Plan phase. */
export const buildPlanPrompt = (opts: BuildStoryPromptOptions): string => {
  const feedbackBlock = opts.feedback
    ? `\nREGENERATION FEEDBACK (fix these issues in the new plan):\n${opts.feedback}\n`
    : '';
  return `
Plan a personalised children's book in Russian.

${buildProtagonistBlock(opts)}

  Topic: ${opts.topic}
  Learning goal: ${opts.learningGoal}

${buildTemplateCatalogue(opts.childAge)}

Narrative arc to encode across the content pages, in order:
${BEAT_SHEETS[opts.arcType]}

Produce the plan:
  • 6–12 pages total. Page 1 'cover', last page 'final'.
  • Each content page: one arc beat (in order) + an "intent" (what happens +
    the feeling), short and concrete — NOT the final sentence.
  • Spread the arc generously across pages so the Prose phase has room for a warm,
    unhurried read-aloud story.
  • heroName fixed; characterProfile in English; lesson in one short Russian
    sentence; exactly five discussion questions.${feedbackBlock}`.trim();
};
