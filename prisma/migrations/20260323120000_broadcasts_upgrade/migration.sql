-- AlterEnum: new campaign lifecycle values
ALTER TYPE "BroadcastCampaignStatus" ADD VALUE IF NOT EXISTS 'AWAITING_SIGNATURE';
ALTER TYPE "BroadcastCampaignStatus" ADD VALUE IF NOT EXISTS 'COMPLETED_WITH_FAILURES';

-- CreateEnum
CREATE TYPE "BroadcastSuppressionReasonCode" AS ENUM ('MANUAL_OPT_OUT', 'FAILED_REPEATEDLY', 'COMPLAINT_OR_ABUSE', 'DUPLICATE_PROTECTION', 'IMPORTED', 'POLICY_BLOCK', 'OTHER');

-- CreateEnum
CREATE TYPE "BroadcastRecipientDeliveryMethod" AS ENUM ('NIP04', 'NIP17', 'BOTH', 'UNKNOWN');

-- AlterTable BroadcastCampaign
ALTER TABLE "BroadcastCampaign" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "duplicatedFromId" TEXT;

-- AlterTable BroadcastRecipient
ALTER TABLE "BroadcastRecipient" ADD COLUMN     "deliveryMethodUsed" "BroadcastRecipientDeliveryMethod";

-- AlterTable BroadcastSuppression
ALTER TABLE "BroadcastSuppression" ADD COLUMN     "reasonCode" "BroadcastSuppressionReasonCode" NOT NULL DEFAULT 'OTHER',
ADD COLUMN     "permanent" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "createdFromCampaignId" TEXT,
ADD COLUMN     "metadataJson" JSONB;

-- CreateTable
CREATE TABLE "BroadcastSavedAudience" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "audienceType" "BroadcastAudienceType" NOT NULL,
    "customNpubLines" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ruleSummary" TEXT,
    "lastResolvedSize" INTEGER,
    "rulesJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BroadcastSavedAudience_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BroadcastSavedAudience_userId_updatedAt_idx" ON "BroadcastSavedAudience"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "BroadcastSuppression_userId_expiresAt_idx" ON "BroadcastSuppression"("userId", "expiresAt");

-- AddForeignKey
ALTER TABLE "BroadcastCampaign" ADD CONSTRAINT "BroadcastCampaign_duplicatedFromId_fkey" FOREIGN KEY ("duplicatedFromId") REFERENCES "BroadcastCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BroadcastSuppression" ADD CONSTRAINT "BroadcastSuppression_createdFromCampaignId_fkey" FOREIGN KEY ("createdFromCampaignId") REFERENCES "BroadcastCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BroadcastSavedAudience" ADD CONSTRAINT "BroadcastSavedAudience_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
