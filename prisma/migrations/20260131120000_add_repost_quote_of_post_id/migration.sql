-- AlterTable
ALTER TABLE "Post" ADD COLUMN "repostOfPostId" TEXT,
ADD COLUMN "quoteOfPostId" TEXT;

-- CreateIndex
CREATE INDEX "Post_repostOfPostId_idx" ON "Post"("repostOfPostId");

-- CreateIndex
CREATE INDEX "Post_quoteOfPostId_idx" ON "Post"("quoteOfPostId");

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_repostOfPostId_fkey" FOREIGN KEY ("repostOfPostId") REFERENCES "Post"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_quoteOfPostId_fkey" FOREIGN KEY ("quoteOfPostId") REFERENCES "Post"("id") ON DELETE SET NULL ON UPDATE CASCADE;
