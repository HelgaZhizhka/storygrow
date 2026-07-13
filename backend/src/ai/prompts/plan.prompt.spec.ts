import { buildPlanPrompt } from './plan.prompt';
import type { BuildStoryPromptOptions } from './story-generator.prompt';

const base: BuildStoryPromptOptions = {
  childName: 'Коля',
  childAge: 5,
  topic: 'Честность',
  learningGoal: 'Понимает, почему важно говорить правду.',
  protagonistMode: 'child',
  arcType: 'flaw',
};

describe('buildPlanPrompt personalization seeds', () => {
  it('injects supplied seeds under a SOFT framing that protects the premise', () => {
    const out = buildPlanPrompt({
      ...base,
      seeds: {
        interests: ['динозавры'],
        motifs: ['дружба'],
        favoriteWords: ['ура'],
      },
    });
    expect(out).toContain('динозавры');
    expect(out).toContain('ура');
    expect(out).toContain('SOFT');
    expect(out).toMatch(/do NOT change the premise/i);
  });

  it('omits the seeds block entirely when no seeds are supplied', () => {
    expect(buildPlanPrompt(base)).not.toContain('PERSONALIZATION SEEDS');
  });

  it('omits the seeds block when all seed lists are empty', () => {
    const out = buildPlanPrompt({
      ...base,
      seeds: { interests: [], motifs: [], favoriteWords: [] },
    });
    expect(out).not.toContain('PERSONALIZATION SEEDS');
  });
});

describe('buildPlanPrompt arc routing', () => {
  it('flaw arc encodes the consequence beat sheet (Расплата)', () => {
    const out = buildPlanPrompt(base);
    expect(out).toContain('Расплата');
    expect(out).toContain('Заслуженный финал');
  });

  it('virtue arc encodes the virtue beat sheet, not the flaw consequence', () => {
    const out = buildPlanPrompt({ ...base, topic: 'Смелость', arcType: 'virtue' });
    expect(out).toContain('Внутренняя борьба');
    expect(out).not.toContain('Расплата');
  });
});

describe('buildPlanPrompt protagonist modes', () => {
  it('child mode: names the child as the hero but keeps appearance OUT of the plot', () => {
    const p = buildPlanPrompt({
      ...base,
      protagonistMode: 'child',
      gender: 'female',
      appearance: 'brown curly hair, blue dress',
    });
    expect(p).toContain('Коля');
    // Appearance is image-only; it must never reach the plot planner (a hair-bow
    // etc. would otherwise leak into the story/title). It is derived separately.
    expect(p).not.toContain('brown curly hair, blue dress');
    expect(p.toLowerCase()).toContain('protagonist');
  });

  it('observer mode: does NOT use the child name and asks for an invented character', () => {
    const p = buildPlanPrompt({
      ...base,
      protagonistMode: 'observer',
      gender: 'female',
      appearance: 'brown curly hair',
    });
    expect(p).not.toContain('Коля');
    expect(p).not.toContain('brown curly hair');
    expect(p.toLowerCase()).toContain('invent');
  });
});
