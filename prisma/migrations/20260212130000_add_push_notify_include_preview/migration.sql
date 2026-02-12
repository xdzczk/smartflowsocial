-- Add pushNotifyIncludePreview to User table (include post preview in publish success notifications)

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "pushNotifyIncludePreview" BOOLEAN NOT NULL DEFAULT true;
