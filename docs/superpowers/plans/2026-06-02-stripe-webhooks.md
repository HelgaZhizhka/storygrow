# Stripe Webhooks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire up `POST /api/stripe/webhooks` with signature verification, idempotency, and handlers for 5 Stripe subscription lifecycle events.

**Architecture:** New `BillingModule` in `backend/src/billing/`. Controller verifies Stripe signature using raw request body (`rawBody: true` in NestFactory). Service handles business logic: idempotency check via `StripeWebhookEvent` table, upserts `Subscription` on subscription events, updates status on invoice events. No changes to existing modules except wiring BillingModule into AppModule.

**Tech Stack:** `stripe` SDK, NestJS 11 (`RawBodyRequest`), Prisma, ConfigService.

---

## File map

| Action | Path | Purpose |
|--------|------|---------|
| Modify | `backend/prisma/schema.prisma` | Add `StripeWebhookEvent` model |
| Create | `backend/prisma/migrations/…/migration.sql` | Generated migration |
| Create | `backend/src/billing/billing.service.ts` | Event handlers + idempotency |
| Create | `backend/src/billing/billing.service.spec.ts` | Unit tests for service |
| Create | `backend/src/billing/billing.controller.ts` | `POST /api/stripe/webhooks` |
| Create | `backend/src/billing/billing.controller.spec.ts` | Unit tests for controller |
| Create | `backend/src/billing/billing.module.ts` | NestJS module wiring |
| Modify | `backend/src/app.module.ts` | Import BillingModule |
| Modify | `backend/src/main.ts` | Add `rawBody: true` |

---

## Task 1: Branch + install stripe

- [ ] **Step 1: Create branch**

```bash
git switch -c issue/24-stripe-webhooks
```

- [ ] **Step 2: Install stripe SDK**

```bash
pnpm --filter backend add stripe
```

Expected: `stripe` added to `backend/package.json` dependencies, lockfile updated.

---

## Task 2: Prisma schema + migration

**Files:**
- Modify: `backend/prisma/schema.prisma`

- [ ] **Step 1: Add `StripeWebhookEvent` model to schema**

Add after the `Subscription` model (around line 107):

```prisma
model StripeWebhookEvent {
  id          String   @id
  type        String
  processedAt DateTime @default(now())
}
```

- [ ] **Step 2: Generate and inspect migration**

```bash
docker compose up -d postgres
pnpm --filter backend prisma:migrate -- --name add_stripe_webhook_event
```

Expected: new migration file created at `backend/prisma/migrations/<timestamp>_add_stripe_webhook_event/migration.sql`.

- [ ] **Step 3: Trim HNSW index drift**

Open the generated `migration.sql`. If it contains a line like:

```sql
DROP INDEX "VocabularyEntry_embedding_hnsw_idx";
```

**Delete that line** before continuing. This is a known Prisma drift artefact — the HNSW index lives in a separate migration and Prisma's diff treats it as unexpected. See `docs/progress.md` (2026-06-01 Frictions section).

- [ ] **Step 4: Verify migration applied**

```bash
pnpm --filter backend exec prisma migrate status
```

Expected: `Database schema is up to date!`

---

## Task 3: BillingService — write tests first, then implement

**Files:**
- Create: `backend/src/billing/billing.service.spec.ts`
- Create: `backend/src/billing/billing.service.ts`

- [ ] **Step 1: Write `billing.service.spec.ts`**

