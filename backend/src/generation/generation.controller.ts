import { Controller, Post, Param, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { type JwtPayload } from '../auth/auth.service';
import { GenerationService, type EnqueueResult } from './generation.service';

@Controller('books')
@UseGuards(JwtAuthGuard)
export class GenerationController {
  constructor(private readonly generation: GenerationService) {}

  @Post(':id/generate')
  @HttpCode(HttpStatus.ACCEPTED)
  generate(@Param('id') bookId: string, @CurrentUser() user: JwtPayload): Promise<EnqueueResult> {
    return this.generation.enqueueBook(bookId, user.sub);
  }
}
