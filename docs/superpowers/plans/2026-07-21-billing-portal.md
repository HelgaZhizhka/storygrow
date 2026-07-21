# Subscription Cancellation + Payment History (Billing Portal) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a subscribed user cancel their Premium subscription and see past invoices, via one new backend endpoint that creates a Stripe-hosted Billing Portal session, and one frontend link change.

**Architecture:** `POST /api/stripe/portal` (new, in `BillingController`) resolves the user's Stripe customer id (persisted going forward from the subscription webhook; lazily backfilled from Stripe for pre-existing rows) and returns a Portal session URL. `/account`'s existing "Сменить план" link becomes "Управлять подпиской" for premium users, redirecting there.

**Tech Stack:** NestJS, Prisma, Stripe Node SDK (already a dependency), Next.js.

## Global Constraints

- No new npm dependencies — `stripe` is already installed.
- Follow the existing `BillingController`/`BillingService` split: Stripe API calls live in the controller (which already owns the `Stripe` client instance); DB reads/writes live in the service. The new endpoint follows this exactly.
- No custom cancellation/invoice-history UI — the Portal provides both. Do not build an invoice-listing endpoint.
- `stripeCustomerId` is nullable in the schema — never assume it's populated for an existing row.
- Migration file is hand-written (matching Prisma's own `ALTER TABLE ... ADD COLUMN` output), NOT generated via `prisma migrate dev --create-only`, which requires an interactive TTY unavailable in this environment. Apply via `pnpm --filter backend prisma:migrate` should still be attempted first for a real terminal session; if it fails non-interactively, fall back to writing the file by hand and applying with `prisma migrate deploy`.

---

### Task 1: Add `stripeCustomerId` to the `Subscription` model

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/<timestamp>_add_subscription_stripe_customer_id/migration.sql`

**Interfaces:**
- Produces: `Subscription.stripeCustomerId: string | null` — consumed by Task 3 (webhook persistence) and Task 4 (portal endpoint's lazy backfill).

- [ ] **Step 1: Add the field to the schema**

In `backend/prisma/schema.prisma`, find the `Subscription` model:

```prisma
model Subscription {
  id                   String             @id @default(cuid())
  userId               String             @unique
  user                 User               @relation(fields: [userId], references: [id], onDelete: Cascade)
  stripeSubscriptionId String             @unique
  plan                 SubscriptionPlan   @default(free)
  status               SubscriptionStatus
  periodEnd            DateTime
  createdAt            DateTime           @default(now())
  updatedAt            DateTime           @updatedAt
}
```

Add `stripeCustomerId` right after `stripeSubscriptionId`:

```prisma
model Subscription {
  id                   String             @id @default(cuid())
  userId               String             @unique
  user                 User               @relation(fields: [userId], references: [id], onDelete: Cascade)
  stripeSubscriptionId String             @unique
  stripeCustomerId     String?
  plan                 SubscriptionPlan   @default(free)
  status               SubscriptionStatus
  periodEnd            DateTime
  createdAt            DateTime           @default(now())
  updatedAt            DateTime           @updatedAt
}
```

- [ ] **Step 2: Create the migration**

Try the project's migration wrapper first (requires a real interactive terminal):

```bash
pnpm --filter backend prisma:migrate -- --name add_subscription_stripe_customer_id
```

If that fails because the environment is non-interactive (no TTY), create the migration directory and file by hand instead. Directory name format matches existing migrations: `<YYYYMMDDHHMMSS>_add_subscription_stripe_customer_id` (use the current UTC timestamp).

`backend/prisma/migrations/<timestamp>_add_subscription_stripe_customer_id/migration.sql`:

```sql
-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN "stripeCustomerId" TEXT;
```

- [ ] **Step 3: Apply the migration**

```bash
pnpm --filter backend exec dotenv -e .env -- prisma migrate deploy
```

- [ ] **Step 4: Regenerate the Prisma client**

```bash
pnpm --filter backend exec prisma generate
```

- [ ] **Step 5: Verify**

```bash
pnpm --filter backend exec tsc --noEmit
```

Expected: no errors. `Subscription.stripeCustomerId` should now be a recognized field in the generated client types (referenced starting in Task 3).

- [ ] **Step 6: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations
git commit -m "feat(billing): add stripeCustomerId to Subscription (#273)"
```

---

### Task 2: Add `customer` to the `WebhookSubscription` type

**Files:**
- Modify: `backend/src/billing/billing-types.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `WebhookSubscription.customer: string | { id: string }` — consumed by Task 3.

- [ ] **Step 1: Add the field**

In `backend/src/billing/billing-types.ts`, the current `WebhookSubscription` interface is:

```ts
export interface WebhookSubscription {
  id: string;
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
```

Add `customer`. In practice Stripe always sends this as a plain string id on
`customer.subscription.*` webhook payloads (we never request expansion), but
`event.data.object` inside `handleEvent`'s switch is narrowed by TypeScript to
the real `Stripe.Subscription` type (via the discriminated union on
`event.type`), whose `customer` field is `string | Stripe.Customer |
Stripe.DeletedCustomer` — so a narrower `customer: string` here would fail to
typecheck at that call site, not just inside `upsertSubscription`. Referencing
`Stripe.Customer`/`Stripe.DeletedCustomer` directly does NOT resolve in this
SDK version's default export namespace (`Namespace 'StripeConstructor' has no
exported member 'Customer'`) — instead, mirror the minimal inline-shape style
`WebhookInvoice` already uses for the exact same problem on `subscription`
(`string | { id: string }`), which is structurally assignable from both real
Stripe object shapes since they both have an `id: string` field:

```ts
export interface WebhookSubscription {
  id: string;
  customer: string | { id: string };
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
```

- [ ] **Step 2: Verify**

```bash
pnpm --filter backend exec tsc --noEmit
```

Expected: clean — no errors. (An earlier draft of this step expected a failure here on the theory that `upsertSubscription` doesn't consume `customer` yet; that's true, but the type shape above is structurally wide enough that the only thing Task 2 could break — the `event.data.object` call-site assignment — now typechecks cleanly too. If you see any errors, stop and investigate before continuing.)

- [ ] **Step 3: Commit**

```bash
git add backend/src/billing/billing-types.ts
git commit -m "feat(billing): add customer field to WebhookSubscription type (#273)"
```

---

### Task 3: Persist `stripeCustomerId` from the webhook; add portal-support methods to `BillingService`

**Files:**
- Modify: `backend/src/billing/billing.service.ts`
- Modify: `backend/src/billing/billing.service.spec.ts`

**Interfaces:**
- Consumes: `Subscription.stripeCustomerId` (Task 1), `WebhookSubscription.customer` (Task 2).
- Produces:
  - `BillingService.getSubscriptionForPortal(userId: string): Promise<{ stripeSubscriptionId: string; stripeCustomerId: string | null } | null>` — consumed by Task 4.
  - `BillingService.setStripeCustomerId(userId: string, stripeCustomerId: string): Promise<void>` — consumed by Task 4.

- [ ] **Step 1: Write the failing tests**

Add to `backend/src/billing/billing.service.spec.ts`, inside the existing `describe('customer.subscription.created', ...)` block, a new test right after the existing `'upserts subscription with correct data'` test:

```ts
    it('persists the Stripe customer id from the webhook payload', async () => {
      prisma.stripeWebhookEvent.findUnique.mockResolvedValue(null);
      const sub = {
        id: 'sub_1',
        customer: 'cus_abc123',
        status: 'active',
        current_period_end: 1700000000,
        metadata: { userId: 'user_1', plan: 'premium' },
      };

      await service.handleEvent(makeEvent('customer.subscription.created', sub));

      expect(prisma.subscription.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ stripeCustomerId: 'cus_abc123' }),
          update: expect.objectContaining({ stripeCustomerId: 'cus_abc123' }),
        }),
      );
    });
