import { z } from 'zod';
import { AppearanceSchema } from './visual-bible.schema';

// Structured output of the vision descriptor step (#128): one call both gates
// on "is there a child's face?" and extracts an editable feature line.
// `.nullable()` (not `.optional()`) keeps every key required for strict
// structured-output mode — same pattern as learning-goal-safety.schema.ts.
export const PhotoDescriptorSchema = z.object({
  hasChildFace: z.boolean(),
  ageYears: z.number().nullable(),
  descriptor: z.string(),
  /**
   * English structured look for the pages and the judge (#376): skin and hair
   * from the face, the outfit as worn in the photo (the stylised portrait keeps
   * it). `kind` is overwritten in code from the child's age + gender. Filled with
   * neutral placeholders when hasChildFace is false.
   */
  appearance: AppearanceSchema,
});

export type PhotoDescriptor = z.infer<typeof PhotoDescriptorSchema>;
