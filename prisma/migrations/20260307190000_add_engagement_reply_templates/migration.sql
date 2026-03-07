-- CreateTable
CREATE TABLE "EngagementReplyTemplate" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EngagementReplyTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EngagementReplyTemplate_userId_slug_key" ON "EngagementReplyTemplate"("userId", "slug");

-- CreateIndex
CREATE INDEX "EngagementReplyTemplate_userId_idx" ON "EngagementReplyTemplate"("userId");

-- AddForeignKey
ALTER TABLE "EngagementReplyTemplate" ADD CONSTRAINT "EngagementReplyTemplate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
