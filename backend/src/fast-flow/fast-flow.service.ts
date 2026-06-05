import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { PrismaService } from '../prisma/prisma.service';
import { PdfRenderService } from '../pdf/pdf-render.service';
import { GENERATION_MODEL } from '../ai/ai.config';
import { createTelemetry } from '../ai/telemetry';
import { StorySchema } from '../ai/schemas/story.schema';
import { FAST_FLOW_SYSTEM_PROMPT, buildFastFlowPrompt } from './fast-flow.prompt';
import { resolveGender } from './substitute-placeholders';
import { pickIllustration, type IllustrationRecord } from './pick-illustration';

export interface FastFlowInput {
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

  async generate(input: FastFlowInput): Promise<FastFlowResult> {
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

    const isFeminine = resolveGender(child.gender);

    const { object: story } = await generateObject({
      model: openai(GENERATION_MODEL),
      schema: StorySchema,
      system: FAST_FLOW_SYSTEM_PROMPT,
      prompt: buildFastFlowPrompt({
        childName: child.name,
        childAge: child.age,
        isFeminine,
        learningGoal: goal?.title ?? '',
      }),
      experimental_telemetry: createTelemetry('fast-flow-story', {
        childId: input.childId,
        learningGoalId: input.learningGoalId,
        childAge: child.age,
      }),
      maxRetries: 1,
    });

    const rawIllustrations = await this.prisma.fastIllustration.findMany({
      select: { id: true, url: true, tags: true },
    });
    const illustrationUrls = buildIllustrationUrls(
      story.pages.length,
      template.illustrationTags,
      rawIllustrations,
    );

    const book = await this.prisma.book.create({
      data: {
        userId: input.userId,
        childId: input.childId,
        learningGoalId: input.learningGoalId,
        title: story.title,
        status: 'generating',
      },
      select: { id: true },
    });

    await this.prisma.storyEval.create({
      data: {
        bookId: book.id,
        attempt: 1,
        passed: true,
        finalScore: 0,
        judgeScores: {},
        judgeReasoning: 'Fast-flow generation — no quality evaluation',
      },
    });

    let pdfKey: string;
    try {
      pdfKey = await this.pdfRender.render({ bookId: book.id, story, illustrationUrls });
    } catch (err) {
      await this.prisma.book.update({ where: { id: book.id }, data: { status: 'failed' } });
      throw err;
    }

    await this.prisma.bookPage.createMany({
      data: story.pages.map((p, i) => ({
        bookId: book.id,
        pageNumber: i + 1,
        text: p.text ?? '',
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
