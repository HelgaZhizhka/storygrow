/**
 * Spike (not wired into the app): evaluate Google Gemini 2.5 Flash Image for
 * CHARACTER CONSISTENCY via a reference portrait.
 *
 * Flow: generate one reference portrait from a character description, then
 * generate 3 scenes that PASS THE PORTRAIT BACK as a reference image — so we can
 * eyeball whether the same child appears across scenes (the consistency win over
 * our current text-only `characterProfile` approach).
 *
 * Run: pnpm --filter backend exec dotenv -e .env -- tsx src/scripts/spike-gemini-consistency.ts
 * Requires GOOGLE_GENERATIVE_AI_API_KEY (a Gemini API key from Google AI Studio —
 * NOT the GOOGLE_CLIENT_ID/SECRET used for OAuth).
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { generateText } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';

const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
if (!apiKey) {
  console.error('Missing GOOGLE_GENERATIVE_AI_API_KEY (Gemini API key from Google AI Studio).');
  process.exit(1);
}

const google = createGoogleGenerativeAI({ apiKey });
// If this 404s, the GA id may differ — try 'gemini-2.5-flash-image-preview'.
const MODEL = 'gemini-2.5-flash-image';
const OUT_DIR = resolve(__dirname, '../../spike-gemini');

const CHARACTER =
  'a cheerful 5-year-old girl named Masha: curly red hair, green eyes, light freckles, a green dress and yellow sneakers';
const STYLE = 'soft watercolor children-book illustration, warm and gentle';
const SCENES = [
  'playing with a friendly little fox in a sunny green park',
  'reading a picture book under a big oak tree',
  'falling asleep in a cosy bed hugging a teddy bear',
];

type GenResult = Awaited<ReturnType<typeof generateText>>;

function firstImage(result: GenResult, label: string): Uint8Array {
  const file = result.files.find((f) => f.mediaType.startsWith('image/'));
  if (!file) {
    throw new Error(`${label}: no image returned. Model text: ${result.text || '(none)'}`);
  }
  return file.uint8Array;
}

async function scene(portrait: Uint8Array, index: number): Promise<void> {
  process.stdout.write(`scene ${index + 1}… `);
  const result = await generateText({
    model: google(MODEL),
    prompt: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Keep this exact child — same face, hair, freckles and outfit. New scene: the same girl ${SCENES[index]}. ${STYLE}.`,
          },
          { type: 'file', data: portrait, mediaType: 'image/png' },
        ],
      },
    ],
  });
  await writeFile(
    resolve(OUT_DIR, `scene-${index + 1}.png`),
    firstImage(result, `scene-${index + 1}`),
  );
  process.stdout.write('saved\n');
}

async function main(): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });

  process.stdout.write('portrait… ');
  const portraitResult = await generateText({
    model: google(MODEL),
    prompt: `Full-body portrait of ${CHARACTER}. ${STYLE}. Plain neutral background.`,
  });
  const portrait = firstImage(portraitResult, 'portrait');
  await writeFile(resolve(OUT_DIR, 'portrait.png'), portrait);
  process.stdout.write('saved\n');

  for (let i = 0; i < SCENES.length; i += 1) {
    await scene(portrait, i);
  }

  process.stdout.write(`\nDone → ${OUT_DIR}\n`);
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
