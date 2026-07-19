import { buildProseSystemPrompt, buildProsePrompt } from './prose.prompt';
import type { BuildStoryPromptOptions } from './story-generator.prompt';
import type { StoryPlan } from '../schemas';

const plan: StoryPlan = {
  title: 'Катя и горка',
  heroName: 'Катя',
  characterProfile: '3-year-old girl, brown hair',
  lesson: 'Пробуй, даже если страшно',
  discussionQuestions: ['1?', '2?', '3?', '4?', '5?'],
  pages: [
    { template: 'cover', beat: 'Завязка', intent: 'Катя у горки' },
    { template: 'image-top', beat: 'Трудность', intent: 'Катя боится' },
    { template: 'image-bottom', beat: 'Попытка с повтором', intent: 'Катя пробует' },
    { template: 'image-top', beat: 'Развязка', intent: 'Катя едет' },
    { template: 'final', beat: 'Закрепление', intent: 'Катя снова едет' },
  ],
};

const opts3to4: BuildStoryPromptOptions = {
  childName: 'Катя',
  childAge: 3,
  topic: 'Смелость',
  learningGoal: 'Пробовать новое',
  protagonistMode: 'child',
  arcType: 'virtue',
};

describe('buildProseSystemPrompt — per band cover-title cap', () => {
  it('states the 3-4 cap (40), not the 5-6 cap (60)', () => {
    const out = buildProseSystemPrompt('3-4');
    expect(out).toContain('40 characters');
    expect(out).not.toContain('60 characters');
  });

  it('states the 5-6 cap (60) for the 5-6 band', () => {
    const out = buildProseSystemPrompt('5-6');
    expect(out).toContain('60 characters');
  });
});

describe('buildProsePrompt — 3-4 band', () => {
  it('renders each page with the 3-4 (110) char cap, not 220', () => {
    const out = buildProsePrompt(plan, opts3to4);
    expect(out).toContain('text max 110 chars');
    expect(out).not.toContain('text max 220 chars');
  });

  it('shows a 3-4 exemplar, not a 5-6 one', () => {
    const out = buildProsePrompt(plan, opts3to4);
    expect(out).toContain('Катя'); // FEAR_3_4
  });
});
