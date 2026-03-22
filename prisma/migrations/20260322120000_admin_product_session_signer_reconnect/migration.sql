-- CreateEnum
CREATE TYPE "ProductSessionDeviceCoarse" AS ENUM ('mobile', 'desktop', 'tablet', 'unknown');

-- CreateEnum
CREATE TYPE "SignerReconnectFailureBucket" AS ENUM ('TIMEOUT', 'NETWORK', 'SESSION_DROPPED', 'UNKNOWN');

-- CreateTable
CREATE TABLE "ProductSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clientSessionId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "deviceCoarse" "ProductSessionDeviceCoarse",

    CONSTRAINT "ProductSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignerReconnectEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "failureBucket" "SignerReconnectFailureBucket",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SignerReconnectEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductSession_userId_clientSessionId_key" ON "ProductSession"("userId", "clientSessionId");

-- CreateIndex
CREATE INDEX "ProductSession_userId_lastActivityAt_idx" ON "ProductSession"("userId", "lastActivityAt");

-- CreateIndex
CREATE INDEX "ProductSession_lastActivityAt_idx" ON "ProductSession"("lastActivityAt");

-- CreateIndex
CREATE INDEX "SignerReconnectEvent_userId_createdAt_idx" ON "SignerReconnectEvent"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "SignerReconnectEvent_createdAt_idx" ON "SignerReconnectEvent"("createdAt");

-- AddForeignKey
ALTER TABLE "ProductSession" ADD CONSTRAINT "ProductSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignerReconnectEvent" ADD CONSTRAINT "SignerReconnectEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
