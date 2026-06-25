import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import puppeteer, { type Browser } from 'puppeteer';
import { type Story } from '../ai/schemas';
import {
  PAGE_TEMPLATES,
  TEMPLATE_NAMES,
  type TemplateName,
} from './page-templates/page-templates.config';
import { S3Service } from '../s3/s3.service';

const TEMPLATES_DIR = join(__dirname, 'page-templates');
const A5_WIDTH_PX = 874;
const A5_HEIGHT_PX = 1240;

export interface RenderInput {
  bookId: string;
  story: Story;
  illustrationUrls: readonly string[];
}

@Injectable()
export class PdfRenderService implements OnModuleInit {
  private readonly logger = new Logger(PdfRenderService.name);
  private templates!: Readonly<Record<TemplateName, string>>;
  private fontFaceCss!: string;

  constructor(private readonly s3: S3Service) {}

  onModuleInit(): void {
    const entries = TEMPLATE_NAMES.map((name) => {
      const file = PAGE_TEMPLATES[name].htmlFile;
      return [name, readFileSync(join(TEMPLATES_DIR, file), 'utf-8')] as const;
    });
    this.templates = Object.fromEntries(entries) as Record<TemplateName, string>;
    // Self-hosted Cyrillic book fonts, base64-inlined — embedded once so Puppeteer
    // renders with no network font fetch. A missing file fails fast here.
    this.fontFaceCss = readFileSync(join(TEMPLATES_DIR, 'fonts.css'), 'utf-8');
  }

  async render(input: RenderInput): Promise<string> {
    if (input.illustrationUrls.length !== input.story.pages.length) {
      throw new Error(
        `Illustration count (${input.illustrationUrls.length}) does not match page count (${input.story.pages.length})`,
      );
    }

    const html = this.buildDocument(input);
    const pdf = await this.renderToBuffer(html);

    const key = `books/${input.bookId}/book.pdf`;
    await this.s3.uploadObject({ key, body: pdf, contentType: 'application/pdf' });
    this.logger.log(`Rendered PDF for book ${input.bookId} (${pdf.length} bytes)`);
    return key;
  }

  private buildDocument(input: RenderInput): string {
    const pageSections = input.story.pages.map((page, index) =>
      this.renderPage({
        template: page.template,
        text: page.text ?? '',
        title: page.title ?? input.story.title,
        illustrationUrl: input.illustrationUrls[index] ?? '',
        illustrationPrompt: page.illustrationPrompt,
        discussionQuestions: page.template === 'final' ? input.story.discussionQuestions : [],
      }),
    );

    return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(input.story.title)}</title>
<style>
${this.fontFaceCss}
  @page { size: ${A5_WIDTH_PX}px ${A5_HEIGHT_PX}px; margin: 0; }
  html, body { margin: 0; padding: 0; font-family: 'Literata', Georgia, serif; }
  .page { page-break-after: always; break-after: page; }
  .page:last-child { page-break-after: auto; break-after: auto; }
</style>
</head>
<body>
${pageSections.join('\n')}
</body>
</html>`;
  }

  private renderPage(ctx: {
    template: TemplateName;
    text: string;
    title: string;
    illustrationUrl: string;
    illustrationPrompt: string;
    discussionQuestions: readonly string[];
  }): string {
    const template = this.templates[ctx.template];
    const questionsHtml = ctx.discussionQuestions
      .map((q) => `<li>${escapeHtml(q)}</li>`)
      .join('\n');
    return template
      .replaceAll('{{title}}', escapeHtml(ctx.title))
      .replaceAll('{{text}}', escapeHtml(ctx.text))
      .replaceAll('{{illustrationUrl}}', escapeAttribute(safeImageUrl(ctx.illustrationUrl)))
      .replaceAll('{{illustrationPrompt}}', escapeAttribute(ctx.illustrationPrompt))
      .replaceAll('{{discussionQuestionsHtml}}', questionsHtml);
  }

  private async renderToBuffer(html: string): Promise<Buffer> {
    const noSandbox = process.env['PUPPETEER_NO_SANDBOX'] === 'true';
    const args = noSandbox ? ['--no-sandbox', '--disable-setuid-sandbox'] : [];
    const browser: Browser = await puppeteer.launch({ headless: true, args });
    try {
      const page = await browser.newPage();
      await page.setViewport({ width: A5_WIDTH_PX, height: A5_HEIGHT_PX });
      // 'networkidle0' isn't in the typed union in puppeteer v25 but is valid at runtime.
      // Critical for waiting on remote S3-signed-URL images before PDF capture.
      await page.setContent(html, { waitUntil: 'networkidle0' as 'load' });
      const pdf = await page.pdf({
        width: `${A5_WIDTH_PX}px`,
        height: `${A5_HEIGHT_PX}px`,
        printBackground: true,
        preferCSSPageSize: true,
      });
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapeAttribute(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function safeImageUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  // Reject javascript:, data:, file:, etc. — defensive against future bugs that
  // could land attacker-controlled strings in the illustrationUrl slot.
  return '';
}
