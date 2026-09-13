import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';

import { AdminModule } from './admin/admin.module';
import { AiModule } from './ai/ai.module';
import { AuthModule } from './auth/auth.module';
import { BillingModule } from './billing/billing.module';
import { BooksModule } from './books/books.module';
import { GenerationModule } from './generation/generation.module';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { PdfModule } from './pdf/pdf.module';
import { PrismaModule } from './prisma/prisma.module';
import { validateEnv } from './config/env.schema';

@Module({
  imports: [
    // Fail loud on a misconfigured deployment (#373) — see config/env.schema.ts.
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        connection: { url: config.getOrThrow<string>('REDIS_URL') },
      }),
      inject: [ConfigService],
    }),
    PrismaModule,
    AdminModule,
    AiModule,
    AuthModule,
    BillingModule,
    BooksModule,
    PdfModule,
    GenerationModule,
  ],
  controllers: [HealthController],
  providers: [HealthService],
})
export class AppModule {}
