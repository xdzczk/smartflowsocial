-- Persist media intent provider contract for upload pipeline consistency.
CREATE TABLE "MediaUploadIntent" (
  "id" TEXT NOT NULL,
  "intentId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "provider" "UploadProvider" NOT NULL,
  "composeSessionId" TEXT,
  "fileCount" INTEGER NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MediaUploadIntent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MediaUploadIntent_intentId_key" ON "MediaUploadIntent"("intentId");
CREATE INDEX "MediaUploadIntent_userId_expiresAt_idx" ON "MediaUploadIntent"("userId", "expiresAt");
CREATE INDEX "MediaUploadIntent_expiresAt_idx" ON "MediaUploadIntent"("expiresAt");

ALTER TABLE "MediaUploadIntent"
ADD CONSTRAINT "MediaUploadIntent_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BlossomReservationBatch"
ADD COLUMN "provider" "UploadProvider" NOT NULL DEFAULT 'BLOSSOM_SFS',
ADD COLUMN "sourceIntentId" TEXT;

CREATE INDEX "BlossomReservationBatch_provider_status_expiresAt_idx"
ON "BlossomReservationBatch"("provider", "status", "expiresAt");

CREATE INDEX "BlossomReservationBatch_sourceIntentId_idx"
ON "BlossomReservationBatch"("sourceIntentId");
