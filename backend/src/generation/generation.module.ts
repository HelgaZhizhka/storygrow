import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AiModule } from '../ai/ai.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { GenerationService } from './generation.service';
import { GenerationProcessor } from './generation.processor';
import { GenerationController } from './generation.controller';
import { GENERATION_QUEUE } from './generation.types';

@Module({
  imports: [
    BullModule.registerQueue({ name: GENERATION_QUEUE }),
    PrismaModule,
    AiModule,
    AuthModule,
  ],
  controllers: [GenerationController],
  providers: [GenerationService, GenerationProcessor],
  exports: [GenerationService],
})
export class GenerationModule {}
