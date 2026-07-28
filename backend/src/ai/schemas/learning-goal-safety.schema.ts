import { z } from 'zod';

export const LearningGoalSafetySchema = z.object({
  safe: z.boolean(),
  reason: z.string().optional(),
});

export type LearningGoalSafetyResult = z.infer<typeof LearningGoalSafetySchema>;
