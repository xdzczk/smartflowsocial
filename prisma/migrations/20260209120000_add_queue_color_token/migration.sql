-- Add colorToken to QueueType (12 design-approved tokens; backfill from color)
ALTER TABLE "QueueType" ADD COLUMN IF NOT EXISTS "colorToken" TEXT;

-- Add queueTypeColorToken to read models (denormalized from QueueType.colorToken)
ALTER TABLE "ScheduledPostRead" ADD COLUMN IF NOT EXISTS "queueTypeColorToken" TEXT;
ALTER TABLE "PublishedPostRead" ADD COLUMN IF NOT EXISTS "queueTypeColorToken" TEXT;
