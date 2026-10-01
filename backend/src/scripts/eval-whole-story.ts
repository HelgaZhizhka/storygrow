/**
 * Whole-story research harness (STO-15, spec 2026-09-23 §8 stage 1).
 *
 * Text-only DRY RUN of the new text pipeline: brief (code) → whole tale (LLM)
 * → deterministic gates (code) → blocking safety verdict (LLM, fail closed)
 * → informational judge v2 (LLM). No Book, no StoryEval, no images, no PDF;
 * LangFuse traces on. Every call is journaled (calls.json), prompts are
 * fingerprinted (manifest.json), and a blind reading document is rendered for
 * the owner (reading.html) with the key in blind-key.json. No premise stage —
 * the pilot's invalid A/B is not repeated.
 *
 * Usage:
 *   pnpm --filter backend eval:whole-story --out=output/whole-story/<run> \
 *     [--goals="Доброта,Смелость,Дружба"] [--age=6] [--repeat=1] \
 *     [--model=gpt-5] [--safety-model=gpt-4o] [--judge-model=gpt-4o-mini] [--variants=A,B]
 *
 * Re-running with the same --out reuses successful calls and retries failed
 * ones; a changed prompt or case list refuses to run in that directory.
 */
import '../instrument';
import { shutdownTelemetry } from '../instrument';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { createOpenAI } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { startActiveObservation } from '@langfuse/tracing';
import { createHash, randomInt } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { writeFileSync } from 'node:fs';
import { z } from 'zod';
import { createTelemetry } from '../ai/telemetry';
import { GENERATION_MODEL, WORD_RANGE_BY_BAND } from '../ai/ai.config';
import { ageToAgeBand } from '../pdf/page-templates/page-templates.config';
import { WholeStorySchema, wholeText, type WholeStory } from '../ai/schemas/whole-story.schema';
import { StorySafetySchema, type StorySafety } from '../ai/schemas/story-safety.schema';
import { JudgeV2Schema, type JudgeV2Result } from '../ai/schemas/judge-v2.schema';
import {
  WHOLE_STORY_PROMPT_VERSION,
  buildAuthorSystem,
  buildStoryBrief,
  buildWholeStoryPrompt,
  type AuthorVariant,
  type HeroIdentity,
  type StoryBrief,
} from '../ai/prompts/whole-story.prompt';
import { STORY_SAFETY_SYSTEM, buildStorySafetyPrompt } from '../ai/prompts/story-safety.prompt';
import { JUDGE_V2_SYSTEM, buildJudgeV2Prompt } from '../ai/prompts/judge-v2.prompt';
import { runTextGates, type TextGateResult } from '../ai/validators/whole-story.gates';
import { findLearningGoal, type LearningGoalSeed } from './lib/learning-goals.data';
import {
  CallJournal,
  cachedResult,
  ensureManifest,
  fingerprintOf,
  readJson,
  writeJson,
  type StageInput,
} from './lib/whole-story-journal';
import { blindTales, renderReading } from './lib/whole-story-artifacts';

const logger = new Logger('WholeStoryHarness');
const TIMEOUT_MS = 240_000;
const TALE_MAX_OUTPUT_TOKENS = 10_000;
const CHECK_MAX_OUTPUT_TOKENS = 2_000;

const flag = (name: string, fallback: string): string => {
  const found = process.argv.find((a) => a.startsWith(`--${name}=`));
  return found ? found.slice(name.length + 3) : fallback;
};

const options = {
  out: resolve(flag('out', '')),
  goals: flag('goals', 'Доброта,Смелость,Дружба')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  age: Number(flag('age', '6')),
  repeat: Number(flag('repeat', '1')),
  model: flag('model', 'gpt-5'),
  safetyModel: flag('safety-model', 'gpt-4o'),
  judgeModel: flag('judge-model', GENERATION_MODEL),
  // Author-prompt variants for a single-variable diagnostic (round 2): 'A' is
  // the round-1 prompt unchanged; ids of A cases stay `case-<g>-<r>` so a
  // round-1 directory re-runs from its journal without new calls.
  variants: flag('variants', 'A')
    .split(',')
    .map((s) => s.trim())
    .filter((s): s is AuthorVariant => s === 'A' || s === 'B'),
};

interface Case {
  readonly id: string;
  readonly goal: LearningGoalSeed;
  readonly variant: AuthorVariant;
}

interface CaseResult {
  readonly id: string;
  readonly goal: string;
  readonly variant: AuthorVariant;
  readonly brief: StoryBrief;
  readonly tale: WholeStory;
  readonly words: number;
  readonly gates: TextGateResult;
  readonly safety: StorySafety;
  readonly judge?: JudgeV2Result;
  readonly judgeError?: string;
  readonly accepted: boolean;
}

