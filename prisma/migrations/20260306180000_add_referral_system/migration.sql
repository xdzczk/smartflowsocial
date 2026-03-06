-- CreateEnum
CREATE TYPE "ReferralEarningStatus" AS ENUM ('PENDING', 'PAID', 'FAILED');

-- CreateTable
CREATE TABLE "Referral" (
    "referrer_npub" TEXT NOT NULL,
    "referred_npub" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Referral_pkey" PRIMARY KEY ("referred_npub")
);

-- CreateTable
CREATE TABLE "ReferralEarning" (
    "id" TEXT NOT NULL,
    "referrer_npub" TEXT NOT NULL,
    "referred_npub" TEXT NOT NULL,
    "payment_id" TEXT NOT NULL,
    "amount_paid_sats" INTEGER NOT NULL,
    "commission_sats" INTEGER NOT NULL,
    "status" "ReferralEarningStatus" NOT NULL DEFAULT 'PENDING',
    "payout_attempt_count" INTEGER NOT NULL DEFAULT 0,
    "payout_failure_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paid_at" TIMESTAMP(3),

    CONSTRAINT "ReferralEarning_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferrerPayoutConfig" (
    "referrer_npub" TEXT NOT NULL,
    "payout_destination" TEXT NOT NULL,
    "payout_destination_type" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferrerPayoutConfig_pkey" PRIMARY KEY ("referrer_npub")
);

-- CreateIndex
CREATE UNIQUE INDEX "Referral_referred_npub_key" ON "Referral"("referred_npub");

-- CreateIndex
CREATE INDEX "Referral_referrer_npub_idx" ON "Referral"("referrer_npub");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralEarning_referrer_npub_payment_id_key" ON "ReferralEarning"("referrer_npub", "payment_id");

-- CreateIndex
CREATE INDEX "ReferralEarning_referrer_npub_idx" ON "ReferralEarning"("referrer_npub");

-- CreateIndex
CREATE INDEX "ReferralEarning_status_idx" ON "ReferralEarning"("status");
