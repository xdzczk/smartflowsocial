-- Allow multiple POST_SCHEDULED rows per (aggregate, scheduled instant) when the Nostr
-- event id changes (reschedule / re-sign). Uniqueness for enqueue intent is enforced by
-- OutboxEvent.idempotencyKey (@unique), which includes the event id.
DROP INDEX IF EXISTS "OutboxEvent_eventType_aggregateId_scheduledFor_key";
