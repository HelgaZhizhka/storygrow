import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  Post,
  Req,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import Stripe from 'stripe';

import { StripeWebhookService, type StripeWebhookEvent } from './stripe-webhook.service';

type StripeVerifier = {
  webhooks: {
    constructEvent(payload: Buffer, signature: string, secret: string): unknown;
  };
};

@Controller('api/stripe')
export class StripeWebhookController {
  private readonly stripe: StripeVerifier;

  constructor(
    private readonly config: ConfigService,
    private readonly webhooks: StripeWebhookService,
  ) {
    this.stripe = new Stripe(
      this.config.get<string>('STRIPE_SECRET_KEY') ?? 'sk_test_webhook_verification_only',
    );
  }

  @Post('webhooks')
  @HttpCode(200)
  async handleWebhook(
    @Req() request: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature?: string,
  ) {
    const webhookSecret = this.config.get<string>('STRIPE_WEBHOOK_SECRET')?.trim();
    if (!webhookSecret) {
      throw new ServiceUnavailableException('Stripe webhook secret is not configured');
    }

    if (!signature) {
      throw new BadRequestException('Missing Stripe signature');
    }

    if (!request.rawBody) {
      throw new BadRequestException('Stripe raw body is required for signature verification');
    }

    let event: StripeWebhookEvent;
    try {
      event = this.stripe.webhooks.constructEvent(
        request.rawBody,
        signature,
        webhookSecret,
      ) as StripeWebhookEvent;
    } catch {
      throw new BadRequestException('Invalid Stripe webhook signature');
    }

    return this.webhooks.process(event);
  }
}
