import { z } from 'zod';

export interface Child {
  id: string;
  name: string;
  age: number;
  appearance?: string | null;
}

export interface LearningGoal {
  id: string;
  title: string;
  description: string;
}

export const NEW_CHILD_VALUE = '';
export const CUSTOM_GOAL_VALUE = '__custom__';

export const schema = z
  .object({
    selectedChildId: z.string().optional(),
    childName: z.string().optional(),
    childAge: z.coerce.number().optional(),
    childGender: z.enum(['male', 'female', 'other', '']).optional(),
    childAppearance: z
      .string()
      .max(1500, 'Слишком длинное описание — максимум 1500 символов')
      .optional(),
    learningGoalId: z.string().min(1, 'Выберите цель обучения'),
    customGoalText: z.string().optional(),
    customGoalArcType: z.enum(['virtue', 'flaw']).optional(),
    mode: z.enum(['fast', 'custom']),
    protagonistMode: z.enum(['child', 'observer']),
    artStyle: z.enum(['watercolor', 'cartoon', 'storybook', 'pixel', 'realistic']),
    interests: z.string().optional(),
    motifs: z.string().optional(),
    favoriteWords: z.string().optional(),
  })
  // childName/childAge are only required when creating a new child (no existing
  // child selected) — an existing child already has both, so re-asking is noise.
  .superRefine((values, ctx) => {
    if (!values.selectedChildId) {
      if (!values.childName?.trim()) {
        ctx.addIssue({ code: 'custom', path: ['childName'], message: 'Введите имя' });
      }
      const age = Number(values.childAge);
      if (!Number.isInteger(age) || age < 3 || age > 6) {
        ctx.addIssue({ code: 'custom', path: ['childAge'], message: 'Доступно 3–6 лет' });
      }
    }
    if (values.learningGoalId === CUSTOM_GOAL_VALUE) {
      const text = values.customGoalText?.trim() ?? '';
      if (!text) {
        ctx.addIssue({ code: 'custom', path: ['customGoalText'], message: 'Опишите цель' });
      } else if (text.length > 60) {
        ctx.addIssue({
          code: 'custom',
          path: ['customGoalText'],
          message: 'Максимум 60 символов',
        });
      }
    }
  });

export type FormValues = z.infer<typeof schema>;

// Personalization seeds (#197): comma-separated free text → capped string list.
// Matches the backend cap (≤6 items, ≤60 chars each); empty entries dropped.
export const toSeedList = (raw?: string): string[] =>
  (raw ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 6)
    .map((s) => s.slice(0, 60));
