import { z } from 'zod';
import { AppearanceSchema } from './visual-bible.schema';

// Structured output of the vision descriptor step (#128): one call both gates
// on "is there a child's face?" and extracts an editable feature line.
// `.nullable()` (not `.optional()`) keeps every key required for strict
// structured-output mode — same pattern as learning-goal-safety.schema.ts.
export const PhotoDescriptorSchema = z.object({
  hasChildFace: z
    .boolean()
    .describe(
      "True only if the photo clearly shows a single child's face suitable for a portrait.",
    ),
  ageYears: z.number().nullable().describe("The child's apparent age in years, or null."),
  descriptor: z
    .string()
    .describe(
      'ONE compact Russian line of stable facial features (face shape, eyes, hair, skin); empty when hasChildFace is false.',
    ),
  /**
   * English structured look for the pages and the judge (#376): skin and hair
   * from the face, the outfit as worn in the photo (the stylised portrait keeps
   * it). `kind` is overwritten in code from the child's age + gender. Filled with
   * neutral placeholders when hasChildFace is false.
   */
  appearance: AppearanceSchema.describe(
    'The same child in English for the book pages; outfit = the clothes worn in the photo. Fill every field with "none" when hasChildFace is false.',
  ),
});

export type PhotoDescriptor = z.infer<typeof PhotoDescriptorSchema>;
