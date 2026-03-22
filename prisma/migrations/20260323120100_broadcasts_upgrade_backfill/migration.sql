-- Enum values from prior migration are committed; safe to use in updates.
UPDATE "BroadcastCampaign"
SET "status" = 'AWAITING_SIGNATURE'::"BroadcastCampaignStatus"
WHERE "status" = 'DRAFT'::"BroadcastCampaignStatus"
  AND "totalRecipients" > 0;

UPDATE "BroadcastCampaign"
SET "status" = 'COMPLETED_WITH_FAILURES'::"BroadcastCampaignStatus"
WHERE "status" = 'COMPLETED'::"BroadcastCampaignStatus"
  AND "failedCount" > 0;
