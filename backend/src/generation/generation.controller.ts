import {
  Controller,
  Post,
  Get,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { type JwtPayload } from '../auth/auth.service';
import { GenerationService, type EnqueueResult } from './generation.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class GenerationController {
  constructor(private readonly generation: GenerationService) {}

  @Post('books/:id/generate')
  @HttpCode(HttpStatus.ACCEPTED)
  generate(@Param('id') bookId: string, @CurrentUser() user: JwtPayload): Promise<EnqueueResult> {
    return this.generation.enqueueBook(bookId, user.sub);
  }

  @Post('books/:id/retry-images')
  @HttpCode(HttpStatus.ACCEPTED)
  retryImages(
    @Param('id') bookId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<EnqueueResult> {
    return this.generation.enqueueBook(bookId, user.sub);
  }

  @Get('jobs/:jobId/status')
  async getJobStatus(@Param('jobId') jobId: string): Promise<{ status: string }> {
    const status = await this.generation.getJobStatus(jobId);
    if (status === null) throw new NotFoundException('Job not found');
    return { status };
  }
}
