-- CreateEnum
CREATE TYPE "public"."PostType" AS ENUM ('IMAGE', 'CAROUSEL', 'TEXT', 'VIDEO');

-- CreateEnum
CREATE TYPE "public"."AssetType" AS ENUM ('TEXT', 'IMAGE', 'VIDEO');

-- CreateEnum
CREATE TYPE "public"."ScheduleType" AS ENUM ('INTERVAL', 'FIXED_SLOTS');

-- CreateEnum
CREATE TYPE "public"."Status" AS ENUM ('DRAFT', 'ACTIVE', 'SCHEDULED', 'PAUSED', 'POSTED', 'FAILED');

-- CreateEnum
CREATE TYPE "public"."UploadProvider" AS ENUM ('S3', 'BLOSSOM_PRIMAL', 'BLOSSOM_BLOSSTR');

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "npub" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "timezone" TEXT DEFAULT 'Etc/GMT',
    "userRelays" TEXT[] DEFAULT ARRAY['wss://relay.bullishbounty.com', 'wss://relay.snort.social', 'wss://relay.primal.net', 'wss://relay.damus.io', 'wss://relay.nostr.band']::TEXT[],
    "giveawayBlackListed" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "uploadProvider" "public"."UploadProvider" NOT NULL DEFAULT 'S3',
    "showHashTagsinPosts" BOOLEAN NOT NULL DEFAULT false,
    "scheduleInterval" TEXT[] DEFAULT ARRAY['2', '4', '6', '12', '24']::TEXT[],
    "nostrProfile" JSONB,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."QueueType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scheduleType" "public"."ScheduleType" NOT NULL DEFAULT 'INTERVAL',
    "scheduleConfig" JSONB NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "color" TEXT,
    "description" TEXT,
    "lastPostTime" TIMESTAMP(3),
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "enableHashtags" BOOLEAN NOT NULL DEFAULT false,
    "hashtags" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "QueueType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."HashTags" (
    "id" TEXT NOT NULL,
    "tags" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "HashTags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Post" (
    "id" TEXT NOT NULL,
    "nostrEventId" TEXT,
    "caption" TEXT,
    "fileUrl" TEXT[],
    "scheduledFor" TEXT,
    "postedAt" TIMESTAMP(3),
    "content" TEXT,
    "isPosted" BOOLEAN NOT NULL DEFAULT false,
    "isScheduled" BOOLEAN NOT NULL DEFAULT false,
    "postType" "public"."PostType" NOT NULL DEFAULT 'IMAGE',
    "repost" BOOLEAN NOT NULL DEFAULT false,
    "isQuotedPost" BOOLEAN NOT NULL DEFAULT false,
    "isRecyclable" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "draft" BOOLEAN NOT NULL DEFAULT false,
    "status" "public"."Status" NOT NULL DEFAULT 'ACTIVE',
    "signedEvent" JSONB,
    "nostrEvent" JSONB,
    "queueTypeId" TEXT,
    "tags" TEXT[],
    "manual_override" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT NOT NULL,
    "templateId" TEXT,

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."LongFormPost" (
    "id" TEXT NOT NULL,
    "nostrEventId" TEXT,
    "title" TEXT,
    "summary" TEXT,
    "content" TEXT,
    "image" TEXT,
    "scheduledFor" TEXT,
    "isScheduled" BOOLEAN NOT NULL DEFAULT false,
    "postedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "draft" BOOLEAN NOT NULL DEFAULT false,
    "status" "public"."Status" NOT NULL DEFAULT 'DRAFT',
    "queueTypeId" TEXT,
    "tags" TEXT[],
    "signedEvent" JSONB,
    "nostrEvent" JSONB,
    "userId" TEXT NOT NULL,

    CONSTRAINT "LongFormPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Template" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Asset" (
    "id" TEXT NOT NULL,
    "title" TEXT,
    "content" TEXT,
    "fileUrl" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "assetType" "public"."AssetType" NOT NULL DEFAULT 'TEXT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_npub_key" ON "public"."User"("npub");

-- CreateIndex
CREATE UNIQUE INDEX "QueueType_userId_name_key" ON "public"."QueueType"("userId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "HashTags_userId_key" ON "public"."HashTags"("userId");

-- AddForeignKey
ALTER TABLE "public"."QueueType" ADD CONSTRAINT "QueueType_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."HashTags" ADD CONSTRAINT "HashTags_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Post" ADD CONSTRAINT "Post_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Post" ADD CONSTRAINT "Post_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "public"."Template"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Post" ADD CONSTRAINT "Post_queueTypeId_fkey" FOREIGN KEY ("queueTypeId") REFERENCES "public"."QueueType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LongFormPost" ADD CONSTRAINT "LongFormPost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LongFormPost" ADD CONSTRAINT "LongFormPost_queueTypeId_fkey" FOREIGN KEY ("queueTypeId") REFERENCES "public"."QueueType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Template" ADD CONSTRAINT "Template_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Asset" ADD CONSTRAINT "Asset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
