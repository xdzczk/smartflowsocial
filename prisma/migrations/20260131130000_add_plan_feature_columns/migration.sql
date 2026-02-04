-- Add plan feature-flag columns expected by current schema and seed.
-- Original subscription migration only had enableAnalytics, enableTeamCollaboration, etc.;
-- schema now uses enableAdvancedAnalytics, enableBasicScheduling, etc.

ALTER TABLE "public"."Plan"
  ADD COLUMN IF NOT EXISTS "enableAdvancedAnalytics" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "enableBasicScheduling" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "enableBulkScheduling" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "enableCommissions" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "enableEngagementFeed" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "enableGiveaways" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "enableLeaderboards" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "enableLifetimeAccess" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "enableMultiAccountSwitching" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "enableMultipleQueues" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "enableNativeS3BlossomStorage" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "enableRelayBlast" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "enableRepostsAndQuotes" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "enableVisualPerks" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "enableWolfFilteringAndVortex" BOOLEAN NOT NULL DEFAULT false;
