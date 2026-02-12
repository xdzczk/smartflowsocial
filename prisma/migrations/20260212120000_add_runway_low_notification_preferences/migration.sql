-- Add runway low push notification preference and throttle columns to User table

ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "pushNotifyRunwayLow" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "runwayNotifyBelowDays" INTEGER,
ADD COLUMN IF NOT EXISTS "lastRunwayLowNotificationAt" TIMESTAMP(3);
