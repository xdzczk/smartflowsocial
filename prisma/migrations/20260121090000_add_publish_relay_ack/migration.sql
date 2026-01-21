-- Add per-relay publish acknowledgements (execution observability)
--
-- This migration is intentionally defensive (IF NOT EXISTS) to support:
-- - environments that missed intermediate migrations
-- - environments where some objects already exist

-- ============================================================================
-- Enum: PublishRelayAckStatus
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'PublishRelayAckStatus'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."PublishRelayAckStatus" AS ENUM (
      'ACCEPTED',
      'FAILED',
      'TIMEOUT'
    );
  END IF;
END $$;

-- ============================================================================
-- Table: PublishRelayAck
-- ============================================================================

CREATE TABLE IF NOT EXISTS "public"."PublishRelayAck" (
  "id" TEXT NOT NULL,
  "publishAttemptId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "relayUrl" TEXT NOT NULL,
  "status" "public"."PublishRelayAckStatus" NOT NULL,
  "receivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PublishRelayAck_pkey" PRIMARY KEY ("id")
);

-- Unique constraint on (publishAttemptId, relayUrl)
CREATE UNIQUE INDEX IF NOT EXISTS "PublishRelayAck_publishAttemptId_relayUrl_key"
ON "public"."PublishRelayAck" ("publishAttemptId", "relayUrl");

-- Indexes to support settings UI + debugging
CREATE INDEX IF NOT EXISTS "PublishRelayAck_userId_relayUrl_createdAt_idx"
ON "public"."PublishRelayAck" ("userId", "relayUrl", "createdAt");

CREATE INDEX IF NOT EXISTS "PublishRelayAck_eventId_createdAt_idx"
ON "public"."PublishRelayAck" ("eventId", "createdAt");

-- FK to User (defensive)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'PublishRelayAck_userId_fkey'
  ) THEN
    ALTER TABLE "public"."PublishRelayAck"
      ADD CONSTRAINT "PublishRelayAck_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "public"."User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

