import Stripe from 'stripe';

type StripeInst = InstanceType<typeof Stripe>;

export type StripeInstance = StripeInst;
export type StripeEvent = ReturnType<StripeInst['webhooks']['constructEvent']>;

export interface WebhookSubscription {
  id: string;
  customer: string;
  metadata: Record<string, string | undefined>;
  status:
    | 'active'
    | 'past_due'
    | 'canceled'
    | 'trialing'
    | 'incomplete'
    | 'incomplete_expired'
    | 'unpaid'
    | 'paused';
  // v1 API: top-level field; v2 API: moved to items.data[].current_period_end
  current_period_end?: number;
  items?: { data: Array<{ current_period_end?: number }> };
}

export interface WebhookInvoice {
  period_end: number;
  // v1 API: direct field; v2 API: nested at parent.subscription_details.subscription
  subscription?: string | null;
  parent?: {
    subscription_details?: { subscription?: string | { id: string } | null } | null;
  } | null;
}

export type StripeSubscriptionStatus = WebhookSubscription['status'];
