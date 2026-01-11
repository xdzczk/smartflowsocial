-- CreateTable
CREATE TABLE "ScheduledPostRead" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "caption" TEXT,
    "scheduledAtUtc" TIMESTAMP(3) NOT NULL,
    "queueTypeName" TEXT NOT NULL,
    "queueTypeColor" TEXT,
    "hashTagPresetId" TEXT,
    "templateId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduledPostRead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublishedPostRead" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "caption" TEXT,
    "postedAt" TIMESTAMP(3) NOT NULL,
    "queueTypeName" TEXT NOT NULL,
    "queueTypeColor" TEXT,
    "engagementScore" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublishedPostRead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostAnalyticsDaily" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "postsScheduled" INTEGER NOT NULL DEFAULT 0,
    "postsPublished" INTEGER NOT NULL DEFAULT 0,
    "postsFailed" INTEGER NOT NULL DEFAULT 0,
    "avgEngagement" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PostAnalyticsDaily_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScheduledPostRead_userId_scheduledAtUtc_idx" ON "ScheduledPostRead"("userId", "scheduledAtUtc");

-- CreateIndex
CREATE INDEX "ScheduledPostRead_userId_queueTypeName_idx" ON "ScheduledPostRead"("userId", "queueTypeName");

-- CreateIndex
CREATE INDEX "ScheduledPostRead_scheduledAtUtc_idx" ON "ScheduledPostRead"("scheduledAtUtc");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduledPostRead_postId_key" ON "ScheduledPostRead"("postId");

-- CreateIndex
CREATE INDEX "PublishedPostRead_userId_postedAt_idx" ON "PublishedPostRead"("userId", "postedAt");

-- CreateIndex
CREATE INDEX "PublishedPostRead_userId_queueTypeName_idx" ON "PublishedPostRead"("userId", "queueTypeName");

-- CreateIndex
CREATE INDEX "PublishedPostRead_userId_postedAt_engagementScore_idx" ON "PublishedPostRead"("userId", "postedAt", "engagementScore");

-- CreateIndex
CREATE INDEX "PublishedPostRead_postedAt_idx" ON "PublishedPostRead"("postedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PublishedPostRead_postId_key" ON "PublishedPostRead"("postId");

-- CreateIndex
CREATE UNIQUE INDEX "PostAnalyticsDaily_userId_date_key" ON "PostAnalyticsDaily"("userId", "date");

-- CreateIndex
CREATE INDEX "PostAnalyticsDaily_userId_date_idx" ON "PostAnalyticsDaily"("userId", "date");

-- CreateIndex
CREATE INDEX "PostAnalyticsDaily_date_idx" ON "PostAnalyticsDaily"("date");
