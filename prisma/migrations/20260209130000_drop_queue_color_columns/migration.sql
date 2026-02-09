-- Drop legacy queue color columns (replaced by colorToken / queueTypeColorToken)
ALTER TABLE "QueueType" DROP COLUMN IF EXISTS "color";
ALTER TABLE "ScheduledPostRead" DROP COLUMN IF EXISTS "queueTypeColor";
ALTER TABLE "PublishedPostRead" DROP COLUMN IF EXISTS "queueTypeColor";
