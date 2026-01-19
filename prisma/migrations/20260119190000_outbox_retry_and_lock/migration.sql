-- Add retry + concurrency-lock fields to OutboxEvent
-- This enables at-least-once outbox processing with bounded retries and dead-lettering.
--
-- This migration is intentionally defensive (IF NOT EXISTS) to support:
-- - older DBs that missed intermediate migrations
-- - environments where some columns/indexes already exist

-- ============================================================================
-- OutboxEvent: retry metadata + processing locks
-- ============================================================================

ALTER TABLE "public"."OutboxEvent"
  ADD COLUMN IF NOT EXISTS "attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "lastAttemptAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "nextAttemptAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lastError" TEXT,
  ADD COLUMN IF NOT EXISTS "deadLetteredAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "processingLockId" TEXT,
  ADD COLUMN IF NOT EXISTS "processingLockExpiresAt" TIMESTAMP(3);

-- Ensure attempts stays non-negative.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'OutboxEvent_attempts_check'
  ) THEN
    ALTER TABLE "public"."OutboxEvent"
      ADD CONSTRAINT "OutboxEvent_attempts_check"
      CHECK ("attempts" >= 0);
  END IF;
END $$;

-- The original constraint only allowed a subset of event types.
-- Update it to match the full set used by the application (including read-model events).
ALTER TABLE "public"."OutboxEvent"
  DROP CONSTRAINT IF EXISTS "OutboxEvent_eventType_check";

ALTER TABLE "public"."OutboxEvent"
  ADD CONSTRAINT "OutboxEvent_eventType_check"
  CHECK (
    "eventType" IN (
      'POST_SCHEDULED',
      'LONGFORM_SCHEDULED',
      'POST_CANCELLED',
      'LONGFORM_CANCELLED',
      'POST_CREATED',
      'POST_UPDATED',
      'POST_PUBLISHED',
      'POST_DELETED',
      'LONGFORM_CREATED',
      'LONGFORM_UPDATED',
      'LONGFORM_PUBLISHED',
      'LONGFORM_DELETED'
    )
  );

-- Helpful indexes for polling ready work and debugging.
CREATE INDEX IF NOT EXISTS "OutboxEvent_processedAt_nextAttemptAt_idx"
ON "public"."OutboxEvent" ("processedAt", "nextAttemptAt");

CREATE INDEX IF NOT EXISTS "OutboxEvent_deadLetteredAt_idx"
ON "public"."OutboxEvent" ("deadLetteredAt");

CREATE INDEX IF NOT EXISTS "OutboxEvent_processingLockExpiresAt_idx"
ON "public"."OutboxEvent" ("processingLockExpiresAt");

