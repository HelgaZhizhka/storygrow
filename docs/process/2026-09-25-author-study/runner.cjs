// Research-only. Run from backend with dotenv + tsx; --prepare makes no LLM calls.
const { createRequire } = require('node:module');
const { readFileSync, writeFileSync, existsSync, mkdirSync } = require('node:fs');
const { resolve } = require('node:path');
const { createHash, randomInt } = require('node:crypto');
const repo = resolve(__dirname, '../../..');
const req = createRequire(resolve(repo, 'backend/package.json'));
const { shutdownTelemetry } = req('./src/instrument.ts');
const { ConfigService } = req('@nestjs/config');
const { createOpenAI } = req('@ai-sdk/openai');
const { generateObject } = req('ai');
const { startActiveObservation } = req('@langfuse/tracing');
const { WholeStorySchema, wholeText } = req('./src/ai/schemas/whole-story.schema.ts');
const { StorySafetySchema } = req('./src/ai/schemas/story-safety.schema.ts');
const { buildAuthorSystem, buildStoryBrief, buildWholeStoryPrompt } = req(
  './src/ai/prompts/whole-story.prompt.ts',
);
const { STORY_SAFETY_SYSTEM, buildStorySafetyPrompt } = req(
  './src/ai/prompts/story-safety.prompt.ts',
);
const { runTextGates } = req('./src/ai/validators/whole-story.gates.ts');
const { findLearningGoal } = req('./src/scripts/lib/learning-goals.data.ts');
const config = new ConfigService(process.env);
const out = resolve(repo, 'backend/output/whole-story/2026-09-25-author-study');
const openai = createOpenAI({ apiKey: config.getOrThrow('OPENAI_API_KEY') });
const models = ['gpt-5-2025-08-07', 'gpt-4.1-2025-04-14'];
const write = (name, value) =>
  writeFileSync(resolve(out, name), JSON.stringify(value, null, 2) + '\n');
const host = config.getOrThrow('LANGFUSE_HOST');
const auth =
  'Basic ' +
  Buffer.from(
    config.getOrThrow('LANGFUSE_PUBLIC_KEY') + ':' + config.getOrThrow('LANGFUSE_SECRET_KEY'),
  ).toString('base64');

function prepare() {
  mkdirSync(out, { recursive: true });
  const protocol = readFileSync(resolve(__dirname, 'protocol.md'), 'utf8');
  const premise = protocol.split('## Замысел, написанный Codex до вызовов\n\n')[1].split('\n\n')[0];
  const brief = buildStoryBrief({ goal: findLearningGoal('Доброта'), ageBand: '5-6' });
  const original = buildWholeStoryPrompt({
    brief,
    hero: { name: 'Алиса', age: 6, gender: 'female' },
  });
  const prompt = original.replace(
    'Желание героя, помеху, события и развязку придумай сама/сам. Напиши законченную сказку.',
    'Напиши законченную сказку по следующему замыслу:\n' + premise,
  );
  if (prompt === original) throw new Error('Expected replacement missing');
  const request = {
    system: buildAuthorSystem('5-6', 'B'),
    prompt,
    models,
    maxOutputTokens: 10000,
    maxRetries: 0,
    providerOptions: { openai: { serviceTier: 'default' } },
  };
  const fingerprint = createHash('sha256').update(JSON.stringify(request)).digest('hex');
  const manifest = { preparedAt: new Date().toISOString(), fingerprint, request };
  if (existsSync(resolve(out, 'manifest.json'))) {
    const prior = JSON.parse(readFileSync(resolve(out, 'manifest.json'), 'utf8'));
    if (prior.fingerprint !== fingerprint) throw new Error('Manifest differs; refuse mixed run');
    return prior;
  }
  write('manifest.json', manifest);
  return manifest;
}

