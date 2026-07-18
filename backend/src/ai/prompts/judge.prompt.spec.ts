import { buildJudgeSystemPrompt } from './judge.prompt';

describe('buildJudgeSystemPrompt — per band register calibration', () => {
  it('5-6: shows the Сутеев register references and the flat/ornate two-sided criterion', () => {
    const out = buildJudgeSystemPrompt('5-6');
    expect(out).toContain('Жил-был мальчик Миша'); // COURAGE
    expect(out).toContain('Гриша'); // HONESTY
    expect(out).toMatch(/FLATTER than the exemplars/);
    expect(out).toMatch(/MORE ORNATE/);
  });

  it('3-4: shows the 3-4 exemplars, NOT the 5-6 ones', () => {
    const out = buildJudgeSystemPrompt('3-4');
    expect(out).toContain('Катя'); // FEAR_3_4
    expect(out).toContain('Мишка'); // KINDNESS_3_4
    expect(out).not.toContain('Жил-был мальчик Миша');
  });

  it('3-4: explicitly tells the judge repetition is the target, not a flaw', () => {
    const out = buildJudgeSystemPrompt('3-4');
    expect(out).toMatch(/REPETITION IS THE\s*\n?\s*TARGET/i);
  });

  it('states the correct age range in the header for each band', () => {
    expect(buildJudgeSystemPrompt('3-4')).toContain('ages 3–4');
    expect(buildJudgeSystemPrompt('5-6')).toContain('ages 5–6');
  });

  it('judges the title register in both bands (#257 title-register coverage)', () => {
    expect(buildJudgeSystemPrompt('3-4')).toMatch(/TITLE is part of the register/);
    expect(buildJudgeSystemPrompt('5-6')).toMatch(/TITLE is part of the register/);
  });
});
