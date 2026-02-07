-- CreateEnum
CREATE TYPE "PostKind" AS ENUM ('POST', 'THREAD', 'REPLY', 'REPOST', 'QUOTE');

-- AlterTable
ALTER TABLE "Post" ADD COLUMN "postKind" "PostKind" NOT NULL DEFAULT 'POST';
ALTER TABLE "Post" ADD COLUMN "replyToEventId" TEXT;
ALTER TABLE "Post" ADD COLUMN "replyToPostId" TEXT;

-- Backfill postKind from existing relations
UPDATE "Post" SET "postKind" = 'THREAD' WHERE "threadGroupId" IS NOT NULL;
UPDATE "Post" SET "postKind" = 'REPOST' WHERE "repostOfPostId" IS NOT NULL;
UPDATE "Post" SET "postKind" = 'QUOTE' WHERE "quoteOfPostId" IS NOT NULL;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_replyToPostId_fkey" FOREIGN KEY ("replyToPostId") REFERENCES "Post"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "Post_replyToPostId_idx" ON "Post"("replyToPostId");
