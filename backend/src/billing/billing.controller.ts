import {
  Controller,
  Post,
  Headers,
  Req,
  Body,
  BadRequestException,
  HttpCode,
  HttpStatus,
  UseGuards,
  type RawBodyRequest,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import type { Request } from 'express';
import Stripe from 'stripe';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/auth.service';
import { BillingService } from './billing.service';
import type { StripeInstance, StripeEvent } from './billing-types';

const subscribePlanSchema = z.object({
  plan: z.enum(['basic', 'premium']),
});

const PRICE_ID_KEYS: Record<'basic' | 'premium', string> = {
  basic: 'STRIPE_PRICE_BASIC',
  premium: 'STRIPE_PRICE_PREMIUM',
};

@Controller('api/stripe')
export class BillingController {
  private readonly stripe: StripeInstance;
  private readonly webhookSecret: string;
  private readonly frontendUrl: string;

  constructor(
    private readonly billing: BillingService,
    private readonly config: ConfigService,
  ) {
    this.stripe = new Stripe(config.getOrThrow<string>('STRIPE_SECRET_KEY'));
    this.webhookSecret = config.getOrThrow<string>('STRIPE_WEBHOOK_SECRET');
    this.frontendUrl = config.getOrThrow<string>('FRONTEND_URL');
  }

  @Post('subscribe')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async createSubscription(
    @CurrentUser() user: JwtPayload,
    @Body() body: unknown,
  ): Promise<{ url: string }> {
    const { plan } = subscribePlanSchema.parse(body);
    const priceId = this.config.getOrThrow<string>(PRICE_ID_KEYS[plan]);

    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: { metadata: { userId: user.sub, plan } },
      success_url: `${this.frontendUrl}/subscription/success`,
      cancel_url: `${this.frontendUrl}/pricing`,
    });

    if (!session.url) throw new BadRequestException('Stripe did not return a checkout URL');
    return { url: session.url };
  }

  @Post('webhooks')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Headers('stripe-signature') signature: string,
    @Req() req: RawBodyRequest<Request>,
  ): Promise<{ received: true }> {
    const rawBody = req.rawBody;
    if (!rawBody) throw new BadRequestException('Missing raw body');

    let event: StripeEvent;
    try {
      event = this.stripe.webhooks.constructEvent(rawBody, signature, this.webhookSecret);
    } catch {
      throw new BadRequestException('Invalid Stripe signature');
    }

    await this.billing.handleEvent(event);
    return { received: true };
  }
}
