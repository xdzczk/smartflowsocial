-- Add per-campaign payout settings for trusted autopay + NWC mode

-- Giveaway
ALTER TABLE "Giveaway"
ADD COLUMN IF NOT EXISTS "payoutWalletMode" "PayoutWalletMode" NOT NULL DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS "payoutAutoRunEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "payoutAutoRunSpendCapSats" INTEGER;

CREATE INDEX IF NOT EXISTS "Giveaway_payoutAutoRunEnabled_status_idx"
ON "Giveaway" ("payoutAutoRunEnabled", "status");

-- Contest
ALTER TABLE "Contest"
ADD COLUMN IF NOT EXISTS "payoutWalletMode" "PayoutWalletMode" NOT NULL DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS "payoutAutoRunEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "payoutAutoRunSpendCapSats" INTEGER;

CREATE INDEX IF NOT EXISTS "Contest_payoutAutoRunEnabled_status_idx"
ON "Contest" ("payoutAutoRunEnabled", "status");

