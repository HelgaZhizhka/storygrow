import type { Story } from '../schemas';
import { buildJudgePrompt, buildJudgeSystemPrompt } from './judge.prompt';

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

describe('buildJudgePrompt — world block (#367)', () => {
  const base: Story = {
    title: 'Соня и горка',
    characterProfile: 'girl',
    discussionQuestions: ['1?', '2?', '3?', '4?', '5?'],
    pages: [{ template: 'cover', text: null, title: 'Соня и горка', illustrationPrompt: 'x' }],
  };

  it('lists the fixed world when the story has a bible, using Russian prop names', () => {
    const out = buildJudgePrompt(
      {
        ...base,
        visualBible: {
          hero: { name: 'Соня', descriptor: 'girl' },
          cast: [{ id: 'm', name: 'Маша', role: 'подруга', descriptor: 'girl' }],
          locations: [{ id: 'p', name: 'площадка', descriptor: 'one tall red slide, grass' }],
          props: [{ id: 'b', name: 'мячик', descriptor: 'a red ball' }],
          atmosphere: 'sunny',
        },
      },
      5,
      'смелость',
    );
    expect(out).toContain('World fixed by the illustrations');
    expect(out).toContain('places: площадка — one tall red slide, grass');
    expect(out).toContain('characters besides the hero: Маша');
    expect(out).toContain('objects: мячик');
  });

  it('omits the world block when the story has no bible', () => {
    expect(buildJudgePrompt(base, 5, 'смелость')).not.toContain('World fixed');
  });

  it('defines pictureConsistency as informational in the system prompt', () => {
    expect(buildJudgeSystemPrompt('5-6')).toContain('pictureConsistency');
    expect(buildJudgeSystemPrompt('5-6')).toContain('reported, not gated');
  });
});
