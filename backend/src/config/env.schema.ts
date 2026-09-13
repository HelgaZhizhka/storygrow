import { z } from 'zod';
import { IMAGE_PROVIDERS, IMAGE_EVAL_MAX_RETRIES_DEFAULT } from '../ai/ai.config';

/**
 * Environment contract (#373) — validated ONCE at startup by ConfigModule so a
 * misconfigured deployment fails loud instead of silently picking a different
 * paid model or running with a feature quietly off (#364: the judge was off in
 * production and nothing said so). Only keys with a documented shape are
 * checked here; everything else passes through untouched.
 *
 * Rule (ARCHITECTURE → Configuration): env is for secrets, topology and
 * documented kill switches with a reason. Experiments are explicit options on a
 * service input, never env; after an ADR a flag becomes a constant.
 */
export const EnvSchema = z
  .object({
    DATABASE_URL: z.string().min(1),
    REDIS_URL: z.string().min(1),
    OPENAI_API_KEY: z.string().min(1),
    /** Gemini is always needed: the vision judge and the photo descriptor use it. */
    GOOGLE_GENERATIVE_AI_API_KEY: z.string().min(1),
    IMAGE_PROVIDER: z.enum(IMAGE_PROVIDERS).default('xai'),
    XAI_API_KEY: z.string().optional(),
    /** Kill switch: 0 = judge every page and write rows, never buy a re-render. */
    IMAGE_EVAL_MAX_RETRIES: z.coerce
      .number()
      .int()
      .min(0)
      .max(3)
      .default(IMAGE_EVAL_MAX_RETRIES_DEFAULT),
  })
  .passthrough()
  .superRefine((env, ctx) => {
    if (env.IMAGE_PROVIDER === 'xai' && !env.XAI_API_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['XAI_API_KEY'],
        message: 'XAI_API_KEY is required when IMAGE_PROVIDER=xai (the default)',
      });
    }
  });

export type Env = z.infer<typeof EnvSchema>;

/** `ConfigModule.forRoot({ validate })` hook: throws with every problem listed. */
export const validateEnv = (raw: Record<string, unknown>): Env => {
  const result = EnvSchema.safeParse(raw);
  if (result.success) return result.data;
  const lines = result.error.issues.map((i) => `  ${i.path.join('.') || '(root)'}: ${i.message}`);
  throw new Error(`Invalid environment:\n${lines.join('\n')}`);
};
