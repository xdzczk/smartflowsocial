-- AlterTable
-- Default schedule intervals: 0.25 (15 min), 0.5 (30 min), 1, 2, 4, 12, 24 hours (for new users only)
ALTER TABLE "public"."User" ALTER COLUMN "scheduleInterval" SET DEFAULT ARRAY['0.25', '0.5', '1', '2', '4', '12', '24']::TEXT[];
