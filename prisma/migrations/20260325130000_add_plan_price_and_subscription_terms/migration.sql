-- PlanPrice table + subscription term fields (v1.5)

-- Enums
DO $$ BEGIN
  CREATE TYPE "BillingCadence" AS ENUM ('monthly', 'yearly');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "BillingPaymentMethod" AS ENUM ('nwc_auto_renew', 'lightning_one_time');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- PlanPrice
CREATE TABLE IF NOT EXISTS "PlanPrice" (
  "id" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "billingCadence" "BillingCadence" NOT NULL,
  "accessDurationMonths" INTEGER NOT NULL,
  "paymentMethod" "BillingPaymentMethod" NOT NULL,
  "priceUsd" DECIMAL(65,30) NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PlanPrice_pkey" PRIMARY KEY ("id")
);

-- FKs + indexes
DO $$ BEGIN
  ALTER TABLE "PlanPrice"
  ADD CONSTRAINT "PlanPrice_planId_fkey"
  FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "PlanPrice_planId_billingCadence_accessDurationMonths_paymentMethod_key"
ON "PlanPrice" ("planId", "billingCadence", "accessDurationMonths", "paymentMethod");

CREATE INDEX IF NOT EXISTS "PlanPrice_planId_billingCadence_paymentMethod_isActive_idx"
ON "PlanPrice" ("planId", "billingCadence", "paymentMethod", "isActive");

-- Subscription term fields (defaults chosen to preserve current behavior)
ALTER TABLE "Subscription"
ADD COLUMN IF NOT EXISTS "billingCadence" "BillingCadence" NOT NULL DEFAULT 'monthly',
ADD COLUMN IF NOT EXISTS "accessDurationMonths" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS "paymentMethod" "BillingPaymentMethod" NOT NULL DEFAULT 'lightning_one_time';

