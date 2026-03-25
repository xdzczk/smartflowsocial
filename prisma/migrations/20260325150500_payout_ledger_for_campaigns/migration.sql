-- Payout ledger for contests + giveaways (non-custodial NWC batch payouts)

-- Enums
DO $$ BEGIN
  CREATE TYPE "PayoutRunScope" AS ENUM ('CONTEST', 'GIVEAWAY');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "PayoutWalletMode" AS ENUM ('manual', 'nwc_creator');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "PayoutRunTrigger" AS ENUM ('manual_trigger', 'autorun');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "PayoutRunStatus" AS ENUM ('draft', 'running', 'partial', 'complete', 'failed', 'skipped');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "PayoutItemStatus" AS ENUM ('pending', 'paid', 'failed', 'claim_needed', 'skipped');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "PayoutAttemptStatus" AS ENUM ('started', 'succeeded', 'failed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Tables
CREATE TABLE IF NOT EXISTS "PayoutRun" (
  "id" TEXT NOT NULL,
  "scope" "PayoutRunScope" NOT NULL,
  "userId" TEXT NOT NULL,
  "walletMode" "PayoutWalletMode" NOT NULL DEFAULT 'manual',
  "trigger" "PayoutRunTrigger" NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "contestId" TEXT,
  "giveawayId" TEXT,
  "spendCapSats" INTEGER,
  "totalSats" INTEGER,
  "totalItems" INTEGER,
  "status" "PayoutRunStatus" NOT NULL DEFAULT 'draft',
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "eligibilityErrorCode" TEXT,
  "eligibilityErrorMessage" TEXT,
  "metadataJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PayoutRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PayoutItem" (
  "id" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "winnerPubkey" TEXT NOT NULL,
  "amountSats" INTEGER NOT NULL,
  "lnAddressSnapshot" TEXT,
  "destinationSnapshot" JSONB,
  "invoice" TEXT,
  "invoiceExpiresAt" TIMESTAMP(3),
  "walletRequestId" TEXT,
  "paymentPreimage" TEXT,
  "paymentHash" TEXT,
  "status" "PayoutItemStatus" NOT NULL DEFAULT 'pending',
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "lastAttemptAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PayoutItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PayoutAttempt" (
  "id" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "attemptNumber" INTEGER NOT NULL,
  "status" "PayoutAttemptStatus" NOT NULL DEFAULT 'started',
  "idempotencyKey" TEXT NOT NULL,
  "walletRequestId" TEXT,
  "walletResponseJson" JSONB,
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),

  CONSTRAINT "PayoutAttempt_pkey" PRIMARY KEY ("id")
);

-- Foreign keys
DO $$ BEGIN
  ALTER TABLE "PayoutRun"
  ADD CONSTRAINT "PayoutRun_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "PayoutRun"
  ADD CONSTRAINT "PayoutRun_contestId_fkey"
  FOREIGN KEY ("contestId") REFERENCES "Contest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "PayoutRun"
  ADD CONSTRAINT "PayoutRun_giveawayId_fkey"
  FOREIGN KEY ("giveawayId") REFERENCES "Giveaway"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "PayoutItem"
  ADD CONSTRAINT "PayoutItem_runId_fkey"
  FOREIGN KEY ("runId") REFERENCES "PayoutRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "PayoutAttempt"
  ADD CONSTRAINT "PayoutAttempt_runId_fkey"
  FOREIGN KEY ("runId") REFERENCES "PayoutRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "PayoutAttempt"
  ADD CONSTRAINT "PayoutAttempt_itemId_fkey"
  FOREIGN KEY ("itemId") REFERENCES "PayoutItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Uniques and indexes
CREATE UNIQUE INDEX IF NOT EXISTS "PayoutItem_runId_winnerPubkey_key" ON "PayoutItem"("runId", "winnerPubkey");
CREATE INDEX IF NOT EXISTS "PayoutItem_runId_status_idx" ON "PayoutItem"("runId", "status");
CREATE INDEX IF NOT EXISTS "PayoutItem_status_updatedAt_idx" ON "PayoutItem"("status", "updatedAt");
CREATE INDEX IF NOT EXISTS "PayoutItem_winnerPubkey_idx" ON "PayoutItem"("winnerPubkey");

CREATE UNIQUE INDEX IF NOT EXISTS "PayoutRun_idempotencyKey_key" ON "PayoutRun"("idempotencyKey");
CREATE UNIQUE INDEX IF NOT EXISTS "PayoutAttempt_idempotencyKey_key" ON "PayoutAttempt"("idempotencyKey");
CREATE UNIQUE INDEX IF NOT EXISTS "PayoutAttempt_itemId_attemptNumber_key" ON "PayoutAttempt"("itemId", "attemptNumber");
CREATE INDEX IF NOT EXISTS "PayoutAttempt_runId_startedAt_idx" ON "PayoutAttempt"("runId", "startedAt");
CREATE INDEX IF NOT EXISTS "PayoutAttempt_itemId_startedAt_idx" ON "PayoutAttempt"("itemId", "startedAt");

CREATE INDEX IF NOT EXISTS "PayoutRun_userId_createdAt_idx" ON "PayoutRun"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "PayoutRun_scope_status_createdAt_idx" ON "PayoutRun"("scope", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "PayoutRun_contestId_idx" ON "PayoutRun"("contestId");
CREATE INDEX IF NOT EXISTS "PayoutRun_giveawayId_idx" ON "PayoutRun"("giveawayId");

