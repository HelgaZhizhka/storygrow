import { Module } from '@nestjs/common';
import { S3Module } from '../s3/s3.module';
import { BookImageService } from './book-image.service';
import { BooksController } from './books.controller';
import { BooksService } from './books.service';

@Module({
  imports: [S3Module],
  controllers: [BooksController],
  providers: [BookImageService, BooksService],
  exports: [BookImageService],
})
export class BooksModule {}
