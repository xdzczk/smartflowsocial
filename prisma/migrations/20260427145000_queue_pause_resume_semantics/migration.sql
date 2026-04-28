CREATE TYPE "public"."QueueStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ARCHIVED');

CREATE TYPE "public"."QueueHoldStatus" AS ENUM ('NONE', 'HELD_BY_QUEUE', 'NEEDS_RESIGN_AFTER_QUEUE_RESUME');

ALTER TABLE "QueueType"
ADD COLUMN "status" "public"."QueueStatus" NOT NULL DEFAULT 'ACTIVE';

UPDATE "QueueType"
SET "status" = 'PAUSED'
WHERE "isEnabled" = false;

ALTER TABLE "Post"
ADD COLUMN "queueHoldStatus" "public"."QueueHoldStatus" NOT NULL DEFAULT 'NONE',
ADD COLUMN "queueHeldAtUtc" TIMESTAMP(3),
ADD COLUMN "queueHeldOriginalScheduledAtUtc" TIMESTAMP(3),
ADD COLUMN "queueHeldByQueueTypeId" TEXT;

ALTER TABLE "LongFormPost"
ADD COLUMN "queueHoldStatus" "public"."QueueHoldStatus" NOT NULL DEFAULT 'NONE',
ADD COLUMN "queueHeldAtUtc" TIMESTAMP(3),
ADD COLUMN "queueHeldOriginalScheduledAtUtc" TIMESTAMP(3),
ADD COLUMN "queueHeldByQueueTypeId" TEXT;

CREATE INDEX "Post_queueTypeId_queueHoldStatus_scheduledAtUtc_idx"
ON "Post"("queueTypeId", "queueHoldStatus", "scheduledAtUtc");

CREATE INDEX "LongFormPost_queueTypeId_queueHoldStatus_scheduledAtUtc_idx"
ON "LongFormPost"("queueTypeId", "queueHoldStatus", "scheduledAtUtc");
