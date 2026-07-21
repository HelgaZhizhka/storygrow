# Subscription Cancellation + Payment History Design

## Goal

Give a subscribed user a way to cancel their Premium subscription and see past charges, closing the two gaps #271 explicitly deferred (tracked as #273).

## Approach: Stripe-hosted Customer Portal

Rather than building cancel and invoice-history UI and endpoints ourselves, use Stripe's hosted Billing Portal. One new backend endpoint creates a Portal session and returns its URL; the frontend redirects there. The Portal itself provides cancellation, invoice history, and payment-method update — no separate invoice-listing endpoint or UI is needed, because Stripe hosts all of it.

Trade-off accepted: the user briefly leaves the app (redirected to `billing.stripe.com`) instead of everything staying in our own UI. Given StoryGrow has a single paid tier and this is backlog (not a launch blocker), the lower engineering cost outweighs owning that UX.

## Backend

### New endpoint: `POST /api/stripe/portal`

- `BillingController`, same shape as the existing `subscribe` endpoint: `@UseGuards(JwtAuthGuard)`, returns `{ url: string }`.
- Looks up the user's `Subscription` row. 404 if none exists (a free-tier user has nothing to manage).
- Resolves the Stripe customer id for that subscription (see below), then calls `stripe.billingPortal.sessions.create({ customer: stripeCustomerId, return_url: \`${frontendUrl}/account\` })`.

### Storing the Stripe customer id

`Subscription` currently stores `stripeSubscriptionId` but not the customer id, which the Portal API requires.

- **Schema**: add nullable `stripeCustomerId String?` to `Subscription` (migration).
- **Going forward**: `BillingService.upsertSubscription` (called from the `customer.subscription.created`/`updated` webhook handlers) also persists `sub.customer`. Requires adding `customer: string` to the `WebhookSubscription` type in `billing-types.ts`.
- **Backfilling existing rows** (the user's own already-active production subscription predates this column): lazy, on first use. When `POST /api/stripe/portal` runs and finds `stripeCustomerId` is null on the row, it fetches the subscription live via `stripe.subscriptions.retrieve(stripeSubscriptionId)`, reads `.customer`, persists it to the row, and proceeds. No separate one-off backfill script.

### Manual setup required (not code)

Stripe's Customer Portal must be activated once per Stripe mode (test, later live) at `dashboard.stripe.com/test/settings/billing/portal` before `billingPortal.sessions.create` will succeed — same category of one-time manual step as registering `STRIPE_PRICE_ID` and the webhook endpoint earlier this project. The user does this herself when the code is ready to test.

## Frontend

On `/account` (`frontend/src/app/(app)/account/page.tsx`), the existing "Сменить план" link (→ `/pricing`) changes based on plan:

- **`quota.plan === 'premium'`**: link becomes "Управлять подпиской" — calls `POST /api/stripe/portal`, redirects the browser to the returned `url` (`window.location.assign`, matching the existing `handleSubscribe` pattern on `/pricing`).
- **`quota.plan === 'free'`**: unchanged, still links to `/pricing`.

## Testing

- `BillingService`: unit test for the customer-id lazy-backfill path (row has null `stripeCustomerId` → fetches from Stripe → persists → returns it) and the already-populated path (no Stripe call needed).
- `BillingController`: unit test for the new `portal` endpoint — 404 when no subscription exists, returns `{ url }` on success, propagates a clean error if Stripe doesn't return a URL (mirrors the existing `subscribe` endpoint's `session.url` check).
- Frontend: no new component, so no new render test strictly required; the conditional link swap is simple enough to verify manually against both plan states, consistent with how `/pricing`'s existing plan-conditional link was verified.

## Out of scope

- Building any custom cancellation confirmation UI, invoice list, or payment-method form — the Portal replaces all of it.
- Configuring the Portal's exact feature set (which tabs/actions are enabled) — that's a Stripe Dashboard configuration concern, done once by the user, not application code.
- #273's original suggestion of a dedicated invoice-listing endpoint — superseded by the Portal choice.
