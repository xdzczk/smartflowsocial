-- Change default time format from 12h to 24h (existing rows unchanged)
ALTER TABLE "User" ALTER COLUMN "timeFormat" SET DEFAULT '24h';
