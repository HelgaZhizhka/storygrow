import { JudgeScoreSchema, computeFinalScore, passesGuardrails } from './judge.schema';

describe('JudgeScoreSchema', () => {
  const full = {
    ageAppropriateVocab: 8,
    hasMoralLesson: 8,
    structureCompleteness: 8,
    safetyForChildren: 10,
    length: 8,
    earnedResolution: 7,
    registerMatch: 6,
  };

  it('requires the registerMatch craft criterion', () => {
    const withoutCraft = {
      ageAppropriateVocab: 8,
      hasMoralLesson: 8,
      structureCompleteness: 8,
      safetyForChildren: 10,
      length: 8,
      earnedResolution: 7,
    };
    expect(JudgeScoreSchema.safeParse(withoutCraft).success).toBe(false);
    expect(JudgeScoreSchema.safeParse(full).success).toBe(true);
  });

  it('computeFinalScore is the craft signal (registerMatch), not a mean', () => {
    expect(computeFinalScore(full)).toBe(6);
  });

  it('passesGuardrails ignores registerMatch and gates on the guardrail floor', () => {
    // registerMatch is low but every guardrail clears the floor of 6.
    expect(passesGuardrails(full, 6)).toBe(true);
    // A single guardrail below the floor fails the gate.
    expect(passesGuardrails({ ...full, safetyForChildren: 4 }, 6)).toBe(false);
  });
});
