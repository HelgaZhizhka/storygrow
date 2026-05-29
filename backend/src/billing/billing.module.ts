import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { StripeWebhookController } from './stripe-webhook.controller';
import { StripeWebhookService } from './stripe-webhook.service';

@Module({
  imports: [PrismaModule],
  controllers: [StripeWebhookController],
  providers: [StripeWebhookService],
})
export class BillingModule {}
