import { type JudgeResult } from '../schemas';
import type { AgeBand } from '../../pdf/page-templates/page-templates.config';

/**
 * Shared generation prompt parts.
 *
 * Since ADR-0005 the single mega-prompt is gone — generation is decomposed into
 * the Plan phase (`plan.prompt.ts`) and the Prose phase (`prose.prompt.ts`).
 * This module keeps only what both phases (and the regeneration loop) share:
 * the arc beat sheets, the prompt-options type, and the regeneration feedback.
 */

// ─── Arc beat sheets ─────────────────────────────────────────────────────────

/**
 * Beat sheets, keyed by age band then arc type. 3-4 has no `flaw` entry — it
 * is virtue-only by design (ADR-0005: the flaw arc's "Расплата" consequence
 * beat is too heavy for this age). Use `getBeatSheet` to read, not direct
 * indexing — it fails loud on the impossible 3-4+flaw combination instead of
 * silently returning `undefined`.
 */
export const BEAT_SHEETS: Record<AgeBand, Partial<Record<'virtue' | 'flaw', string>>> = {
  '5-6': {
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
  },
  '3-4': {
    virtue: `Narrative arc for THIS story — SIMPLE VIRTUE-ACQUISITION for ages 3–4: the
hero tries something with a repeated refrain line and succeeds. Encode these
beats across the content pages, in order:
    1. Завязка — introduce the hero and their world in simple, concrete terms
       (who they are, one small thing about their day). No internal monologue.
    2. Трудность — something scary, not-working, or sad appears — concrete and
       small-scale (a tall slide, a shared toy, the dark). One sentence is enough.
    3. Попытка с повтором — the hero tries, using a SHORT REPEATED refrain line
       (the same short phrase or action, said or done at least twice across this
       beat). Repetition is the craft device here — it is the TARGET register,
       not a flaw to avoid.
    4. Развязка — it works, shown through action, not narrated ("он смог" is too
       abstract — show what happens, in one or two short sentences).
    5. Закрепление — the hero does it again; the refrain line returns one more
       time.`,
  },
};

/**
 * getBeatSheet — looks up the beat sheet for an (ageBand, arcType) pair.
 * Throws if missing (3-4 has no flaw sheet; the flaw arc is excluded from the
 * 3-4 learning-goal list at the source — see books.service.ts — so this should
 * never actually be hit in practice; fail loud rather than silently pick the
 * wrong register).
 */
export const getBeatSheet = (ageBand: AgeBand, arcType: 'virtue' | 'flaw'): string => {
  const sheet = BEAT_SHEETS[ageBand][arcType];
  if (!sheet) {
    throw new Error(`No beat sheet for ageBand=${ageBand}, arcType=${arcType}`);
  }
  return sheet;
};

// ─── Prompt options (shared by Plan and Prose phases) ────────────────────────

/**
 * Personalization seeds (#197) — soft, concrete per-book material that attacks
 * banality with specifics. They flavour the hero's WORLD (props, setting, small
 * touches) only; they never change premise, conflict, or lesson. `favoriteWords`
 * are woven only where natural, never forced (forcing flattens prose).
 */
export interface StorySeeds {
  interests: string[];
  motifs: string[];
  favoriteWords: string[];
}

export interface BuildStoryPromptOptions {
  childName: string;
  childAge: number;
  topic: string;
  learningGoal: string;
  /** Optional personalization seeds (soft). */
  seeds?: StorySeeds;
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

// ─── Regeneration feedback builder ───────────────────────────────────────────

/**
 * buildRegenerationFeedback — formats why the previous attempt failed.
 *
 * Fed into the next attempt's Plan phase as the `feedback` parameter.
 */
export const buildRegenerationFeedback = (
  judge?: JudgeResult,
  finalScore?: number,
  structuralErrors?: readonly string[],
): string => {
  const parts: string[] = [];

  if (structuralErrors && structuralErrors.length > 0) {
    parts.push(`Structural errors (fix first): ${structuralErrors.join('; ')}.`);
  }

  if (judge) {
    const scoreStr =
      finalScore !== undefined ? ` (register match ${finalScore.toFixed(1)}/10)` : '';
    parts.push(
      `Quality feedback${scoreStr}: ${judge.reasoning}` +
        ` Bring the voice closer to the warm Сутеев read-aloud register — neither flat` +
        ` (dry summary, no dialogue) nor ornate (decorative similes, rare/abstract words).`,
    );
  }

  return parts.join('\n\n');
};
