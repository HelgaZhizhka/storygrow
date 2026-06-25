import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = join(__dirname, 'page-templates');
const NAMES = ['cover', 'image-top', 'image-bottom', 'image-left', 'text-focus', 'final'];

describe.each(NAMES)('template %s', (name) => {
  const html = readFileSync(join(DIR, `${name}.html`), 'utf-8');

  it('has no remote font import', () => {
    expect(html).not.toContain('@import');
    expect(html).not.toContain('fonts.googleapis.com');
  });

  it('uses only the Cyrillic book fonts', () => {
    expect(html).not.toContain('Bricolage Grotesque');
    expect(html).not.toContain('Outfit');
    expect(/font-family:\s*'(Comfortaa|Literata)'/.test(html)).toBe(true);
  });
});
