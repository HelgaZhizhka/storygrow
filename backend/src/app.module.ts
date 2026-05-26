import { Module } from '@nestjs/common';

import { AiModule } from './ai/ai.module';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [PrismaModule, AiModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class AppModule {}
