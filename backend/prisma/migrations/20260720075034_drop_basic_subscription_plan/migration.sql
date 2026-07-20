-- Collapse the subscription model to a single paid tier (#268): SubscriptionPlan
-- enum loses `basic`, keeps `free`/`premium`. Standard Postgres enum-value-removal
-- pattern (Postgres has no native DROP VALUE): create a new type without the
-- removed value, migrate the column, swap type names, drop the old type.
BEGIN;

CREATE TYPE "SubscriptionPlan_new" AS ENUM ('free', 'premium');
ALTER TABLE "Subscription" ALTER COLUMN "plan" DROP DEFAULT;
-- Defensive: no known 'basic' rows in prod (Stripe was never wired with real
-- price IDs before #268, so the webhook path that could have written 'basic'
-- never fired), but reassign any that exist rather than fail the deploy.
UPDATE "Subscription" SET "plan" = 'premium' WHERE "plan" = 'basic';
ALTER TABLE "Subscription" ALTER COLUMN "plan" TYPE "SubscriptionPlan_new" USING ("plan"::text::"SubscriptionPlan_new");
ALTER TYPE "SubscriptionPlan" RENAME TO "SubscriptionPlan_old";
ALTER TYPE "SubscriptionPlan_new" RENAME TO "SubscriptionPlan";
DROP TYPE "SubscriptionPlan_old";
ALTER TABLE "Subscription" ALTER COLUMN "plan" SET DEFAULT 'free';

COMMIT;
