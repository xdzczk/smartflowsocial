-- CreateEnum
CREATE TYPE "ContestOrchestrationSourceMode" AS ENUM ('existing_post', 'new_post');

-- CreateEnum
CREATE TYPE "ContestOrchestrationLaunchMode" AS ENUM ('now', 'schedule');

-- CreateEnum
CREATE TYPE "ContestSourcePostPublishStatus" AS ENUM ('not_needed', 'pending', 'scheduled', 'publishing', 'published', 'failed');

-- CreateEnum
CREATE TYPE "ContestActivationOrchestrationStatus" AS ENUM ('draft', 'scheduled', 'activating', 'active', 'failed', 'blocked_by_source_failure');

-- AlterEnum
ALTER TYPE "ContestStatus" ADD VALUE 'SCHEDULED_LAUNCH';

-- AlterTable
ALTER TABLE "Contest" ALTER COLUMN "sourceNoteId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "ContestLaunchOrchestration" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contestId" TEXT NOT NULL,
    "sourceMode" "ContestOrchestrationSourceMode" NOT NULL,
    "launchMode" "ContestOrchestrationLaunchMode" NOT NULL,
    "scheduledFor" TIMESTAMP(3),
    "existingSourcePostId" TEXT,
    "sourcePostId" TEXT,
    "sourcePostPublishStatus" "ContestSourcePostPublishStatus" NOT NULL DEFAULT 'not_needed',
    "contestActivationStatus" "ContestActivationOrchestrationStatus" NOT NULL DEFAULT 'draft',
    "publishedSourceEventId" TEXT,
    "lastErrorCode" TEXT,
    "lastErrorMessage" TEXT,
    "activationJobId" TEXT,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContestLaunchOrchestration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContestCreationDraft" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContestCreationDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ContestLaunchOrchestration_contestId_key" ON "ContestLaunchOrchestration"("contestId");

-- CreateIndex
CREATE UNIQUE INDEX "ContestLaunchOrchestration_idempotencyKey_key" ON "ContestLaunchOrchestration"("idempotencyKey");

-- CreateIndex
CREATE INDEX "ContestLaunchOrchestration_userId_idx" ON "ContestLaunchOrchestration"("userId");

-- CreateIndex
CREATE INDEX "ContestLaunchOrchestration_sourcePostId_idx" ON "ContestLaunchOrchestration"("sourcePostId");

-- CreateIndex
CREATE UNIQUE INDEX "ContestCreationDraft_userId_key" ON "ContestCreationDraft"("userId");

-- AddForeignKey
ALTER TABLE "ContestLaunchOrchestration" ADD CONSTRAINT "ContestLaunchOrchestration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContestLaunchOrchestration" ADD CONSTRAINT "ContestLaunchOrchestration_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "Contest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContestCreationDraft" ADD CONSTRAINT "ContestCreationDraft_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
