import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { type Job } from 'bullmq';
import { BookStatus } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StoryOrchestratorService } from '../ai/story-generator/story-orchestrator.service';
import { ImageGeneratorService } from '../ai/image-generator/image-generator.service';
import { BookImageService } from '../books/book-image.service';
import { BookProgressService } from '../books/book-progress.service';
import { PdfRenderService } from '../pdf/pdf-render.service';
import type { Story } from '../ai/schemas';
import { AppearanceSchema, heroKind, renderAppearance } from '../ai/schemas';
import { GENERATION_QUEUE, type GenerateBookPayload } from './generation.types';

interface BookWithRelations {
  id: string;
  storyJson: Story | null;
  imageKeys: string[];
  protagonistMode: 'child' | 'observer';
  artStyle: 'watercolor' | 'cartoon' | 'storybook' | 'pixel' | 'realistic';
  characterPortraitKey: string | null;
  characterDescriptor: string | null;
  characterAppearance: unknown;
  referenceImageKeys: string[];
  interests: string[];
  motifs: string[];
  favoriteWords: string[];
  child: { name: string; age: number; gender: string | null; appearance: string | null };
  learningGoal: { title: string; description: string; arcType: 'virtue' | 'flaw' };
}

// lockDuration: 6–8 pages × ~10 s Puppeteer render ≈ 60–80 s upper bound; 90 s gives headroom.
@Processor(GENERATION_QUEUE, { lockDuration: 90_000 })
export class GenerationProcessor extends WorkerHost {
  private readonly logger = new Logger(GenerationProcessor.name);

  // eslint-disable-next-line max-params -- NestJS injects dependencies through the constructor; there is no object-parameter form
  constructor(
    private readonly prisma: PrismaService,
    private readonly orchestrator: StoryOrchestratorService,
    private readonly imageGenerator: ImageGeneratorService,
    private readonly bookImage: BookImageService,
    private readonly pdfRender: PdfRenderService,
    private readonly bookProgress: BookProgressService,
  ) {
    super();
  }

  async process(job: Job<GenerateBookPayload>): Promise<void> {
    const { bookId, userId } = job.data;
    this.logger.log(`Processing job ${job.id} for book ${bookId}`);

    let generatingSet = false;
    try {
      await this.setStatus(bookId, BookStatus.generating);
      generatingSet = true;
      this.bookProgress.emit(bookId, { type: 'generating', message: 'Подготовка…' });
      await job.updateProgress(10);

      const book = await this.fetchBook(bookId, userId);
      await this.advance(job, 20, 'Получение данных…');

      const { story, reused: storyReused } = await this.ensureStory(job, book);
      const imageKeys = await this.ensureImages({ job, book, story, storyReused });
      await this.advance(job, 85, 'Иллюстрации готовы');

      await this.finish(job, story, imageKeys);
      this.logger.log(`Book ${bookId} ready`);
    } catch (err: unknown) {
      this.logger.error(`Job ${job.id} failed for book ${bookId}`, err);
      if (generatingSet) await this.markFailed(bookId);
      throw err;
    }
  }

  /** Emit one progress step to the SSE stream and the BullMQ job. */
  private async advance(job: Job<GenerateBookPayload>, progress: number, message: string) {
    this.bookProgress.emit(job.data.bookId, { type: 'progress', progress, message });
    await job.updateProgress(progress);
  }

  // On retry: skip the orchestrator when the story was already generated and saved.
  private async ensureStory(
    job: Job<GenerateBookPayload>,
    book: BookWithRelations,
  ): Promise<{ story: Story; reused: boolean }> {
    const { bookId } = job.data;
    if (book.storyJson) {
      this.logger.log(`Book ${bookId}: reusing saved storyJson (retry path)`);
      await this.advance(job, 60, 'История уже сгенерирована — повторяем иллюстрации');
      return { story: book.storyJson, reused: true };
    }
    const result = await this.orchestrator.generate(storyOptions(book));
    await this.advance(job, 60, `История сгенерирована (попытка ${result.attempts})`);
    await this.prisma.book.update({
      where: { id: bookId },
      data: { storyJson: result.story, title: result.story.title },
    });
    return { story: result.story, reused: false };
  }

  // On retry: skip image generation when the images are already stored.
  private async ensureImages(ctx: {
    job: Job<GenerateBookPayload>;
    book: BookWithRelations;
    story: Story;
    storyReused: boolean;
  }): Promise<string[]> {
    const { book, story, storyReused } = ctx;
    const { bookId } = ctx.job.data;
    if (book.imageKeys.length > 0) {
      this.logger.log(
        `Book ${bookId}: reusing ${book.imageKeys.length} saved image keys (retry path)`,
      );
      return book.imageKeys;
    }
    const generated = await this.imageGenerator.generate({
      story,
      bookId,
      artStyle: book.artStyle,
      ...photoFlowInputs(book),
      run: await this.nextImageRun(bookId),
      // Same story as the failed run → its portrait and sheets are still
      // valid: reuse them instead of buying them again (#374).
      reuse: storyReused
        ? { portraitKey: book.characterPortraitKey, referenceImageKeys: book.referenceImageKeys }
        : undefined,
      onArtefacts: (artefacts) => this.persistArtefacts(bookId, artefacts),
    });
    await this.prisma.book.update({ where: { id: bookId }, data: generated });
    return generated.imageKeys;
  }

