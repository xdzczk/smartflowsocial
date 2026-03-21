-- CreateTable
CREATE TABLE "referral_payout_audit_log" (
    "id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "referrer_npub" TEXT,
    "amount_sats" INTEGER,
    "status" TEXT NOT NULL,
    "batch_summary" JSONB,
    "error_message" TEXT,
    "operator_npub" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referral_payout_audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "referral_payout_audit_log_created_at_idx" ON "referral_payout_audit_log"("created_at");

-- CreateIndex
CREATE INDEX "Post_publishedAt_idx" ON "Post"("publishedAt");

-- CreateIndex
CREATE INDEX "LongFormPost_publishedAt_idx" ON "LongFormPost"("publishedAt");
