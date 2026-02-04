-- Add Subscription columns expected by schema and sign-up flow (free plan creation).
-- Original subscription migration did not include lastPaymentDate, plan, startDate, amountSats, amountUsd, etc.

ALTER TABLE "public"."Subscription"
  ADD COLUMN IF NOT EXISTS "lastPaymentDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "metadata" JSONB,
  ADD COLUMN IF NOT EXISTS "nextPaymentDue" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "plan" TEXT,
  ADD COLUMN IF NOT EXISTS "startDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "endDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "amountSats" BIGINT,
  ADD COLUMN IF NOT EXISTS "amountUsd" DECIMAL(65,30);
