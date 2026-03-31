-- CreateEnum
CREATE TYPE "PlanBillingModel" AS ENUM ('free', 'recurring', 'lifetime', 'disabled');

-- AlterTable
ALTER TABLE "Plan" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Plan" ADD COLUMN "planBillingModel" "PlanBillingModel" NOT NULL DEFAULT 'recurring';
ALTER TABLE "Plan" ADD COLUMN "purchasable" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Plan" ADD COLUMN "visibleOnPricingPage" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Plan" ADD COLUMN "isComingSoon" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Plan" ADD COLUMN "isSpecialOffering" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Plan" ADD COLUMN "founderSeatCap" INTEGER;

-- Backfill known plans
UPDATE "Plan"
SET
  "planBillingModel" = 'free',
  "purchasable" = false,
  "sortOrder" = 10
WHERE id = 'free';

UPDATE "Plan"
SET
  "planBillingModel" = 'recurring',
  "purchasable" = true,
  "sortOrder" = 20
WHERE id = 'basic';

UPDATE "Plan"
SET
  "planBillingModel" = 'recurring',
  "purchasable" = true,
  "sortOrder" = 30
WHERE id = 'premium';

UPDATE "Plan"
SET
  "planBillingModel" = 'lifetime',
  "purchasable" = true,
  "isSpecialOffering" = true,
  "founderSeatCap" = 21,
  "sortOrder" = 100
WHERE id = 'founder';

-- Founder: no recurring NWC SKUs; one-time Lightning + BTCPay only at full Plan.price
UPDATE "PlanPrice" SET "isActive" = false WHERE "planId" = 'founder';

UPDATE "PlanPrice"
SET
  "isActive" = true,
  "priceUsd" = (SELECT price FROM "Plan" WHERE id = 'founder')
WHERE
  "planId" = 'founder'
  AND "billingCadence" = 'yearly'
  AND "accessDurationMonths" = 12
  AND "paymentMethod" IN ('lightning_one_time', 'btc_btcpay_onchain');

INSERT INTO "PlanPrice" (
  id,
  "planId",
  "billingCadence",
  "accessDurationMonths",
  "paymentMethod",
  "priceUsd",
  "isActive",
  "createdAt",
  "updatedAt"
)
SELECT
  'pp_founder_lt_ln',
  'founder',
  'yearly'::"BillingCadence",
  12,
  'lightning_one_time'::"BillingPaymentMethod",
  p.price,
  true,
  now(),
  now()
FROM "Plan" p
WHERE p.id = 'founder'
ON CONFLICT ("planId", "billingCadence", "accessDurationMonths", "paymentMethod") DO UPDATE SET
  "isActive" = true,
  "priceUsd" = EXCLUDED."priceUsd",
  "updatedAt" = now();

INSERT INTO "PlanPrice" (
  id,
  "planId",
  "billingCadence",
  "accessDurationMonths",
  "paymentMethod",
  "priceUsd",
  "isActive",
  "createdAt",
  "updatedAt"
)
SELECT
  'pp_founder_lt_btcpay',
  'founder',
  'yearly'::"BillingCadence",
  12,
  'btc_btcpay_onchain'::"BillingPaymentMethod",
  p.price,
  true,
  now(),
  now()
FROM "Plan" p
WHERE p.id = 'founder'
ON CONFLICT ("planId", "billingCadence", "accessDurationMonths", "paymentMethod") DO UPDATE SET
  "isActive" = true,
  "priceUsd" = EXCLUDED."priceUsd",
  "updatedAt" = now();