const config = new ConfigService(process.env);
const openai = createOpenAI({ apiKey: config.getOrThrow<string>('OPENAI_API_KEY') });
const journal = new CallJournal(options.out);

const runStage = async <T>(args: {
  input: StageInput;
  schema: z.ZodType<T>;
  model: string;
  maxOutputTokens: number;
}): Promise<T> => {
  const cached = cachedResult({ journal, input: args.input, schema: args.schema });
  if (cached !== undefined) return cached;
  return startActiveObservation(`whole-story.${args.input.stage}`, async (span) => {
    const start = Date.now();
    const base = {
      ...args.input,
      startedAt: new Date(start).toISOString(),
      traceId: span.traceId,
      model: args.model,
    };
    span.update({
      input: { system: args.input.system, prompt: args.input.prompt },
      metadata: { version: WHOLE_STORY_PROMPT_VERSION, case: args.input.id, bookId: 'dry-run' },
    });
    logger.log(`→ ${args.input.id}/${args.input.stage} (${args.model})`);
    try {
      const response = await generateObject({
        model: openai(args.model),
        schema: args.schema,
        system: args.input.system,
        prompt: args.input.prompt,
        maxOutputTokens: args.maxOutputTokens,
        maxRetries: 0,
        abortSignal: AbortSignal.timeout(TIMEOUT_MS),
        experimental_telemetry: createTelemetry(`whole-story-${args.input.stage}`, {
          case: args.input.id,
          version: WHOLE_STORY_PROMPT_VERSION,
          bookId: 'dry-run',
        }),
      });
      journal.append({
        ...base,
        durationMs: Date.now() - start,
        model: response.response.modelId,
        responseId: response.response.id,
        usage: response.usage,
        finishReason: response.finishReason,
        result: response.object,
      });
      span.update({ output: response.object });
      return response.object;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      journal.append({ ...base, durationMs: Date.now() - start, error: message });
      throw error;
    }
  });
};

