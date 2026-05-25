import { Module } from '@nestjs/common';
import { VocabularyRagService } from './rag/vocabulary-rag.service';

@Module({
  providers: [VocabularyRagService],
  exports: [VocabularyRagService],
})
export class AiModule {}
