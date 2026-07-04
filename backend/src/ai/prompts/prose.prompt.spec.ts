import { buildProsePrompt } from './prose.prompt';
import type { BuildStoryPromptOptions } from './story-generator.prompt';
import type { StoryPlan } from '../schemas';

const plan: StoryPlan = {
  title: 'Тимур и правда',
  heroName: 'Тимур',
  characterProfile: '6-year-old boy, dark hair, green shirt',
  lesson: 'Говори правду',
  discussionQuestions: ['1?', '2?', '3?', '4?', '5?'],
  pages: [
    { template: 'cover', beat: 'Обложка', intent: 'Тимур во дворе' },
    { template: 'image-top', beat: 'Завязка', intent: 'Тимур зовёт друзей' },
    { template: 'image-bottom', beat: 'Конфликт', intent: 'Никто не верит' },
    { template: 'image-left', beat: 'Борьба', intent: 'Тимур один' },
    { template: 'image-top', beat: 'Развязка', intent: 'Друзья приходят' },
    { template: 'final', beat: 'Финал', intent: 'Правда важна' },
  ],
};

const opts: BuildStoryPromptOptions = {
  childName: 'Тимур',
  childAge: 6,
  topic: 'Честность',
  learningGoal: 'Говорить правду',
  protagonistMode: 'child',
  arcType: 'flaw',
};

describe('buildProsePrompt companion descriptors', () => {
  it('lists companion descriptors with a verbatim-use instruction', () => {
    const out = buildProsePrompt(plan, opts, ['Mira, a small grey tabby cat']);
    expect(out).toContain('Mira, a small grey tabby cat');
    expect(out).toMatch(/never by bare name/i);
  });

  it('omits the companion block when there are none', () => {
    expect(buildProsePrompt(plan, opts, [])).not.toContain('Companion descriptors');
    expect(buildProsePrompt(plan, opts)).not.toContain('Companion descriptors');
  });
});
