/**
 * One-off: generate a style-preview thumbnail for each art style through the SAME
 * provider that renders books — xAI Grok (ADR-0007) — so what a parent picks
 * matches what the book will look like (#392). Saved to frontend/public/styles/.
 *
 * Usage: pnpm --filter backend exec dotenv -e .env -- tsx src/scripts/gen-style-previews.ts
 */
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { STYLE_SUFFIXES, type ArtStyle } from '../ai/ai.config';
import { XaiImageProvider } from '../ai/image-generator/providers/xai-image.provider';

const SCENE = 'A cheerful young child playing with a friendly little fox in a sunny green park';
// __dirname (CommonJS) — the backend compiles to CJS, so import.meta is unavailable here.
const OUT_DIR = resolve(__dirname, '../../../frontend/public/styles');

const STYLES: ArtStyle[] = ['watercolor', 'cartoon', 'storybook', 'pixel', 'realistic'];

const main = async (): Promise<void> => {
  const apiKey = process.env['XAI_API_KEY'];
  if (!apiKey) throw new Error('XAI_API_KEY is required to render the style previews on Grok');
  const provider = new XaiImageProvider(apiKey);

  for (const style of STYLES) {
    // The style suffix leads with ", " so the scene reads as one phrase; the book
    // pipeline strips that comma in illustration.prompt, here the scene is a full clause.
    const prompt = `${SCENE}${STYLE_SUFFIXES[style]}`;
    process.stdout.write(`generating ${style}… `);
    const bytes = await provider.generatePage({ prompt, imageSize: '1024x1024', references: [] });
    const path = resolve(OUT_DIR, `${style}.png`);
    await writeFile(path, Buffer.from(bytes));
    process.stdout.write(`saved ${path}\n`);
  }
};

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
