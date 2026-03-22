-- AlterTable
ALTER TABLE "Giveaway" ADD COLUMN     "payoutState" JSONB,
ADD COLUMN     "lastPreviewMeta" JSONB,
ADD COLUMN     "rerollCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "activityLog" JSONB,
ADD COLUMN     "excludedPubkeys" JSONB;

-- AlterTable
ALTER TABLE "GiveawayPreset" ADD COLUMN     "lastUsedAt" TIMESTAMP(3);
