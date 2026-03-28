-- Runs after 20260325170000 so new enum values are committed before use (PG 55P04).

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
DO $$ BEGIN
  CREATE TYPE "EngagementLinkedActionKind" AS ENUM (
    'DRAFT',
    'SCHEDULED_REPLY',
    'SCHEDULED_QUOTE',
    'SCHEDULED_REPOST',
    'QUEUED_REPLY',
    'QUEUED_QUOTE',
    'QUEUED_REPOST'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "EngagementLinkedAction" (
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

CREATE INDEX IF NOT EXISTS "EngagementLinkedAction_engagementItemStateId_kind_idx"
ON "EngagementLinkedAction"("engagementItemStateId", "kind");
