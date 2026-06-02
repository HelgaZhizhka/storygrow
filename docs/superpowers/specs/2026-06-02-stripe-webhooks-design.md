# Stripe Webhooks — Design Spec

**Issue:** #24  
**Date:** 2026-06-02  
**Status:** approved

---

## Context

No billing module exists. The `Subscription` Prisma model is in place (userId, stripeSubscriptionId, plan, status, periodEnd). This issue wires up the Stripe webhook endpoint so subscription state stays in sync with Stripe.

Quota enforcement (POST /books checks remaining books) is **#25** — out of scope here.

---

## Architecture

New module `backend/src/billing/` with:

```
backend/src/billing/
├── billing.module.ts
├── billing.controller.ts
├── billing.controller.spec.ts
├── billing.service.ts
└── billing.service.spec.ts
```

`BillingModule` added to `AppModule`. No other modules touched.

---

## Raw body handling

Stripe signature verification (`stripe.webhooks.constructEvent`) requires the raw request buffer, not the parsed JSON body. Solution: enable `rawBody: true` in `NestFactory.create()` (NestJS 11 built-in). The raw buffer is then available on `req.rawBody` via the `RawBodyRequest` type from `@nestjs/common`.

**Change to `main.ts`:**
```ts
const app = await NestFactory.create(AppModule, { rawBody: true });
```

---

## Idempotency

Stripe may re-deliver events. New Prisma model:

```prisma
model StripeWebhookEvent {
  id          String   @id    // Stripe event ID ("evt_...")
  type        String
  processedAt DateTime @default(now())
}
```

On every incoming event: check if `id` exists → if yes, return `{ received: true }` immediately without processing.

---

## Plan mapping

`SubscriptionPlan` is derived from `subscription.metadata.plan` (`"free"` | `"basic"` | `"premium"`). Default `basic` if missing. When creating a checkout session (future issue), metadata must include `{ plan: "basic", userId: "<id>" }`.

`userId` comes from `subscription.metadata.userId`.

---

## Event handlers

| Stripe event | Action |
|---|---|
| `customer.subscription.created` | Upsert `Subscription` with plan/status/periodEnd |
| `customer.subscription.updated` | Upsert `Subscription` with plan/status/periodEnd |
| `customer.subscription.deleted` | Set `status = canceled` |
| `invoice.paid` | Set `status = active`, update `periodEnd` from `current_period_end` |
| `invoice.payment_failed` | Set `status = past_due` |

Unknown event types are silently ignored (return `{ received: true }`).

### Upsert shape (subscription events)

```ts
{
  where: { stripeSubscriptionId },
  create: { userId, stripeSubscriptionId, plan, status, periodEnd },
  update: { plan, status, periodEnd },
}
```

`userId` is required for `create`. If `subscription.metadata.userId` is missing on a `created` event, throw `BadRequestException` (Stripe will retry — we don't want to silently eat it).

### Invoice events

Invoice has `subscription` field (subscription ID string). Look up `Subscription` by `stripeSubscriptionId`. If not found, ignore (can happen if subscription was created outside our flow).

---

## Controller

```
POST /api/stripe/webhooks
```

- No JWT auth (public endpoint, authenticated via Stripe signature)
- Reads `stripe-signature` header + `req.rawBody`
- Calls `stripe.webhooks.constructEvent()` → throws `BadRequestException` on invalid signature
- Delegates to `BillingService.handleEvent(event)`
- Returns `{ received: true }` with HTTP 200

---

## Dependencies

Add to `backend`:
- `stripe` — official Stripe Node SDK

---

## Environment variables

Already in `.env.example`:
- `STRIPE_SECRET_KEY` — used to construct the Stripe client
- `STRIPE_WEBHOOK_SECRET` — used in `constructEvent()` for signature verification

---

## Tests

### `billing.service.spec.ts`
- Idempotency: duplicate event ID → no DB write, returns early
- `customer.subscription.created` → upsert called with correct shape
- `customer.subscription.updated` → upsert called with correct shape  
- `customer.subscription.deleted` → update status to canceled
- `invoice.paid` → update status to active + periodEnd
- `invoice.payment_failed` → update status to past_due
- Unknown event type → no DB write, no throw

### `billing.controller.spec.ts`
- Invalid signature → `BadRequestException` (400)
- Valid event → delegates to `BillingService.handleEvent`, returns `{ received: true }`

---

## Migration

One new migration: `add_stripe_webhook_event` — creates `StripeWebhookEvent` table.

---

## Out of scope

- Checkout session creation (future issue)
- Customer portal
- Quota enforcement (#25)
- Frontend payment UI (#78)
