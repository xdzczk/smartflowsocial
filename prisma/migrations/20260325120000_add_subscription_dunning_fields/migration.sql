-- Add dunning / renewal scheduling fields for subscriptions

ALTER TABLE "Subscription"
ADD COLUMN IF NOT EXISTS "renewalMode" TEXT NOT NULL DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS "renewalFailureCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "lastRenewalAttemptAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "nextRenewalAttemptAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "gracePeriodEndsAt" TIMESTAMP(3);

