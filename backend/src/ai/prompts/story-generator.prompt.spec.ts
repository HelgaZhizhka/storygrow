import { buildStoryUserPrompt, BuildStoryPromptOptions } from './story-generator.prompt';

const base: BuildStoryPromptOptions = {
  childName: 'Коля',
  childAge: 5,
  topic: 'Честность',
  learningGoal: 'Понимает, почему важно говорить правду.',
  allowedWords: ['правда', 'друг', 'сказал'],
  protagonistMode: 'child',
  arcType: 'flaw',
};

describe('buildStoryUserPrompt arc routing', () => {
  it('flaw arc injects the consequence beat sheet and earned-resolution rule', () => {
    const out = buildStoryUserPrompt(base);
    expect(out).toContain('Расплата');
    expect(out).toContain('заслуженн'); // earned resolution wording
    expect(out).toContain('[Расплата]'); // the flaw exemplar is injected
  });

  it('virtue arc injects the virtue beat sheet', () => {
    const out = buildStoryUserPrompt({ ...base, topic: 'Смелость', arcType: 'virtue' });
    expect(out).toContain('Внутренняя борьба');
    expect(out).not.toContain('[Расплата]');
  });
});

describe('buildStoryUserPrompt protagonist modes', () => {
  it('child mode: names the child as the hero and uses appearance', () => {
    const p = buildStoryUserPrompt({
      ...base,
      protagonistMode: 'child',
      gender: 'female',
      appearance: 'brown curly hair, blue dress',
    });
    expect(p).toContain('Коля');
    expect(p).toContain('brown curly hair, blue dress');
    expect(p.toLowerCase()).toContain('protagonist');
  });

  it('observer mode: does NOT use the child name and asks for an invented character', () => {
    const p = buildStoryUserPrompt({
      ...base,
      protagonistMode: 'observer',
      gender: 'female',
      appearance: 'brown curly hair',
    });
    expect(p).not.toContain('Коля');
    expect(p).not.toContain('brown curly hair');
    expect(p.toLowerCase()).toContain('invent');
    expect(p.toLowerCase()).toContain('third person');
  });
});
