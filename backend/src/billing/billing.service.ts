import { Injectable, BadRequestException } from '@nestjs/common';
import Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionPlan, SubscriptionStatus } from '../../generated/prisma/client';

@Injectable()
export class BillingService {
  constructor(private readonly prisma: PrismaService) {}

  async handleEvent(event: Stripe.Event): Promise<void> {
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
        await this.upsertSubscription(event.data.object as Stripe.Subscription);
        break;
      case 'customer.subscription.deleted':
        await this.cancelSubscription(event.data.object as Stripe.Subscription);
        break;
      case 'invoice.paid':
        await this.handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;
      case 'invoice.payment_failed':
        await this.handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      default:
        break;
    }
  }

  private async upsertSubscription(sub: Stripe.Subscription): Promise<void> {
    const userId = sub.metadata?.userId;
    if (!userId) {
      throw new BadRequestException(`Missing userId in subscription metadata: ${sub.id}`);
    }

    const plan = this.parsePlan(sub.metadata?.plan);
    const status = this.parseStatus(sub.status);
    const periodEnd = new Date((sub.current_period_end as number) * 1000);

    await this.prisma.subscription.upsert({
      where: { stripeSubscriptionId: sub.id },
      create: { userId, stripeSubscriptionId: sub.id, plan, status, periodEnd },
      update: { plan, status, periodEnd },
    });
  }

  private async cancelSubscription(sub: Stripe.Subscription): Promise<void> {
    await this.prisma.subscription.updateMany({
      where: { stripeSubscriptionId: sub.id },
      data: { status: SubscriptionStatus.canceled },
    });
  }

  private async handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
    const stripeSubscriptionId =
      typeof invoice.subscription === 'string' ? invoice.subscription : null;
    if (!stripeSubscriptionId) return;

    await this.prisma.subscription.updateMany({
      where: { stripeSubscriptionId },
      data: {
        status: SubscriptionStatus.active,
        periodEnd: new Date((invoice.period_end as number) * 1000),
      },
    });
  }

  private async handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    const stripeSubscriptionId =
      typeof invoice.subscription === 'string' ? invoice.subscription : null;
    if (!stripeSubscriptionId) return;

    await this.prisma.subscription.updateMany({
      where: { stripeSubscriptionId },
      data: { status: SubscriptionStatus.past_due },
    });
  }

  private parsePlan(plan: string | undefined): SubscriptionPlan {
    if (plan === 'free') return SubscriptionPlan.free;
    if (plan === 'premium') return SubscriptionPlan.premium;
    return SubscriptionPlan.basic;
  }

  private parseStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
    const map: Partial<Record<Stripe.Subscription.Status, SubscriptionStatus>> = {
      active: SubscriptionStatus.active,
      canceled: SubscriptionStatus.canceled,
      past_due: SubscriptionStatus.past_due,
      trialing: SubscriptionStatus.trialing,
    };
    return map[status] ?? SubscriptionStatus.past_due;
  }
}
