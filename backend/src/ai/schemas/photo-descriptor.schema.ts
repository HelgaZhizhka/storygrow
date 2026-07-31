import { z } from 'zod';

// Structured output of the vision descriptor step (#128): one call both gates
// on "is there a child's face?" and extracts an editable feature line.
// `.nullable()` (not `.optional()`) keeps every key required for strict
// structured-output mode — same pattern as learning-goal-safety.schema.ts.
export const PhotoDescriptorSchema = z.object({
  hasChildFace: z.boolean(),
  ageYears: z.number().nullable(),
  descriptor: z.string(),
});

export type PhotoDescriptor = z.infer<typeof PhotoDescriptorSchema>;
