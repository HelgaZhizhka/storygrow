import { JudgeScoreSchema, computeFinalScore } from './judge.schema';

describe('JudgeScoreSchema', () => {
  const full = {
    ageAppropriateVocab: 8,
    hasMoralLesson: 8,
    structureCompleteness: 8,
    safetyForChildren: 10,
    length: 8,
    engagement: 7,
    earnedResolution: 6,
  };

  it('requires the earnedResolution criterion', () => {
    const { earnedResolution, ...withoutNew } = full;
    expect(JudgeScoreSchema.safeParse(withoutNew).success).toBe(false);
    expect(JudgeScoreSchema.safeParse(full).success).toBe(true);
  });

  it('computeFinalScore averages all seven criteria', () => {
    // (8+8+8+10+8+7+6)/7 = 7.857... → 7.86
    expect(computeFinalScore(full)).toBeCloseTo(7.86, 2);
  });
});
