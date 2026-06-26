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
4. The narrative arc MUST follow the beat sheet given in the user prompt (it
   depends on the story's arc type), encoded in the order of pages.
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
11. Illustration prompts describe ONLY the visual scene (characters, setting,
    mood). They MUST NEVER ask for any text, words, letters, numbers, title,
    caption, author name, or lettering to be drawn inside the image — the title
    and body text are added separately by the page layout. The cover
    illustration shows artwork only (the character and scenery), never a written
    title.
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

// ─── Arc beat sheets ─────────────────────────────────────────────────────────

export const BEAT_SHEETS: Record<'virtue' | 'flaw', string> = {
  virtue: `Narrative arc for THIS story — VIRTUE-ACQUISITION (the hero gains a good
quality through effort). Encode these beats across the content pages, in order:
    1. Завязка — introduce the hero and their world.
    2. Конфликт — a challenge appears that calls for the quality.
    3. Внутренняя борьба — the hero hesitates or struggles inside.
    4. Поворот — the hero gathers themselves and tries.
    5. Развязка — the hero succeeds by acting on the quality (show it).
    6. Закрепление через действие — the change is shown in what the hero now does.`,
  flaw: `Narrative arc for THIS story — FLAW-CONSEQUENCE (a flaw backfires, then is
repaired at a cost). Encode these beats across the content pages, in order:
    1. Завязка — introduce the hero and their flaw, shown through what the hero
       does (the flaw can look harmless or fun). Do NOT preach.
    2. Проступок — the hero acts on the flaw once more (lies / breaks a promise /
       lashes out / is careless / hoards / cannot wait); the cost has not landed yet.
    3. Расплата — the flaw backfires with a CONCRETE, EXTERNAL consequence the
       listener can picture: a specific thing is broken or lost, a real chance is
       missed, or people act differently toward the hero — e.g. lied → no one
       believes a truth that matters; lashed out → a loved object is broken;
       hoarded → friends go off and play without him. The price is EMOTIONAL or
       SOCIAL, never physical danger. NOT a vague "everyone was upset".
    4. Осознание — the hero feels the cost; the low point; show the feeling.
    5. Исправление — the hero DOES something real to make it right (effort, not a
       free pass).
    6. Заслуженный финал — it mends BECAUSE the hero tried. NO instant or
       unconditional forgiveness, NO unearned reward.`,
};

const buildBookStructureRules = (
  arcType: 'virtue' | 'flaw',
): string => `Book structure requirements:
  • Minimum 6 pages, maximum 12 pages.
  • Page 1: 'cover' (title only — no text body on the cover).
  • Pages 2–(N-1): content pages. ${BEAT_SHEETS[arcType]}
  • Last page: 'final' — state the lesson exactly ONCE, in one short simple
    sentence, in the page's 'text' field; discussion questions go in the
    top-level 'discussionQuestions' array.${
      arcType === 'flaw'
        ? `\n  • FLAW RULE: the flaw MUST visibly cost the hero (the Расплата beat is
    mandatory), and the resolution MUST be earned (заслуженным) by the hero's own
    effort — instant or unconditional forgiveness is forbidden.`
        : ''
    }`;

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
  /** Narrative arc for this learning goal: 'virtue' (acquire a quality) or 'flaw' (a flaw backfires). */
  arcType: 'virtue' | 'flaw';
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
  const { childName, childAge, topic, learningGoal, allowedWords, feedback, arcType } = opts;
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

${buildBookStructureRules(arcType)}

Preferred vocabulary (Russian words — prefer these; you may also add other simple
words a 5–6-year-old understands by ear when read aloud):
${allowedWords.join(', ')}

Storytelling (this is read ALOUD by a parent — make it come alive, not a summary):
  • Each content page: 3–4 full sentences (~180–220 characters). SHOW the moment.
  • Include one concrete, sensory detail and make the character's feeling visible
    (not "он испугался" alone — show it: heart pounding, frozen feet, a held breath).
  • Use short direct speech where it fits ("…", — сказал он).
  • The story must have real STAKES — the listener should feel something is at
    risk (a friend's trust, a treasured thing, not being believed) before the
    resolution. The resolution is EARNED, never given for free.
  • Build a real little moment of tension at the climax — but the tension is
    EMOTIONAL/SOCIAL (will I be brave enough? what if they laugh? can I do it?),
    never a physical danger the hero approaches. See hard rule 10.
  • Do NOT moralise on content pages. NEITHER the narrator NOR any character —
    including a parent, grandparent, teacher or other mentor — may state the
    lesson or define the value (never "Делиться — это…", "Быть смелым значит…").
    A mentor MAY give a concrete practical hint or ask a question ("а если
    вдохнуть поглубже?"), but must not pronounce the moral. The hero reaches the
    understanding through what happens and what they DO and FEEL. The moral is
    stated only ONCE, on the final page.
  • NO narrator commentary about the plot itself — never state that an action is
    harmless, has or lacks consequences, is important, or is "a lesson" (e.g.
    NEVER write "но без последствий" or "это был урок"). Describe only what
    happens and what the hero feels; let the listener draw the conclusion.
  • Keep the hero's name consistent: use the SAME name on every page — never
    rename the hero or introduce a second name for them.

EXAMPLE of the quality, lively voice, gentle humour and SAFE conflict to match.
Match its CRAFT — do NOT copy its plot, names, characters, or setting:
"""
${pickExemplar(topic, arcType).text}
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
