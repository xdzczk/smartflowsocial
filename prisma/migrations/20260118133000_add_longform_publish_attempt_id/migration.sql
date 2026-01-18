-- Add publishAttemptId to LongFormPost for publish idempotency parity with Post.
-- Safe for repeated runs.

ALTER TABLE "public"."LongFormPost"
ADD COLUMN IF NOT EXISTS "publishAttemptId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "LongFormPost_publishAttemptId_key"
ON "public"."LongFormPost" ("publishAttemptId");

