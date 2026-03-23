-- CreateEnum
CREATE TYPE "public"."ContestStatus" AS ENUM ('DRAFT', 'LIVE', 'ENDED_REVIEW', 'LOCKED', 'PAYOUT_IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."ContestEntryType" AS ENUM ('REPLY_DIRECT');

-- CreateEnum
CREATE TYPE "public"."ContestRankingMetric" AS ENUM ('REACTIONS', 'ZAPS', 'SATS_ZAPPED');

-- CreateEnum
CREATE TYPE "public"."ContestPrizeMode" AS ENUM ('EQUAL', 'RANKED');

-- CreateEnum
CREATE TYPE "public"."ContestFinalizationFeeStatus" AS ENUM ('NONE', 'PENDING', 'PAID', 'WAIVED');

-- CreateEnum
CREATE TYPE "public"."ContestFinalizationPaymentStatus" AS ENUM ('PENDING', 'PAID', 'EXPIRED', 'FAILED');

-- AlterEnum
ALTER TYPE "public"."PaymentPurpose" ADD VALUE IF NOT EXISTS 'CONTEST_FINALIZATION';

-- AlterTable
ALTER TABLE "public"."Plan" ADD COLUMN "enableContests" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "public"."Payment" ADD COLUMN "contestPayoutForId" TEXT;

-- CreateTable
CREATE TABLE "public"."Contest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "status" "public"."ContestStatus" NOT NULL DEFAULT 'DRAFT',
    "sourceNoteId" TEXT NOT NULL,
    "sourcePostId" TEXT,
    "entryType" "public"."ContestEntryType" NOT NULL DEFAULT 'REPLY_DIRECT',
    "rankingMetric" "public"."ContestRankingMetric" NOT NULL,
    "contestStartAt" TIMESTAMP(3),
    "contestEndAt" TIMESTAMP(3) NOT NULL,
    "freezeSnapshotAt" TIMESTAMP(3),
    "freezeSnapshotWindowEndsAt" TIMESTAMP(3),
    "prizeMode" "public"."ContestPrizeMode" NOT NULL,
    "winnerCount" INTEGER NOT NULL,
    "equalRewardSats" INTEGER,
    "rankRewards" JSONB,
    "fairnessConfig" JSONB,
    "tieBreakRule" TEXT,
    "plannedPayoutSats" INTEGER,
    "finalizationFeeRateBps" INTEGER,
    "finalizationFeeSats" INTEGER,
    "finalizationFeeStatus" "public"."ContestFinalizationFeeStatus",
    "planAtFinalization" TEXT,
    "lockConfigHash" TEXT,
    "payoutState" JSONB,
    "lockedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ContestSnapshot" (
    "id" TEXT NOT NULL,
    "contestId" TEXT NOT NULL,
    "snapshotAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deadlineAt" TIMESTAMP(3) NOT NULL,
    "rankingMetric" "public"."ContestRankingMetric" NOT NULL,
    "tieBreakRule" TEXT NOT NULL,
    "freezeWindowEndsAt" TIMESTAMP(3),
    "totalEntries" INTEGER NOT NULL DEFAULT 0,
    "eligibleEntries" INTEGER NOT NULL DEFAULT 0,
    "excludedEntries" INTEGER NOT NULL DEFAULT 0,
    "rerankCount" INTEGER NOT NULL DEFAULT 0,
    "relayCaveat" TEXT,
    "metadata" JSONB,

    CONSTRAINT "ContestSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ContestEntry" (
    "id" TEXT NOT NULL,
    "contestId" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "entryEventId" TEXT NOT NULL,
    "authorPubkey" TEXT NOT NULL,
    "authorNpub" TEXT,
    "createdAtUnix" INTEGER NOT NULL,
    "replySnippet" TEXT,
    "score" INTEGER NOT NULL DEFAULT 0,
    "reactionsCount" INTEGER NOT NULL DEFAULT 0,
    "zapCount" INTEGER NOT NULL DEFAULT 0,
    "satsZapped" INTEGER NOT NULL DEFAULT 0,
    "rank" INTEGER,
    "isEligible" BOOLEAN NOT NULL DEFAULT true,
    "isExcluded" BOOLEAN NOT NULL DEFAULT false,
    "exclusionReason" TEXT,
    "discoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "snapshotAt" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB,

    CONSTRAINT "ContestEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ContestWinner" (
    "id" TEXT NOT NULL,
    "contestId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "rewardSats" INTEGER NOT NULL,
    "isAlternate" BOOLEAN NOT NULL DEFAULT false,
    "wasPromoted" BOOLEAN NOT NULL DEFAULT false,
    "promotedFromRank" INTEGER,
    "finalizedAt" TIMESTAMP(3),
    "payoutStatus" TEXT,
    "payoutNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContestWinner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ContestEventLog" (
    "id" TEXT NOT NULL,
    "contestId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContestEventLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ContestFinalizationPayment" (
    "id" TEXT NOT NULL,
    "contestId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planName" TEXT NOT NULL,
    "feeRateBps" INTEGER NOT NULL,
    "plannedPayoutSats" INTEGER NOT NULL,
    "feeSats" INTEGER NOT NULL,
    "lockConfigHash" TEXT NOT NULL,
    "status" "public"."ContestFinalizationPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paymentMethod" TEXT,
    "paymentId" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "ContestFinalizationPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Contest_userId_idx" ON "public"."Contest"("userId");

-- CreateIndex
CREATE INDEX "Contest_userId_status_idx" ON "public"."Contest"("userId", "status");

-- CreateIndex
CREATE INDEX "Contest_userId_createdAt_idx" ON "public"."Contest"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ContestSnapshot_contestId_snapshotAt_idx" ON "public"."ContestSnapshot"("contestId", "snapshotAt");

-- CreateIndex
CREATE UNIQUE INDEX "ContestEntry_snapshotId_entryEventId_key" ON "public"."ContestEntry"("snapshotId", "entryEventId");

-- CreateIndex
CREATE INDEX "ContestEntry_contestId_rank_idx" ON "public"."ContestEntry"("contestId", "rank");

-- CreateIndex
CREATE INDEX "ContestEntry_contestId_isExcluded_idx" ON "public"."ContestEntry"("contestId", "isExcluded");

-- CreateIndex
CREATE INDEX "ContestEntry_snapshotAt_idx" ON "public"."ContestEntry"("snapshotAt");

-- CreateIndex
CREATE UNIQUE INDEX "ContestWinner_entryId_key" ON "public"."ContestWinner"("entryId");

-- CreateIndex
CREATE UNIQUE INDEX "ContestWinner_contestId_rank_isAlternate_key" ON "public"."ContestWinner"("contestId", "rank", "isAlternate");

-- CreateIndex
CREATE INDEX "ContestWinner_contestId_isAlternate_rank_idx" ON "public"."ContestWinner"("contestId", "isAlternate", "rank");

-- CreateIndex
CREATE INDEX "ContestEventLog_contestId_createdAt_idx" ON "public"."ContestEventLog"("contestId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ContestFinalizationPayment_paymentId_key" ON "public"."ContestFinalizationPayment"("paymentId");

-- CreateIndex
CREATE INDEX "ContestFinalizationPayment_contestId_idx" ON "public"."ContestFinalizationPayment"("contestId");

-- CreateIndex
CREATE INDEX "ContestFinalizationPayment_userId_idx" ON "public"."ContestFinalizationPayment"("userId");

-- CreateIndex
CREATE INDEX "ContestFinalizationPayment_contestId_status_idx" ON "public"."ContestFinalizationPayment"("contestId", "status");

-- AddForeignKey
ALTER TABLE "public"."Contest" ADD CONSTRAINT "Contest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ContestSnapshot" ADD CONSTRAINT "ContestSnapshot_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "public"."Contest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ContestEntry" ADD CONSTRAINT "ContestEntry_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "public"."Contest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ContestEntry" ADD CONSTRAINT "ContestEntry_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "public"."ContestSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ContestWinner" ADD CONSTRAINT "ContestWinner_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "public"."Contest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ContestWinner" ADD CONSTRAINT "ContestWinner_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "public"."ContestEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ContestEventLog" ADD CONSTRAINT "ContestEventLog_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "public"."Contest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ContestFinalizationPayment" ADD CONSTRAINT "ContestFinalizationPayment_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "public"."Contest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ContestFinalizationPayment" ADD CONSTRAINT "ContestFinalizationPayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ContestFinalizationPayment" ADD CONSTRAINT "ContestFinalizationPayment_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "public"."Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Payment" ADD CONSTRAINT "Payment_contestPayoutForId_fkey" FOREIGN KEY ("contestPayoutForId") REFERENCES "public"."Contest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
