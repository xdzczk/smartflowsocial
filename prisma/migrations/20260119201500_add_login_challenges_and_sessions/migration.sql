-- Add LoginChallenge and Session tables for Nostr authentication
--
-- This migration is intentionally defensive (IF NOT EXISTS) to support:
-- - environments that missed intermediate migrations
-- - environments where some objects already exist
--
-- Tables:
-- - LoginChallenge: single-use server-issued login challenges (auditable)
-- - Session: DB-backed sessions bound to a single pubkey (revocable)

-- ============================================================================
-- LoginChallenge
-- ============================================================================

CREATE TABLE IF NOT EXISTS "public"."LoginChallenge" (
  "id" TEXT NOT NULL,
  "nonce" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "pubkey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LoginChallenge_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "LoginChallenge_expiresAt_idx"
ON "public"."LoginChallenge" ("expiresAt");

CREATE INDEX IF NOT EXISTS "LoginChallenge_consumedAt_idx"
ON "public"."LoginChallenge" ("consumedAt");

CREATE INDEX IF NOT EXISTS "LoginChallenge_pubkey_idx"
ON "public"."LoginChallenge" ("pubkey");

-- ============================================================================
-- Session
-- ============================================================================

CREATE TABLE IF NOT EXISTS "public"."Session" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "pubkey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- Add FK if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Session_userId_fkey'
  ) THEN
    ALTER TABLE "public"."Session"
      ADD CONSTRAINT "Session_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "public"."User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Session_userId_revokedAt_idx"
ON "public"."Session" ("userId", "revokedAt");

CREATE INDEX IF NOT EXISTS "Session_pubkey_idx"
ON "public"."Session" ("pubkey");

CREATE INDEX IF NOT EXISTS "Session_expiresAt_idx"
ON "public"."Session" ("expiresAt");

