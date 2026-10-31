-- CreateTable
CREATE TABLE "TrackedAuthorEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "nostrEventId" TEXT NOT NULL,
    "kind" INTEGER NOT NULL,
    "eventCreatedAt" TIMESTAMP(3),
    "contentExcerpt" TEXT NOT NULL DEFAULT '',
    "postId" TEXT,
    "discoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrackedAuthorEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthorEventSync" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stream" TEXT NOT NULL,
    "nextCursor" TEXT,
    "backfillComplete" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthorEventSync_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostPerformanceObservation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "nostrEventId" TEXT NOT NULL,
    "postId" TEXT,
    "reactionCount" INTEGER,
    "replyCount" INTEGER,
    "repostCount" INTEGER,
    "zapCount" INTEGER,
    "zapMsats" BIGINT,
    "missingFromIndex" BOOLEAN NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostPerformanceObservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostPerformanceLatest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "nostrEventId" TEXT NOT NULL,
    "postId" TEXT,
    "reactionCount" INTEGER,
    "replyCount" INTEGER,
    "repostCount" INTEGER,
    "zapCount" INTEGER,
    "zapMsats" BIGINT,
    "missingFromIndex" BOOLEAN NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PostPerformanceLatest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TrackedAuthorEvent_userId_nostrEventId_key" ON "TrackedAuthorEvent"("userId", "nostrEventId");

-- CreateIndex
CREATE INDEX "TrackedAuthorEvent_userId_eventCreatedAt_idx" ON "TrackedAuthorEvent"("userId", "eventCreatedAt");

-- CreateIndex
CREATE INDEX "TrackedAuthorEvent_postId_idx" ON "TrackedAuthorEvent"("postId");

-- CreateIndex
CREATE UNIQUE INDEX "AuthorEventSync_userId_stream_key" ON "AuthorEventSync"("userId", "stream");

-- CreateIndex
CREATE INDEX "AuthorEventSync_userId_idx" ON "AuthorEventSync"("userId");

-- CreateIndex
CREATE INDEX "PostPerformanceObservation_userId_nostrEventId_checkedAt_idx" ON "PostPerformanceObservation"("userId", "nostrEventId", "checkedAt");

-- CreateIndex
CREATE INDEX "PostPerformanceObservation_userId_checkedAt_idx" ON "PostPerformanceObservation"("userId", "checkedAt");

-- CreateIndex
CREATE INDEX "PostPerformanceObservation_postId_idx" ON "PostPerformanceObservation"("postId");

-- CreateIndex
CREATE UNIQUE INDEX "PostPerformanceLatest_userId_nostrEventId_key" ON "PostPerformanceLatest"("userId", "nostrEventId");

-- CreateIndex
CREATE INDEX "PostPerformanceLatest_userId_checkedAt_idx" ON "PostPerformanceLatest"("userId", "checkedAt");

-- CreateIndex
CREATE INDEX "PostPerformanceLatest_postId_idx" ON "PostPerformanceLatest"("postId");

-- AddForeignKey
ALTER TABLE "TrackedAuthorEvent" ADD CONSTRAINT "TrackedAuthorEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackedAuthorEvent" ADD CONSTRAINT "TrackedAuthorEvent_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthorEventSync" ADD CONSTRAINT "AuthorEventSync_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostPerformanceObservation" ADD CONSTRAINT "PostPerformanceObservation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostPerformanceObservation" ADD CONSTRAINT "PostPerformanceObservation_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostPerformanceLatest" ADD CONSTRAINT "PostPerformanceLatest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostPerformanceLatest" ADD CONSTRAINT "PostPerformanceLatest_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE SET NULL ON UPDATE CASCADE;