```ts
import { Test } from '@nestjs/testing';
import Stripe from 'stripe';
import { BadRequestException } from '@nestjs/common';
import { BillingService } from './billing.service';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionPlan, SubscriptionStatus } from '../../generated/prisma/client';

const makeEvent = (type: string, data: object, id = 'evt_001'): Stripe.Event =>
  ({ id, type, data: { object: data } } as unknown as Stripe.Event);

describe('BillingService', () => {
  let service: BillingService;
  let prisma: {
    stripeWebhookEvent: { findUnique: jest.Mock; create: jest.Mock };
    subscription: { upsert: jest.Mock; updateMany: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      stripeWebhookEvent: { findUnique: jest.fn(), create: jest.fn().mockResolvedValue({}) },
      subscription: { upsert: jest.fn().mockResolvedValue({}), updateMany: jest.fn().mockResolvedValue({}) },
    };

    const module = await Test.createTestingModule({
      providers: [
        BillingService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(BillingService);
  });

  describe('idempotency', () => {
    it('skips processing if event already recorded', async () => {
      prisma.stripeWebhookEvent.findUnique.mockResolvedValue({ id: 'evt_001' });

      await service.handleEvent(makeEvent('customer.subscription.created', {}));

      expect(prisma.stripeWebhookEvent.create).not.toHaveBeenCalled();
      expect(prisma.subscription.upsert).not.toHaveBeenCalled();
    });

    it('records event before processing', async () => {
      prisma.stripeWebhookEvent.findUnique.mockResolvedValue(null);
      const sub = {
        id: 'sub_1', status: 'active', current_period_end: 1700000000,
        metadata: { userId: 'user_1', plan: 'basic' },
      };

      await service.handleEvent(makeEvent('customer.subscription.created', sub));

      expect(prisma.stripeWebhookEvent.create).toHaveBeenCalledWith({
        data: { id: 'evt_001', type: 'customer.subscription.created' },
      });
    });
  });

  describe('customer.subscription.created', () => {
    it('upserts subscription with correct data', async () => {
      prisma.stripeWebhookEvent.findUnique.mockResolvedValue(null);
      const sub = {
        id: 'sub_1', status: 'active', current_period_end: 1700000000,
        metadata: { userId: 'user_1', plan: 'basic' },
      };

      await service.handleEvent(makeEvent('customer.subscription.created', sub));

      expect(prisma.subscription.upsert).toHaveBeenCalledWith({
        where: { stripeSubscriptionId: 'sub_1' },
        create: {
          userId: 'user_1',
          stripeSubscriptionId: 'sub_1',
          plan: SubscriptionPlan.basic,
          status: SubscriptionStatus.active,
          periodEnd: new Date(1700000000 * 1000),
        },
        update: {
          plan: SubscriptionPlan.basic,
          status: SubscriptionStatus.active,
          periodEnd: new Date(1700000000 * 1000),
        },
      });
    });

    it('throws BadRequestException when userId metadata is missing', async () => {
      prisma.stripeWebhookEvent.findUnique.mockResolvedValue(null);
      const sub = {
        id: 'sub_1', status: 'active', current_period_end: 1700000000,
        metadata: {},
      };

      await expect(service.handleEvent(makeEvent('customer.subscription.created', sub)))
        .rejects.toThrow(BadRequestException);
    });
  });

  describe('customer.subscription.updated', () => {
    it('upserts subscription with updated data', async () => {
      prisma.stripeWebhookEvent.findUnique.mockResolvedValue(null);
      const sub = {
        id: 'sub_1', status: 'past_due', current_period_end: 1700000000,
        metadata: { userId: 'user_1', plan: 'premium' },
      };

      await service.handleEvent(makeEvent('customer.subscription.updated', sub, 'evt_002'));

      expect(prisma.subscription.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({ status: SubscriptionStatus.past_due, plan: SubscriptionPlan.premium }),
        }),
      );
    });
  });

  describe('customer.subscription.deleted', () => {
    it('sets status to canceled', async () => {
      prisma.stripeWebhookEvent.findUnique.mockResolvedValue(null);
      const sub = { id: 'sub_1', metadata: {} };

      await service.handleEvent(makeEvent('customer.subscription.deleted', sub, 'evt_003'));

      expect(prisma.subscription.updateMany).toHaveBeenCalledWith({
        where: { stripeSubscriptionId: 'sub_1' },
        data: { status: SubscriptionStatus.canceled },
      });
    });
  });

  describe('invoice.paid', () => {
    it('sets status to active and updates periodEnd', async () => {
      prisma.stripeWebhookEvent.findUnique.mockResolvedValue(null);
      const invoice = { subscription: 'sub_1', period_end: 1700000000 };

      await service.handleEvent(makeEvent('invoice.paid', invoice, 'evt_004'));

      expect(prisma.subscription.updateMany).toHaveBeenCalledWith({
        where: { stripeSubscriptionId: 'sub_1' },
        data: { status: SubscriptionStatus.active, periodEnd: new Date(1700000000 * 1000) },
      });
    });

    it('ignores invoice with no subscription', async () => {
      prisma.stripeWebhookEvent.findUnique.mockResolvedValue(null);
      const invoice = { subscription: null, period_end: 1700000000 };

      await service.handleEvent(makeEvent('invoice.paid', invoice, 'evt_005'));

      expect(prisma.subscription.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('invoice.payment_failed', () => {
    it('sets status to past_due', async () => {
      prisma.stripeWebhookEvent.findUnique.mockResolvedValue(null);
      const invoice = { subscription: 'sub_1', period_end: 1700000000 };

      await service.handleEvent(makeEvent('invoice.payment_failed', invoice, 'evt_006'));

      expect(prisma.subscription.updateMany).toHaveBeenCalledWith({
        where: { stripeSubscriptionId: 'sub_1' },
        data: { status: SubscriptionStatus.past_due },
      });
    });
  });

  describe('unknown event type', () => {
    it('ignores silently without DB write', async () => {
      prisma.stripeWebhookEvent.findUnique.mockResolvedValue(null);

      await service.handleEvent(makeEvent('some.unknown.event', {}, 'evt_007'));

      expect(prisma.subscription.upsert).not.toHaveBeenCalled();
      expect(prisma.subscription.updateMany).not.toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 2: Run tests — expect failure**

```bash
pnpm --filter backend exec jest billing.service --no-coverage 2>&1 | tail -10
```

Expected: `Cannot find module './billing.service'`

- [ ] **Step 3: Write `billing.service.ts`**

```ts
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
      throw new BadRequestException(
        `Missing userId in subscription metadata: ${sub.id}`,
      );
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
```

- [ ] **Step 4: Run tests — expect pass**

```bash
pnpm --filter backend exec jest billing.service --no-coverage 2>&1 | tail -15
```

Expected: `Tests: 9 passed`

- [ ] **Step 5: Commit**

```bash
git add backend/src/billing/billing.service.ts backend/src/billing/billing.service.spec.ts
git commit -m "feat(billing): BillingService — event handlers + idempotency"
```

---

## Task 4: BillingController — write tests first, then implement

**Files:**
- Create: `backend/src/billing/billing.controller.spec.ts`
- Create: `backend/src/billing/billing.controller.ts`

- [ ] **Step 1: Write `billing.controller.spec.ts`**

```ts
import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';

