-- Repair: ensure LongFormPostStateTransition exists (e.g. if 20260119180000 was marked applied but table missing).
-- Idempotent: safe to run on DBs that already have the table.

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

DO $$
BEGIN
  ALTER TABLE "public"."LongFormPostStateTransition" ADD CONSTRAINT "LongFormPostStateTransition_longFormPostId_fkey"
    FOREIGN KEY ("longFormPostId") REFERENCES "public"."LongFormPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
