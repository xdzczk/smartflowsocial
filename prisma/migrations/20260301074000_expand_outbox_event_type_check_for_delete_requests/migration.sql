-- Expand OutboxEvent event type check to include relay-delete request events.
-- This keeps DB constraints aligned with application-level OutboxEventType.

ALTER TABLE "public"."OutboxEvent"
  DROP CONSTRAINT IF EXISTS "OutboxEvent_eventType_check";

ALTER TABLE "public"."OutboxEvent"
  ADD CONSTRAINT "OutboxEvent_eventType_check"
  CHECK (
    "eventType" IN (
      'POST_SCHEDULED',
      'LONGFORM_SCHEDULED',
      'POST_CANCELLED',
      'LONGFORM_CANCELLED',
      'POST_DELETE_REQUESTED',
      'LONGFORM_DELETE_REQUESTED',
      'POST_CREATED',
      'POST_UPDATED',
      'POST_PUBLISHED',
      'POST_DELETED',
      'LONGFORM_CREATED',
      'LONGFORM_UPDATED',
      'LONGFORM_PUBLISHED',
      'LONGFORM_DELETED'
    )
  );
