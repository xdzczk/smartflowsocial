-- CreateEnum
CREATE TYPE "EngagementItemStateKind" AS ENUM ('HANDLED');

-- CreateTable
CREATE TABLE "EngagementItemState" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "state" "EngagementItemStateKind" NOT NULL DEFAULT 'HANDLED',
    "repliedFromApp" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EngagementItemState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EngagementItemState_userId_eventId_key" ON "EngagementItemState"("userId", "eventId");

-- CreateIndex
CREATE INDEX "EngagementItemState_userId_idx" ON "EngagementItemState"("userId");

-- AddForeignKey
ALTER TABLE "EngagementItemState" ADD CONSTRAINT "EngagementItemState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