```

Also update the mocked `prisma.subscription` object at the top of the file (currently `{ upsert: jest.fn().mockResolvedValue({}), updateMany: jest.fn().mockResolvedValue({}), findUnique: jest.fn() }`) to add `update: jest.fn().mockResolvedValue({})`, and the `prisma` type annotation in the `let prisma: {...}` declaration to include `update: jest.Mock` alongside the existing `subscription` fields.

At the bottom of the file, before the final closing `});` of the outermost `describe('BillingService', ...)` block, add two new `describe` blocks:

```ts
  describe('getSubscriptionForPortal', () => {
    it('returns null when the user has no subscription', async () => {
      prisma.subscription.findUnique.mockResolvedValue(null);

      const result = await service.getSubscriptionForPortal('user-1');

      expect(result).toBeNull();
    });

    it('returns the subscription and customer ids', async () => {
      prisma.subscription.findUnique.mockResolvedValue({
        stripeSubscriptionId: 'sub_1',
        stripeCustomerId: 'cus_abc123',
      });

      const result = await service.getSubscriptionForPortal('user-1');

      expect(result).toEqual({ stripeSubscriptionId: 'sub_1', stripeCustomerId: 'cus_abc123' });
      expect(prisma.subscription.findUnique).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        select: { stripeSubscriptionId: true, stripeCustomerId: true },
      });
    });
  });

  describe('setStripeCustomerId', () => {
    it('updates the subscription row with the resolved customer id', async () => {
      await service.setStripeCustomerId('user-1', 'cus_abc123');

      expect(prisma.subscription.update).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        data: { stripeCustomerId: 'cus_abc123' },
      });
    });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm --filter backend test -- billing.service
