/**
 * One-off: generate a style-preview thumbnail for each art style, using the SAME
 * pipeline as real books (gpt-image-1 + STYLE_SUFFIXES). The preview therefore
 * shows exactly what that style produces. Saved to frontend/public/styles/.
 *
 * Usage: pnpm --filter backend exec dotenv -e .env -- tsx src/scripts/gen-style-previews.ts
 */
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { generateImage } from 'ai';
import { openai } from '@ai-sdk/openai';
import { IMAGE_MODEL, STYLE_SUFFIXES, type ArtStyle } from '../ai/ai.config';

const SCENE = 'A cheerful young child playing with a friendly little fox in a sunny green park';
const OUT_DIR = resolve(import.meta.dirname, '../../../frontend/public/styles');

const STYLES: ArtStyle[] = ['watercolor', 'cartoon', 'storybook', 'pixel', 'realistic'];

const main = async (): Promise<void> => {
  for (const style of STYLES) {
    const prompt = `${SCENE}${STYLE_SUFFIXES[style]}`;
    process.stdout.write(`generating ${style}… `);
    const { image } = await generateImage({
      model: openai.imageModel(IMAGE_MODEL),
      prompt,
      size: '1024x1024',
      providerOptions: { openai: { quality: 'low' } },
    });
    const path = resolve(OUT_DIR, `${style}.png`);
    await writeFile(path, Buffer.from(image.base64, 'base64'));
    process.stdout.write(`saved ${path}\n`);
  }
};

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
