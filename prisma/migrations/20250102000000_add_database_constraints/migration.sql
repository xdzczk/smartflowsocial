-- Add database constraints for data integrity
-- These constraints enforce invariants at the database level

-- Check constraint: Ensure currentState is a valid PostState
ALTER TABLE "Post" 
ADD CONSTRAINT "Post_currentState_check" 
CHECK ("currentState" IN ('DRAFT', 'SCHEDULED', 'PUBLISHING', 'PUBLISHED', 'FAILED', 'CANCELLED'));

-- Check constraint: Ensure PostStateTransition fromState is valid
ALTER TABLE "PostStateTransition" 
ADD CONSTRAINT "PostStateTransition_fromState_check" 
CHECK ("fromState" IN ('DRAFT', 'SCHEDULED', 'PUBLISHING', 'PUBLISHED', 'FAILED', 'CANCELLED'));

-- Check constraint: Ensure PostStateTransition toState is valid
ALTER TABLE "PostStateTransition" 
ADD CONSTRAINT "PostStateTransition_toState_check" 
CHECK ("toState" IN ('DRAFT', 'SCHEDULED', 'PUBLISHING', 'PUBLISHED', 'FAILED', 'CANCELLED'));

-- Check constraint: Ensure scheduledAtUtc is in the future when isScheduled is true
-- Note: This is a soft constraint - we allow past dates for flexibility
-- A stricter constraint would be: CHECK (NOT "isScheduled" OR "scheduledAtUtc" IS NULL OR "scheduledAtUtc" > NOW())
-- But we'll keep it lenient for now to allow rescheduling past posts

-- Check constraint: Ensure isPosted and isScheduled are consistent with currentState
-- If currentState is PUBLISHED, isPosted should be true
-- If currentState is SCHEDULED, isScheduled should be true
-- Note: These are soft constraints - we'll enforce in application code for flexibility
-- Database constraints would be too rigid for state transitions

-- Check constraint: Ensure OutboxEvent eventType is valid
ALTER TABLE "OutboxEvent" 
ADD CONSTRAINT "OutboxEvent_eventType_check" 
CHECK ("eventType" IN ('POST_SCHEDULED', 'LONGFORM_SCHEDULED', 'POST_CANCELLED', 'LONGFORM_CANCELLED'));

-- Check constraint: Ensure OutboxEvent aggregateType is valid
ALTER TABLE "OutboxEvent" 
ADD CONSTRAINT "OutboxEvent_aggregateType_check" 
CHECK ("aggregateType" IN ('Post', 'LongFormPost'));

-- Check constraint: Ensure DeadLetterJob queueType is valid
ALTER TABLE "DeadLetterJob" 
ADD CONSTRAINT "DeadLetterJob_queueType_check" 
CHECK ("queueType" IN ('scheduled-posts', 'scheduled-longform-posts', 'post-checker'));

-- Check constraint: Ensure attemptsMade is non-negative
ALTER TABLE "DeadLetterJob" 
ADD CONSTRAINT "DeadLetterJob_attemptsMade_check" 
CHECK ("attemptsMade" >= 0);

-- Check constraint: Ensure PostStateTransition attemptsMade is non-negative (if we add it)
-- Note: We don't track attempts in PostStateTransition, but if we did:
-- ALTER TABLE "PostStateTransition" ADD CONSTRAINT "PostStateTransition_attempts_check" CHECK ("attemptsMade" >= 0);

-- Add comment to document constraints
COMMENT ON CONSTRAINT "Post_currentState_check" ON "Post" IS 'Ensures currentState is a valid PostState value';
COMMENT ON CONSTRAINT "PostStateTransition_fromState_check" ON "PostStateTransition" IS 'Ensures fromState is a valid PostState value';
COMMENT ON CONSTRAINT "PostStateTransition_toState_check" ON "PostStateTransition" IS 'Ensures toState is a valid PostState value';
COMMENT ON CONSTRAINT "OutboxEvent_eventType_check" ON "OutboxEvent" IS 'Ensures eventType is a valid OutboxEventType value';
COMMENT ON CONSTRAINT "OutboxEvent_aggregateType_check" ON "OutboxEvent" IS 'Ensures aggregateType is Post or LongFormPost';
COMMENT ON CONSTRAINT "DeadLetterJob_queueType_check" ON "DeadLetterJob" IS 'Ensures queueType is a valid QueueType value';
COMMENT ON CONSTRAINT "DeadLetterJob_attemptsMade_check" ON "DeadLetterJob" IS 'Ensures attemptsMade is non-negative';
