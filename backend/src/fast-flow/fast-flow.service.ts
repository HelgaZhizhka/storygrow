import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PdfRenderService } from '../pdf/pdf-render.service';
import { templateContentSchema, type TemplatePage } from './template-content.schema';
import { substitutePlaceholders, type SubstitutionContext } from './substitute-placeholders';
import { pickIllustration, type IllustrationRecord } from './pick-illustration';
import type { Page } from '../ai/schemas/story.schema';
import type { Story } from '../ai/schemas';
import type { TemplateName } from '../pdf/page-templates/page-templates.config';

export interface FastFlowInput {
  userId: string;
  childId: string;
  learningGoalId: string;
}

export interface FastFlowResult {
  bookId: string;
  pdfKey: string;
}

const CONTENT_TEMPLATES: readonly TemplateName[] = ['image-top', 'image-bottom', 'image-left'];

@Injectable()
export class FastFlowService {
  private readonly logger = new Logger(FastFlowService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pdfRender: PdfRenderService,
  ) {}

  async generate(input: FastFlowInput): Promise<FastFlowResult> {
    const child = await this.prisma.child.findUnique({ where: { id: input.childId } });
    if (!child) throw new NotFoundException(`Child ${input.childId} not found`);

    const template = await this.prisma.template.findFirst({
      where: { learningGoalId: input.learningGoalId },
    });
    if (!template) {
      throw new NotFoundException(`No template for learning goal ${input.learningGoalId}`);
    }

    const ctx: SubstitutionContext = { childName: child.name, childAge: child.age };
    const title = substitutePlaceholders(template.title, ctx);
    const content = templateContentSchema.parse(template.content);
    const pages = content.pages.map((p) => ({ ...p, text: substitutePlaceholders(p.text, ctx) }));

    const rawIllustrations = await this.prisma.fastIllustration.findMany({
      select: { id: true, url: true, tags: true },
    });
    const illustrationUrls = buildIllustrationUrls(pages, rawIllustrations);

    const book = await this.prisma.book.create({
      data: {
        userId: input.userId,
        childId: input.childId,
        learningGoalId: input.learningGoalId,
        title,
        status: 'generating',
      },
      select: { id: true },
    });

    const story: Story = {
      title,
      discussionQuestions: generateDiscussionQuestions(child.name),
      pages: buildStoryPages(pages, title),
    };

    let pdfKey: string;
    try {
      pdfKey = await this.pdfRender.render({ bookId: book.id, story, illustrationUrls });
    } catch (err) {
      await this.prisma.book.update({ where: { id: book.id }, data: { status: 'failed' } });
      throw err;
    }

    await this.prisma.bookPage.createMany({
      data: pages.map((p, i) => ({
        bookId: book.id,
        pageNumber: p.pageNumber,
        text: p.text,
        imageUrl: illustrationUrls[i] ?? null,
      })),
    });

    await this.prisma.book.update({
      where: { id: book.id },
      data: { status: 'ready', pdfKey, storyJson: story },
    });

    this.logger.log(`Fast-flow book ${book.id} generated`);
    return { bookId: book.id, pdfKey };
  }
}

function buildStoryPages(pages: readonly TemplatePage[], title: string): Page[] {
  return pages.map((page, index) => {
    const isFirst = index === 0;
    const isLast = index === pages.length - 1;
    const template: TemplateName = isFirst
      ? 'cover'
      : isLast
        ? 'final'
        : CONTENT_TEMPLATES[(index - 1) % CONTENT_TEMPLATES.length];
    return {
      template,
      text: isFirst ? null : page.text,
      title: isFirst ? title : null,
      illustrationPrompt: `Children's book illustration: ${page.illustrationTag}`,
    };
  });
}

function buildIllustrationUrls(
  pages: readonly TemplatePage[],
  illustrations: IllustrationRecord[],
): readonly string[] {
  return pages.map((page) => pickIllustration(illustrations, [page.illustrationTag])?.url ?? '');
}

function generateDiscussionQuestions(childName: string): string[] {
  return [
    `Что произошло в этой истории?`,
    `Как ты думаешь, правильно ли поступил ${childName}? Почему?`,
    `А ты когда-нибудь попадал в похожую ситуацию?`,
    `Что бы ты сделал на месте ${childName}?`,
    `Чему нас учит эта история?`,
  ];
}
