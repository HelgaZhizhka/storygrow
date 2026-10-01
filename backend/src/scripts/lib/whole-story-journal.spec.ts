import { mkdtempSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import { CallJournal, cachedResult, ensureManifest, fingerprintOf } from './whole-story-journal';

const Schema = z.object({ title: z.string() });
const input = { id: 'case-1-1', stage: 'tale', system: 'S', prompt: 'P' };
const record = {
  ...input,
  startedAt: '2026-09-24T10:00:00.000Z',
  durationMs: 1200,
  traceId: 'abc',
  model: 'gpt-5-2025-08-07',
  result: { title: 'Алиса и фонарик' },
};

describe('CallJournal', () => {
  it('persists appended records and reloads them from disk', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ws-journal-'));
    const journal = new CallJournal(dir);
    journal.append(record);
    expect(new CallJournal(dir).all()).toHaveLength(1);
    expect(JSON.parse(readFileSync(join(dir, 'calls.json'), 'utf8'))).toHaveLength(1);
  });

  it('returns the cached result for an identical prompt and refuses a changed one', () => {
    const journal = new CallJournal(mkdtempSync(join(tmpdir(), 'ws-journal-')));
    journal.append(record);
    expect(cachedResult({ journal, input, schema: Schema })).toEqual({ title: 'Алиса и фонарик' });
    expect(() =>
      cachedResult({ journal, input: { ...input, prompt: 'changed' }, schema: Schema }),
    ).toThrow(/new output directory/);
  });

  it('ignores failed records so the stage is retried on the next run', () => {
    const journal = new CallJournal(mkdtempSync(join(tmpdir(), 'ws-journal-')));
    journal.append({ ...record, result: undefined, error: 'timeout' });
    expect(cachedResult({ journal, input, schema: Schema })).toBeUndefined();
  });
});

describe('ensureManifest', () => {
  it('writes the manifest on the first run and rejects a different fingerprint later', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ws-manifest-'));
    const fingerprint = fingerprintOf({ system: 'S', cases: ['Доброта'] });
    ensureManifest({ dir, fingerprint, manifest: { version: 'v2' } });
    expect(existsSync(join(dir, 'manifest.json'))).toBe(true);
    expect(() =>
      ensureManifest({ dir, fingerprint: fingerprintOf({ system: 'S2' }), manifest: {} }),
    ).toThrow(/new directory/);
    expect(() => ensureManifest({ dir, fingerprint, manifest: {} })).not.toThrow();
  });
});
