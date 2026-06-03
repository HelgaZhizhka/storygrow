import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionPlan, SubscriptionStatus } from '../generated/prisma/client';
import type {
  StripeEvent,
  WebhookSubscription,
  WebhookInvoice,
  StripeSubscriptionStatus,
} from './billing-types';

@Injectable()
export class BillingService {
  constructor(private readonly prisma: PrismaService) {}

  async handleEvent(event: StripeEvent): Promise<void> {
    const existing = await this.prisma.stripeWebhookEvent.findUnique({
      where: { id: event.id },
    });
    if (existing) return;

    await this.prisma.stripeWebhookEvent.create({
      data: { id: event.id, type: event.type },
    });

    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await this.upsertSubscription(event.data.object);
        break;
      case 'customer.subscription.deleted':
        await this.cancelSubscription(event.data.object);
        break;
      case 'invoice.paid':
        await this.handleInvoicePaid(event.data.object);
        break;
      case 'invoice.payment_failed':
        await this.handleInvoicePaymentFailed(event.data.object);
        break;
      default:
        break;
    }
  }

  private async upsertSubscription(sub: WebhookSubscription): Promise<void> {
    const userId = sub.metadata?.userId;
    if (!userId) {
      throw new BadRequestException(`Missing userId in subscription metadata: ${sub.id}`);
    }

    const plan = this.parsePlan(sub.metadata?.plan);
    const status = this.parseStatus(sub.status);
    const periodEndEpoch = sub.current_period_end ?? sub.items?.data[0]?.current_period_end;
    if (periodEndEpoch === undefined) {
      throw new BadRequestException(`Missing period_end for subscription: ${sub.id}`);
    }
    const periodEnd = new Date(periodEndEpoch * 1000);

    await this.prisma.subscription.upsert({
      where: { stripeSubscriptionId: sub.id },
      create: { userId, stripeSubscriptionId: sub.id, plan, status, periodEnd },
      update: { plan, status, periodEnd },
    });
  }

  private async cancelSubscription(sub: WebhookSubscription): Promise<void> {
    await this.prisma.subscription.updateMany({
      where: { stripeSubscriptionId: sub.id },
      data: { status: SubscriptionStatus.canceled },
    });
  }

  private async handleInvoicePaid(invoice: WebhookInvoice): Promise<void> {
    const stripeSubscriptionId = this.extractSubscriptionId(invoice);
    if (!stripeSubscriptionId) return;

    await this.prisma.subscription.updateMany({
      where: { stripeSubscriptionId },
      data: {
        status: SubscriptionStatus.active,
        periodEnd: new Date(invoice.period_end * 1000),
      },
    });
  }

  private async handleInvoicePaymentFailed(invoice: WebhookInvoice): Promise<void> {
    const stripeSubscriptionId = this.extractSubscriptionId(invoice);
    if (!stripeSubscriptionId) return;

    await this.prisma.subscription.updateMany({
      where: { stripeSubscriptionId },
      data: { status: SubscriptionStatus.past_due },
    });
  }

  private extractSubscriptionId(invoice: WebhookInvoice): string | null {
    if (typeof invoice.subscription === 'string') return invoice.subscription;
    const sub = invoice.parent?.subscription_details?.subscription;
    if (typeof sub === 'string') return sub;
    return sub?.id ?? null;
  }

  private parsePlan(plan: string | undefined): SubscriptionPlan {
    if (plan === 'free') return SubscriptionPlan.free;
    if (plan === 'premium') return SubscriptionPlan.premium;
    return SubscriptionPlan.basic;
  }

  private parseStatus(status: StripeSubscriptionStatus): SubscriptionStatus {
    const map: Partial<Record<StripeSubscriptionStatus, SubscriptionStatus>> = {
      active: SubscriptionStatus.active,
      canceled: SubscriptionStatus.canceled,
      past_due: SubscriptionStatus.past_due,
      trialing: SubscriptionStatus.trialing,
    };
    return map[status] ?? SubscriptionStatus.past_due;
  }
}
