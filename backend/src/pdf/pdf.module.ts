import { Module } from '@nestjs/common';
import { S3Module } from '../s3/s3.module';
import { PdfRenderService } from './pdf-render.service';

@Module({
  imports: [S3Module],
  providers: [PdfRenderService],
  exports: [PdfRenderService],
})
export class PdfModule {}
