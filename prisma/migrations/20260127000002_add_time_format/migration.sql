-- Add timeFormat field to User table
ALTER TABLE "User" ADD COLUMN "timeFormat" TEXT DEFAULT '12h';
