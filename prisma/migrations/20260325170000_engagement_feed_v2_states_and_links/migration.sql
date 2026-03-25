-- Expand EngagementItemState workflow model for Engagement Feed v2
ALTER TYPE "EngagementItemStateKind" ADD VALUE IF NOT EXISTS 'UNHANDLED';
ALTER TYPE "EngagementItemStateKind" ADD VALUE IF NOT EXISTS 'DRAFTED';
ALTER TYPE "EngagementItemStateKind" ADD VALUE IF NOT EXISTS 'SCHEDULED';
ALTER TYPE "EngagementItemStateKind" ADD VALUE IF NOT EXISTS 'REPLIED';
ALTER TYPE "EngagementItemStateKind" ADD VALUE IF NOT EXISTS 'IGNORED';
ALTER TYPE "EngagementItemStateKind" ADD VALUE IF NOT EXISTS 'SNOOZED';

-- Backfill legacy handled rows as replied
UPDATE "EngagementItemState"
SET "state" = 'REPLIED'
WHERE "state" = 'HANDLED';

-- Add snooze support
ALTER TABLE "EngagementItemState"
ADD COLUMN IF NOT EXISTS "snoozedUntil" TIMESTAMP(3);

-- Set default for new rows
ALTER TABLE "EngagementItemState"
ALTER COLUMN "state" SET DEFAULT 'UNHANDLED';

-- Add index used by workflow filters
CREATE INDEX IF NOT EXISTS "EngagementItemState_userId_state_idx"
ON "EngagementItemState"("userId", "state");

-- Linked actions attached to an engagement item
CREATE TYPE "EngagementLinkedActionKind" AS ENUM (
  'DRAFT',
  'SCHEDULED_REPLY',
  'SCHEDULED_QUOTE',
  'SCHEDULED_REPOST',
  'QUEUED_REPLY',
  'QUEUED_QUOTE',
  'QUEUED_REPOST'
);

CREATE TABLE "EngagementLinkedAction" (
  "id" TEXT NOT NULL,
  "engagementItemStateId" TEXT NOT NULL,
  "kind" "EngagementLinkedActionKind" NOT NULL,
  "postId" TEXT,
  "draftId" TEXT,
  "queueTypeId" TEXT,
  "label" TEXT,
  "scheduledFor" TIMESTAMP(3),
  "isCanceled" BOOLEAN NOT NULL DEFAULT false,
  "isPublished" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EngagementLinkedAction_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EngagementLinkedAction_engagementItemStateId_fkey"
    FOREIGN KEY ("engagementItemStateId")
    REFERENCES "EngagementItemState"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

CREATE INDEX "EngagementLinkedAction_engagementItemStateId_kind_idx"
ON "EngagementLinkedAction"("engagementItemStateId", "kind");
