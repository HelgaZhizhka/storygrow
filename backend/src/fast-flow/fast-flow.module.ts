import { Module } from '@nestjs/common';
import { PdfModule } from '../pdf/pdf.module';
import { FastFlowService } from './fast-flow.service';

@Module({
  imports: [PdfModule],
  providers: [FastFlowService],
  exports: [FastFlowService],
})
export class FastFlowModule {}
