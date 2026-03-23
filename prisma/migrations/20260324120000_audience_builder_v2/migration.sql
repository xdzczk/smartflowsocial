-- Audience Builder v2: parse snapshot for review + optional exclusion rules
ALTER TABLE "BroadcastCampaign" ADD COLUMN IF NOT EXISTS "parseSnapshotJson" JSONB;
ALTER TABLE "BroadcastCampaign" ADD COLUMN IF NOT EXISTS "exclusionRulesJson" JSONB;
