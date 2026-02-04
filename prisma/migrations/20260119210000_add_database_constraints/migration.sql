-- Add database constraints for data integrity.
-- Runs after init and sync_post_longform_columns so Post exists with currentState.
-- PostStateTransition, OutboxEvent, DeadLetterJob may not exist (no CREATE in migration history), so we add constraints only when tables exist.

-- Check constraint: Ensure Post currentState is a valid PostState
ALTER TABLE "public"."Post"
ADD CONSTRAINT "Post_currentState_check"
CHECK ("currentState" IN ('DRAFT', 'SCHEDULED', 'PUBLISHING', 'PUBLISHED', 'FAILED', 'CANCELLED'));
COMMENT ON CONSTRAINT "Post_currentState_check" ON "public"."Post" IS 'Ensures currentState is a valid PostState value';

-- PostStateTransition (only if table exists; add constraints only if not already present)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'PostStateTransition') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PostStateTransition_fromState_check') THEN
      ALTER TABLE "public"."PostStateTransition"
        ADD CONSTRAINT "PostStateTransition_fromState_check"
        CHECK ("fromState" IN ('DRAFT', 'SCHEDULED', 'PUBLISHING', 'PUBLISHED', 'FAILED', 'CANCELLED'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PostStateTransition_toState_check') THEN
      ALTER TABLE "public"."PostStateTransition"
        ADD CONSTRAINT "PostStateTransition_toState_check"
        CHECK ("toState" IN ('DRAFT', 'SCHEDULED', 'PUBLISHING', 'PUBLISHED', 'FAILED', 'CANCELLED'));
    END IF;
    COMMENT ON CONSTRAINT "PostStateTransition_fromState_check" ON "public"."PostStateTransition" IS 'Ensures fromState is a valid PostState value';
    COMMENT ON CONSTRAINT "PostStateTransition_toState_check" ON "public"."PostStateTransition" IS 'Ensures toState is a valid PostState value';
  END IF;
END $$;

-- OutboxEvent (only if table exists; 20260119190000 may already have added eventType_check)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'OutboxEvent') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OutboxEvent_eventType_check') THEN
      ALTER TABLE "public"."OutboxEvent"
        ADD CONSTRAINT "OutboxEvent_eventType_check"
        CHECK ("eventType" IN ('POST_SCHEDULED', 'LONGFORM_SCHEDULED', 'POST_CANCELLED', 'LONGFORM_CANCELLED'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OutboxEvent_aggregateType_check') THEN
      ALTER TABLE "public"."OutboxEvent"
        ADD CONSTRAINT "OutboxEvent_aggregateType_check"
        CHECK ("aggregateType" IN ('Post', 'LongFormPost'));
    END IF;
    COMMENT ON CONSTRAINT "OutboxEvent_eventType_check" ON "public"."OutboxEvent" IS 'Ensures eventType is a valid OutboxEventType value';
    COMMENT ON CONSTRAINT "OutboxEvent_aggregateType_check" ON "public"."OutboxEvent" IS 'Ensures aggregateType is Post or LongFormPost';
  END IF;
END $$;

-- DeadLetterJob (only if table exists; add constraints only if not already present)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'DeadLetterJob') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DeadLetterJob_queueType_check') THEN
      ALTER TABLE "public"."DeadLetterJob"
        ADD CONSTRAINT "DeadLetterJob_queueType_check"
        CHECK ("queueType" IN ('scheduled-posts', 'scheduled-longform-posts', 'post-checker'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DeadLetterJob_attemptsMade_check') THEN
      ALTER TABLE "public"."DeadLetterJob"
        ADD CONSTRAINT "DeadLetterJob_attemptsMade_check"
        CHECK ("attemptsMade" >= 0);
    END IF;
    COMMENT ON CONSTRAINT "DeadLetterJob_queueType_check" ON "public"."DeadLetterJob" IS 'Ensures queueType is a valid QueueType value';
    COMMENT ON CONSTRAINT "DeadLetterJob_attemptsMade_check" ON "public"."DeadLetterJob" IS 'Ensures attemptsMade is non-negative';
  END IF;
END $$;
