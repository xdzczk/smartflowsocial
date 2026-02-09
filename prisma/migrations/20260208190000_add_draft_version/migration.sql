-- CreateTable
CREATE TABLE "DraftVersion" (
    "id" TEXT NOT NULL,
    "postId" TEXT,
    "longFormPostId" TEXT,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB,
    "snapshotCompressed" BYTEA,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "DraftVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DraftVersion_postId_version_idx" ON "DraftVersion"("postId", "version");

-- CreateIndex
CREATE INDEX "DraftVersion_longFormPostId_version_idx" ON "DraftVersion"("longFormPostId", "version");

-- AddForeignKey
ALTER TABLE "DraftVersion" ADD CONSTRAINT "DraftVersion_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DraftVersion" ADD CONSTRAINT "DraftVersion_longFormPostId_fkey" FOREIGN KEY ("longFormPostId") REFERENCES "LongFormPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DraftVersion" ADD CONSTRAINT "DraftVersion_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
