import { z } from 'zod';
import { ALL_TAGS } from './tag-taxonomy';

const illustrationTagSchema = z.enum(ALL_TAGS as [string, ...string[]]);

export const templatePageSchema = z.object({
  pageNumber: z.number().int().min(1),
  text: z.string().min(1),
  illustrationTag: illustrationTagSchema,
});

export const templateContentSchema = z.object({
  pages: z.array(templatePageSchema).min(4).max(10),
});

export type TemplatePage = z.infer<typeof templatePageSchema>;
export type TemplateContent = z.infer<typeof templateContentSchema>;
