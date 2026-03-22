-- CreateEnum
CREATE TYPE "public"."GiveawayFinalizationFeeStatus" AS ENUM ('NONE', 'PENDING', 'PAID', 'WAIVED');

-- CreateEnum
CREATE TYPE "public"."GiveawayFinalizationPaymentStatus" AS ENUM ('PENDING', 'PAID', 'EXPIRED', 'FAILED');

-- CreateEnum
CREATE TYPE "public"."PaymentPurpose" AS ENUM ('SUBSCRIPTION', 'GIVEAWAY_FINALIZATION');

-- AlterTable
ALTER TABLE "public"."Giveaway" ADD COLUMN     "lockedByUserId" TEXT,
ADD COLUMN     "plannedPayoutSats" INTEGER,
ADD COLUMN     "finalizationFeeRateBps" INTEGER,
ADD COLUMN     "finalizationFeeSats" INTEGER,
ADD COLUMN     "finalizationFeeStatus" "public"."GiveawayFinalizationFeeStatus",
ADD COLUMN     "planAtFinalization" TEXT,
ADD COLUMN     "lockConfigHash" TEXT;

-- AlterTable
ALTER TABLE "public"."Payment" ADD COLUMN     "purpose" "public"."PaymentPurpose" NOT NULL DEFAULT 'SUBSCRIPTION';

-- CreateTable
CREATE TABLE "public"."GiveawayFinalizationPayment" (
    "id" TEXT NOT NULL,
    "giveawayId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planName" TEXT NOT NULL,
    "feeRateBps" INTEGER NOT NULL,
    "plannedPayoutSats" INTEGER NOT NULL,
    "feeSats" INTEGER NOT NULL,
    "lockConfigHash" TEXT NOT NULL,
    "status" "public"."GiveawayFinalizationPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paymentMethod" TEXT,
    "paymentId" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "GiveawayFinalizationPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GiveawayFinalizationPayment_paymentId_key" ON "public"."GiveawayFinalizationPayment"("paymentId");

-- CreateIndex
CREATE INDEX "GiveawayFinalizationPayment_giveawayId_idx" ON "public"."GiveawayFinalizationPayment"("giveawayId");

-- CreateIndex
CREATE INDEX "GiveawayFinalizationPayment_userId_idx" ON "public"."GiveawayFinalizationPayment"("userId");

-- CreateIndex
CREATE INDEX "GiveawayFinalizationPayment_giveawayId_status_idx" ON "public"."GiveawayFinalizationPayment"("giveawayId", "status");

-- AddForeignKey
ALTER TABLE "public"."GiveawayFinalizationPayment" ADD CONSTRAINT "GiveawayFinalizationPayment_giveawayId_fkey" FOREIGN KEY ("giveawayId") REFERENCES "public"."Giveaway"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GiveawayFinalizationPayment" ADD CONSTRAINT "GiveawayFinalizationPayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GiveawayFinalizationPayment" ADD CONSTRAINT "GiveawayFinalizationPayment_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "public"."Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