```

Expected: FAIL — `getSubscriptionForPortal is not a function`, `setStripeCustomerId is not a function`, and the customer-id assertion fails (current `upsertSubscription` doesn't read `sub.customer`).

- [ ] **Step 3: Implement**

In `backend/src/billing/billing.service.ts`, the current `upsertSubscription` is:

```ts
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
```

Replace it with (note the new `extractCustomerId` helper — `sub.customer` is typed as `string | { id: string }`, same shape as the existing `extractSubscriptionId` handles for invoices, so this mirrors that pattern):

```ts
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

    await this.prisma.subscription.upsert({
      where: { stripeSubscriptionId: sub.id },
      create: {
        userId,
        stripeSubscriptionId: sub.id,
        stripeCustomerId,
        plan,
        status,
        periodEnd,
      },
      update: { stripeCustomerId, plan, status, periodEnd },
    });
  }

  private extractCustomerId(customer: WebhookSubscription['customer']): string {
    return typeof customer === 'string' ? customer : customer.id;
  }
```

Then add two new public methods, right after `hasActiveSubscription` (which currently ends with `return isActiveSubscriptionStatus(sub?.status);` followed by `}`):

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm --filter backend test -- billing.service
```

Expected: PASS, all tests including the three new ones.

- [ ] **Step 5: Commit**

```bash
git add backend/src/billing/billing.service.ts backend/src/billing/billing.service.spec.ts
git commit -m "feat(billing): persist stripeCustomerId, add portal-support methods (#273)"
```

---

### Task 4: `POST /api/stripe/portal` endpoint

**Files:**
- Modify: `backend/src/billing/billing.controller.ts`
- Modify: `backend/src/billing/billing.controller.spec.ts`

**Interfaces:**
- Consumes: `BillingService.getSubscriptionForPortal` and `BillingService.setStripeCustomerId` (Task 3).
- Produces: `POST /api/stripe/portal` → `{ url: string }` — consumed by Task 5 (frontend).

- [ ] **Step 1: Write the failing tests**

In `backend/src/billing/billing.controller.spec.ts`, update the mocked `billingService` object and its type to add the two new methods:

