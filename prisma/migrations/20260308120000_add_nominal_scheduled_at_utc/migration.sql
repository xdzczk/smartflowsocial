-- AlterTable
ALTER TABLE "Post" ADD COLUMN "nominalScheduledAtUtc" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "LongFormPost" ADD COLUMN "nominalScheduledAtUtc" TIMESTAMP(3);
