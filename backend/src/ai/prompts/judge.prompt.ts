import type { AgeBand } from '../../pdf/page-templates/page-templates.config';
import type { Story } from '../schemas';
import { getRegisterReferences } from './exemplars';

const registerMatchCriterion = (ageBand: AgeBand): string =>
  ageBand === '3-4'
    ? `7. registerMatch — how close the prose sits to the TARGET REGISTER shown by the
   gold exemplars below: a SIMPLE, repetition-driven read-aloud voice for ages
   3–4. This criterion is TWO-SIDED — BOTH failure modes score low:
   • Score LOW (≤5) if the prose is MORE COMPLEX than the exemplars: long or
     compound sentences, decorative similes, rare or abstract words, internal
     monologue, or a register that reads like the 5–6 band rather than a
     toddler read-aloud.
   • Score LOW (≤5) if the prose has NO refrain/repetition device at all, or
     reads as a dry event-summary with no warmth.
   • Score HIGH (8–10) when short plain sentences, a repeated refrain line, and
     concrete toddler-scale stakes match the exemplars below. REPETITION IS THE
     TARGET register here, not a flaw — do NOT penalise a short repeated phrase
     as "flat".`
    : `7. registerMatch — how close the prose sits to the TARGET REGISTER shown by the
   gold exemplars below: a warm, musical read-aloud voice in the Сутеев / Russian
   folk-tale tradition. This criterion is TWO-SIDED — BOTH failure modes score low:
   • Score LOW (≤5) if the prose is FLATTER than the exemplars: a dry
     event-summary, no warm narrator, little or no dialogue, feelings merely
     named ("он испугался") instead of shown, or the moral repeated on more than
     the final page.
   • Score LOW (≤5) if the prose is MORE ORNATE / PRECIOUS than the exemplars:
     decorative adult similes and clichés ("свет, как чай с мёдом", "туча
     заволокла солнце", "неведомое тепло"), rare or abstract words, or
     word-painting of what the picture should show (hair colour, scenery, weather).
   • Score HIGH (8–10) ONLY when the voice matches the exemplars: warm narrator
     ("Жил-был…"), folk rhythm, gentle humour, natural dialogue, concrete
     childlike images, the lesson emerging from events rather than stated.`;

/**
 * buildJudgeSystemPrompt — a function of AgeBand (#196), not a static const,
 * because the register-reference exemplars and the registerMatch criterion's
 * definition of "too flat" both genuinely differ per band: repetition is a
 * defect at 5-6 but the deliberate target at 3-4.
 */
export const buildJudgeSystemPrompt = (ageBand: AgeBand): string => {
  const ageLabel = ageBand === '3-4' ? '3–4' : '5–6';
  const referenceBlock = getRegisterReferences(ageBand)
    .map((e, i) => `--- Эталон ${i + 1} ---\n${e.text}`)
    .join('\n\n');
  return `
You are an expert evaluator of Russian read-aloud children's stories (ages ${ageLabel}).
Rate the story on the criteria below using integers 0–10 each.

GUARDRAIL criteria (safety / structure gates):
1. ageAppropriateVocab — vocabulary matches the child's age; penalise heavily
   (−4 or more) if any English or other non-Russian words appear in any text
   field (name, title, body, questions) — the story must be 100% Russian.
2. hasMoralLesson — the story clearly teaches the stated learning goal.
3. structureCompleteness — a complete narrative arc is present
   (setup → conflict → resolution).
4. safetyForChildren — content is safe and positive. Score very low (≤3) if the
   story could teach a child to do something UNSAFE in real life: approaching or
   befriending a wild/unknown animal, going with a stranger, playing with
   fire/water, climbing to heights, or exploring dangerous places alone. Fear
   itself is fine; the resolution must not reward approaching a real danger.
5. length — page count and content volume suit the target age.
6. earnedResolution — the moral is EARNED by the plot, not announced. There must
   be a real stake/consequence (for a flaw story the flaw visibly costs the hero
   before it is fixed), and the ending must follow from what the hero DOES. Score
   ≤4 if the lesson is merely stated at the end with no preceding cost, if the
   hero is forgiven/rewarded instantly, or if it resolves by luck.

CRAFT criterion (the quality signal — judge it strictly):
${registerMatchCriterion(ageBand)}

TARGET REGISTER — gold exemplars (match this VOICE, never the plot/names/setting):
"""
${referenceBlock}
"""

Write reasoning in 2–3 sentences that name the key register verdict — is the prose
on target, too flat, or too ornate, and which concrete phrases drove the score.
`.trim();
};

const formatPages = (story: Story): string =>
  story.pages
    .map((p, i) => {
      const parts = [p.title, p.text].filter((s): s is string => Boolean(s));
      const content = parts.length > 0 ? parts.join(' | ') : '(illustration only)';
      return `  Page ${i + 1} [${p.template}]: ${content}`;
    })
    .join('\n');

export const buildJudgePrompt = (story: Story, childAge: number, learningGoal: string): string => {
  const questions = story.discussionQuestions.map((q, i) => `  ${i + 1}. ${q}`).join('\n');
  return `Story title: "${story.title}"
Child age: ${childAge}
Learning goal: ${learningGoal}

Pages:
${formatPages(story)}

Discussion questions:
${questions}

Evaluate this story.`.trim();
};
