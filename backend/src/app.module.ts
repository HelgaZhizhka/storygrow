import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';

import { AiModule } from './ai/ai.module';
import { AuthModule } from './auth/auth.module';
import { GenerationModule } from './generation/generation.module';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        connection: { url: config.getOrThrow<string>('REDIS_URL') },
      }),
      inject: [ConfigService],
    }),
    PrismaModule,
    AiModule,
    AuthModule,
    GenerationModule,
  ],
  controllers: [HealthController],
  providers: [HealthService],
})
export class AppModule {}
