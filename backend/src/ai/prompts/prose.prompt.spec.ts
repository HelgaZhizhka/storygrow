import { buildProseSystemPrompt, buildProsePrompt } from './prose.prompt';
import type { BuildStoryPromptOptions } from './story-generator.prompt';
import type { StoryPlan } from '../schemas';
import { sceneFixture, visualBibleFixture } from '../schemas/__fixtures__/visual-bible.fixture';

const plan: StoryPlan = {
  title: 'Катя и горка',
  heroName: 'Катя',
  characterProfile: '3-year-old girl, brown hair',
  lesson: 'Пробуй, даже если страшно',
  discussionQuestions: ['1?', '2?', '3?', '4?', '5?'],
  visualBible: visualBibleFixture(),
  pages: [
    { template: 'cover', beat: 'Завязка', intent: 'Катя у горки', scene: sceneFixture() },
    { template: 'image-top', beat: 'Трудность', intent: 'Катя боится', scene: sceneFixture() },
    {
      template: 'image-bottom',
      beat: 'Попытка с повтором',
      intent: 'Катя пробует',
      scene: sceneFixture(),
    },
    { template: 'image-top', beat: 'Развязка', intent: 'Катя едет', scene: sceneFixture() },
    { template: 'final', beat: 'Закрепление', intent: 'Катя снова едет', scene: sceneFixture() },
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

describe('buildProseSystemPrompt — Visual Bible / action rules (#348)', () => {
  it('describes illustrationPrompt as the ACTION, not the full scene', () => {
    const out = buildProseSystemPrompt('5-6');
    expect(out).toContain('ACTION');
    expect(out).not.toContain('under 180 characters');
  });

  it('drops the recurring-creature descriptor rule (rule 7), now handled by the bible cast', () => {
    const out = buildProseSystemPrompt('5-6');
    expect(out).not.toContain('RECURRING CHARACTERS');
  });
});

describe('buildProsePrompt — scene context (#348)', () => {
  it('renders the location and cast on each page and a cast roster', () => {
    const withCast: StoryPlan = {
      ...plan,
      visualBible: {
        ...plan.visualBible,
        cast: [{ id: 'brother', name: 'братик', role: 'младший брат', descriptor: 'toddler boy' }],
        locations: [{ id: 'home', name: 'двор', descriptor: 'a yard' }],
      },
      pages: plan.pages.map((p) => ({
        ...p,
        scene: sceneFixture({ locationId: 'home', castIds: ['brother'] }),
      })),
    };
    const out = buildProsePrompt(withCast, opts3to4);
    expect(out).toContain('@двор');
    expect(out).toContain('with: братик');
    expect(out).toContain('братик — младший брат');
  });
});
