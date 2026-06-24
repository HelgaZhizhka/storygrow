/**
 * Spike check: confirm the UNIFORM path — generateImage() + google.image() with
 * aspectRatio + a reference image (prompt.images) — works for gemini-2.5-flash-image.
 * If it does, the real provider can share the same generateImage shape as OpenAI.
 *
 * Run: pnpm --filter backend exec dotenv -e .env -- tsx src/scripts/spike-gemini-generateimage.ts
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { generateImage } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';

const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
if (!apiKey) {
  console.error('Missing GOOGLE_GENERATIVE_AI_API_KEY');
  process.exit(1);
}

const google = createGoogleGenerativeAI({ apiKey });
const MODEL = 'gemini-2.5-flash-image';
const OUT_DIR = resolve(__dirname, '../../spike-gemini-gi');

const CHARACTER =
  'a cheerful 5-year-old girl named Masha: curly red hair, green eyes, light freckles, a green dress and yellow sneakers';
const STYLE = 'soft watercolor children-book illustration, warm and gentle';

async function main(): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });

  process.stdout.write('portrait (generateImage, aspectRatio 2:3)… ');
  const portrait = await generateImage({
    model: google.image(MODEL),
    prompt: `Full-body portrait of ${CHARACTER}. ${STYLE}. Plain neutral background.`,
    aspectRatio: '2:3',
  });
  await writeFile(resolve(OUT_DIR, 'portrait.png'), portrait.image.uint8Array);
  process.stdout.write('saved\n');

  process.stdout.write('scene (reference image + aspectRatio 1:1)… ');
  const scene = await generateImage({
    model: google.image(MODEL),
    prompt: {
      text: `Keep this exact child — same face, hair, freckles and outfit. New scene: the same girl playing with a friendly little fox in a sunny green park. ${STYLE}.`,
      images: [portrait.image.uint8Array],
    },
    aspectRatio: '1:1',
  });
  await writeFile(resolve(OUT_DIR, 'scene-1.png'), scene.image.uint8Array);
  process.stdout.write('saved\n');

  process.stdout.write(`\nDone → ${OUT_DIR}\n`);
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
