-- Create PaymentStatus enum and Payment table (referenced by payment flow; never had a migration).

DO $$ BEGIN
  CREATE TYPE "public"."PaymentStatus" AS ENUM (
    'PENDING',
    'COMPLETED',
    'FAILED',
    'EXPIRED',
    'CANCELED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "public"."Payment" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "amountUsd" DECIMAL(65,30),
  "invoice" TEXT NOT NULL,
  "paymentHash" TEXT NOT NULL,
  "preimage" TEXT,
  "status" "public"."PaymentStatus" NOT NULL DEFAULT 'PENDING',
  "description" TEXT,
  "subscriptionId" TEXT,
  "expiresAt" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "failureReason" TEXT,
  "paymentMethod" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Payment_userId_fkey') THEN
    ALTER TABLE "public"."Payment"
      ADD CONSTRAINT "Payment_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Payment_subscriptionId_fkey') THEN
    ALTER TABLE "public"."Payment"
      ADD CONSTRAINT "Payment_subscriptionId_fkey"
      FOREIGN KEY ("subscriptionId") REFERENCES "public"."Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Payment_userId_idx" ON "public"."Payment"("userId");
CREATE INDEX IF NOT EXISTS "Payment_subscriptionId_idx" ON "public"."Payment"("subscriptionId");
CREATE INDEX IF NOT EXISTS "Payment_status_idx" ON "public"."Payment"("status");
