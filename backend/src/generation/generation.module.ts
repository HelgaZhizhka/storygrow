import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AiModule } from '../ai/ai.module';
import { PdfModule } from '../pdf/pdf.module';
import { BooksModule } from '../books/books.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { GenerationService } from './generation.service';
import { GenerationProcessor } from './generation.processor';
import { GenerationController } from './generation.controller';
import { GENERATION_QUEUE } from './generation.types';

@Module({
  imports: [
    BullModule.registerQueue({
      name: GENERATION_QUEUE,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 50 },
      },
    }),
    PrismaModule,
    AiModule,
    AuthModule,
    BooksModule,
    PdfModule,
  ],
  controllers: [GenerationController],
  providers: [GenerationService, GenerationProcessor],
  exports: [GenerationService],
})
export class GenerationModule {}
