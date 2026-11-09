-- AlterTable
ALTER TABLE "User" ADD COLUMN "hideFromLanding" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "landingNoticeSeenAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "PublicStatsSnapshot" (
    "id" TEXT NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payload" JSONB NOT NULL,

    CONSTRAINT "PublicStatsSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PublicStatsSnapshot_computedAt_idx" ON "PublicStatsSnapshot"("computedAt");
