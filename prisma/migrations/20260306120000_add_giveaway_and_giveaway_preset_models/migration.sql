-- CreateEnum
CREATE TYPE "GiveawayScopeType" AS ENUM ('PERIOD', 'SINGLE_POST', 'QUEUE');

-- CreateEnum
CREATE TYPE "GiveawayStatus" AS ENUM ('DRAFT', 'PREVIEWED', 'LOCKED', 'PAID_OUT', 'CANCELLED');

-- CreateEnum
CREATE TYPE "GiveawaySelectionMode" AS ENUM ('UNIQUE_USER', 'WEIGHTED_BY_ENGAGEMENT');

-- CreateTable
CREATE TABLE "Giveaway" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scopeType" "GiveawayScopeType" NOT NULL,
    "scopeReference" JSONB NOT NULL,
    "eligibilityFrom" TIMESTAMP(3),
    "eligibilityTo" TIMESTAMP(3),
    "engagementTypes" JSONB NOT NULL,
    "winnerCount" INTEGER NOT NULL,
    "selectionMode" "GiveawaySelectionMode" NOT NULL DEFAULT 'UNIQUE_USER',
    "engagementWeights" JSONB,
    "filters" JSONB,
    "status" "GiveawayStatus" NOT NULL DEFAULT 'DRAFT',
    "lockedAt" TIMESTAMP(3),
    "winnerSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Giveaway_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GiveawayPreset" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scopeType" "GiveawayScopeType" NOT NULL,
    "scopeReference" JSONB NOT NULL,
    "engagementTypes" JSONB NOT NULL,
    "winnerCount" INTEGER NOT NULL,
    "selectionMode" "GiveawaySelectionMode" NOT NULL DEFAULT 'UNIQUE_USER',
    "engagementWeights" JSONB,
    "filters" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GiveawayPreset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Giveaway_userId_idx" ON "Giveaway"("userId");

-- CreateIndex
CREATE INDEX "Giveaway_userId_status_idx" ON "Giveaway"("userId", "status");

-- CreateIndex
CREATE INDEX "Giveaway_userId_createdAt_idx" ON "Giveaway"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "GiveawayPreset_userId_name_key" ON "GiveawayPreset"("userId", "name");

-- AddForeignKey
ALTER TABLE "Giveaway" ADD CONSTRAINT "Giveaway_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiveawayPreset" ADD CONSTRAINT "GiveawayPreset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
