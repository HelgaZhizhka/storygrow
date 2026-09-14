import { Module } from '@nestjs/common';
import { S3Module } from '../s3/s3.module';
import { FastFlowModule } from '../fast-flow/fast-flow.module';
import { AuthModule } from '../auth/auth.module';
import { AiModule } from '../ai/ai.module';
import { BookImageService } from './book-image.service';
import { BookProgressService } from './book-progress.service';
import { BooksController } from './books.controller';
import { BooksService } from './books.service';
import { BookPhotoService } from './book-photo.service';
import { BookPhotoController } from './book-photo.controller';
import { ProgressController } from './progress.controller';

@Module({
  imports: [S3Module, FastFlowModule, AuthModule, AiModule],
  controllers: [BooksController, BookPhotoController, ProgressController],
  providers: [BookImageService, BooksService, BookPhotoService, BookProgressService],
  exports: [BookImageService, BookProgressService],
})
export class BooksModule {}
