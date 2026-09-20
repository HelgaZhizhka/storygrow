/** Research-only whole-story pilot; no Book writes or production imports. */
import '../instrument';
import { shutdownTelemetry } from '../instrument';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { createOpenAI } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { startActiveObservation } from '@langfuse/tracing';
import { z } from 'zod';
import { randomInt, createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createTelemetry } from '../ai/telemetry';
import { blindStories, countWords, renderReading } from './lib/whole-story-artifacts';
import {
  AUTHOR_SYSTEM,
  PLANNER_SYSTEM,
  PILOT_CASES,
  PILOT_MODEL,
  PILOT_VERSION,
  PILOT_MAX_OUTPUT_TOKENS,
  PILOT_TIMEOUT_MS,
  casePrompt,
} from './lib/whole-story-prompts';

const outputDir = resolve(process.argv[2]);
const config = new ConfigService(process.env);
const openai = createOpenAI({ apiKey: config.getOrThrow<string>('OPENAI_API_KEY') });
const logger = new Logger('WholeStoryPilot');
const TextSchema = z.object({ title: z.string().min(1), text: z.string().min(1) });
type Text = z.infer<typeof TextSchema>;
interface CallInput {
  id: string;
  stage: string;
  system: string;
  prompt: string;
}
interface CallRecord extends CallInput {
  startedAt: string;
  durationMs: number;
  traceId: string;
  model: string;
  responseId?: string;
  usage?: unknown;
  finishReason?: string;
  result?: Text;
  error?: string;
}
const RecordSchema = z.object({
  id: z.string(),
  stage: z.string(),
  system: z.string(),
  prompt: z.string(),
  startedAt: z.string(),
  durationMs: z.number(),
  traceId: z.string(),
  model: z.string(),
  responseId: z.string().optional(),
  usage: z.unknown().optional(),
  finishReason: z.string().optional(),
  result: TextSchema.optional(),
  error: z.string().optional(),
});
const journalPath = resolve(outputDir, 'calls.json');
let records: CallRecord[] = existsSync(journalPath)
  ? z.array(RecordSchema).parse(JSON.parse(readFileSync(journalPath, 'utf8')))
  : [];

const save = (filename: string, data: unknown): void => {
  writeFileSync(resolve(outputDir, filename), JSON.stringify(data, null, 2) + '\n');
};

const generate = async (input: CallInput): Promise<Text> => {
  const previous = records.find((r) => r.id === input.id && r.stage === input.stage && r.result);
  if (previous?.result) {
    if (previous.system !== input.system || previous.prompt !== input.prompt)
      throw new Error('Prompt changed: use a new output directory');
    return previous.result;
  }
  return startActiveObservation(`whole-story-pilot.${input.stage}`, async (span) => {
    const start = Date.now();
    const base = {
      ...input,
      startedAt: new Date(start).toISOString(),
      traceId: span.traceId,
      model: PILOT_MODEL,
    };
    span.update({
      input: { system: input.system, prompt: input.prompt },
      metadata: { pilot: PILOT_VERSION, case: input.id, bookId: 'dry-run' },
    });
    logger.log(`Starting ${input.id}/${input.stage}`);
    try {
      const response = await generateObject({
        model: openai(PILOT_MODEL),
        schema: TextSchema,
        system: input.system,
        prompt: input.prompt,
        maxOutputTokens: PILOT_MAX_OUTPUT_TOKENS,
        maxRetries: 0,
        abortSignal: AbortSignal.timeout(PILOT_TIMEOUT_MS),
        experimental_telemetry: createTelemetry('whole-story-pilot', {
          case: input.id,
          stage: input.stage,
          bookId: 'dry-run',
          pilot: PILOT_VERSION,
        }),
      });
      records = [
        ...records,
        {
          ...base,
          durationMs: Date.now() - start,
          model: response.response.modelId,
          responseId: response.response.id,
          usage: response.usage,
          finishReason: response.finishReason,
          result: response.object,
        },
      ];
      save('calls.json', records);
      span.update({ output: response.object });
      logger.log(`Saved ${input.id}/${input.stage}: ${countWords(response.object.text)} words`);
      return response.object;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      records = [...records, { ...base, durationMs: Date.now() - start, error: message }];
      save('calls.json', records);
      throw error;
    }
  });
};

