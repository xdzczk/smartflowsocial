-- Add PENDING value to PublishRelayAckStatus enum.
--
-- The intended-acks observability flow inserts one row per intended relay
-- BEFORE the publisher fans out, with status='PENDING'. Subsequent ACKs
-- upgrade those rows to ACCEPTED/FAILED/TIMEOUT. Any rows still in
-- PENDING after the publish window closes mean the publisher returned no
-- result for that relay (true gap rather than UI inference).
--
-- Defensive: idempotent IF NOT EXISTS-style guard so re-running this
-- migration on environments where it's been applied (or via prisma db
-- push) is a no-op.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'PublishRelayAckStatus'
      AND n.nspname = 'public'
      AND e.enumlabel = 'PENDING'
  ) THEN
    ALTER TYPE "public"."PublishRelayAckStatus" ADD VALUE 'PENDING' BEFORE 'ACCEPTED';
  END IF;
END $$;
