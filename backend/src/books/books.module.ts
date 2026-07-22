import { Module } from '@nestjs/common';
import { S3Module } from '../s3/s3.module';
import { FastFlowModule } from '../fast-flow/fast-flow.module';
import { AuthModule } from '../auth/auth.module';
import { BookImageService } from './book-image.service';
import { BookProgressService } from './book-progress.service';
import { BooksController } from './books.controller';
import { BooksService } from './books.service';
import { ProgressController } from './progress.controller';

@Module({
  imports: [S3Module, FastFlowModule, AuthModule],
  controllers: [BooksController, ProgressController],
  providers: [BookImageService, BooksService, BookProgressService],
  exports: [BookImageService, BookProgressService],
})
export class BooksModule {}