```ts
    billingService = {
      handleEvent: jest.fn().mockResolvedValue(undefined),
      hasActiveSubscription: jest.fn().mockResolvedValue(false),
      getSubscriptionForPortal: jest.fn(),
      setStripeCustomerId: jest.fn().mockResolvedValue(undefined),
    };
```

and its `let billingService: {...}` type annotation:

```ts
  let billingService: {
    handleEvent: jest.Mock;
    hasActiveSubscription: jest.Mock;
    getSubscriptionForPortal: jest.Mock;
    setStripeCustomerId: jest.Mock;
  };
```

Also add a `mockRetrieveSubscription` alongside the existing `mockCreateSession`/`mockConstructEvent`, and extend the mocked `Stripe` instance shape to include `billingPortal.sessions.create` and `subscriptions.retrieve`:

```ts
  let mockConstructEvent: jest.Mock;
  let mockCreateSession: jest.Mock;
  let mockCreatePortalSession: jest.Mock;
  let mockRetrieveSubscription: jest.Mock;

  beforeEach(async () => {
    mockConstructEvent = jest.fn();
    mockCreateSession = jest.fn();
    mockCreatePortalSession = jest.fn();
    mockRetrieveSubscription = jest.fn();
    (Stripe as jest.MockedClass<typeof Stripe>).mockImplementation(
      () =>
        ({
          webhooks: { constructEvent: mockConstructEvent },
          checkout: { sessions: { create: mockCreateSession } },
          billingPortal: { sessions: { create: mockCreatePortalSession } },
          subscriptions: { retrieve: mockRetrieveSubscription },
        }) as unknown as StripeInstance,
    );
```

Then add a new `describe` block, after the existing `describe('POST /api/stripe/subscribe', ...)` block:

```ts
  describe('POST /api/stripe/portal', () => {
    it('throws NotFoundException when the user has no subscription', async () => {
      billingService.getSubscriptionForPortal.mockResolvedValueOnce(null);

      await expect(controller.createPortalSession(mockUser)).rejects.toThrow(NotFoundException);
      expect(mockCreatePortalSession).not.toHaveBeenCalled();
    });

    it('creates a portal session using the stored customer id', async () => {
      billingService.getSubscriptionForPortal.mockResolvedValueOnce({
        stripeSubscriptionId: 'sub_1',
        stripeCustomerId: 'cus_abc123',
      });
      mockCreatePortalSession.mockResolvedValueOnce({ url: 'https://billing.stripe.com/p/session_1' });

      const result = await controller.createPortalSession(mockUser);

      expect(mockRetrieveSubscription).not.toHaveBeenCalled();
      expect(mockCreatePortalSession).toHaveBeenCalledWith({
        customer: 'cus_abc123',
        return_url: 'http://localhost:3000/account',
      });
      expect(result).toEqual({ url: 'https://billing.stripe.com/p/session_1' });
    });

    it('lazily resolves and persists the customer id when missing on the row', async () => {
      billingService.getSubscriptionForPortal.mockResolvedValueOnce({
        stripeSubscriptionId: 'sub_1',
        stripeCustomerId: null,
      });
      mockRetrieveSubscription.mockResolvedValueOnce({ customer: 'cus_backfilled' });
      mockCreatePortalSession.mockResolvedValueOnce({ url: 'https://billing.stripe.com/p/session_2' });

      const result = await controller.createPortalSession(mockUser);

      expect(mockRetrieveSubscription).toHaveBeenCalledWith('sub_1');
      expect(billingService.setStripeCustomerId).toHaveBeenCalledWith('user-1', 'cus_backfilled');
      expect(mockCreatePortalSession).toHaveBeenCalledWith({
        customer: 'cus_backfilled',
        return_url: 'http://localhost:3000/account',
      });
      expect(result).toEqual({ url: 'https://billing.stripe.com/p/session_2' });
    });

    it('throws BadRequestException when Stripe returns no url', async () => {
      billingService.getSubscriptionForPortal.mockResolvedValueOnce({
        stripeSubscriptionId: 'sub_1',
        stripeCustomerId: 'cus_abc123',
      });
      mockCreatePortalSession.mockResolvedValueOnce({ url: null });

      await expect(controller.createPortalSession(mockUser)).rejects.toThrow(BadRequestException);
    });
  });
```

