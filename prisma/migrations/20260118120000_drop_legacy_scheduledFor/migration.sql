-- Drop legacy scheduledFor columns now that scheduledAtUtc is canonical.
-- Safe for repeated runs in environments with partial state.

-- Drop indexes referencing scheduledFor (if present)
DROP INDEX IF EXISTS "public"."Post_userId_scheduledFor_idx";
DROP INDEX IF EXISTS "public"."LongFormPost_userId_scheduledFor_idx";

-- Drop columns
ALTER TABLE "public"."Post" DROP COLUMN IF EXISTS "scheduledFor";
ALTER TABLE "public"."LongFormPost" DROP COLUMN IF EXISTS "scheduledFor";