  private async finish(job: Job<GenerateBookPayload>, story: Story, imageKeys: string[]) {
    const { bookId } = job.data;
    const illustrationUrls = await this.bookImage.signKeys(imageKeys);
    const pdfKey = await this.pdfRender.render({ bookId, story, illustrationUrls });
    await job.updateProgress(95);
    await this.prisma.book.update({
      where: { id: bookId },
      data: { pdfKey, status: BookStatus.ready },
    });
    await job.updateProgress(100);
    this.bookProgress.emit(bookId, { type: 'ready', progress: 100, message: 'Книга готова!' });
  }

  // A failure after the story was saved is `images_failed` (retryable without
  // paying for the text again); before that it is a plain `failed`.
  private async markFailed(bookId: string): Promise<void> {
    const book = await this.prisma.book.findUnique({
      where: { id: bookId },
      select: { storyJson: true },
    });
    const failStatus = book?.storyJson != null ? BookStatus.images_failed : BookStatus.failed;
    await this.setStatus(bookId, failStatus);
    this.bookProgress.emit(bookId, { type: 'failed', message: 'Ошибка генерации' });
  }

  private async fetchBook(bookId: string, userId: string): Promise<BookWithRelations> {
    const book = await this.prisma.book.findUnique({
      where: { id: bookId, userId },
      select: {
        id: true,
        storyJson: true,
        imageKeys: true,
        protagonistMode: true,
        artStyle: true,
        characterPortraitKey: true,
        characterDescriptor: true,
        characterAppearance: true,
        referenceImageKeys: true,
        interests: true,
        motifs: true,
        favoriteWords: true,
        child: { select: { name: true, age: true, gender: true, appearance: true } },
        learningGoal: { select: { title: true, description: true, arcType: true } },
      },
    });
    if (!book) throw new Error(`Book ${bookId} not found for user ${userId}`);
    return { ...book, storyJson: book.storyJson as Story | null };
  }

  /** Each image generation of a book is a run; ImageEval attempts are numbered per run (#374). */
  private async nextImageRun(bookId: string): Promise<number> {
    const agg = await this.prisma.imageEval.aggregate({ where: { bookId }, _max: { run: true } });
    return (agg._max.run ?? 0) + 1;
  }

  // Persist the portrait and sheet keys the moment they exist, so a crash in the
  // page phase leaves them on the Book for the next run to reuse (#374).
  private async persistArtefacts(
    bookId: string,
    artefacts: { characterPortraitKey: string | null; referenceImageKeys: string[] },
  ): Promise<void> {
    await this.prisma.book.update({ where: { id: bookId }, data: artefacts });
  }

  private async setStatus(bookId: string, status: BookStatus): Promise<void> {
    await this.prisma.book.update({ where: { id: bookId }, data: { status } });
  }
}

/**
 * Photo mode (#376): the pages and the judge get the English structured look the
 * vision call extracted (skin, hair, the outfit worn in the photo), with `kind`
 * from the child's age + gender — the same shape every other mode uses. Books
 * uploaded before #376 have no structured look and fall back to the Russian
 * face line the portrait was built from.
 */
const heroLookFromPhoto = (book: BookWithRelations): string | null => {
  const parsed = AppearanceSchema.safeParse(book.characterAppearance);
  if (!parsed.success) return book.characterDescriptor;
  return renderAppearance({
    ...parsed.data,
    kind: heroKind(book.child.age, book.child.gender ?? undefined),
  });
};

const storyOptions = (book: BookWithRelations) => ({
  bookId: book.id,
  childName: book.child.name,
  childAge: book.child.age,
  gender: book.child.gender ?? undefined,
  appearance: book.child.appearance ?? undefined,
  protagonistMode: book.protagonistMode,
  topic: book.learningGoal.title,
  learningGoal: book.learningGoal.description,
  arcType: book.learningGoal.arcType,
  seeds: { interests: book.interests, motifs: book.motifs, favoriteWords: book.favoriteWords },
});

// Photo flow (#128) is discriminated by a stored descriptor (set only when a
// photo was uploaded); characterPortraitKey alone can also be a retry artefact
// of the synthetic path, so it is not a safe discriminator.
const photoFlowInputs = (book: BookWithRelations) => {
  const isPhotoFlow = Boolean(book.characterDescriptor);
  return {
    approvedPortraitKey: isPhotoFlow ? book.characterPortraitKey : null,
    characterDescriptor: isPhotoFlow ? heroLookFromPhoto(book) : null,
  };
};
