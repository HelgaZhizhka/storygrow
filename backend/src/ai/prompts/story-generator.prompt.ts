import {
  PAGE_TEMPLATES,
  TEMPLATE_NAMES,
  TemplateName,
} from '../../pdf/page-templates/page-templates.config';
import { type JudgeResult } from '../schemas';
import { pickExemplar } from './exemplars';

// ─── System prompt ───────────────────────────────────────────────────────────

/**
 * STORY_SYSTEM_PROMPT — role definition and hard rules for story generation.
 *
 * Deliberately concise: detailed per-request constraints (vocabulary, templates,
 * text limits) go into the user prompt so they can be updated per-call.
 */
export const STORY_SYSTEM_PROMPT = `
You are a professional author of children's books in Russian.
Your task is to generate a structured, age-appropriate, educational story
in valid JSON that exactly matches the provided schema.

Hard rules:
1. Write ENTIRELY in Russian. Every word must be Russian.
2. PREFER the provided allowed-words list plus common function words. You MAY
   also use other simple, age-appropriate Russian words that a child understands
   when the story is read ALOUD by a parent. Favour concrete, emotionally clear
   words (e.g. feelings) over rare or abstract ones.
3. The protagonist is defined in the user prompt — either the named child or an
   invented character. Follow the user prompt's protagonist instruction exactly.
4. The narrative arc MUST follow: setup → conflict → lesson → resolution,
   encoded in the order of pages.
5. Each page MUST use exactly one template from the provided catalogue.
6. Text and title lengths MUST NOT exceed the limits shown for each template.
7. The first page MUST use the 'cover' template.
8. The last page MUST use the 'final' template.
9. DALL-E illustration prompts MUST be in English (DALL-E performs better
   with English prompts). All other fields are Russian.
10. SAFE CONFLICT (non-negotiable). The story's tension must come from an
    EMOTIONAL, SOCIAL or INTERNAL challenge — fear of the dark, trying something
    new, speaking up, a friend is upset, making a mistake and fixing it, missing
    a parent. The hero must NEVER approach, befriend, or be rescued by a real
    physical danger: wild/unknown animals, strangers, fire, water, heights, or
    exploring dangerous places (caves, forests alone). The lesson must never
    model a child doing something unsafe in real life. The scary thing may exist,
    but the resolution must not teach the child to approach it.
`.trim();

// ─── Template catalogue builder ───────────────────────────────────────────────

const buildTemplateCatalogue = (childAge: number): string => {
  const lines: string[] = ['Available page templates (use ONLY these):'];

  TEMPLATE_NAMES.forEach((name: TemplateName) => {
    const config = PAGE_TEMPLATES[name];
    if (!config.suitableFor.includes(childAge)) return;

    const limits: string[] = [];
    if (config.maxChars.title !== undefined) {
      limits.push(`title max ${config.maxChars.title} chars`);
    }
    if (config.maxChars.text !== undefined) {
      limits.push(`text max ${config.maxChars.text} chars`);
    }
    const limitStr = limits.length > 0 ? ` — ${limits.join(', ')}` : '';
    lines.push(`  • ${name}${limitStr}`);
  });

  return lines.join('\n');
};

// ─── Static book structure block ─────────────────────────────────────────────

const BOOK_STRUCTURE_RULES = `Book structure requirements:
  • Minimum 6 pages, maximum 12 pages.
  • Page 1: 'cover' (title only — no text body on the cover).
  • Pages 2–(N-1): content pages using age-appropriate templates.
    Encode the narrative arc across these pages:
    first pages = setup (introduce protagonist and world),
    middle pages = conflict (challenge arises, protagonist struggles),
    later pages = lesson (the protagonist learns by DOING — show the change
      through action and feeling, never as a stated maxim),
    final content pages = resolution (the protagonist succeeds by applying what
      they learned — show it; do NOT restate the moral here).
  • Last page: 'final' — state the lesson exactly ONCE, in one short simple
    sentence, in the page's 'text' field; discussion questions go in the
    top-level 'discussionQuestions' array.`;

// ─── User prompt ─────────────────────────────────────────────────────────────

export interface BuildStoryPromptOptions {
  childName: string;
  childAge: number;
  topic: string;
  learningGoal: string;
  /** Words from VocabularyRagService — the allowed vocabulary for this age/topic. */
  allowedWords: readonly string[];
  /** 'child' = hero is the named child; 'observer' = invented third-person character. */
  protagonistMode: 'child' | 'observer';
  /** Child's gender, when known ('male' | 'female' | 'other'). */
  gender?: string;
  /** Free-text appearance of the child (used only in 'child' mode). */
  appearance?: string;
  /**
   * Regeneration feedback from the previous failed attempt.
   * Undefined on the first attempt.
   */
  feedback?: string;
}

