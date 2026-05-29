import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionPlan, SubscriptionStatus } from '../../generated/prisma/client';

export type StripeWebhookEvent = {
  id: string;
  type: string;
  data: {
    object: unknown;
  };
};

type StripeSubscriptionPayload = {
  id?: unknown;
  status?: unknown;
  metadata?: Record<string, string> | null;
  current_period_end?: unknown;
};

type StripeInvoicePayload = {
  subscription?: unknown;
};

type WebhookResult = {
  eventId: string;
  received: true;
  status: 'processed' | 'duplicate' | 'ignored';
};

@Injectable()
export class StripeWebhookService {
  constructor(private readonly prisma: PrismaService) {}

  async process(event: StripeWebhookEvent): Promise<WebhookResult> {
    const claimed = await this.claimEvent(event);
    if (!claimed) {
      return { eventId: event.id, received: true, status: 'duplicate' };
    }

    try {
      const handled = await this.dispatch(event);
      await this.markProcessed(event.id);
      return { eventId: event.id, received: true, status: handled ? 'processed' : 'ignored' };
    } catch (error) {
      await this.releaseClaim(event.id);
      throw error;
    }
  }

  private async dispatch(event: StripeWebhookEvent): Promise<boolean> {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        return this.syncSubscription(
          event.data.object as StripeSubscriptionPayload,
          event.type === 'customer.subscription.deleted',
        );
      case 'invoice.paid':
        return this.updateSubscriptionFromInvoice(
          event.data.object as StripeInvoicePayload,
          SubscriptionStatus.active,
        );
      case 'invoice.payment_failed':
        return this.updateSubscriptionFromInvoice(
          event.data.object as StripeInvoicePayload,
          SubscriptionStatus.past_due,
        );
      default:
        return false;
    }
  }

  private async syncSubscription(
    subscription: StripeSubscriptionPayload,
    deleted: boolean,
  ): Promise<boolean> {
    const stripeSubscriptionId = stringValue(subscription.id);
    if (!stripeSubscriptionId) return false;

    const metadata = subscription.metadata ?? {};
    const userId = metadata.userId ?? metadata.user_id;
    const status = deleted ? SubscriptionStatus.canceled : subscriptionStatus(subscription.status);
    const plan = subscriptionPlan(metadata.plan);
    const periodEnd = periodEndDate(subscription.current_period_end);

    if (userId) {
      await this.prisma.subscription.upsert({
        where: { userId },
        create: {
          userId,
          stripeSubscriptionId,
          plan,
          status,
          periodEnd,
        },
        update: {
          stripeSubscriptionId,
          plan,
          status,
          periodEnd,
        },
      });
      return true;
    }

    try {
      await this.prisma.subscription.update({
        where: { stripeSubscriptionId },
        data: { plan, status, periodEnd },
      });
      return true;
    } catch (error) {
      if (hasPrismaCode(error, 'P2025')) return false;
      throw error;
    }
  }

  private async updateSubscriptionFromInvoice(
    invoice: StripeInvoicePayload,
    status: SubscriptionStatus,
  ): Promise<boolean> {
    const stripeSubscriptionId = stringValue(invoice.subscription);
    if (!stripeSubscriptionId) return false;

    try {
      await this.prisma.subscription.update({
        where: { stripeSubscriptionId },
        data: { status },
      });
      return true;
    } catch (error) {
      if (hasPrismaCode(error, 'P2025')) return false;
      throw error;
    }
  }

  private async claimEvent(event: StripeWebhookEvent): Promise<boolean> {
    try {
      await this.prisma.stripeWebhookEvent.create({
        data: {
          id: event.id,
          type: event.type,
        },
      });
      return true;
    } catch (error) {
      if (hasPrismaCode(error, 'P2002')) return false;
      throw error;
    }
  }

  private async markProcessed(eventId: string): Promise<void> {
    await this.prisma.stripeWebhookEvent.update({
      where: { id: eventId },
      data: { processedAt: new Date() },
    });
  }

  private async releaseClaim(eventId: string): Promise<void> {
    try {
      await this.prisma.stripeWebhookEvent.delete({ where: { id: eventId } });
    } catch (error) {
      if (!hasPrismaCode(error, 'P2025')) throw error;
    }
  }
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function periodEndDate(value: unknown): Date {
  return typeof value === 'number' && Number.isFinite(value) ? new Date(value * 1000) : new Date();
}

function subscriptionPlan(value: unknown): SubscriptionPlan {
  if (value === SubscriptionPlan.basic || value === SubscriptionPlan.premium) {
    return value;
  }

  return SubscriptionPlan.basic;
}

function subscriptionStatus(value: unknown): SubscriptionStatus {
  switch (value) {
    case 'active':
      return SubscriptionStatus.active;
    case 'canceled':
      return SubscriptionStatus.canceled;
    case 'past_due':
      return SubscriptionStatus.past_due;
    case 'trialing':
      return SubscriptionStatus.trialing;
    default:
      return SubscriptionStatus.past_due;
  }
}

function hasPrismaCode(error: unknown, code: string): boolean {
  return Boolean(
    error &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code?: unknown }).code === code,
  );
}