const runCase = async (item: (typeof PILOT_CASES)[number]): Promise<void> => {
  const prompt = casePrompt(item);
  await generate({ id: `${item.id}-A`, stage: 'story', system: AUTHOR_SYSTEM, prompt });
  const premise = await generate({
    id: `${item.id}-B`,
    stage: 'premise',
    system: PLANNER_SYSTEM,
    prompt,
  });
  await generate({
    id: `${item.id}-B`,
    stage: 'story',
    system: AUTHOR_SYSTEM,
    prompt: `${prompt}\n\nКороткий замысел для этой сказки:\n${premise.title}\n${premise.text}\n\nРазверни этот замысел в цельную сказку, следуя заданию автора.`,
  });
};

const readOrder = (): string[] => {
  const path = resolve(outputDir, 'blind-key.json');
  if (existsSync(path)) return z.array(z.string()).parse(JSON.parse(readFileSync(path, 'utf8')));
  const ids = PILOT_CASES.flatMap((c) => [`${c.id}-A`, `${c.id}-B`]);
  const order = ids
    .map((id) => ({ id, random: randomInt(0, 2 ** 30) }))
    .sort((a, b) => a.random - b.random)
    .map((x) => x.id);
  save('blind-key.json', order);
  return order;
};

const main = async (): Promise<void> => {
  config.getOrThrow<string>('LANGFUSE_PUBLIC_KEY');
  config.getOrThrow<string>('LANGFUSE_SECRET_KEY');
  if (config.get<string>('LANGFUSE_ENABLED') === 'false') throw new Error('Telemetry disabled');
  mkdirSync(outputDir, { recursive: true });
  const order = readOrder();
  const fingerprint = createHash('sha256')
    .update(JSON.stringify({ AUTHOR_SYSTEM, PLANNER_SYSTEM, PILOT_CASES }))
    .digest('hex');
  const manifestPath = resolve(outputDir, 'manifest.json');
  if (existsSync(manifestPath)) {
    const previous = z
      .object({ fingerprint: z.string() })
      .parse(JSON.parse(readFileSync(manifestPath, 'utf8')));
    if (previous.fingerprint !== fingerprint)
      throw new Error('Frozen pilot changed; use a new directory');
  } else
    save('manifest.json', {
      version: PILOT_VERSION,
      fingerprint,
      startedAt: new Date().toISOString(),
      gitHead: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
      model: PILOT_MODEL,
      maxOutputTokens: PILOT_MAX_OUTPUT_TOKENS,
      maxRetries: 0,
      timeoutMs: PILOT_TIMEOUT_MS,
      cases: PILOT_CASES,
      kind: 'text-only; no StoryEval or Book',
    });
  const runs = await Promise.allSettled(PILOT_CASES.map(runCase));
  if (runs.some((r) => r.status === 'rejected'))
    throw new Error('Pilot incomplete; see calls.json');
  const stories = records
    .filter((r) => r.stage === 'story' && r.result)
    .map((r) => ({ id: r.id, ...TextSchema.parse(r.result) }));
  const blind = blindStories(stories, order);
  writeFileSync(resolve(outputDir, 'reading.html'), renderReading(blind));
  save('reading.json', blind);
  save(
    'metrics.json',
    stories.map((s) => ({
      id: s.id,
      words: countWords(s.text),
      withinTarget: countWords(s.text) >= 500 && countWords(s.text) <= 800,
      bodySha256: createHash('sha256').update(s.text).digest('hex'),
    })),
  );
  logger.log('Six stories saved; blind reading document ready');
};

void main()
  .catch((error: unknown) => {
    logger.error(error);
    process.exitCode = 1;
  })
  .finally(shutdownTelemetry);
