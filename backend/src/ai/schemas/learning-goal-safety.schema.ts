import { z } from 'zod';

// OpenAI's strict structured-outputs mode requires every property to appear
// in the schema's `required` list, even ones that are conceptually
// optional — `.optional()` drops a key from `required` and the call fails
// with "Missing 'reason'" (400 invalid_json_schema). `.nullable()` keeps the
// key required but lets its value be null, matching this codebase's existing
// pattern for optional-ish LLM output fields (see story.schema.ts).
export const LearningGoalSafetySchema = z.object({
  safe: z.boolean(),
  reason: z.string().nullable(),
});

export type LearningGoalSafetyResult = z.infer<typeof LearningGoalSafetySchema>;
