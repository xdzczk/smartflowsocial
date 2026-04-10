-- Attached follow-up scheduling metadata and signing lifecycle.
CREATE TYPE "ScheduledDependencyMode" AS ENUM ('standalone', 'attached');
CREATE TYPE "ScheduledTargetMode" AS ENUM ('direct', 'scheduled_parent');
CREATE TYPE "FollowUpTimingMode" AS ENUM ('offset_from_parent', 'fixed_datetime');
CREATE TYPE "ScheduledSigningState" AS ENUM ('unsigned', 'signed', 'stale', 'invalidated');

ALTER TABLE "Post"
ADD COLUMN "parentScheduledActionId" TEXT,
ADD COLUMN "rootScheduledActionId" TEXT,
ADD COLUMN "targetScheduledActionId" TEXT,
ADD COLUMN "dependencyMode" "ScheduledDependencyMode" NOT NULL DEFAULT 'standalone',
ADD COLUMN "targetMode" "ScheduledTargetMode" NOT NULL DEFAULT 'direct',
ADD COLUMN "followUpTimingMode" "FollowUpTimingMode",
ADD COLUMN "followUpOffsetSeconds" INTEGER,
ADD COLUMN "expectedParentEventId" TEXT,
ADD COLUMN "signedChildEventId" TEXT,
ADD COLUMN "signingState" "ScheduledSigningState" NOT NULL DEFAULT 'unsigned';

ALTER TABLE "Post"
ADD CONSTRAINT "Post_parentScheduledActionId_fkey"
FOREIGN KEY ("parentScheduledActionId") REFERENCES "Post"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Post_parentScheduledActionId_idx" ON "Post"("parentScheduledActionId");
CREATE INDEX "Post_rootScheduledActionId_idx" ON "Post"("rootScheduledActionId");
CREATE INDEX "Post_targetScheduledActionId_idx" ON "Post"("targetScheduledActionId");
CREATE INDEX "Post_dependencyMode_currentState_scheduledAtUtc_idx" ON "Post"("dependencyMode", "currentState", "scheduledAtUtc");
CREATE INDEX "Post_signingState_currentState_idx" ON "Post"("signingState", "currentState");
