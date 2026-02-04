-- Add User columns for NWC (Nostr Wallet Connect), muted list, and multi-account (parent/child).
-- These exist in the Prisma schema but were never added by a migration.

ALTER TABLE "public"."User"
  ADD COLUMN IF NOT EXISTS "encryptedNwc" TEXT,
  ADD COLUMN IF NOT EXISTS "nwcEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "nwcLastUsed" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "mutedList" JSONB,
  ADD COLUMN IF NOT EXISTS "filterMuted" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "hidePostsFromLowTrustUsers" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "isChild" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "parentNpub" TEXT,
  ADD COLUMN IF NOT EXISTS "pendingParentRequests" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Index for parent/child lookups (schema has @@index([parentNpub]))
CREATE INDEX IF NOT EXISTS "User_parentNpub_idx" ON "public"."User"("parentNpub");

-- FK for parent relation (parent Npub references User.npub)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'User_parentNpub_fkey'
  ) THEN
    ALTER TABLE "public"."User"
      ADD CONSTRAINT "User_parentNpub_fkey"
      FOREIGN KEY ("parentNpub") REFERENCES "public"."User"("npub") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