/**
 * buildStoryUserPrompt — constructs the user-turn message for story generation.
 *
 * Includes:
 * - Child profile (name, age, topic, learning goal)
 * - Template catalogue filtered to age-appropriate layouts
 * - Allowed vocabulary word list
 * - Regeneration feedback (if retrying)
 */
export const buildStoryUserPrompt = (opts: BuildStoryPromptOptions): string => {
  const { childName, childAge, topic, learningGoal, allowedWords, feedback } = opts;
  const gender = opts.gender ?? 'unspecified';
  const catalogue = buildTemplateCatalogue(childAge);
  const feedbackBlock = feedback
    ? `\nREGENERATION FEEDBACK (fix these issues):\n${feedback}\n`
    : '';

  const protagonistBlock =
    opts.protagonistMode === 'child'
      ? `Protagonist: the child named "${childName}" (age ${childAge}, gender ${gender}).
The hero's name MUST be "${childName}".
Hero appearance: ${opts.appearance && opts.appearance.trim().length > 0 ? opts.appearance : 'invent a fitting, age-appropriate appearance'}.
Set the characterProfile field to this hero's English visual description.`
      : `Protagonist: an INVENTED character — NOT the child, and do NOT use the child's real name.
Invent a fitting name and appearance for an age-${childAge} ${gender === 'unspecified' ? 'child' : gender} character.
Tell the story in third person ("Жил-был…").
Set the characterProfile field to the invented character's English visual description.`;

  return `
Generate a personalised children's book in Russian.

${protagonistBlock}

  Topic: ${topic}
  Learning goal: ${learningGoal}

${catalogue}

${BOOK_STRUCTURE_RULES}

Preferred vocabulary (Russian words — prefer these; you may also add other simple
words a 5–6-year-old understands by ear when read aloud):
${allowedWords.join(', ')}

Storytelling (this is read ALOUD by a parent — make it come alive, not a summary):
  • Each content page: 3–4 full sentences (~180–220 characters). SHOW the moment.
  • Include one concrete, sensory detail and make the character's feeling visible
    (not "он испугался" alone — show it: heart pounding, frozen feet, a held breath).
  • Use short direct speech where it fits ("…", — сказал он).
  • Build a real little moment of tension at the climax — but the tension is
    EMOTIONAL/SOCIAL (will I be brave enough? what if they laugh? can I do it?),
    never a physical danger the hero approaches. See hard rule 10.
  • Do NOT moralise on content pages — never write definitions like
    "смелость — это значит…". Show the character living the lesson through what
    they DO and FEEL. The moral is stated only ONCE, on the final page.

EXAMPLE of the quality, lively voice, gentle humour and SAFE conflict to match.
Match its CRAFT — do NOT copy its plot, names, characters, or setting:
"""
${pickExemplar(topic).text}
"""

For each page's illustrationPrompt: write a vivid DALL-E prompt in English with the
scene, mood, colours, and art style ("watercolour, children's book"). The character
profile is added automatically — do NOT repeat it. Keep prompts under 180 characters.
${feedbackBlock}`.trim();
};

// ─── Regeneration feedback builder ───────────────────────────────────────────

/**
 * buildRegenerationFeedback — formats why the previous attempt failed.
 *
 * Used as the `feedback` parameter in the next call to buildStoryUserPrompt.
 */
export const buildRegenerationFeedback = (
  outOfCorpus: readonly string[],
  judge?: JudgeResult,
  structuralErrors?: readonly string[],
): string => {
  const parts: string[] = [];

  if (structuralErrors && structuralErrors.length > 0) {
    parts.push(`Structural errors (fix first): ${structuralErrors.join('; ')}.`);
  }

  if (outOfCorpus.length > 0) {
    const sample = outOfCorpus.slice(0, 10).join(', ');
    const more = outOfCorpus.length > 10 ? ` and ${outOfCorpus.length - 10} more` : '';
    parts.push(
      `Vocabulary violation: the following words are NOT in the allowed list: ${sample}${more}.` +
        ` Use synonyms from the allowed vocabulary.`,
    );
  }

  if (judge) {
    parts.push(
      `Quality score: ${judge.finalScore.toFixed(1)}/10.` +
        ` Judge feedback: ${judge.reasoning}` +
        ` Address the feedback above to raise the score above the required threshold.`,
    );
  }

  return parts.join('\n\n');
};
