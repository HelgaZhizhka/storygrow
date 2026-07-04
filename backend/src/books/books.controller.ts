import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/auth.service';
import { FastFlowService } from '../fast-flow/fast-flow.service';
import { BookImageService } from './book-image.service';
import { BooksService, type QuotaInfo } from './books.service';

const createChildSchema = z.object({
  name: z.string().min(1).max(100),
  age: z.number().int().min(1).max(18),
  gender: z.enum(['male', 'female', 'other']).optional(),
  appearance: z.string().max(1500).optional(),
});

// Personalization seeds (#197): soft, concrete per-book material. Capped to keep
// the Plan prompt lean and to bound abuse; empty by default.
const seedList = z.array(z.string().trim().min(1).max(60)).max(6).default([]);

const createBookSchema = z.object({
  childId: z.string().min(1),
  learningGoalId: z.string().min(1),
  mode: z.enum(['fast', 'custom']),
  protagonistMode: z.enum(['child', 'observer']).default('child'),
  artStyle: z
    .enum(['watercolor', 'cartoon', 'storybook', 'pixel', 'realistic'])
    .default('watercolor'),
  interests: seedList,
  motifs: seedList,
  favoriteWords: seedList,
  belongings: seedList,
});

@Controller()
@UseGuards(JwtAuthGuard)
export class BooksController {
  constructor(
    private readonly books: BooksService,
    private readonly bookImage: BookImageService,
    private readonly fastFlow: FastFlowService,
  ) {}

  @Get('children')
  listChildren(@CurrentUser() user: JwtPayload) {
    return this.books.listChildren(user.sub);
  }

  @Post('children')
  @HttpCode(HttpStatus.CREATED)
  createChild(@CurrentUser() user: JwtPayload, @Body() body: unknown) {
    const dto = createChildSchema.parse(body);
    return this.books.createChild(user.sub, dto);
  }

  @Get('learning-goals')
  listLearningGoals(@CurrentUser() user: JwtPayload, @Query('childId') childId?: string) {
    return this.books.listLearningGoals(user.sub, childId);
  }

  @Post('books')
  @HttpCode(HttpStatus.CREATED)
  async createBook(@CurrentUser() user: JwtPayload, @Body() body: unknown) {
    const dto = createBookSchema.parse(body);

    const { used, limit } = await this.books.getQuota(user.sub);
    if (limit !== null && used >= limit) {
      throw new HttpException(
        { message: 'Book quota exceeded for current plan', used, limit },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    if (dto.mode === 'fast') {
      return this.fastFlow.generate({
        userId: user.sub,
        childId: dto.childId,
        learningGoalId: dto.learningGoalId,
      });
    }

    return this.books.createBook(user.sub, dto);
  }

  @Get('books/quota')
  getQuota(@CurrentUser() user: JwtPayload): Promise<QuotaInfo> {
    return this.books.getQuota(user.sub);
  }

  @Get('books')
  async listBooks(@CurrentUser() user: JwtPayload) {
    const books = await this.books.listBooks(user.sub);
    return Promise.all(
      books.map(async ({ imageKeys, ...book }) => ({
        ...book,
        coverUrl:
          book.status === 'ready' && imageKeys[0]
            ? await this.bookImage.signKey(imageKeys[0])
            : null,
      })),
    );
  }

  @Get('books/:id')
  async getBook(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    const book = await this.books.getBook(user.sub, id);
    if (!book) throw new NotFoundException('Book not found');
    return book;
  }

  @Delete('books/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteBook(@CurrentUser() user: JwtPayload, @Param('id') id: string): Promise<void> {
    await this.books.deleteBook(user.sub, id);
  }

  @Get('books/:id/pdf-url')
  async getPdfUrl(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    const book = await this.books.getBook(user.sub, id);
    if (!book) throw new NotFoundException('Book not found');
    if (!book.pdfKey) throw new NotFoundException('PDF not ready');
    const url = await this.bookImage.signKey(book.pdfKey);
    return { url };
  }

  @Get('books/:id/image-urls')
  async getImageUrls(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    const book = await this.books.getBook(user.sub, id);
    if (!book) throw new NotFoundException('Book not found');
    const urls = await this.bookImage.signKeys(book.imageKeys);
    return { urls };
  }
}