async function stage(input) {
  return startActiveObservation('codex-author-study.' + input.stage, async (span) => {
    const base = {
      id: input.id,
      stage: input.stage,
      model: input.model,
      system: input.system,
      prompt: input.prompt,
      traceId: span.traceId,
      startedAt: new Date().toISOString(),
    };
    write(input.id + '-' + input.stage + '.started.json', base);
    span.update({
      input: { system: input.system, prompt: input.prompt },
      metadata: { bookId: 'dry-run', ticket: 'STO-15', experiment: '2026-09-25-author-study' },
    });
    const result = await generateObject({
      model: openai(input.model),
      schema: input.schema,
      system: input.system,
      prompt: input.prompt,
      maxOutputTokens: input.maxOutputTokens,
      maxRetries: 0,
      abortSignal: AbortSignal.timeout(240000),
      providerOptions: { openai: { serviceTier: 'default' } },
      experimental_telemetry: {
        isEnabled: true,
        functionId: 'codex-author-study.' + input.stage,
        metadata: { bookId: 'dry-run', case: input.id },
      },
    });
    const record = {
      ...base,
      resolvedModel: result.response.modelId,
      responseId: result.response.id,
      finishedAt: new Date().toISOString(),
      finishReason: result.finishReason,
      usage: result.usage,
      result: result.object,
    };
    write(input.id + '-' + input.stage + '.json', record);
    span.update({ output: result.object });
    process.stdout.write(input.id + '/' + input.stage + ': completed\n');
    return record;
  });
}

async function generate(manifest) {
  if (existsSync(resolve(out, 'run-started.json')))
    throw new Error('Run already attempted; no silent retries');
  const health = await fetch(host + '/api/public/health', { signal: AbortSignal.timeout(10000) });
  if (!health.ok) throw new Error('LangFuse health failed');
  const access = await fetch(host + '/api/public/traces?limit=1', {
    headers: { Authorization: auth },
    signal: AbortSignal.timeout(10000),
  });
  if (!access.ok) throw new Error('LangFuse authentication failed');
  write('run-started.json', {
    startedAt: new Date().toISOString(),
    fingerprint: manifest.fingerprint,
  });
  const results = [];
  for (const [i, model] of models.entries()) {
    const id = 'case-' + (i + 1);
    const authored = await stage({
      id,
      stage: 'author',
      model,
      system: manifest.request.system,
      prompt: manifest.request.prompt,
      schema: WholeStorySchema,
      maxOutputTokens: 10000,
    });
    const story = authored.result;
    const text = wholeText(story);
    const gates = runTextGates({ title: story.title, text, ageBand: '5-6', goalTitle: 'Доброта' });
    const safety = await stage({
      id,
      stage: 'safety',
      model: 'gpt-4o-2024-08-06',
      system: STORY_SAFETY_SYSTEM,
      prompt: buildStorySafetyPrompt({ title: story.title, text, ageBand: '5-6' }),
      schema: StorySafetySchema,
      maxOutputTokens: 2000,
    });
    results.push({ id, authored, gates, safety });
    write('results.json', results);
  }
  const order = randomInt(2) ? [1, 0] : [0, 1];
  write(
    'blind-key.json',
    order.map((i) => ({ number: order.indexOf(i) + 1, id: results[i].id, model: models[i] })),
  );
  write(
    'reading.json',
    order.map((i, n) => ({
      number: n + 1,
      title: results[i].authored.result.title,
      text: wholeText(results[i].authored.result),
    })),
  );
}

async function verify() {
  const results = JSON.parse(readFileSync(resolve(out, 'results.json'), 'utf8'));
  const traces = [];
  for (const item of results.flatMap((r) => [r.authored, r.safety])) {
    const response = await fetch(host + '/api/public/traces/' + item.traceId, {
      headers: { Authorization: auth },
      signal: AbortSignal.timeout(10000),
    });
    const body = response.ok ? await response.json() : {};
    traces.push({
      id: item.id,
      stage: item.stage,
      traceId: item.traceId,
      status: response.status,
      observations: (body.observations || []).map((o) => ({
        id: o.id,
        type: o.type,
        model: o.model,
        usage: o.usage,
        calculatedTotalCost: o.calculatedTotalCost,
      })),
      totalCost: body.totalCost,
    });
  }
  write('trace-verification.json', traces);
  process.stdout.write(JSON.stringify(traces, null, 2) + '\n');
}

async function main() {
  if (process.argv.includes('--verify')) return verify();
  const manifest = prepare();
  if (process.argv.includes('--prepare'))
    return process.stdout.write('Prepared ' + manifest.fingerprint + '\n');
  await generate(manifest);
}
main()
  .catch((error) => {
    process.stderr.write(
      'Research stopped: ' + error.name + ' / ' + String(error.message).slice(0, 180) + '\n',
    );
    process.exitCode = 1;
  })
  .finally(shutdownTelemetry);
