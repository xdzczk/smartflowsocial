-- CreateTable
CREATE TABLE "DraftGroup" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DraftGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DraftGroupVersion" (
    "id" TEXT NOT NULL,
    "draftGroupId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "DraftGroupVersion_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Post" ADD COLUMN "draftGroupId" TEXT;

-- CreateIndex
CREATE INDEX "DraftGroup_userId_idx" ON "DraftGroup"("userId");

-- CreateIndex
CREATE INDEX "DraftGroupVersion_draftGroupId_version_idx" ON "DraftGroupVersion"("draftGroupId", "version");

-- CreateIndex
CREATE INDEX "Post_draftGroupId_idx" ON "Post"("draftGroupId");

-- AddForeignKey
ALTER TABLE "DraftGroup" ADD CONSTRAINT "DraftGroup_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DraftGroupVersion" ADD CONSTRAINT "DraftGroupVersion_draftGroupId_fkey" FOREIGN KEY ("draftGroupId") REFERENCES "DraftGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DraftGroupVersion" ADD CONSTRAINT "DraftGroupVersion_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_draftGroupId_fkey" FOREIGN KEY ("draftGroupId") REFERENCES "DraftGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
