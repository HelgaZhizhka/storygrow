import { buildStoryUserPrompt } from './story-generator.prompt';

const base = {
  childName: 'Маша',
  childAge: 6,
  topic: 'дружба',
  learningGoal: 'научиться дружить',
  allowedWords: ['маша', 'кот'],
  bookId: 'book-1',
};

describe('buildStoryUserPrompt', () => {
  it('child mode: names the child as the hero and uses appearance', () => {
    const p = buildStoryUserPrompt({
      ...base,
      protagonistMode: 'child',
      gender: 'female',
      appearance: 'brown curly hair, blue dress',
    });
    expect(p).toContain('Маша');
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
    expect(p).not.toContain('Маша');
    expect(p).not.toContain('brown curly hair');
    expect(p.toLowerCase()).toContain('invent');
    expect(p.toLowerCase()).toContain('third person');
  });
});
