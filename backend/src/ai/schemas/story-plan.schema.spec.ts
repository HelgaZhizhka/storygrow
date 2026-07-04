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
