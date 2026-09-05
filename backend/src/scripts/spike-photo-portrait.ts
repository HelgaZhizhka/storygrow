/**
 * Spike (not wired into the app): Gemini "photo -> recognisable stylised child".
 * Issue #128 bake-off, Gemini side — the only provider we intend to ship (same
 * provider as prod, so no cross-border minor-biometric question; Qwen parked).
 *
 * Per input photo:
 *   0. photo -> compact FACE DESCRIPTOR (one vision call) -> descriptor.txt
 *      Named features anchor identity far better than an abstract "this child".
 *   1. photo (+ descriptor) -> stylised full-body portrait   (aspect 2:3)
 *   2. portrait (+ descriptor) -> 3 scenes                    (aspect 1:1)
 * Then eyeball, per photo, whether it still reads as the SAME child.
 *
 * Input:  drop 3-4 frontal child photos into  backend/spike-photos/  (consented only).
 * Output: backend/spike-photo-out/<name>/{descriptor.txt,portrait,scene-1..3}.png
 *
 * Run: pnpm --filter backend exec dotenv -e .env -- tsx src/scripts/spike-photo-portrait.ts
 * Env:
 *   GOOGLE_GENERATIVE_AI_API_KEY  (required) — Gemini key from Google AI Studio.
 *   GEMINI_MODEL         image model, default 'gemini-2.5-flash-image' (Nano Banana);
 *                        set 'gemini-3-pro-image' (Nano Banana Pro) for stronger likeness.
 *   GEMINI_VISION_MODEL  descriptor model, default 'gemini-3.6-flash'.
 */
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { generateImage, generateText } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';

const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
if (!apiKey) {
  console.error('Missing GOOGLE_GENERATIVE_AI_API_KEY (Gemini key from Google AI Studio).');
  process.exit(1);
}

const google = createGoogleGenerativeAI({ apiKey });
const IMAGE_MODEL = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash-image';
const VISION_MODEL = process.env.GEMINI_VISION_MODEL ?? 'gemini-3.6-flash';
const IN_DIR = resolve(__dirname, '../../spike-photos');
// Per-model output dir so Flash and Pro runs coexist for side-by-side comparison.
const OUT_ROOT = resolve(__dirname, `../../spike-photo-out/${IMAGE_MODEL}`);
const STYLE = 'soft watercolour children-book illustration, warm and gentle';
const SCENES = [
  'playing with a friendly little fox in a sunny green park',
  'reading a picture book under a big oak tree',
  'falling asleep in a cosy bed hugging a teddy bear',
];
const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const DESCRIPTOR_TASK =
  "Describe ONLY this child's physical facial features for an illustrator, in one compact line: " +
  'apparent age, gender, face shape, eye shape and colour, hair colour and style, skin tone, ' +
  'freckles or distinctive marks. No clothing, no background, no name, no story.';

type AspectRatio = '1:1' | '2:3' | '3:2';

function mediaType(file: string): string {
  const ext = extname(file).toLowerCase();
  return ext === '.jpg' ? 'image/jpeg' : `image/${ext.slice(1)}`;
}

async function describe(photo: Uint8Array, mime: string): Promise<string> {
  const result = await generateText({
    model: google(VISION_MODEL),
    prompt: [
      {
        role: 'user',
        content: [
          { type: 'text', text: DESCRIPTOR_TASK },
          { type: 'file', data: photo, mediaType: mime },
        ],
      },
    ],
  });
  return result.text.trim();
}

async function render(input: {
  reference: Uint8Array;
  text: string;
  aspectRatio: AspectRatio;
}): Promise<Uint8Array> {
  const result = await generateImage({
    model: google.image(IMAGE_MODEL),
    prompt: { text: input.text, images: [input.reference] },
    aspectRatio: input.aspectRatio,
  });
  return result.image.uint8Array;
}

async function processPhoto(file: string): Promise<void> {
  const name = file.replace(extname(file), '');
  const outDir = resolve(OUT_ROOT, name);
  await mkdir(outDir, { recursive: true });
  const mime = mediaType(file);
  const photo = new Uint8Array(await readFile(resolve(IN_DIR, file)));

  process.stdout.write(`\n[${name}] descriptor… `);
  const descriptor = await describe(photo, mime);
  await writeFile(resolve(outDir, 'descriptor.txt'), descriptor);
  process.stdout.write(descriptor);

  process.stdout.write(`\n[${name}] portrait… `);
  const portrait = await render({
    reference: photo,
    text:
      `Full-body character portrait of this child: ${descriptor}. ` +
      `Redraw as ${STYLE}, preserving those exact features. ` +
      `Centered, clearly visible, plain neutral background.`,
    aspectRatio: '2:3',
  });
  await writeFile(resolve(outDir, 'portrait.png'), portrait);
  process.stdout.write('saved');

  for (let i = 0; i < SCENES.length; i += 1) {
    process.stdout.write(`\n[${name}] scene ${i + 1}… `);
    const scene = await render({
      reference: portrait,
      text:
        `Keep this exact child — same face, hair and outfit (${descriptor}) — ` +
        `now in a new scene: the same child ${SCENES[i]}. ${STYLE}.`,
      aspectRatio: '1:1',
    });
    await writeFile(resolve(outDir, `scene-${i + 1}.png`), scene);
    process.stdout.write('saved');
  }
}

async function main(): Promise<void> {
  const entries = await readdir(IN_DIR).catch(() => {
    throw new Error(`Put 3-4 frontal child photos in ${IN_DIR} first.`);
  });
  const photos = entries.filter((f) => IMAGE_EXT.has(extname(f).toLowerCase()));
  if (photos.length === 0) throw new Error(`No images (${[...IMAGE_EXT].join('/')}) in ${IN_DIR}.`);

  console.log(`Found ${photos.length} photo(s). Image: ${IMAGE_MODEL}, vision: ${VISION_MODEL}`);
  for (const file of photos) {
    await processPhoto(file);
  }
  console.log(`\n\nDone → ${OUT_ROOT}`);
}

main().catch((e: unknown) => {
  console.error('\n', e);
  process.exit(1);
});
