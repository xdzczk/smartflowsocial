-- CreateEnum
CREATE TYPE "public"."ReservationStatus" AS ENUM ('RESERVED', 'COMMITTED', 'EXPIRED', 'CANCELED');

-- CreateEnum
CREATE TYPE "public"."ReservationBatchStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELED');

-- CreateTable
CREATE TABLE "public"."BlossomReservationBatch" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pubkey" TEXT NOT NULL,
    "totalBytes" BIGINT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "status" "public"."ReservationBatchStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BlossomReservationBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BlossomReservationItem" (
    "id" TEXT NOT NULL,
    "jti" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "pubkey" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "mimeType" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "status" "public"."ReservationStatus" NOT NULL DEFAULT 'RESERVED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BlossomReservationItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BlossomCommit" (
    "id" TEXT NOT NULL,
    "jti" TEXT NOT NULL,
    "batchId" TEXT,
    "pubkey" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "mimeType" TEXT,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlossomCommit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BlossomUploadUsagePeriod" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "periodStartUtc" DATE NOT NULL,
    "uploadedBytes" BIGINT NOT NULL DEFAULT 0,
    "uploadedFiles" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BlossomUploadUsagePeriod_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BlossomReservationBatch_batchId_key" ON "public"."BlossomReservationBatch"("batchId");

-- CreateIndex
CREATE INDEX "BlossomReservationBatch_userId_status_expiresAt_idx" ON "public"."BlossomReservationBatch"("userId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "BlossomReservationBatch_pubkey_status_expiresAt_idx" ON "public"."BlossomReservationBatch"("pubkey", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "BlossomReservationBatch_expiresAt_status_idx" ON "public"."BlossomReservationBatch"("expiresAt", "status");

-- CreateIndex
CREATE UNIQUE INDEX "BlossomReservationItem_jti_key" ON "public"."BlossomReservationItem"("jti");

-- CreateIndex
CREATE INDEX "BlossomReservationItem_batchId_status_idx" ON "public"."BlossomReservationItem"("batchId", "status");

-- CreateIndex
CREATE INDEX "BlossomReservationItem_pubkey_status_expiresAt_idx" ON "public"."BlossomReservationItem"("pubkey", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "BlossomReservationItem_sha256_idx" ON "public"."BlossomReservationItem"("sha256");

-- CreateIndex
CREATE INDEX "BlossomReservationItem_expiresAt_status_idx" ON "public"."BlossomReservationItem"("expiresAt", "status");

-- CreateIndex
CREATE UNIQUE INDEX "BlossomCommit_jti_key" ON "public"."BlossomCommit"("jti");

-- CreateIndex
CREATE INDEX "BlossomCommit_pubkey_createdAt_idx" ON "public"."BlossomCommit"("pubkey", "createdAt");

-- CreateIndex
CREATE INDEX "BlossomCommit_batchId_idx" ON "public"."BlossomCommit"("batchId");

-- CreateIndex
CREATE UNIQUE INDEX "BlossomUploadUsagePeriod_userId_periodStartUtc_key" ON "public"."BlossomUploadUsagePeriod"("userId", "periodStartUtc");

-- CreateIndex
CREATE INDEX "BlossomUploadUsagePeriod_periodStartUtc_idx" ON "public"."BlossomUploadUsagePeriod"("periodStartUtc");

-- AddForeignKey
ALTER TABLE "public"."BlossomReservationBatch" ADD CONSTRAINT "BlossomReservationBatch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BlossomReservationItem" ADD CONSTRAINT "BlossomReservationItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "public"."BlossomReservationBatch"("batchId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BlossomUploadUsagePeriod" ADD CONSTRAINT "BlossomUploadUsagePeriod_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
