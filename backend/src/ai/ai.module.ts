import { Module } from '@nestjs/common';
import { VocabularyRagService } from './rag/vocabulary-rag.service';
import { StoryGeneratorService } from './story-generator/story-generator.service';
import { StoryEvaluatorService } from './story-generator/story-evaluator.service';
import { StoryOrchestratorService } from './story-generator/story-orchestrator.service';
import { ImageGeneratorService } from './image-generator/image-generator.service';
import { ReferenceSheetsService } from './image-generator/reference-sheets.service';
import { LearningGoalSafetyService } from './learning-goal-safety/learning-goal-safety.service';
import { PhotoDescriptorService } from './photo/photo-descriptor.service';
import { PhotoPortraitService } from './photo/photo-portrait.service';
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
    ReferenceSheetsService,
    LearningGoalSafetyService,
    PhotoDescriptorService,
    PhotoPortraitService,
  ],
  exports: [
    VocabularyRagService,
    StoryOrchestratorService,
    ImageGeneratorService,
    LearningGoalSafetyService,
    PhotoDescriptorService,
    PhotoPortraitService,
  ],
})
export class AiModule {}