Add `NotFoundException` to the existing `import { BadRequestException } from '@nestjs/common';` line, making it `import { BadRequestException, NotFoundException } from '@nestjs/common';`.

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm --filter backend test -- billing.controller
```

Expected: FAIL — `controller.createPortalSession is not a function`.

- [ ] **Step 3: Implement**

In `backend/src/billing/billing.controller.ts`, add `NotFoundException` to the existing import:

```ts
import {
  Controller,
  Post,
  Headers,
  Req,
  BadRequestException,
  NotFoundException,
  HttpCode,
  HttpStatus,
  UseGuards,
  type RawBodyRequest,
} from '@nestjs/common';
```

Add a new endpoint right after `createSubscription` (which currently ends with `return { url: session.url }; }`):

```ts
  /** Stripe-hosted Customer Portal: cancellation, invoice history, payment method — no custom UI (#273). */
  @Post('portal')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async createPortalSession(@CurrentUser() user: JwtPayload): Promise<{ url: string }> {
    const sub = await this.billing.getSubscriptionForPortal(user.sub);
    if (!sub) throw new NotFoundException('No subscription found');

    const customerId = sub.stripeCustomerId ?? (await this.resolveCustomerId(sub, user.sub));

    const session = await this.stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${this.frontendUrl}/account`,
    });

    if (!session.url) throw new BadRequestException('Stripe did not return a portal URL');
    return { url: session.url };
  }

  private async resolveCustomerId(
    sub: { stripeSubscriptionId: string },
    userId: string,
  ): Promise<string> {
    const stripeSub = await this.stripe.subscriptions.retrieve(sub.stripeSubscriptionId);
    const customerId =
      typeof stripeSub.customer === 'string' ? stripeSub.customer : stripeSub.customer.id;
    await this.billing.setStripeCustomerId(userId, customerId);
    return customerId;
  }
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm --filter backend test -- billing.controller
```

Expected: PASS, all tests including the four new ones.

- [ ] **Step 5: Full backend check**

```bash
pnpm --filter backend exec tsc --noEmit && pnpm --filter backend lint && pnpm --filter backend test
```

Expected: all clean, all green.

- [ ] **Step 6: Commit**

```bash
git add backend/src/billing/billing.controller.ts backend/src/billing/billing.controller.spec.ts
git commit -m "feat(billing): add POST /api/stripe/portal endpoint (#273)"
```

---

### Task 5: `/account` — "Управлять подпиской" for premium users

**Files:**
- Modify: `frontend/src/app/(app)/account/page.tsx`

**Interfaces:**
- Consumes: `POST /api/stripe/portal` (Task 4), existing `Quota` type from `frontend/src/lib/types.ts`.

- [ ] **Step 1: Implement**

The current subscription card in `frontend/src/app/(app)/account/page.tsx` is:

```tsx
      <div className="sg-card mb-5">
        <span className="sg-section-label">Подписка</span>
        {quota ? (
          <>
            <p className="mt-2 text-text">
              {PLAN_LABELS[quota.plan] ?? quota.plan} · {quota.used} / {quota.limit} книг в месяц
            </p>
            <Link href="/pricing" className="sg-btn sg-btn-ghost mt-3 inline-block">
              Сменить план
            </Link>
          </>
        ) : (
          <p className="mt-2 text-text-3">Загрузка…</p>
        )}
      </div>
```

Replace the whole file with the following. Changes: `isAuthenticated`-style loading/error state for the portal-session call, a `handleManageSubscription` function mirroring `/pricing`'s `handleSubscribe` pattern, and the conditional link.

```tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { getUserEmail } from '@/lib/auth';
import { pluralYears } from '@/lib/ru';
import type { Quota } from '@/lib/types';

interface Child {
  id: string;
  name: string;
  age: number;
}

const PLAN_LABELS: Record<string, string> = {
  free: 'Бесплатный',
  premium: 'Premium',
};

export default function AccountPage(): React.ReactElement {
  const [quota, setQuota] = useState<Quota | null>(null);
  const [children, setChildren] = useState<Child[]>([]);
  const [email, setEmail] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);

  useEffect(() => {
    // getUserEmail reads localStorage, unavailable during SSR — a lazy useState
    // initializer would bake the server's `null` into the HTML and mismatch on
    // hydration once the client re-runs it with the real token, so this reads
    // post-mount instead, same as the quota/children fetches below.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEmail(getUserEmail());
    void api.get<Quota>('/books/quota').then(setQuota);
    void api.get<Child[]>('/children').then(setChildren);
  }, []);

  async function handleManageSubscription(): Promise<void> {
    setPortalLoading(true);
    setPortalError(null);
    try {
      const { url } = await api.post<{ url: string }>('/api/stripe/portal', {});
      window.location.assign(url);
    } catch {
      setPortalError('Не удалось открыть управление подпиской. Попробуйте позже.');
    } finally {
      setPortalLoading(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-[680px] px-7 py-10">
      <h1 className="sg-page-title mb-7">Аккаунт</h1>

      <div className="sg-card mb-5">
        <span className="sg-section-label">Профиль</span>
        <p className="mt-2 text-text">{email ?? '—'}</p>
      </div>

      <div className="sg-card mb-5">
        <span className="sg-section-label">Подписка</span>
        {quota ? (
          <>
            <p className="mt-2 text-text">
              {PLAN_LABELS[quota.plan] ?? quota.plan} · {quota.used} / {quota.limit} книг в месяц
            </p>
            {quota.plan === 'premium' ? (
              <>
                <button
                  onClick={() => void handleManageSubscription()}
                  disabled={portalLoading}
                  className="sg-btn sg-btn-ghost mt-3"
                >
                  {portalLoading ? 'Загрузка…' : 'Управлять подпиской'}
                </button>
                {portalError && <p className="mt-2 text-sm text-danger">{portalError}</p>}
              </>
            ) : (
              <Link href="/pricing" className="sg-btn sg-btn-ghost mt-3 inline-block">
                Сменить план
              </Link>
            )}
          </>
        ) : (
          <p className="mt-2 text-text-3">Загрузка…</p>
        )}
      </div>

      <div className="sg-card">
        <span className="sg-section-label">Дети</span>
        {children.length === 0 ? (
          <p className="mt-2 text-text-3">Пока нет добавленных детей.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {children.map((child) => (
              <li key={child.id} className="text-text">
                {child.name} · {child.age} {pluralYears(child.age)}
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Verify**

```bash
pnpm --filter frontend exec tsc --noEmit && pnpm --filter frontend lint
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/'(app)'/account/page.tsx
git commit -m "feat(account): manage-subscription link for premium users (#273)"
```

---

### Task 6: Full verification and progress log

**Files:**
- Modify: `progress.md`

- [ ] **Step 1: Run the full smoke check**

```bash
./init.sh
```

Expected: `Smoke check PASSED`.

- [ ] **Step 2: Add a progress.md entry**

Append a new dated entry to `progress.md` summarizing: #273 shipped (Stripe Customer Portal for cancellation + payment history), the `stripeCustomerId` migration and its lazy-backfill design, and the manual one-time step the user still needs to do (activate the Portal in the Stripe Dashboard, test mode first) before this is usable end-to-end.

- [ ] **Step 3: Commit**

```bash
git add progress.md
git commit -m "docs(progress): session entry — #273 billing portal"
```
