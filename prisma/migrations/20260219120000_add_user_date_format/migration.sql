-- Add dateFormat field to User table (date display preference: ddmmyyyy | mmddyyyy | yyyymmdd)
ALTER TABLE "User" ADD COLUMN "dateFormat" TEXT DEFAULT 'ddmmyyyy';
