import { z } from 'zod';

const score = () => z.number().int().min(0).max(10);

/**
 * Judge v2 — INFORMATIONAL criteria for a whole tale (ADR-0008 decision 5,
 * spec 2026-09-23 §6). Nothing here accepts or rejects a book until stage 3
 * has shown the judge agrees with the owner on new results; the scores are
 * recorded and read by a human. Safety is NOT among them — it is a separate
 * blocking verdict (`StorySafetySchema`). Plot diversity is measured at run
 * level, not per tale.
 */
export const JudgeV2ScoreSchema = z.object({
  language: score().describe('Чистый, естественный русский язык без сбоев и не-русских слов.'),
  causality: score().describe('Понятно, почему события происходят и почему получился такой конец.'),
  goalArc: score().describe('Цель книги проявляется в поступках и последствиях; арка выдержана.'),
  ageFit: score().describe('Объём, синтаксис, число участников и событий подходят возрасту.'),
  title: score().describe('Название конкретное, из событий сказки, без называния ценности.'),
});

export const JudgeV2Schema = z.object({
  scores: JudgeV2ScoreSchema,
  reasoning: z
    .string()
    .min(1)
    .describe('3–5 предложений: что именно работает и что мешает, с цитатами.'),
});

export type JudgeV2Scores = z.infer<typeof JudgeV2ScoreSchema>;
export type JudgeV2Result = z.infer<typeof JudgeV2Schema>;
