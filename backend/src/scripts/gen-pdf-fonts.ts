/**
 * One-off: build a self-contained @font-face CSS (base64-inlined woff2) for the
 * PDF book fonts — Comfortaa (headings) + Literata (body) — so Puppeteer renders
 * Cyrillic with no network fetch. Writes page-templates/fonts.css.
 *
 * Run: pnpm --filter backend exec tsx src/scripts/gen-pdf-fonts.ts
 */
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const CSS_URL =
  'https://fonts.googleapis.com/css2?family=Comfortaa:wght@500;700&family=Literata:wght@400;600&display=swap';
// Google Fonts serves woff2 (not ttf) only to browser-like UAs.
const UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const OUT = resolve(__dirname, '../pdf/page-templates/fonts.css');

const main = async (): Promise<void> => {
  const css = await fetch(CSS_URL, { headers: { 'User-Agent': UA } }).then((r) => r.text());
  const urls = [...css.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.woff2)\)/g)].map(
    (m) => m[1],
  );
  let out = css;
  for (const url of urls) {
    const ab = await fetch(url).then((r) => r.arrayBuffer());
    const buf = Buffer.from(new Uint8Array(ab));
    out = out.replace(url, `data:font/woff2;base64,${buf.toString('base64')}`);
  }
  await writeFile(OUT, out, 'utf-8');
  process.stdout.write(`wrote ${OUT} — ${urls.length} woff2 inlined\n`);
};

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
