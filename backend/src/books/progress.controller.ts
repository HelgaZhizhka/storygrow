import {
  Controller,
  ForbiddenException,
  NotFoundException,
  Param,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { map, merge, of } from 'rxjs';
import type { Observable } from 'rxjs';
import type { MessageEvent } from '@nestjs/common';
import { SseTicketAuthGuard } from '../auth/guards/sse-ticket-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { type JwtPayload } from '../auth/auth.service';
import { BooksService } from './books.service';
import { BookProgressService } from './book-progress.service';

@Controller()
@UseGuards(SseTicketAuthGuard)
export class ProgressController {
  constructor(
    private readonly books: BooksService,
    private readonly progress: BookProgressService,
  ) {}

  @Sse('books/:id/progress')
  async bookProgress(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<Observable<MessageEvent>> {
    const book = await this.books.findById(id);
    if (!book) throw new NotFoundException('Book not found');
    if (book.userId !== user.sub) throw new ForbiddenException();

    if (book.status === 'ready' || book.status === 'failed' || book.status === 'images_failed') {
      return of({ data: { type: book.status } });
    }

    const initial =
      book.status === 'generating' ? of({ data: { type: 'generating' } }) : of<never>();
    const stream = this.progress.stream(id).pipe(map((event) => ({ data: event })));
    return merge(initial, stream);
  }
}
