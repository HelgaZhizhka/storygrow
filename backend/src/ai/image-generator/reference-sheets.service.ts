import { Injectable, Logger } from '@nestjs/common';
import { startActiveObservation } from '@langfuse/tracing';
import type { VisualBible } from '../schemas';
import type { ArtStyle } from '../ai.config';
import { S3Service } from '../../s3/s3.service';
import { ImageGenerationError } from './errors';
import type { ImageProvider } from './providers/image-provider.interface';

export interface SheetSet {
  /** cast id → stylised portrait bytes. */
  castSheets: Record<string, Uint8Array>;
  /** location id → establishing-shot bytes. */
  locationSheets: Record<string, Uint8Array>;
  /** S3 keys of every generated sheet (persisted on Book.referenceImageKeys). */
  keys: string[];
}

interface GenerateInput {
  bookId: string;
  bible: VisualBible;
  artStyle: ArtStyle;
  provider: ImageProvider;
}

/**
 * ReferenceSheetsService (#348, PR 2) — generates one establishing shot per
 * location and one portrait per cast member, once per book, in parallel, BEFORE
 * the pages. Passing these as reference images (via pickReferences) anchors the
 * environment and secondary characters by picture, not only text. Best-effort: a
 * refused sheet is skipped (the page still carries the descriptor text + hero
 * portrait), never failing the book.
 */
@Injectable()
export class ReferenceSheetsService {
  private readonly logger = new Logger(ReferenceSheetsService.name);

  constructor(private readonly s3: S3Service) {}

  async generate(input: GenerateInput): Promise<SheetSet> {
    return startActiveObservation('image-generation.sheets', async (span) => {
      const set: SheetSet = { castSheets: {}, locationSheets: {}, keys: [] };
      const tasks = [
        ...input.bible.locations.map((loc) => () => this.locationSheet(input, loc, set)),
        ...input.bible.cast.map((member) => () => this.castSheet(input, member, set)),
      ];
      await Promise.all(tasks.map((run) => run()));
      span.update({ output: { sheets: set.keys.length } });
      return set;
    });
  }

  private async locationSheet(
    input: GenerateInput,
    loc: VisualBible['locations'][number],
    set: SheetSet,
  ): Promise<void> {
    await this.run(`image-generation.sheet-location-${loc.id}`, async () => {
      const bytes = await input.provider.generateLocationSheet({
        descriptor: loc.descriptor,
        atmosphere: input.bible.atmosphere,
        artStyle: input.artStyle,
      });
      const key = `books/${input.bookId}/ref-location-${loc.id}.png`;
      await this.upload(key, bytes);
      set.locationSheets[loc.id] = bytes;
      set.keys.push(key);
    });
  }

  private async castSheet(
    input: GenerateInput,
    member: VisualBible['cast'][number],
    set: SheetSet,
  ): Promise<void> {
    await this.run(`image-generation.sheet-cast-${member.id}`, async () => {
      const bytes = await input.provider.generatePortrait({
        characterProfile: member.descriptor,
        artStyle: input.artStyle,
      });
      const key = `books/${input.bookId}/ref-cast-${member.id}.png`;
      await this.upload(key, bytes);
      set.castSheets[member.id] = bytes;
      set.keys.push(key);
    });
  }

  private async upload(key: string, bytes: Uint8Array): Promise<void> {
    await this.s3.uploadObject({ key, body: Buffer.from(bytes), contentType: 'image/png' });
  }

  // Wrap one sheet in a span; a content-policy refusal is skipped, not fatal.
  private async run(spanName: string, work: () => Promise<void>): Promise<void> {
    await startActiveObservation(spanName, async () => {
      try {
        await work();
      } catch (err: unknown) {
        if (err instanceof ImageGenerationError && err.refused) {
          this.logger.warn(`${spanName}: refused, skipping sheet`);
          return;
        }
        throw err;
      }
    });
  }
}
