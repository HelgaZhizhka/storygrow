// Research only: frozen requests, no production edits. --prepare and --self-test are offline.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const repo = path.resolve(__dirname, '../../..');
const req = createRequire(path.join(repo, 'backend/package.json'));
const out = path.join(repo, 'backend/output/whole-story/2026-09-28-premise');
const inputPath = path.join(__dirname, 'requests.json');
const manifest = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
const LIMIT = 0.7;
const rates = { 'gpt-5-2025-08-07': 1.25, 'gpt-4o-2024-08-06': 2.5 };
const write = (name, data) =>
  fs.writeFileSync(path.join(out, name), JSON.stringify(data, null, 2) + '\n');
const read = (name) => JSON.parse(fs.readFileSync(path.join(out, name), 'utf8'));
let spent = 0;
let active;
let runtime;
function budgetGuard(body, charged) {
  const maxOut = body.max_output_tokens ?? body.max_completion_tokens ?? body.max_tokens;
  assert.ok(rates[body.model], 'Unexpected model');
  assert.equal(maxOut, body.model.startsWith('gpt-5') ? 10000 : 2000);
  const inputUpper = Buffer.byteLength(JSON.stringify(body)) + 1024;
  const upper = (inputUpper * rates[body.model] + maxOut * 10) / 1e6;
  assert.ok(charged + upper <= LIMIT, 'Next request exceeds conservative remaining budget');
  return { inputUpper, maxOut, upper, spentBefore: charged };
}
function validateConditions(input) {
  assert.equal(input.cases.length, 4);
  assert.equal(new Set(input.cases.map((c) => c.goalTitle)).size, 1);
  assert.equal(new Set(input.cases.map((c) => c.system)).size, 1);
  assert.deepEqual(
    input.cases.map((c) => c.condition),
    ['A', 'B', 'B', 'A'],
  );
  const [a, b, b2, a2] = input.cases;
  assert.equal(a.prompt, a2.prompt);
  assert.equal(b.prompt, b2.prompt);
  assert.equal(
    b.prompt,
    a.prompt.replace(
      'Придумай самостоятельную законченную историю.',
      'Напиши законченную историю по следующему замыслу:\n' + input.premise,
    ),
  );
  assert.notEqual(a.prompt, b.prompt);
}
function prepare() {
  validateConditions(manifest);
  const source = fs.readFileSync(
    path.join(repo, 'backend/src/ai/prompts/whole-story.prompt.ts'),
    'utf8',
  );
  const safety = source.split('const SAFETY_BOUNDARY = `')[1].split('`;')[0];
  for (const c of manifest.cases) assert.ok(c.system.endsWith(safety));
  fs.mkdirSync(out, { recursive: true });
  const sha = crypto.createHash('sha256').update(fs.readFileSync(inputPath)).digest('hex');
  const files = [
    'ai/prompts/story-safety.prompt.ts',
    'ai/schemas/whole-story.schema.ts',
    'ai/schemas/story-safety.schema.ts',
    'ai/validators/whole-story.gates.ts',
  ];
  const dependencies = Object.fromEntries(
    files.map((f) => [
      f,
      crypto
        .createHash('sha256')
        .update(fs.readFileSync(path.join(repo, 'backend/src', f)))
        .digest('hex'),
    ]),
  );
  const snapshot = { ...manifest, requestsFileSha256: sha, dependencies };
  if (fs.existsSync(path.join(out, 'manifest.json')))
    assert.deepEqual(read('manifest.json'), snapshot);
  else write('manifest.json', snapshot);
  return snapshot;
}
async function guardedFetch(url, init) {
  const body = JSON.parse(init.body);
  assert.ok(active, 'Generation outside recorded stage');
  assert.equal(active.requests, 0, 'No second HTTP request for a stage');
  const bound = budgetGuard(body, spent);
  active.requests += 1;
  write(active.key + '.wire-request.json', { url: String(url), body, bound });
  const response = await fetch(url, init);
  const raw = await response.clone().text();
  fs.writeFileSync(path.join(out, active.key + '.wire-response.txt'), raw);
  return response;
}
function setup() {
  const { shutdownTelemetry } = req('./src/instrument.ts');
  const { ConfigService } = req('@nestjs/config');
  const config = new ConfigService(process.env);
  const { createOpenAI } = req('@ai-sdk/openai');
  return {
    shutdownTelemetry,
    config,
    openai: createOpenAI({ apiKey: config.getOrThrow('OPENAI_API_KEY'), fetch: guardedFetch }),
    ...req('ai'),
    ...req('@langfuse/tracing'),
  };
}
async function preflight() {
  const config = runtime.config;
  const key = config.getOrThrow('OPENAI_API_KEY');
  for (const model of Object.keys(rates)) {
    const response = await fetch('https://api.openai.com/v1/models/' + model, {
      headers: { Authorization: 'Bearer ' + key },
      signal: AbortSignal.timeout(10000),
    });
    assert.equal(response.status, 200, 'Model access failed: ' + model);
  }
  const health = await fetch(config.getOrThrow('LANGFUSE_HOST') + '/api/public/health');
  assert.equal(health.status, 200);
  const access = await traceFetch('/api/public/traces?limit=1');
  assert.equal(access.status, 200);
}
function traceFetch(suffix) {
  const c = runtime.config;
  const token = Buffer.from(
    c.getOrThrow('LANGFUSE_PUBLIC_KEY') + ':' + c.getOrThrow('LANGFUSE_SECRET_KEY'),
  ).toString('base64');
  return fetch(c.getOrThrow('LANGFUSE_HOST') + suffix, {
    headers: { Authorization: 'Basic ' + token },
    signal: AbortSignal.timeout(10000),
  });
}
function options(input) {
  return {
    model: runtime.openai(input.model),
    schema: input.schema,
    system: input.system,
    prompt: input.prompt,
    maxOutputTokens: input.maxOutputTokens,
    maxRetries: 0,
    abortSignal: AbortSignal.timeout(240000),
    providerOptions: manifest.providerOptions,
    experimental_telemetry: {
      isEnabled: true,
      functionId: 'codex-premise.' + input.stage,
      metadata: { bookId: 'dry-run', case: input.id },
    },
  };
}
async function stage(input) {
  return runtime.startActiveObservation('codex-premise.' + input.stage, async (span) => {
    active = { key: input.id + '-' + input.stage, requests: 0 };
    const record = {
      id: input.id,
      stage: input.stage,
      model: input.model,
      system: input.system,
      prompt: input.prompt,
      traceId: span.traceId,
      startedAt: new Date().toISOString(),
    };
    write(active.key + '.started.json', record);
    span.update({
      input: { system: input.system, prompt: input.prompt },
      metadata: { bookId: 'dry-run', ticket: 'STO-15', experiment: '2026-09-28-premise' },
    });
    try {
      const result = await runtime.generateObject(options(input));
      assert.equal(result.finishReason, 'stop', 'Incomplete result');
      const cost =
        (result.usage.inputTokens * rates[input.model] + result.usage.outputTokens * 10) / 1e6;
      assert.ok(Number.isFinite(cost), 'Missing usage; stop');
      spent += cost;
      const complete = {
        ...record,
        resolvedModel: result.response.modelId,
        responseId: result.response.id,
        finishReason: result.finishReason,
        usage: result.usage,
        result: result.object,
        estimatedUncachedCost: cost,
        finishedAt: new Date().toISOString(),
      };
      write(active.key + '.json', complete);
      span.update({ output: result.object });
      process.stdout.write(active.key + ': completed\n');
      return complete;
    } catch (error) {
      write(active.key + '.error.json', {
        ...record,
        name: error.name,
        usage: error.usage,
        text: error.text,
        response: error.response,
      });
      throw error;
    }
  });
}
async function generate() {
  assert.ok(!fs.existsSync(path.join(out, 'run-started.json')), 'Run already attempted; no repeat');
  await preflight();
  write('run-started.json', {
    startedAt: new Date().toISOString(),
    budget: LIMIT,
    gitSha: require('node:child_process')
      .execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' })
      .trim(),
  });
  const { WholeStorySchema, wholeText } = req('./src/ai/schemas/whole-story.schema.ts');
  const { StorySafetySchema } = req('./src/ai/schemas/story-safety.schema.ts');
  const { STORY_SAFETY_SYSTEM, buildStorySafetyPrompt } = req(
    './src/ai/prompts/story-safety.prompt.ts',
  );
  const { runTextGates } = req('./src/ai/validators/whole-story.gates.ts');
  const results = [];
  for (const c of manifest.cases) {
    const authored = await stage({
      ...c,
      stage: 'author',
      model: manifest.authorModel,
      schema: WholeStorySchema,
      maxOutputTokens: 10000,
    });
    const story = authored.result;
    const text = wholeText(story);
    const gates = runTextGates({
      title: story.title,
      text,
      ageBand: c.ageBand,
      goalTitle: c.goalTitle,
    });
    const safety = await stage({
      id: c.id,
      stage: 'safety',
      model: manifest.safetyModel,
      schema: StorySafetySchema,
      maxOutputTokens: 2000,
      system: STORY_SAFETY_SYSTEM,
      prompt: buildStorySafetyPrompt({ title: story.title, text, ageBand: c.ageBand }),
    });
    results.push({ id: c.id, goalTitle: c.goalTitle, authored, gates, safety });
    write('results.json', results);
  }
  write('usage-summary.json', { calls: 8, estimatedUncachedCost: spent });
}
async function verify() {
  const results = read('results.json');
  const traces = [];
  for (const r of results.flatMap((item) => [item.authored, item.safety])) {
    const response = await traceFetch('/api/public/traces/' + r.traceId);
    const body = response.ok ? await response.json() : {};
    traces.push({
      id: r.id,
      stage: r.stage,
      traceId: r.traceId,
      status: response.status,
      totalCost: body.totalCost,
      observations: (body.observations || []).map((o) => ({
        type: o.type,
        model: o.model,
        usage: o.usage,
        calculatedTotalCost: o.calculatedTotalCost,
      })),
    });
  }
  write('trace-verification.json', traces);
  assert.ok(
    traces.every(
      (t) =>
        t.status === 200 &&
        t.observations.some((o) => o.type === 'GENERATION' && o.model && o.usage),
    ),
    'Trace verification incomplete',
  );
  process.stdout.write(
    'Verified ' +
      traces.length +
      ' traces; cost ' +
      traces.reduce((sum, t) => sum + (t.totalCost || 0), 0) +
      '\n',
  );
}
function selfTest() {
  validateConditions(manifest);
  const mutate = (field) => ({
    ...manifest,
    cases: manifest.cases.map((c, i) => (i === 1 ? { ...c, [field]: c[field] + ' changed' } : c)),
  });
  assert.throws(() => validateConditions(mutate('system')));
  assert.throws(() => validateConditions(mutate('prompt')));
  assert.throws(() => validateConditions({ ...manifest, cases: manifest.cases.slice(1) }));
  const body = { model: manifest.authorModel, max_output_tokens: 10000, input: 'Привет' };
  assert.ok(budgetGuard(body, 0).upper > 0.1);
  assert.throws(() => budgetGuard(body, 0.69));
  assert.throws(() => budgetGuard({ ...body, model: 'wrong' }, 0));
  assert.throws(() => budgetGuard({ ...body, max_output_tokens: 10001 }, 0));
  assert.throws(() => budgetGuard({ ...body, input: 'x'.repeat(500000) }, 0));
  prepare();
  process.stdout.write('Offline preflight tests passed; no API setup\n');
}
async function main() {
  if (process.argv.includes('--self-test')) return selfTest();
  prepare();
  if (process.argv.includes('--prepare'))
    return process.stdout.write('Prepared; zero network calls\n');
  runtime = setup();
  try {
    if (process.argv.includes('--verify')) await verify();
    else await generate();
  } finally {
    await runtime.shutdownTelemetry();
  }
}
main().catch((error) => {
  process.stderr.write('Stopped: ' + error.name + ' ' + String(error.message).slice(0, 100) + '\n');
  process.exitCode = 1;
});
