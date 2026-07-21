import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PdfRenderService } from '../pdf/pdf-render.service';
import { GENERATION_MODEL } from '../ai/ai.config';
import { createTelemetry } from '../ai/telemetry';
import { StorySchema } from '../ai/schemas/story.schema';
import type { Story } from '../ai/schemas';
import { FAST_FLOW_SYSTEM_PROMPT, buildFastFlowPrompt } from './fast-flow.prompt';
import { resolveGender } from './substitute-placeholders';
import { pickIllustration, type IllustrationRecord } from './pick-illustration';

interface GenerationContext {
  child: { name: string; age: number; gender: string | null };
  template: { illustrationTags: string[] };
  goal: { title: string } | null;
}

// BooksService.deleteBook rejects deleting a 'generating' book, so this shouldn't
// happen via the app today — kept as defense against out-of-band deletion (manual
// DB/ops action) and future features (account/child deletion cascades onto Book)
// so that case degrades to a clean 404 instead of a raw Prisma error. P2025 = record
// not found (the final book.update), P2003 = FK violation (bookPage.createMany
// against a bookId that no longer exists).
const BOOK_MISSING_ERROR_CODES = new Set(['P2025', 'P2003']);

function isBookMissingError(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError && BOOK_MISSING_ERROR_CODES.has(err.code)
  );
}

export interface FastFlowInput {
  bookId: string;
  userId: string;
  childId: string;
  learningGoalId: string;
}

export interface FastFlowResult {
  bookId: string;
  pdfKey: string;
}

@Injectable()
export class FastFlowService {
  private readonly logger = new Logger(FastFlowService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pdfRender: PdfRenderService,
  ) {}

  /**
   * `input.bookId` is reserved by BooksService.reserveFastFlowBook before this
   * runs (#280) — quota was already atomically checked there, so this method
   * only ever updates that row, never creates its own. Any failure below marks
   * it 'failed' rather than leaving it stuck at 'generating'.
   */
  async generate(input: FastFlowInput): Promise<FastFlowResult> {
    const { bookId } = input;
    try {
      return await this.runGeneration(input);
    } catch (err) {
      if (isBookMissingError(err)) {
        this.logger.warn(`Book ${bookId} was deleted before generation finished — abandoning`);
        throw new NotFoundException(`Book ${bookId} no longer exists`);
      }

      // Never let a failure marking the book 'failed' hide the real error — log
      // it (unless the book was deleted concurrently, which is expected) and
      // still throw `err`, not whatever this update itself threw.
      await this.prisma.book
        .update({ where: { id: bookId }, data: { status: 'failed' } })
        .catch((cleanupErr: unknown) => {
          if (!isBookMissingError(cleanupErr)) {
            this.logger.error(`Failed to mark book ${bookId} as failed`, cleanupErr);
          }
        });
      throw err;
    }
  }

  private async runGeneration(input: FastFlowInput): Promise<FastFlowResult> {
    const { bookId } = input;
    const { child, template, goal } = await this.loadContext(input);
    const story = await this.generateStory(input, child, goal);
    const illustrationUrls = await this.pickIllustrations(story, template);
    const pdfKey = await this.persistStory(bookId, story, illustrationUrls);

    this.logger.log(`Fast-flow book ${bookId} generated`);
    return { bookId, pdfKey };
  }

  private async loadContext(input: FastFlowInput): Promise<GenerationContext> {
    const child = await this.prisma.child.findFirst({
      where: { id: input.childId, userId: input.userId },
    });
    if (!child) throw new NotFoundException(`Child ${input.childId} not found`);

    const [template, goal] = await Promise.all([
      this.prisma.template.findFirst({
        where: { learningGoalId: input.learningGoalId },
        select: { illustrationTags: true },
      }),
      this.prisma.learningGoal.findUnique({
        where: { id: input.learningGoalId },
        select: { title: true },
      }),
    ]);

    if (!template) {
      throw new NotFoundException(`No template for learning goal ${input.learningGoalId}`);
    }

    return { child, template, goal };
  }

  private async generateStory(
    input: FastFlowInput,
    child: GenerationContext['child'],
    goal: GenerationContext['goal'],
  ): Promise<Story> {
    const { object: story } = await generateObject({
      model: openai(GENERATION_MODEL),
      schema: StorySchema,
      system: FAST_FLOW_SYSTEM_PROMPT,
      prompt: buildFastFlowPrompt({
        childName: child.name,
        childAge: child.age,
        isFeminine: resolveGender(child.gender),
        learningGoal: goal?.title ?? '',
      }),
      experimental_telemetry: createTelemetry('fast-flow-story', {
        childId: input.childId,
        learningGoalId: input.learningGoalId,
        childAge: child.age,
      }),
      maxRetries: 1,
    });
    return story;
  }

  private async pickIllustrations(
    story: Story,
    template: GenerationContext['template'],
  ): Promise<readonly string[]> {
    const rawIllustrations = await this.prisma.fastIllustration.findMany({
      select: { id: true, url: true, tags: true },
    });
    return buildIllustrationUrls(story.pages.length, template.illustrationTags, rawIllustrations);
  }

  private async persistStory(
    bookId: string,
    story: Story,
    illustrationUrls: readonly string[],
  ): Promise<string> {
    await this.prisma.storyEval.create({
      data: {
        bookId,
        attempt: 1,
        passed: true,
        finalScore: 0,
        judgeScores: {},
        judgeReasoning: 'Fast-flow generation — no quality evaluation',
      },
    });

    const pdfKey = await this.pdfRender.render({ bookId, story, illustrationUrls });

    await this.prisma.bookPage.createMany({
      data: story.pages.map((p, i) => ({
        bookId,
        pageNumber: i + 1,
        text: p.text ?? '',
        imageUrl: illustrationUrls[i] ?? null,
      })),
    });

    await this.prisma.book.update({
      where: { id: bookId },
      data: { title: story.title, status: 'ready', pdfKey, storyJson: story },
    });

    return pdfKey;
  }
}

function buildIllustrationUrls(
  pageCount: number,
  illustrationTags: string[],
  illustrations: IllustrationRecord[],
): readonly string[] {
  return Array.from({ length: pageCount }, (_, i) => {
    const tag = illustrationTags[i % illustrationTags.length] ?? '';
    return pickIllustration(illustrations, [tag])?.url ?? '';
  });
}
