/*
  Warnings:

  - You are about to drop the column `enableHashtags` on the `QueueType` table. All the data in the column will be lost.
  - You are about to drop the column `hashtags` on the `QueueType` table. All the data in the column will be lost.
  - You are about to drop the `HashTags` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."HashTags" DROP CONSTRAINT "HashTags_userId_fkey";

-- AlterTable
ALTER TABLE "public"."LongFormPost" ADD COLUMN     "hashTagPresetId" TEXT;

-- AlterTable
ALTER TABLE "public"."Post" ADD COLUMN     "hashTagPresetId" TEXT;

-- AlterTable
ALTER TABLE "public"."QueueType" DROP COLUMN "enableHashtags",
DROP COLUMN "hashtags";

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "enableMirrorBlossom" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mirrorUploadUrls" TEXT[];

-- DropTable
DROP TABLE "public"."HashTags";

-- CreateTable
CREATE TABLE "public"."HashTagPreset" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tags" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "HashTagPreset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HashTagPreset_userId_name_key" ON "public"."HashTagPreset"("userId", "name");

-- AddForeignKey
ALTER TABLE "public"."HashTagPreset" ADD CONSTRAINT "HashTagPreset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Post" ADD CONSTRAINT "Post_hashTagPresetId_fkey" FOREIGN KEY ("hashTagPresetId") REFERENCES "public"."HashTagPreset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LongFormPost" ADD CONSTRAINT "LongFormPost_hashTagPresetId_fkey" FOREIGN KEY ("hashTagPresetId") REFERENCES "public"."HashTagPreset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
