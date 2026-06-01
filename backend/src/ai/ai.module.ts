import { Module } from '@nestjs/common';
import { VocabularyRagService } from './rag/vocabulary-rag.service';
import { StoryGeneratorService } from './story-generator/story-generator.service';
import { StoryEvaluatorService } from './story-generator/story-evaluator.service';
import { StoryOrchestratorService } from './story-generator/story-orchestrator.service';
import { ImageGeneratorService } from './image-generator/image-generator.service';
import { PrismaModule } from '../prisma/prisma.module';
import { S3Module } from '../s3/s3.module';

@Module({
  imports: [PrismaModule, S3Module],
  providers: [
    VocabularyRagService,
    StoryGeneratorService,
    StoryEvaluatorService,
    StoryOrchestratorService,
    ImageGeneratorService,
  ],
  exports: [VocabularyRagService, StoryOrchestratorService, ImageGeneratorService],
})
export class AiModule {}
