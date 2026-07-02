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
