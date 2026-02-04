-- Create OutboxEvent, PostStateTransition, LongFormPostStateTransition, DeadLetterJob.
-- These models exist in the Prisma schema but were never created by a migration;
-- 20260119190000_outbox_retry_and_lock expects OutboxEvent to exist.

-- OutboxEvent (full column set so later migration's ADD COLUMN IF NOT EXISTS no-ops)
CREATE TABLE IF NOT EXISTS "public"."OutboxEvent" (
  "id" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "aggregateId" TEXT NOT NULL,
  "aggregateType" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "scheduledFor" TIMESTAMP(3),
  "idempotencyKey" TEXT,
  "correlationId" TEXT,
  "processedAt" TIMESTAMP(3),
  "processingError" TEXT,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lastAttemptAt" TIMESTAMP(3),
  "nextAttemptAt" TIMESTAMP(3),
  "lastError" TEXT,
  "deadLetteredAt" TIMESTAMP(3),
  "processingLockId" TEXT,
  "processingLockExpiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "OutboxEvent_idempotencyKey_key" ON "public"."OutboxEvent"("idempotencyKey");
CREATE UNIQUE INDEX IF NOT EXISTS "OutboxEvent_eventType_aggregateId_scheduledFor_key" ON "public"."OutboxEvent"("eventType", "aggregateId", "scheduledFor");
CREATE INDEX IF NOT EXISTS "OutboxEvent_eventType_processedAt_idx" ON "public"."OutboxEvent"("eventType", "processedAt");
CREATE INDEX IF NOT EXISTS "OutboxEvent_scheduledFor_processedAt_idx" ON "public"."OutboxEvent"("scheduledFor", "processedAt");
CREATE INDEX IF NOT EXISTS "OutboxEvent_aggregateId_eventType_idx" ON "public"."OutboxEvent"("aggregateId", "eventType");
CREATE INDEX IF NOT EXISTS "OutboxEvent_correlationId_idx" ON "public"."OutboxEvent"("correlationId");

-- PostStateTransition
CREATE TABLE IF NOT EXISTS "public"."PostStateTransition" (
  "id" TEXT NOT NULL,
  "postId" TEXT NOT NULL,
  "fromState" TEXT NOT NULL,
  "toState" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PostStateTransition_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PostStateTransition_postId_createdAt_idx" ON "public"."PostStateTransition"("postId", "createdAt");
ALTER TABLE "public"."PostStateTransition" ADD CONSTRAINT "PostStateTransition_postId_fkey"
  FOREIGN KEY ("postId") REFERENCES "public"."Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- LongFormPostStateTransition
CREATE TABLE IF NOT EXISTS "public"."LongFormPostStateTransition" (
  "id" TEXT NOT NULL,
  "longFormPostId" TEXT NOT NULL,
  "fromState" TEXT NOT NULL,
  "toState" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "LongFormPostStateTransition_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "LongFormPostStateTransition_longFormPostId_createdAt_idx" ON "public"."LongFormPostStateTransition"("longFormPostId", "createdAt");
ALTER TABLE "public"."LongFormPostStateTransition" ADD CONSTRAINT "LongFormPostStateTransition_longFormPostId_fkey"
  FOREIGN KEY ("longFormPostId") REFERENCES "public"."LongFormPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DeadLetterJob
CREATE TABLE IF NOT EXISTS "public"."DeadLetterJob" (
  "id" TEXT NOT NULL,
  "queueType" TEXT NOT NULL,
  "jobId" TEXT NOT NULL,
  "jobName" TEXT NOT NULL,
  "jobData" JSONB NOT NULL,
  "error" TEXT NOT NULL,
  "errorStack" TEXT,
  "attemptsMade" INTEGER NOT NULL,
  "correlationId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DeadLetterJob_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "DeadLetterJob_queueType_createdAt_idx" ON "public"."DeadLetterJob"("queueType", "createdAt");
CREATE INDEX IF NOT EXISTS "DeadLetterJob_correlationId_idx" ON "public"."DeadLetterJob"("correlationId");
CREATE INDEX IF NOT EXISTS "DeadLetterJob_jobId_idx" ON "public"."DeadLetterJob"("jobId");
