-- Add column to track that we've applied device locale once per user (never again)
ALTER TABLE "User" ADD COLUMN "localeDefaultsAppliedAt" TIMESTAMP(3);

-- Mark all existing users as already applied so we never overwrite their preferences
UPDATE "User" SET "localeDefaultsAppliedAt" = now() WHERE "localeDefaultsAppliedAt" IS NULL;
