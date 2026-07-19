import { buildStoryPlanSchema } from './story-plan.schema';
import { templatesForAge } from '../../pdf/page-templates/page-templates.config';

const planWith = (template: string): unknown => ({
  title: 'Тест',
  heroName: 'Алиса',
  characterProfile: 'girl',
  lesson: 'урок',
  discussionQuestions: ['1?', '2?', '3?', '4?', '5?'],
  pages: [
    { template: 'cover', beat: 'Обложка', intent: 'обложка' },
    { template, beat: 'Завязка', intent: 'что-то' },
    { template: 'image-top', beat: 'Конфликт', intent: 'что-то' },
    { template: 'image-bottom', beat: 'Борьба', intent: 'что-то' },
    { template: 'image-top', beat: 'Развязка', intent: 'что-то' },
    { template: 'final', beat: 'Финал', intent: 'финал' },
  ],
});

describe('buildStoryPlanSchema template age-guard', () => {
  it('rejects a template outside the age catalogue (text-focus @ age 6)', () => {
    expect(templatesForAge(6)).not.toContain('text-focus');
    const result = buildStoryPlanSchema(6).safeParse(planWith('text-focus'));
    expect(result.success).toBe(false);
  });

  it('accepts an age-valid template (image-left @ age 6)', () => {
    expect(templatesForAge(6)).toContain('image-left');
    const result = buildStoryPlanSchema(6).safeParse(planWith('image-left'));
    expect(result.success).toBe(true);
  });
});

describe('buildStoryPlanSchema page-count per band', () => {
  it('caps a 3-4 plan at 8 pages (vs 12 for 5-6)', () => {
    const eightPages = {
      title: 'Тест',
      heroName: 'Катя',
      characterProfile: 'girl',
      lesson: 'урок',
      discussionQuestions: ['1?', '2?', '3?', '4?', '5?'],
      pages: Array.from({ length: 9 }, (_, i) => ({
        template: i === 0 ? 'cover' : i === 8 ? 'final' : 'image-top',
        beat: 'Бит',
        intent: 'что-то',
      })),
    };
    const result3to4 = buildStoryPlanSchema(3).safeParse(eightPages);
    expect(result3to4.success).toBe(false);

    const result5to6 = buildStoryPlanSchema(6).safeParse(eightPages);
    expect(result5to6.success).toBe(true);
  });

  it('rejects a 5-6-only template (image-left) for age 3, mirroring the existing #218 age-template-guard pattern', () => {
    const withImageLeft = planWith('image-left');
    expect(templatesForAge(3)).not.toContain('image-left');
    const result3to4 = buildStoryPlanSchema(3).safeParse(withImageLeft);
    expect(result3to4.success).toBe(false);

    expect(templatesForAge(6)).toContain('image-left');
    const result5to6 = buildStoryPlanSchema(6).safeParse(withImageLeft);
    expect(result5to6.success).toBe(true);
  });
});
