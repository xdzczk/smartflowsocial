-- CreateEnum
CREATE TYPE "BillingNotificationCommMode" AS ENUM ('AUTO_RENEW_NWC', 'MANUAL_TOP_UP');

-- CreateEnum
CREATE TYPE "BillingNotificationChannel" AS ENUM ('nostr_dm', 'in_app_state');

-- CreateEnum
CREATE TYPE "BillingNotificationAttemptStatus" AS ENUM ('pending', 'sent', 'failed');

-- CreateTable
CREATE TABLE "SubscriptionNotificationAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "planId" TEXT,
    "eventType" TEXT NOT NULL,
    "commMode" "BillingNotificationCommMode" NOT NULL,
    "channel" "BillingNotificationChannel" NOT NULL DEFAULT 'nostr_dm',
    "dedupeKey" TEXT NOT NULL,
    "status" "BillingNotificationAttemptStatus" NOT NULL DEFAULT 'pending',
    "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "deliveryMetaJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionNotificationAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionNotificationAttempt_dedupeKey_key" ON "SubscriptionNotificationAttempt"("dedupeKey");

-- CreateIndex
CREATE INDEX "SubscriptionNotificationAttempt_userId_createdAt_idx" ON "SubscriptionNotificationAttempt"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "SubscriptionNotificationAttempt_subscriptionId_eventType_idx" ON "SubscriptionNotificationAttempt"("subscriptionId", "eventType");

-- AddForeignKey
ALTER TABLE "SubscriptionNotificationAttempt" ADD CONSTRAINT "SubscriptionNotificationAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionNotificationAttempt" ADD CONSTRAINT "SubscriptionNotificationAttempt_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;
