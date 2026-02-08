-- AlterTable
ALTER TABLE "Post" ADD COLUMN "quoteOfLongFormPostId" TEXT;

-- CreateIndex
CREATE INDEX "Post_quoteOfLongFormPostId_idx" ON "Post"("quoteOfLongFormPostId");

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_quoteOfLongFormPostId_fkey" FOREIGN KEY ("quoteOfLongFormPostId") REFERENCES "LongFormPost"("id") ON DELETE SET NULL ON UPDATE CASCADE;
