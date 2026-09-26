import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';

/**
 * Append-only call journal + frozen manifest for the whole-story harness
 * (STO-15), carried over from the 2026-09-18 pilot. Every model call is
 * recorded with its prompts, model id, usage, timing, trace id and result or
 * error; a re-run in the same directory reuses successful calls and retries
 * failed ones, and refuses to run if any prompt changed — evidence never
 * silently mixes versions. Pure file I/O, no model calls: unit-testable.
 */

export interface StageInput {
  readonly id: string;
  readonly stage: string;
  readonly system: string;
  readonly prompt: string;
}

export interface CallRecord extends StageInput {
  readonly startedAt: string;
  readonly durationMs: number;
  readonly traceId: string;
  readonly model: string;
  readonly responseId?: string;
  readonly usage?: unknown;
  readonly finishReason?: string;
  readonly result?: unknown;
  readonly error?: string;
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
  result: z.unknown().optional(),
  error: z.string().optional(),
});

export const writeJson = (dir: string, filename: string, data: unknown): void => {
  mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, filename), JSON.stringify(data, null, 2) + '\n');
};

export const readJson = <T>(dir: string, filename: string, schema: z.ZodType<T>): T | undefined => {
  const path = resolve(dir, filename);
  if (!existsSync(path)) return undefined;
  return schema.parse(JSON.parse(readFileSync(path, 'utf8')));
};

export class CallJournal {
  private records: CallRecord[];

  constructor(private readonly dir: string) {
    this.records = readJson(dir, 'calls.json', z.array(RecordSchema)) ?? [];
  }

  all(): readonly CallRecord[] {
    return this.records;
  }

  /** The successful record for a stage, if any. */
  find(id: string, stage: string): CallRecord | undefined {
    return this.records.find((r) => r.id === id && r.stage === stage && r.result !== undefined);
  }

  append(record: CallRecord): void {
    this.records = [...this.records, record];
    writeJson(this.dir, 'calls.json', this.records);
  }
}

/**
 * Reuse a stage's successful result on re-run. A prompt that differs from the
 * recorded one means the experiment changed: refuse, never overwrite evidence.
 */
export const cachedResult = <T>(args: {
  journal: CallJournal;
  input: StageInput;
  schema: z.ZodType<T>;
}): T | undefined => {
  const previous = args.journal.find(args.input.id, args.input.stage);
  if (!previous) return undefined;
  if (previous.system !== args.input.system || previous.prompt !== args.input.prompt)
    throw new Error(
      `Prompt changed for ${args.input.id}/${args.input.stage}: use a new output directory`,
    );
  return args.schema.parse(previous.result);
};

export const fingerprintOf = (parts: unknown): string =>
  createHash('sha256').update(JSON.stringify(parts)).digest('hex');

/** Write the manifest on the first run; on later runs the fingerprint must match. */
export const ensureManifest = (args: {
  dir: string;
  fingerprint: string;
  manifest: Record<string, unknown>;
}): void => {
  const previous = readJson(args.dir, 'manifest.json', z.object({ fingerprint: z.string() }));
  if (previous && previous.fingerprint !== args.fingerprint)
    throw new Error('Frozen prompts or cases changed; use a new directory');
  if (!previous)
    writeJson(args.dir, 'manifest.json', {
      fingerprint: args.fingerprint,
      startedAt: new Date().toISOString(),
      ...args.manifest,
    });
};
