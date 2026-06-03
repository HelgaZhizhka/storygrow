import { Module } from '@nestjs/common';
import { S3Module } from '../s3/s3.module';
import { BookImageService } from './book-image.service';
import { BookProgressService } from './book-progress.service';
import { BooksController } from './books.controller';
import { BooksService } from './books.service';
import { ProgressController } from './progress.controller';

@Module({
  imports: [S3Module],
  controllers: [BooksController, ProgressController],
  providers: [BookImageService, BooksService, BookProgressService],
  exports: [BookImageService, BookProgressService],
})
export class BooksModule {}
