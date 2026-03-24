-- CreateTable
CREATE TABLE "BroadcastUnsubscribeToken" (
    "id" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "usedAt" TIMESTAMP(3),

    CONSTRAINT "BroadcastUnsubscribeToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BroadcastUnsubscribeToken_recipientId_key" ON "BroadcastUnsubscribeToken"("recipientId");

-- CreateIndex
CREATE INDEX "BroadcastUnsubscribeToken_tokenHash_idx" ON "BroadcastUnsubscribeToken"("tokenHash");

-- AddForeignKey
ALTER TABLE "BroadcastUnsubscribeToken" ADD CONSTRAINT "BroadcastUnsubscribeToken_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "BroadcastRecipient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