jest.mock('stripe');

describe('BillingController', () => {
  let controller: BillingController;
  let billingService: { handleEvent: jest.Mock };
  let mockConstructEvent: jest.Mock;

  beforeEach(async () => {
    mockConstructEvent = jest.fn();
    (Stripe as jest.MockedClass<typeof Stripe>).mockImplementation(
      () => ({ webhooks: { constructEvent: mockConstructEvent } } as unknown as Stripe),
    );

    billingService = { handleEvent: jest.fn().mockResolvedValue(undefined) };

    const module = await Test.createTestingModule({
      controllers: [BillingController],
      providers: [
        { provide: BillingService, useValue: billingService },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn((key: string) =>
              key === 'STRIPE_SECRET_KEY' ? 'sk_test' : 'whsec_test',
            ),
          },
        },
      ],
    }).compile();

    controller = module.get(BillingController);
  });

  it('throws BadRequestException on invalid Stripe signature', async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error('No signatures found');
    });
    const req = { rawBody: Buffer.from('{}') } as never;

    await expect(controller.handleWebhook('bad-sig', req)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('returns { received: true } and delegates to BillingService on valid event', async () => {
    const fakeEvent = { id: 'evt_1', type: 'invoice.paid' } as Stripe.Event;
    mockConstructEvent.mockReturnValue(fakeEvent);

    const req = { rawBody: Buffer.from('{}') } as never;
    const result = await controller.handleWebhook('valid-sig', req);

    expect(billingService.handleEvent).toHaveBeenCalledWith(fakeEvent);
    expect(result).toEqual({ received: true });
  });

  it('throws BadRequestException when rawBody is missing', async () => {
    const req = { rawBody: undefined } as never;

    await expect(controller.handleWebhook('sig', req)).rejects.toThrow(
      BadRequestException,
    );
  });
});
```

- [ ] **Step 2: Run tests — expect failure**

```bash
pnpm --filter backend exec jest billing.controller --no-coverage 2>&1 | tail -5
```

Expected: `Cannot find module './billing.controller'`

- [ ] **Step 3: Write `billing.controller.ts`**

```ts
import {
  Controller,
  Post,
  Headers,
  Req,
  BadRequestException,
  HttpCode,
  HttpStatus,
  RawBodyRequest,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import Stripe from 'stripe';
import { BillingService } from './billing.service';

@Controller('api/stripe')
export class BillingController {
  private readonly stripe: Stripe;
  private readonly webhookSecret: string;

  constructor(
    private readonly billing: BillingService,
    config: ConfigService,
  ) {
    this.stripe = new Stripe(config.getOrThrow<string>('STRIPE_SECRET_KEY'));
    this.webhookSecret = config.getOrThrow<string>('STRIPE_WEBHOOK_SECRET');
  }

  @Post('webhooks')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Headers('stripe-signature') signature: string,
    @Req() req: RawBodyRequest<Request>,
  ): Promise<{ received: true }> {
    const rawBody = req.rawBody;
    if (!rawBody) throw new BadRequestException('Missing raw body');

    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(rawBody, signature, this.webhookSecret);
    } catch {
      throw new BadRequestException('Invalid Stripe signature');
    }

    await this.billing.handleEvent(event);
    return { received: true };
  }
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
pnpm --filter backend exec jest billing.controller --no-coverage 2>&1 | tail -10
```

Expected: `Tests: 3 passed`

- [ ] **Step 5: Commit**

```bash
git add backend/src/billing/billing.controller.ts backend/src/billing/billing.controller.spec.ts
git commit -m "feat(billing): BillingController — POST /api/stripe/webhooks"
```

---

## Task 5: Module wiring + main.ts rawBody

**Files:**
- Create: `backend/src/billing/billing.module.ts`
- Modify: `backend/src/app.module.ts`
- Modify: `backend/src/main.ts`

- [ ] **Step 1: Write `billing.module.ts`**

```ts
import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [BillingController],
  providers: [BillingService],
})
export class BillingModule {}
```

- [ ] **Step 2: Add `BillingModule` to `AppModule`**

In `backend/src/app.module.ts`, add the import:

```ts
import { BillingModule } from './billing/billing.module';
```

And add `BillingModule` to the `imports` array:

```ts
imports: [
  ConfigModule.forRoot({ isGlobal: true }),
  BullModule.forRootAsync({ ... }),
  PrismaModule,
  AiModule,
  AuthModule,
  BillingModule,   // ← add here
  BooksModule,
  PdfModule,
  GenerationModule,
],
```

- [ ] **Step 3: Enable `rawBody` in `main.ts`**

Change:

```ts
const app = await NestFactory.create(AppModule);
```

To:

```ts
const app = await NestFactory.create(AppModule, { rawBody: true });
```

Full `main.ts` after the change:

```ts
import './instrument';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';

