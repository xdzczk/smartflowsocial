-- Bulk and draft follow-ups stored a signed Nostr event but left signingState
-- at the default "unsigned". The publisher discards attached follow-ups in
-- that state before it checks engagement conditions. Promote the ones whose
-- signature still matches the parent event they were signed against.
UPDATE "Post" AS child
SET
  "signingState" = 'signed'::"ScheduledSigningState",
  "signedChildEventId" = child."signedEvent"->>'id'
FROM "Post" AS parent
WHERE child."parentScheduledActionId" = parent.id
  AND child."userId" = parent."userId"
  AND child."currentState" = 'SCHEDULED'
  AND child."dependencyMode" = 'attached'
  AND child."signingState" = 'unsigned'
  AND child."scheduledAtUtc" IS NOT NULL
  AND jsonb_typeof(child."signedEvent") = 'object'
  AND COALESCE(child."signedEvent"->>'id', '') <> ''
  AND COALESCE(child."signedEvent"->>'sig', '') <> ''
  AND child."expectedParentEventId" IS NOT NULL
  AND child."expectedParentEventId" = COALESCE(
    parent."nostrEventId",
    parent."signedEvent"->>'id'
  );
