import { Module } from '@nestjs/common';
import { S3Module } from '../s3/s3.module';
import { BookImageService } from './book-image.service';

@Module({
  imports: [S3Module],
  providers: [BookImageService],
  exports: [BookImageService],
})
export class BooksModule {}