/** Blocking gate: any error or undetermined answer is a `fail` (fail closed). */
const safetyVerdict = async (
  id: string,
  tale: WholeStory,
  ageBand: '3-4' | '5-6',
): Promise<StorySafety> => {
  try {
    return await runStage({
      input: {
        id,
        stage: 'safety',
        system: STORY_SAFETY_SYSTEM,
        prompt: buildStorySafetyPrompt({ title: tale.title, text: wholeText(tale), ageBand }),
      },
      schema: StorySafetySchema,
      model: options.safetyModel,
      maxOutputTokens: CHECK_MAX_OUTPUT_TOKENS,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return { verdict: 'fail', reasons: [`Safety gate error — failed closed: ${message}`] };
  }
};

const judgeInformational = async (
  id: string,
  tale: WholeStory,
  brief: StoryBrief,
): Promise<Pick<CaseResult, 'judge' | 'judgeError'>> => {
  try {
    const judge = await runStage({
      input: {
        id,
        stage: 'judge',
        system: JUDGE_V2_SYSTEM,
        prompt: buildJudgeV2Prompt({
          title: tale.title,
          text: wholeText(tale),
          brief,
          childAge: options.age,
        }),
      },
      schema: JudgeV2Schema,
      model: options.judgeModel,
      maxOutputTokens: CHECK_MAX_OUTPUT_TOKENS,
    });
    return { judge };
  } catch (error: unknown) {
    return { judgeError: error instanceof Error ? error.message : String(error) };
  }
};

const runCase = async (item: Case, hero: HeroIdentity): Promise<CaseResult> => {
  const ageBand = ageToAgeBand(options.age);
  const brief = buildStoryBrief({ goal: item.goal, ageBand });
  const tale = await runStage({
    input: {
      id: item.id,
      stage: 'tale',
      system: buildAuthorSystem(ageBand, item.variant),
      prompt: buildWholeStoryPrompt({ brief, hero }),
    },
    schema: WholeStorySchema,
    model: options.model,
    maxOutputTokens: TALE_MAX_OUTPUT_TOKENS,
  });
  const text = wholeText(tale);
  const gates = runTextGates({ title: tale.title, text, ageBand, goalTitle: item.goal.title });
  const safety = await safetyVerdict(item.id, tale, ageBand);
  const judged = await judgeInformational(item.id, tale, brief);
  const accepted = gates.passed && safety.verdict === 'pass';
  logger.log(
    `${item.id} «${tale.title}» ${gates.words}w gates=${gates.passed} safety=${safety.verdict} accepted=${accepted}`,
  );
  return {
    id: item.id,
    goal: item.goal.title,
    variant: item.variant,
    brief,
    tale,
    words: gates.words,
    gates,
    safety,
    ...judged,
    accepted,
  };
};

const buildCases = (): Case[] =>
  options.goals.flatMap((title, gi) => {
    const goal = findLearningGoal(title);
    if (!goal) throw new Error(`Unknown learning goal: ${title}`);
    return options.variants.flatMap((variant) =>
      Array.from({ length: options.repeat }, (_, r) => ({
        id: variant === 'A' ? `case-${gi + 1}-${r + 1}` : `case-${gi + 1}${variant}-${r + 1}`,
        goal,
        variant,
      })),
    );
  });

const blindOrder = (ids: string[]): string[] =>
  readOrder() ??
  (() => {
    const order = ids
      .map((id) => ({ id, random: randomInt(0, 2 ** 30) }))
      .sort((a, b) => a.random - b.random)
      .map((x) => x.id);
    writeJson(options.out, 'blind-key.json', order);
    return order;
  })();

const readOrder = (): string[] | undefined =>
  readJson(options.out, 'blind-key.json', z.array(z.string()));

const writeArtifacts = (results: CaseResult[]): void => {
  writeJson(options.out, 'results.json', results);
  const tales = results.map((r) => ({ id: r.id, title: r.tale.title, text: wholeText(r.tale) }));
  const blind = blindTales(tales, blindOrder(tales.map((t) => t.id)));
  const dateLabel = new Date().toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  writeFileSync(resolve(options.out, 'reading.html'), renderReading({ tales: blind, dateLabel }));
  writeJson(options.out, 'reading.json', blind);
  const range = WORD_RANGE_BY_BAND[ageToAgeBand(options.age)];
  writeJson(
    options.out,
    'metrics.json',
    results.map((r) => ({
      id: r.id,
      goal: r.goal,
      variant: r.variant,
      words: r.words,
      withinRange: r.words >= range.min && r.words <= range.max,
      gatesPassed: r.gates.passed,
      safety: r.safety.verdict,
      judge: r.judge?.scores,
      accepted: r.accepted,
      bodySha256: createHash('sha256').update(wholeText(r.tale)).digest('hex'),
    })),
  );
};

const main = async (): Promise<void> => {
  if (!options.out || options.out === resolve('')) throw new Error('--out=<dir> is required');
  config.getOrThrow<string>('LANGFUSE_PUBLIC_KEY');
  config.getOrThrow<string>('LANGFUSE_SECRET_KEY');
  if (config.get<string>('LANGFUSE_ENABLED') === 'false') throw new Error('Telemetry disabled');
  const ageBand = ageToAgeBand(options.age);
  const hero: HeroIdentity = { name: 'Алиса', age: options.age, gender: 'female' };
  const cases = buildCases();
  ensureManifest({
    dir: options.out,
    fingerprint: fingerprintOf({
      version: WHOLE_STORY_PROMPT_VERSION,
      author: buildAuthorSystem(ageBand),
      ...(options.variants.includes('B') ? { authorB: buildAuthorSystem(ageBand, 'B') } : {}),
      safety: STORY_SAFETY_SYSTEM,
      judge: JUDGE_V2_SYSTEM,
      cases: cases.map((c) => [c.id, c.goal.title]),
      age: options.age,
      model: options.model,
    }),
    manifest: {
      version: WHOLE_STORY_PROMPT_VERSION,
      gitHead: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
      kind: 'text-only dry run; no StoryEval or Book',
      age: options.age,
      ageBand,
      hero,
      models: { author: options.model, safety: options.safetyModel, judge: options.judgeModel },
      variants: options.variants,
      maxRetries: 0,
      timeoutMs: TIMEOUT_MS,
      cases: cases.map((c) => ({
        id: c.id,
        goal: c.goal.title,
        arcType: c.goal.arcType ?? 'virtue',
        variant: c.variant,
      })),
    },
  });
  const settled = await Promise.allSettled(cases.map((c) => runCase(c, hero)));
  const results = settled.flatMap((s) => (s.status === 'fulfilled' ? [s.value] : []));
  if (results.length > 0) writeArtifacts(results);
  if (results.length !== cases.length)
    throw new Error(`${cases.length - results.length} case(s) failed; see calls.json`);
  const accepted = results.filter((r) => r.accepted).length;
  logger.log(
    `${results.length} tales, ${accepted} passed gates + safety; reading.html ready in ${options.out}`,
  );
};

void main()
  .catch((error: unknown) => {
    logger.error(error);
    process.exitCode = 1;
  })
  .finally(shutdownTelemetry);
