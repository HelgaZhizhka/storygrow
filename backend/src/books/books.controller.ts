import {
  Body,
  Controller,
  Get,
  HttpCode,
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
import { BookImageService } from './book-image.service';
import { BooksService } from './books.service';

const createChildSchema = z.object({
  name: z.string().min(1).max(100),
  age: z.number().int().min(1).max(18),
  gender: z.enum(['male', 'female', 'other']).optional(),
});

const createBookSchema = z.object({
  childId: z.string().min(1),
  learningGoalId: z.string().min(1),
  mode: z.enum(['fast', 'custom']),
});

@Controller()
@UseGuards(JwtAuthGuard)
export class BooksController {
  constructor(
    private readonly books: BooksService,
    private readonly bookImage: BookImageService,
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
  listLearningGoals(@Query('childId') childId?: string) {
    return this.books.listLearningGoals(childId);
  }

  @Post('books')
  @HttpCode(HttpStatus.CREATED)
  createBook(@CurrentUser() user: JwtPayload, @Body() body: unknown) {
    const dto = createBookSchema.parse(body);
    return this.books.createBook(user.sub, dto);
  }

  @Get('books')
  listBooks(@CurrentUser() user: JwtPayload) {
    return this.books.listBooks(user.sub);
  }

  @Get('books/:id')
  async getBook(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    const book = await this.books.getBook(user.sub, id);
    if (!book) throw new NotFoundException('Book not found');
    return book;
  }

  @Get('books/:id/pdf-url')
  async getPdfUrl(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    const book = await this.books.getBook(user.sub, id);
    if (!book) throw new NotFoundException('Book not found');
    if (!book.pdfKey) throw new NotFoundException('PDF not ready');
    const url = await this.bookImage.signKey(book.pdfKey);
    return { url };
  }
}
