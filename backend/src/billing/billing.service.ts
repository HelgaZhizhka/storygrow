import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionPlan, SubscriptionStatus } from '../generated/prisma/client';
import { isActiveSubscriptionStatus } from '../prisma/subscription-status.util';
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
    const stripeCustomerId = this.extractCustomerId(sub.customer);

    // Keyed on userId, not stripeSubscriptionId: `Subscription.userId` is the
    // unique constraint that reflects the real business rule (one subscription
    // per user). A user who re-subscribes after cancelling gets a brand-new
    // Stripe subscription object (new stripeSubscriptionId) for the same
    // userId -- keying on stripeSubscriptionId made that case fall through to
    // `create`, which then hit the userId unique constraint against their old
    // row and threw, silently dropping the webhook.
    await this.prisma.subscription.upsert({
      where: { userId },
      create: {
        userId,
        stripeSubscriptionId: sub.id,
        stripeCustomerId,
        plan,
        status,
        periodEnd,
      },
      update: { stripeSubscriptionId: sub.id, stripeCustomerId, plan, status, periodEnd },
    });
  }

  private extractCustomerId(customer: WebhookSubscription['customer']): string {
    return typeof customer === 'string' ? customer : customer.id;
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

  /** Used to block creating a second Stripe checkout session for an already-subscribed user. */
  async hasActiveSubscription(userId: string): Promise<boolean> {
    const sub = await this.prisma.subscription.findUnique({
      where: { userId },
      select: { status: true },
    });
    return isActiveSubscriptionStatus(sub?.status);
  }

  /** Used by BillingController's portal endpoint to resolve which Stripe customer to open the Portal for. */
  async getSubscriptionForPortal(
    userId: string,
  ): Promise<{ stripeSubscriptionId: string; stripeCustomerId: string | null } | null> {
    return this.prisma.subscription.findUnique({
      where: { userId },
      select: { stripeSubscriptionId: true, stripeCustomerId: true },
    });
  }

  /** Lazy-backfill for rows created before stripeCustomerId existed on the schema. */
  async setStripeCustomerId(userId: string, stripeCustomerId: string): Promise<void> {
    await this.prisma.subscription.update({
      where: { userId },
      data: { stripeCustomerId },
    });
  }

  private extractSubscriptionId(invoice: WebhookInvoice): string | null {
    if (typeof invoice.subscription === 'string') return invoice.subscription;
    const sub = invoice.parent?.subscription_details?.subscription;
    if (typeof sub === 'string') return sub;
    return sub?.id ?? null;
  }

  private parsePlan(plan: string | undefined): SubscriptionPlan {
    return plan === 'free' ? SubscriptionPlan.free : SubscriptionPlan.premium;
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
