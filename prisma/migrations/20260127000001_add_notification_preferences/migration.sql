-- Add push notification preference fields to User table

ALTER TABLE "User" 
ADD COLUMN IF NOT EXISTS "pushNotificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "pushNotifyPublishSuccess" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "pushNotifyPublishFailure" BOOLEAN NOT NULL DEFAULT true;
