import { Module } from '@nestjs/common';
import { VocabularyRagService } from './rag/vocabulary-rag.service';
import { StoryGeneratorService } from './story-generator/story-generator.service';
import { StoryEvaluatorService } from './story-generator/story-evaluator.service';
import { StoryOrchestratorService } from './story-generator/story-orchestrator.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [
    VocabularyRagService,
    StoryGeneratorService,
    StoryEvaluatorService,
    StoryOrchestratorService,
  ],
  exports: [VocabularyRagService, StoryOrchestratorService],
})
export class AiModule {}
