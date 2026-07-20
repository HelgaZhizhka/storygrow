import { SubscriptionStatus } from '../generated/prisma/client';

/** A subscription counts as "in effect" for quota and re-subscribe checks. */
export function isActiveSubscriptionStatus(status: SubscriptionStatus | undefined): boolean {
  return status === SubscriptionStatus.active || status === SubscriptionStatus.trialing;
}
