/**
 * Spike (not wired into the app): the Qwen side of the issue #128 bake-off.
 * Same flow as spike-photo-portrait.ts (Gemini) so results compare directly —
 * run both, then eyeball spike-photo-out/ vs spike-photo-out-qwen/ per photo.
 *
 * Model: Alibaba Qwen-Image-Edit via DashScope multimodal-generation (synchronous,
 * base64 input — the child photo is NOT uploaded to any public URL).
 * Flow per input photo:
 *   1. photo    -> stylised portrait (edit instruction: keep the child, re-render in style)
 *   2. portrait -> 3 scenes (portrait fed back as the edit input, as in the Gemini spike)
 *
 * Input:  backend/spike-photos/  (same photos as the Gemini spike)
 * Output: backend/spike-photo-out-qwen/<photo-name>/{portrait,scene-1..3}.png
 *
 * Run: DASHSCOPE_API_KEY=... pnpm --filter backend exec tsx src/scripts/spike-photo-portrait-qwen.ts
 * Env:
 *   DASHSCOPE_API_KEY  (required) — Model Studio key; Singapore & Beijing keys are NOT interchangeable.
 *   QWEN_BASE_URL      default international endpoint below; for a workspace-scoped
 *                      endpoint use https://<WorkspaceId>.ap-southeast-1.maas.aliyuncs.com/...
 *   QWEN_MODEL         default 'qwen-image-edit'; if it 400s on the model id, try
 *                      'qwen-image-edit-plus' or the id shown in your Model Studio console.
 */
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';

const apiKey = process.env.DASHSCOPE_API_KEY;
if (!apiKey) {
  console.error('Missing DASHSCOPE_API_KEY (Alibaba Model Studio / DashScope key).');
  process.exit(1);
}

const BASE_URL =
  process.env.QWEN_BASE_URL ??
  'https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation';
const MODEL = process.env.QWEN_MODEL ?? 'qwen-image-edit';
const IN_DIR = resolve(__dirname, '../../spike-photos');
const OUT_ROOT = resolve(__dirname, '../../spike-photo-out-qwen');
const STYLE = 'soft watercolour children-book illustration, warm and gentle';
const SCENES = [
  'playing with a friendly little fox in a sunny green park',
  'reading a picture book under a big oak tree',
  'falling asleep in a cosy bed hugging a teddy bear',
];
const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp']);

function mimeType(file: string): string {
  const ext = extname(file).toLowerCase();
  return ext === '.jpg' ? 'image/jpeg' : `image/${ext.slice(1)}`;
}

function toDataUri(bytes: Buffer, mime: string): string {
  return `data:${mime};base64,${bytes.toString('base64')}`;
}

function extractImage(json: unknown, label: string): string {
  const content = (json as { output?: { choices?: Array<{ message?: { content?: unknown } }> } })
    ?.output?.choices?.[0]?.message?.content;
  if (Array.isArray(content)) {
    for (const part of content) {
      if (
        part &&
        typeof part === 'object' &&
        typeof (part as { image?: unknown }).image === 'string'
      ) {
        return (part as { image: string }).image;
      }
    }
  }
  throw new Error(`${label}: no image in response → ${JSON.stringify(json).slice(0, 600)}`);
}

async function toBytes(image: string): Promise<Buffer> {
  if (image.startsWith('data:')) {
    return Buffer.from(image.slice(image.indexOf(',') + 1), 'base64');
  }
  const res = await fetch(image);
  if (!res.ok) throw new Error(`download failed ${res.status} for ${image.slice(0, 80)}`);
  return Buffer.from(await res.arrayBuffer());
}

async function edit(input: {
  imageDataUri: string;
  instruction: string;
  size: string;
  label: string;
}): Promise<Buffer> {
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: MODEL,
      input: {
        messages: [
          {
            role: 'user',
            content: [{ image: input.imageDataUri }, { text: input.instruction }],
          },
        ],
      },
      parameters: {
        n: 1,
        watermark: false,
        negative_prompt: 'low quality, deformed',
        size: input.size,
      },
    }),
  });
  const json: unknown = await res.json();
  if (!res.ok)
    throw new Error(`${input.label}: HTTP ${res.status} → ${JSON.stringify(json).slice(0, 600)}`);
  return toBytes(extractImage(json, input.label));
}

async function processPhoto(file: string): Promise<void> {
  const name = file.replace(extname(file), '');
  const outDir = resolve(OUT_ROOT, name);
  await mkdir(outDir, { recursive: true });
  const photoUri = toDataUri(await readFile(resolve(IN_DIR, file)), mimeType(file));

  process.stdout.write(`\n[${name}] portrait… `);
  const portrait = await edit({
    imageDataUri: photoUri,
    instruction:
      `Redraw this child as a full-body ${STYLE} character. Keep the SAME child — ` +
      `same face shape, hair colour and style, eye colour, skin tone and any freckles — ` +
      `re-rendered in the illustration style. Centered, plain neutral background.`,
    size: '1024*1536',
    label: `${name}/portrait`,
  });
  await writeFile(resolve(outDir, 'portrait.png'), portrait);
  process.stdout.write('saved');

  const portraitUri = toDataUri(portrait, 'image/png');
  for (let i = 0; i < SCENES.length; i += 1) {
    process.stdout.write(`\n[${name}] scene ${i + 1}… `);
    const scene = await edit({
      imageDataUri: portraitUri,
      instruction: `Keep this exact child — same face, hair, and outfit — now ${SCENES[i]}. ${STYLE}.`,
      size: '1024*1024',
      label: `${name}/scene-${i + 1}`,
    });
    await writeFile(resolve(outDir, `scene-${i + 1}.png`), scene);
    process.stdout.write('saved');
  }
}

async function main(): Promise<void> {
  const entries = await readdir(IN_DIR).catch(() => {
    throw new Error(`Put the same photos used for the Gemini spike in ${IN_DIR} first.`);
  });
  const photos = entries.filter((f) => IMAGE_EXT.has(extname(f).toLowerCase()));
  if (photos.length === 0) throw new Error(`No images (${[...IMAGE_EXT].join('/')}) in ${IN_DIR}.`);

  console.log(`Found ${photos.length} photo(s). Model: ${MODEL} @ ${BASE_URL}`);
  for (const file of photos) {
    await processPhoto(file);
  }
  console.log(`\n\nDone → ${OUT_ROOT}\n(compare with the Gemini spike output in spike-photo-out/)`);
}

main().catch((e: unknown) => {
  console.error('\n', e);
  process.exit(1);
});
