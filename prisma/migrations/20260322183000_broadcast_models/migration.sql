-- CreateEnum
CREATE TYPE "BroadcastCampaignStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'QUEUED', 'SENDING', 'COMPLETED', 'PAUSED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BroadcastAudienceType" AS ENUM ('CUSTOM', 'FOLLOWING', 'MUTUALS');

-- CreateEnum
CREATE TYPE "BroadcastDeliveryMode" AS ENUM ('BEST_COMPATIBILITY', 'NIP17_ONLY', 'NIP04_ONLY', 'NIP17_FALLBACK_NIP04', 'BOTH');

-- CreateEnum
CREATE TYPE "BroadcastSendStrategy" AS ENUM ('STANDARD', 'STAGGERED');

-- CreateEnum
CREATE TYPE "BroadcastRecipientStatus" AS ENUM ('PENDING', 'READY', 'QUEUED', 'SENDING', 'SENT', 'FAILED', 'SUPPRESSED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "BroadcastSuppressionSource" AS ENUM ('MANUAL', 'OPT_OUT', 'AUTO');

-- CreateEnum
CREATE TYPE "BroadcastEventLogLevel" AS ENUM ('INFO', 'WARNING', 'ERROR');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "broadcastSettings" JSONB;

-- CreateTable
CREATE TABLE "BroadcastCampaign" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "BroadcastCampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "audienceType" "BroadcastAudienceType" NOT NULL,
    "messageBody" TEXT NOT NULL,
    "deliveryMode" "BroadcastDeliveryMode" NOT NULL DEFAULT 'BEST_COMPATIBILITY',
    "sendStrategy" "BroadcastSendStrategy" NOT NULL DEFAULT 'STANDARD',
    "scheduledFor" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "totalRecipients" INTEGER NOT NULL DEFAULT 0,
    "queuedCount" INTEGER NOT NULL DEFAULT 0,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "suppressedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "customNpubLines" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BroadcastCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BroadcastRecipient" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "recipientPubkey" TEXT NOT NULL,
    "sourceType" "BroadcastAudienceType",
    "status" "BroadcastRecipientStatus" NOT NULL DEFAULT 'PENDING',
    "skipReason" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "signedEvent" JSONB,
    "giftWraps" JSONB,
    "publishRelays" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "publishedNip04EventId" TEXT,
    "lastAttemptAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "failureCode" TEXT,
    "failureReason" TEXT,
    "staggerDelayMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BroadcastRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BroadcastSuppression" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "recipientPubkey" TEXT NOT NULL,
    "reason" TEXT,
    "source" "BroadcastSuppressionSource" NOT NULL DEFAULT 'MANUAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BroadcastSuppression_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BroadcastEventLog" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "level" "BroadcastEventLogLevel" NOT NULL DEFAULT 'INFO',
    "eventType" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BroadcastEventLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BroadcastCampaign_userId_status_updatedAt_idx" ON "BroadcastCampaign"("userId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "BroadcastCampaign_userId_createdAt_idx" ON "BroadcastCampaign"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "BroadcastRecipient_campaignId_status_idx" ON "BroadcastRecipient"("campaignId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "BroadcastRecipient_campaignId_recipientPubkey_key" ON "BroadcastRecipient"("campaignId", "recipientPubkey");

-- CreateIndex
CREATE INDEX "BroadcastSuppression_userId_idx" ON "BroadcastSuppression"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "BroadcastSuppression_userId_recipientPubkey_key" ON "BroadcastSuppression"("userId", "recipientPubkey");

-- CreateIndex
CREATE INDEX "BroadcastEventLog_campaignId_createdAt_idx" ON "BroadcastEventLog"("campaignId", "createdAt");

-- AddForeignKey
ALTER TABLE "BroadcastCampaign" ADD CONSTRAINT "BroadcastCampaign_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BroadcastRecipient" ADD CONSTRAINT "BroadcastRecipient_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "BroadcastCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BroadcastSuppression" ADD CONSTRAINT "BroadcastSuppression_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BroadcastEventLog" ADD CONSTRAINT "BroadcastEventLog_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "BroadcastCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
