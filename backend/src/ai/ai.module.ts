import { Module } from '@nestjs/common';
import { VocabularyRagService } from './rag/vocabulary-rag.service';
import { StoryGeneratorService } from './story-generator/story-generator.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [VocabularyRagService, StoryGeneratorService],
  exports: [VocabularyRagService, StoryGeneratorService],
})
export class AiModule {}