const DEFAULT_PORT = 3001;

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const port = Number(process.env.PORT ?? DEFAULT_PORT);
  await app.listen(port);
}

void bootstrap();
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/billing/billing.module.ts backend/src/app.module.ts backend/src/main.ts
git commit -m "feat(billing): wire BillingModule into AppModule + rawBody"
```

---

## Task 6: Run init.sh + commit schema + PR

- [ ] **Step 1: Run full smoke check**

```bash
./init.sh
```

Expected: all steps green. Backend test count increases by 12 (9 service + 3 controller).

If `tsc` fails with errors about Stripe types, run:
```bash
pnpm --filter backend exec tsc --noEmit 2>&1 | head -20
```
Common fix: Stripe SDK type for `current_period_end` is `number` in newer Stripe versions — if TypeScript complains, cast: `sub.current_period_end as number`.

- [ ] **Step 2: Stage migration + schema + plan + spec**

```bash
git add \
  backend/prisma/schema.prisma \
  backend/prisma/migrations/ \
  docs/superpowers/specs/2026-06-02-stripe-webhooks-design.md \
  docs/superpowers/plans/2026-06-02-stripe-webhooks.md \
  backend/package.json \
  pnpm-lock.yaml
git commit -m "feat(billing): Prisma StripeWebhookEvent + stripe dep + docs"
```

- [ ] **Step 3: Push + open PR**

```bash
git push -u origin issue/24-stripe-webhooks
gh pr create \
  --title "feat(billing): Stripe webhook idempotency + subscription lifecycle" \
  --body "$(cat <<'EOF'
Closes #24

## Summary
- POST /api/stripe/webhooks with Stripe signature verification (rawBody: true)
- Handles: customer.subscription.created/updated/deleted, invoice.paid, invoice.payment_failed
- Idempotent: StripeWebhookEvent table deduplicates by Stripe event ID
- Plan mapped from subscription.metadata.plan; userId from subscription.metadata.userId
- 12 new unit tests (9 service + 3 controller)

## Test plan
- [x] ./init.sh green
- [ ] Manual: stripe listen --forward-to localhost:3001/api/stripe/webhooks
EOF
)"
```

- [ ] **Step 4: Merge after CI green**

```bash
gh pr merge --squash --delete-branch
```

---

## Self-review

**Spec coverage:**
- ✅ `POST /api/stripe/webhooks` + signature verification — Task 4
- ✅ `customer.subscription.created/updated/deleted` — Task 3
- ✅ `invoice.paid / invoice.payment_failed` — Task 3
- ✅ Idempotency via `StripeWebhookEvent` — Task 3
- ✅ `StripeWebhookEvent` Prisma model + migration — Task 2
- ✅ `rawBody: true` in main.ts — Task 5
- ✅ Unit tests for service (9) + controller (3) — Tasks 3 & 4
- ✅ BillingModule wired into AppModule — Task 5

**Placeholder scan:** No TBD, no vague steps. All steps include exact code.

**Type consistency:**
- `handleEvent(event: Stripe.Event)` — defined Task 3, called Task 4 ✅
- `SubscriptionPlan` / `SubscriptionStatus` — imported from `../../generated/prisma/client` in service ✅
- `RawBodyRequest<Request>` from `@nestjs/common` — used in controller, requires `rawBody: true` in main.ts (Task 5 Step 3) ✅
- `billingService.handleEvent` in controller delegates to service ✅
