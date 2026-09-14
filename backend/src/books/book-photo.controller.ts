import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { z } from 'zod';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/auth.service';
import { BookImageService } from './book-image.service';
import { BookPhotoService, type UploadedPhotoFile } from './book-photo.service';

const MAX_PHOTO_BYTES = 25 * 1024 * 1024;

const regeneratePortraitSchema = z.object({
  descriptor: z.string().trim().max(600).optional(),
});

/** Photo character (#128): upload → portrait preview → regenerate. Split from BooksController in #380. */
@Controller()
@UseGuards(JwtAuthGuard)
export class BookPhotoController {
  constructor(
    private readonly bookPhoto: BookPhotoService,
    private readonly bookImage: BookImageService,
  ) {}

  // eslint-disable-next-line max-params -- Nest route handler: each parameter is a decorated request part (user, id, file, consent)
  @Post('books/:id/photo')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('photo', { limits: { fileSize: MAX_PHOTO_BYTES } }))
  async uploadPhoto(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @UploadedFile() file: UploadedPhotoFile | undefined,
    @Body('consent') consent?: string,
  ) {
    if (!file) throw new BadRequestException('No photo uploaded');
    const consented = consent === 'true' || consent === '1';
    return this.bookPhoto.uploadChildPhoto(user.sub, id, { file, consent: consented });
  }

  @Post('books/:id/portrait')
  @HttpCode(HttpStatus.OK)
  async buildPortrait(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    const { portraitKey, descriptor } = await this.bookPhoto.buildPortraitPreview(user.sub, id);
    return { portraitUrl: await this.bookImage.signKey(portraitKey), descriptor };
  }

  @Post('books/:id/portrait/regenerate')
  @HttpCode(HttpStatus.OK)
  async regeneratePortrait(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const { descriptor } = regeneratePortraitSchema.parse(body);
    const result = await this.bookPhoto.buildPortraitPreview(user.sub, id, descriptor);
    return {
      portraitUrl: await this.bookImage.signKey(result.portraitKey),
      descriptor: result.descriptor,
    };
  }
}
