/**
 * eval:images-report (#348, PR 3) — build a single self-contained HTML that lays
 * the rendered variants side by side (one row per fixture page, one column per
 * variant) so the Visual Bible image comparison can be scored by eye against the
 * manual rubric. Reads whatever variants are present under output/eval-images/.
 *
 * Usage:
 *   pnpm --filter backend eval:images-report [--root=output/eval-images] [--out=path.html]
 * Then open the HTML (images are embedded as data URIs, so it is portable).
 */
import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import sharp from 'sharp';
import { join } from 'node:path';
import { IMAGE_VARIANTS } from './lib/eval-images-lib';

const flag = (name: string): string | undefined =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);

const THUMB_WIDTH = 320;

const RUBRIC = [
  'heroConsistency — same child on every page',
  'heroOnce — no page with a duplicated hero',
  'castConsistency — recurring characters keep their look',
  'locationConsistency — the same place looks the same',
  'pageMatch — the picture matches the page text',
  'artefacts — extra limbs, merged faces, text in image',
  'styleUnity — one style across the book',
];

const dirs = (path: string): string[] =>
  existsSync(path) ? readdirSync(path).filter((d) => statSync(join(path, d)).isDirectory()) : [];

const thumbUri = async (file: string): Promise<string> => {
  const buf = await sharp(readFileSync(file))
    .resize({ width: THUMB_WIDTH })
    .jpeg({ quality: 72 })
    .toBuffer();
  return `data:image/jpeg;base64,${buf.toString('base64')}`;
};

const esc = (s: string): string =>
  s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c] ?? c);

interface Cell {
  variant: string;
  src: string | null;
}

const buildRows = async (root: string, variants: string[], fixture: string): Promise<Cell[][]> => {
  const pageCount = Math.max(
    0,
    ...variants.map((v) =>
      dirs(join(root, v)).includes(fixture)
        ? readdirSync(join(root, v, fixture)).filter((f) => f.endsWith('.png')).length
        : 0,
    ),
  );
  const rows: Cell[][] = [];
  for (let i = 1; i <= pageCount; i++) {
    const cells = await Promise.all(
      variants.map(async (v) => {
        const file = join(root, v, fixture, `page-${i}.png`);
        return { variant: v, src: existsSync(file) ? await thumbUri(file) : null };
      }),
    );
    rows.push(cells);
  }
  return rows;
};

const renderFixture = async (
  root: string,
  variants: string[],
  fixture: string,
): Promise<string> => {
  const rows = await buildRows(root, variants, fixture);
  const head = `<tr><th>page</th>${variants.map((v) => `<th>${esc(v)}</th>`).join('')}</tr>`;
  const body = rows
    .map(
      (cells, i) =>
        `<tr><td>${i + 1}</td>${cells
          .map((c) => `<td>${c.src ? `<img src="${c.src}">` : '—'}</td>`)
          .join('')}</tr>`,
    )
    .join('');
  return `<h2>${esc(fixture)}</h2><table>${head}${body}</table>`;
};

const main = async (): Promise<void> => {
  const root = flag('root') ?? 'output/eval-images';
  const out = flag('out') ?? join(root, 'comparison.html');
  const variants = IMAGE_VARIANTS.filter((v) => existsSync(join(root, v)));
  if (variants.length === 0) {
    console.error(`No variant folders under ${root}. Run eval:images first.`);
    process.exit(1);
  }
  const fixtures = [...new Set(variants.flatMap((v) => dirs(join(root, v))))].sort();

  const rubric = `<ul>${RUBRIC.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>`;
  const sections = (
    await Promise.all(fixtures.map((f) => renderFixture(root, [...variants], f)))
  ).join('\n');
  const html = `<!doctype html><meta charset="utf-8"><title>Visual Bible image comparison</title>
<style>
  body { font: 14px system-ui, sans-serif; margin: 24px; color: #1a1a1a; }
  table { border-collapse: collapse; margin-bottom: 32px; }
  th, td { border: 1px solid #ddd; padding: 6px; vertical-align: top; text-align: center; }
  img { width: 260px; height: auto; display: block; }
  h2 { margin-top: 40px; }
  .rubric { background: #f6f6f6; padding: 12px 20px; border-radius: 8px; }
</style>
<h1>Visual Bible image comparison</h1>
<p>Variants: ${variants.map(esc).join(', ')} · fixtures: ${fixtures.length}</p>
<div class="rubric"><b>Score each fixture × variant (1–5):</b>${rubric}</div>
${sections}`;
  writeFileSync(out, html);
  console.log(
    `Comparison written: ${out} (${variants.length} variants, ${fixtures.length} fixtures)`,
  );
};

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
