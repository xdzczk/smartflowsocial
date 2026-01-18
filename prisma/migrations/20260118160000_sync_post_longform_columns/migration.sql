-- Bring legacy databases in sync with current Prisma schema.
-- This migration is intentionally defensive (IF NOT EXISTS) to support:
-- - older prod DBs that missed intermediate migrations
-- - environments where some columns/indexes already exist
--
-- Primary goal: prevent Prisma runtime errors like:
--   "The column `(not available)` does not exist in the current database."
-- when selecting/creating Post and LongFormPost records.
--
-- NOTE: We do not drop legacy columns here (safe additive migration).

-- ============================================================================
-- Post
-- ============================================================================

ALTER TABLE "public"."Post"
  ADD COLUMN IF NOT EXISTS "scheduledAtUtc" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "currentState" TEXT NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN IF NOT EXISTS "hashTagPresetId" TEXT,
  ADD COLUMN IF NOT EXISTS "creationIdempotencyKey" TEXT,
  ADD COLUMN IF NOT EXISTS "enqueueIdempotencyKey" TEXT,
  ADD COLUMN IF NOT EXISTS "publishAttemptId" TEXT,
  ADD COLUMN IF NOT EXISTS "publishingLockId" TEXT,
  ADD COLUMN IF NOT EXISTS "publishingLockExpiresAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "publishingStartedAt" TIMESTAMP(3);

-- Unique indexes (Prisma uses unique indexes for @unique)
CREATE UNIQUE INDEX IF NOT EXISTS "Post_creationIdempotencyKey_key"
ON "public"."Post" ("creationIdempotencyKey");

CREATE UNIQUE INDEX IF NOT EXISTS "Post_enqueueIdempotencyKey_key"
ON "public"."Post" ("enqueueIdempotencyKey");

CREATE UNIQUE INDEX IF NOT EXISTS "Post_publishAttemptId_key"
ON "public"."Post" ("publishAttemptId");

-- State + schedule query indexes (match schema.prisma @@index)
CREATE INDEX IF NOT EXISTS "Post_userId_currentState_idx"
ON "public"."Post" ("userId", "currentState");

CREATE INDEX IF NOT EXISTS "Post_currentState_scheduledAtUtc_idx"
ON "public"."Post" ("currentState", "scheduledAtUtc");

CREATE INDEX IF NOT EXISTS "Post_userId_currentState_scheduledAtUtc_idx"
ON "public"."Post" ("userId", "currentState", "scheduledAtUtc");

CREATE INDEX IF NOT EXISTS "Post_userId_scheduledAtUtc_idx"
ON "public"."Post" ("userId", "scheduledAtUtc");

-- ============================================================================
-- LongFormPost
-- ============================================================================

ALTER TABLE "public"."LongFormPost"
  ADD COLUMN IF NOT EXISTS "scheduledAtUtc" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "currentState" TEXT NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN IF NOT EXISTS "hashTagPresetId" TEXT,
  ADD COLUMN IF NOT EXISTS "creationIdempotencyKey" TEXT,
  ADD COLUMN IF NOT EXISTS "enqueueIdempotencyKey" TEXT,
  ADD COLUMN IF NOT EXISTS "publishAttemptId" TEXT,
  ADD COLUMN IF NOT EXISTS "publishingLockId" TEXT,
  ADD COLUMN IF NOT EXISTS "publishingLockExpiresAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "publishingStartedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "LongFormPost_creationIdempotencyKey_key"
ON "public"."LongFormPost" ("creationIdempotencyKey");

CREATE UNIQUE INDEX IF NOT EXISTS "LongFormPost_enqueueIdempotencyKey_key"
ON "public"."LongFormPost" ("enqueueIdempotencyKey");

CREATE UNIQUE INDEX IF NOT EXISTS "LongFormPost_publishAttemptId_key"
ON "public"."LongFormPost" ("publishAttemptId");

CREATE INDEX IF NOT EXISTS "LongFormPost_userId_currentState_idx"
ON "public"."LongFormPost" ("userId", "currentState");

CREATE INDEX IF NOT EXISTS "LongFormPost_currentState_scheduledAtUtc_idx"
ON "public"."LongFormPost" ("currentState", "scheduledAtUtc");

CREATE INDEX IF NOT EXISTS "LongFormPost_userId_currentState_scheduledAtUtc_idx"
ON "public"."LongFormPost" ("userId", "currentState", "scheduledAtUtc");

CREATE INDEX IF NOT EXISTS "LongFormPost_userId_scheduledAtUtc_idx"
ON "public"."LongFormPost" ("userId", "scheduledAtUtc");

