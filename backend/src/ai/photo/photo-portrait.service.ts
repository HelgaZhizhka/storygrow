import { Injectable } from '@nestjs/common';
import { startActiveObservation } from '@langfuse/tracing';
import { PrismaService } from '../../prisma/prisma.service';
import { S3Service } from '../../s3/s3.service';
import { bookKeys } from '../../s3/book-keys';
import { ImageGeneratorService } from '../image-generator/image-generator.service';

export interface PortraitResult {
  portraitKey: string;
  descriptor: string;
}

@Injectable()
export class PhotoPortraitService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
    private readonly imageGen: ImageGeneratorService,
  ) {}

  // Phase 1 (#128): stylise the uploaded photo into the book's character portrait.
  // Safe to call again to regenerate — the raw photo survives until the book's
  // async generation starts (deletion lives in the books flow, spec decision 5).
  async buildPortrait(bookId: string): Promise<PortraitResult> {
    const { childPhotoKey, characterDescriptor, artStyle } = await this.loadPhotoBook(bookId);
    return startActiveObservation('photo.portrait', async (span) => {
      span.update({ input: { bookId }, metadata: { bookId } });
      const photo = await this.s3.getObjectBytes(childPhotoKey);
      const portrait = await this.imageGen.generatePhotoPortrait({
        photo,
        descriptor: characterDescriptor,
        artStyle,
      });
      const portraitKey = bookKeys(bookId).portrait;
      await this.s3.uploadObject({
        key: portraitKey,
        body: Buffer.from(portrait),
        contentType: 'image/png',
      });
      await this.prisma.book.update({
        where: { id: bookId },
        data: { characterPortraitKey: portraitKey },
      });
      span.update({ output: { portraitKey } });
      return { portraitKey, descriptor: characterDescriptor };
    });
  }

  private async loadPhotoBook(bookId: string) {
    const book = await this.prisma.book.findUniqueOrThrow({
      where: { id: bookId },
      select: { childPhotoKey: true, characterDescriptor: true, artStyle: true },
    });
    const { childPhotoKey, characterDescriptor } = book;
    if (!childPhotoKey || !characterDescriptor) {
      throw new Error('Book has no uploaded photo/descriptor to build a portrait from');
    }
    return { ...book, childPhotoKey, characterDescriptor };
  }
}
