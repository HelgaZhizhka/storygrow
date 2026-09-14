import {
  BadRequestException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import sharp from 'sharp';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../s3/s3.service';
import { bookKeys } from '../s3/book-keys';
import { PhotoDescriptorService } from '../ai/photo/photo-descriptor.service';
import { PhotoPortraitService } from '../ai/photo/photo-portrait.service';

const PHOTO_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const PHOTO_MAX_DIM = 1024;

export interface UploadedPhotoFile {
  buffer: Buffer;
  mimetype: string;
}

/**
 * Photo character (#128, child mode): upload → descriptor → portrait preview.
 * Split out of BooksService in #380 (file over 400 lines); the book-slot,
 * quota and listing logic stays there.
 */
@Injectable()
export class BookPhotoService {
  private readonly logger = new Logger(BookPhotoService.name);

  // eslint-disable-next-line max-params -- NestJS injects dependencies through the constructor; there is no object-parameter form
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
    private readonly photoDescriptor: PhotoDescriptorService,
    private readonly photoPortrait: PhotoPortraitService,
  ) {}

  async uploadChildPhoto(
    userId: string,
    bookId: string,
    upload: { file: UploadedPhotoFile; consent: boolean },
  ): Promise<{ descriptor: string }> {
    await this.assertPhotoBook(userId, bookId);
    if (!upload.consent) {
      throw new BadRequestException('Parental consent is required to use a photo');
    }
    const jpeg = await normalizePhoto(upload.file);
    const { descriptor, appearance } = await this.describeOrReject(jpeg, bookId);
    const key = bookKeys(bookId).upload;
    await this.s3.uploadObject({ key, body: jpeg, contentType: 'image/jpeg' });
    await this.prisma.book.update({
      where: { id: bookId },
      data: {
        childPhotoKey: key,
        characterDescriptor: descriptor,
        characterAppearance: appearance,
        photoConsent: true,
      },
    });
    return { descriptor };
  }

  // The vision call must see a child's face; anything else is a 400, not a stored photo.
  private async describeOrReject(jpeg: Buffer, bookId: string) {
    const result = await this.imageServiceCall(() =>
      this.photoDescriptor.describePhoto({
        photo: new Uint8Array(jpeg),
        mimeType: 'image/jpeg',
        bookId,
      }),
    );
    if (!result.hasChildFace) {
      throw new BadRequestException(
        'No child face detected — please upload a clear, front-facing photo of the child',
      );
    }
    return result;
  }

  async buildPortraitPreview(
    userId: string,
    bookId: string,
    descriptor?: string,
  ): Promise<{ portraitKey: string; descriptor: string }> {
    await this.assertPhotoBook(userId, bookId);
    const edited = descriptor?.trim();
    if (edited) {
      await this.prisma.book.update({
        where: { id: bookId },
        data: { characterDescriptor: edited },
      });
    }
    return this.imageServiceCall(() => this.photoPortrait.buildPortrait(bookId));
  }

  // Map AI/image-provider failures (e.g. Gemini 429 spend-cap, timeouts) to a
  // clear 503 instead of a raw 500 — but let deliberate HttpExceptions through.
  private async imageServiceCall<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`Image service call failed: ${err instanceof Error ? err.message : err}`);
      throw new ServiceUnavailableException(
        'Сервис изображений сейчас недоступен. Попробуйте позже.',
      );
    }
  }

  private async assertPhotoBook(userId: string, bookId: string): Promise<void> {
    const book = await this.prisma.book.findUnique({
      where: { id: bookId },
      select: { userId: true, protagonistMode: true, status: true },
    });
    if (!book || book.userId !== userId) throw new NotFoundException('Book not found');
    if (book.protagonistMode !== 'child') {
      throw new BadRequestException('A photo character is only available for child-mode books');
    }
    if (book.status !== 'pending') {
      throw new BadRequestException('A photo can only be set before generation starts');
    }
  }
}

// Downscale on the way in: bounds the payload for the vision/image calls and
// keeps the least amount of the child's raw photo on disk (deleted at generation).
const normalizePhoto = (file: UploadedPhotoFile): Promise<Buffer> => {
  if (!PHOTO_MIME.has(file.mimetype)) {
    throw new BadRequestException('Photo must be a JPEG, PNG or WebP image');
  }
  return sharp(file.buffer)
    .rotate()
    .resize(PHOTO_MAX_DIM, PHOTO_MAX_DIM, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();
};
